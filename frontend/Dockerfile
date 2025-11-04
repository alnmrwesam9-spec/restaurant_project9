# frontend/Dockerfile
# نستخدم ديبيان لتفادي مشاكل musl
FROM node:20-bookworm-slim AS builder

WORKDIR /app

# (اختياري) نمنع محاولة استخدام rollup native fallbackاً
ENV ROLLUP_SKIP_NODE_NATIVE=1
ENV npm_config_optional=true
ENV CI=1

# تثبيت التبعيات من القفل
COPY package.json package-lock.json* ./
RUN npm ci --include=optional \
    # نثبت الباينري المناسب لمنصّة ديبيان (glibc) لتغطية طلب vite/rollup
 && npm i --no-save @rollup/rollup-linux-x64-gnu

# نسخ بقية السورس وبناء
COPY . .
RUN npm run build

# هذه صورة بناء فقط تنتج dist/ (compose سيشاركها مع nginx)
