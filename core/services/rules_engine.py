# core/services/rules_engine.py
from __future__ import annotations
import re
import unicodedata
from typing import Dict, List, Set, Tuple

from django.db.models import Q

from core.models import Ingredient
from core.dictionary_models import KeywordLexeme  # ✅ الاستيراد الصحيح

# --------------------------
# Normalization helpers
# --------------------------
_AR_TASHKEEL_RE = re.compile(r"[\u064B-\u0652]")
_NON_ALNUM_RE = re.compile(r"[^\w\s]", flags=re.UNICODE)

def normalize_text(s: str) -> str:
    """
    تطبيع قوي للنص:
    - NFKD + إزالة العلامات المركبة (accents/diacritics)
    - تطبيع الألمانية: ä→ae, ö→oe, ü→ue, ß→ss
    - إزالة التشكيل العربي
    - حذف الرموز غير الألفانوميرية (مع الإبقاء على المسافات)
    - lowercase + دمج المسافات
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
    x = _AR_TASHKEEL_RE.sub("", x)
    x = _NON_ALNUM_RE.sub(" ", x)
    x = " ".join(x.strip().lower().split())
    return x

# أنماط نفي بعد التطبيع
_NEG_PATTERNS = [
    r"\bohne\s+{t}\b",                 # de: ohne sesam
    r"\bkein(?:e|en|er)?\s+{t}\b",     # de: kein/keine/keinen senf
    r"\bno\s+{t}\b",                   # en: no nuts
    r"\bwithout\s+{t}\b",              # en: without milk
    r"\b{t}(?:\s|-)?frei\b",           # de: glutenfrei / laktose-frei
    r"\bبدون\s+{t}\b",                 # ar
    r"\bمن\s+غير\s+{t}\b",            # ar
    r"\bohne\b[^.()]{{0,40}}\b{t}\b",  # **مهم**: نهرب {{0,40}} قبل format
]

def is_negated(text_norm: str, term_norm: str) -> bool:
    t = re.escape(term_norm)
    for pat in _NEG_PATTERNS:
        if re.search(pat.format(t=t), text_norm, flags=re.IGNORECASE):
            return True
    return False

# --------------------------
# Loading owner + global dictionary
# --------------------------
class OwnerDictionary:
    """
    يجمع معجم المالك + العام:
      - syn2codes: مرادفات من Ingredient → أكواد حساسية
      - lexemes:   (phrase_norm, is_regex, set(allergen_codes))
    """
    def __init__(self, owner_id: int, lang_hint: str = "de"):
        self.owner_id = owner_id
        self.lang_hint = (lang_hint or "de").lower()
        self.syn2codes: Dict[str, Set[str]] = {}
        self.lexemes: List[Tuple[str, bool, Set[str]]] = []

    @classmethod
    def load(cls, owner_id: int, lang_hint: str = "de") -> "OwnerDictionary":
        dic = cls(owner_id, lang_hint)

        # 1) Ingredients + allergens (خاص بالمالك)
        ing_qs = Ingredient.objects.filter(owner_id=owner_id).prefetch_related("allergens")
        for ing in ing_qs:
            codes = { (a.code or "").strip() for a in ing.allergens.all() if (a.code or "").strip() }
            for syn in (ing.synonyms or []):
                syn_norm = normalize_text(syn)
                if syn_norm:
                    dic.syn2codes.setdefault(syn_norm, set()).update(codes)

        # 2) KeywordLexeme: الخاص بالمالك + العام (owner is null) لهذه اللغة
        lexs = (
            KeywordLexeme.objects
            .filter(is_active=True, lang__iexact=dic.lang_hint)
            .filter(Q(owner_id=owner_id) | Q(owner__isnull=True))
            .prefetch_related("allergens", "ingredient__allergens")
            .select_related("ingredient")
        )
        for lx in lexs:
            term = (lx.term or "").strip()
            if not term:
                continue

            phrase_norm = normalize_text(term)
            codes = { (a.code or "").strip() for a in lx.allergens.all() if (a.code or "").strip() }

            if lx.ingredient_id:
                for a in lx.ingredient.allergens.all():
                    if (a.code or "").strip():
                        codes.add(a.code.strip())
                for syn in (lx.ingredient.synonyms or []):
                    syn_norm = normalize_text(syn)
                    if syn_norm:
                        dic.syn2codes.setdefault(syn_norm, set()).update(codes)

            if phrase_norm and codes:
                dic.lexemes.append((phrase_norm, bool(lx.is_regex), codes))

        return dic

# --------------------------
# Matching
# --------------------------
def _match_synonyms(text_norm: str, syn2codes: Dict[str, Set[str]]) -> Set[str]:
    """Substring بسيط بعد التطبيع (يمكن لاحقًا جعله word-boundary)."""
    out: Set[str] = set()
    for syn, codes in syn2codes.items():
        if syn and (syn in text_norm) and not is_negated(text_norm, syn):
            out.update(codes)
    return out

def _match_lexemes(text_norm: str, lexemes: List[Tuple[str, bool, Set[str]]]) -> Set[str]:
    """مطابقة lexemes: regex أو plain (كـ substring بحدود كلمات تقريبية)."""
    out: Set[str] = set()
    for phrase_norm, is_regex, codes in lexemes:
        if not phrase_norm:
            continue
        ok = False
        if is_regex:
            try:
                ok = re.search(phrase_norm, text_norm, flags=re.IGNORECASE) is not None
            except re.error:
                ok = False
        else:
            pat = rf"(?:(?<=\s)|^){re.escape(phrase_norm)}(?:(?=\s)|$)"
            ok = re.search(pat, text_norm, flags=re.IGNORECASE) is not None

        if ok and not is_negated(text_norm, phrase_norm):
            out.update(codes)
    return out

def infer_codes_from_text(owner_id: int, text: str, lang_hint: str = "de") -> Set[str]:
    """
    يرجّع مجموعة حروف الأكواد (A..R) من نص الطبق بالاعتماد على قاموس المالك + العام.
    """
    text_norm = normalize_text(text)
    if not text_norm:
        return set()
    dic = OwnerDictionary.load(owner_id=owner_id, lang_hint=lang_hint)
    letters = set()
    letters.update(_match_synonyms(text_norm, dic.syn2codes))
    letters.update(_match_lexemes(text_norm, dic.lexemes))
    return letters
