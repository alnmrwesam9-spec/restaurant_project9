# backend/settings/dev.py
"""
Development settings (Postgres via env vars).
"""
import os
from .base import *  # noqa: F401,F403

DEBUG = True

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": os.getenv("DB_NAME", "ibla"),
        "USER": os.getenv("DB_USER", "ibla"),
        "PASSWORD": os.getenv("DB_PASSWORD", "ibla"),
        "HOST": os.getenv("DB_HOST", "ibla_db"),  # داخل Docker اسم خدمة DB
        "PORT": int(os.getenv("DB_PORT", "5432")),
    }
}

ALLOWED_HOSTS = ["*", "localhost", "127.0.0.1", "nginx"]

CSRF_TRUSTED_ORIGINS = [
    "http://localhost",
    "http://127.0.0.1",
]

# --- Local dev DB override -------------------------------------------------
# Allows running without Postgres by setting USE_SQLITE=1 in .env
USE_SQLITE = os.getenv("USE_SQLITE", "0") == "1"

if USE_SQLITE:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": BASE_DIR / "db.sqlite3",
        }
    }
else:
    # Support both DB_* and POSTGRES_* variable names; default host to localhost
    DB_NAME = os.getenv("DB_NAME") or os.getenv("POSTGRES_DB", "ibla")
    DB_USER = os.getenv("DB_USER") or os.getenv("POSTGRES_USER", "ibla")
    DB_PASSWORD = os.getenv("DB_PASSWORD") or os.getenv("POSTGRES_PASSWORD", "ibla")
    DB_HOST = os.getenv("DB_HOST") or os.getenv("POSTGRES_HOST") or "localhost"
    DB_PORT = int(os.getenv("DB_PORT") or os.getenv("POSTGRES_PORT") or "5432")

    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.postgresql",
            "NAME": DB_NAME,
            "USER": DB_USER,
            "PASSWORD": DB_PASSWORD,
            "HOST": DB_HOST,
            "PORT": DB_PORT,
        }
    }
