import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { jwtDecode } from 'jwt-decode';

function isAdminFromClaims(decoded) {
  if (!decoded || typeof decoded !== 'object') return false;

  const directRole =
    decoded.role ??
    decoded.user?.role ??
    (Array.isArray(decoded.roles) ? decoded.roles[0] : undefined);

  if (typeof directRole === 'string') {
    const r = directRole.toLowerCase();
    if (['admin', 'administrator', 'superadmin', 'role_admin'].includes(r)) return true;
  }

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

export default function AdminRoute({ token, children }) {
  const location = useLocation();
  const navigate  = useNavigate();

  // اقرأ التوكن من props ثم من التخزين
  const authToken =
    token || sessionStorage.getItem('token') || localStorage.getItem('token');

  // استنتج الحالة بشكل ثابت لكل رندر (بدون returns مبكرة)
  const { isAuthed, isAdmin } = React.useMemo(() => {
    if (!authToken) return { isAuthed: false, isAdmin: false };
    try {
      const decoded = jwtDecode(authToken);
      let admin = isAdminFromClaims(decoded);
      if (!admin) {
        const role = (sessionStorage.getItem('role') || localStorage.getItem('role') || '').toLowerCase();
        admin = role === 'admin';
      }
      return { isAuthed: true, isAdmin: admin };
    } catch {
      return { isAuthed: false, isAdmin: false };
    }
  }, [authToken]);

  // نفّذ التحويل هنا دائماً (الهُوكس تُستدعى في كل رندر)
  React.useEffect(() => {
    if (!isAuthed) {
      navigate('/', { replace: true, state: { from: location } });
      return;
    }
    if (!isAdmin) {
      navigate('/menus', { replace: true });
    }
  }, [isAuthed, isAdmin, navigate, location]);

  // أثناء التحويل اعرض لا شيء (أو Loader)
  if (!isAuthed || !isAdmin) {
    return null;
  }

  return <>{children}</>;
}
