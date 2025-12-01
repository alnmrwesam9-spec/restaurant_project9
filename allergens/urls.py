# allergens/urls.py
from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import (
    # --- Allergens (يدوي) ---
    AllergenCodesView, AllergenCodeDetailView,
    AllergenBulkUpload, AllergenExportCSV,
    AllergenGenerateView,  # German-only rule-based generation

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
    # --- Allergens (يدوي) ---
    path("allergens/codes/", AllergenCodesView.as_view(), name="allergens-codes"),                     # GET + POST
    path("allergens/codes/<int:pk>/", AllergenCodeDetailView.as_view(), name="allergens-detail"),      # GET + PUT + DELETE
    path("allergens/bulk-upload/", AllergenBulkUpload.as_view(), name="allergens-bulk"),               # POST (multipart)
    path("allergens/export/", AllergenExportCSV.as_view(), name="allergens-export"),                   # GET (CSV)
    # German-only rule-based generation
    path("allergens/generate/", AllergenGenerateView.as_view(), name="allergens-generate"),            # POST

    # --- Lexemes CSV (ادعم الشكلين: بدون/مع owner في URL) ---
    path("lexemes/export/", KeywordLexemeExportCSV.as_view(), name="lexemes-export"),
    path("lexemes/export/<int:owner>/", KeywordLexemeExportCSV.as_view(), name="lexemes-export-owner"),
    path("lexemes/import/", KeywordLexemeImportCSV.as_view(), name="lexemes-import"),
    path("lexemes/import/<int:owner>/", KeywordLexemeImportCSV.as_view(), name="lexemes-import-owner"),
    # --- Allergens aliases for backward-compat ---
    path("allergens/codes/bulk-upload/", AllergenBulkUpload.as_view(), name="allergens-bulk-compat"),
    path("allergens/codes/export/",      AllergenExportCSV.as_view(),  name="allergens-export-compat"),

# --- Ingredients aliases for backward-compat ---
    path("ingredients/bulk-upload/", IngredientBulkUploadCSV.as_view(), name="ingredients-bulk"),
    path("ingredients/import/",      IngredientBulkUploadCSV.as_view(), name="ingredients-import"),  # Added to match frontend
    path("ingredients/export/",      IngredientExportCSV.as_view(),      name="ingredients-export"),

    # --- Router (ingredients + lexemes) ---
    path("", include(router.urls)),
]
