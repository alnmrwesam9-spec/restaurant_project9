# allergens/serializers.py
# -----------------------------------------------------------------------------
# Serializers لواجهات الحساسيّات والإضافات (E-Num) والمعجم النصّي والمكوّنات.
# نحافظ على أسماء الحقول الأمامية (name_de/en/ar, code) مع ربطها بأعمدة
# الجداول القديمة الموجودة فعليًا في core.models
# -----------------------------------------------------------------------------

from typing import Optional

from rest_framework import serializers

from core.models import Allergen, AdditiveLegend, Ingredient
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

    class Meta:
        model = Allergen
        fields = ["id", "code", "name_de", "name_en", "name_ar"]

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

    class Meta:
        model = Allergen
        fields = ["id", "code", "name_de"]

    def validate_code(self, value: str) -> str:
        v = (value or "").strip().upper()
        if not v:
            raise serializers.ValidationError("Code is required.")
        return v


# =========================
# AdditiveLegend (قاموس الإضافات E-Number)
# =========================
class AdditiveCodeSerializer(serializers.ModelSerializer):
    """
    نعرض/نستقبل الحقل الافتراضي "code" مثل "E300" ولكن نخزّن داخليًا في الحقل القديم "number".
    الحقول النصية للأسماء تُعرَض كـ name_de/name_en/name_ar وترتبط بـ label_de/label_en/label_ar.
    """
    code = serializers.CharField(required=False, allow_blank=True)
    name_de = serializers.CharField(source="label_de", allow_blank=True, required=False)
    name_en = serializers.CharField(source="label_en", allow_blank=True, required=False)
    name_ar = serializers.CharField(source="label_ar", allow_blank=True, required=False)

    class Meta:
        model = AdditiveLegend  # جدول core_additivelegend
        # لا نُخرج الحقل الداخلي "number" للواجهة الأمامية
        fields = ["id", "code", "name_de", "name_en", "name_ar"]

    # ---------- Helpers ----------
    def _parse_code_to_number(self, value: Optional[str]) -> Optional[str]:
        """
        يحوّل "E300" أو "300" أو "E-300" → "300"
        نُرجِع None في حال القيمة غير موجودة/فارغة.
        """
        if value is None:
            return None
        v = value.strip()
        if not v:
            return None
        # إزالة بادئة E/e إن وُجدت
        if v[:1].upper() == "E":
            v = v[1:]
        # إبقاء الأرقام فقط
        digits = "".join(ch for ch in v if ch.isdigit())
        if not digits:
            raise serializers.ValidationError("رمز الإضافة يجب أن يحتوي رقمًا (مثال: E300).")
        # نخزّن كـ نص لأن الحقل غالبًا CharField في الجدول القديم
        return digits

    # ---------- Representation ----------
    def to_representation(self, instance):
        """
        عند الإخراج: نجعل "code" دائمًا بالشكل E{number} إن توافر number.
        """
        data = super().to_representation(instance)
        num = str(getattr(instance, "number", "") or "").strip()
        data["code"] = f"E{num}" if num else ""
        return data

    # ---------- Create / Update ----------
    def create(self, validated_data):
        # نلتقط code من البيانات الواردة (إن وُجد) ونحوّله إلى number
        code = validated_data.pop("code", None)
        num = self._parse_code_to_number(code) if code is not None else None
        if num is not None:
            validated_data["number"] = num
        return super().create(validated_data)

    def update(self, instance, validated_data):
        # دعم PATCH/PUT: إن أُرسِل code نقوم بتحديث number
        code = validated_data.pop("code", None)
        num = self._parse_code_to_number(code) if code is not None else None
        if num is not None:
            validated_data["number"] = num
        return super().update(instance, validated_data)


# =========================
# KeywordLexeme (قاموس نصّي)
# =========================
class KeywordLexemeSerializer(serializers.ModelSerializer):
    allergens = serializers.PrimaryKeyRelatedField(
        queryset=Allergen.objects.all(), many=True, required=False
    )
    ingredient = serializers.PrimaryKeyRelatedField(
        queryset=Ingredient.objects.all(), allow_null=True, required=False
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
    allergens = serializers.PrimaryKeyRelatedField(
        many=True, queryset=Allergen.objects.all(), required=False
    )

    class Meta:
        model = Ingredient
        fields = ["id", "owner", "name", "allergens", "additives", "synonyms"]
