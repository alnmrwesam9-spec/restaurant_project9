# core/management/commands/seed_lexemes_de.py
# ============================================================
# زرع/استيراد Lexemes ألمانية (قاموس أوّلي) مع ربط بمكوّنات وحروف حساسية
# يدعم:
#   - تشغيل مباشر من CSV داخلي bundled
#   - تمرير مسار CSV خارجي --csv PATH
#   - الحفظ لمالك معيّن --owner <USER_ID> أو كقاموس عام --global
#   - وضع المعاينة --dry-run
#   - تجاهل المكرّرات وتحديث الأكواد/العلاقات عند الحاجة
# صيغة CSV المتوقعة (UTF-8):
#   term,ingredient_name,allergen_codes,is_regex,priority,weight,notes
# ============================================================

from __future__ import annotations

import csv
import io
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.contrib.auth import get_user_model

from core.dictionary_models import KeywordLexeme, normalize_text
from core.models import Allergen, Ingredient

DEFAULT_LANG = "de"

EMBEDDED_CSV = """term,ingredient_name,allergen_codes,is_regex,priority,weight,notes
käse,Käse,G,false,100,1.0,Milchprodukte → G
pecorino,Pecorino,G,false,100,1.0,
parmesan,Parmesan,G,false,100,1.0,
mozzarella,Mozzarella,G,false,100,1.0,
weizen,Weizenmehl,A,false,100,1.0,Glutenhaltiges Getreide → A
hartweizen,Weizengrieß,A,false,100,1.0,
dinkel,Dinkel,A,false,100,1.0,
roggen,Roggen,A,false,100,1.0,
gerste,Gerste,A,false,100,1.0,
hafer,Hafer,A,false,100,1.0,
ei,Ei,E,false,100,1.0,
eier,Ei,E,false,100,1.0,
eierspeisen,Ei,E,false,100,1.0,
fisch,Fisch,D,false,100,1.0,
thunfisch,Thunfisch,D,false,100,1.0,
lachs,Lachs,D,false,100,1.0,
garnele,Garnele,B,false,100,1.0,Krabben/Krebstiere → B
krabben,Krebstiere,B,false,100,1.0,
krebstiere,Krebstiere,B,false,100,1.0,
muschel,Muscheln,B,false,100,1.0,
milch,Milch,G,false,100,1.0,
butter,Butter,G,false,100,1.0,
sahne,Sahne,G,false,100,1.0,
joghurt,Joghurt,G,false,100,1.0,
sesam,Sesam,N,false,100,1.0,
sesamsamen,Sesam,N,false,100,1.0,
nuss,Nüsse,H,false,100,1.0,
nüsse,Nüsse,H,false,100,1.0,
walnuss,Walnuss,H,false,100,1.0,
mandeln,Mandel,H,false,100,1.0,
haselnuss,Haselnuss,H,false,100,1.0,
pistazie,Pistazie,H,false,100,1.0,
cashew,Cashewkern,H,false,100,1.0,
erdnuss,Erdnuss,F,false,100,1.0,⚠️ Erdnuss ≠ Schalenfrüchte
soja,Soja,C,false,100,1.0,
sojasauce,Sojasauce,C,false,100,1.0,
sellerie,Sellerie,I,false,100,1.0,
senf,Senf,J,false,100,1.0,
lupine,Lupine,M,false,100,1.0,
weichtiere,Weichtiere,L,false,100,1.0,
schwefel,Schwefeldioxid,S,false,100,1.0,= Sulfite (E220–E228)
gluten,Weizenmehl,A,false,100,1.0,Direkte Erwähnung von Gluten → A
spaghetti,Spaghetti,A,false,95,1.0,Pasta (Weizen) → A
penne,Penne,A,false,95,1.0,Pasta (Weizen) → A
tagliatelle,Tagliatelle,A,false,95,1.0,Pasta (Weizen) → A
gnocchi,Gnocchi,A,false,90,1.0,Pasta (oft Weizen; ggf. Ei) → A
ricotta,Ricotta,G,false,100,1.0,
gouda,Gouda,G,false,100,1.0,
emmentaler,Emmentaler,G,false,100,1.0,
camembert,Camembert,G,false,100,1.0,
schafskäse,Schafskäse,G,false,100,1.0,
ziegenkäse,Ziegenkäse,G,false,100,1.0,
"""

def _bool(s: str) -> bool:
    return str(s).strip().lower() in ("1", "true", "yes", "y")

def _split_codes(s: str) -> list[str]:
    return [c.strip().upper() for c in str(s or "").replace(" ", "").split(",") if c.strip()]

class Command(BaseCommand):
    help = "Import/seed German lexemes (terms → ingredients/allergens)."

    def add_arguments(self, parser):
        parser.add_argument("--csv", type=str, help="Optional path to CSV file (UTF-8). If omitted, embedded seed is used.")
        parser.add_argument("--owner", type=int, help="Owner user id. Use this OR --global.")
        parser.add_argument("--global", dest="as_global", action="store_true", help="Store as global (owner=None) for Lexemes.")
        parser.add_argument("--lang", type=str, default=DEFAULT_LANG, help="Language code (default: de).")
        parser.add_argument("--dry-run", action="store_true", help="Preview only; no DB writes.")

    def handle(self, *args, **opts):
        lang = (opts.get("lang") or DEFAULT_LANG).lower().strip()
        as_global = bool(opts.get("as_global"))
        owner_id = opts.get("owner")
        dry_run = bool(opts.get("dry_run"))

        # إذا لا owner ولا global → نرفض
        if not as_global and not owner_id:
            raise CommandError("You must pass either --owner <USER_ID> or --global")

        # نعرف هل Ingredient.owner يسمح بـ NULL أم لا
        ing_owner_field = Ingredient._meta.get_field("owner")
        ingredient_owner_nullable = bool(getattr(ing_owner_field, "null", False))

        # في وضع --global وإذا الموديل لا يسمح بـ NULL → لا ننشئ Ingredients
        can_create_global_ingredients = as_global and ingredient_owner_nullable

        owner_user = None
        if owner_id:
            User = get_user_model()
            try:
                owner_user = User.objects.get(pk=int(owner_id))
            except Exception:
                raise CommandError(f"Owner user not found: {owner_id}")

        csv_path = opts.get("csv")
        if csv_path:
            p = Path(csv_path)
            if not p.exists():
                raise CommandError(f"CSV not found: {p}")
            content = p.read_text(encoding="utf-8")
        else:
            content = EMBEDDED_CSV

        reader = csv.DictReader(io.StringIO(content))
        rows = list(reader)
        if not rows:
            self.stdout.write(self.style.WARNING("No rows to import."))
            return

        # نتأكد من وجود أكواد الحساسية المشار إليها
        all_codes: set[str] = set()
        for r in rows:
            all_codes.update(_split_codes(r.get("allergen_codes", "")))
        if all_codes:
            existing = set(Allergen.objects.filter(code__in=all_codes).values_list("code", flat=True))
            missing = sorted(all_codes - existing)
            if missing:
                if dry_run:
                    self.stdout.write(self.style.WARNING(f"[dry-run] Missing allergens will be created: {','.join(missing)}"))
                else:
                    for code in missing:
                        Allergen.objects.get_or_create(code=code)

        created_lex = 0
        updated_lex = 0
        created_ing = 0
        updated_links = 0

        @transaction.atomic
        def do_import():
            nonlocal created_lex, updated_lex, created_ing, updated_links

            for r in rows:
                term = (r.get("term") or "").strip()
                ing_name = (r.get("ingredient_name") or "").strip()
                codes = _split_codes(r.get("allergen_codes", ""))
                is_regex = _bool(r.get("is_regex", "false"))
                priority = int(str(r.get("priority") or "100") or "100")
                try:
                    weight = float(str(r.get("weight") or "1.0") or "1.0")
                except Exception:
                    weight = 1.0
                notes = (r.get("notes") or "").strip()

                if not term:
                    continue

                norm = normalize_text(term)

                # ============ Ingredient (اختياري) ============
                ingredient = None
                if ing_name:
                    if owner_user:
                        # وضع owner محدد: نبحث/ننشيء تحت هذا المالك
                        ingredient = Ingredient.objects.filter(owner=owner_user, name__iexact=ing_name).first()
                        if ingredient is None:
                            ingredient = Ingredient.objects.create(owner=owner_user, name=ing_name)
                            created_ing += 1
                    else:
                        # وضع --global
                        if can_create_global_ingredients:
                            # يمكن إنشاء Ingredient بلا مالك
                            ingredient = Ingredient.objects.filter(owner__isnull=True, name__iexact=ing_name).first()
                            if ingredient is None:
                                ingredient = Ingredient.objects.create(owner=None, name=ing_name)
                                created_ing += 1
                        else:
                            # لا يسمح الـ model بـ owner=NULL → نتجاوز إنشاء Ingredient،
                            # وسنربط الأكواد على Lexeme مباشرة.
                            ingredient = None

                # ============ Lexeme upsert ============
                qs_lex = KeywordLexeme.objects.filter(
                    lang__iexact=lang,
                    normalized_term=norm,
                    is_regex=is_regex,
                )
                if owner_user:
                    qs_lex = qs_lex.filter(owner=owner_user)
                else:
                    qs_lex = qs_lex.filter(owner__isnull=True)

                lx = qs_lex.first()
                if lx is None:
                    lx = KeywordLexeme(
                        owner=owner_user if owner_user else None,
                        lang=lang,
                        term=term,
                        normalized_term=norm,
                        is_regex=is_regex,
                        is_active=True,
                        priority=priority,
                        weight=weight,
                        notes=notes,
                    )
                    lx.save()
                    created_lex += 1
                else:
                    changed = False
                    if lx.term != term:
                        lx.term = term; changed = True
                    if lx.priority != priority:
                        lx.priority = priority; changed = True
                    if lx.weight != weight:
                        lx.weight = weight; changed = True
                    if notes and lx.notes != notes:
                        lx.notes = notes; changed = True
                    if not lx.is_active:
                        lx.is_active = True; changed = True
                    if changed:
                        lx.save(update_fields=["term", "priority", "weight", "notes", "is_active"])
                        updated_lex += 1

                # ربط ingredient على lexeme (إن وُجد وتم السماح بإنشائه/إيجاده)
                if ingredient and lx.ingredient_id != ingredient.id:
                    lx.ingredient = ingredient
                    lx.save(update_fields=["ingredient"])
                    updated_links += 1

                # ربط الأكواد على lexeme
                if codes:
                    current = set(lx.allergens.values_list("code", flat=True))
                    want = set(codes) | current
                    if want != current:
                        alls = list(Allergen.objects.filter(code__in=sorted(want)))
                        lx.allergens.set(alls)
                        updated_links += 1

                # (اختياري) ربط الأكواد على ingredient إذا موجود
                if ingredient and codes:
                    cur_ing = set(ingredient.allergens.values_list("code", flat=True))
                    want_ing = set(codes) | cur_ing
                    if want_ing != cur_ing:
                        alls = list(Allergen.objects.filter(code__in=sorted(want_ing)))
                        ingredient.allergens.set(alls)
                        updated_links += 1

        if dry_run:
            try:
                with transaction.atomic():
                    do_import()
                    raise RuntimeError("_ROLLBACK_DRY_RUN_")
            except RuntimeError as ex:
                if str(ex) != "_ROLLBACK_DRY_RUN_":
                    raise
            self.stdout.write(self.style.SUCCESS("[dry-run] Done (no changes committed)."))
        else:
            do_import()
            self.stdout.write(self.style.SUCCESS("Seed import committed."))

        self.stdout.write(f"Lexemes created: {created_lex}, updated: {updated_lex}")
        self.stdout.write(f"Ingredients created: {created_ing}, links updated: {updated_links}")
