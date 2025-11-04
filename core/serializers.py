# core/serializers.py
# ---------------------------------------------------------------
# جميع سيريلایزرات واجهة REST (خاصة + عامة)
# ---------------------------------------------------------------

from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.templatetags.static import static
from rest_framework import serializers
from rest_framework.throttling import ScopedRateThrottle  # ✅ ثروتل سكوب

# ✅ SimpleJWT
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.views import TokenObtainPairView

from .models import (
    Menu, Section, Dish, MenuDisplaySettings, DishPrice,
    Profile, Allergen, Ingredient, AdditiveLegend,
    IngredientSuggestion, DishAllergen,   # ⬅️ سجل التتبّع
)
# قاموس القواعد (ملف مستقل)
from .dictionary_models import KeywordLexeme, NegationCue

# ✅ تنظيف/التحقق من الصور
from core.utils.images import validate_and_clean_image


# ===================== أدوات مساعدة عامة =====================
class AbsoluteImageURLField(serializers.ImageField):
    """
    ImageField يُرجع URL مطلق عند القراءة، ويبقى اعتياديًا عند الكتابة.
    """
    def to_representation(self, value):
        url = super().to_representation(value)
        if not url:
            return url
        request = self.context.get('request')
        return request.build_absolute_uri(url) if request else url


def _resolve_dish_image_url(obj, request=None):
    """
    يُعيد URL الصورة بالترتيب:
    dish.image -> owner.profile.avatar -> static placeholder.
    """
    # 1) صورة الطبق (إن وُجدت)
    try:
        if getattr(obj, "image", None) and obj.image:
            url = obj.image.url
            if url:
                return request.build_absolute_uri(url) if request else url
    except Exception:
        pass

    # 2) صورة المستخدم (avatar)
    try:
        owner = obj.section.menu.user
        prof = getattr(owner, "profile", None)
        if prof and getattr(prof, "avatar", None):
            url = prof.avatar.url
            if url:
                return request.build_absolute_uri(url) if request else url
    except Exception:
        pass

    # 3) صورة افتراضية
    url = static('img/dish-placeholder.png')
    return request.build_absolute_uri(url) if request else url


def _extract_letter_codes_from_display(display_value: str) -> list[str]:
    """
    يستخرج أكواد الحساسيّات الحرفيّة (A..Z) من صِيَغ متنوعة مثل:
      "A,G,K" أو "(A,G,K)" أو "(A,G,K,12,34)".
    يتجاهل أرقام الإضافات.
    """
    if not display_value:
        return []
    raw = str(display_value).strip()
    if raw.startswith("(") and raw.endswith(")"):
        raw = raw[1:-1]
    parts = [p.strip() for p in raw.split(",") if p.strip()]
    letters = []
    for p in parts:
        token = p.upper()
        if len(token) == 1 and "A" <= token <= "Z":
            letters.append(token)
    seen = set()
    out = []
    for c in letters:
        if c not in seen:
            seen.add(c)
            out.append(c)
    return out


def _build_explanation_de_from_codes(codes: list[str]) -> str:
    """
    يبني جملة ألمانية مختصرة للأكواد الموجودة باستخدام جدول Allergen.
    مثال: ['A','G','K'] -> "Enthält Glutenhaltiges Getreide, Milch (einschl. Laktose) und Sesam."
    يعيد نصًا فارغًا عند عدم توفر ما يكفي من البيانات.
    """
    if not codes:
        return ""
    labels = list(
        Allergen.objects.filter(code__in=codes)
        .order_by("code")
        .values_list("label_de", flat=True)
    )
    labels = [str(x).strip() for x in labels if str(x).strip()]
    if not labels:
        return ""
    if len(labels) == 1:
        body = labels[0]
    elif len(labels) == 2:
        body = f"{labels[0]} und {labels[1]}"
    else:
        body = ", ".join(labels[:-1]) + f" und {labels[-1]}"
    return f"Enthält {body}."


# ----------------------------- Profile -----------------------------
class ProfileSerializer(serializers.ModelSerializer):
    # حقول للقراءة من User
    username = serializers.CharField(source='user.username', read_only=True)
    email = serializers.EmailField(source='user.email', read_only=True)
    first_name = serializers.CharField(source='user.first_name', required=False, allow_blank=True)
    last_name  = serializers.CharField(source='user.last_name',  required=False, allow_blank=True)

    # رابط جاهز للصورة
    avatar_url = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model  = Profile
        fields = [
            "id", "username", "email",
            "first_name", "last_name",
            "avatar_url", "avatar",
        ]
        extra_kwargs = {
            "avatar": {"required": False, "allow_null": True},
        }

    def get_avatar_url(self, obj):
        if not obj.avatar:
            return None
        request = self.context.get("request")
        url = obj.avatar.url
        return request.build_absolute_uri(url) if request else url

    # ✅ تنظيف/تحقق الصورة (avatar)
    def validate_avatar(self, file):
        if not file:
            return file
        try:
            return validate_and_clean_image(file)
        except Exception as e:
            raise serializers.ValidationError(str(e))

    def _clean_images_in_data(self, validated_data):
        avatar = validated_data.get("avatar")
        def _is_cleaned(f):
            try:
                if getattr(f, "_cleaned_image", False):
                    return True
                inner = getattr(f, "file", None)
                return getattr(inner, "_cleaned_image", False)
            except Exception:
                return False
        if avatar and not _is_cleaned(avatar):
            try:
                validated_data["avatar"] = validate_and_clean_image(avatar)
            except Exception as e:
                raise serializers.ValidationError({"avatar": str(e)})
        return validated_data

    def create(self, validated_data):
        validated_data = self._clean_images_in_data(validated_data)
        return super().create(validated_data)

    def update(self, instance, validated_data):
        validated_data = self._clean_images_in_data(validated_data)
        return super().update(instance, validated_data)


# ===================== Auth =====================
User = get_user_model()

class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)
    first_name = serializers.CharField(required=False, allow_blank=True)
    last_name = serializers.CharField(required=False, allow_blank=True)

    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'role', 'password',
            'first_name', 'last_name',
        ]
        extra_kwargs = {
            # role is set by the view (perform_create); ignore client attempts
            'role': {'required': False},
        }

    def validate_email(self, value):
        e = (value or '').strip()
        if not e:
            return e
        # Enforce uniqueness case-insensitively (DB doesn’t enforce on AbstractUser)
        UserModel = get_user_model()
        if UserModel.objects.filter(email__iexact=e).exists():
            raise serializers.ValidationError('Email already in use')
        return e

    def create(self, validated_data):
        password = validated_data.pop('password')
        try:
            dummy_user = User(**validated_data)
            validate_password(password, user=dummy_user)
        except DjangoValidationError as e:
            raise serializers.ValidationError({'password': list(e.messages)})

        user = User(**validated_data)
        user.set_password(password)
        user.save()
        return user


class UserSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=False)
    is_active = serializers.BooleanField(required=False)

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'role', 'first_name', 'last_name', 'password', 'is_active']

    def update(self, instance, validated_data):
        password = validated_data.pop('password', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        if password:
            try:
                validate_password(password, user=instance)
            except DjangoValidationError as e:
                raise serializers.ValidationError({'password': list(e.messages)})
            instance.set_password(password)
        instance.save()
        return instance


# ===================== Auth: username OR email login =====================
class EmailOrUsernameTokenObtainPairSerializer(TokenObtainPairSerializer):
    """
    Allow login with either username or email.
    - Always trim surrounding whitespace from the identifier (common UX issue).
    - If it contains '@', look up by email (case-insensitive) and map to username
      before delegating to the default validation.
    """
    def validate(self, attrs):
        identifier = attrs.get(self.username_field)
        if isinstance(identifier, str):
            identifier = identifier.strip()
            attrs[self.username_field] = identifier
            if "@" in identifier:
                UserModel = get_user_model()
                try:
                    u = UserModel.objects.get(email__iexact=identifier)
                    attrs[self.username_field] = getattr(u, UserModel.USERNAME_FIELD, u.username)
                except Exception:
                    pass
        return super().validate(attrs)


class EmailOrUsernameTokenObtainPairView(TokenObtainPairView):
    serializer_class = EmailOrUsernameTokenObtainPairSerializer
    # Scoped throttling: rates configured under REST_FRAMEWORK[DEFAULT_THROTTLE_RATES]['login']
    throttle_scope = "login"
    throttle_classes = [ScopedRateThrottle]  # ✅ تفعيل الثروتل
    throttle_scope = "login"                 # ✅ اسم السكوب في الإعدادات


# ===================== JWT: مطالبة role داخل التوكن =====================
class MyTokenObtainPairSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token['role'] = getattr(user, 'role', None)
        token['is_staff'] = bool(getattr(user, 'is_staff', False))
        token['is_superuser'] = bool(getattr(user, 'is_superuser', False))
        return token


class MyTokenObtainPairView(TokenObtainPairView):
    serializer_class = MyTokenObtainPairSerializer
    throttle_classes = [ScopedRateThrottle]  # ✅ تفعيل الثروتل
    throttle_scope = "login"                 # ✅ اسم السكوب في الإعدادات


# ===================== نماذج الحساسية/المكوّنات (CRUD اختياري) =====================
class AllergenSerializer(serializers.ModelSerializer):
    class Meta:
        model = Allergen
        fields = ["id", "code", "label_de", "label_en", "label_ar"]


class IngredientSerializer(serializers.ModelSerializer):
    # نخزن الحساسيّات على المكوّن كقائمة أكواد (A..R) باستخدام SlugRelatedField
    allergens = serializers.SlugRelatedField(
        many=True, slug_field="code", queryset=Allergen.objects.all(), required=False
    )

    class Meta:
        model = Ingredient
        fields = ["id", "name", "allergens", "additives", "synonyms"]

    def create(self, validated_data):
        allergens = validated_data.pop("allergens", [])
        ingredient = super().create(validated_data)
        if allergens:
            ingredient.allergens.set(allergens)
        return ingredient

    def update(self, instance, validated_data):
        allergens = validated_data.pop("allergens", None)
        ingredient = super().update(instance, validated_data)
        if allergens is not None:
            ingredient.allergens.set(allergens)
        return ingredient


class AdditiveLegendSerializer(serializers.ModelSerializer):
    class Meta:
        model = AdditiveLegend
        fields = ["id", "number", "label_de", "label_en", "label_ar"]


# ===================== قاموس القواعد (KeywordLexeme / NegationCue) =====================
class KeywordLexemeSerializer(serializers.ModelSerializer):
    """
    يتيح إدارة القاموس من الواجهة/الأدمِن:
    - allergens تُعرض/تُكتب كأكواد (A..R)
    - ingredient يُكتب كـ PK (اختياري)
    """
    allergens = serializers.SlugRelatedField(
        many=True, slug_field="code", queryset=Allergen.objects.all(), required=False
    )
    ingredient = serializers.PrimaryKeyRelatedField(
        queryset=Ingredient.objects.all(), required=False, allow_null=True
    )

    class Meta:
        model = KeywordLexeme
        fields = [
            "id", "owner", "lang",
            "term", "is_regex", "weight", "is_active",
            "ingredient", "allergens",
            "notes", "created_at", "updated_at",
        ]
        read_only_fields = ["created_at", "updated_at"]

    def create(self, validated_data):
        allergens = validated_data.pop("allergens", [])
        obj = super().create(validated_data)
        if allergens:
            obj.allergens.set(allergens)
        return obj

    def update(self, instance, validated_data):
        allergens = validated_data.pop("allergens", None)
        obj = super().update(instance, validated_data)
        if allergens is not None:
            obj.allergens.set(allergens)
        return obj


class NegationCueSerializer(serializers.ModelSerializer):
    class Meta:
        model = NegationCue
        fields = [
            "id", "owner", "lang",
            "cue", "is_regex", "window_before", "window_after",
            "is_active", "notes", "created_at", "updated_at",
        ]
        read_only_fields = ["created_at", "updated_at"]


# ===================== سجلات تتبّع الأكواد لكل طبق =====================
class DishAllergenSerializer(serializers.ModelSerializer):
    """
    سجل تفصيلي لكل كود حساسية على طبق معيّن.
    - allergen_code: كتابة/قراءة عبر كود الحساسية (A..N)
    - created_by: قراءة فقط (يُملأ تلقائيًا في الـView عند اللزوم)
    """
    allergen_code = serializers.SlugRelatedField(
        source="allergen",
        slug_field="code",
        queryset=Allergen.objects.all()
    )
    created_by = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model = DishAllergen
        fields = [
            "id", "dish", "allergen_code",
            "source", "confidence", "rationale",
            "is_confirmed",
            "created_by", "created_at",
        ]
        read_only_fields = ["created_at", "created_by"]


# ===================== القوائم/الأقسام/الأطباق (الخاصة) =====================
class DishPriceSerializer(serializers.ModelSerializer):
    class Meta:
        model = DishPrice
        fields = ["id", "label", "price", "is_default", "sort_order"]


class DishSerializer(serializers.ModelSerializer):
    """
    CRUD للطبق (داخلي للمالك/الأدمن).
    """
    image = AbsoluteImageURLField(required=False, allow_null=True)
    prices = DishPriceSerializer(many=True, required=False)
    price = serializers.SerializerMethodField(read_only=True)           # legacy fallback للسعر
    image_url = serializers.SerializerMethodField(read_only=True)       # ← الصورة المحسومة

    # ---- نظام الحساسيّات الجديد ----
    ingredients = serializers.PrimaryKeyRelatedField(
        many=True, queryset=Ingredient.objects.all(), required=False
    )

    generated_codes = serializers.CharField(required=False, allow_blank=True)
    has_manual_codes = serializers.BooleanField(required=False)
    manual_codes = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    extra_allergens = serializers.ListField(
        child=serializers.CharField(), required=False
    )
    extra_additives = serializers.ListField(
        child=serializers.IntegerField(), required=False
    )
    display_codes = serializers.CharField(read_only=True)

    # ✅ الشرح الألماني للأكواد المعروضة
    allergen_explanation_de = serializers.SerializerMethodField(read_only=True)

    # ✅ سجلات التتبّع التفصيلية
    allergen_rows = DishAllergenSerializer(many=True, read_only=True)

    class Meta:
        model = Dish
        fields = [
            "id", "name", "description",
            "price", "prices",
            "image", "image_url",
            # الحقول القديمة:
            "allergy_info", "section",
            # النظام الجديد:
            "ingredients",
            "generated_codes", "has_manual_codes", "manual_codes",
            "extra_allergens", "extra_additives",
            "display_codes",
            # مشتقات:
            "allergen_explanation_de",
            # جديد:
            "allergen_rows",
        ]
        read_only_fields = ["image_url", "display_codes", "allergen_explanation_de", "allergen_rows"]

    # -------------------- تقييد المالك --------------------
    def validate(self, attrs):
        request = self.context.get("request")
        section = attrs.get("section") or getattr(self.instance, "section", None)
        if request and section:
            from core.utils.auth import is_admin
            if not (is_admin(request.user) or section.menu.user_id == request.user.id):
                raise serializers.ValidationError({"section": "You cannot use another user's section."})
        return attrs

    # ---------- حقول مشتقة ----------
    def get_image_url(self, obj):
        return _resolve_dish_image_url(obj, self.context.get('request'))

    def get_price(self, obj):
        val = obj.default_price_value()
        return str(val) if val is not None else (str(obj.price) if obj.price else None)

    def get_allergen_explanation_de(self, obj):
        """
        يبني جملة ألمانية جاهزة للاستخدام في الواجهة.
        يعتمد أولًا على display_codes (الموحّد)،
        ويسقط إلى الحقول القديمة/الوسيطة عند الحاجة.
        """
        display = (getattr(obj, "display_codes", "") or "").strip()
        if not display:
            display = (getattr(obj, "manual_codes", "") or "").strip() or (getattr(obj, "generated_codes", "") or "").strip()
        letters = _extract_letter_codes_from_display(display)
        return _build_explanation_de_from_codes(letters)

    # ---------- تنظيف/تحقق الصورة (image) ----------
    def validate_image(self, file):
        if not file:
            return file
        try:
            return validate_and_clean_image(file)
        except Exception as e:
            raise serializers.ValidationError(str(e))

    def _clean_images_in_data(self, validated_data):
        img = validated_data.get("image")
        def _is_cleaned(f):
            try:
                if getattr(f, "_cleaned_image", False):
                    return True
                inner = getattr(f, "file", None)
                return getattr(inner, "_cleaned_image", False)
            except Exception:
                return False
        if img and not _is_cleaned(img):
            try:
                validated_data["image"] = validate_and_clean_image(img)
            except Exception as e:
                raise serializers.ValidationError({"image": str(e)})
        return validated_data

    # ---------- عمليات الإنشاء/التعديل ----------
    def create(self, validated_data):
        validated_data = self._clean_images_in_data(validated_data)
        prices_data = validated_data.pop("prices", None)
        ingredients = validated_data.pop("ingredients", None)
        dish = super().create(validated_data)

        if ingredients is not None:
            dish.ingredients.set(ingredients)

        if prices_data:
            self._upsert_prices(dish, prices_data)

        return dish

    def update(self, instance, validated_data):
        validated_data = self._clean_images_in_data(validated_data)
        prices_data = validated_data.pop("prices", None)
        ingredients = validated_data.pop("ingredients", None)

        dish = super().update(instance, validated_data)

        if ingredients is not None:
            dish.ingredients.set(ingredients)

        if prices_data is not None:
            self._upsert_prices(dish, prices_data)

        return dish

    def _upsert_prices(self, dish, prices_data):
        for item in prices_data:
            item_id = item.get("id")
            if item_id:
                dp = DishPrice.objects.filter(id=item_id, dish=dish).first()
                if not dp:
                    continue
                for field in ["label", "price", "is_default", "sort_order"]:
                    if field in item:
                        setattr(dp, field, item[field])
                dp.full_clean()
                dp.save()
            else:
                dp = DishPrice(
                    dish=dish,
                    **{k: v for k, v in item.items() if k in ["label", "price", "is_default", "sort_order"]}
                )
                dp.full_clean()
                dp.save()


class SectionSerializer(serializers.ModelSerializer):
    # ✅ هنا نُحمّل الأطباق كـ Nested Serializer
    dishes = DishSerializer(many=True, read_only=True)

    class Meta:
        model = Section
        fields = ['id', 'name', 'menu', 'dishes']

    # -------------------- تقييد المالك --------------------
    def validate(self, attrs):
        request = self.context.get("request")
        menu = attrs.get("menu") or getattr(self.instance, "menu", None)
        if request and menu:
            from core.utils.auth import is_admin
            if not (is_admin(request.user) or menu.user_id == request.user.id):
                raise serializers.ValidationError({"menu": "You cannot use another user's menu."})
        return attrs

    def create(self, validated_data):
        # Ensure section.user is set to the owning menu's user (fallback to request.user)
        menu = validated_data.get("menu")
        req = self.context.get("request")
        user = getattr(menu, "user", None) or (getattr(req, "user", None) if req else None)
        if user is not None:
            validated_data.setdefault("user", user)
        return super().create(validated_data)


class MenuSerializer(serializers.ModelSerializer):
    sections = SectionSerializer(many=True, read_only=True)
    public_slug = serializers.CharField(read_only=True)

    class Meta:
        model = Menu
        fields = ['id', 'name', 'is_published', 'public_slug', 'sections']


# ===================== MenuDisplaySettings =====================
class MenuDisplaySettingsSerializer(serializers.ModelSerializer):
    logo = AbsoluteImageURLField(required=False, allow_null=True)
    hero_image = AbsoluteImageURLField(required=False, allow_null=True)

    class Meta:
        model = MenuDisplaySettings
        fields = ['display_name', 'phone', 'address', 'hours', 'logo', 'hero_image', 'theme']

    # ✅ تنظيف/تحقق الصور (logo, hero_image)
    def validate_logo(self, file):
        if not file:
            return file
        try:
            return validate_and_clean_image(file)
        except Exception as e:
            raise serializers.ValidationError(str(e))

    def validate_hero_image(self, file):
        if not file:
            return file
        try:
            return validate_and_clean_image(file)
        except Exception as e:
            raise serializers.ValidationError(str(e))

    def _clean_images_in_data(self, validated_data):
        def _is_cleaned(f):
            try:
                if getattr(f, "_cleaned_image", False):
                    return True
                inner = getattr(f, "file", None)
                return getattr(inner, "_cleaned_image", False)
            except Exception:
                return False
        logo = validated_data.get("logo")
        if logo and not _is_cleaned(logo):
            try:
                validated_data["logo"] = validate_and_clean_image(logo)
            except Exception as e:
                raise serializers.ValidationError({"logo": str(e)})
        hero = validated_data.get("hero_image")
        if hero and not _is_cleaned(hero):
            try:
                validated_data["hero_image"] = validate_and_clean_image(hero)
            except Exception as e:
                raise serializers.ValidationError({"hero_image": str(e)})
        return validated_data

    def create(self, validated_data):
        validated_data = self._clean_images_in_data(validated_data)
        return super().create(validated_data)

    def update(self, instance, validated_data):
        validated_data = self._clean_images_in_data(validated_data)
        for k in ['display_name', 'phone', 'address', 'hours', 'theme']:
            if k in validated_data:
                setattr(instance, k, validated_data[k])
        if 'logo' in validated_data:
            instance.logo = validated_data['logo']
        if 'hero_image' in validated_data:
            instance.hero_image = validated_data['hero_image']
        instance.save()
        return instance


# ===================== النسخة العامة لعرض القائمة (للزوّار) =====================
class PublicDishSerializer(serializers.ModelSerializer):
    image = AbsoluteImageURLField(read_only=True)
    image_url = serializers.SerializerMethodField(read_only=True)  # ← الصورة المحسومة
    prices = DishPriceSerializer(many=True, read_only=True)
    price = serializers.SerializerMethodField(read_only=True)
    display_codes = serializers.CharField(read_only=True)
    # ✅ الشرح الألماني للأكواد المعروضة (للعرض العام أيضًا)
    allergen_explanation_de = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Dish
        fields = [
            "id", "name", "description",
            "price", "prices",
            "image", "image_url",
            # legacy:
            "allergy_info",
            # الجديد:
            "display_codes",
            "allergen_explanation_de",
        ]
        read_only_fields = ["image", "image_url", "prices", "display_codes", "allergen_explanation_de"]

    def get_image_url(self, obj):
        return _resolve_dish_image_url(obj, self.context.get('request'))

    def get_price(self, obj):
        val = obj.default_price_value()
        return str(val) if val is not None else (str(obj.price) if obj.price else None)

    def get_allergen_explanation_de(self, obj):
        display = (getattr(obj, "display_codes", "") or "").strip()
        if not display:
            display = (getattr(obj, "manual_codes", "") or "").strip() or (getattr(obj, "generated_codes", "") or "").strip()
        letters = _extract_letter_codes_from_display(display)
        return _build_explanation_de_from_codes(letters)


class PublicSectionSerializer(serializers.ModelSerializer):
    # ✅ كذلك هنا Nested وليس Method Field
    dishes = PublicDishSerializer(many=True, read_only=True)

    class Meta:
        model = Section
        fields = ['id', 'name', 'dishes']


class PublicMenuSerializer(serializers.ModelSerializer):
    sections = PublicSectionSerializer(many=True, read_only=True)
    display_settings = MenuDisplaySettingsSerializer(read_only=True)

    class Meta:
        model = Menu
        fields = ['id', 'name', 'public_slug', 'is_published', 'sections', 'display_settings']


# ===================== Aggregated menu (owner/admin) =====================
class MenuAggregateDishSerializer(serializers.ModelSerializer):
    """
    خفيف للوحة التحكم: حقول أساسية فقط لتقليل حجم JSON.
    """
    image = AbsoluteImageURLField(read_only=True)
    image_url = serializers.SerializerMethodField(read_only=True)
    prices = DishPriceSerializer(many=True, read_only=True)

    class Meta:
        model = Dish
        fields = [
            'id', 'name', 'description',
            'price', 'prices',
            'image', 'image_url',
            'allergy_info',
        ]
        read_only_fields = ['image', 'image_url', 'prices']

    def get_image_url(self, obj):
        return _resolve_dish_image_url(obj, self.context.get('request'))


class MenuAggregateSectionSerializer(serializers.ModelSerializer):
    dishes = MenuAggregateDishSerializer(many=True, read_only=True)

    class Meta:
        model = Section
        fields = ['id', 'name', 'dishes']


# ===================== LLM Ingredient Suggestions (Fallback) =====================
class IngredientSuggestionSerializer(serializers.ModelSerializer):
    """
    تُستخدَم لقراءة/عرض الاقتراحات الناتجة من الـLLM بعد فشل القواعد.
    - candidates: قائمة عناصر {term, score, mapped_ingredient_id?}
    - لا نعيد أكواد الحساسية هنا؛ التحويل يتم لاحقًا عبر Ingredients ⇢ Allergens.
    """
    reviewed_by = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model = IngredientSuggestion
        fields = [
            "id", "dish", "lang", "text_snapshot",
            "candidates",
            "model_name", "prompt_hash",
            "status", "notes",
            "reviewed_by", "reviewed_at", "applied_at",
            "created_at", "updated_at",
        ]
        read_only_fields = ["created_at", "updated_at", "reviewed_by", "reviewed_at", "applied_at"]
