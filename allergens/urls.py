# allergens/urls.py
from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import (
    # --- Allergens (يدوي) ---
    AllergenCodesView, AllergenCodeDetailView,
    AllergenBulkUpload, AllergenExportCSV,

    # --- Additives (يدوي) ---
    AdditiveCodesView, AdditiveCodeDetailView,
    AdditiveBulkUploadView, AdditiveExportCSV,

    # --- Ingredients + Lexemes ---
    IngredientViewSet,
    KeywordLexemeViewSet,            # ← تأكد أن الاسم يطابق الموجود في views.py
    KeywordLexemeImportCSV, KeywordLexemeExportCSV,
    IngredientBulkUploadCSV, IngredientExportCSV,
)

router = DefaultRouter()
router.register(r"ingredients", IngredientViewSet, basename="ingredients")
router.register(r"lexemes", KeywordLexemeViewSet, basename="lexemes")  # ← لو غيّرت الاسم إلى LexemeViewSet عدّل هنا

urlpatterns = [
    # --- Additives (يدوي) ---
    path("additives/codes/", AdditiveCodesView.as_view(), name="additives-codes"),                     # GET + POST
    path("additives/codes/<int:pk>/", AdditiveCodeDetailView.as_view(), name="additives-code-detail"), # GET + PUT + DELETE
    path("additives/bulk-upload/", AdditiveBulkUploadView.as_view(), name="additives-bulk"),           # POST (multipart)
    path("additives/export/", AdditiveExportCSV.as_view(), name="additives-export"),                   # GET (CSV)

    # --- Allergens (يدوي) ---
    path("allergens/codes/", AllergenCodesView.as_view(), name="allergens-codes"),                     # GET + POST
    path("allergens/codes/<int:pk>/", AllergenCodeDetailView.as_view(), name="allergens-detail"),      # GET + PUT + DELETE
    path("allergens/bulk-upload/", AllergenBulkUpload.as_view(), name="allergens-bulk"),               # POST (multipart)
    path("allergens/export/", AllergenExportCSV.as_view(), name="allergens-export"),                   # GET (CSV)

    # --- Lexemes CSV (ادعم الشكلين: بدون/مع owner في URL) ---
    path("lexemes/export/", KeywordLexemeExportCSV.as_view(), name="lexemes-export"),
    path("lexemes/export/<int:owner>/", KeywordLexemeExportCSV.as_view(), name="lexemes-export-owner"),
    path("lexemes/import/", KeywordLexemeImportCSV.as_view(), name="lexemes-import"),
    path("lexemes/import/<int:owner>/", KeywordLexemeImportCSV.as_view(), name="lexemes-import-owner"),
    # --- Allergens aliases for backward-compat ---
    path("allergens/codes/bulk-upload/", AllergenBulkUpload.as_view(), name="allergens-bulk-compat"),
    path("allergens/codes/export/",      AllergenExportCSV.as_view(),  name="allergens-export-compat"),

# --- Additives aliases for backward-compat ---
    path("additives/codes/bulk-upload/", AdditiveBulkUploadView.as_view(), name="additives-bulk-compat"),
    path("additives/codes/export/",      AdditiveExportCSV.as_view(),      name="additives-export-compat"),
# --- Ingredients aliases for backward-compat ---
    path("ingredients/bulk-upload/", IngredientBulkUploadCSV.as_view(), name="ingredients-bulk"),
    path("ingredients/export/",      IngredientExportCSV.as_view(),      name="ingredients-export"),

    # --- Router (ingredients + lexemes) ---
    path("", include(router.urls)),
]
