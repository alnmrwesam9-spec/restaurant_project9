from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import (
    # --- Allergens ---
    AllergenCodeViewSet,
    AllergenBulkUpload, AllergenExportCSV,

    # --- Additives ---
    AdditiveCodesView, AdditiveCodeDetailView,
    AdditiveBulkUploadView, AdditiveExportCSV,
)

router = DefaultRouter()
router.register(r"allergens/codes", AllergenCodeViewSet, basename="allergen-code")
# ⚠️ تمت إزالة تسجيل الراوتر لمسار additives/codes لتفادي التعارض

urlpatterns = [
    # --- Additives (يدوي) ---
    path("additives/codes/", AdditiveCodesView.as_view(), name="additives-codes"),                 # GET + POST
    path("additives/codes/<int:pk>/", AdditiveCodeDetailView.as_view(), name="additives-code-detail"),  # GET + PUT + DELETE
    path("additives/bulk-upload/", AdditiveBulkUploadView.as_view(), name="additives-bulk"),       # POST (multipart)
    path("additives/export/", AdditiveExportCSV.as_view(), name="additives-export"),               # GET (CSV)

    # --- Allergens (راوتر + يدوي) ---
    path("", include(router.urls)),  # للـ allergens فقط
    path("allergens/bulk-upload/", AllergenBulkUpload.as_view(), name="allergen-bulk-upload"),
    path("allergens/export/", AllergenExportCSV.as_view(), name="allergen-export"),
]
