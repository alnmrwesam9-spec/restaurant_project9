"""
Production settings (Docker + Nginx reverse proxy).
- يعتمد على base.py ويُفعِّل WhiteNoise للـ static
- يستخدم Postgres من متغيّرات البيئة
- إعدادات أمان قابلة للتفعيل من .env
"""

from .base import *  # noqa
import os

# -----------------------------
# عامة
# -----------------------------
DEBUG = False

# إن لم تُضبط عبر البيئة في base.py، اجعلها تعمل محليًا أيضًا
if not ALLOWED_HOSTS:
    ALLOWED_HOSTS = ["localhost", "127.0.0.1"]

# السماح بالمصادر الموثوقة للـ CSRF (CSV من .env)
# مثال في .env:
# CSRF_TRUSTED_ORIGINS=http://localhost,http://127.0.0.1
CSRF_TRUSTED_ORIGINS = csv_env("CSRF_TRUSTED_ORIGINS", "http://localhost,http://127.0.0.1")

# إن لم تُضبط CORS_ALLOWED_ORIGINS في البيئة (يقرأها base.py)،
# فعلى الأقل اسمح باللوكال:
if not CORS_ALLOWED_ORIGINS:
    CORS_ALLOWED_ORIGINS = ["http://localhost", "http://127.0.0.1"]

# -----------------------------
# قاعدة البيانات (Postgres)
# -----------------------------
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": os.getenv("POSTGRES_DB", "ibla_db"),
        "USER": os.getenv("POSTGRES_USER", "ibla_user"),
        "PASSWORD": os.getenv("POSTGRES_PASSWORD", "ibla_pass"),
        # في Compose اسم الخدمة غالبًا ibla_db
        "HOST": os.getenv("POSTGRES_HOST", "ibla_db"),
        "PORT": os.getenv("POSTGRES_PORT", "5432"),
    }
}

# -----------------------------
# WhiteNoise للملفات الثابتة
# -----------------------------
# أدرِج الـ middleware بعد SecurityMiddleware إن وجد:
try:
    _sec_idx = MIDDLEWARE.index("django.middleware.security.SecurityMiddleware")
    MIDDLEWARE.insert(_sec_idx + 1, "whitenoise.middleware.WhiteNoiseMiddleware")
except ValueError:
    # لو تغيّر الترتيب لأي سبب، ضعه في البداية
    MIDDLEWARE.insert(0, "whitenoise.middleware.WhiteNoiseMiddleware")

STATICFILES_STORAGE = "whitenoise.storage.CompressedManifestStaticFilesStorage"

# -----------------------------
# إعدادات الأمان (تفعيلها من .env حسب الحاجة)
# -----------------------------
# إذا كان Nginx يمرر X-Forwarded-Proto
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")

def _bool_env(name: str, default: str = "0") -> bool:
    return os.getenv(name, default).strip() in {"1", "true", "True", "YES", "yes"}

SECURE_SSL_REDIRECT = _bool_env("SECURE_SSL_REDIRECT", "0")
SESSION_COOKIE_SECURE = _bool_env("SESSION_COOKIE_SECURE", "0")
CSRF_COOKIE_SECURE = _bool_env("CSRF_COOKIE_SECURE", "0")

SECURE_HSTS_SECONDS = int(os.getenv("SECURE_HSTS_SECONDS", "0"))
SECURE_HSTS_INCLUDE_SUBDOMAINS = _bool_env("SECURE_HSTS_INCLUDE_SUBDOMAINS", "0")
SECURE_HSTS_PRELOAD = _bool_env("SECURE_HSTS_PRELOAD", "0")

# -----------------------------
# سجلّات مبسّطة للإنتاج
# -----------------------------
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "handlers": {
        "console": {"class": "logging.StreamHandler"},
    },
    "root": {
        "handlers": ["console"],
        "level": os.getenv("DJANGO_LOG_LEVEL", "INFO"),
    },
}
