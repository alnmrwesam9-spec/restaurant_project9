# core/tests/test_allergen_workflow.py
"""
Tests for German-only allergen workflow:
- Rule-based generation (ingredients + lexemes)
- Manual assignment
- Display codes and explanations
"""
from django.test import TestCase
from django.contrib.auth import get_user_model
from core.models import Allergen, Menu, Section, Dish, Ingredient, DishAllergen
from core.dictionary_models import KeywordLexeme
from core.services.allergen_rules import generate_for_dishes

User = get_user_model()


class AllergenRuleBasedGenerationTests(TestCase):
    """Test rule-based allergen generation with ingredients and lexemes."""

    def setUp(self):
        # Create test user
        self.user = User.objects.create_user(
            username='testuser',
            email='allergen-test@example.com',
            password='testpass123'
        )

        # Create allergens (German-only)
        self.allergen_a = Allergen.objects.create(
            code='A',
            label_de='Glutenhaltiges Getreide',
            label_en='Gluten',
            label_ar=''
        )
        self.allergen_c = Allergen.objects.create(
            code='C',
            label_de='Eier',
            label_en='Eggs',
            label_ar=''
        )
        self.allergen_g = Allergen.objects.create(
            code='G',
            label_de='Milch (einschl. Laktose)',
            label_en='Milk',
            label_ar=''
        )

        # Create ingredients with allergens
        self.ingredient_flour = Ingredient.objects.create(
            name='Weizenmehl',
            owner=self.user
        )
        self.ingredient_flour.allergens.add(self.allergen_a)

        self.ingredient_butter = Ingredient.objects.create(
            name='Butter',
            owner=self.user
        )
        self.ingredient_butter.allergens.add(self.allergen_g)

        # Create lexemes for pattern matching
        self.lexeme_parmesan = KeywordLexeme.objects.create(
            term='parmesan',
            lang='de',
            is_regex=False,
            owner=self.user,
            priority=10,
            weight=0.8,
            is_active=True
        )
        self.lexeme_parmesan.allergens.add(self.allergen_a, self.allergen_g)

        # Create test menu structure
        self.menu = Menu.objects.create(name='Test Menu', user=self.user)
        self.section = Section.objects.create(
            name='Hauptgerichte',
            menu=self.menu,
            user=self.user
        )

    def test_ingredient_based_detection(self):
        """Test allergen detection from linked ingredients."""
        dish = Dish.objects.create(
            name='Brot',
            description='Frisches Brot',
            section=self.section
        )
        dish.ingredients.add(self.ingredient_flour)

        result = generate_for_dishes(
            [dish],
            owner_id=self.user.id,
            lang='de',
            force=False,
            dry_run=False
        )

        # Verify DishAllergen row was created
        dish_allergens = DishAllergen.objects.filter(dish=dish)
        self.assertEqual(dish_allergens.count(), 1)
        self.assertEqual(dish_allergens.first().allergen, self.allergen_a)
        self.assertEqual(dish_allergens.first().source, DishAllergen.Source.INGREDIENT)
        self.assertTrue('Weizenmehl' in dish_allergens.first().rationale)

        # Verify results
        self.assertEqual(result['processed'], 1)
        self.assertEqual(result['changed'], 1)

    def test_lexeme_based_detection(self):
        """Test allergen detection from text matching with lexemes."""
        dish = Dish.objects.create(
            name='Pasta mit Parmesan',
            description='Leckere Nudeln mit geriebenem Parmesan',
            section=self.section
        )

        result = generate_for_dishes(
            [dish],
            owner_id=self.user.id,
            lang='de',
            force=False,
            dry_run=False
        )

        # Verify DishAllergen rows were created (A and G from "parmesan" lexeme)
        dish_allergens = DishAllergen.objects.filter(dish=dish).order_by('allergen__code')
        self.assertEqual(dish_allergens.count(), 2)
        codes = [da.allergen.code for da in dish_allergens]
        self.assertIn('A', codes)
        self.assertIn('G', codes)
        
        # Check that source is REGEX
        for da in dish_allergens:
            self.assertEqual(da.source, DishAllergen.Source.REGEX)

    def test_manual_override_respected(self):
        """Test that manual codes are NOT overridden unless force=True."""
        dish = Dish.objects.create(
            name='Pasta',
            description='Mit Parmesan',
            section=self.section,
            has_manual_codes=True,
            manual_codes='A'
        )
        # Create manual DishAllergen row
        DishAllergen.objects.create(
            dish=dish,
            allergen=self.allergen_a,
            source=DishAllergen.Source.MANUAL,
            is_confirmed=True,
            confidence=1.0
        )

        # Run generation WITHOUT force
        result = generate_for_dishes(
            [dish],
            owner_id=self.user.id,
            lang='de',
            force=False,
            dry_run=False
        )

        # Should skip this dish
        self.assertEqual(result['skipped'], 1)
        
        # Manual row should still exist
        manual_count = DishAllergen.objects.filter(
            dish=dish,
            source=DishAllergen.Source.MANUAL
        ).count()
        self.assertEqual(manual_count, 1)

    def test_force_regenerate_overrides_manual(self):
        """Test that force=True overrides manual codes."""
        dish = Dish.objects.create(
            name='Butterbrot',
            description='Brot mit Butter',
            section=self.section,
            has_manual_codes=True,
            manual_codes='A'
        )
        dish.ingredients.add(self.ingredient_butter)  # Should add G

        # Create manual DishAllergen row (only A)
        DishAllergen.objects.create(
            dish=dish,
            allergen=self.allergen_a,
            source=DishAllergen.Source.MANUAL,
            is_confirmed=True
        )

        # Run generation WITH force
        result = generate_for_dishes(
            [dish],
            owner_id=self.user.id,
            lang='de',
            force=True,
            dry_run=False
        )

        # Should process this dish
        self.assertEqual(result['processed'], 1)
        
        # Should now have rows from ingredients (G from butter)
        ingredient_rows = DishAllergen.objects.filter(
            dish=dish,
            source=DishAllergen.Source.INGREDIENT
        )
        self.assertTrue(ingredient_rows.exists())


class DishDisplayCodesTests(TestCase):
    """Test display_codes property and allergen_explanation_de."""

    def setUp(self):
        self.user = User.objects.create_user(
            username='testuser',
            email='display-test@example.com',
            password='testpass123'
        )
        
        self.allergen_a = Allergen.objects.create(
            code='A',
            label_de='Glutenhaltiges Getreide'
        )
        self.allergen_g = Allergen.objects.create(
            code='G',
            label_de='Milch (einschl. Laktose)'
        )
        
        self.menu = Menu.objects.create(name='Test Menu', user=self.user)
        self.section = Section.objects.create(
            name='Gerichte',
            menu=self.menu,
            user=self.user
        )

    def test_display_codes_from_manual(self):
        """Test display_codes returns manual codes when set."""
        dish = Dish.objects.create(
            name='Test Dish',
            section=self.section,
            has_manual_codes=True,
            manual_codes='A,G'
        )
        
        # Manual codes take priority
        self.assertEqual(dish.display_codes, 'A,G')

    def test_display_codes_from_dishallergen_rows(self):
        """Test display_codes builds from DishAllergen rows."""
        dish = Dish.objects.create(
            name='Test Dish',
            section=self.section
        )
        
        DishAllergen.objects.create(
            dish=dish,
            allergen=self.allergen_a,
            source=DishAllergen.Source.INGREDIENT
        )
        DishAllergen.objects.create(
            dish=dish,
            allergen=self.allergen_g,
            source=DishAllergen.Source.REGEX
        )
        
        # Should build codes from rows
        codes = dish.display_codes
        self.assertIn('A', codes)
        self.assertIn('G', codes)

    def test_allergen_explanation_de_format(self):
        """Test German explanation is correctly formatted."""
        from core.serializers import _build_explanation_de_from_codes
        
        explanation = _build_explanation_de_from_codes(['A', 'G'], {
            'A': 'Glutenhaltiges Getreide',
            'G': 'Milch (einschl. Laktose)'
        })
        
        # Should be German sentence
        self.assertIn('Enthält', explanation)
        self.assertIn('Glutenhaltiges Getreide', explanation)
        self.assertIn('Milch', explanation)
