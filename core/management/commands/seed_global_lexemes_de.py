# core/management/commands/seed_de_lexicon.py
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.contrib.auth import get_user_model

from core.models import Ingredient, Allergen
from core.dictionary_models import KeywordLexeme

# term, ingredient_name (or None), allergen_letters e.g. "A,R" or ""
GERMAN_KEYWORDS = [
    # Gluten / حبوب
    ("weizen", "Weizenmehl", "A"),
    ("weizenmehl", "Weizenmehl", "A"),
    ("dinkel", "Dinkel", "A"),
    ("roggen", "Roggen", "A"),
    ("gerste", "Gerste", "A"),
    ("hafer", "Hafer", "A"),
    ("grieß", "Grieß", "A"),
    ("spaghetti", "Spaghetti", "A"),
    ("brot", "Brot", "A"),
    ("brötchen", "Brötchen", "A"),
    ("fladenbrot", "Fladenbrot", "A"),

    # Eggs
    ("ei", "Ei", "C"),
    ("eier", "Ei", "C"),
    ("eiweiß", "Eiweiß", "C"),
    ("dotter", "Ei", "C"),

    # Milk
    ("milch", "Milch", "G"),
    ("käse", "Käse", "G"),
    ("butter", "Butter", "G"),
    ("joghurt", "Joghurt", "G"),
    ("pecorino", "Pecorino", "G"),
    ("parmesan", "Parmesan", "G"),
    ("sahne", "Sahne", "G"),

    # Nuts
    ("walnuss", "Walnüsse", "H"),
    ("walnüsse", "Walnüsse", "H"),
    ("haselnuss", "Haselnuss", "H"),
    ("mandel", "Mandeln", "H"),
    ("cashew", "Cashew", "H"),
    ("pistazie", "Pistazien", "H"),

    # Sesame
    ("sesam", "Sesam", "N"),
    ("tahini", "Sesampaste/Tahini", "N"),
    ("sesampaste", "Sesampaste/Tahini", "N"),

    # Soy
    ("soja", "Soja", "F"),
    ("tofu", "Tofu", "F"),
    ("edamame", "Edamame", "F"),

    # Fish
    ("fisch", "Fisch", "D"),
    ("lachs", "Lachs", "D"),
    ("thunfisch", "Thunfisch", "D"),

    # أمثلة عامة بلا كود مباشر (تفيد للـ LLM/المراجعة)
    ("hackfleisch", "Hackfleisch", ""),
    ("knoblauch", "Knoblauch", ""),
    ("olivenöl", "Olivenöl", ""),
]

def _pick_owner(explicit_id=None, explicit_username=None):
    """اختر مالكًا افتراضيًا لجدول Ingredient (لأن owner NOT NULL)."""
    User = get_user_model()
    if explicit_id:
        u = User.objects.filter(id=explicit_id).first()
        if not u:
            raise CommandError(f"لا يوجد مستخدم id={explicit_id}")
        return u
    if explicit_username:
        u = User.objects.filter(username=explicit_username).first()
        if not u:
            raise CommandError(f"لا يوجد مستخدم username={explicit_username}")
        return u
    u = (User.objects.filter(is_superuser=True).first()
         or User.objects.filter(is_staff=True).first()
         or User.objects.first())
    if not u:
        raise CommandError("لا يوجد أي مستخدم في النظام لاستخدامه كمالك افتراضي للمكوّنات.")
    return u

def _ensure_ingredient(name: str, owner):
    obj = Ingredient.objects.filter(name__iexact=name, owner=owner).first()
    if obj:
        return obj, False
    obj = Ingredient(name=name, owner=owner)
    obj.save()
    return obj, True

def _ensure_lexeme(term: str, lang: str, ingredient, allergen_codes: str):
    """
    ننشئ Lexeme عامة: owner=None (لتكون متاحة للجميع).
    """
    lx, created = KeywordLexeme.objects.get_or_create(
        owner=None,
        lang=lang,
        term=term,
        defaults={"is_regex": False, "weight": 1.0, "is_active": True, "ingredient": ingredient},
    )
    # حافظ على الربط بالمكوّن إن اختلف
    ing_id = ingredient.id if ingredient else None
    if lx.ingredient_id != ing_id:
        lx.ingredient = ingredient
        lx.save(update_fields=["ingredient"])

    # اربط أكواد الحساسية على الـLexeme نفسها (ManyToMany)
    if allergen_codes:
        letters = [c.strip().upper() for c in allergen_codes.split(",") if c.strip()]
        if letters:
            allergens = list(Allergen.objects.filter(letter_code__in=letters))
            lx.allergens.set(allergens)
    return lx, created

class Command(BaseCommand):
    help = "زرع قاموس ألماني عام (Lexemes owner=None). ينشئ Ingredients بمالك افتراضي لأن owner في Ingredient غير قابل لـ NULL."

    def add_arguments(self, parser):
        parser.add_argument("--lang", default="de")
        parser.add_argument("--dry", action="store_true")
        parser.add_argument("--only", default="", help="فلترة بالاحتواء على term أو اسم المكوّن")
        parser.add_argument("--ingredient-owner-id", type=int, default=None)
        parser.add_argument("--ingredient-owner-username", default=None)

    @transaction.atomic
    def handle(self, *args, **opts):
        lang = (opts.get("lang") or "de").lower()
        dry = bool(opts.get("dry"))
        only = (opts.get("only") or "").strip().lower()
        owner = _pick_owner(opts.get("ingredient_owner_id"), opts.get("ingredient_owner_username"))

        dataset = GERMAN_KEYWORDS
        if only:
            dataset = [t for t in dataset if only in t[0].lower() or only in (t[1] or "").lower()]

        if dry:
            self.stdout.write(self.style.WARNING(
                f"[DRY] سيُزرع {len(dataset)} lexemes عامة (owner=None), lang={lang}, "
                f"وسيتم إنشاء/تحديث Ingredients بمالك user_id={owner.id} ({owner.username})"
            ))
            return

        created_ing = created_lx = updated_lx = 0
        for term, ing_name, codes in dataset:
            ingredient = None
            if ing_name:
                ingredient, was_new = _ensure_ingredient(ing_name, owner)
                if was_new:
                    created_ing += 1
            lx, is_new = _ensure_lexeme(term, lang, ingredient, codes)
            if is_new:
                created_lx += 1
            else:
                updated_lx += 1

        self.stdout.write(self.style.SUCCESS(
            f"تم: ingredients+{created_ing}, lexemes+{created_lx}, updated_lx={updated_lx}, "
            f"lang={lang}, lexeme_owner=None, ingredient_owner={owner.id}"
        ))
