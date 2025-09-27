# core/admin.py
# ============================================================
# Django Admin registrations for core app (menus + dictionary)
# ============================================================

from __future__ import annotations

from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.utils.translation import gettext_lazy as _

from .models import (
    User, Menu, Section, Dish,
    DishPrice, Profile,
    Allergen, Ingredient, AdditiveLegend,
    MenuDisplaySettings,
)

# ✅ نماذج القاموس
from .dictionary_models import KeywordLexeme, NegationCue, normalize_text


# ===================== User =====================

@admin.register(User)
class CustomUserAdmin(BaseUserAdmin):
    list_display = ("username", "email", "role", "is_staff", "is_active")
    fieldsets = BaseUserAdmin.fieldsets + (
        (_("System roles"), {"fields": ("role",)}),
    )
    add_fieldsets = BaseUserAdmin.add_fieldsets + (
        (_("System roles"), {"fields": ("role",)}),
    )


# ===================== Menu / Section / Dish =====================

@admin.register(Menu)
class MenuAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "user", "is_published", "public_slug")
    search_fields = ("name", "user__username", "user__email")
    list_filter = ("is_published",)
    list_select_related = ("user",)
    ordering = ("id",)


@admin.register(Section)
class SectionAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "menu", "user")
    search_fields = ("name", "menu__name", "user__username", "user__email")
    list_filter = ("menu", "user")
    list_select_related = ("menu", "user")
    ordering = ("menu_id", "id")


class DishPriceInline(admin.TabularInline):
    model = DishPrice
    extra = 1


@admin.action(description=_("Enable manual codes (has_manual_codes=True)"))
def action_enable_manual_codes(modeladmin, request, queryset):
    queryset.update(has_manual_codes=True)


@admin.action(description=_("Disable manual codes (has_manual_codes=False)"))
def action_disable_manual_codes(modeladmin, request, queryset):
    queryset.update(has_manual_codes=False)


@admin.action(description=_("Copy generated → manual codes (and enable manual)"))
def action_copy_generated_to_manual(modeladmin, request, queryset):
    changed = 0
    for d in queryset.only("id", "generated_codes", "has_manual_codes", "manual_codes"):
        gen = (d.generated_codes or "").strip()
        d.manual_codes = gen or None
        d.has_manual_codes = True
        d.save(update_fields=["manual_codes", "has_manual_codes"])
        changed += 1
    if changed:
        modeladmin.message_user(request, _(f"Copied for {changed} dish(es)."))


@admin.action(description=_("Clear manual codes (and disable manual)"))
def action_clear_manual_codes(modeladmin, request, queryset):
    changed = 0
    for d in queryset.only("id", "has_manual_codes", "manual_codes"):
        d.manual_codes = None
        d.has_manual_codes = False
        d.save(update_fields=["manual_codes", "has_manual_codes"])
        changed += 1
    if changed:
        modeladmin.message_user(request, _(f"Cleared for {changed} dish(es)."))


@admin.register(Dish)
class DishAdmin(admin.ModelAdmin):
    list_display = (
        "id", "name", "section", "effective_price",
        "has_manual_codes", "display_codes", "codes_updated_at",
    )
    list_filter = ("has_manual_codes", "section__menu")
    search_fields = ("name", "description", "section__name", "section__menu__name")
    list_select_related = ("section", "section__menu", "section__menu__user")
    inlines = [DishPriceInline]
    ordering = ("section_id", "id")

    # إدارة المكوّنات بسهولة
    filter_horizontal = ("ingredients",)
    autocomplete_fields = ("section",)

    readonly_fields = ("display_codes", "codes_updated_at")

    actions = (
        action_enable_manual_codes,
        action_disable_manual_codes,
        action_copy_generated_to_manual,
        action_clear_manual_codes,
    )


@admin.register(DishPrice)
class DishPriceAdmin(admin.ModelAdmin):
    list_display = ("id", "dish", "label", "price", "is_default", "sort_order")
    search_fields = ("dish__name", "label")
    list_filter = ("is_default", "dish__section__menu")
    list_select_related = ("dish", "dish__section", "dish__section__menu")
    ordering = ("dish_id", "sort_order", "id")


@admin.register(Profile)
class ProfileAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "display_name")
    search_fields = ("display_name", "user__username", "user__email")
    list_select_related = ("user",)
    ordering = ("id",)


# ===================== Allergen / Ingredient / AdditiveLegend =====================

def _codes_str(qs):
    """Helper: 'A,B,C' من كائنات الحساسية."""
    return ",".join(sorted([c for c in qs.values_list("code", flat=True) if c])) if qs.exists() else ""


@admin.register(Allergen)
class AllergenAdmin(admin.ModelAdmin):
    list_display = ("code", "label_de", "label_en", "label_ar")
    search_fields = ("code", "label_de", "label_en", "label_ar")
    ordering = ("code",)


@admin.register(Ingredient)
class IngredientAdmin(admin.ModelAdmin):
    # 🔧 شِلنا created_at لأنه غير موجود بالموديل
    list_display = ("id", "name", "owner", "allergen_codes_list")
    search_fields = ("name", "owner__username", "owner__email")
    list_filter = ("owner",)
    list_select_related = ("owner",)
    filter_horizontal = ("allergens",)
    ordering = ("name", "id")

    @admin.display(description=_("Allergen codes"))
    def allergen_codes_list(self, obj: Ingredient) -> str:
        return _codes_str(obj.allergens.all())


@admin.register(AdditiveLegend)
class AdditiveLegendAdmin(admin.ModelAdmin):
    list_display = ("id", "owner", "number", "label_de", "label_en", "label_ar")
    search_fields = ("number", "label_de", "label_en", "label_ar", "owner__username")
    list_filter = ("owner",)
    list_select_related = ("owner",)
    ordering = ("number", "id")


@admin.register(MenuDisplaySettings)
class MenuDisplaySettingsAdmin(admin.ModelAdmin):
    list_display = ("id", "menu", "theme", "created_at", "updated_at")
    search_fields = ("menu__name", "theme")
    list_filter = ("theme",)
    list_select_related = ("menu",)
    ordering = ("id",)


# ===================== Dictionary: KeywordLexeme =====================

@admin.action(description=_("Activate selected lexemes"))
def activate_lexemes(modeladmin, request, queryset):
    queryset.update(is_active=True)


@admin.action(description=_("Deactivate selected lexemes"))
def deactivate_lexemes(modeladmin, request, queryset):
    queryset.update(is_active=False)


@admin.action(description=_("Normalize terms"))
def normalize_terms(modeladmin, request, queryset):
    """
    يعيد حساب normalized_term (دون تغيير term نفسه).
    مفيد عندما تُعدّل سياسة التطبيع أو تُستورد بيانات خام.
    """
    changed = 0
    for lx in queryset:
        norm = normalize_text(lx.term or "")
        if lx.normalized_term != norm:
            lx.normalized_term = norm
            lx.save(update_fields=["normalized_term"])
            changed += 1
    if changed:
        modeladmin.message_user(request, _(f"Normalized {changed} term(s)."))


@admin.register(KeywordLexeme)
class KeywordLexemeAdmin(admin.ModelAdmin):
    """
    إدارة عبارات القاموس التي تولّد أكواد الحساسية.
    يظهر كلا المصدرين:
      - الأكواد المرتبطة مباشرة بالـ lexeme
      - أكواد الـ ingredient إن وُجد
    كما يدعم حقلي priority و weight للترتيب.
    """
    list_display = (
        "id",
        "owner",
        "lang",
        "term",
        "normalized_term",
        "is_regex",
        "is_active",
        "priority",
        "weight",
        "ingredient",
        "lexeme_codes",
        "ingredient_codes",
        "updated_at",
    )
    list_filter = ("is_active", "is_regex", "lang", "owner")
    search_fields = (
        "term",
        "normalized_term",
        "ingredient__name",
        "owner__username",
        "owner__email",
        "allergens__code",
    )
    readonly_fields = ("normalized_term", "created_at", "updated_at")
    ordering = ("owner_id", "lang", "-priority", "-weight", "id")
    actions = (activate_lexemes, deactivate_lexemes, normalize_terms)
    autocomplete_fields = ("ingredient", "owner")
    filter_horizontal = ("allergens",)
    list_select_related = ("ingredient", "owner")

    fieldsets = (
        (None, {
            "fields": (
                ("owner", "lang", "is_active"),
                ("term", "normalized_term"),
                ("is_regex", "priority", "weight"),
            )
        }),
        (_("Relations"), {
            "fields": (
                "ingredient",
                "allergens",
            )
        }),
        (_("Notes & Meta"), {
            "fields": (
                "notes",
                ("created_at", "updated_at"),
            )
        }),
    )

    @admin.display(description=_("Lexeme allergens"))
    def lexeme_codes(self, obj: KeywordLexeme) -> str:
        return _codes_str(obj.allergens.all())

    @admin.display(description=_("Ingredient allergens"))
    def ingredient_codes(self, obj: KeywordLexeme) -> str:
        return _codes_str(obj.ingredient.allergens.all()) if obj.ingredient_id else ""


# ===================== Dictionary: NegationCue =====================

@admin.action(description=_("Activate selected negation cues"))
def activate_cues(modeladmin, request, queryset):
    queryset.update(is_active=True)


@admin.action(description=_("Deactivate selected negation cues"))
def deactivate_cues(modeladmin, request, queryset):
    queryset.update(is_active=False)


@admin.register(NegationCue)
class NegationCueAdmin(admin.ModelAdmin):
    """
    إدارة عبارات النفي (ohne/بدون/without...) لتعطيل المطابقات القريبة.
    """
    list_display = (
        "id",
        "owner",
        "lang",
        "cue",
        "normalized_cue",
        "is_regex",
        "window_before",
        "window_after",
        "is_active",
        "updated_at",
    )
    list_filter = ("is_active", "is_regex", "lang", "owner")
    search_fields = ("cue", "normalized_cue", "owner__username", "owner__email")
    readonly_fields = ("normalized_cue", "created_at", "updated_at")
    ordering = ("owner_id", "lang", "normalized_cue", "id")
    actions = (activate_cues, deactivate_cues)
    list_select_related = ("owner",)

    fieldsets = (
        (None, {
            "fields": (
                ("owner", "lang", "is_active"),
                ("cue", "normalized_cue"),
                ("is_regex", "window_before", "window_after"),
            )
        }),
        (_("Notes & Meta"), {
            "fields": (
                "notes",
                ("created_at", "updated_at"),
            )
        }),
    )
