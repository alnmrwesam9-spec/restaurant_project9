"""
Production settings (Docker + Nginx reverse proxy).
- يعتمد على base.py ويُفعِّل WhiteNoise للـ static
- يستخدم Postgres من متغيّرات البيئة
- إعدادات أمان قابلة للتفعيل من .env
"""

from .base import *  # noqa
import os
from django.core.exceptions import ImproperlyConfigured

# ------------------------------------------------------------------
# Sentry — مراقبة الأخطاء والأداء (خاملة إن لم يُضبط SENTRY_DSN)
# ------------------------------------------------------------------
try:
    import sentry_sdk
    from sentry_sdk.integrations.django import DjangoIntegration

    # Disabled duplicate Sentry init (unified at bottom)
    if False:
        sentry_sdk.init(
        dsn=os.getenv("SENTRY_DSN") or None,
        environment=os.getenv("SENTRY_ENV", "production"),
        integrations=[DjangoIntegration()],
        send_default_pii=False,                 # لا نرسل PII افتراضياً
        traces_sample_rate=float(os.getenv("SENTRY_TRACES", "0.05")),
        profiles_sample_rate=float(os.getenv("SENTRY_PROFILES", "0.0")),
    )
except Exception:
    # لا نمنع إقلاع السيرفر إذا حدثت مشكلة في تحميل/تهيئة Sentry
    pass

# -----------------------------
# عامة
# -----------------------------
DEBUG = False
# لا نسمح بمفتاح افتراضي/فارغ في الإنتاج
if not SECRET_KEY or SECRET_KEY == "insecure-default-key":
    raise ImproperlyConfigured("DJANGO_SECRET_KEY is required in production.")

# إن لم تُضبط عبر البيئة في base.py، اجعلها تعمل محليًا أيضًا
if not ALLOWED_HOSTS:
    ALLOWED_HOSTS = ["localhost", "127.0.0.1"]

# Enforce a real SECRET_KEY in production
if SECRET_KEY == "insecure-default-key" or not SECRET_KEY:
    raise RuntimeError(
        "DJANGO_SECRET_KEY is not set. Refuse to start in production."
    )

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

# -----------------------------
# Sentry (optional, only if SENTRY_DSN is provided)
# -----------------------------
SENTRY_DSN = os.getenv("SENTRY_DSN", "").strip()
if SENTRY_DSN:
    try:
        import sentry_sdk  # type: ignore
        from sentry_sdk.integrations.django import DjangoIntegration  # type: ignore

        sentry_sdk.init(
            dsn=SENTRY_DSN,
            integrations=[DjangoIntegration()],
            environment=os.getenv("SENTRY_ENV", "production"),
            traces_sample_rate=float(os.getenv("SENTRY_TRACES", "0.05") or 0.05),
            profiles_sample_rate=float(os.getenv("SENTRY_PROFILES", "0.0") or 0.0),
            send_default_pii=False,
        )
    except Exception:
        # Sentry is optional; don't block startup if it fails to import
        pass
