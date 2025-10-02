import React from 'react';
import { Navigate } from 'react-router-dom';
import { jwtDecode } from 'jwt-decode';

// ================= Helpers =================
const norm = (v) => (v ?? '').toString().toLowerCase();

function isAdminFromClaims(decoded) {
  if (!decoded || typeof decoded !== 'object') return false;

  // 1) أدوار مباشرة
  const directRole =
    decoded.role ??
    decoded.user?.role ??
    (Array.isArray(decoded.roles) ? decoded.roles[0] : undefined);
  if (typeof directRole === 'string') {
    const r = directRole.toLowerCase();
    if (['admin', 'administrator', 'superadmin', 'role_admin'].includes(r)) return true;
  }

  // 2) أعلام شائعة في Django/DRF
  if (
    decoded.is_admin === true ||
    decoded.isAdmin === true ||
    decoded.is_staff === true ||
    decoded.is_superuser === true ||
    decoded.user?.is_staff === true ||
    decoded.user?.is_superuser === true
  ) {
    return true;
  }

  // 3) مجموعات/صلاحيات: قد تكون array of strings أو objects
  const arrToStrings = (arr) =>
    (Array.isArray(arr) ? arr : [])
      .map((x) => (typeof x === 'string' ? x : x?.name || x?.codename || ''))
      .filter(Boolean)
      .map((s) => s.toLowerCase());

  const groups = arrToStrings(decoded.groups || decoded.user?.groups);
  if (groups.some((g) => g.includes('admin') || g.includes('staff') || g.includes('super'))) {
    return true;
  }

  const perms = arrToStrings(decoded.permissions || decoded.user?.permissions);
  if (perms.some((p) => p.includes('admin') || p.includes('staff') || p.includes('super'))) {
    return true;
  }

  return false;
}

// ================ Component ================
export default function AdminRoute({ token, children }) {
  // 0) لو الدور مخزّن مسبقًا بشكل صريح
  const storedRole = norm(sessionStorage.getItem('role') || localStorage.getItem('role'));
  if (storedRole === 'admin') {
    return children;
  }

  // 1) اجلب التوكن من أكثر من مصدر
  const authToken =
    token ||
    sessionStorage.getItem('token') ||
    localStorage.getItem('access_token') ||
    localStorage.getItem('token');

  if (!authToken) return <Navigate to="/" replace />;

  // 2) فكّ الـJWT وحكم
  try {
    const decoded = jwtDecode(authToken);

    const admin = isAdminFromClaims(decoded);
    if (admin) return children;

    // 3) fallback أخير (حالات غريبة)
    const flags = ['is_staff', 'is_superuser', 'is_admin', 'isAdmin'];
    for (const k of flags) {
      if (decoded?.[k] === true || decoded?.user?.[k] === true) return children;
    }

    // ليس أدمن → إلى قوائم المالك
    return <Navigate to="/menus" replace />;
  } catch {
    return <Navigate to="/" replace />;
  }
}
