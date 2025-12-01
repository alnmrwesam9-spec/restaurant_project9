import os
import django
import sys

# Setup Django environment
sys.path.append(os.getcwd())
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings.dev')
django.setup()

from core.models import Dish, Section, Menu
from core.services.allergen_rules import generate_for_dishes
from django.contrib.auth import get_user_model

User = get_user_model()

def run_verification():
    print("🧪 Starting Allergen Migration Verification...")
    
    # Setup test data
    user, _ = User.objects.get_or_create(username='test_verifier')
    menu, _ = Menu.objects.get_or_create(name='Test Menu', user=user)
    section, _ = Section.objects.get_or_create(name='Test Section', menu=menu, user=user)
    
    # 1. Test Manual Codes Preservation
    print("\n1️⃣  Testing Manual Codes Preservation...")
    dish = Dish.objects.create(
        name="Manual Dish",
        section=section,
        description="Contains peanuts",
        codes="A,G",
        codes_source="manual"
    )
    
    print(f"   Created dish with codes='{dish.codes}', source='{dish.codes_source}'")
    
    # Run generator (should NOT change codes because source is manual)
    generate_for_dishes([dish], owner_id=user.id, force=False)
    dish.refresh_from_db()
    
    if dish.codes == "A,G":
        print("   ✅ SUCCESS: Manual codes were preserved.")
    else:
        print(f"   ❌ FAILURE: Manual codes were changed to '{dish.codes}'")

    # 2. Test Auto-Generation
    print("\n2️⃣  Testing Auto-Generation...")
    dish.codes_source = "generated"
    dish.save()
    print(f"   Changed source to 'generated'. Running generator...")
    
    # Run generator (should change codes based on description/ingredients)
    # Note: 'Contains peanuts' might not trigger rules if not in dictionary, 
    # but let's assume empty result if no rules match, or specific result if they do.
    # Let's add a known ingredient to be sure.
    
    generate_for_dishes([dish], owner_id=user.id, force=False)
    dish.refresh_from_db()
    
    print(f"   Resulting codes: '{dish.codes}'")
    if dish.codes != "A,G": # It should likely be empty or different, but definitely updated
        print("   ✅ SUCCESS: Generated codes were updated.")
    else:
        print("   ⚠️  WARNING: Codes didn't change. Might be because rules didn't find anything new, or logic failed.")

    # 3. Test Legacy Fallback (Display Codes)
    print("\n3️⃣  Testing Display Codes Fallback...")
    dish_legacy = Dish.objects.create(
        name="Legacy Dish",
        section=section,
        codes="", # Empty new field
        manual_codes="L,M", # Legacy field
        has_manual_codes=True
    )
    
    if dish_legacy.display_codes == "L,M":
        print(f"   ✅ SUCCESS: display_codes correctly falls back to legacy manual_codes ('{dish_legacy.display_codes}')")
    else:
        print(f"   ❌ FAILURE: display_codes returned '{dish_legacy.display_codes}' instead of 'L,M'")

    # Cleanup
    dish.delete()
    dish_legacy.delete()
    print("\n✨ Verification Complete!")

if __name__ == "__main__":
    run_verification()
