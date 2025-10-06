from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import (
    AllergenCodeViewSet,            # للحساسيات عبر الراوتر
    AllergenBulkUpload, AllergenExportCSV,
    AdditiveCodesView,              # فيو الإضافات يدعم GET + POST
    AdditiveBulkUploadView,         # رفع CSV للإضافات
    AdditiveExportCSV,              # تصدير CSV للإضافات
)

router = DefaultRouter()
router.register(r"allergens/codes", AllergenCodeViewSet, basename="allergen-code")
# ⚠️ احذف أو علّق هذا السطر لأنه يصطدم مع مساراتنا اليدوية:
# router.register(r"additives/codes", AdditiveCodeViewSet, basename="additive-code")

urlpatterns = [
    # --- Additives (يدوي) ---
    path("additives/codes/", AdditiveCodesView.as_view(), name="additives-codes"),           # GET + POST
    path("additives/bulk-upload/", AdditiveBulkUploadView.as_view(), name="additives-bulk"), # POST (multipart)
    path("additives/export/", AdditiveExportCSV.as_view(), name="additives-export"),         # GET (CSV)

    # --- Allergens (راوتر) + باقي مسارات الحساسيّات اليدوية ---
    path("", include(router.urls)),
    path("allergens/bulk-upload/", AllergenBulkUpload.as_view(), name="allergen-bulk-upload"),
    path("allergens/export/", AllergenExportCSV.as_view(), name="allergen-export"),
]
