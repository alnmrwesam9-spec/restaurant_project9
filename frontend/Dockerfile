# frontend/Dockerfile
# نستخدم ديبيان لتفادي مشاكل musl
FROM node:20-bookworm-slim AS builder

WORKDIR /app

# إعدادات Node
ENV ROLLUP_SKIP_NODE_NATIVE=1
ENV npm_config_optional=true
ENV CI=1

# زيادة الذاكرة المسموحة للـ Node أثناء الـ build (حل مشكلة OOM)
ENV NODE_OPTIONS="--max-old-space-size=4096"

# تثبيت التبعيات من القفل
COPY package.json package-lock.json* ./
RUN npm ci --include=optional \
    && npm i --no-save @rollup/rollup-linux-x64-gnu

# نسخ بقية السورس
COPY . .

# بناء المشروع (الآن سيعمل بدون Out-of-Memory)
RUN npm run build

# هذه صورة بناء فقط تنتج dist/ (compose سيشاركها مع nginx)
