from django.contrib import admin
from django.urls import path, include

# مسارات SimpleJWT القياسية
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
)

urlpatterns = [
    # Django admin
    path("admin/", admin.site.urls),

    # API الخاصة بنا (كل ما في core.urls تحت /api/)
    path("api/", include("core.urls")),

    # Auth (JWT): تسجيل الدخول + تحديث التوكن
    path("api/token/", TokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("api/token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("api/", include("allergens.urls")),  # ← هذا يفعّل /api/allergens/...
    
    
]
