// src/App.js
// -----------------------------------------------
// ملف الراوتر الرئيسي لتطبيق React (محدّث):
// - "/"        → LoginPage
// - "/menus"   → MenusPage (محمي بـ PrivateRoute)
// - "/admin/users" → AdminUsersPage (محمي بـ AdminRoute)
// - ضبط Authorization عند الإقلاع وبعد تسجيل الدخول
// - onUnauthorized (401) ينظف الجلسة ويعيد إلى "/"
// -----------------------------------------------

import React, { useState, useEffect } from 'react';
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

function App() {
  const [token, setToken] = useState(null);

  // عند تحميل التطبيق: اقرأ التوكن من Session فقط واضبط الهيدر
  useEffect(() => {
    // نظّف مفاتيح قديمة غير مستخدمة
    localStorage.removeItem('token');
    localStorage.removeItem('role');

    const tokenFromSession = sessionStorage.getItem('token');

    const isValid = tokenFromSession
      ? (() => {
          try {
            const { exp } = jwtDecode(tokenFromSession);
            return !exp || exp * 1000 > Date.now();
          } catch {
            return false;
          }
        })()
      : false;

    if (isValid) {
      setToken(tokenFromSession);
      api.defaults.headers.common.Authorization = `Bearer ${tokenFromSession}`;
    } else {
      sessionStorage.removeItem('token');
      sessionStorage.removeItem('role');
      delete api.defaults.headers.common.Authorization;
      setToken(null);
    }

    // 401 عالميًا → تنظيف والعودة للدخول
    setOnUnauthorized(() => {
      try {
        // نظّف كل شيء
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

  // يُستدعى من صفحات الدخول/التسجيل بعد نجاح المصادقة
  const handleLogin = (accessToken) => {
    setToken(accessToken);
    api.defaults.headers.common.Authorization = `Bearer ${accessToken}`;
    // التخزين يتم داخل صفحة الدخول نفسها (local/session)
  };

  // تسجيل الخروج
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

  // الهدف بعد التوثيق: أدمن → /admin/users، غير ذلك → /menus
  const targetAfterAuth = (() => {
    if (!token) return null;
    try {
      const d = jwtDecode(token);
      const isAdmin =
        d?.role === 'admin' || d?.is_staff === true || d?.is_superuser === true;
      return isAdmin ? '/admin/users' : '/menus';
    } catch {
      return '/menus';
    }
  })();

  return (
    <Router>
      <Routes>
        {/* 📌 الجذر: صفحة الدخول */}
        <Route
          path="/"
          element={
            token ? (
              <Navigate to={targetAfterAuth} replace />
            ) : (
              <LoginPage onLogin={handleLogin} />
            )
          }
        />

        {/* التسجيل */}
        <Route
          path="/register"
          element={
            token ? (
              <Navigate to={targetAfterAuth} replace />
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

        {/* تقارير (إن أردتها محمية ضعها داخل PrivateRoute) */}
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

export default App;
