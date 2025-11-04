Permissions & Auth – Overview
الهدف

توحيد منطق المصادقة/التفويض وتقليل التكرار.

منع أي ربط/تعديل على موارد لا يملكها المستخدم.

جعل المنظومة مفهومة وسهلة لأي مطوّر جديد.

الأدوار

owner: يرى ويُدير موارده فقط (Menus/Sections/Dishes المملوكة له).

admin: وصول كامل (تجاوز قيود الملكية). يُعرَّف عبر:

role == "admin" أو is_staff == True.

المعيار الموحّد: core/utils/auth.py -> is_admin(user).

إعدادات DRF (افتراضي آمن)

DEFAULT_AUTHENTICATION_CLASSES = JWTAuthentication

DEFAULT_PERMISSION_CLASSES = IsAuthenticated

أي Endpoint لا يصرّح AllowAny يتطلّب JWT افتراضيًا.

مسارات عامة (AllowAny)

POST /api/token/

POST /api/token/refresh/

GET /api/ping

GET /api/auth/username-available

GET /api/auth/email-available

GET /api/public/menus/<public_slug>

GET /api/auth/whoami يتطلّب Auth (JWT).

قواعد الملكية (Ownership)

Menu مملوك بالحقل: menu.user_id.

Section مملوك عبر: section.menu.user_id.

Dish مملوك عبر: dish.section.menu.user_id.

إنفاذ القواعد

على مستوى views:

إنشاء Section: ممنوع إن كان menu لا يخصّ المستخدم (403).

إنشاء Dish: ممنوع إن كان section لا يخصّ المستخدم (403).

نقل Dish إلى Section لا يخصّ المستخدم (PATCH): ممنوع (403).

على مستوى serializers (دفاع ثاني):

SectionSerializer.validate: منع استخدام menu لغير المالك (إلا admin).

DishSerializer.validate: منع استخدام section لغير المالك (إلا admin).

admin يتجاوز هذه القيود دومًا.

طبقة Permissions

IsAdmin: يسمح فقط لمن يطابق is_admin(user).

IsOwnerOrAdmin: يسمح إن كان Admin أو مالك الكائن (Menu/Section/Dish).

ملاحظة: الفلترة في get_queryset تحصر النتائج بالمالك؛ والـPermission تؤكّد الشيء نفسه عند العمليات على كائن واحد.

خريطة سريعة للـViews
المسار/الوظيفة	الصلاحية
تسجيل الدخول/تحديث التوكن	AllowAny
Ping / Username/Email available	AllowAny
Public Menu	AllowAny
WhoAmI	IsAuthenticated
CRUD المالك (menus/sections/dishes)	IsAuthenticated + فحوصات ملكية (Views + Serializers)
شؤون إدارية للمستخدمين/التقارير	IsAdmin
أمثلة سلوك

بدون توكن: أي مسار غير عام ⇒ 401.

Owner يحاول إنشاء Section تحت Menu لغيره ⇒ 400/403 (حسب ترتيب التحقق).

Owner ينقل Dish إلى Section لغيره ⇒ 403.

Admin ينفّذ كل ما سبق بنجاح (200/201/204).

أمثلة طلبات (اختبار يدوي)
# الحصول على توكن
curl -s -X POST http://127.0.0.1:8000/api/token/ \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"***"}'

# مسار عام
curl -i http://127.0.0.1:8000/api/ping

# محاولة الوصول بدون توكن (يجب 401)
curl -i http://127.0.0.1:8000/api/menus

# إنشاء Dish بصلاحية مالك في Section لا يخصّه (يجب 400/403)
curl -i -X POST http://127.0.0.1:8000/api/dishes \
  -H "Authorization: Bearer <OWNER_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"name":"X","section":999}'

ملاحظات إنتاج (باختصار)

DEBUG=0, ALLOWED_HOSTS, CORS_ALLOWED_ORIGINS, SECRET_KEY في .env.prod.

دعم JSON في التحديثات الجزئية: DishDetailView يستخدم JSONParser + partial_update.

جمع الملفات الثابتة: python manage.py collectstatic.

اختبارات أساسية مرفقة

401 افتراضي بدون JWT.

400/403 للمالك عند الربط/النقل خارج ملكيته.

نجاح العمليات نفسها عند admin.

Accept JSON في PATCH (لا 415).