# allergens/tests/test_api.py
"""
API tests for German-only allergen endpoints:
- Manual assignment endpoint
- Generation endpoint
- Allergen catalog (German-only)
"""
from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status
from core.models import Allergen, Menu, Section, Dish, DishAllergen, Ingredient

User = get_user_model()


class ManualAllergenAssignmentAPITests(TestCase):
    """Test PUT /api/dishes/{id}/manual-allergens/ endpoint."""

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='testuser',
            email='api-manual-test@example.com',
            password='testpass123'
        )
        self.client.force_authenticate(user=self.user)

        # Create allergens
        self.allergen_a = Allergen.objects.create(code='A', label_de='Gluten')
        self.allergen_c = Allergen.objects.create(code='C', label_de='Eier')
        self.allergen_g = Allergen.objects.create(code='G', label_de='Milch')

        # Create test dish
        self.menu = Menu.objects.create(name='Test Menu', user=self.user)
        self.section = Section.objects.create(
            name='Gerichte',
            menu=self.menu,
            user=self.user
        )
        self.dish = Dish.objects.create(
            name='Test Dish',
            section=self.section
        )

    def test_manual_assignment_creates_rows(self):
        """Test that manual assignment creates DishAllergen rows."""
        url = f'/api/dishes/{self.dish.id}/manual-allergens/'
        data = {'allergen_ids': [self.allergen_a.id, self.allergen_g.id]}

        response = self.client.put(url, data, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Check DishAllergen rows were created
        manual_rows = DishAllergen.objects.filter(
            dish=self.dish,
            source=DishAllergen.Source.MANUAL
        )
        self.assertEqual(manual_rows.count(), 2)
        
        # Check rows have correct fields
        for row in manual_rows:
            self.assertTrue(row.is_confirmed)
            self.assertEqual(row.confidence, 1.0)
            self.assertEqual(row.rationale, 'Manual selection')

    def test_manual_assignment_updates_backward_compat_fields(self):
        """Test that manual_codes and has_manual_codes are updated."""
        url = f'/api/dishes/{self.dish.id}/manual-allergens/'
        data = {'allergen_ids': [self.allergen_a.id, self.allergen_g.id]}

        response = self.client.put(url, data, format='json')

        self.dish.refresh_from_db()
        self.assertTrue(self.dish.has_manual_codes)
        self.assertIn('A', self.dish.manual_codes)
        self.assertIn('G', self.dish.manual_codes)

    def test_manual_assignment_removes_unselected(self):
        """Test that unselected allergens are removed."""
        # Start with A and C
        DishAllergen.objects.create(
            dish=self.dish,
            allergen=self.allergen_a,
            source=DishAllergen.Source.MANUAL
        )
        DishAllergen.objects.create(
            dish=self.dish,
            allergen=self.allergen_c,
            source=DishAllergen.Source.MANUAL
        )

        # Update to only A and G (remove C, add G)
        url = f'/api/dishes/{self.dish.id}/manual-allergens/'
        data = {'allergen_ids': [self.allergen_a.id, self.allergen_g.id]}

        response = self.client.put(url, data, format='json')

        manual_rows = DishAllergen.objects.filter(
            dish=self.dish,
            source=DishAllergen.Source.MANUAL
        )
        codes = {row.allergen.code for row in manual_rows}
        
        self.assertIn('A', codes)
        self.assertIn('G', codes)
        self.assertNotIn('C', codes)

    def test_permission_denied_for_other_users_dish(self):
        """Test that users can't modify other users' dishes."""
        other_user = User.objects.create_user(
            username='otheruser',
            email='other@example.com',
            password='testpass123'
        )
        other_menu = Menu.objects.create(name='Other Menu', user=other_user)
        other_section = Section.objects.create(
            name='Other',
            menu=other_menu,
            user=other_user  # ← ADDED
        )
        other_dish = Dish.objects.create(name='Other Dish', section=other_section)

        url = f'/api/dishes/{other_dish.id}/manual-allergens/'
        data = {'allergen_ids': [self.allergen_a.id]}

        response = self.client.put(url, data, format='json')

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


class AllergenGenerationAPITests(TestCase):
    """Test POST /allergens/generate/ endpoint."""

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='testuser',
            email='api-generation-test@example.com',
            password='testpass123'
        )
        self.client.force_authenticate(user=self.user)

        # Create allergens and ingredients
        self.allergen_a = Allergen.objects.create(code='A', label_de='Gluten')
        self.ingredient = Ingredient.objects.create(name='Mehl', owner=self.user)
        self.ingredient.allergens.add(self.allergen_a)

        # Create test dishes
        self.menu = Menu.objects.create(name='Test Menu', user=self.user)
        self.section = Section.objects.create(
            name='Gerichte', 
            menu=self.menu,
            user=self.user
        )
        self.dish1 = Dish.objects.create(name='Brot', section=self.section)
        self.dish1.ingredients.add(self.ingredient)
        self.dish2 = Dish.objects.create(name='Salat', section=self.section)

    def test_generation_endpoint_calls_service(self):
        """Test that generation endpoint calls the rule-based service."""
        url = '/api/allergens/generate/'
        data = {
            'dish_ids': [self.dish1.id, self.dish2.id],
            'force_regenerate': False,
            'use_llm': False
        }

        response = self.client.post(url, data, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('rules', response.data)
        
        # Check rules result structure
        rules = response.data['rules']
        self.assertIn('processed', rules)
        self.assertIn('items', rules)

    def test_generation_creates_dishallergen_rows(self):
        """Test that generation creates DishAllergen rows."""
        url = '/api/allergens/generate/'
        data = {
            'dish_ids': [self.dish1.id],
            'force_regenerate': False
        }

        response = self.client.post(url, data, format='json')

        # Check DishAllergen rows were created for dish1
        rows = DishAllergen.objects.filter(dish=self.dish1)
        self.assertTrue(rows.exists())
        self.assertEqual(rows.first().allergen, self.allergen_a)


class AllergenCatalogAPITests(TestCase):
    """Test German-only allergen catalog endpoints."""

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='testuser',
            email='api-catalog-test@example.com',
            password='testpass123'
        )
        self.client.force_authenticate(user=self.user)

        # Create allergens with all language fields
        Allergen.objects.create(
            code='A',
            label_de='Glutenhaltiges Getreide',
            label_en='Gluten',
            label_ar='الغلوتين'
        )

    def test_allergen_catalog_returns_german_only(self):
        """Test that /allergens/codes/ returns only German fields."""
        url = '/api/allergens/codes/'
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Check response structure
        results = response.data.get('results', response.data)
        self.assertTrue(len(results) > 0)
        
        allergen = results[0]
        # Should have German-only fields
        self.assertIn('id', allergen)
        self.assertIn('code', allergen)
        self.assertIn('name_de', allergen)
        
        # Should NOT have EN/AR fields
        self.assertNotIn('name_en', allergen)
        self.assertNotIn('name_ar', allergen)
        self.assertNotIn('label_en', allergen)
        self.assertNotIn('label_ar', allergen)
