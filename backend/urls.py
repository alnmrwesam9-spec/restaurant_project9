# backend/urls.py
from django.contrib import admin
from django.urls import path, include
from core.views import healthz

# ⬇️ مهم: لإتاحة /media/ أثناء التطوير
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", include("core.urls")),
    path("healthz/", healthz, name="healthz"),
    path("api/", include("allergens.urls")),
]

# ⬇️ هذا السطر يجعل Django يقدّم ملفات MEDIA عندما DEBUG=True (dev.py)
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
