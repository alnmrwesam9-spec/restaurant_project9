# ==========================================
# allergens/views.py
# ==========================================
from django.http import HttpResponse, StreamingHttpResponse
from django.db.models import Q, Subquery
from rest_framework.viewsets import ModelViewSet
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.response import Response
from rest_framework import status
from rest_framework.exceptions import PermissionDenied

import csv
import io
import re

from core.models import Allergen, AdditiveLegend, Ingredient
from core.utils.auth import is_admin

# وحّد الاستيراد من نفس التطبيق (allergens.serializers)
from .serializers import (
    AllergenCodeSerializer,
    AdminAllergenSerializer,      # German-only for admin/dish workflows
    AdditiveCodeSerializer,         # بديل AdditiveLegendSerializer
    IngredientLiteSerializer,
    KeywordLexemeSerializer,
)

from core.dictionary_models import KeywordLexeme
# تطبيع النصوص لتعبئة normalized_term بشكل موحّد
from core.services.allergen_rules import normalize_text as _norm


# ==========================================
# خطوة 1 — أداة مساعدة لصلاحيات الكتابة
# ==========================================
def _ensure_owner_write_permission(request, owner_id):
    """
    قواعد الكتابة:
    - owner_id is None  => Admin فقط (موارد عامة)
    - owner_id == request.user.id => مسموح
    - خلاف ذلك => Admin فقط
    """
    if owner_id is None:
        if not is_admin(request.user):
            raise PermissionDenied("Only admins can write to global resources.")
    elif owner_id != getattr(request.user, "id", None):
        if not is_admin(request.user):
            raise PermissionDenied("You cannot write on behalf of another owner.")


# ==========================================
# Allergen (قاموس الحساسيّات) — ViewSet قياسي
# German-only workflow: uses core.Allergen model + AdminAllergenSerializer
# ==========================================
class AllergenCodeViewSet(ModelViewSet):
    """
    CRUD for German-only allergen catalog.
    Uses core.Allergen model (NOT allergens.AllergenCode).
    Exposes only: id, code, name_de
    Supports q for search & ordering (code, name_de).
    """
    queryset = Allergen.objects.all().order_by("code")
    serializer_class = AdminAllergenSerializer  # German-only: id, code, name_de
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = Allergen.objects.all()

        # بحث نصّي (German-only: code + name_de)
        q = self.request.query_params.get("q", "").strip()
        if q:
            qs = qs.filter(
                Q(code__icontains=q)
                | Q(label_de__icontains=q)
            )

        # ترتيب آمن (German-only fields)
        ordering = self.request.query_params.get("ordering", "code").strip()
        allowed = {"code", "name_de", "-code", "-name_de"}
        if ordering not in allowed:
            ordering = "code"
        # Map name_de to label_de for ORM
        if ordering == "name_de":
            ordering = "label_de"
        elif ordering == "-name_de":
            ordering = "-label_de"

        return qs.order_by(ordering, "id")


# ==========================================
# Allergen (قاموس الحساسيّات) — واجهات API مسطّحة
# German-only workflow
# ==========================================
class AllergenCodesView(APIView):
    """
    GET: قائمة أكواد الحساسيّات (German-only) مع فلترة وترتيب وتقسيم صفحات.
    POST: إضافة/تعديل عنصر واحد حسب الكود (قاموس عام واحد).
    """
    permission_classes = [IsAuthenticated]

    # -------- GET (List) --------
    def get(self, request):
        qs = Allergen.objects.all()

        # 🔎 دعم q للبحث العام (German-only: code + name_de)
        q = (request.query_params.get("q") or "").strip()
        if q:
            qs = qs.filter(
                Q(code__icontains=q)
                | Q(label_de__icontains=q)
            )

        # الفلاتر المساندة (German-only)
        code = request.query_params.get("code") or request.query_params.get("letter")
        de = request.query_params.get("de") or request.query_params.get("name_de")

        if code:
            qs = qs.filter(code__iexact=str(code).strip())
        if de:
            qs = qs.filter(label_de__icontains=de)

        # ترتيب آمن (German-only)
        ordering = (request.query_params.get("ordering") or "code").strip()
        allowed = {"code", "name_de", "-code", "-name_de"}
        if ordering not in allowed:
            ordering = "code"
        # Map name_de to label_de for ORM
        if ordering == "name_de":
            ordering = "label_de"
        elif ordering == "-name_de":
            ordering = "-label_de"
        qs = qs.order_by(ordering, "id")

        # تقسيم صفحات بسيط
        try:
            page = int(request.query_params.get("page", "1"))
            page_size = int(request.query_params.get("page_size", "50"))
        except ValueError:
            page, page_size = 1, 50
        start, end = (page - 1) * page_size, page * page_size
        total = qs.count()

        return Response(
            {
                "count": total,
                "next": None if end >= total else f"?page={page+1}&page_size={page_size}",
                "previous": None if page == 1 else f"?page={page-1}&page_size={page_size}",
                "results": AdminAllergenSerializer(qs[start:end], many=True).data,
            },
            status=status.HTTP_200_OK,
        )

    # -------- POST (Upsert by code) --------
    def post(self, request):
        """
        يقبل JSON بمفاتيح German-only: code, de|name_de
        - لو الكود موجود → تحديث.
        - لو غير موجود → إنشاء.
        - Admin-only writes for global allergen catalog.
        """
        # صلاحيات كتابة (Admin-only for global catalog)
        if not is_admin(request.user):
            return Response({"detail": "Only admins can create or update global allergens."}, status=status.HTTP_403_FORBIDDEN)

        data = request.data
        raw_code = data.get("code") or data.get("Code")
        if not raw_code:
            return Response(
                {"detail": "Field 'code' is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        code = str(raw_code).strip().upper()  # A..Z

        # German-only: de / name_de
        de = data.get("de") or data.get("name_de") or data.get("DE") or ""
        de = str(de).strip()

        defaults = {
            "label_de": de,
            # Don't touch EN/AR fields (they may exist but aren't used in German workflow)
        }

        obj, created = Allergen.objects.update_or_create(code=code, defaults=defaults)
        return Response(
            {
                "created": bool(created),
                "id": obj.id,
                "code": obj.code,
                "name_de": obj.label_de,
            },
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )


class AllergenCodeDetailView(APIView):
    """
    GET/PUT/PATCH/DELETE لعنصر واحد في قاموس الحساسيّات العام.
    German-only: يعرض/يقبل code + name_de فقط.
    """
    permission_classes = [IsAuthenticated]

    def _get_obj(self, pk):
        return Allergen.objects.filter(pk=pk).first()

    def get(self, request, pk):
        obj = self._get_obj(pk)
        if not obj:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        return Response(AdminAllergenSerializer(obj).data, status=status.HTTP_200_OK)

    def put(self, request, pk):
        obj = self._get_obj(pk)
        if not obj:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

        # Admin-only for global catalog        
        if not is_admin(request.user):
            return Response(
                {"detail": "Only admins can update global allergens."},
                status=status.HTTP_403_FORBIDDEN,
            )

        d = request.data
        # German-only: update name_de (maps to label_de)
        new_name_de = d.get("de") or d.get("name_de")
        if new_name_de is not None:
            obj.label_de = str(new_name_de).strip()
        # NOTE: لا نغير code هنا
        obj.save()
        return Response(AdminAllergenSerializer(obj).data, status=status.HTTP_200_OK)

    def patch(self, request, pk):
        return self.put(request, pk)

    def delete(self, request, pk):
        if not is_admin(request.user):
            return Response(
                {"detail": "Only admins can delete global allergens."},
                status=status.HTTP_403_FORBIDDEN,
            )
        obj = self._get_obj(pk)
        if not obj:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        obj.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


# ==========================================
# Allergen Bulk CSV (Import/Export)
# ==========================================
class AllergenBulkUpload(APIView):
    """
    رفع CSV للحساسيّات — German-only format:
    Required columns: code, de
    Example: A,Glutenhaltiges Getreide
    """
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        # Global allergen catalog is admin-managed only
        if not is_admin(request.user):
            return Response({"detail": "Only admins can bulk upload global allergens."}, status=status.HTTP_403_FORBIDDEN)
        f = request.FILES.get("file")
        if not f:
            return Response(
                {"detail": "CSV file is required (field 'file')."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            data = f.read().decode("utf-8-sig")
        except Exception:
            return Response(
                {"detail": "Unable to read CSV as UTF-8."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        reader = csv.DictReader(io.StringIO(data))
        headers = {h.strip(): h for h in (reader.fieldnames or [])}
        lower = {h.lower(): h for h in headers}

        def h(*cands):
            for c in cands:
                if c in headers:
                    return headers[c]
                if c.lower() in lower:
                    return lower[c.lower()]
            return None

        # German-only: code + de
        col_code = h("code", "Code")
        col_de = h("de", "name_de", "DE")

        if col_code is None or col_de is None:
            return Response(
                {
                    "detail": "Missing required columns. Required: code, de"
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        created = updated = skipped = 0
        for row in reader:
            code = (row.get(col_code) or "").strip().upper()
            if not code:
                skipped += 1
                continue
            # German-only: only update label_de
            defaults = {
                "label_de": (row.get(col_de) or "").strip(),
            }
            _, was_created = Allergen.objects.update_or_create(code=code, defaults=defaults)
            if was_created:
                created += 1
            else:
                updated += 1

        return Response(
            {"created": created, "updated": updated, "skipped": skipped},
            status=status.HTTP_200_OK,
        )


class AllergenExportCSV(APIView):
    """
    تصدير قاموس الحساسيّات CSV (German-only).
    Exports: code, de
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        rows = Allergen.objects.order_by("code", "id").values_list(
            "code", "label_de"
        )
        out = io.StringIO()
        w = csv.writer(out)
        w.writerow(["code", "de"])
        for r in rows:
            w.writerow(list(r))

        resp = HttpResponse(out.getvalue(), content_type="text/csv; charset=utf-8")
        resp["Content-Disposition"] = 'attachment; filename="allergens.csv"'
        return resp


# ==========================================
# Allergen Rule-Based Generation (German-only workflow)
# ==========================================
class AllergenGenerateView(APIView):
    """
    POST /allergens/generate/
    
    Triggers rule-based allergen generation for specified dishes.
    German-only workflow: uses ingredient library + lexeme rules (lang="de").
    
    Body: {
        "dish_ids": [1, 2, 3],        # Required: list of dish IDs
        "use_llm": false,             # Optional: whether to use LLM fallback (default: false)
        "force_regenerate": false      # Optional: override manual codes (default: false)
    }
    
    Returns: {
        "rules": {
            "processed": 3,
            "changed": 2,
            "skipped": 1,
            "items": [
                {
                    "dish_id": 1,
                    "name": "Kartoffelpuffer",
                    "before": "A",
                    "after": "A,C,G",
                    "action": "changed"
                },
                ...
            ]
        }
    }
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        # Import the rule-based generation service
        from core.services.allergen_rules import generate_for_dishes
        from core.models import Dish

        # Parse request data
        data = request.data if isinstance(request.data, dict) else {}
        dish_ids = data.get("dish_ids", [])
        use_llm = bool(data.get("use_llm", False))
        force_regenerate = bool(data.get("force_regenerate", False))

        if not isinstance(dish_ids, list) or not dish_ids:
            return Response(
                {"detail": "dish_ids must be a non-empty array"},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Get dishes with permission check
        user = request.user
        base = Dish.objects.select_related("section__menu")
        if is_admin(user):
            qs = base.filter(id__in=dish_ids)
        else:
            qs = base.filter(id__in=dish_ids, section__menu__user=user)

        dishes = list(qs)
        
        if not dishes:
            return Response(
                {"detail": "No dishes found or you don't have permission to access them"},
                status=status.HTTP_404_NOT_FOUND
            )

        # Determine owner_id
        owner_id = None
        if not is_admin(user):
            owner_id = user.id
        else:
            # Admin: infer owner from dishes
            owner_ids = {getattr(d.section.menu, "user_id", None) for d in dishes}
            owner_ids.discard(None)
            owner_id = next(iter(owner_ids)) if len(owner_ids) == 1 else None

        # Call rule-based generation service
        # German-only: lang="de"
        rules_result = generate_for_dishes(
            dishes,
            owner_id=owner_id,
            lang="de",  # German-only workflow
            force=force_regenerate,
            dry_run=False,  # Actually modify the dishes
            include_details=True,  # Include provenance
            extra_owner_ids=[user.id] if user.id != owner_id else None,
        )

        # TODO: Add LLM fallback if use_llm=True
        # For now, LLM is not implemented in this simplified endpoint
        llm_result = None
        if use_llm:
            llm_result = {
                "note": "LLM fallback not yet implemented in this endpoint. Use /api/llm/jobs/start-batch-generate/ for LLM support."
            }

        return Response(
            {
                "rules": rules_result,
                "llm": llm_result,
            },
            status=status.HTTP_200_OK
        )


# ==========================================
# AdditiveLegend (إضافات/مواد E-numbered)
# - دمج الخاص مع العام: الخاص يغلب العام
# ==========================================
def _current_owner(request):
    """
    يحدد المالك الحالي:
    - إذا ?global=1 => قاموس عام (owner=None)
    - غير ذلك       => المستخدم الحالي (AUTH_USER)
    """
    return (
        None
        if str(request.query_params.get("global", "")).lower() in {"1", "true", "yes"}
        else request.user
    )


class AdditiveCodesView(APIView):
    """
    GET: قائمة مدمجة (الخاص يغلب العام) مع ترتيب/فلترة بسيطة + تقسيم صفحات.
    POST: إضافة/تعديل عنصر واحد (owner + number).
    """
    permission_classes = [IsAuthenticated]

    def _merged_queryset(self, user, params):
        owner = user
        owner_numbers = AdditiveLegend.objects.filter(owner=owner).values("number")
        qs = AdditiveLegend.objects.filter(
            Q(owner=owner)
            | (Q(owner__isnull=True) & ~Q(number__in=Subquery(owner_numbers)))
        )

        # فلاتر
        if params.get("number"):
            try:
                qs = qs.filter(number=int(params["number"]))
            except Exception:
                qs = qs.none()
        if params.get("de"):
            qs = qs.filter(label_de__icontains=params["de"])
        if params.get("en"):
            qs = qs.filter(label_en__icontains=params["en"])
        if params.get("ar"):
            qs = qs.filter(label_ar__icontains=params["ar"])

        # ترتيب آمن
        ordering = (params.get("ordering") or "number").strip()
        allowed = {"number", "label_de", "label_en", "label_ar"}
        if ordering.lstrip("-") not in allowed:
            ordering = "number"

        return qs.order_by(ordering, "id")

    def get(self, request):
        qs = self._merged_queryset(request.user, request.query_params)

        # Pagination
        try:
            page = int(request.query_params.get("page", "1"))
            page_size = int(request.query_params.get("page_size", "50"))
        except ValueError:
            page, page_size = 1, 50

        start = (page - 1) * page_size
        end = start + page_size
        total = qs.count()
        results = AdditiveCodeSerializer(qs[start:end], many=True).data

        return Response(
            {
                "count": total,
                "next": None if end >= total else f"?page={page+1}&page_size={page_size}",
                "previous": None if page == 1 else f"?page={page-1}&page_size={page_size}",
                "results": results,
            },
            status=status.HTTP_200_OK,
        )

    def post(self, request):
        """
        يقبل JSON بأي من هذه المفاتيح:
        - number أو code (مثال: code='E100' أو number=100)
        - en/label_en/name_en
        - de/label_de/name_de
        - ar/label_ar/name_ar
        مع ?global=1 للكتابة في القاموس العام، أو body.owner لتحديد مالك آخر (أدمن فقط).
        """
        # ✅ خطوة 3 — صلاحيات كتابة بحسب الـ owner المستهدف
        global_flag = str(request.query_params.get("global", "")).lower()
        if global_flag in {"1", "true", "yes"}:
            owner_id = None
        else:
            owner_id = request.data.get("owner") or getattr(request.user, "id", None)
            if owner_id in ("null", "None", ""):
                owner_id = None
            elif owner_id is not None:
                try:
                    owner_id = int(owner_id)
                except Exception:
                    raise PermissionDenied("Invalid owner value.")
        _ensure_owner_write_permission(request, owner_id)

        data = request.data

        # number من number أو code (يدعم "E100")
        raw_number = data.get("number") or data.get("code") or data.get("Code")
        if raw_number is None:
            return Response(
                {"detail": "Field 'number' or 'code' is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            number = int(str(raw_number).lstrip("eE"))
        except Exception:
            return Response({"detail": "Invalid number/code."}, status=status.HTTP_400_BAD_REQUEST)

        def pick(*keys):
            for k in keys:
                if data.get(k) is not None:
                    return str(data.get(k)).strip()
            return ""

        defaults = {
            "label_en": pick("en", "label_en", "name_en", "EN", "En"),
            "label_de": pick("de", "label_de", "name_de", "DE", "De"),
            "label_ar": pick("ar", "label_ar", "name_ar", "AR", "Ar"),
        }

        obj, created = AdditiveLegend.objects.update_or_create(
            owner_id=owner_id, number=number, defaults=defaults
        )
        return Response(
            {
                "created": bool(created),
                "number": obj.number,
                "en": obj.label_en,
                "de": obj.label_de,
                "ar": obj.label_ar,
            },
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )


class AdditiveBulkUploadView(APIView):
    """
    رفع CSV للإضافات (E-Numbers) مع قبول صيغ عناوين متعددة.
    يسمح للمالك برفع ملفه الخاص (?owner=ID) أو للعام (?owner=null). الأدمن فقط لغير نفسه/للعام.
    """
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request, *args, **kwargs):
        # ✅ خطوة 3 — تحديد المالك الهدف والتحقق
        owner_q = request.query_params.get("owner")  # قد يمرّر رقم أو 'null'/None/""
        if owner_q in (None, "", "null", "None"):
            owner_id = None
        else:
            try:
                owner_id = int(owner_q)
            except Exception:
                raise PermissionDenied("Invalid owner value.")
        # إن لم يُرسل owner في الـ query نعتبره المستخدم الحالي
        if owner_q is None:
            owner_id = None if is_admin(request.user) else getattr(request.user, "id", None)

        _ensure_owner_write_permission(request, owner_id)

        f = request.FILES.get("file")
        if not f:
            return Response(
                {"detail": "CSV file is required (field 'file')."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            data = f.read().decode("utf-8-sig")
        except Exception:
            return Response(
                {"detail": "Unable to read CSV as UTF-8."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        reader = csv.DictReader(io.StringIO(data))
        headers = {h.strip(): h for h in (reader.fieldnames or [])}
        lower = {h.lower(): h for h in headers}

        def h(*cands):
            for c in cands:
                if c in headers:
                    return headers[c]
                if c.lower() in lower:
                    return lower[c.lower()]
            return None

        col_number = h("number", "code", "Code")
        col_en = h("en", "label_en", "name_en", "EN", "En")
        col_de = h("de", "label_de", "name_de", "DE", "De")
        col_ar = h("ar", "label_ar", "name_ar", "AR", "Ar")

        required = [col_number, col_en, col_de, col_ar]
        if any(c is None for c in required):
            return Response(
                {
                    "detail": "Missing columns. Accepts: number|code, en|label_en|name_en, de|label_de|name_de, ar|label_ar|name_ar"
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        created = updated = skipped = 0
        for row in reader:
            raw_num = (row.get(col_number) or "").strip()
            if not raw_num:
                skipped += 1
                continue
            try:
                number = int(raw_num.lstrip("eE"))
            except Exception:
                skipped += 1
                continue

            defaults = {
                "label_en": (row.get(col_en) or "").strip(),
                "label_de": (row.get(col_de) or "").strip(),
                "label_ar": (row.get(col_ar) or "").strip(),
            }

            _, was_created = AdditiveLegend.objects.update_or_create(
                owner_id=owner_id, number=number, defaults=defaults
            )
            if was_created:
                created += 1
            else:
                updated += 1

        return Response(
            {"created": created, "updated": updated, "skipped": skipped},
            status=status.HTTP_200_OK,
        )


class AdditiveExportCSV(APIView):
    """
    تصدير CSV موحّد (الخاص + العامة غير المغطاة) مع البث لتقليل الذاكرة.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        owner = request.user
        owner_numbers = AdditiveLegend.objects.filter(owner=owner).values("number")
        qs = AdditiveLegend.objects.filter(
            Q(owner=owner) | (Q(owner__isnull=True) & ~Q(number__in=Subquery(owner_numbers)))
        ).order_by("number", "id")

        def stream():
            out = io.StringIO()
            writer = csv.writer(out)
            writer.writerow(["number", "en", "de", "ar"])
            yield out.getvalue()
            out.seek(0)
            out.truncate(0)
            for x in qs.iterator(chunk_size=500):
                writer.writerow([x.number, x.label_en or "", x.label_de or "", x.label_ar or ""])
                yield out.getvalue()
                out.seek(0)
                out.truncate(0)

        resp = StreamingHttpResponse(stream(), content_type="text/csv; charset=utf-8")
        resp["Content-Disposition"] = 'attachment; filename="additives_merged.csv"'
        return resp


class AdditiveCodeDetailView(APIView):
    """
    عرض/تحديث/حذف عنصر واحد من الإضافات.
    - يسمح بالوصول لعنصر خاص بالمستخدم أو عنصر عام.
    - حذف عنصر عام يتطلّب is_admin.
    """
    permission_classes = [IsAuthenticated]

    def _get_object(self, pk, user):
        return AdditiveLegend.objects.filter(
            Q(pk=pk) & (Q(owner=user) | Q(owner__isnull=True))
        ).first()

    def get(self, request, pk):
        obj = self._get_object(pk, request.user)
        if not obj:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        return Response(AdditiveCodeSerializer(obj).data, status=status.HTTP_200_OK)

    def put(self, request, pk):
        obj = self._get_object(pk, request.user)
        if not obj:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

        # ✅ لا نسمح بالكتابة على العام أو نيابةً عن مالك آخر للمستخدم العادي
        _ensure_owner_write_permission(
            request, getattr(obj, "owner_id", None)
        )
        # إن طُلب تغيير المالك
        new_owner = request.data.get("owner", getattr(obj, "owner_id", None))
        if new_owner in ("null", "None", ""):
            new_owner = None
        elif new_owner is not None:
            try:
                new_owner = int(new_owner)
            except Exception:
                raise PermissionDenied("Invalid owner value.")
        _ensure_owner_write_permission(request, new_owner)

        data = request.data
        obj.label_en = (data.get("en") or data.get("label_en") or obj.label_en) or ""
        obj.label_de = (data.get("de") or data.get("label_de") or obj.label_de) or ""
        obj.label_ar = (data.get("ar") or data.get("label_ar") or obj.label_ar) or ""
        # لا نسمح بتغيير number هنا
        obj.owner_id = new_owner
        obj.save()
        return Response(AdditiveCodeSerializer(obj).data, status=status.HTTP_200_OK)

    def patch(self, request, pk):
        return self.put(request, pk)

    def delete(self, request, pk):
        obj = self._get_object(pk, request.user)
        if not obj:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        if obj.owner is None and not is_admin(request.user):  # ← توحيد المعيار
            return Response(
                {"detail": "Only admins can delete global entries."},
                status=status.HTTP_403_FORBIDDEN,
            )
        obj.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


# ==========================================
# ---- Lexemes CSV (Export / Import)
# ==========================================
class KeywordLexemeExportCSV(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        owner_q = request.query_params.get("owner") or kwargs.get("owner")

        # تحديد الـ owner الهدف
        if not is_admin(request.user):
            # المستخدم العادي يصدّر فقط قاموسه
            owner_id = request.user.id
            owner_is_global = False
        else:
            if not owner_q or str(owner_q).lower() in {"null", "none", "global"}:
                owner_id = None
                owner_is_global = True
            else:
                try:
                    owner_id = int(owner_q)
                    owner_is_global = False
                except (TypeError, ValueError):
                    raise PermissionDenied("Invalid owner value.")

        qs = KeywordLexeme.objects.select_related("ingredient").prefetch_related("allergens")

        if owner_id is None and owner_is_global:
            qs = qs.filter(owner__isnull=True)
        else:
            qs = qs.filter(owner_id=owner_id)

        # فلاتر إضافية اختيارية
        lang = (request.query_params.get("lang") or "").strip()
        active = request.query_params.get("is_active")
        q = (request.query_params.get("q") or "").strip()
        if lang:
            qs = qs.filter(lang__iexact=lang)
        if active in ("0", "1"):
            qs = qs.filter(is_active=(active == "1"))
        if q:
            qs = qs.filter(normalized_term__icontains=q)
        qs = qs.order_by("priority", "weight", "id")

        header = ["lang", "term", "is_regex", "allergens_ids",
                  "ingredient_id", "is_active", "priority", "weight"]
        buf = io.StringIO()
        w = csv.writer(buf)
        w.writerow(header)
        for x in qs:
            al = ",".join(str(a.id) for a in x.allergens.all())
            ing = x.ingredient_id or ""
            w.writerow([
                x.lang,
                x.term or "",
                int(x.is_regex),
                al,
                ing,
                int(x.is_active),
                x.priority or 0,
                x.weight or 0,
            ])

        resp = HttpResponse(buf.getvalue(), content_type="text/csv; charset=utf-8")
        resp["Content-Disposition"] = 'attachment; filename=\"lexemes.csv\"'
        return resp



class KeywordLexemeImportCSV(APIView):
    """
    استيراد CSV للـ KeywordLexeme مع:
    - تطبيع normalized_term لمنع ازدواج اللفظ
    - دعم تعيين الحساسيّات إمّا عبر IDs (allergens_ids) أو عبر الأكواد الحرفية (allergen_codes/codes)
    - تعامل لطيف مع الحقول الاختيارية وعدّ أخطاء الصفوف بدل إسقاطها
    """
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request, *args, **kwargs):
        # ✅ خطوة 5 — صلاحيات كتابة بحسب المالك الهدف
        owner_q = request.query_params.get("owner") or request.data.get("owner") or kwargs.get("owner")
        if owner_q in ("null", "None", "", None):
            owner_id = None
        else:
            try:
                owner_id = int(owner_q)
            except Exception:
                raise PermissionDenied("Invalid owner value.")
        if owner_q is None:
            owner_id = None if is_admin(request.user) else getattr(request.user, "id", None)
        _ensure_owner_write_permission(request, owner_id)

        f = request.FILES.get("file")
        if not f:
            return Response({"detail": "CSV مفقود"}, status=400)

        data = io.TextIOWrapper(f.file, encoding="utf-8", errors="ignore")
        r = csv.DictReader(data)

        upserted, errors = 0, 0

        for row in r:
            try:
                term = (row.get("term") or "").strip()
                if not term:
                    # صف بدون term لا يُدرج
                    continue

                lang = (row.get("lang") or "de").lower().strip()

                # قيم منطقية آمنة
                is_regex = str(row.get("is_regex") or "0").lower() in {"1", "true", "yes"}
                # بعض الجداول السابقة كانت تستخدم 'active' بدل 'is_active'
                is_active = str((row.get("is_active") or row.get("active") or "1")).lower() in {"1", "true", "yes"}

                # أرقام آمنة
                try:
                    priority = int(row.get("priority") or 0)
                except Exception:
                    priority = 0
                try:
                    weight = int(row.get("weight") or 0)
                except Exception:
                    weight = 0

                # ingredient_id (اختياري)
                raw_ing = (row.get("ingredient_id") or "").strip()
                ingredient_id = int(raw_ing) if raw_ing.isdigit() else None

                # --- حساسيّات: إمّا IDs أو أكواد حرفية ---
                # 1) IDs بصيغة "1,5,9"
                ids_from_csv = [int(x) for x in (row.get("allergens_ids") or "").split(",") if x.strip().isdigit()]

                # 2) Codes بصيغة "A,G,J" أو "a g j"
                codes_raw = (row.get("allergen_codes") or row.get("codes") or "").strip()
                code_tokens = [c.strip().upper() for c in re.split(r"[,\s]+", codes_raw) if c.strip()]
                ids_from_codes = []
                if code_tokens:
                    ids_from_codes = list(
                        Allergen.objects.filter(code__in=code_tokens).values_list("id", flat=True)
                    )

                # المجموع النهائي (لو وُجد الاثنان يتم دمجهما)
                final_allergen_ids = sorted(set(ids_from_csv) | set(ids_from_codes))

                # upsert بمفتاح (owner, lang, normalized_term)
                lx, _ = KeywordLexeme.objects.update_or_create(
                    owner_id=owner_id,
                    lang=lang,
                    normalized_term=_norm(term),
                    defaults={
                        "term": term,
                        "is_regex": is_regex,
                        "ingredient_id": ingredient_id,
                        "is_active": is_active,
                        "priority": priority,
                        "weight": weight,
                    },
                )

                # ربط الحساسيّات
                if final_allergen_ids:
                    lx.allergens.set(final_allergen_ids)
                else:
                    lx.allergens.clear()

                upserted += 1

            except Exception:
                errors += 1
                continue

        return Response({"ok": True, "count": upserted, "errors": errors}, status=200)


# ==========================================
# ---- Ingredients CRUD + CSV Import/Export
# ==========================================
class IngredientViewSet(ModelViewSet):
    queryset = Ingredient.objects.all().prefetch_related("allergens")
    serializer_class = IngredientLiteSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        # ✅ خطوة 4 — منع التسرّب عبر ?owner=
        qs = super().get_queryset()
        owner_q = (self.request.query_params.get("owner") or "").strip()

        if is_admin(self.request.user) and owner_q:
            qs = qs.filter(owner_id=owner_q)
        else:
            qs = qs.filter(owner_id=self.request.user.id)

        q = (self.request.query_params.get("q") or "").strip()
        if q:
            qs = qs.filter(name__icontains=q)

        return qs.order_by("name", "id")

    def create(self, request, *args, **kwargs):
        # DEBUG: Log incoming data
        print("=" * 80)
        print("IngredientViewSet.create() - DEBUG")
        print("REQUEST DATA:", request.data)
        print("=" * 80)
        
        data = request.data.copy()
        # Set owner - admin can specify, non-admin gets their own ID
        if not is_admin(request.user):
            data["owner"] = request.user.id
        elif "owner" not in data or data.get("owner") in (None, "", "null"):
            # Admin without explicit owner - use their ID or allow None for global
            data["owner"] = request.user.id
        
        ser = self.get_serializer(data=data)
        if not ser.is_valid():
            # DEBUG: Log validation errors
            print("SERIALIZER ERRORS:", ser.errors)
            print("=" * 80)
        ser.is_valid(raise_exception=True)
        obj = ser.save()
        
        # DEBUG: Log created object
        print(f"✅ CREATED Ingredient ID={obj.id}, name={obj.name}, owner_id={obj.owner_id}")
        print("=" * 80)
        
        out = self.get_serializer(obj).data
        return Response(out, status=status.HTTP_201_CREATED)



# --- NEW: Ingredients CSV (Export) --------------------
class IngredientExportCSV(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        """
        يصدر مكوّنات المالك المحدد:
        - ?owner=<id> للأدمن؛ بدونه يصدر لمستخدم الطلب.
        الحقول: name, allergen_codes (A,G,...), additives (أرقام مفصولة بفواصل), synonyms
        """
        # ✅ خطوة 4 — تقييد التصدير بحسب المالك
        owner_q = request.query_params.get("owner")
        if owner_q and not is_admin(request.user):
            raise PermissionDenied("Only admins can export for other owners.")
        owner_id = owner_q or request.user.id

        qs = (
            Ingredient.objects
            .filter(owner_id=owner_id)
            .prefetch_related("allergens")
            .order_by("name", "id")
        )

        out = io.StringIO()
        w = csv.writer(out)
        w.writerow(["name", "allergen_codes", "additives", "synonyms"])
        for ing in qs:
            codes = ",".join(ing.allergens.values_list("code", flat=True))
            # نتعامل لطفياً مع أنواع الحقل (قائمة/نص)
            raw_add = getattr(ing, "additives", "") or ""
            if isinstance(raw_add, (list, tuple)):
                additives = ",".join(str(x) for x in raw_add)
            else:
                additives = str(raw_add)
            syn = getattr(ing, "synonyms", "") or ""
            if isinstance(syn, (list, tuple)):
                syn = ", ".join([str(x) for x in syn])
            w.writerow([ing.name, codes, additives, syn])

        resp = HttpResponse(out.getvalue(), content_type="text/csv; charset=utf-8")
        resp["Content-Disposition"] = 'attachment; filename="ingredients.csv"'
        return resp


# --- NEW: Ingredients CSV (Import) --------------------
class IngredientBulkUploadCSV(APIView):
    """
    استيراد مكوّنات من CSV. الأعمدة المقبولة (أي صيغة من التالية تعمل):
      - name
      - allergen_codes | codes   (مثال: "A,G,K")
      - allergens_ids           (IDs بالأرقام "1,5,9" — اختياري)
      - additives               (أرقام مفصولة بفواصل: "100,101,223")
      - synonyms                (نص حر؛ يُخزن كما هو)
    القاعدة: upsert على (owner, name) بحساسية حالة الأحرف.
    """
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        f = request.FILES.get("file")
        if not f:
            return Response({"detail": "CSV file is required (field 'file')."}, status=400)

        # ✅ السماح بتحديد owner صراحة للأدمن فقط؛ وإلا المالك = المستخدم الحالي
        owner_q = request.query_params.get("owner") or request.data.get("owner")
        if owner_q and not is_admin(request.user):
            raise PermissionDenied("Only staff can import for another owner.")
        if owner_q in ("null", "None", "", None):
            owner_id = request.user.id
        else:
            try:
                owner_id = int(owner_q)
            except Exception:
                raise PermissionDenied("Invalid owner value.")
        _ensure_owner_write_permission(request, owner_id)

        data = io.TextIOWrapper(f.file, encoding="utf-8-sig", errors="ignore")
        r = csv.DictReader(data)

        created = updated = skipped = errors = 0

        def _split_nums(s):
            if not s:
                return []
            return [int(x) for x in re.findall(r"\d+", str(s))]

        for row in r:
            try:
                name = (row.get("name") or "").strip()
                if not name:
                    skipped += 1
                    continue

                # حساسيّات عبر الأكواد أو الـ IDs
                codes_raw = (row.get("allergen_codes") or row.get("codes") or "").strip()
                code_tokens = [c.strip().upper() for c in re.split(r"[,\s]+", codes_raw) if c.strip()]
                ids_from_codes = list(
                    Allergen.objects.filter(code__in=code_tokens).values_list("id", flat=True)
                ) if code_tokens else []

                ids_raw = (row.get("allergens_ids") or "").strip()
                ids_from_csv = [int(x) for x in ids_raw.split(",") if x.strip().isdigit()]

                allergen_ids = sorted(set(ids_from_codes) | set(ids_from_csv))

                # إضافات (أرقام)
                additives = ",".join(str(n) for n in _split_nums(row.get("additives")))

                # مرادفات (نص كما هو)
                synonyms = (row.get("synonyms") or "").strip()

                # upsert بمفتاح (owner, name) — نحاول case-insensitive
                ing = Ingredient.objects.filter(owner_id=owner_id, name__iexact=name).first()
                if ing:
                    changed = False
                    if getattr(ing, "additives", "") != additives:
                        ing.additives = additives
                        changed = True
                    if getattr(ing, "synonyms", "") != synonyms:
                        ing.synonyms = synonyms
                        changed = True
                    if changed:
                        ing.save()
                    updated += 1
                else:
                    ing = Ingredient.objects.create(
                        owner_id=owner_id, name=name, additives=additives, synonyms=synonyms
                    )
                    created += 1

                # ربط الحساسيّات
                if allergen_ids:
                    ing.allergens.set(allergen_ids)
                else:
                    ing.allergens.clear()

            except Exception:
                errors += 1
                continue

        return Response(
            {"created": created, "updated": updated, "skipped": skipped, "errors": errors},
            status=200,
        )


# ==========================================
# --- Lexemes CRUD/List عبر DRF ViewSet ---
# ==========================================
class KeywordLexemeViewSet(ModelViewSet):
    """
    قائمة/إنشاء/تعديل/حذف للـ KeywordLexeme مع فلاتر تشبه التي يستعملها الفرونت.
    يدعم بارامترات: owner, lang, is_active(0/1), q, ordering
    """
    permission_classes = [IsAuthenticated]
    serializer_class = KeywordLexemeSerializer
    queryset = KeywordLexeme.objects.all().select_related("ingredient").prefetch_related("allergens")

    def get_queryset(self):
        qs = super().get_queryset()
        req = self.request

        owner_q = (req.query_params.get("owner") or "").strip()

        if is_admin(req.user):
            # الأدمن:
            #   - بدون owner ⇒ القاموس العام (owner IS NULL)
            #   - owner=global/null/None ⇒ القاموس العام
            #   - owner=<id> رقمي ⇒ قاموس هذا المالك
            val = owner_q.lower()
            if not owner_q or val in {"null", "none", "global"}:
                qs = qs.filter(owner__isnull=True)
            else:
                try:
                    owner_id = int(owner_q)
                    qs = qs.filter(owner_id=owner_id)
                except (TypeError, ValueError):
                    # قيمة غير صحيحة ⇒ نرجع للقاموس العام
                    qs = qs.filter(owner__isnull=True)
        else:
            # المستخدم العادي يرى فقط قاموسه الخاص من خلال هذه الواجهة
            qs = qs.filter(owner_id=req.user.id)

        lang = (req.query_params.get("lang") or "").strip()
        active = req.query_params.get("is_active")
        q = (req.query_params.get("q") or "").strip()

        if lang:
            qs = qs.filter(lang__iexact=lang)
        if active in ("0", "1"):
            qs = qs.filter(is_active=(active == "1"))
        if q:
            qs = qs.filter(
                Q(term__icontains=q) |
                Q(normalized_term__icontains=q)
            )

        ordering = (req.query_params.get("ordering") or "priority,weight,id")
        allowed = {"priority", "weight", "id", "term", "lang"}
        parts = [p.strip() for p in ordering.split(",") if p.strip()]
        safe = [p for p in parts if p.lstrip("-") in allowed] or ["priority", "weight", "id"]
        return qs.order_by(*safe)

    # Ensure admin can create global lexemes by default; non-admins are scoped to self
    def create(self, request, *args, **kwargs):
        # DEBUG: Log incoming data
        print("=" * 80)
        print("KeywordLexemeViewSet.create() - DEBUG")
        print("REQUEST DATA:", request.data)
        print("=" * 80)
        
        data = request.data.copy()
        if is_admin(request.user):
            ov = data.get("owner")
            # Treat missing/blank/global as None (global)
            if ov in (None, "", "null", "None", "global"):
                data["owner"] = None
        else:
            # Force owner to the current user for non-admins
            data["owner"] = getattr(request.user, "id", None)

        ser = self.get_serializer(data=data)
        if not ser.is_valid():
            # DEBUG: Log validation errors
            print("SERIALIZER ERRORS:", ser.errors)
            print("=" * 80)
        ser.is_valid(raise_exception=True)
        obj = ser.save()
        
        # DEBUG: Log created object
        print(f"✅ CREATED Lexeme ID={obj.id}, term={obj.term}, owner_id={obj.owner_id}")
        print("=" * 80)
        
        out = self.get_serializer(obj).data
        return Response(out, status=status.HTTP_201_CREATED)
