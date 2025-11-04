from django.test import TestCase  # noqa
from django.urls import reverse  # noqa
from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase, APIClient
from rest_framework import status

from uuid import uuid4

from core.models import Menu, Section, Dish

TOKEN_URL = "/api/token/"
REFRESH_URL = "/api/token/refresh/"
MENUS_URL = "/api/menus"
SECTIONS_URL = "/api/sections"
DISHES_URL = "/api/dishes"

User = get_user_model()


def jwt_auth_header(client: APIClient, username: str, password: str) -> dict:
    """Obtain JWT and return Authorization header."""
    res = client.post(TOKEN_URL, {"username": username, "password": password}, format="json")
    assert res.status_code == 200, f"Token failed for {username}: {res.status_code} {res.content}"
    return {"HTTP_AUTHORIZATION": f"Bearer {res.data['access']}"}


class PermissionSmokeTests(APITestCase):
    """
    Tests cover:
    1) Default 401 without token
    2) Owner cannot link/create under another owner's resources (403)
    3) Admin can perform the same actions (200/201)
    4) Token endpoints work without auth
    """

    @classmethod
    def setUpTestData(cls):
        # Users (أسماء فريدة لتجنّب التضارب بين تشغيلات مختلفة)
        cls.owner_a = User.objects.create_user(
            username=f"owner_a_{uuid4().hex[:6]}", password="pass1234", role="owner"
        )
        cls.owner_b = User.objects.create_user(
            username=f"owner_b_{uuid4().hex[:6]}", password="pass1234", role="owner"
        )

        # Admin قد يكون موجودًا من seed/migrations — نجعله idempotent
        admin_defaults = dict(role="admin", is_staff=True, is_superuser=True, is_active=True)
        cls.admin, created = User.objects.get_or_create(username="admin", defaults=admin_defaults)
        if not created:
            # تأكيد الأعلام وكلمة السر للّوغين عبر التوكن
            for k, v in admin_defaults.items():
                setattr(cls.admin, k, v)
            cls.admin.set_password("pass1234")
            cls.admin.save()

        # Data for owner A
        cls.menu_a = Menu.objects.create(user=cls.owner_a, name="Menu A")
        cls.section_a = Section.objects.create(user=cls.owner_a, menu=cls.menu_a, name="Section A")
        cls.dish_a = Dish.objects.create(section=cls.section_a, name="Dish A")

        # Data for owner B
        cls.menu_b = Menu.objects.create(user=cls.owner_b, name="Menu B")
        cls.section_b = Section.objects.create(user=cls.owner_b, menu=cls.menu_b, name="Section B")
        cls.dish_b = Dish.objects.create(section=cls.section_b, name="Dish B")

    def test_000_token_endpoints_allow_any(self):
        # Should work without Authorization header
        res = self.client.post(TOKEN_URL, {"username": self.owner_a.username, "password": "pass1234"}, format="json")
        self.assertEqual(res.status_code, 200)

        # Refresh requires a refresh token; here we just check endpoint exists (400 if body wrong is fine)
        res2 = self.client.post(REFRESH_URL, {"refresh": "invalid"}, format="json")
        self.assertIn(res2.status_code, (200, 401, 400))

    def test_010_default_requires_authentication(self):
        # No token -> 401
        res = self.client.get(MENUS_URL)
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_020_owner_cannot_create_section_under_others_menu(self):
        # Login as owner A
        headers = jwt_auth_header(self.client, self.owner_a.username, "pass1234")

        payload = {"name": "X", "menu": self.menu_b.id}  # menu belongs to owner B
        res = self.client.post(SECTIONS_URL, payload, format="json", **headers)
        self.assertIn(res.status_code, (status.HTTP_400_BAD_REQUEST, status.HTTP_403_FORBIDDEN))

    def test_030_owner_cannot_create_dish_under_others_section(self):
        headers = jwt_auth_header(self.client, self.owner_a.username, "pass1234")

        payload = {"name": "Y", "section": self.section_b.id}  # section belongs to owner B
        res = self.client.post(DISHES_URL, payload, format="json", **headers)
        self.assertIn(res.status_code, (status.HTTP_400_BAD_REQUEST, status.HTTP_403_FORBIDDEN))

    def test_040_owner_cannot_move_dish_to_others_section(self):
        headers = jwt_auth_header(self.client, self.owner_a.username, "pass1234")

        # Dish A belongs under section_a (owner A). Try moving to section_b (owner B)
        url = f"{DISHES_URL}/{self.dish_a.id}"
        payload = {"section": self.section_b.id}
        # ✅ خيار A (مستحسن): PATCH JSON بهيدرز التوكن
        res = self.client.patch(url, payload, format="json", **headers)
        self.assertIn(res.status_code, (status.HTTP_400_BAD_REQUEST, status.HTTP_403_FORBIDDEN))

    def test_050_admin_can_create_section_any_menu(self):
        headers = jwt_auth_header(self.client, "admin", "pass1234")

        payload = {"name": "Admin-Section-on-B", "menu": self.menu_b.id}
        res = self.client.post(SECTIONS_URL, payload, format="json", **headers)
        self.assertIn(res.status_code, (status.HTTP_201_CREATED, status.HTTP_200_OK))

    def test_060_admin_can_create_dish_any_section(self):
        headers = jwt_auth_header(self.client, "admin", "pass1234")

        payload = {"name": "Admin-Dish-on-B", "section": self.section_b.id}
        res = self.client.post(DISHES_URL, payload, format="json", **headers)
        self.assertIn(res.status_code, (status.HTTP_201_CREATED, status.HTTP_200_OK))

    def test_070_admin_can_move_dish_between_owners(self):
        headers = jwt_auth_header(self.client, "admin", "pass1234")

        url = f"{DISHES_URL}/{self.dish_a.id}"
        payload = {"section": self.section_b.id}
        # ✅ خيار A (مستحسن): PATCH JSON بهيدرز التوكن
        res = self.client.patch(url, payload, format="json", **headers)
        self.assertIn(res.status_code, (status.HTTP_200_OK, status.HTTP_202_ACCEPTED))
