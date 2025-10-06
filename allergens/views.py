# allergens/views.py

from django.http import HttpResponse, StreamingHttpResponse
from django.db.models import Q, F, Case, When, Value, IntegerField, Subquery, Window
from django.db.models.functions import RowNumber
from rest_framework.viewsets import ModelViewSet, ReadOnlyModelViewSet  # (ReadOnlyModelViewSet may be unused now)
from rest_framework.generics import ListAPIView  # (kept for compatibility if referenced elsewhere)
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated, IsAdminUser
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.response import Response
from rest_framework import status
import csv
import io

from core.models import Allergen, AdditiveLegend
from .serializers import AllergenCodeSerializer
from core.serializers import AdditiveLegendSerializer  # يرجّع number/label_*


# =========================
# Allergen (قاموس الحساسيّات)
# =========================
class AllergenCodeViewSet(ModelViewSet):
    queryset = Allergen.objects.all().order_by("code")
    serializer_class = AllergenCodeSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = Allergen.objects.all()

        q = self.request.query_params.get("q", "").strip()
        if q:
            qs = qs.filter(
                Q(code__icontains=q)
                | Q(label_de__icontains=q)
                | Q(label_en__icontains=q)
                | Q(label_ar__icontains=q)
            )

        ordering = self.request.query_params.get("ordering", "code").strip()
        allowed = {"code", "label_de", "label_en", "label_ar"}
        if ordering.lstrip("-") not in allowed:
            ordering = "code"

        return qs.order_by(ordering, "id")


# ===============================
# BULK UPLOAD للحساسيّات
# ===============================
class AllergenBulkUpload(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request, *args, **kwargs):
        f = request.FILES.get("file")
        if not f:
            return Response({"detail": "CSV file is required (field name 'file')."}, status=status.HTTP_400_BAD_REQUEST)

        # يدعم UTF-8 مع/بدون BOM، ويحافظ على الأسطر
        decoded = io.TextIOWrapper(f.file, encoding="utf-8-sig", newline="")
        reader = csv.DictReader(decoded)

        created = updated = skipped = 0

        for row in reader:
            code = (row.get("code") or row.get("Code") or "").strip()
            if not code:
                skipped += 1
                continue

            defaults = {
                "label_de": (row.get("name_de") or row.get("DE") or row.get("de") or "").strip(),
                "label_en": (row.get("name_en") or row.get("EN") or row.get("en") or "").strip(),
                "label_ar": (row.get("name_ar") or row.get("AR") or row.get("ar") or "").strip(),
            }

            _, was_created = Allergen.objects.update_or_create(code=code, defaults=defaults)
            created += int(was_created)
            updated += int(not was_created)  # noqa: E713

        return Response({"created": created, "updated": updated, "skipped": skipped}, status=status.HTTP_200_OK)


class AllergenExportCSV(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        resp = HttpResponse(content_type="text/csv; charset=utf-8")
        resp["Content-Disposition"] = 'attachment; filename="allergens.csv"'
        writer = csv.writer(resp)
        writer.writerow(["code", "name_de", "name_en", "name_ar"])

        for a in Allergen.objects.all().order_by("code", "id"):
            writer.writerow([a.code, a.label_de or "", a.label_en or "", a.label_ar or ""])

        return resp


# ===========================================
# AdditiveLegend (إضافات/مواد E-numbered)
# دمج الخاص مع العام: سجلات المستخدم + العامة غير المغطاة
# ===========================================

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
    GET: قائمة مدمجة (الخاص يغلب العام) مع ترتيب/فلترة بسيطة.
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

        # Pagination DRF يدويًا (بسيط، لأننا لسنا داخل GenericAPIView)
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


# ===============================
# BULK UPLOAD (الإصدار الجديد) — Additives
# ===============================
class AdditiveBulkUploadView(APIView):
    """
    رفع CSV للإضافات (E-Numbers) مع قبول صيغ عناوين متعددة.
    يسمح للمالك برفع ملفه الخاص (?global=1 للعام).
    """
    permission_classes = [IsAuthenticated]  # اسمح برفع المالك لملفّه
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


# ===========================================
# AdditiveCodeDetailView (عرض/تحديث/حذف عنصر واحد)
# ===========================================
class AdditiveCodeDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get_object(self, pk, user):
        # نسمح بالوصول لعنصر خاص بالمستخدم أو عنصر عام
        return AdditiveLegend.objects.filter(
            Q(pk=pk) & (Q(owner=user) | Q(owner__isnull=True))
        ).first()

    def get(self, request, pk):
        obj = self.get_object(pk, request.user)
        if not obj:
            return Response({"detail": "Not found."}, status=404)
        return Response(AdditiveLegendSerializer(obj).data)

    def put(self, request, pk):
        obj = self.get_object(pk, request.user)
        if not obj:
            return Response({"detail": "Not found."}, status=404)

        # تحديث الحقول
        data = request.data
        obj.label_en = (data.get("en") or data.get("label_en") or obj.label_en) or ""
        obj.label_de = (data.get("de") or data.get("label_de") or obj.label_de) or ""
        obj.label_ar = (data.get("ar") or data.get("label_ar") or obj.label_ar) or ""
        # لا نسمح بتغيير number من شاشة التعديل
        obj.save()
        return Response(AdditiveLegendSerializer(obj).data)

    def patch(self, request, pk):
        return self.put(request, pk)

    def delete(self, request, pk):
        obj = self.get_object(pk, request.user)
        if not obj:
            return Response({"detail": "Not found."}, status=404)
        # لا نحذف من القاموس العام إلا لو المستخدم Admin
        if obj.owner is None and not request.user.is_staff:
            return Response({"detail": "Only admins can delete global entries."}, status=403)
        obj.delete()
        return Response(status=204)
