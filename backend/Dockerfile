# ========= Backend (Django) =========
FROM python:3.12-slim

# بيئة بايثون نظيفة
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=on \
    PIP_NO_CACHE_DIR=on \
    DJANGO_SETTINGS_MODULE=backend.settings.prod

WORKDIR /app

# حزم النظام المطلوبة للبناء و psycopg
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential libpq-dev \
 && rm -rf /var/lib/apt/lists/*

# تثبيت المتطلبات (من جذر المشروع: requirements.txt)
COPY requirements.txt /tmp/requirements.txt
RUN pip install --upgrade pip && pip install -r /tmp/requirements.txt

# نسخ المشروع بالكامل (تأكّد أن build context هو جذر المشروع)
COPY . /app

# تجهيز مجلدات static/media بما يتوافق مع settings/base.py
RUN mkdir -p /app/backend/staticfiles /app/backend/media

# المنفذ الافتراضي للتطبيق
EXPOSE 8000

# تشغيل الإنتاج عبر Gunicorn
CMD ["gunicorn", "backend.wsgi:application", "--bind", "0.0.0.0:8000", "--workers", "3", "--timeout", "90"]
