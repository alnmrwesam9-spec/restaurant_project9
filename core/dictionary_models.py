# core/dictionary_models.py
# ============================================================
# نماذج القاموس: مصطلحات/نفي → (حساسيّات / Ingredient)
# تُستخدم في محرك القواعد وخدمات LLM والـ Admin
# ============================================================

from __future__ import annotations

import re
import unicodedata
from typing import Optional

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.utils.translation import gettext_lazy as _

# مراجع إلى موديلات موجودة في core.models
from core.models import Allergen, Ingredient


# -----------------------------
# أدوات تطبيع نص متّسقة وبسيطة
# -----------------------------
_AR_DIACRITICS_RE = re.compile(r"[\u064B-\u0652]")
_NON_ALNUM_RE = re.compile(r"[^\w\s]", flags=re.UNICODE)

def normalize_text(value: str) -> str:
    """
    NFKD + إزالة العلامات (accents)، تبسيط الألمانية، إزالة التشكيل العربي،
    إزالة الرموز غير الألفانوميرية (نبقي المسافات)، lowercase + دمج المسافات.
    متوافقة مع services/allergen_rules.normalize_text
    """
    if not value:
        return ""
    x = unicodedata.normalize("NFKD", str(value))
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


# ============================================================
# KeywordLexeme: مصطلح يقود إلى حساسيّات/مكوّن
# ============================================================
class KeywordLexeme(models.Model):
    """
    يُستخدم لمطابقة النص (name + description) مع كلمات/عبارات مفتاحية.
    يمكن أن:
      - يربط Ingredient معيّن (اختياري)
      - يربط Allergen(s) مباشرةً (M2M)
      - يكون Regex أو نص ثابت
      - يكون عام (owner=None) أو خاص بمستخدم/مالك معيّن
    """
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="lexemes",
        null=True,
        blank=True,
        verbose_name=_("Owner"),
        help_text=_("اختياري: مالك القاموس؛ NULL يعني قاموس عام."),
    )

    lang = models.CharField(
        max_length=10,
        default="de",
        verbose_name=_("Language"),
        help_text=_("رمز اللغة القصير (مثال: de)."),
    )

    term = models.CharField(
        max_length=255,
        verbose_name=_("Term"),
        help_text=_("النص الأصلي للمصطلح."),
    )

    normalized_term = models.CharField(
        max_length=255,
        db_index=True,
        verbose_name=_("Normalized term"),
        help_text=_("نسخة مطبّعة من المصطلح لأغراض المطابقة (تُحدَّث تلقائيًا)."),
    )

    is_regex = models.BooleanField(
        default=False,
        verbose_name=_("Is regex pattern"),
        help_text=_("إن كان المصطلح تعبيرًا نمطيًا (Regex)."),
    )

    is_active = models.BooleanField(
        default=True,
        verbose_name=_("Active"),
    )

    # إبقاء هذين الحقلين لتفادي أي أخطاء وترتيب مخصّص:
    priority = models.IntegerField(
        default=0,
        verbose_name=_("Priority"),
        help_text=_("أولوية اختيارية للفرز (مفيدة إن كان محرك القواعد يرتّب بـ -priority)."),
    )
    weight = models.FloatField(
        default=1.0,
        verbose_name=_("Weight"),
        help_text=_("وزن اختياري للفرز عند التعارض."),
    )

    ingredient: Optional[Ingredient] = models.ForeignKey(
        Ingredient,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="lexemes",
        verbose_name=_("Ingredient"),
        help_text=_("ربط اختياري بمكوّن معروف."),
    )

    allergens = models.ManyToManyField(
        Allergen,
        blank=True,
        related_name="lexemes",
        verbose_name=_("Allergens"),
        help_text=_("حساسيّات مرتبطة مباشرةً بالمصطلح (تُستخدم لو لم يكن ingredient)."),
    )

    notes = models.TextField(
        null=True,
        blank=True,
        verbose_name=_("Notes"),
    )

    created_at = models.DateTimeField(auto_now_add=True, verbose_name=_("Created at"))
    updated_at = models.DateTimeField(auto_now=True, verbose_name=_("Updated at"))

    # توافق بسيط مع محرك القواعد القديم (إن استُخدم):
    MATCH_SUBSTRING = "substring"
    MATCH_WORD = "word"
    MATCH_EXACT = "exact"

    @property
    def phrase(self) -> str:
        return self.term or ""

    @property
    def match_type(self) -> str:
        return self.MATCH_SUBSTRING if bool(self.is_regex) else self.MATCH_WORD

    class Meta:
        verbose_name = _("Keyword Lexeme")
        verbose_name_plural = _("Keyword Lexemes")
        # ترتيب منطقي: القاموس الخاص قبل العام، ثم اللغة، ثم الأولوية (إن وُجدت)، ثم الوزن، ثم المعرّف
        ordering = ("owner_id", "lang", "-priority", "-weight", "id")
        # منع التكرار لنفس (المالك/اللغة/normalized_term) لكل نوع (regex أو لا)
        constraints = [
            models.UniqueConstraint(
                fields=["owner", "lang", "normalized_term", "is_regex"],
                name="uniq_lexeme_owner_lang_norm_regex",
            ),
        ]
        indexes = [
            models.Index(fields=["lang", "normalized_term"], name="idx_lex_lang_norm"),
            models.Index(fields=["owner", "lang"], name="idx_lex_owner_lang"),
            models.Index(fields=["is_active"], name="idx_lex_is_active"),
            # ⬅️ جديد: فهرس lookup مباشر للاستعلام الأشيع في المحرك
            models.Index(fields=["lang", "normalized_term", "owner", "is_regex"], name="idx_lex_lookup"),
        ]

    def __str__(self) -> str:
        own = "global" if self.owner_id is None else f"user:{self.owner_id}"
        return f"[{own}|{self.lang}] {self.term} ({'regex' if self.is_regex else 'plain'})"

    def clean(self):
        """
        نضمن التطبيع قبل فحص قيود Unique (خاصةً في admin/bulk).
        """
        self.normalized_term = normalize_text(self.term or "")
        if self.lang:
            self.lang = (normalize_text(self.lang) or "de").replace(" ", "")

    def save(self, *args, **kwargs):
        # تطبيع قبل الحفظ
        self.clean()
        super().save(*args, **kwargs)


# ============================================================
# NegationCue: عبارات نفي ضمن نافذة كلمات
# ============================================================
class NegationCue(models.Model):
    """
    تُستخدم لتعطيل مطابقة lexeme إذا ظهرت عبارة نفي قريبة منها، مثل:
      "ohne sesam", "without nuts", "بدون سمسم"
    نافذة الكلمات (before/after) تحدّد عدد الكلمات المتأثّرة بالنفي.
    """
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="negation_cues",
        null=True,
        blank=True,
        verbose_name=_("Owner"),
        help_text=_("اختياري: نفي خاص بمالك معيّن. إذا فارغ: نفي عام."),
    )

    lang = models.CharField(
        max_length=10,
        default="de",
        verbose_name=_("Language"),
    )

    cue = models.CharField(
        max_length=120,
        verbose_name=_("Negation cue"),
        help_text=_("العبارة/الكلمة التي تدل على النفي (مثلاً ohne/بدون/without)."),
    )

    normalized_cue = models.CharField(
        max_length=120,
        editable=False,
        db_index=True,
        verbose_name=_("Normalized cue"),
        help_text=_("نسخة مطبّعة من عبارة النفي (تُحدَّث تلقائيًا)."),
    )

    is_regex = models.BooleanField(
        default=False,
        verbose_name=_("Is regex pattern"),
    )

    window_before = models.PositiveSmallIntegerField(
        default=3,
        verbose_name=_("Window before (words)"),
    )
    window_after = models.PositiveSmallIntegerField(
        default=2,
        verbose_name=_("Window after (words)"),
    )

    is_active = models.BooleanField(
        default=True,
        verbose_name=_("Active"),
    )

    notes = models.TextField(
        null=True,
        blank=True,
        verbose_name=_("Notes"),
    )

    created_at = models.DateTimeField(auto_now_add=True, verbose_name=_("Created at"))
    updated_at = models.DateTimeField(auto_now=True, verbose_name=_("Updated at"))

    class Meta:
        verbose_name = _("Negation Cue")
        verbose_name_plural = _("Negation Cues")
        ordering = ("owner_id", "lang", "normalized_cue", "id")
        constraints = [
            models.UniqueConstraint(
                fields=["owner", "lang", "cue", "is_regex"],
                name="uniq_negcue_owner_lang_cue_regex",
            )
        ]
        indexes = [
            models.Index(fields=["lang", "normalized_cue"], name="idx_neg_lang_norm"),
            models.Index(fields=["owner", "lang"], name="idx_neg_owner_lang"),
            models.Index(fields=["is_active"], name="idx_neg_is_active"),
        ]

    def __str__(self) -> str:
        own = "global" if self.owner_id is None else f"user:{self.owner_id}"
        return f"[{own}|{self.lang}] {self.cue} ({'regex' if self.is_regex else 'plain'})"

    def clean(self):
        self.normalized_cue = normalize_text(self.cue or "")
        if self.lang:
            self.lang = (normalize_text(self.lang) or "de").replace(" ", "")

    def save(self, *args, **kwargs):
        self.clean()
        super().save(*args, **kwargs)


# ------------------------------------------------------------
# Backwards-compat alias for old imports:
# بعض الملفات القديمة (مثل core/services/llm_ingest.py)
# كانت تستورد:  from core.dictionary_models import _normalize_text as _norm
# لذا نضع alias ليبقى كل شيء يعمل بدون تعديل بقية الملفات.
# ------------------------------------------------------------
_normalize_text = normalize_text
