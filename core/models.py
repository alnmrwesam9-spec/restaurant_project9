# core/models.py
# ------------------------------
# نماذج قاعدة البيانات الخاصة بالتطبيق
# ------------------------------

import os
from django.db import models
from django.contrib.auth.models import AbstractUser
from django.utils.text import slugify
from django.db.models.signals import post_delete, pre_save, post_save
from django.dispatch import receiver
from django.core.exceptions import ValidationError
from django.conf import settings
from django.utils import timezone


# ===========================
# نموذج المستخدم المخصّص
# ===========================
class User(AbstractUser):
    ROLE_CHOICES = (
        ('admin', 'Admin'),
        ('owner', 'Restaurant Owner'),
    )
    role = models.CharField(max_length=10, choices=ROLE_CHOICES)

    def __str__(self):
        return f"{self.username} ({self.role})"


# ===========================
# نماذج الحساسيّات والمكوّنات
# ===========================
class Allergen(models.Model):
    """
    لائحة الحساسيّات القياسية (A..R). أمثلة:
    A=Gluten, C=Eggs, G=Milk, ...
    """
    code = models.CharField(max_length=2, unique=True)  # مثل "A"
    label_de = models.CharField(max_length=120)
    label_en = models.CharField(max_length=120, blank=True, default='')
    label_ar = models.CharField(max_length=120, blank=True, default='')

    class Meta:
        ordering = ["code"]

    def __str__(self):
        return f"{self.code} - {self.label_de}"


class AdditiveLegend(models.Model):
    """
    أسطورة الإضافات (الأرقام) قابلة للتخصيص لكل مالك/مطعم.
    مثال متعارف: 1=Farbstoff, 2=Konservierungsstoff, ...
    """
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="additives_legend",
    )
    number = models.PositiveIntegerField()
    label_de = models.CharField(max_length=180)
    label_en = models.CharField(max_length=180, blank=True, default='')
    label_ar = models.CharField(max_length=180, blank=True, default='')

    class Meta:
        unique_together = ("owner", "number")
        ordering = ["number"]

    def __str__(self):
        return f"{self.owner_id}#{self.number} - {self.label_de}"


class Ingredient(models.Model):
    """
    مكوّن قابل لإعادة الاستخدام عبر الأطباق.
    - allergens: ربط بالحساسيات
    - additives: قائمة أرقام (JSON)
    - synonyms: مرادفات للبحث/الاستيراد الذكي
    """
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="ingredients"
    )
    name = models.CharField(max_length=120)
    allergens = models.ManyToManyField(Allergen, blank=True, related_name="ingredients")
    additives = models.JSONField(default=list, blank=True)   # [1,2,3]
    synonyms = models.JSONField(default=list, blank=True)    # ["Weizenmehl", "Pasta"]

    class Meta:
        unique_together = ("owner", "name")
        ordering = ["name"]

    def __str__(self):
        return self.name


# ===========================
# القوائم والأقسام والأطباق
# ===========================
class Menu(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='menus'
    )
    name = models.CharField(max_length=100)

    # حقول النشر العام
    is_published = models.BooleanField(default=False)
    public_slug = models.SlugField(max_length=160, unique=True, null=True, blank=True)

    def ensure_public_slug(self):
        """
        يولّد slug فريد للقائمة لو لم يكن موجودًا مسبقًا.
        البنية: username-name-<i>
        """
        if self.public_slug:
            return self.public_slug
        base = slugify(f"{self.user.username}-{self.name}") or "menu"
        slug = base
        i = 1
        while Menu.objects.exclude(pk=self.pk).filter(public_slug=slug).exists():
            i += 1
            slug = f"{base}-{i}"
        self.public_slug = slug
        return self.public_slug

    def save(self, *args, **kwargs):
        # نضمن توليد slug تلقائيًا عند النشر
        if self.is_published and not self.public_slug:
            self.ensure_public_slug()
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name


class Section(models.Model):
    name = models.CharField(max_length=100, default='قسم جديد')
    menu = models.ForeignKey(Menu, on_delete=models.CASCADE, related_name='sections')
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='sections'
    )

    def __str__(self):
        return self.name


class Dish(models.Model):
    section = models.ForeignKey(Section, on_delete=models.CASCADE, related_name='dishes')
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True, null=True)

    # السعر القديم (للتوافق الخلفي فقط — سيُستبدل لاحقًا بأسعار متعددة)
    price = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)

    image = models.ImageField(upload_to='dishes/', blank=True, null=True)
    allergy_info = models.CharField(
        max_length=255, blank=True, null=True, verbose_name="عناصر الحساسية (قديم)"
    )

    # --- جديد: ربط المكوّنات والأكواد الآلية/اليدوية ---
    ingredients = models.ManyToManyField(
        Ingredient, blank=True, related_name="dishes"
    )

    generated_codes = models.CharField(
        max_length=255, blank=True, default='',
        help_text="الكود المتولّد آليًا بصيغة (A,C,G,1,3)."
    )
    has_manual_codes = models.BooleanField(
        default=False, help_text="إذا true يتم تجاهل generated_codes."
    )
    manual_codes = models.CharField(
        max_length=255, blank=True, null=True,
        help_text="قيمة يدوّنية للكود بصيغة (A,C,G,1,3)."
    )
    extra_allergens = models.JSONField(
        default=list, blank=True, help_text="حروف إضافية على مستوى الطبق مثل ['A','G']"
    )
    extra_additives = models.JSONField(
        default=list, blank=True, help_text="أرقام إضافية على مستوى الطبق مثل [1,3]"
    )
    codes_updated_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        indexes = [
            models.Index(fields=["section", "name"]),
            models.Index(fields=["has_manual_codes"]),
        ]

    def default_price_value(self):
        dp = self.prices.filter(is_default=True).first()
        return dp.price if dp else None

    @property
    def effective_price(self):
        # يفضّل DishPrice الافتراضي وإلا يرجّع السعر القديم
        return self.default_price_value() if self.default_price_value() is not None else self.price

    # --- قراءة الأكواد من السجلات التفصيلية إن وُجدت (مع توافق خلفي) ---
    def _codes_from_allergen_rows(self) -> str:
        try:
            rows = self.allergen_rows.select_related("allergen").only("allergen__code")
            codes = sorted({(r.allergen.code or "").strip().upper() for r in rows if r.allergen_id and r.allergen and r.allergen.code})
            return ",".join(c for c in codes if c)
        except Exception:
            return ""

    @property
    def display_codes(self) -> str:
        """
        الكود الذي سيظهر في الواجهة:
        1) إذا has_manual_codes=True استخدم manual_codes
        2) وإلا إن وُجدت سجلات DishAllergen نقرأها
        3) وإلا fallback إلى generated_codes
        """
        if self.has_manual_codes:
            return (self.manual_codes or "").strip()
        codes_from_rows = self._codes_from_allergen_rows()
        if codes_from_rows:
            return codes_from_rows
        return (self.generated_codes or "").strip()

    def mark_codes_updated(self):
        self.codes_updated_at = timezone.now()
        self.save(update_fields=["codes_updated_at"])

    def __str__(self):
        return self.name


# ============================================
# نموذج تفصيلي لكل كود حساسية على طبق واحد
# ============================================
class DishAllergen(models.Model):
    """
    سجلات أثرية/تتبعية لكل كود حساسية مرتبط بطبق معيّن.
    الهدف: الشفافية (من أين جاء الكود؟) + الثقة + إمكانية المراجعة البشرية.
    """

    class Source(models.TextChoices):
        INGREDIENT = "ingredient", "Ingredient"   # جاء من مكوّن مهيكل (M2M)
        REGEX = "regex", "Regex/Lexeme"          # جاء من مطابقة لغوية (Keyword/Regex)
        LLM = "llm", "LLM"                        # مقترح من LLM (عادة غير مؤكّد حتى يراجع)
        TRACE = "trace", "Trace/Spuren"           # أثر مطبخي عام (Spuren)
        MANUAL = "manual", "Manual"               # إدخال يدوي صريح

    dish = models.ForeignKey(
        Dish, on_delete=models.CASCADE, related_name="allergen_rows"
    )
    allergen = models.ForeignKey(
        Allergen, on_delete=models.PROTECT, related_name="dish_rows"
    )

    source = models.CharField(max_length=12, choices=Source.choices, default=Source.REGEX)
    confidence = models.FloatField(default=0.0, help_text="0..1")
    rationale = models.TextField(blank=True, default='', help_text="سبب مختصر: مثل 'Käse → G (Milch)'")
    is_confirmed = models.BooleanField(default=False, help_text="اعتماد بشري نهائي")

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="created_dish_allergens"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["dish_id", "allergen__code"]
        constraints = [
            # فريد لكل (طبق، كود)
            models.UniqueConstraint(fields=["dish", "allergen"], name="uniq_dish_allergen"),
            # تأكيد أن الثقة ضمن [0,1]
            models.CheckConstraint(check=models.Q(confidence__gte=0.0) & models.Q(confidence__lte=1.0), name="chk_confidence_0_1"),
        ]
        indexes = [
            models.Index(fields=["dish"]),
            models.Index(fields=["allergen"]),
            models.Index(fields=["source"]),
            models.Index(fields=["is_confirmed"]),
            models.Index(fields=["created_at"]),
        ]

    def __str__(self):
        return f"DishAllergen(dish={self.dish_id}, code={self.allergen.code}, src={self.source})"

    @property
    def code(self) -> str:
        return (self.allergen.code or "").strip().upper() if self.allergen_id else ""


# ============================================
# إعدادات عرض مستقلة لكل قائمة (OneToOne)
# ============================================
def menu_logo_upload_path(instance, filename):
    return f'menu_settings/{instance.menu_id}/logo/{filename}'


def menu_hero_upload_path(instance, filename):
    return f'menu_settings/{instance.menu_id}/hero/{filename}'


class MenuDisplaySettings(models.Model):
    menu = models.OneToOneField(Menu, on_delete=models.CASCADE, related_name='display_settings')
    display_name = models.CharField(max_length=255, blank=True, default='')
    phone = models.CharField(max_length=64, blank=True, default='')
    address = models.CharField(max_length=255, blank=True, default='')
    hours = models.CharField(max_length=255, blank=True, default='')
    logo = models.ImageField(upload_to=menu_logo_upload_path, blank=True, null=True)
    hero_image = models.ImageField(upload_to=menu_hero_upload_path, blank=True, null=True)
    theme = models.CharField(max_length=255, blank=True, default='default')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Menu Display Settings'
        verbose_name_plural = 'Menu Display Settings'
        constraints = [
            models.UniqueConstraint(fields=['menu'], name='unique_display_settings_per_menu')
        ]

    def __str__(self):
        return f'DisplaySettings(menu={self.menu_id})'


# ===========================
# إشارات إدارة صور الأطباق
# ===========================
@receiver(post_delete, sender=Dish)
def delete_dish_image_on_delete(sender, instance, **kwargs):
    """حذف آمن لصورة الطبق عند حذف السجل."""
    if instance.image:
        try:
            storage = instance.image.storage
            name = instance.image.name
            if name:
                storage.delete(name)
        except Exception:
            try:
                if getattr(instance.image, "path", None) and os.path.isfile(instance.image.path):
                    os.remove(instance.image.path)
            except Exception:
                pass


@receiver(pre_save, sender=Dish)
def delete_old_image_on_change(sender, instance, **kwargs):
    """عند استبدال صورة الطبق، احذف القديمة بأمان."""
    if not instance.pk:
        return
    try:
        old = Dish.objects.get(pk=instance.pk)
    except Dish.DoesNotExist:
        return
    old_image = getattr(old, "image", None)
    new_image = getattr(instance, "image", None)
    if old_image and old_image != new_image:
        try:
            storage = old_image.storage
            name = old_image.name
            if name:
                storage.delete(name)
        except Exception:
            try:
                if getattr(old_image, "path", None) and os.path.isfile(old_image.path):
                    os.remove(old_image.path)
            except Exception:
                pass


# ===========================
# أسعار متعددة للصنف الواحد
# ===========================
class DishPrice(models.Model):
    dish = models.ForeignKey(Dish, related_name="prices", on_delete=models.CASCADE)
    label = models.CharField(max_length=64, blank=True)
    price = models.DecimalField(max_digits=8, decimal_places=2)
    is_default = models.BooleanField(default=False)
    sort_order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["sort_order", "id"]
        constraints = [
            models.UniqueConstraint(
                fields=["dish"],
                condition=models.Q(is_default=True),
                name="uniq_default_price_per_dish",
            ),
        ]
        indexes = [
            models.Index(fields=["dish", "sort_order"]),
            models.Index(fields=["dish", "is_default"]),
        ]

    def clean(self):
        if self.is_default and self.dish_id:
            qs = DishPrice.objects.filter(dish_id=self.dish_id, is_default=True)
            if self.pk:
                qs = qs.exclude(pk=self.pk)
            if qs.exists():
                raise ValidationError("Only one default price per dish is allowed.")

    def __str__(self):
        base = self.label or "Price"
        return f"{base} - {self.price}"


# ======================================================
# اقتراحات المكوّنات عبر LLM (Fallback)
# ======================================================
class IngredientSuggestion(models.Model):
    """
    يخزّن اقتراحات المكوّنات التي يُنتجها الـ LLM عندما تفشل القواعد في DB.
    - لا يرجّع أكواد؛ التحويل يتم عبر القواعد/المعجم لاحقًا.
    """
    STATUS_PENDING = "pending"
    STATUS_ACCEPTED = "accepted"
    STATUS_REJECTED = "rejected"
    STATUS_APPLIED = "applied"
    STATUS_CHOICES = (
        (STATUS_PENDING, "Pending"),
        (STATUS_ACCEPTED, "Accepted"),
        (STATUS_REJECTED, "Rejected"),
        (STATUS_APPLIED, "Applied"),
    )

    dish = models.ForeignKey(Dish, on_delete=models.CASCADE, related_name="llm_suggestions")
    lang = models.CharField(max_length=8, default="de", help_text="لغة المصطلحات المقترَحة (افتراضيًا: الألمانية).")
    text_snapshot = models.TextField(
        help_text="نص المصدر ساعة توليد الاقتراح (name + description بعد التنظيف)."
    )
    candidates = models.JSONField(default=list, blank=True, help_text="قائمة مصطلحات مع درجات الثقة وربط اختياري بـ Ingredient.")
    model_name = models.CharField(max_length=100, blank=True, default='', help_text="اسم نموذج الـLLM المستخدم.")
    prompt_hash = models.CharField(max_length=64, null=True, blank=True, help_text="هاش للمحفّز لتجنّب الازدواجية.")
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default=STATUS_PENDING)
    notes = models.TextField(blank=True, default='', help_text="ملاحظات أثناء المراجعة/التطبيق.")

    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="reviewed_suggestions"
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    applied_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["dish"]),
            models.Index(fields=["status"]),
            models.Index(fields=["lang"]),
            models.Index(fields=["created_at"]),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["dish", "prompt_hash", "model_name", "lang"],
                name="uniq_suggestion_per_prompt",
                condition=models.Q(prompt_hash__isnull=False),
            ),
        ]

    def __str__(self):
        return f"Sugg(dish={self.dish_id}, status={self.status}, lang={self.lang})"

    def mark_reviewed(self, user=None, notes: str = ''):
        self.reviewed_by = user
        self.reviewed_at = timezone.now()
        if notes:
            self.notes = (self.notes + "\n" + notes).strip() if self.notes else notes
        self.save(update_fields=["reviewed_by", "reviewed_at", "notes"])

    def mark_applied(self):
        self.status = self.STATUS_APPLIED
        self.applied_at = timezone.now()
        self.save(update_fields=["status", "applied_at"])

    def top_terms(self, k: int = 5):
        items = self.candidates or []
        try:
            items = sorted(items, key=lambda x: x.get("score", 0), reverse=True)
        except Exception:
            pass
        return items[:k]


# ===========================
# بروفايل المستخدم (Avatar + اسم عرض)
# ===========================
class Profile(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='profile'
    )
    display_name = models.CharField(max_length=150, blank=True, default='')
    avatar = models.ImageField(upload_to='avatars/', blank=True, null=True)

    def __str__(self):
        return self.display_name or self.user.get_username()


# إشارات للبروفايل: إنشاء تلقائي + تنظيف صور
@receiver(post_save, sender=User)
def ensure_profile_exists(sender, instance, created, **kwargs):
    """إنشاء بروفايل تلقائيًا لكل مستخدم جديد."""
    if created:
        Profile.objects.get_or_create(user=instance)


@receiver(pre_save, sender=Profile)
def delete_old_avatar_on_change(sender, instance, **kwargs):
    """عند تحديث الصورة، نحذف القديمة بأمان."""
    if not instance.pk:
        return
    try:
        old = Profile.objects.get(pk=instance.pk)
    except Profile.DoesNotExist:
        return
    old_img = getattr(old, "avatar", None)
    new_img = getattr(instance, "avatar", None)
    if old_img and old_img != new_img:
        try:
            storage = old_img.storage
            name = old_img.name
            if name:
                storage.delete(name)
        except Exception:
            try:
                if getattr(old_img, "path", None) and os.path.isfile(old_img.path):
                    os.remove(old_img.path)
            except Exception:
                pass


@receiver(post_delete, sender=Profile)
def delete_avatar_on_delete(sender, instance, **kwargs):
    """عند حذف البروفايل نحذف ملف الصورة."""
    if instance.avatar:
        try:
            storage = instance.avatar.storage
            name = instance.avatar.name
            if name:
                storage.delete(name)
        except Exception:
            try:
                if getattr(instance.avatar, "path", None) and os.path.isfile(instance.avatar.path):
                    os.remove(instance.avatar.path)
            except Exception:
                pass
