# allergens/serializers.py
# -----------------------------------------------------------------------------
# Serializers لواجهات الحساسيّات والإضافات (E-Num) والمعجم النصّي والمكوّنات.
# نحافظ على أسماء الحقول الأمامية (name_de/en/ar, code) مع ربطها بأعمدة
# الجداول القديمة الموجودة فعليًا في core.models
# -----------------------------------------------------------------------------

from typing import Optional

from rest_framework import serializers

from core.models import Allergen, Ingredient
from core.dictionary_models import KeywordLexeme


# =========================
# Allergen (قاموس الحساسيّات)
# =========================
class AllergenCodeSerializer(serializers.ModelSerializer):
    """
    إبقاء أسماء الواجهة الأمامية متّسقة مع ربطها بأعمدة الجدول القديمة:
    label_de -> name_de, label_en -> name_en, label_ar -> name_ar
    """
    name_de = serializers.CharField(source="label_de", allow_blank=True, required=False)
    name_en = serializers.CharField(source="label_en", allow_blank=True, required=False)
    name_ar = serializers.CharField(source="label_ar", allow_blank=True, required=False)
    kind = serializers.ChoiceField(choices=Allergen.Kind.choices, default=Allergen.Kind.ALLERGEN)

    class Meta:
        model = Allergen
        fields = ["id", "code", "name_de", "name_en", "name_ar", "kind"]

    # توحيد تنسيق كود الحساسية (مثل: A, B, C...) مع إزالة الفراغات
    def validate_code(self, value: str) -> str:
        v = (value or "").strip().upper()
        if not v:
            raise serializers.ValidationError("حقل الكود مطلوب.")
        return v


# =========================
# Admin Allergen (German-only for admin/dish workflows)
# =========================
class AdminAllergenSerializer(serializers.ModelSerializer):
    """
    German-only allergen catalog for admin and dish editing workflows.
    Exposes ONLY: id, code, name_de
    Does NOT expose EN/AR fields (they remain in DB but aren't used in German workflow).
    """
    name_de = serializers.CharField(source="label_de", allow_blank=True, required=False)
    kind = serializers.ChoiceField(choices=Allergen.Kind.choices, default=Allergen.Kind.ALLERGEN)

    class Meta:
        model = Allergen
        fields = ["id", "code", "name_de", "kind"]

    def validate_code(self, value: str) -> str:
        v = (value or "").strip().upper()
        if not v:
            raise serializers.ValidationError("Code is required.")
        return v





# =========================
# KeywordLexeme (قاموس نصّي)
# =========================
class KeywordLexemeSerializer(serializers.ModelSerializer):
    # Use allergen codes (e.g. "A", "G") instead of IDs
    allergens = serializers.SlugRelatedField(
        slug_field="code",
        queryset=Allergen.objects.all(),
        many=True,
        required=False
    )
    # Use ingredient name instead of ID
    # NOTE: This assumes ingredient names are unique in the queryset.
    # If multiple ingredients have the same name (different owners), this might raise an error.
    ingredient = serializers.SlugRelatedField(
        slug_field="name",
        queryset=Ingredient.objects.all(),
        allow_null=True,
        required=False
    )

    class Meta:
        model = KeywordLexeme
        fields = [
            "id", "owner", "lang", "term", "is_regex",
            "allergens", "ingredient",
            "is_active", "priority", "weight",
            "normalized_term",
        ]
        read_only_fields = ["normalized_term"]


# ===== Ingredient (نسخة خفيفة) =====
class IngredientLiteSerializer(serializers.ModelSerializer):
    # Use allergen codes (e.g. "A", "G") instead of IDs
    allergens = serializers.SlugRelatedField(
        slug_field="code",
        queryset=Allergen.objects.all(),
        many=True,
        required=False
    )

    class Meta:
        model = Ingredient
        fields = ["id", "owner", "name", "allergens", "synonyms"]
