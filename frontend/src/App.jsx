// frontend/src/App.jsx
// --------------------------------------------------------------
// Router setup (merged + enhanced):
// - RootRedirect يحسم الوجهة من "/":
//     unauthenticated  => LoginPage
//     admin            => /admin/users
//     owner/user       => /menus
// - يحافظ على جميع مسارات المشروع القديمة
// - يهيّئ Axios Authorization عند الإقلاع وبعد تسجيل الدخول
// - onUnauthorized (401) ينظف الجلسة ويعيد إلى "/"
// - يدعم مفاتيح تخزين متنوعة: access_token/access + refresh_token/refresh
// - ✅ مدمج معه SesameGuide وزر تشغيل الجولة اليدوي StartTourButton
// - ✅ زر الجولة يظهر فقط للمستخدم الموثّق وفي مسارات المستخدم (menus/sections/public-settings)
// - ✅ تقليل حجم التحميل الأولي عبر Lazy + Suspense
// --------------------------------------------------------------

import React, { useState, useEffect, useMemo } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import api, { setOnUnauthorized } from './services/axios'
import { jwtDecode } from 'jwt-decode'
import { useTour } from '@reactour/tour'
import { useTranslation } from 'react-i18next'

// 🧭 جولة تعريفية (reactour)
import SesameGuide from './components/tour/SesameGuide.jsx'

/* 🛡️ الحماية والملاحة المشتركة */
import PrivateRoute from './components/PrivateRoute'
import AdminRoute from './components/AdminRoute'
import UserNavbar from './components/UserNavbar'
import AdminNavbar from './components/AdminNavbar'

/* ⚙️ Lazy pages (تصغير الحزمة الأولية) */
const LoginPage = React.lazy(() => import('./pages/LoginPage'))
const Register = React.lazy(() => import('./pages/Register'))
const MenusPage = React.lazy(() => import('./pages/MenusPage'))
const SectionPage = React.lazy(() => import('./pages/SectionPage'))
const DishPage = React.lazy(() => import('./pages/DishPage'))
const ReportsDashboard = React.lazy(() => import('./pages/ReportsDashboard'))
const AdminUsersPage = React.lazy(() => import('./pages/AdminUsersPage'))
const AdminUserMenusPage = React.lazy(() => import('./pages/AdminUserMenusPage'))
const AdminUserDetailsPage = React.lazy(() => import('./pages/AdminUserDetailsPage'))
const AdminEditUserPage = React.lazy(() => import('./pages/AdminEditUserPage'))
const AdminMenuEditorPage = React.lazy(() => import('./pages/AdminMenuEditorPage'))
const MenuPublicSettings = React.lazy(() => import('./pages/MenuPublicSettings'))
const PublicMenuPage = React.lazy(() => import('./pages/PublicMenuPage'))
const AdminAllergensPage = React.lazy(() => import('./pages/AdminAllergensPage'))

/* ------------------------- JWT utils ------------------------- */
function isJwtValidMaybe(token) {
  if (!token) return false
  try {
    const { exp } = jwtDecode(token)
    // بعض الباك إند لا يرسل exp — نعتبره صالحًا حينها
    return !exp || exp * 1000 > Date.now()
  } catch {
    return false
  }
}

function isAdminFromToken(token) {
  try {
    const d = jwtDecode(token)
    return d?.role === 'admin' || d?.is_staff === true || d?.is_superuser === true
  } catch {
    return false
  }
}

/* ---------------------- زر تشغيل الجولة ---------------------- */
// ✅ يعتمد على i18next لمعرفة الاتجاه مع fallback على <html dir>
function StartTourButton({ token }) {
  const { setIsOpen, setCurrentStep } = useTour()
  const { i18n } = useTranslation()
  const location = useLocation()
  const path = location?.pathname || '/'

  // أين نظهر الزر؟
  const isUserRoute =
    path === '/menus' ||
    /^\/sections\/\d+\/dishes$/.test(path) ||
    /^\/menus\/\d+\/public-settings$/.test(path)

  const show = Boolean(token) && isUserRoute
  if (!show) return null

  // 👇 كشف الاتجاه بشكل موثوق
  const dirFromI18n = typeof i18n?.dir === 'function' ? i18n.dir() : null
  const dirFromHtml = document?.documentElement?.getAttribute('dir')
  const isRTL = (dirFromI18n || dirFromHtml || 'ltr') === 'rtl'
  // NOTE: نثبّت الزر يمين دائمًا بغض النظر عن الاتجاه

  const style = {
    position: 'fixed',
    bottom: 24,
    right: 'max(env(safe-area-inset-right, 0px), 24px)',
    height: 44,
    paddingInline: 14,
    borderRadius: 999,
    background: '#f27141',
    color: '#fff',
    border: 0,
    cursor: 'pointer',
    boxShadow: '0 6px 20px rgba(0,0,0,.25)',
    zIndex: 4000,
  }

  return (
    <button
      onClick={() => { setCurrentStep(0); setIsOpen(true) }}
      style={style}
      aria-label="ابدأ الجولة"
      title="ابدأ الجولة"
    >
      🧑‍🍳 ابدأ الجولة
    </button>
  )
}

/* ----------------------------- App --------------------------- */
export default function App() {
  const [token, setToken] = useState(null)

  // أثناء الإقلاع: حمّل توكن صالح إن وجد واضبط Authorization
  useEffect(() => {
    const accessFromLocal =
      localStorage.getItem('access_token') || localStorage.getItem('access')
    const tokenFromSession = sessionStorage.getItem('token')

    const chosen =
      (isJwtValidMaybe(accessFromLocal) && accessFromLocal) ||
      (isJwtValidMaybe(tokenFromSession) && tokenFromSession) ||
      null

    if (chosen) {
      setToken(chosen)
      api.defaults.headers.common.Authorization = `Bearer ${chosen}`
    } else {
      // تنظيف شامل عند عدم وجود توكن صالح
      localStorage.removeItem('access_token')
      localStorage.removeItem('refresh_token')
      localStorage.removeItem('access')
      localStorage.removeItem('refresh')
      localStorage.removeItem('token')
      localStorage.removeItem('role')
      sessionStorage.removeItem('token')
      sessionStorage.removeItem('role')
      delete api.defaults.headers.common.Authorization
      setToken(null)
    }

    // 401 عالميًا → نظف وأعد التوجيه إلى صفحة الدخول
    setOnUnauthorized(() => {
      try {
        localStorage.removeItem('access_token')
        localStorage.removeItem('refresh_token')
        localStorage.removeItem('access')
        localStorage.removeItem('refresh')
        localStorage.removeItem('token')
        localStorage.removeItem('role')
        sessionStorage.removeItem('token')
        sessionStorage.removeItem('role')
        delete api.defaults.headers.common.Authorization
        setToken(null)
      } finally {
        window.location.replace('/')
      }
    })
  }, [])

  // ✅ يُستدعى من صفحات الدخول/التسجيل بعد نجاح المصادقة
  const handleLogin = (accessToken) => {
    setToken(accessToken)
    api.defaults.headers.common.Authorization = `Bearer ${accessToken}`
    // التخزين (local/session) يتم داخل LoginPage/Register حسب اختيارك
  }

  // 🚪 تسجيل الخروج
  const handleLogout = () => {
    try {
      localStorage.removeItem('access_token')
      localStorage.removeItem('refresh_token')
      localStorage.removeItem('access')
      localStorage.removeItem('refresh')
      localStorage.removeItem('token')
      localStorage.removeItem('role')
      sessionStorage.removeItem('token')
      sessionStorage.removeItem('role')
      delete api.defaults.headers.common.Authorization
    } finally {
      setToken(null)
    }
  }

  // 🎯 الوجهة بعد التوثيق
  const targetAfterAuth = useMemo(() => {
    if (!token) return null

    // أولاً حاول من التوكن نفسه
    if (isAdminFromToken(token)) return '/admin/users'

    // إن لم يتوفر الدور داخل JWT نعتمد التخزين
    const role =
      (sessionStorage.getItem('role') || localStorage.getItem('role') || '').toLowerCase()
    return role === 'admin' ? '/admin/users' : '/menus'
  }, [token])

  // 🧭 RootRedirect: يستخدم حالة التطبيق + التخزين لتقرير الوجهة عند "/"
  function RootRedirect() {
    const storedToken =
      localStorage.getItem('access_token') ||
      localStorage.getItem('access') ||
      sessionStorage.getItem('token')

    const effectiveToken = token || storedToken

    if (!isJwtValidMaybe(effectiveToken)) {
      // غير موثق -> نعرض صفحة الدخول مباشرة مع onLogin
      return <LoginPage onLogin={handleLogin} />
    }

    // موثق -> وجه حسب الدور
    const role =
      (sessionStorage.getItem('role') || localStorage.getItem('role') || '').toLowerCase()
    const goAdmin = isAdminFromToken(effectiveToken) || role === 'admin'
    return <Navigate to={goAdmin ? '/admin/users' : '/menus'} replace />
  }

  return (
    <Router>
      {/* ✅ مكوّن الجولة متاح على مستوى التطبيق كله */}
      <SesameGuide />

      {/* ✅ Suspense عام يغلّف كل المسارات. يمكنك استبدال fallback بـ Loader إن رغبت */}
      <React.Suspense fallback={null}>
        <Routes>
          {/* 📌 الجذر: يقرر الوجهة تلقائيًا */}
          <Route path="/" element={<RootRedirect />} />

          {/* التسجيل: إذا كنت موثقًا نحولك لوجهتك، وإلا نعرض Register */}
          <Route
            path="/register"
            element={
              token ? (
                <Navigate to={targetAfterAuth || '/menus'} replace />
              ) : (
                <Register onLogin={handleLogin} />
              )
            }
          />

          {/* 👤 مسارات لوحة المستخدم (محميّة) */}
          <Route
            path="/menus"
            element={
              <PrivateRoute token={token}>
                <>
                  <UserNavbar onLogout={handleLogout} />
                  <MenusPage token={token} />
                </>
              </PrivateRoute>
            }
          />
          <Route
            path="/menus/:menuId"
            element={
              <PrivateRoute token={token}>
                <>
                  <UserNavbar onLogout={handleLogout} />
                  <SectionPage />
                </>
              </PrivateRoute>
            }
          />
          <Route
            path="/sections/:sectionId/dishes"
            element={
              <PrivateRoute token={token}>
                <>
                  <UserNavbar onLogout={handleLogout} />
                  <DishPage />
                </>
              </PrivateRoute>
            }
          />

          {/* ⚙️ إعدادات نشر/عرض قائمة معيّنة */}
          <Route
            path="/menus/:menuId/public-settings"
            element={
              <PrivateRoute token={token}>
                <>
                  <UserNavbar onLogout={handleLogout} />
                  <MenuPublicSettings />
                </>
              </PrivateRoute>
            }
          />

          {/* 📊 تقارير (كما في القديم: غير محمية—عدّلها إن أردت) */}
          <Route path="/reports" element={<ReportsDashboard />} />

          {/* 🛡️ مسارات لوحة الأدمن */}
          <Route
            path="/admin/users"
            element={
              <AdminRoute token={token}>
                <>
                  <AdminNavbar onLogout={handleLogout} />
                  <AdminUsersPage />
                </>
              </AdminRoute>
            }
          />

          <Route
            path="/admin/users/:userId/menus"
            element={
              <AdminRoute token={token}>
                <>
                  <AdminNavbar onLogout={handleLogout} />
                  <AdminUserMenusPage />
                </>
              </AdminRoute>
            }
          />
          <Route
            path="/admin/users/:userId/details"
            element={
              <AdminRoute token={token}>
                <>
                  <AdminNavbar onLogout={handleLogout} />
                  <AdminUserDetailsPage />
                </>
              </AdminRoute>
            }
          />
          <Route
            path="/admin/users/:userId/edit"
            element={
              <AdminRoute token={token}>
                <>
                  <AdminNavbar onLogout={handleLogout} />
                  <AdminEditUserPage />
                </>
              </AdminRoute>
            }
          />
          <Route
            path="/admin/menus/:menuId/edit"
            element={
              <AdminRoute token={token}>
                <>
                  <AdminNavbar onLogout={handleLogout} />
                  <AdminMenuEditorPage />
                </>
              </AdminRoute>
            }
          />

          {/* ✅ صفحات الأكواد الأربع (نفس الصفحة، تحدد النوع من المسار) */}
          <Route
            path="/admin/allergens"
            element={
              <AdminRoute token={token}>
                <>
                  <AdminNavbar onLogout={handleLogout} />
                <AdminAllergensPage />
                </>
              </AdminRoute>
            }
          />
          <Route
            path="/admin/additives"
            element={
              <AdminRoute token={token}>
                <>
                  <AdminNavbar onLogout={handleLogout} />
                  <AdminAllergensPage />
                </>
              </AdminRoute>
            }
          />
          <Route
            path="/admin/lexemes"
            element={
              <AdminRoute token={token}>
                <>
                  <AdminNavbar onLogout={handleLogout} />
                  <AdminAllergensPage />
                </>
              </AdminRoute>
            }
          />
          <Route
            path="/admin/ingredients"
            element={
              <AdminRoute token={token}>
                <>
                  <AdminNavbar onLogout={handleLogout} />
                  <AdminAllergensPage />
                </>
              </AdminRoute>
            }
          />

          {/* 🌐 صفحات العرض العامة */}
          <Route path="/show/menu/:publicSlug" element={<PublicMenuPage />} />

          {/* ❓ مسارات غير معروفة */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </React.Suspense>

      {/* زر يدوي لتشغيل الجولة عند الحاجة — يختفي قبل التوثيق وخارج مسارات المستخدم */}
      <StartTourButton token={token} />
    </Router>
  )
}
