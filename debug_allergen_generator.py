import os
import django
import sys

# Setup Django environment
sys.path.append(os.getcwd())
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings.dev')
django.setup()

from core.models import Dish, Section, Menu, Allergen
from core.dictionary_models import KeywordLexeme
from core.services.allergen_rules import generate_for_dishes, _resolve_lexemes, normalize_text, _match_plain
from django.contrib.auth import get_user_model

User = get_user_model()

def run_debug():
    print("🧪 Starting Allergen Generator Debug...")
    
    # 1. Setup Data
    user, _ = User.objects.get_or_create(username='debug_user')
    menu, _ = Menu.objects.get_or_create(name='Debug Menu', user=user)
    section, _ = Section.objects.get_or_create(name='Pizzen', menu=menu, user=user)
    
    # Ensure Allergens exist
    allergen_a, _ = Allergen.objects.get_or_create(code='A', defaults={'name_de': 'Gluten'})
    allergen_g, _ = Allergen.objects.get_or_create(code='G', defaults={'name_de': 'Milch'})
    
    # Ensure Lexemes exist (Global or User)
    # Weizenmehl -> A
    lexeme_wheat, _ = KeywordLexeme.objects.get_or_create(
        term='Weizenmehl',
        lang='de',
        defaults={'owner': None, 'is_active': True}
    )
    lexeme_wheat.allergens.add(allergen_a)
    
    # Mozzarella -> G
    lexeme_mozz, _ = KeywordLexeme.objects.get_or_create(
        term='Mozzarella',
        lang='de',
        defaults={'owner': None, 'is_active': True}
    )
    lexeme_mozz.allergens.add(allergen_g)
    
    print(f"   Lexemes setup: Weizenmehl->A, Mozzarella->G")
    
    # Create Dish
    dish = Dish.objects.create(
        name="Pizza Margherita",
        description="Dünner Pizzateig aus Weizenmehl mit Tomatensoße, Mozzarella und frischem Rucola.",
        section=section,
        codes="",
        codes_source="generated"
    )
    print(f"   Created dish: {dish.name} (ID: {dish.id})")
    print(f"   Description: {dish.description}")
    
    # 2. Test Lexeme Resolution
    print("\n🔍 Testing Lexeme Resolution...")
    lexemes = _resolve_lexemes(owner_id=user.id, lang='de')
    print(f"   Found {len(lexemes)} lexemes for user {user.username} (lang='de')")
    
    found_wheat = any(l.term == 'Weizenmehl' for l in lexemes)
    found_mozz = any(l.term == 'Mozzarella' for l in lexemes)
    print(f"   - Weizenmehl found: {found_wheat}")
    print(f"   - Mozzarella found: {found_mozz}")
    
    if not found_wheat or not found_mozz:
        print("   ❌ CRITICAL: Lexemes not found in resolution!")
        
    # 3. Test Text Normalization & Matching
    print("\n🔍 Testing Matching Logic...")
    text = f"{dish.section.name} {dish.name} {dish.description}"
    text_norm = normalize_text(text)
    print(f"   Normalized text: '{text_norm}'")
    
    match_wheat = _match_plain(text_norm, normalize_text('Weizenmehl'))
    match_mozz = _match_plain(text_norm, normalize_text('Mozzarella'))
    print(f"   - Match 'Weizenmehl': {match_wheat}")
    print(f"   - Match 'Mozzarella': {match_mozz}")
    
    # 4. Run Generator
    print("\n🚀 Running Generator...")
    updated_count = generate_for_dishes([dish], owner_id=user.id, lang='de', force=True, dry_run=False)
    
    dish.refresh_from_db()
    print(f"   Updated count: {updated_count}")
    print(f"   Resulting codes: '{dish.codes}'")
    print(f"   Resulting source: '{dish.codes_source}'")
    
    if "A" in dish.codes and "G" in dish.codes:
        print("   ✅ SUCCESS: Generator found A and G.")
    else:
        print("   ❌ FAILURE: Generator missed codes.")

    # Cleanup
    dish.delete()
    # Don't delete lexemes/allergens as they might be used by others
    print("\n✨ Debug Complete!")

if __name__ == "__main__":
    run_debug()
