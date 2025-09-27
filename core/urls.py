# core/urls.py
# -----------------------------------------------
# تعريف مسارات (URLs) واجهة REST الخاصة بتطبيق core
# -----------------------------------------------

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_nested.routers import NestedDefaultRouter  # pyright: ignore[reportMissingImports]

# ✅ واجهات SimpleJWT
from rest_framework_simplejwt.views import TokenRefreshView, TokenVerifyView

# ✅ View مخصّص لإصدار التوكن مع role
from .serializers import MyTokenObtainPairView

# 👇 نستورد views كوحدة واحدة لتفادي أخطاء "cannot import name"
from . import views

app_name = "core"

# -----------------------------------------------
# v2 Routers (ViewSets)
# -----------------------------------------------
router_v2 = DefaultRouter()
router_v2.register(r"dishes", views.DishViewSet, basename="v2-dishes")
# Endpoint عام لقراءة/إدارة سجلات الحساسية مع ?dish=<id>
router_v2.register(r"dish-allergens", views.DishAllergenViewSet, basename="v2-dish-allergens")

# أسعار الطبق + حساسيّاته (nested): /v2/dishes/<dish_pk>/...
nested_v2 = NestedDefaultRouter(router_v2, r"dishes", lookup="dish")
nested_v2.register(r"prices", views.DishPriceViewSet, basename="v2-dish-prices")
nested_v2.register(r"allergens", views.DishAllergenViewSet, basename="v2-dish-allergens-nested")

# -----------------------------------------------
# قائمة جميع المسارات
# -----------------------------------------------
urlpatterns = [
    # ---------- Auth / JWT ----------
    path("token/", MyTokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("token/verify/", TokenVerifyView.as_view(), name="token_verify"),
    path("register/", views.RegisterView.as_view(), name="register"),

    # ---------- Users (Admin) ----------
    path("users/", views.UserListAdminView.as_view(), name="users-list"),
    path("users/<int:pk>/", views.UserDetailAdminView.as_view(), name="users-detail"),

    # ---------- Menus / Sections / Dishes (CBVs القديمة) ----------
    path("menus/", views.MenuListCreateView.as_view(), name="menu-list-create"),
    path("menus/<int:pk>/", views.MenuDetailView.as_view(), name="menu-detail"),
    path("menus/<int:pk>/publish/", views.MenuPublishView.as_view(), name="menu-publish"),
    path("menus/<int:pk>/unpublish/", views.MenuUnpublishView.as_view(), name="menu-unpublish"),

    path("sections/", views.SectionListCreateView.as_view(), name="section-list-create"),   # ?menu=<id>
    path("dishes/",   views.DishListCreateView.as_view(),   name="dish-list-create"),       # ?section=<id>
    path("dishes/<int:pk>/", views.DishDetailView.as_view(), name="dish-detail"),

    # ---------- التوليد والقاموس ----------
    path(
        "dishes/batch-generate-allergen-codes/",
        views.batch_generate_allergen_codes,
        name="batch-generate-allergen-codes",
    ),
    path(  # حفظ مقترحات LLM في القاموس (المستخدم في الواجهة الأمامية)
        "lexicon/llm-add/",
        views.llm_add_terms_to_lexicon,
        name="lexicon-llm-add",
    ),
    path(  # Batch Upsert آمن للقاموس
        "dictionary/batch-upsert-lexemes/",
        views.dictionary_batch_upsert_lexemes,
        name="dictionary-batch-upsert-lexemes",
    ),

    # ---------- Public menu ----------
    path("public/menus/<slug:public_slug>/", views.PublicMenuView.as_view(), name="public-menu"),

    # ---------- Per-menu display settings ----------
    path("menus/<int:menu_id>/display-settings/", views.MenuDisplaySettingsDetail.as_view(), name="menu-display-settings"),

    # ---------- Me profile ----------
    path("me/profile/", views.MeProfileView.as_view(), name="me-profile"),

    # ---------- v2 (ViewSets) ----------
    path("v2/", include(router_v2.urls)),
    path("v2/", include(nested_v2.urls)),
    path("dishes/llm-direct-codes/", views.llm_direct_codes, name="dishes-llm-direct-codes"),
]
