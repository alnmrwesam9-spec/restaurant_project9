from django.db import models


class AllergenCode(models.Model):
    """
    جدول رئيسي لأكواد الحساسية المعتمدة (قابل للتوسّع لاحقًا).
    أمثلة الكود: 'A1', 'G', 'EIER', 'GLUTEN' .. إلخ
    """

    code = models.CharField(
        max_length=32,
        unique=True,
        help_text="المعرّف/الكود (قصير ومميّز) مثل: A1 أو GLUTEN."
    )
    name_de = models.CharField(
        max_length=255,
        blank=True,
        default="",
        help_text="الاسم بالألمانية (اختياري الآن)."
    )
    name_en = models.CharField(
        max_length=255,
        blank=True,
        default="",
        help_text="الاسم بالإنجليزية (اختياري)."
    )
    name_ar = models.CharField(
        max_length=255,
        blank=True,
        default="",
        help_text="الاسم بالعربية (اختياري)."
    )
    notes = models.TextField(
        blank=True,
        default="",
        help_text="وصف/ملاحظات إضافية (اختياري)."
    )
    is_active = models.BooleanField(
        default=True,
        help_text="تفعيل/تعطيل الكود بدون حذفه."
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["code"]

    def __str__(self):
        label = self.name_de or self.name_en or self.name_ar or ""
        return f"{self.code} {('- ' + label) if label else ''}".strip()
