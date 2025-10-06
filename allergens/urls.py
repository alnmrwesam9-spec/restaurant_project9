# app/api/urls.py
from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import (
    # --- Allergens (يدوي) ---
    AllergenCodesView, AllergenCodeDetailView,
    AllergenBulkUpload, AllergenExportCSV,

    # --- Additives (يدوي) ---
    AdditiveCodesView, AdditiveCodeDetailView,
    AdditiveBulkUploadView, AdditiveExportCSV,
    KeywordLexemeViewSet, KeywordLexemeExportCSV, KeywordLexemeImportCSV,
    IngredientViewSet,
)

# نُبقي الراوتر فارغًا أو لاستخدامات أخرى لاحقًا (بدون تسجيل لمسارات تتقاطع مع اليدوي)
router = DefaultRouter()
# مثال لو احتجته لاحقًا لمسارات مختلفة كليًّا:
# router.register(r"allergens/extra", SomeOtherViewSet, basename="allergens-extra")
router = DefaultRouter()
router.register(r"lexemes", KeywordLexemeViewSet, basename="lexemes")
router.register(r"ingredients", IngredientViewSet, basename="ingredients")


urlpatterns = [
    # --- Additives (يدوي) ---
    path("additives/codes/", AdditiveCodesView.as_view(), name="additives-codes"),                    # GET + POST
    path("additives/codes/<int:pk>/", AdditiveCodeDetailView.as_view(), name="additives-code-detail"),# GET + PUT + DELETE
    path("additives/bulk-upload/", AdditiveBulkUploadView.as_view(), name="additives-bulk"),          # POST (multipart)
    path("additives/export/", AdditiveExportCSV.as_view(), name="additives-export"),                  # GET (CSV)

    # --- Allergens (يدوي) ---
    path("allergens/codes/", AllergenCodesView.as_view(), name="allergens-codes"),                    # GET + POST
    path("allergens/codes/<int:pk>/", AllergenCodeDetailView.as_view(), name="allergens-detail"),     # GET + PUT + DELETE
    path("allergens/bulk-upload/", AllergenBulkUpload.as_view(), name="allergens-bulk"),              # POST (multipart)
    path("allergens/export/", AllergenExportCSV.as_view(), name="allergens-export"),                  # GET (CSV)
    path("lexemes/export/", KeywordLexemeExportCSV.as_view(), name="lexemes-export"),
    path("lexemes/import/", KeywordLexemeImportCSV.as_view(), name="lexemes-import"),
    # --- Router (اختياري لمسارات أخرى غير متقاطعة) ---
    path("", include(router.urls)),
]
