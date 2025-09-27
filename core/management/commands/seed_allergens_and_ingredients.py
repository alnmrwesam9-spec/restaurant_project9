from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from core.models import Allergen, Ingredient

ALLERGENS = [
    ("A", "Gluten"), ("B", "Krebstiere"), ("C", "Eier"), ("D", "Fisch"),
    ("E", "Erdnüsse"), ("F", "Soja"), ("G", "Milch (einschl. Laktose)"),
    ("H", "Schalenfrüchte"), ("I", "Sellerie"), ("J", "Senf"),
    ("K", "Sesam"), ("L", "Schwefeldioxid/Sulfite"), ("M", "Lupinen"),
    ("N", "Weichtiere"), ("O", "Gerste"), ("P", "Roggen"),
    ("Q", "Hafer"), ("R", "Dinkel"),
]

INGREDIENTS = [
    ("Weizen/Brot", ["A"], [
        "weizen","weizenmehl","brot","brötchen","baguette","toast","pizzabrot","fladenbrot",
        "pasta","nudeln","spaghetti","penne","farfalle","fussili","tagliatelle",
        "teig","paniermehl","semmelbrösel","mehl","kuchen","waffel","pfannkuchen",
        "قمح","دقيق","خبز","معكرونة","مكرونة"
    ]),
    ("Gerste", ["A","O"], ["gerste","gerstenmalz","malz","bier","malt"]),
    ("Roggen", ["A","P"], ["roggen","roggenbrot"]),
    ("Hafer", ["A","Q"], ["hafer","haferflocken","oats","porridge"]),
    ("Dinkel", ["A","R"], ["dinkel","spelt"]),
    ("Ei", ["C"], ["ei","eier","egg","omelett","omelette","spiegelei","rührei","بيض"]),
    ("Milch", ["G"], ["milch","milk","laktose","lactose","buttermilch","حليب"]),
    ("Käse", ["G"], ["käse","cheese","gouda","mozzarella","emmentaler","cheddar","feta","parmesan","جبن"]),
    ("Butter", ["G"], ["butter","butterschmalz","ghee","زبدة","سمن"]),
    ("Joghurt", ["G"], ["joghurt","yogurt","لبن","زبادي","آيران","ayran"]),
    ("Fisch", ["D"], ["fisch","lachs","thunfisch","forelle","fischfilet","سمك","تونة","سلمون"]),
    ("Krebstiere", ["B"], ["garnelen","shrimp","krabben","scampi","krebs","جمبري","روبيان"]),
    ("Weichtiere", ["N"], ["muschel","miesmuschel","auster","tintenfisch","kalmar","sepia","octopus","squid","محار","كاليماري"]),
    ("Erdnüsse", ["E"], ["erdnuss","erdnüsse","peanut","peanuts","فول سوداني","سوداني"]),
    ("Soja", ["F"], ["soja","sojasauce","tofu","edamame","misopaste","soy","صلصة الصويا","صويا"]),
    ("Sesam", ["K"], ["sesam","sesamöl","tahini","tahin","سمسم","طحينة"]),
    ("Senf", ["J"], ["senf","mustard","dijon","خردل"]),
    ("Sellerie", ["I"], ["sellerie","celery","كرفس"]),
    ("Schalenfrüchte", ["H"], [
        "nuss","nüsse","haselnuss","haselnüsse","walnuss","mandel","pistazie","cashew","pekannuss",
        "macadamia","brazil nut","nuts","جوز","لوز","فستق","بندق","كاجو","بيكان","مكاداميا"
    ]),
    ("Sulfite", ["L"], ["sulfite","schwefeldioxid","konserviert","e220","e221","e222","e223","e224","e226","e227","e228"]),
    ("Lupinen", ["M"], ["lupine","lupinenmehl","lupin"]),
    ("Honig", [], ["honig","honey","عسل"]),
    ("Sesampaste/Tahini", ["K"], ["tahini","tahin","sesampaste"]),
    ("Schokolade", ["G"], ["schokolade","kakao","chocolate","شوكولا","كاكاو"]),
]

def upsert_for_owner(owner):
    # Allergens
    created = 0
    for code, label in ALLERGENS:
        _, c = Allergen.objects.get_or_create(code=code, defaults={"label_de": label})
        if c: created += 1

    code_map = {a.code: a for a in Allergen.objects.all()}
    added = 0
    for name, codes, synonyms in INGREDIENTS:
        ing, _ = Ingredient.objects.get_or_create(owner=owner, name=name)
        ing.synonyms = sorted(set([s.lower().strip() for s in synonyms if s]))
        ing.save()
        if codes:
            ing.allergens.set([code_map[c] for c in codes if c in code_map])
        ing.save()
        added += 1
    return created, added

class Command(BaseCommand):
    help = "Seed allergens and ingredients. Choose one: --owner-id / --owner-username / --all-owners"

    def add_arguments(self, parser):
        parser.add_argument("--owner-id", type=int)
        parser.add_argument("--owner-username", type=str)
        parser.add_argument("--all-owners", action="store_true")

    def handle(self, *args, **opts):
        User = get_user_model()

        owners = []
        if opts.get("all_owners"):
            owners = list(User.objects.filter(role="owner"))
            if not owners:
                self.stdout.write(self.style.WARNING("No users with role=owner found."))
                return
        elif opts.get("owner_id"):
            try:
                owners = [User.objects.get(pk=opts["owner_id"])]
            except User.DoesNotExist:
                self.stdout.write(self.style.ERROR(f"Owner user id {opts['owner_id']} not found."))
                return
        elif opts.get("owner_username"):
            try:
                owners = [User.objects.get(username=opts["owner_username"])]
            except User.DoesNotExist:
                self.stdout.write(self.style.ERROR(f"Owner username '{opts['owner_username']}' not found."))
                return
        else:
            self.stdout.write(self.style.ERROR("Provide --owner-id or --owner-username or --all-owners"))
            return

        # Ensure allergens once (shared)
        created_allergens = 0
        for code, label in ALLERGENS:
            _, c = Allergen.objects.get_or_create(code=code, defaults={"label_de": label})
            if c: created_allergens += 1
        self.stdout.write(self.style.SUCCESS(f"Allergens ready (created {created_allergens})."))

        total_added = 0
        for o in owners:
            _, added = upsert_for_owner(o)
            total_added += added
            self.stdout.write(self.style.SUCCESS(f"Owner {o.id} ({o.username}): ingredients upserted {added}"))

        self.stdout.write(self.style.SUCCESS(f"Done. Owners processed: {len(owners)}"))
