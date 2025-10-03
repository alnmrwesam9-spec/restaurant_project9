// src/App.js
// --------------------------------------------------------------
// Router setup (merged):
// - RootRedirect يحسم الوجهة من "/":
//     unauthenticated  => LoginPage
//     admin            => /admin/users
//     owner/user       => /menus
// - يحافظ على جميع مسارات المشروع القديمة
// - يهيّئ Axios Authorization عند الإقلاع وبعد تسجيل الدخول
// - onUnauthorized (401) ينظف الجلسة ويعيد إلى "/"
// --------------------------------------------------------------

import React, { useState, useEffect, useMemo } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import api, { setOnUnauthorized } from './services/axios';
import { jwtDecode } from 'jwt-decode';

// 📄 صفحات المستخدم
import LoginPage from './pages/LoginPage';
import Register from './pages/Register';
import MenusPage from './pages/MenusPage';
import SectionPage from './pages/SectionPage';
import DishPage from './pages/DishPage';
import ReportsDashboard from './pages/ReportsDashboard';

// 📄 صفحات الأدمن
import AdminUsersPage from './pages/AdminUsersPage';
import AdminUserMenusPage from './pages/AdminUserMenusPage';
import AdminUserDetailsPage from './pages/AdminUserDetailsPage';
import AdminEditUserPage from './pages/AdminEditUserPage';
import AdminMenuEditorPage from './pages/AdminMenuEditorPage';

// 🛡️ الحماية والملاحة المشتركة
import PrivateRoute from './components/PrivateRoute';
import AdminRoute from './components/AdminRoute';
import UserNavbar from './components/UserNavbar';
import AdminNavbar from './components/AdminNavbar';

// ⚙️ إعدادات نشر القائمة
import MenuPublicSettings from './pages/MenuPublicSettings';

// 🌐 صفحة عرض عامة (للقوائم العامة)
import PublicMenuPage from './pages/PublicMenuPage';

// أداة مساعدة: فحص صلاحية JWT إن أمكن
function isJwtValidMaybe(token) {
  if (!token) return false;
  try {
    const { exp } = jwtDecode(token);
    // إذا لا يوجد exp نعتبره صالح (لبعض الباك إند)
    return !exp || exp * 1000 > Date.now();
  } catch {
    return false;
  }
}

// أداة مساعدة: تحديد هل التوكن يدل على أدمن
function isAdminFromToken(token) {
  try {
    const d = jwtDecode(token);
    return d?.role === 'admin' || d?.is_staff === true || d?.is_superuser === true;
  } catch {
    return false;
  }
}

export default function App() {
  const [token, setToken] = useState(null);

  // 🔐 عند تحميل التطبيق: حاول إيجاد توكن صالح من أي مصدر منطقي
  useEffect(() => {
    const accessFromLocal = localStorage.getItem('access_token');
    const tokenFromSession = sessionStorage.getItem('token');

    const chosen =
      (isJwtValidMaybe(accessFromLocal) && accessFromLocal) ||
      (isJwtValidMaybe(tokenFromSession) && tokenFromSession) ||
      null;

    if (chosen) {
      setToken(chosen);
      api.defaults.headers.common.Authorization = `Bearer ${chosen}`;
    } else {
      // تنظيف إذا فشل
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('token');
      localStorage.removeItem('role');
      sessionStorage.removeItem('token');
      sessionStorage.removeItem('role');
      delete api.defaults.headers.common.Authorization;
      setToken(null);
    }

    // 401 عالميًا → تنظيف والعودة للدخول
    setOnUnauthorized(() => {
      try {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('token');
        localStorage.removeItem('role');
        sessionStorage.removeItem('token');
        sessionStorage.removeItem('role');
        delete api.defaults.headers.common.Authorization;
        setToken(null);
      } finally {
        window.location.replace('/');
      }
    });
  }, []);

  // ✅ يُستدعى من صفحات الدخول/التسجيل بعد نجاح المصادقة
  const handleLogin = (accessToken) => {
    setToken(accessToken);
    api.defaults.headers.common.Authorization = `Bearer ${accessToken}`;
    // التخزين (local/session) يتم داخل LoginPage/Register حسب اختيارك
  };

  // 🚪 تسجيل الخروج
  const handleLogout = () => {
    try {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('token');
      localStorage.removeItem('role');
      sessionStorage.removeItem('token');
      sessionStorage.removeItem('role');
      delete api.defaults.headers.common.Authorization;
    } finally {
      setToken(null);
    }
  };

  // 🎯 الوجهة بعد التوثيق
  const targetAfterAuth = useMemo(() => {
    if (!token) return null;

    // أولاً حاول من التوكن نفسه
    if (isAdminFromToken(token)) return '/admin/users';

    // إن لم يتوفر الدور داخل JWT نعتمد التخزين
    const role =
      (sessionStorage.getItem('role') || localStorage.getItem('role') || '')
        .toLowerCase();
    return role === 'admin' ? '/admin/users' : '/menus';
  }, [token]);

  // 🧭 RootRedirect: يستخدم حالة التطبيق + التخزين لتقرير الوجهة عند "/"
  function RootRedirect() {
    const storedToken =
      localStorage.getItem('access_token') || sessionStorage.getItem('token');

    const effectiveToken = token || storedToken;

    if (!isJwtValidMaybe(effectiveToken)) {
      // غير موثق -> نعرض صفحة الدخول مباشرة مع onLogin
      return <LoginPage onLogin={handleLogin} />;
    }

    // موثق -> وجه حسب الدور
    const role =
      (sessionStorage.getItem('role') || localStorage.getItem('role') || '')
        .toLowerCase();
    const goAdmin = isAdminFromToken(effectiveToken) || role === 'admin';
    return <Navigate to={goAdmin ? '/admin/users' : '/menus'} replace />;
  }

  return (
    <Router>
      <Routes>
        {/* 📌 الجذر: يقرر الوجهة تلقائيًا */}
        <Route path="/" element={<RootRedirect />} />

        {/* التسجيل: إذا كنت موثقًا نحولك لوجهتك، وإلا نعرض Register */}
        <Route
          path="/register"
          element={
            token ? <Navigate to={targetAfterAuth || '/menus'} replace /> : <Register onLogin={handleLogin} />
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

        {/* 📊 تقارير (إن أردتها محمية لفّها بـ PrivateRoute) */}
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

        {/* 🌐 صفحات العرض العامة */}
        <Route path="/show/menu/:publicSlug" element={<PublicMenuPage />} />

        {/* ❓ مسارات غير معروفة */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}
