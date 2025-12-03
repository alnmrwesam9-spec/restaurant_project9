# IBLADISH V3 — Deployment & Upgrade Guide  
Comprehensive guide for deploying, maintaining, and upgrading the IBLADISH platform.

---

## 📌 Overview
This document explains:
- How the system is structured (frontend, backend, nginx, database)
- How media/static volumes work
- How to safely upgrade the server without losing images
- The issues encountered during the last upgrade and how they were fixed
- Best practices to avoid these issues in the future

---

# 🧱 System Architecture

The system consists of:

### **1. Frontend**
- Built using Vite → Output placed inside a Docker volume
- Served by Nginx from:  
  `/usr/share/nginx/html`

### **2. Backend (Django + DRF)**
- Runs in a Docker container on port `8000`
- Handles API, admin, menus, and image upload

### **3. Nginx Reverse Proxy**
- Handles HTTPS
- Serves `frontend`, `staticfiles`, and `media`
- Proxies `/api/` → Django backend

### **4. PostgreSQL Database**
- Uses an external volume:
  `restaurant_project_new_pg_data`

---

# 📦 Docker Volumes

These are the official volumes used by IBLADISH V3:

```yaml
volumes:
  ibladish_v3_frontend_dist:
    external: true

  ibladish_v3_staticfiles:
    external: true

  ibladish_v3_media:
    external: true

  restaurant_project_new_pg_data:
    external: true
📁 Folder Mapping Inside Containers
Nginx
yaml
نسخ الكود
- ibladish_v3_frontend_dist:/usr/share/nginx/html:ro
- ibladish_v3_staticfiles:/app/backend/staticfiles:ro
- ibladish_v3_media:/app/backend/media:ro
Backend
yaml
نسخ الكود
- ibladish_v3_media:/app/backend/media
- ibladish_v3_staticfiles:/app/backend/staticfiles
🖼 Media Directory
Uploaded images are stored under:

bash
نسخ الكود
/app/backend/media
Inside it:

bash
نسخ الكود
/avatars
/dishes
/menu_settings/<id>/{hero,logo}
If media volume is not mounted correctly → uploaded images disappear.

⚠️ Issues That Occurred During Last Upgrade (And Fixes)
❌ 1. Media images not appearing on the website
Cause:
Nginx was serving /media/ from an empty folder

The correct volume wasn’t mounted

Fix:
Copied all media files from the old volume:

bash
نسخ الكود
docker run --rm \
  -v restaurant_project_new_media:/src \
  -v ibladish_v3_media:/dest \
  alpine sh -c "cp -r /src/* /dest/"
❌ 2. Nginx couldn’t find the media files
Cause:
The backend path did not match the Nginx alias:

nginx
نسخ الكود
location /media/ {
  alias /app/backend/media/;
}
But no volume was mounted at /app/backend/media.

Fix:
Added:

yaml
نسخ الكود
- ibladish_v3_media:/app/backend/media:ro
❌ 3. Docker errors: “undefined volume”
Example:

javascript
نسخ الكود
service "nginx" refers to undefined volume ibladish_v3_frontend_dist
Cause:
Volume defined in services: but not in bottom volumes: section.

Fix:
Defined all volumes:

yaml
نسخ الكود
volumes:
  ibladish_v3_frontend_dist:
    external: true
  ibladish_v3_staticfiles:
    external: true
  ibladish_v3_media:
    external: true
🔄 Safe Update Procedure (Must Follow)
Follow this whenever upgrading IBLADISH V3.

🟦 Step 1 — Backup important volumes
bash
نسخ الكود
docker run --rm -v ibladish_v3_media:/data alpine tar -czf - /data > media_backup.tar.gz
docker run --rm -v restaurant_project_new_pg_data:/data alpine tar -czf - /data > pg_backup.tar.gz
🟦 Step 2 — Verify current volumes
bash
نسخ الكود
docker volume ls
docker inspect ibladish_v3_media
🟦 Step 3 — Update codebase (pull new version)
bash
نسخ الكود
git pull
🟦 Step 4 — Stop running containers
bash
نسخ الكود
docker compose down
🟦 Step 5 — Rebuild & start containers
bash
نسخ الكود
docker compose up -d --build
🟦 Step 6 — Restart Nginx & backend
bash
نسخ الكود
docker compose restart nginx backend
🟦 Step 7 — Validate media/static
Backend:
bash
نسخ الكود
docker exec backend ls -R /app/backend/media
Nginx:
bash
نسخ الكود
docker exec nginx ls -R /app/backend/media
If content matches → OK.

🔐 SSL Certificates (Let's Encrypt)
Mounted as:

yaml
نسخ الكود
- /etc/letsencrypt:/etc/letsencrypt:ro
Renew automatically via certbot on host.

Force renewal:

bash
نسخ الكود
sudo certbot renew
✔ Testing Checklist After Update
Frontend
✔ All pages load without 404

✔ Images load correctly

✔ Cache invalidation works (new assets loaded)

Backend
✔ API /api/ works

✔ Django admin loads correctly

✔ Image uploads work

✔ QR code menus show cooking images

Server
✔ Nginx logs clean

✔ No 502/404

✔ HTTPS working

✔ Volumes mounted correctly

🟢 Conclusion
After applying all fixes:

Media restored

Static files served correctly

Nginx configuration stable

Docker volumes unified and clean

Upgrade process is now safe and documented

This README should be used by any developer to avoid repeating previous mistakes and to ensure smooth future upgrades.

