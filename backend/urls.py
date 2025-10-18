# backend/urls.py
from django.contrib import admin
from django.urls import path, include

from rest_framework_simplejwt.views import TokenRefreshView
from core.serializers import EmailOrUsernameTokenObtainPairView

# ⬇️ مهم: لإتاحة /media/ أثناء التطوير
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", include("core.urls")),
    path("api/token/", EmailOrUsernameTokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("api/token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("api/", include("allergens.urls")),
]

# ⬇️ هذا السطر يجعل Django يقدّم ملفات MEDIA عندما DEBUG=True (dev.py)
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
