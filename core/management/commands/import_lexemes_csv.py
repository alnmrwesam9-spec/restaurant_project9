import csv
import re
from django.core.management.base import BaseCommand, CommandError
from django.contrib.auth import get_user_model
from django.db import transaction
from core.models import Allergen, Ingredient
from core.dictionary_models import KeywordLexeme
from core.services.allergen_rules import normalize_text as _norm

User = get_user_model()

def _merge_codes_str(*codes):
    bag = set()
    for c in codes:
        if not c:
            continue
        for p in re.split(r"[,\s]+", str(c).upper()):
            p = p.strip()
            if p:
                bag.add(p)
    return ",".join(sorted(bag)) if bag else ""

class Command(BaseCommand):
    help = "Import/update a big batch of lexemes from a CSV file (lang,term,ingredient_name,allergen_codes,is_regex)."

    def add_arguments(self, parser):
        parser.add_argument("csv_path", type=str, help="Path to CSV file.")
        parser.add_argument("--owner-id", type=int, required=True, help="Owner user ID to store lexicon under.")
        parser.add_argument("--as-ingredient", action="store_true", default=True, help="Create/attach Ingredient for each ingredient_name.")
        parser.add_argument("--lang-default", type=str, default="de", help="Default language if column empty.")

    @transaction.atomic
    def handle(self, *args, **opts):
        csv_path = opts["csv_path"]
        owner_id = opts["owner_id"]
        as_ingredient = bool(opts["as_ingredient"])
        lang_default = (opts["lang_default"] or "de").strip().lower()

        owner = User.objects.filter(pk=owner_id).first()
        if not owner:
            raise CommandError(f"--owner-id={owner_id} لا يشير إلى مستخدم موجود.")

        created_lex = updated_lex = created_ing = updated_codes = skipped = 0

        with open(csv_path, newline="", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            required_cols = {"term", "ingredient_name", "allergen_codes"}
            if not required_cols.issubset(set(c.lower() for c in reader.fieldnames or [])):
                raise CommandError(f"CSV must include columns: {', '.join(sorted(required_cols))}")

            for row in reader:
                lang = (row.get("lang") or lang_default).strip().lower()
                term = (row.get("term") or "").strip()
                ing_name = (row.get("ingredient_name") or "").strip()
                codes_str = (row.get("allergen_codes") or "").strip().upper()
                is_regex = str(row.get("is_regex") or "0").strip() in ("1", "true", "yes")

                if not term:
                    skipped += 1
                    continue

                # upsert lexeme بمفتاح (owner, lang, normalized_term, is_regex)
                norm = _norm(term)
                lx = KeywordLexeme.objects.filter(owner_id=owner_id, lang__iexact=lang, normalized_term=norm, is_regex=is_regex).first()
                if lx is None:
                    lx = KeywordLexeme(owner=owner, lang=lang, term=term, normalized_term=norm, is_regex=is_regex, is_active=True)
                    lx.save()
                    created_lex += 1
                else:
                    changed = False
                    if lx.term != term:
                        lx.term = term
                        changed = True
                    if not lx.is_active:
                        lx.is_active = True
                        changed = True
                    if changed:
                        lx.save(update_fields=["term", "is_active"])
                        updated_lex += 1

                # Ingredient (اختياري)
                if as_ingredient and ing_name:
                    ing = Ingredient.objects.filter(owner_id=owner_id, name__iexact=ing_name).first()
                    if ing is None:
                        ing = Ingredient.objects.create(owner=owner, name=ing_name)
                        created_ing += 1
                    if lx.ingredient_id != ing.id:
                        lx.ingredient = ing
                        lx.save(update_fields=["ingredient"])

                    # set allergen codes على Ingredient + على Lexeme (كـ مرآة)
                    codes = {c for c in re.split(r"[,\s]+", codes_str) if c}
                    if codes:
                        existing_ing = set(ing.allergens.values_list("code", flat=True))
                        union = sorted(existing_ing | codes)
                        if set(union) != existing_ing:
                            alls = list(Allergen.objects.filter(code__in=union))
                            ing.allergens.set(alls)
                            updated_codes += 1

                        existing_lx = set(lx.allergens.values_list("code", flat=True))
                        if codes - existing_lx:
                            alls = list(Allergen.objects.filter(code__in=sorted(existing_lx | codes)))
                            lx.allergens.set(alls)
                            updated_codes += 1
                else:
                    # بدون Ingredient: خزّن الأكواد على Lexeme مباشرة
                    codes = {c for c in re.split(r"[,\s]+", codes_str) if c}
                    if codes:
                        existing_lx = set(lx.allergens.values_list("code", flat=True))
                        if codes - existing_lx:
                            alls = list(Allergen.objects.filter(code__in=sorted(existing_lx | codes)))
                            lx.allergens.set(alls)
                            updated_codes += 1

        self.stdout.write(self.style.SUCCESS(
            f"Import done. created_lex={created_lex}, updated_lex={updated_lex}, created_ing={created_ing}, updated_codes={updated_codes}, skipped={skipped}, owner={owner_id}"
        ))
