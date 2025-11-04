from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.conf import settings
from core.models import Allergen, Ingredient

ALLERGENS = [
    ("A", "Gluten"), ("B", "Krebstiere"), ("C", "Eier"), ("D", "Fisch"),
    ("E", "Erdnüsse"), ("F", "Soja"), ("G", "Milch (einschl. Laktose)"),
    ("H", "Schalenfrüchte"), ("I", "Sellerie"), ("J", "Senf"),
    ("K", "Sesam"), ("L", "Schwefeldioxid/Sulfite"), ("M", "Lupinen"),
    ("N", "Weichtiere"), ("O", "Gerste"), ("P", "Roggen"), ("Q", "Hafer"),
    ("R", "Dinkel"),
]

DEMO_INGREDIENTS = [
    # name, allergen_codes, synonyms
    ("Brot", ["A","O","P","Q","R"], ["brot","weizen","weizenmehl","mehl","brötchen","baguette"]),
    ("Käse", ["G"], ["käse","cheese","emmentaler","gouda","mozzarella"]),
    ("Sesamöl", ["K"], ["sesamöl","sesam","tahini"]),
    ("Ei", ["C"], ["ei","eier","egg"]),
    ("Milch", ["G"], ["milch","laktose","milk"]),
]

class Command(BaseCommand):
    help = "Seed base allergens and a few demo ingredients/synonyms."

    def add_arguments(self, parser):
        parser.add_argument("--owner-id", type=int, help="Owner user id for demo ingredients (optional)")

    def handle(self, *args, **options):
        # 1) Allergens
        created_allergens = 0
        for code, label in ALLERGENS:
            obj, created = Allergen.objects.get_or_create(code=code, defaults={"label_de": label})
            if created:
                created_allergens += 1
        self.stdout.write(self.style.SUCCESS(f"Allergens ready (created {created_allergens})."))

        # 2) Demo Ingredients (optional)
        owner_id = options.get("owner_id")
        if not owner_id:
            self.stdout.write(self.style.WARNING("Skip demo ingredients (no --owner-id)."))
            return
        User = get_user_model()
        try:
            owner = User.objects.get(pk=owner_id)
        except User.DoesNotExist:
            self.stdout.write(self.style.ERROR(f"Owner user id {owner_id} not found."))
            return

        code_to_allergen = {a.code: a for a in Allergen.objects.all()}
        added = 0
        for name, codes, synonyms in DEMO_INGREDIENTS:
            ing, _ = Ingredient.objects.get_or_create(owner=owner, name=name)
            ing.synonyms = synonyms
            ing.save()
            if codes:
                ing.allergens.set([code_to_allergen[c] for c in codes if c in code_to_allergen])
            ing.save()
            added += 1
        self.stdout.write(self.style.SUCCESS(f"Demo ingredients ready (created/updated {added})."))
