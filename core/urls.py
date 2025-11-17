# core/urls.py
from django.urls import path, re_path
from rest_framework_simplejwt.views import TokenRefreshView
from .serializers import EmailOrUsernameTokenObtainPairView

from . import views
from .views import WhoAmI, ping
from .views import RegisterView  # تأكد من الاستيراد
from .views import username_available, email_available
from .views import healthz

# ------ v2 viewsets كدوال as_view ------
dish_list = views.DishViewSet.as_view({
    "get": "list",
    "post": "create",
})
dish_detail = views.DishViewSet.as_view({
    "get": "retrieve",
    "put": "update",
    "patch": "partial_update",
    "delete": "destroy",
})

dishprice_list = views.DishPriceViewSet.as_view({
    "get": "list",
    "post": "create",
})
dishprice_detail = views.DishPriceViewSet.as_view({
    "get": "retrieve",
    "put": "update",
    "patch": "partial_update",
    "delete": "destroy",
})

dishallergen_list = views.DishAllergenViewSet.as_view({
    "get": "list",
    "post": "create",
})
dishallergen_detail = views.DishAllergenViewSet.as_view({
    "get": "retrieve",
    "put": "update",
    "patch": "partial_update",
    "delete": "destroy",
})
dishallergen_bulk_confirm = views.DishAllergenViewSet.as_view({"post": "bulk_confirm"})
dishallergen_add_codes    = views.DishAllergenViewSet.as_view({"post": "add_codes"})

urlpatterns = [

    # ---------- Auth ----------
    # Auth (canonical + compatibility synonyms)
    re_path(r"^auth/login/?$",       EmailOrUsernameTokenObtainPairView.as_view(), name="token_obtain_pair"),
    re_path(r"^auth/refresh/?$",     TokenRefreshView.as_view(),                    name="token_refresh"),
    re_path(r"^token/?$",            EmailOrUsernameTokenObtainPairView.as_view(), name="token_obtain_pair"),
    re_path(r"^token/refresh/?$",    TokenRefreshView.as_view(),                    name="token_refresh"),
    re_path(r"^auth/whoami/?$",  WhoAmI.as_view(),              name="whoami"),

    # ---------- Users / Profile ----------
    re_path(r"^users/?$",              views.UserListAdminView.as_view(),   name="user_list_admin"),
    re_path(r"^users/(?P<pk>\d+)/?$",  views.UserDetailAdminView.as_view(), name="user_detail_admin"),
    re_path(r"^me/profile/?$", views.MeProfileAPIView.as_view(), name="me_profile"),

      # فحص سريع أن /api/ يعمل
    re_path(r"^ping/?$", ping, name="ping"),
    path('healthz/', healthz, name='healthz'),

    # تسجيل مستخدم جديد
    path('register/', RegisterView.as_view(), name='register'),
    path('auth/username-available/', username_available),
    path('auth/email-available/', email_available),

    # ---------- Menus / Sections / Dishes (v1) ----------
    re_path(r"^menus/?$",                     views.MenuListCreateView.as_view(), name="menu_list_create"),
    re_path(r"^menus/(?P<pk>\d+)/?$",         views.MenuDetailView.as_view(),      name="menu_detail"),
    re_path(r"^menus/(?P<pk>\d+)/publish/?$",   views.MenuPublishView.as_view(),   name="menu_publish"),
    re_path(r"^menus/(?P<pk>\d+)/unpublish/?$", views.MenuUnpublishView.as_view(), name="menu_unpublish"),

    re_path(r"^sections/?$",              views.SectionListCreateView.as_view(), name="section_list_create"),

    re_path(r"^dishes/?$",                views.DishListCreateView.as_view(),    name="dish_list_create"),
    re_path(r"^dishes/(?P<pk>\d+)/?$",    views.DishDetailView.as_view(),        name="dish_detail"),

    # ---------- Public menu ----------
    re_path(r"^public/menus/(?P<public_slug>[-a-zA-Z0-9_]+)/?$",
            views.PublicMenuView.as_view(), name="public_menu"),

    # ---------- Aggregated (owner/admin) ----------
    re_path(r"^menu/?$", views.MenuAggregateView.as_view(), name="menu_aggregate"),

    # ---------- Menu display settings ----------
    re_path(r"^menus/(?P<menu_id>\d+)/display-settings/?$",
            views.MenuDisplaySettingsDetail.as_view(), name="menu_display_settings"),

    # ---------- Rules/LLM & Dictionary ----------
    re_path(r"^dishes/batch-generate-allergen-codes/?$",
            views.batch_generate_allergen_codes, name="batch_generate_allergen_codes"),
    re_path(r"^dictionary/batch-upsert-lexemes/?$",
            views.dictionary_batch_upsert_lexemes, name="dictionary_batch_upsert_lexemes"),
    re_path(r"^dictionary/llm-add-terms/?$",
            views.llm_add_terms_to_lexicon, name="llm_add_terms_to_lexicon"),
    # Backwards-compatibility alias used by frontend
    re_path(r"^lexicon/llm-add/?$",
            views.llm_add_terms_to_lexicon, name="lexicon_llm_add"),
    re_path(r"^llm-direct-codes/?$", views.llm_direct_codes, name="llm_direct_codes"),
    # LLM helper endpoints (ETA / Limits)
    re_path(r"^llm/eta/?$", views.llm_eta, name="llm_eta"),
    re_path(r"^llm/limits/?$", views.llm_limits, name="llm_limits"),
    # LLM async jobs
    re_path(r"^llm/jobs/start-batch-generate/?$", views.llm_jobs_start_batch_generate, name="llm_jobs_start_batch_generate"),
    re_path(r"^llm/jobs/(?P<job_id>[a-f0-9\-]+)/status/?$", views.llm_jobs_status, name="llm_jobs_status"),
    re_path(r"^llm/jobs/(?P<job_id>[a-f0-9\-]+)/cancel/?$", views.llm_jobs_cancel, name="llm_jobs_cancel"),

    # ---------- v2: dishes + nested prices/allergens ----------
    re_path(r"^v2/dishes/?$",                   dish_list,   name="v2_dish_list"),
    re_path(r"^v2/dishes/(?P<pk>\d+)/?$",       dish_detail, name="v2_dish_detail"),

    re_path(r"^v2/dishes/(?P<dish_pk>\d+)/prices/?$",                   dishprice_list,   name="v2_dishprice_list"),
    re_path(r"^v2/dishes/(?P<dish_pk>\d+)/prices/(?P<pk>\d+)/?$",       dishprice_detail, name="v2_dishprice_detail"),

    re_path(r"^v2/dishes/(?P<dish_pk>\d+)/allergens/?$",                dishallergen_list,   name="v2_dishallergen_list"),
    re_path(r"^v2/dishes/(?P<dish_pk>\d+)/allergens/(?P<pk>\d+)/?$",    dishallergen_detail, name="v2_dishallergen_detail"),
    re_path(r"^v2/dishes/(?P<dish_pk>\d+)/allergens/bulk_confirm/?$",   dishallergen_bulk_confirm, name="v2_dishallergen_bulk_confirm"),
    re_path(r"^v2/dishes/(?P<dish_pk>\d+)/allergens/add_codes/?$",      dishallergen_add_codes,    name="v2_dishallergen_add_codes"),
]


