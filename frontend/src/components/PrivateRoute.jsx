// src/components/PrivateRoute.jsx
// Route-guard: يضمن المصادقة لصاحب المطعم (owner)
// ويحول الأدمن تلقائيًا إلى /admin/users
// -----------------------------------------------
import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { whoAmI } from '../services/axios';

export default function PrivateRoute() {
  const location = useLocation();
  const token = localStorage.getItem('access_token') || sessionStorage.getItem('token');
  const savedRole = (sessionStorage.getItem('role') || localStorage.getItem('role') || '').toLowerCase();

  const [role, setRole] = React.useState(savedRole);
  const [pending, setPending] = React.useState(Boolean(token && !savedRole));

  React.useEffect(() => {
    let alive = true;
    const run = async () => {
      if (!token) return;
      if (savedRole) return;
      setPending(true);
      const me = await whoAmI();
      const r = (me?.role || (me?.is_staff ? 'admin' : 'owner') || '').toLowerCase();
      if (!alive) return;
      const finalRole = r === 'admin' ? 'admin' : 'owner';
      sessionStorage.setItem('role', finalRole);
      localStorage.setItem('role', finalRole);
      setRole(finalRole);
      setPending(false);
    };
    run();
    return () => (alive = false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  if (!token) {
    return <Navigate to="/" state={{ from: location }} replace />;
  }

  if (pending) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', height: '60vh' }}>
        <div>…</div>
      </div>
    );
  }

  // لو أدمن، لا ندخله هنا — نعيد توجيهه للوحة الأدمن
  if (role === 'admin') {
    return <Navigate to="/admin/users" replace />;
  }

  return <Outlet />;
}
