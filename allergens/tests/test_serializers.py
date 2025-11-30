# allergens/tests/test_serializers.py
"""
Tests for allergen serializers to verify they accept codes instead of IDs.
"""
from django.test import TestCase
from core.models import Allergen, Ingredient
from core.dictionary_models import KeywordLexeme
from allergens.serializers import KeywordLexemeSerializer, IngredientLiteSerializer
from django.contrib.auth import get_user_model

User = get_user_model()


class KeywordLexemeSerializerTests(TestCase):
    """Test KeywordLexemeSerializer accepts allergen codes and ingredient names."""

    def setUp(self):
        self.user = User.objects.create_user(username='testuser', email='test@example.com', password='testpass123')
        
        # Create allergens
        self.allergen_a = Allergen.objects.create(code='A', label_de='Gluten')
        self.allergen_g = Allergen.objects.create(code='G', label_de='Milch')
        
        # Create ingredient
        self.ingredient = Ingredient.objects.create(name='Mehl', owner=self.user)

    def test_serializer_accepts_allergen_codes(self):
        """Test that serializer accepts allergen codes (e.g., 'A', 'G') instead of IDs."""
        data = {
            'term': 'Käse',
            'lang': 'de',
            'allergens': ['A', 'G'],  # Using codes, not IDs
            'ingredient': None,
            'is_active': True,
        }
        
        serializer = KeywordLexemeSerializer(data=data)
        self.assertTrue(serializer.is_valid(), f"Serializer errors: {serializer.errors}")
        
        lexeme = serializer.save(owner=self.user)
        
        # Verify allergens were correctly mapped
        allergen_codes = set(lexeme.allergens.values_list('code', flat=True))
        self.assertEqual(allergen_codes, {'A', 'G'})

    def test_serializer_accepts_ingredient_name(self):
        """Test that serializer accepts ingredient name instead of ID."""
        data = {
            'term': 'Mehl',
            'lang': 'de',
            'allergens': ['A'],
            'ingredient': 'Mehl',  # Using name, not ID
            'is_active': True,
        }
        
        serializer = KeywordLexemeSerializer(data=data)
        self.assertTrue(serializer.is_valid(), f"Serializer errors: {serializer.errors}")
        
        lexeme = serializer.save(owner=self.user)
        
        # Verify ingredient was correctly mapped
        self.assertEqual(lexeme.ingredient.name, 'Mehl')

    def test_serializer_output_uses_codes(self):
        """Test that serializer output returns codes, not IDs."""
        lexeme = KeywordLexeme.objects.create(
            term='Käse',
            lang='de',
            owner=self.user,
            normalized_term='käse'
        )
        lexeme.allergens.set([self.allergen_a, self.allergen_g])
        lexeme.ingredient = self.ingredient
        lexeme.save()
        
        serializer = KeywordLexemeSerializer(lexeme)
        data = serializer.data
        
        # Should return codes, not IDs
        self.assertEqual(set(data['allergens']), {'A', 'G'})
        self.assertEqual(data['ingredient'], 'Mehl')


class IngredientLiteSerializerTests(TestCase):
    """Test IngredientLiteSerializer accepts allergen codes."""

    def setUp(self):
        self.user = User.objects.create_user(username='testuser', email='test@example.com', password='testpass123')
        
        # Create allergens
        self.allergen_a = Allergen.objects.create(code='A', label_de='Gluten')
        self.allergen_c = Allergen.objects.create(code='C', label_de='Eier')

    def test_serializer_accepts_allergen_codes(self):
        """Test that serializer accepts allergen codes instead of IDs."""
        data = {
            'name': 'Brot',
            'allergens': ['A', 'C'],  # Using codes, not IDs
            'additives': [],
            'synonyms': [],
        }
        
        serializer = IngredientLiteSerializer(data=data)
        self.assertTrue(serializer.is_valid(), f"Serializer errors: {serializer.errors}")
        
        ingredient = serializer.save(owner=self.user)
        
        # Verify allergens were correctly mapped
        allergen_codes = set(ingredient.allergens.values_list('code', flat=True))
        self.assertEqual(allergen_codes, {'A', 'C'})

    def test_serializer_output_uses_codes(self):
        """Test that serializer output returns codes, not IDs."""
        ingredient = Ingredient.objects.create(name='Brot', owner=self.user)
        ingredient.allergens.set([self.allergen_a, self.allergen_c])
        
        serializer = IngredientLiteSerializer(ingredient)
        data = serializer.data
        
        # Should return codes, not IDs
        self.assertEqual(set(data['allergens']), {'A', 'C'})
