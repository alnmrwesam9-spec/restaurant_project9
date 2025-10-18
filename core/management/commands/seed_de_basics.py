# core/management/commands/seed_de_basics.py
from __future__ import annotations

from typing import Iterable, List, Optional, Tuple
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.contrib.auth import get_user_model
from django.conf import settings

from core.models import Allergen, Ingredient
from core.dictionary_models import KeywordLexeme, NegationCue, normalize_text

User = get_user_model()


def upsert_allergen(code: str, label_de: str, label_en: str = "", label_ar: str = "") -> Allergen:
    code = code.strip().upper()
    obj, _ = Allergen.objects.update_or_create(
        code=code,
        defaults={
            "label_de": label_de.strip(),
            "label_en": (label_en or "").strip(),
            "label_ar": (label_ar or "").strip(),
        },
    )
    return obj


def _resolve_owner(explicit_owner_id: Optional[int]) -> User:
    """
    نضمن وجود مالك فعلي للـIngredients:
      1) --owner-id إن تم تمريره
      2) settings.GLOBAL_LEXICON_OWNER_ID
      3) أول superuser
      4) أول staff
    وإلا نرمي CommandError برسالة واضحة.
    """
    # 1) explicit from CLI
    if explicit_owner_id is not None:
        try:
            return User.objects.get(pk=int(explicit_owner_id))
        except Exception:
            raise CommandError(f"--owner-id={explicit_owner_id} لا يشير إلى مستخدم موجود.")

    # 2) from settings
    owner_id = getattr(settings, "GLOBAL_LEXICON_OWNER_ID", None)
    if owner_id:
        try:
            return User.objects.get(pk=int(owner_id))
        except Exception:
            pass

    # 3) a superuser
    su = User.objects.filter(is_superuser=True).order_by("id").first()
    if su:
        return su

    # 4) any staff
    st = User.objects.filter(is_staff=True).order_by("id").first()
    if st:
        return st

    raise CommandError(
        "لا يوجد مستخدم مناسب كمالك للـIngredients. "
        "أنشئ مستخدم (أدمن أو ستاف) أو مرّر --owner-id=<USER_ID>."
    )


def upsert_negation_cues() -> int:
    data = [
        ("de", "ohne", False, 3, 2),
        ("de", "kein", False, 3, 2),
        ("de", "keine", False, 3, 2),
        ("de", "keinen", False, 3, 2),
        ("de", r"{t}frei", True, 3, 2),
        ("en", "without", False, 3, 2),
        ("en", "no", False, 3, 2),
        ("en", r"{t}-free", True, 3, 2),
        ("ar", "بدون", False, 3, 2),
        ("ar", "من غير", False, 3, 2),
        ("ar", "خال من", False, 3, 2),
    ]
    count = 0
    for lang, cue, is_regex, wb, wa in data:
        _, created = NegationCue.objects.update_or_create(
            owner=None,
            lang=lang,
            cue=cue,
            is_regex=is_regex,
            defaults={
                "is_active": True,
                "window_before": wb,
                "window_after": wa,
                "notes": "seed",
            },
        )
        if created:
            count += 1
    return count


def upsert_ingredient(owner: User, name: str, allergen_codes: Iterable[str]) -> Ingredient:
    name = name.strip()
    ing, _ = Ingredient.objects.get_or_create(owner=owner, name=name)
    codes = sorted({c.strip().upper() for c in allergen_codes if c})
    alls = list(Allergen.objects.filter(code__in=codes))
    ing.allergens.set(alls)
    return ing


def upsert_lexeme(owner: Optional[User], lang: str, term: str,
                  allergen_codes: Iterable[str] = (),
                  ingredient: Optional[Ingredient] = None,
                  is_regex: bool = False,
                  weight: float = 1.0,
                  priority: int = 0,
                  notes: str = "seed") -> KeywordLexeme:
    lang = (lang or "de").strip().lower()
    norm = normalize_text(term)
    obj, _ = KeywordLexeme.objects.get_or_create(
        owner=owner,
        lang=lang,
        normalized_term=norm,
        is_regex=is_regex,
        defaults={
            "term": term,
            "is_active": True,
            "weight": weight,
            "priority": priority,
            "notes": notes,
        },
    )
    changed = False
    if obj.term != term:
        obj.term = term
        changed = True
    if not obj.is_active:
        obj.is_active = True
        changed = True
    if obj.weight != weight:
        obj.weight = weight
        changed = True
    if obj.priority != priority:
        obj.priority = priority
        changed = True
    if changed:
        obj.save(update_fields=["term", "is_active", "weight", "priority"])

    if ingredient and obj.ingredient_id != ingredient.id:
        obj.ingredient = ingredient
        obj.save(update_fields=["ingredient"])

    codes = sorted({c.strip().upper() for c in allergen_codes if c})
    if codes:
        alls = list(Allergen.objects.filter(code__in=codes))
        obj.allergens.set(alls)

    return obj


class Command(BaseCommand):
    help = "Seed German basics: Allergens A..N, core Ingredients, Lexemes, and Negation cues (idempotent)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--owner-id",
            type=int,
            help="ID المستخدم الذي سيُسجّل كمالك للـIngredients المزروعة.",
        )

    @transaction.atomic
    def handle(self, *args, **options):
        owner = _resolve_owner(options.get("owner_id"))

        # 1) Allergens
        allergen_map = [
            ("A", "Glutenhaltiges Getreide (z. B. Weizen, Roggen, Gerste, Hafer, Dinkel)"),
            ("B", "Krebstiere"),
            ("C", "Eier"),
            ("D", "Fisch"),
            ("E", "Erdnüsse"),
            ("F", "Sojabohnen"),
            ("G", "Milch (einschl. Laktose)"),
            ("H", "Schalenfrüchte/Nüsse (z. B. Mandeln, Haselnüsse, Walnüsse, Cashew ...)"),
            ("I", "Sellerie"),
            ("J", "Senf"),
            ("K", "Sesamsamen"),
            ("L", "Schwefeldioxid und Sulfite"),
            ("M", "Lupinen"),
            ("N", "Weichtiere/Mollusken"),
        ]
        for code, label_de in allergen_map:
            upsert_allergen(code, label_de)

        # 2) Negation cues
        added_neg = upsert_negation_cues()

        # 3) Ingredients + Lexemes
        ING: List[Tuple[str, List[str], List[str]]] = [
            ("Weizenmehl", ["A"], ["weizen", "weizenmehl", "weizenbrot", "weizenpasta", "dinkel", "roggen", "gerste", "gerstenmalz", "hafer", "spaghetti", "pasta"]),
            ("Milch", ["G"], ["milch", "kuhmilch", "käse", "kaese", "cheese", "mozzarella", "parmesan", "pecorino", "joghurt", "butter", "sahne"]),
            ("Ei", ["C"], ["ei", "eier", "eigelb", "eiklar", "eiprodukt", "mayonnaise"]),
            ("Sesam", ["K"], ["sesam", "sesamsamen", "tahini"]),
            ("Cashew", ["H"], ["cashew", "cashewkerne", "kaschunuss", "cashewnuss"]),
            ("Mandeln", ["H"], ["mandel", "mandeln"]),
            ("Haselnuss", ["H"], ["haselnuss", "haselnüsse"]),
            ("Walnuss", ["H"], ["walnuss", "walnüsse"]),
            ("Pistazie", ["H"], ["pistazie", "pistazien"]),
            ("Soja", ["F"], ["soja", "tofu", "sojasauce"]),
            ("Erdnuss", ["E"], ["erdnuss", "erdnüsse", "peanut", "peanuts", "peanutbutter"]),
            ("Senf", ["J"], ["senf", "dijon"]),
            ("Sellerie", ["I"], ["sellerie"]),
            ("Fisch", ["D"], ["fisch", "lachs", "thunfisch"]),
            ("Krebstiere", ["B"], ["garnelen", "krabben", "hummer", "shrimp", "shrimps"]),
            ("Mollusken", ["N"], ["muschel", "muscheln", "tintenfisch", "sepia", "kalmar", "kalmare"]),
        ]

        REGEX: List[Tuple[List[str], List[str], Optional[str]]] = [
            (["A"], [r"\bgerstenmalz\b", r"\b(weizen|dinkel|roggen|gerste|hafer)\w*\b"], "Weizenmehl"),
            (["C"], [r"\b(ei(er)?|eigelb|eiklar)\b"], "Ei"),
        ]

        created_ing = 0
        created_lex = 0

        for ing_name, codes, terms in ING:
            ing = upsert_ingredient(owner, ing_name, codes)
            created_ing += 1
            for t in terms:
                upsert_lexeme(None, "de", t, allergen_codes=codes, ingredient=ing, is_regex=False, weight=1.0, priority=0)
                created_lex += 1

        for codes, patterns, ing_name in REGEX:
            ing = Ingredient.objects.filter(owner=owner, name__iexact=ing_name).first() if ing_name else None
            for pat in patterns:
                upsert_lexeme(None, "de", pat, allergen_codes=codes, ingredient=ing, is_regex=True, weight=1.0, priority=1)
                created_lex += 1

        self.stdout.write(self.style.SUCCESS(
            f"Seed completed: Allergens={len(allergen_map)}, Negation(+{added_neg}), Ingredients={created_ing}, Lexemes≈{created_lex}, owner={owner.id}"
        ))
