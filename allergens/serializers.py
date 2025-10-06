# allergens/serializers.py
from rest_framework import serializers
from core.models import Allergen, AdditiveLegend  # ← الموديل القديم الموجود فعلاً (جدول core_allergen)

class AllergenCodeSerializer(serializers.ModelSerializer):
    # نحافظ على أسماء الواجهة الأمامية مع ربطها بأعمدة الجدول القديمة
    name_de = serializers.CharField(source="label_de")
    name_en = serializers.CharField(source="label_en")
    name_ar = serializers.CharField(source="label_ar")

    class Meta:
        model = Allergen
        fields = ["id", "code", "name_de", "name_en", "name_ar"]


#-- allergens/views.py

class AdditiveCodeSerializer(serializers.ModelSerializer):
    # نعرض/نستقبل code مثل "E300" لكن نخزّن داخليًا في الحقل number
    code = serializers.CharField(required=False, allow_blank=True)
    name_de = serializers.CharField(source="label_de")
    name_en = serializers.CharField(source="label_en")
    name_ar = serializers.CharField(source="label_ar")

    class Meta:
        model = AdditiveLegend  # جدول core_additivelegend
        fields = ["id", "code", "name_de", "name_en", "name_ar"]  # لا نُخرج 'number' للواجهة

    def to_representation(self, instance):
        data = super().to_representation(instance)
        # اجعل "code" تبدو كـ E{number}
        num = str(getattr(instance, "number", "") or "")
        data["code"] = f"E{num}" if num and not num.upper().startswith("E") else num
        return data

    def _parse_code_to_number(self, value: str):
        if value is None:
            return None
        v = value.strip()
        if not v:
            return None
        if v.upper().startswith("E"):
            v = v[1:]
        # ابقِ أرقامًا فقط
        digits = "".join(ch for ch in v if ch.isdigit())
        if not digits:
            raise serializers.ValidationError("رمز الإضافة يجب أن يحتوي رقمًا (مثال: E300).")
        return digits  # نخزّن كـ نص لأن الحقل غالبًا CharField في الجدول القديم

    def create(self, validated_data):
        code = validated_data.pop("code", None)
        num = self._parse_code_to_number(code) if code is not None else None
        if num is not None:
            validated_data["number"] = num
        return super().create(validated_data)

    def update(self, instance, validated_data):
        code = validated_data.pop("code", None)
        num = self._parse_code_to_number(code) if code is not None else None
        if num is not None:
            validated_data["number"] = num
        return super().update(instance, validated_data)