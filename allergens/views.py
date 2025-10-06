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
import csv
import io

from core.models import Allergen, AdditiveLegend
from .serializers import AllergenCodeSerializer  # لعرض/تحرير Allergen عبر ViewSet
from core.serializers import (
    AdditiveLegendSerializer,
    AllergenSerializer,
    KeywordLexemeSerializer,
    IngredientSerializer as IngredientLiteSerializer,   # ← alias بدل المفقود
)

from core.dictionary_models import KeywordLexeme
from core.models import Ingredient

# ==========================================
# Allergen (قاموس الحساسيّات) — ViewSet قياسي
# ==========================================
class AllergenCodeViewSet(ModelViewSet):
    """
    CRUD قياسي عبر DRF ViewSet على الجدول Allergen.
    يدعم q للبحث و ordering للترتيب (code, label_de, label_en, label_ar).
    """
    queryset = Allergen.objects.all().order_by("code")
    serializer_class = AllergenCodeSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = Allergen.objects.all()

        # بحث نصّي
        q = self.request.query_params.get("q", "").strip()
        if q:
            qs = qs.filter(
                Q(code__icontains=q)
                | Q(label_de__icontains=q)
                | Q(label_en__icontains=q)
                | Q(label_ar__icontains=q)
            )

        # ترتيب آمن
        ordering = self.request.query_params.get("ordering", "code").strip()
        allowed = {"code", "label_de", "label_en", "label_ar"}
        if ordering.lstrip("-") not in allowed:
            ordering = "code"

        return qs.order_by(ordering, "id")


# ==========================================
# Allergen (قاموس الحساسيّات) — واجهات API مسطّحة
# ==========================================
class AllergenCodesView(APIView):
    """
    GET: قائمة أكواد الحساسيّات مع فلترة وترتيب وتقسيم صفحات.
    POST: إضافة/تعديل عنصر واحد حسب الكود (قاموس عام واحد).
    """
    permission_classes = [IsAuthenticated]

    # -------- GET (List) --------
    def get(self, request):
        qs = Allergen.objects.all()

        # 🔎 دعم q للبحث العام
        q = (request.query_params.get("q") or "").strip()
        if q:
            qs = qs.filter(
                Q(code__icontains=q) |
                Q(label_de__icontains=q) |
                Q(label_en__icontains=q) |
                Q(label_ar__icontains=q)
            )

        # الفلاتر القديمة (اختياري تبقيها)
        code = request.query_params.get("code") or request.query_params.get("letter")
        en = request.query_params.get("en")
        de = request.query_params.get("de")
        ar = request.query_params.get("ar")

        if code:
            qs = qs.filter(code__iexact=str(code).strip())
        if en:
            qs = qs.filter(label_en__icontains=en)
        if de:
            qs = qs.filter(label_de__icontains=de)
        if ar:
            qs = qs.filter(label_ar__icontains=ar)

        # ترتيب آمن
        ordering = (request.query_params.get("ordering") or "code").strip()
        allowed = {"code", "label_en", "label_de", "label_ar"}
        if ordering.lstrip("-") not in allowed:
            ordering = "code"
        qs = qs.order_by(ordering, "id")

        # تقسيم صفحات بسيط (شكل قريب من DRF)
        try:
            page = int(request.query_params.get("page", "1"))
            page_size = int(request.query_params.get("page_size", "50"))
        except ValueError:
            page, page_size = 1, 50
        start, end = (page - 1) * page_size, page * page_size
        total = qs.count()

        return Response({
            "count": total,
            "next": None if end >= total else f"?page={page+1}&page_size={page_size}",
            "previous": None if page == 1 else f"?page={page-1}&page_size={page_size}",
            "results": AllergenCodeSerializer(qs[start:end], many=True).data,
        }, status=status.HTTP_200_OK)

    # -------- POST (Upsert by code) --------
    def post(self, request):
        """
        يقبل JSON بمفاتيح: code/letter, en|label_en, de|label_de, ar|label_ar
        - لو الكود موجود → تحديث.
        - لو غير موجود → إنشاء.
        """
        data = request.data
        raw_code = data.get("code") or data.get("letter") or data.get("Code")
        if not raw_code:
            return Response({"detail": "Field 'code' (or 'letter') is required."}, status=status.HTTP_400_BAD_REQUEST)
        code = str(raw_code).strip().upper()  # A..Z

        def pick(*keys):
            for k in keys:
                if data.get(k) is not None:
                    return str(data.get(k)).strip()
            return ""

        defaults = {
            "label_en": pick("en", "label_en", "name_en", "EN"),
            "label_de": pick("de", "label_de", "name_de", "DE"),
            "label_ar": pick("ar", "label_ar", "name_ar", "AR"),
        }

        obj, created = Allergen.objects.update_or_create(code=code, defaults=defaults)
        return Response(
            {"created": bool(created), "code": obj.code, "en": obj.label_en, "de": obj.label_de, "ar": obj.label_ar},
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )


class AllergenCodeDetailView(APIView):
    """
    GET/PUT/PATCH/DELETE لعنصر واحد في قاموس الحساسيّات العام.
    - لا نسمح بتغيير code من شاشة التعديل.
    - الحذف للأدمن فقط (اختياري).
    """
    permission_classes = [IsAuthenticated]

    def _get_obj(self, pk):
        return Allergen.objects.filter(pk=pk).first()

    def get(self, request, pk):
        obj = self._get_obj(pk)
        if not obj:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        # نرجع Serializer المتوافق مع الفرونت
        return Response(AllergenCodeSerializer(obj).data, status=status.HTTP_200_OK)

    def put(self, request, pk):
        obj = self._get_obj(pk)
        if not obj:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

        d = request.data
        obj.label_en = (d.get("en") or d.get("label_en") or obj.label_en) or ""
        obj.label_de = (d.get("de") or d.get("label_de") or obj.label_de) or ""
        obj.label_ar = (d.get("ar") or d.get("label_ar") or obj.label_ar) or ""
        obj.save()
        # نرجع Serializer المتوافق مع الفرونت
        return Response(AllergenCodeSerializer(obj).data, status=status.HTTP_200_OK)

    def patch(self, request, pk):
        return self.put(request, pk)

    def delete(self, request, pk):
        if not request.user.is_staff:
            return Response({"detail": "Only admins can delete global allergens."}, status=status.HTTP_403_FORBIDDEN)
        obj = self._get_obj(pk)
        if not obj:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        obj.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class AllergenBulkUpload(APIView):
    """
    رفع CSV للحساسيّات — أعمدة مرنة:
    code|letter, en|label_en|name_en, de|label_de|name_de, ar|label_ar|name_ar
    """
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        f = request.FILES.get("file")
        if not f:
            return Response({"detail": "CSV file is required (field 'file')."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            data = f.read().decode("utf-8-sig")
        except Exception:
            return Response({"detail": "Unable to read CSV as UTF-8."}, status=status.HTTP_400_BAD_REQUEST)

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

        col_code = h("code", "letter", "Code", "Letter")
        col_en   = h("en", "label_en", "name_en", "EN")
        col_de   = h("de", "label_de", "name_de", "DE")
        col_ar   = h("ar", "label_ar", "name_ar", "AR")

        if any(x is None for x in [col_code, col_en, col_de, col_ar]):
            return Response(
                {"detail": "Missing columns. Accepts: code|letter, en|label_en, de|label_de, ar|label_ar"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        created = updated = skipped = 0
        for row in reader:
            code = (row.get(col_code) or "").strip().upper()
            if not code:
                skipped += 1
                continue
            defaults = {
                "label_en": (row.get(col_en) or "").strip(),
                "label_de": (row.get(col_de) or "").strip(),
                "label_ar": (row.get(col_ar) or "").strip(),
            }
            _, was_created = Allergen.objects.update_or_create(code=code, defaults=defaults)
            if was_created:
                created += 1
            else:
                updated += 1

        return Response({"created": created, "updated": updated, "skipped": skipped}, status=status.HTTP_200_OK)


class AllergenExportCSV(APIView):
    """
    تصدير قاموس الحساسيّات CSV (عام).
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        rows = Allergen.objects.order_by("code", "id").values_list("code", "label_en", "label_de", "label_ar")
        out = io.StringIO()
        w = csv.writer(out)
        w.writerow(["code", "en", "de", "ar"])
        for r in rows:
            w.writerow(list(r))

        # HttpResponse يضمن الهيدر والميم تايب مباشرةً
        resp = HttpResponse(out.getvalue(), content_type="text/csv; charset=utf-8")
        resp["Content-Disposition"] = 'attachment; filename="allergens.csv"'
        return resp


# ==========================================
# AdditiveLegend (إضافات/مواد E-numbered)
# - دمج الخاص مع العام: الخاص يغلب العام
# ==========================================

# --- دالة مساعدة لتحديد المالك (عام/خاص) ---
def _current_owner(request):
    """
    يحدد المالك الحالي:
    - إذا ?global=1 => قاموس عام (owner=None)
    - غير ذلك       => المستخدم الحالي (AUTH_USER)
    """
    return None if str(request.query_params.get("global", "")).lower() in {"1", "true", "yes"} else request.user


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
            Q(owner=owner) | (Q(owner__isnull=True) & ~Q(number__in=Subquery(owner_numbers)))
        )

        # فلاتر اختيارية
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

        # Pagination يدوي بسيط
        try:
            page = int(request.query_params.get("page", "1"))
            page_size = int(request.query_params.get("page_size", "50"))
        except ValueError:
            page, page_size = 1, 50

        start = (page - 1) * page_size
        end = start + page_size
        total = qs.count()
        results = AdditiveLegendSerializer(qs[start:end], many=True).data

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
        مع ?global=1 للكتابة في القاموس العام.
        """
        data = request.data

        # استخرج number من number أو code (يدعم "E100")
        raw_number = data.get("number") or data.get("code") or data.get("Code")
        if raw_number is None:
            return Response({"detail": "Field 'number' or 'code' is required."}, status=status.HTTP_400_BAD_REQUEST)
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

        owner = _current_owner(request)
        obj, created = AdditiveLegend.objects.update_or_create(
            owner=owner, number=number, defaults=defaults
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
    يسمح للمالك برفع ملفه الخاص (?global=1 للعام).
    """
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request, *args, **kwargs):
        f = request.FILES.get("file")
        if not f:
            return Response({"detail": "CSV file is required (field 'file')."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            data = f.read().decode("utf-8-sig")
        except Exception:
            return Response({"detail": "Unable to read CSV as UTF-8."}, status=status.HTTP_400_BAD_REQUEST)

        reader = csv.DictReader(io.StringIO(data))
        headers = {h.strip(): h for h in (reader.fieldnames or [])}  # الخريطة الأصلية
        lower = {h.lower(): h for h in headers}  # case-insensitive

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
                    "detail": "Missing columns. Accepts: number|code, en|label_en|name_en, "
                              "de|label_de|name_de, ar|label_ar|name_ar"
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        owner = _current_owner(request)

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
                owner=owner, number=number, defaults=defaults
            )
            if was_created:
                created += 1
            else:
                updated += 1

        return Response({"created": created, "updated": updated, "skipped": skipped}, status=status.HTTP_200_OK)


class AdditiveExportCSV(APIView):
    """
    تصدير CSV موحّد (الخاص + العامة غير المغطاة) مع البث لتقليل الذاكرة.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        owner = request.user
        owner_numbers = AdditiveLegend.objects.filter(owner=owner).values("number")
        qs = AdditiveLegend.objects.filter(
            Q(owner=owner) |
            (Q(owner__isnull=True) & ~Q(number__in=Subquery(owner_numbers)))
        ).order_by("number", "id")

        def stream():
            out = io.StringIO()
            writer = csv.writer(out)
            writer.writerow(["number", "en", "de", "ar"])
            yield out.getvalue(); out.seek(0); out.truncate(0)
            for x in qs.iterator(chunk_size=500):
                writer.writerow([x.number, x.label_en or "", x.label_de or "", x.label_ar or ""])
                yield out.getvalue(); out.seek(0); out.truncate(0)

        resp = StreamingHttpResponse(stream(), content_type="text/csv; charset=utf-8")
        resp["Content-Disposition"] = 'attachment; filename="additives_merged.csv"'
        return resp


class AdditiveCodeDetailView(APIView):
    """
    عرض/تحديث/حذف عنصر واحد من الإضافات.
    - يسمح بالوصول لعنصر خاص بالمستخدم أو عنصر عام.
    - حذف عنصر عام يتطلّب is_staff.
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
        return Response(AdditiveLegendSerializer(obj).data, status=status.HTTP_200_OK)

    def put(self, request, pk):
        obj = self._get_object(pk, request.user)
        if not obj:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

        data = request.data
        obj.label_en = (data.get("en") or data.get("label_en") or obj.label_en) or ""
        obj.label_de = (data.get("de") or data.get("label_de") or obj.label_de) or ""
        obj.label_ar = (data.get("ar") or data.get("label_ar") or obj.label_ar) or ""
        # لا نسمح بتغيير number من شاشة التعديل
        obj.save()
        return Response(AdditiveLegendSerializer(obj).data, status=status.HTTP_200_OK)

    def patch(self, request, pk):
        return self.put(request, pk)

    def delete(self, request, pk):
        obj = self._get_object(pk, request.user)
        if not obj:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        if obj.owner is None and not request.user.is_staff:
            return Response({"detail": "Only admins can delete global entries."}, status=status.HTTP_403_FORBIDDEN)
        obj.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
    

    # ---- Lexemes CRUD ----
class KeywordLexemeViewSet(ModelViewSet):
    queryset = KeywordLexeme.objects.all().select_related("ingredient").prefetch_related("allergens")
    serializer_class = KeywordLexemeSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = super().get_queryset()
        # فلاتر شائعة: المالِك/اللغة/التفعيل + q على normalized_term
        owner = self.request.query_params.get("owner")
        lang  = (self.request.query_params.get("lang") or "").strip()
        active = self.request.query_params.get("is_active")
        q = (self.request.query_params.get("q") or "").strip()
        if owner: qs = qs.filter(owner_id=owner)
        if lang:  qs = qs.filter(lang__iexact=lang)
        if active in ("0","1"): qs = qs.filter(is_active=(active=="1"))
        if q: qs = qs.filter(normalized_term__icontains=q)
        return qs.order_by("priority", "weight", "id")

class KeywordLexemeExportCSV(APIView):
    permission_classes = [IsAuthenticated]
    def get(self, request):
        qs = KeywordLexemeViewSet().get_queryset()  # أعد استخدام نفس الفلاتر
        def row(lx):
            al = ",".join(str(a.id) for a in lx.allergens.all())
            ing = lx.ingredient_id or ""
            return [lx.lang, lx.term or "", int(lx.is_regex), al, ing, int(lx.is_active), lx.priority or 0, lx.weight or 0]
        header = ["lang","term","is_regex","allergens_ids","ingredient_id","is_active","priority","weight"]
        buf = io.StringIO(); w = csv.writer(buf); w.writerow(header); [w.writerow(row(x)) for x in qs]
        resp = HttpResponse(buf.getvalue(), content_type="text/csv; charset=utf-8")
        resp["Content-Disposition"] = 'attachment; filename="lexemes.csv"'
        return resp

class KeywordLexemeImportCSV(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]
    def post(self, request):
        f = request.FILES.get("file")
        if not f: return Response({"detail":"CSV مفقود"}, status=400)
        data = io.TextIOWrapper(f.file, encoding="utf-8", errors="ignore")
        r = csv.DictReader(data)
        upserted = 0
        for row in r:
            lx, _ = KeywordLexeme.objects.update_or_create(
                owner_id=request.data.get("owner") or None,
                lang=(row.get("lang") or "de").lower().strip(),
                term=(row.get("term") or "").strip(),
                defaults={
                    "is_regex": str(row.get("is_regex") or "0") in ("1","true","True"),
                    "ingredient_id": (row.get("ingredient_id") or None),
                    "is_active": str(row.get("is_active") or "1") in ("1","true","True"),
                    "priority": int(row.get("priority") or 0),
                    "weight": int(row.get("weight") or 0),
                }
            )
            # allergens_ids: "1,5,9"
            ids = [int(x) for x in (row.get("allergens_ids") or "").split(",") if x.strip().isdigit()]
            if ids: lx.allergens.set(ids)
            upserted += 1
        return Response({"ok": True, "count": upserted})
        


        # ========================= =======
        # ---- Lexemes CRUD ----
class KeywordLexemeViewSet(ModelViewSet):
    queryset = KeywordLexeme.objects.all().select_related("ingredient").prefetch_related("allergens")
    serializer_class = KeywordLexemeSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = super().get_queryset()
        # فلاتر شائعة: المالِك/اللغة/التفعيل + q على normalized_term
        owner = self.request.query_params.get("owner")
        lang  = (self.request.query_params.get("lang") or "").strip()
        active = self.request.query_params.get("is_active")
        q = (self.request.query_params.get("q") or "").strip()
        if owner: qs = qs.filter(owner_id=owner)
        if lang:  qs = qs.filter(lang__iexact=lang)
        if active in ("0","1"): qs = qs.filter(is_active=(active=="1"))
        if q: qs = qs.filter(normalized_term__icontains=q)
        return qs.order_by("priority", "weight", "id")

class KeywordLexemeExportCSV(APIView):
    permission_classes = [IsAuthenticated]
    def get(self, request):
        qs = KeywordLexemeViewSet().get_queryset()  # أعد استخدام نفس الفلاتر
        def row(lx):
            al = ",".join(str(a.id) for a in lx.allergens.all())
            ing = lx.ingredient_id or ""
            return [lx.lang, lx.term or "", int(lx.is_regex), al, ing, int(lx.is_active), lx.priority or 0, lx.weight or 0]
        header = ["lang","term","is_regex","allergens_ids","ingredient_id","is_active","priority","weight"]
        buf = io.StringIO(); w = csv.writer(buf); w.writerow(header); [w.writerow(row(x)) for x in qs]
        resp = HttpResponse(buf.getvalue(), content_type="text/csv; charset=utf-8")
        resp["Content-Disposition"] = 'attachment; filename="lexemes.csv"'
        return resp

class KeywordLexemeImportCSV(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]
    def post(self, request):
        f = request.FILES.get("file")
        if not f: return Response({"detail":"CSV مفقود"}, status=400)
        data = io.TextIOWrapper(f.file, encoding="utf-8", errors="ignore")
        r = csv.DictReader(data)
        upserted = 0
        for row in r:
            lx, _ = KeywordLexeme.objects.update_or_create(
                owner_id=request.data.get("owner") or None,
                lang=(row.get("lang") or "de").lower().strip(),
                term=(row.get("term") or "").strip(),
                defaults={
                    "is_regex": str(row.get("is_regex") or "0") in ("1","true","True"),
                    "ingredient_id": (row.get("ingredient_id") or None),
                    "is_active": str(row.get("is_active") or "1") in ("1","true","True"),
                    "priority": int(row.get("priority") or 0),
                    "weight": int(row.get("weight") or 0),
                }
            )
            # allergens_ids: "1,5,9"
            ids = [int(x) for x in (row.get("allergens_ids") or "").split(",") if x.strip().isdigit()]
            if ids: lx.allergens.set(ids)
            upserted += 1
        return Response({"ok": True, "count": upserted})
    

    # ---- Ingredients CRUD ----
class IngredientViewSet(ModelViewSet):
    queryset = Ingredient.objects.all().prefetch_related("allergens")
    serializer_class = IngredientLiteSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = super().get_queryset()
        owner = self.request.query_params.get("owner")
        q = (self.request.query_params.get("q") or "").strip()
        if owner: qs = qs.filter(owner_id=owner)
        if q: qs = qs.filter(name__icontains=q)
        return qs.order_by("name","id")
