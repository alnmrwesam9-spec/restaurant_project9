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
