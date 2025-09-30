"""
Development settings (Postgres via .env).
"""
from .base import *  # noqa
import os

DEBUG = True
ALLOWED_HOSTS = ["*"]

# اقرأ إعدادات Postgres من .env (مع قيم افتراضية للتجارب)
DB_NAME = os.getenv("POSTGRES_DB", "ibla_db")
DB_USER = os.getenv("POSTGRES_USER", "ibla_user")
DB_PASSWORD = os.getenv("POSTGRES_PASSWORD", "ibla_password")
DB_HOST = os.getenv("POSTGRES_HOST", "localhost")  # في Docker: "db"
DB_PORT = os.getenv("POSTGRES_PORT", "5432")

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
