IBLADISH – Hotfix Playbook
⚡ كيف تطبق تعديل صغير على الإنتاج بدون نشر إصدار كامل
🧭 ما هو Hotfix؟

هو تعديل صغير وسريع مثل:

تعديل ملف React بالواجهة

إصلاح Text أو ترجمة

إصلاح Styling بسيط

تعديل Django Template

تعديل API صغير لا يتطلب migrations

تعديل Nginx

تحديث ملف JS/CSS واحد فقط

بدون الحاجة إلى:

❌ إعادة بناء Docker images
❌ إيقاف الموقع
❌ رفع إصدار جديد كامل

🟩 متى نستخدم Hotfix؟

✔ إذا كان التعديل لا يغيّر هيكل المشروع
✔ لا توجد تغييرات Django Migrations
✔ لا يوجد تغييرات كبيرة في الـ frontend build
✔ لا تحتاج لنقل فوليمات

🔥 القانون الذهبي للـ Hotfix

أي شيء داخل volumes → يتم تحديثه دون إيقاف الإنتاج
مثل staticfiles، media، nginx، env

🟦 Hotfix #1 — تعديل في Backend Django بدون إعادة بناء
1️⃣ ادخل إلى سيرفر الإنتاج:
ssh ubuntu@YOUR_SERVER
cd ~/ibladish_v3

2️⃣ ادخل داخل حاوية backend
docker exec -it backend sh

3️⃣ عدّل الملفات مباشرة داخل:
/app/backend/


مثال تعديل views.py:

nano /app/backend/api/views.py

4️⃣ إعادة تحميل سريعة (بدون إيقاف):
touch /app/backend/wsgi.py


🔥 Django + Gunicorn يعيدان تحميل الكود تلقائيًا
بدون Down-time
بدون Build جديد

5️⃣ اخرج ثم راقب اللوج للتأكد:
docker logs backend --tail=50

🟨 Hotfix #2 — تحديث الـ Frontend بدون Build كامل

إذا لديك تعديل صغير جدًا مثل:

تغيير لون

تعديل Text

تعديل SVG

تعديل صورة

يمكنك تعديله مباشرة داخل volume:

1️⃣ عدّل الملفات مباشرة داخل:
docker exec -it nginx sh
cd /usr/share/nginx/html


مثال:

nano index.html


أو:

nano assets/index-[hash].js

2️⃣ Reload Nginx فقط:
docker exec -it nginx nginx -s reload


ولا يحتاج أي Build جديد
🔥 وهذا مهم جدًا في hotfix front-end.

🟧 Hotfix #3 — تعديل ملفات Nginx بدون إيقاف الموقع
1️⃣ افتح الملف:
nano ~/ibladish_v3/deploy/nginx.conf

2️⃣ أعد تحميل الـ container:
docker exec -it nginx nginx -s reload


⚠ بدون إيقاف الموقع
⚠ بدون docker compose down/up

🟥 Hotfix #4 — تعديل .env أثناء التشغيل
1️⃣ عدّل الملف:
nano ~/ibladish_shared/env/.env

2️⃣ انسخ التعديل للإصدار الحالي (ibladish_v3):
cp ~/ibladish_shared/env/.env ~/ibladish_v3/.env

3️⃣ إعادة تحميل backend فقط:
docker restart backend

🟪 Hotfix #5 — تعديل ملفات Media أو Static
Staticfiles
docker exec -it backend sh
rm -rf /app/backend/staticfiles/*
python manage.py collectstatic --noinput

Media

تعديل مباشر:

docker exec -it backend sh
cd /app/backend/media


لا تحتاج Restart.

🟫 Hotfix #6 — إصلاح صغير مع إعادة تشغيل الخدمات بدون Down-Time

إذا التعديل داخل backend ويتطلب إعادة تشغيل:

docker restart backend


إذا يتطلب إعادة تشغيل Nginx فقط:

docker restart nginx


إذا شيء في frontend_builder:

docker restart frontend_builder


❌ بدون وقف المشروع كامل
❌ بدون compose down

🟩 متى لا نستخدم Hotfix؟

❌ عند وجود تغييرات على Database Migrations
❌ عند وجود تغييرات كبيرة على Frontend Build
❌ عند تعديل Dockerfile
❌ عند تعديل docker-compose.yml
❌ عند تغيير هيكلي كبير بالـ backend

في هذه الحالات يجب تنفيذ:
Update Playbook

🟦 Hotfix Rollback (تراجع سريع)

لو أخطأت بتعديل مباشر:

Django:
docker exec -it backend git checkout /app/backend/path/to/file.py
docker restart backend

Frontend:

انسخ نسخة backup من نفس الملف قبل التعديل:

cp file.js.bak file.js
docker exec -it nginx nginx -s reload

Nginx:
cp nginx.conf.bak nginx.conf
docker exec -it nginx nginx -s reload


🔥 rollback يتم فورًا
🔥 بدون downtime

🚀 والآن لديك نظام Hotfix + Update احترافي مثل شركات الـ DevOps الكبيرة

بهذا الشكل:

التحديث الكبير = Update Playbook

التعديل السريع = Hotfix Playbook