// src/App.jsx
import React, { useState, useEffect, useMemo } from 'react';
import {
  createBrowserRouter,
  RouterProvider,
  Navigate,
} from 'react-router-dom';
import api, { setOnUnauthorized } from './services/axios';
import { jwtDecode } from 'jwt-decode';

// صفحات المستخدم
import LoginPage from './pages/LoginPage';
import Register from './pages/Register';
import MenusPage from './pages/MenusPage';
import SectionPage from './pages/SectionPage';
import DishPage from './pages/DishPage';
import ReportsDashboard from './pages/ReportsDashboard';

// صفحات الأدمن
import AdminUsersPage from './pages/AdminUsersPage';
import AdminUserMenusPage from './pages/AdminUserMenusPage';
import AdminUserDetailsPage from './pages/AdminUserDetailsPage';
import AdminEditUserPage from './pages/AdminEditUserPage';
import AdminMenuEditorPage from './pages/AdminMenuEditorPage';

// الحماية والملاحة المشتركة
import PrivateRoute from './components/PrivateRoute';
import AdminRoute from './components/AdminRoute';
import UserNavbar from './components/UserNavbar';
import AdminNavbar from './components/AdminNavbar';

// إعدادات القوائم
import MenuPublicSettings from './pages/MenuPublicSettings';

// صفحة عامة
import PublicMenuPage from './pages/PublicMenuPage';

export default function App() {
  const [token, setToken] = useState(null);

  useEffect(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('role');

    const t = sessionStorage.getItem('token');
    const valid =
      t &&
      (() => {
        try {
          const { exp } = jwtDecode(t);
          return !exp || exp * 1000 > Date.now();
        } catch {
          return false;
        }
      })();

    if (valid) {
      setToken(t);
      api.defaults.headers.common.Authorization = `Bearer ${t}`;
    } else {
      sessionStorage.removeItem('token');
      sessionStorage.removeItem('role');
      delete api.defaults.headers.common.Authorization;
      setToken(null);
    }

    setOnUnauthorized(() => {
      sessionStorage.removeItem('token');
      sessionStorage.removeItem('role');
      delete api.defaults.headers.common.Authorization;
      setToken(null);
      window.location.replace('/');
    });
  }, []);

  const handleLogin = (accessToken) => {
    setToken(accessToken);
    api.defaults.headers.common.Authorization = `Bearer ${accessToken}`;
  };

  const handleLogout = () => {
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('role');
    delete api.defaults.headers.common.Authorization;
    setToken(null);
  };

  const targetAfterAuth = useMemo(() => {
    if (!token) return null;
    try {
      const d = jwtDecode(token);
      const isAdmin =
        d?.role === 'admin' || d?.is_staff === true || d?.is_superuser === true;
      return isAdmin ? '/admin/users' : '/menus';
    } catch {
      return '/menus';
    }
  }, [token]);

  // نصنع الراوتر مع تمكين future flags الخاصة بـ v7
  const router = useMemo(
    () =>
      createBrowserRouter(
        [
          {
            path: '/',
            element: token ? (
              <Navigate to={targetAfterAuth} replace />
            ) : (
              <LoginPage onLogin={handleLogin} />
            ),
          },
          {
            path: '/register',
            element: token ? (
              <Navigate to={targetAfterAuth} replace />
            ) : (
              <Register onLogin={handleLogin} />
            ),
          },

          // لوحة المستخدم
          {
            path: '/menus',
            element: (
              <PrivateRoute token={token}>
                <>
                  <UserNavbar onLogout={handleLogout} />
                  <MenusPage token={token} />
                </>
              </PrivateRoute>
            ),
          },
          {
            path: '/menus/:menuId',
            element: (
              <PrivateRoute token={token}>
                <>
                  <UserNavbar onLogout={handleLogout} />
                  <SectionPage />
                </>
              </PrivateRoute>
            ),
          },
          {
            path: '/sections/:sectionId/dishes',
            element: (
              <PrivateRoute token={token}>
                <>
                  <UserNavbar onLogout={handleLogout} />
                  <DishPage />
                </>
              </PrivateRoute>
            ),
          },
          {
            path: '/menus/:menuId/public-settings',
            element: (
              <PrivateRoute token={token}>
                <>
                  <UserNavbar onLogout={handleLogout} />
                  <MenuPublicSettings />
                </>
              </PrivateRoute>
            ),
          },

          { path: '/reports', element: <ReportsDashboard /> },

          // لوحة الأدمن
          {
            path: '/admin/users',
            element: (
              <AdminRoute token={token}>
                <>
                  <AdminNavbar onLogout={handleLogout} />
                  <AdminUsersPage />
                </>
              </AdminRoute>
            ),
          },
          {
            path: '/admin/users/:userId/menus',
            element: (
              <AdminRoute token={token}>
                <>
                  <AdminNavbar onLogout={handleLogout} />
                  <AdminUserMenusPage />
                </>
              </AdminRoute>
            ),
          },
          {
            path: '/admin/users/:userId/details',
            element: (
              <AdminRoute token={token}>
                <>
                  <AdminNavbar onLogout={handleLogout} />
                  <AdminUserDetailsPage />
                </>
              </AdminRoute>
            ),
          },
          {
            path: '/admin/users/:userId/edit',
            element: (
              <AdminRoute token={token}>
                <>
                  <AdminNavbar onLogout={handleLogout} />
                  <AdminEditUserPage />
                </>
              </AdminRoute>
            ),
          },
          {
            path: '/admin/menus/:menuId/edit',
            element: (
              <AdminRoute token={token}>
                <>
                  <AdminNavbar onLogout={handleLogout} />
                  <AdminMenuEditorPage />
                </>
              </AdminRoute>
            ),
          },

          // صفحات العرض العامة
          { path: '/show/menu/:publicSlug', element: <PublicMenuPage /> },

          // fallback
          { path: '*', element: <Navigate to='/' replace /> },
        ],
        {
          future: {
            v7_startTransition: true,
            v7_relativeSplatPath: true,
          },
        }
      ),
    [token, targetAfterAuth]
  );

  return (
    <RouterProvider
      router={router}
      future={{ v7_startTransition: true }} // لتأكيد التفعيل
    />
  );
}
