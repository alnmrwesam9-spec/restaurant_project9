# core/services/allergen_rules.py
# -----------------------------------------------------------
# توليد أكواد الحساسيّات عبر القاموس المخزّن في قاعدة البيانات (rules first)
# يعتمد على:
#   - KeywordLexeme  (قاموس عبارات -> Allergens / Ingredient)
#   - Ingredient     (Allergens/Additives) الموجودة على الطبق أو عبر lexeme.ingredient
#   - حقول extra_allergens / extra_additives على الطبق
# يدعم نفي بسيط: "ohne <term>", "kein/keine/keinen <term>" + العربية/الإنجليزية و (<term>-frei)
# -----------------------------------------------------------

from __future__ import annotations
from dataclasses import dataclass
from typing import Iterable, List, Dict, Set, Tuple

import re
import unicodedata
from django.db import transaction
from django.db.models import Q, Case, When, Value, IntegerField
from django.utils import timezone
from django.conf import settings

from core.models import Dish, Ingredient, Allergen, DishAllergen  # ⬅️ جديد: كتابة سجلات تتبّع
from core.dictionary_models import KeywordLexeme  # النموذج الصحيح (dictionary_models.py)

# -----------------------
# تنسيق/تطبيع نص قوي
# -----------------------
_AR_DIACRITICS_RE = re.compile(r"[\u064B-\u0652]")
_NON_ALNUM_RE = re.compile(r"[^\w\s]", flags=re.UNICODE)

def normalize_text(s: str) -> str:
    """
    NFKD + إزالة accents، تبسيط الألمانية، إزالة التشكيل العربي،
    إزالة الرموز غير الألفانوميرية (مع الإبقاء على المسافات)، lowercase + دمج المسافات.
    """
    if not s:
        return ""
    x = unicodedata.normalize("NFKD", str(s))
    x = "".join(ch for ch in x if not unicodedata.combining(ch))
    x = (
        x.replace("ä", "ae")
         .replace("ö", "oe")
         .replace("ü", "ue")
         .replace("ß", "ss")
    )
    x = _AR_DIACRITICS_RE.sub("", x)
    x = _NON_ALNUM_RE.sub(" ", x)
    x = " ".join(x.strip().lower().split())
    return x


# -----------------------
# مطابقة القاموس
# -----------------------
def _match_plain(text_norm: str, term_norm: str) -> bool:
    """مطابقة عبارة بعد التطبيع بحدود كلمات تقريبية."""
    if not term_norm:
        return False
    pat = rf"(?:(?<=\s)|^){re.escape(term_norm)}(?:(?=\s)|$)"
    return re.search(pat, text_norm, flags=re.IGNORECASE) is not None


def _match_regex(text_norm: str, pattern_raw: str) -> bool:
    """مطابقة Regex على النص المُطبّع."""
    try:
        return re.search(pattern_raw, text_norm, flags=re.IGNORECASE) is not None
    except re.error:
        return False


# صيغ نفي متعدّدة (de/en/ar)
NEG_PATTERNS = [
    r"\bohne\s+{t}\b",
    r"\bkein(?:e|en|er)?\s+{t}\b",
    r"\bno\s+{t}\b",
    r"\bwithout\s+{t}\b",
    r"\b{t}(?:\s|-)?frei\b",
    r"\bبدون\s+{t}\b",
    r"\bمن\s+غير\s+{t}\b",
    r"\bohne\b[^.()]{{0,40}}\b{t}\b",
]

def _is_negated(text_norm: str, term_norm: str) -> bool:
    t = re.escape(term_norm)
    for p in NEG_PATTERNS:
        if re.search(p.format(t=t), text_norm, flags=re.IGNORECASE):
            return True
    return False


# -----------------------
# تجميع من المكوّنات
# -----------------------
def _collect_from_ingredients(dish: Dish) -> Tuple[Set[str], Set[int], Dict[str, List[str]]]:
    """
    يرجّع:
      - letters: أكواد A..Z
      - numbers: إضافات رقمية
      - provenance_ing: خريطة code -> قائمة أسباب نصيّة (Ingredient → Code)
    """
    letters: Set[str] = set()
    numbers: Set[int] = set()
    provenance_ing: Dict[str, List[str]] = {}

    try:
        for ing in dish.ingredients.all():
            ing_name = (ing.name or "").strip() or "Ingredient"
            try:
                for a in ing.allergens.all():
                    c = (a.code or "").strip().upper()
                    if c:
                        letters.add(c)
                        provenance_ing.setdefault(c, []).append(f'Ingredient: {ing_name} \u2192 {c}')
            except Exception:
                pass
            for n in (ing.additives or []):
                try:
                    numbers.add(int(n))
                except Exception:
                    pass
    except Exception:
        pass

    for c in (dish.extra_allergens or []):
        c = (str(c) or "").strip().upper()
        if c:
            letters.add(c)
            provenance_ing.setdefault(c, []).append("Dish.extra_allergens \u2192 " + c)

    for n in (dish.extra_additives or []):
        try:
            numbers.add(int(n))
        except Exception:
            pass

    return letters, numbers, provenance_ing


def _format_codes(letters: Set[str], numbers: Set[int]) -> str:
    letters_part = ",".join(sorted({c for c in letters if c}))
    numbers_part = ",".join(str(n) for n in sorted(numbers))
    if letters_part and numbers_part:
        return f"({letters_part},{numbers_part})"
    if letters_part:
        return f"({letters_part})"
    if numbers_part:
        return f"({numbers_part})"
    return ""


# -----------------------
# شـرح ألماني للاكواد (اختياري)
# -----------------------
def _build_de_explanation(letter_codes: Set[str]) -> str:
    if not letter_codes:
        return ""
    try:
        labels = list(
            Allergen.objects.filter(code__in=letter_codes)
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
    except Exception:
        return ""


# -----------------------
# تفضيل قاموس المالك ثم العام (owner=None) ثم GLOBAL_LEXICON_OWNER_ID
# -----------------------
_GLOBAL_OWNER_ID = getattr(settings, "GLOBAL_LEXICON_OWNER_ID", None)

def _resolve_lexemes(owner_id: int | None, lang: str) -> List[KeywordLexeme]:
    """
    نجلب القواميس بالترتيب:
      1) قاموس المالك (إن وُجد owner_id)
      2) القاموس العام الحقيقي owner IS NULL
      3) القاموس المُعرّف في settings.GLOBAL_LEXICON_OWNER_ID (إن وُجد)
    مع ترتيب يفضّل نتائج المالك ثم NULL ثم GLOBAL.
    """
    filters = Q(is_active=True, lang__iexact=lang) & (
        Q(owner_id=owner_id) |
        Q(owner__isnull=True) |
        (Q(owner_id=_GLOBAL_OWNER_ID) if _GLOBAL_OWNER_ID is not None else Q(pk__in=[]))
    )

    qs = (
        KeywordLexeme.objects
        .filter(filters)
        .select_related("ingredient")
        .prefetch_related("allergens", "ingredient__allergens")
        .annotate(
            owner_rank=Case(
                When(owner_id=owner_id, then=Value(0)),
                When(owner__isnull=True, then=Value(1)),
                When(owner_id=_GLOBAL_OWNER_ID, then=Value(2)),
                default=Value(3),
                output_field=IntegerField(),
            )
        )
        .order_by("owner_rank", "id")
    )
    return list(qs)


def _collect_from_lexicon(
    text_norm: str,
    lexemes: List[KeywordLexeme]
) -> Tuple[Set[str], Set[int], Dict, Dict[str, List[str]]]:
    """
    يرجّع:
      - letters, numbers
      - details: {"lexeme_hits":[{term, negated}]}
      - provenance_lex: خريطة code -> قائمة أسباب نصيّة (Lexeme/Ingredient → Code)
    """
    letters: Set[str] = set()
    numbers: Set[int] = set()
    hits: List[Dict] = []
    seen_terms: Set[str] = set()
    provenance_lex: Dict[str, List[str]] = {}

    for lx in lexemes:
        raw_term = (lx.term or "").strip()
        if not raw_term:
            continue

        term_norm = normalize_text(raw_term)
        if term_norm in seen_terms:
            continue

        ok = _match_regex(text_norm, raw_term) if lx.is_regex else _match_plain(text_norm, term_norm)
        if not ok:
            continue

        seen_terms.add(term_norm)

        if _is_negated(text_norm, term_norm):
            hits.append({"term": raw_term, "negated": True})
            continue

        # 1) أكواد على الـlexeme نفسه
        for a in lx.allergens.all():
            c = (a.code or "").strip().upper()
            if c:
                letters.add(c)
                provenance_lex.setdefault(c, []).append(f'Lexeme: "{raw_term}" \u2192 {c}')

        # 2) عبر Ingredient مرتبط بالـlexeme
        if lx.ingredient_id:
            try:
                for a in lx.ingredient.allergens.all():
                    c = (a.code or "").strip().upper()
                    if c:
                        letters.add(c)
                        provenance_lex.setdefault(c, []).append(
                            f'Lexeme: "{raw_term}" → Ingredient: {lx.ingredient.name} \u2192 {c}'
                        )
                for n in (lx.ingredient.additives or []):
                    try:
                        numbers.add(int(n))
                    except Exception:
                        pass
            except Exception:
                pass

        hits.append({"term": raw_term, "negated": False})

    details = {"lexeme_hits": hits}
    return letters, numbers, details, provenance_lex


# -----------------------
# هيكل نتيجة عنصر
# -----------------------
@dataclass
class RuleResultItem:
    dish_id: int
    name: str
    before: str
    after: str
    action: str
    skipped: bool = False
    details: Dict | None = None


# -----------------------
# كتابة سجلات DishAllergen
# -----------------------
@transaction.atomic
def _upsert_dish_allergen_rows(
    dish: Dish,
    *,
    codes_final: Set[str],
    provenance_ing: Dict[str, List[str]],
    provenance_lex: Dict[str, List[str]],
    force: bool
) -> int:
    """
    ينشئ سجلات DishAllergen لكل كود في codes_final إن لم تكن موجودة.
    - لا يحذف أي سجل موجود.
    - لا يلمس الأطباق اليدوية إذا force=False.
    - source/confidence/rationale حسب المصدر الأقوى (Ingredient > Lexeme).
    """
    if (not force) and getattr(dish, "has_manual_codes", False):
        return 0

    if not codes_final:
        return 0

    existed = set(DishAllergen.objects.filter(dish=dish).values_list("allergen__code", flat=True))
    to_add = [c for c in codes_final if c not in existed]
    if not to_add:
        return 0

    all_map = {a.code: a for a in Allergen.objects.filter(code__in=to_add)}

    created = 0
    for code in to_add:
        allergen = all_map.get(code)
        if not allergen:
            continue

        # مصدر ورشنال وثقة
        reasons_ing = provenance_ing.get(code, [])
        reasons_lex = provenance_lex.get(code, [])
        if reasons_ing:
            source = DishAllergen.Source.INGREDIENT
            rationale = "; ".join(reasons_ing[:3])
            confidence = 0.98
        elif reasons_lex:
            source = DishAllergen.Source.REGEX
            rationale = "; ".join(reasons_lex[:3])
            confidence = 0.90
        else:
            # احتياط (لا يُفترض الوصول له هنا)
            source = DishAllergen.Source.REGEX
            rationale = ""
            confidence = 0.50

        DishAllergen.objects.create(
            dish=dish,
            allergen=allergen,
            source=source,
            confidence=confidence,
            rationale=rationale,
            is_confirmed=False,
            created_by=None,
        )
        created += 1

    return created


# -----------------------
# الدالة الرئيسية
# -----------------------
def generate_for_dishes(
    dishes: Iterable[Dish],
    owner_id: int | None,
    lang: str = "de",
    force: bool = False,
    dry_run: bool = True,
    include_details: bool = False,
) -> Dict:
    lexemes = _resolve_lexemes(owner_id=owner_id, lang=lang)

    processed = 0
    skipped = 0
    changed = 0
    missing_after_rules = 0
    items: List[Dict] = []

    for dish in dishes:
        processed += 1

        has_manual_flag = bool(getattr(dish, "has_manual_codes", False))
        current_value = (getattr(dish, "generated_codes", "") or "").strip()

        if has_manual_flag and not force:
            skipped += 1
            items.append({
                "dish_id": dish.id,
                "name": dish.name,
                "before": current_value,
                "after": "",
                "action": "skip_manual",
                "skipped": True,
            })
            continue

        base_text = " ".join(filter(None, [dish.name or "", dish.description or ""]))
        text_norm = normalize_text(base_text)

        letters_ing, numbers_ing, prov_ing = _collect_from_ingredients(dish)
        letters_lex, numbers_lex, det, prov_lex = _collect_from_lexicon(text_norm, lexemes)

        letters = set(letters_ing) | set(letters_lex)
        numbers = set(numbers_ing) | set(numbers_lex)

        new_value = _format_codes(letters, numbers)
        explanation_de = _build_de_explanation(letters) if include_details else ""

        # ---------- DRY RUN ----------
        if dry_run:
            action = "no_change" if new_value == current_value else "would_change"
            if force and has_manual_flag:
                action = "would_override_manual"
            item = {
                "dish_id": dish.id,
                "name": dish.name,
                "before": current_value,
                "after": new_value,
                "action": action,
                "skipped": False,
            }
            if include_details:
                item["details"] = {
                    "text_used": text_norm,
                    "letters_from_ingredients": sorted(list(letters_ing)),
                    "numbers_from_ingredients": sorted(list(numbers_ing)),
                    "letters_from_lexemes": sorted(list(letters_lex)),
                    "numbers_from_lexemes": sorted(list(numbers_lex)),
                    "explanation_de": explanation_de,
                    "lexeme_hits": det.get("lexeme_hits", []),
                    # جديد: أثر كل كود من أين جاء
                    "provenance": {
                        "ingredient": {k: prov_ing[k] for k in sorted(prov_ing.keys())},
                        "lexeme": {k: prov_lex[k] for k in sorted(prov_lex.keys())},
                    },
                }
            if new_value == "":
                missing_after_rules += 1
            if new_value != current_value:
                changed += 1
            items.append(item)
            continue

        # ---------- WRITE MODE ----------
        updated_fields = []
        if force and has_manual_flag:
            dish.has_manual_codes = False
            dish.manual_codes = None
            updated_fields += ["has_manual_codes", "manual_codes"]

        if new_value != current_value:
            dish.generated_codes = new_value
            updated_fields.append("generated_codes")
            changed += 1

        if hasattr(dish, "codes_updated_at"):
            dish.codes_updated_at = timezone.now()
            updated_fields.append("codes_updated_at")

        if updated_fields:
            dish.save(update_fields=list(dict.fromkeys(updated_fields)))

        if new_value == "":
            missing_after_rules += 1

        # كتابة صفوف التتبّع لكل كود حرفي ظهر
        if letters:
            try:
                _upsert_dish_allergen_rows(
                    dish,
                    codes_final=letters,
                    provenance_ing=prov_ing,
                    provenance_lex=prov_lex,
                    force=force,
                )
            except Exception:
                # لا نكسر التدفق لو حصل خطأ في التتبّع
                pass

        item = {
            "dish_id": dish.id,
            "name": dish.name,
            "before": current_value,
            "after": new_value,
            "action": "changed" if updated_fields else "unchanged",
            "skipped": False,
        }
        if include_details:
            item["details"] = {
                "text_used": text_norm,
                "letters_from_ingredients": sorted(list(letters_ing)),
                "numbers_from_ingredients": sorted(list(numbers_ing)),
                "letters_from_lexemes": sorted(list(letters_lex)),
                "numbers_from_lexemes": sorted(list(numbers_lex)),
                "explanation_de": explanation_de,
                "lexeme_hits": det.get("lexeme_hits", []),
                "provenance": {
                    "ingredient": {k: prov_ing[k] for k in sorted(prov_ing.keys())},
                    "lexeme": {k: prov_lex[k] for k in sorted(prov_lex.keys())},
                },
            }
        items.append(item)

    return {
        "processed": processed,
        "skipped": skipped,
        "changed": changed,
        "missing_after_rules": missing_after_rules,
        "items": items[:1000],
        "dry_run": dry_run,
        "lang": lang,
        "count": len(items),
    }
