from django.test import TestCase
from core.models import Dish, Section, Menu, User, Allergen, Ingredient
from core.dictionary_models import KeywordLexeme
from core.services.allergen_rules import generate_for_dishes

class AllergenRulesSectionTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="testuser", password="password")
        self.menu = Menu.objects.create(user=self.user, name="Test Menu")
        self.section = Section.objects.create(name="Getränke", menu=self.menu, user=self.user)
        
        # Create Allergen G (Milk)
        self.allergen_g = Allergen.objects.create(code="G", label_de="Milch")
        
        # Create a Lexeme that matches "Getränke" -> G (just for testing purposes)
        # In reality, "Getränke" might imply something else, but we want to test that the word is picked up.
        self.lexeme = KeywordLexeme.objects.create(
            term="Getränke",
            lang="de",
            is_active=True,
            owner=self.user
        )
        self.lexeme.allergens.add(self.allergen_g)

    def test_section_name_triggers_rule(self):
        """
        Test that a dish with an empty name/description but in a section named "Getränke"
        triggers the rule for "Getränke" and assigns allergen G.
        """
        dish = Dish.objects.create(
            section=self.section,
            name="Wasser", # "Wasser" shouldn't trigger G by itself
            description=""
        )
        
        # Run generation
        result = generate_for_dishes([dish], owner_id=self.user.id, force=True, dry_run=False)
        
        # Refresh dish
        dish.refresh_from_db()
        
        # Check if G is in generated codes
        self.assertIn("G", dish.generated_codes)
        self.assertIn("G", dish.display_codes)
        
        # Verify it came from the section name (implicit via the lexeme match)
        # We can check the result details if we ran with include_details=True, 
        # but checking the final code is sufficient for this integration test.

    def test_section_name_combined_with_dish_text(self):
        """
        Test that section name is combined with dish name/description.
        Section: "Dessert" (mapped to A)
        Dish: "Eis" (mapped to G)
        Result should be A,G.
        """
        # Setup
        allergen_a = Allergen.objects.create(code="A", label_de="Gluten")
        
        # Lexeme for Section
        l_sec = KeywordLexeme.objects.create(term="Dessert", lang="de", is_active=True, owner=self.user)
        l_sec.allergens.add(allergen_a)
        
        # Lexeme for Dish Name
        l_dish = KeywordLexeme.objects.create(term="Eis", lang="de", is_active=True, owner=self.user)
        l_dish.allergens.add(self.allergen_g)
        
        section_dessert = Section.objects.create(name="Dessert", menu=self.menu, user=self.user)
        dish = Dish.objects.create(
            section=section_dessert,
            name="Eis",
            description="Lecker"
        )
        
        generate_for_dishes([dish], owner_id=self.user.id, force=True, dry_run=False)
        dish.refresh_from_db()
        
        self.assertIn("A", dish.generated_codes)
        self.assertIn("G", dish.generated_codes)

