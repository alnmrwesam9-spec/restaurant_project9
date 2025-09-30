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
    load_dotenv(BASE_DIR / ".env")  # read .env if present

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
STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
AUTH_USER_MODEL = "core.User"

# REST
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
}

# JWT config (مثال)
SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=30),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=1),
}

# مفاتيح خارجية
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
GLOBAL_LEXICON_OWNER_ID = int(os.getenv("GLOBAL_LEXICON_OWNER_ID", "1"))
