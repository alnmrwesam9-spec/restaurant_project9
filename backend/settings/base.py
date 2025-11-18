"""
Base settings for backend project.
Shared across dev and prod.
"""

from pathlib import Path
import os
from datetime import timedelta

# NEW: load .env locally
try:
    from dotenv import load_dotenv  # type: ignore
except Exception:  # python-dotenv may not be installed yet
    load_dotenv = None

BASE_DIR = Path(__file__).resolve().parent.parent
if load_dotenv:
    # Load env from backend/.env and then project root .env (if present)
    for _env_path in (BASE_DIR / ".env", BASE_DIR.parent / ".env"):
        try:
            if _env_path.exists():
                load_dotenv(_env_path)
        except Exception:
            pass

def csv_env(name: str, default: str = "") -> list[str]:
    """Read comma-separated env var and return a clean list (no empty items)."""
    raw = os.getenv(name, default)
    return [x.strip() for x in raw.split(",") if x.strip()]

# الأمن
SECRET_KEY = os.getenv("DJANGO_SECRET_KEY", "insecure-default-key")
DEBUG = False  # يُضبط في dev/prod

# Lists parsed safely from env (no [''] cases)
ALLOWED_HOSTS = csv_env("DJANGO_ALLOWED_HOSTS")
CORS_ALLOWED_ORIGINS = csv_env("CORS_ALLOWED_ORIGINS")

# التطبيقات
INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "core",
    "rest_framework",
    "rest_framework_simplejwt",
    "corsheaders",
    "allergens",
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",  # keep first
    "django.middleware.common.CommonMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "backend.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "backend.wsgi.application"

# كلمات المرور
AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

# اللغات والتوقيت
LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

# ملفات ثابتة / ميديا
BACKEND_DIR = Path(__file__).resolve().parent.parent  # => /app/backend

STATIC_URL  = '/static/'
MEDIA_URL   = '/media/'

STATIC_ROOT = BACKEND_DIR / 'staticfiles'  # => /app/backend/staticfiles
MEDIA_ROOT  = BACKEND_DIR / 'media'        # => /app/backend/media


DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
AUTH_USER_MODEL = "core.User"

# REST
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": (
        "rest_framework.permissions.IsAuthenticated",
    ),
     "DEFAULT_THROTTLE_CLASSES": (
        "rest_framework.throttling.AnonRateThrottle",
        "rest_framework.throttling.UserRateThrottle",
        "rest_framework.throttling.ScopedRateThrottle",
    ),
    "DEFAULT_THROTTLE_RATES": {
        "anon": "60/min",      # لا يؤذي /public
        "user": "200/min",
        "login": "5/min",
        "register": "3/min",
        "availability": os.getenv("DRF_AVAILABILITY_RATE", "20/min"),
        "llm": os.getenv("DRF_LLM_RATE", "10/min"),
        "password_change": os.getenv("DRF_PASSWORD_CHANGE_RATE", "5/min"),
    },
}

# JWT config (مثال)
SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=30),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=1),
}

# مفاتيح خارجية
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
GLOBAL_LEXICON_OWNER_ID = int(os.getenv("GLOBAL_LEXICON_OWNER_ID", "1"))


ALLOWED_IMAGE_FORMATS = ["JPEG", "PNG", "WEBP"]

# الحجم الأقصى (ميغابايت)
MAX_UPLOAD_IMAGE_MB = 5

# عدد البكسلات الأقصى (مثال: 6000×6000 = 36M)
MAX_IMAGE_PIXELS = 36_000_000

# منع المتصفح من محاولة تخمين نوع الملف
SECURE_CONTENT_TYPE_NOSNIFF = True

DATA_UPLOAD_MAX_MEMORY_SIZE = 15 * 1024 * 1024   # 15MB
FILE_UPLOAD_MAX_MEMORY_SIZE = 10 * 1024 * 1024   # 10MB


# === Image pipeline tuning (safe defaults) ===
PREFER_WEBP = bool(int(os.getenv("PREFER_WEBP", "1")))     # فعّل WebP افتراضيًا
JPEG_QUALITY = int(os.getenv("JPEG_QUALITY", "85"))
PNG_OPTIMIZE = bool(int(os.getenv("PNG_OPTIMIZE", "1")))
WEBP_QUALITY = int(os.getenv("WEBP_QUALITY", "82"))        # 78–85 مناسبة
WEBP_METHOD = int(os.getenv("WEBP_METHOD", "4"))           # 0–6 (أعلى=أبطأ)
# حدّ أقصى للجانب الأكبر، 0 = تعطيل القصّ (نتركه معطل افتراضيًا)
MAX_IMAGE_SIDE = int(os.getenv("MAX_IMAGE_SIDE", "0"))

