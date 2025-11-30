from django.db import migrations

def migrate_additives(apps, schema_editor):
    AdditiveLegend = apps.get_model('core', 'AdditiveLegend')
    Allergen = apps.get_model('core', 'Allergen')
    Ingredient = apps.get_model('core', 'Ingredient')

    # 1. Migrate AdditiveLegend -> Allergen
    for additive in AdditiveLegend.objects.all():
        # Clean code: remove 'E' prefix if present
        raw_code = (additive.code or "").strip().upper()
        if raw_code.startswith("E"):
            clean_code = raw_code[1:]
        else:
            clean_code = raw_code
        
        if not clean_code:
            continue

        # Create or update Allergen
        # We use update_or_create to avoid duplicates if run multiple times
        Allergen.objects.update_or_create(
            code=clean_code,
            kind='ADDITIVE',
            defaults={
                'label_de': additive.label_de,
                'label_en': additive.label_en,
                'label_ar': additive.label_ar,
            }
        )

    # 2. Migrate Ingredient.additives (JSON) -> Ingredient.allergens (M2M)
    # Note: Ingredient.allergens is a ManyToManyField
    for ingredient in Ingredient.objects.all():
        additives_list = ingredient.additives or []
        if not additives_list:
            continue
        
        for code in additives_list:
            clean_code = str(code).strip().upper()
            if clean_code.startswith("E"):
                clean_code = clean_code[1:]
            
            # Find the allergen
            try:
                allergen = Allergen.objects.get(code=clean_code, kind='ADDITIVE')
                ingredient.allergens.add(allergen)
            except Allergen.DoesNotExist:
                pass

def reverse_migrate_additives(apps, schema_editor):
    # Optional: Logic to reverse migration if needed
    # For now, we just delete Allergens with kind='ADDITIVE'
    Allergen = apps.get_model('core', 'Allergen')
    Allergen.objects.filter(kind='ADDITIVE').delete()

class Migration(migrations.Migration):

    dependencies = [
        ('core', '0028_alter_allergen_options_allergen_kind_and_more'),
    ]

    operations = [
        migrations.RunPython(migrate_additives, reverse_migrate_additives),
    ]
