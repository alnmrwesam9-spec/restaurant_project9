# frontend/Dockerfile
FROM node:20-alpine
WORKDIR /app

# تثبيت التبعيات
COPY package.json package-lock.json* ./
RUN npm ci || npm install

# شفرة الواجهة
COPY . .

# أمر التشغيل الفعلي يُحدّد من docker-compose (نبني ثم ننام)
CMD ["sh", "-c", "npm ci || npm install && npm run build && sleep infinity"]
