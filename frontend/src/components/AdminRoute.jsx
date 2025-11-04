// src/components/AdminRoute.jsx
import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import api, { whoAmI as fetchWhoAmI } from '../services/axios';
import { jwtDecode } from 'jwt-decode';

const styleSpinner = {
  display: 'grid',
  placeItems: 'center',
  height: '60vh',
  fontFamily: 'system-ui, sans-serif',
  color: '#555',
};

function validJwt(t) {
  if (!t) return false;
  try {
    const { exp } = jwtDecode(t);
    return !exp || exp * 1000 > Date.now();
  } catch {
    return false;
  }
}

function roleFromToken(t) {
  try {
    const d = jwtDecode(t);
    if (d?.role) return String(d.role).toLowerCase();
    if (d?.is_staff || d?.is_superuser) return 'admin';
    return '';
  } catch {
    return '';
  }
}

async function whoAmI() {
  // نحاول نقطتين محتملتين حسب الباكند عندك
  try {
    const { data } = await api.get('/auth/whoami');
    return data;
  } catch {
    try {
      const { data } = await api.get('/me/profile/');
      return data;
    } catch {
      return null;
    }
  }
}


// Cached whoAmI wrapper to avoid bursts
async function whoAmICached() {
  try {
    const me = await fetchWhoAmI();
    return me;
  } catch {
    return null;
  }
}
export default function AdminRoute({ children, token: propToken }) {
  const [state, setState] = useState({
    loading: true,
    allow: false,
    redirect: '/',
  });

  useEffect(() => {
    let alive = true;

    const stored =
      propToken ||
      localStorage.getItem('access_token') ||
      localStorage.getItem('access') ||
      sessionStorage.getItem('token');

    if (!validJwt(stored)) {
      setState({ loading: false, allow: false, redirect: '/' });
      return () => { alive = false; };
    }

    // 1) جرّب من التوكن مباشرة
    const roleTok = roleFromToken(stored);
    if (roleTok) {
      const admin = roleTok === 'admin';
      setState({ loading: false, allow: admin, redirect: admin ? null : '/menus' });
      return () => { alive = false; };
    }

    // 2) جرّب من التخزين
    const roleLS = (
      sessionStorage.getItem('role') ||
      localStorage.getItem('role') ||
      ''
    ).toLowerCase();

    if (roleLS) {
      const admin = roleLS === 'admin';
      setState({ loading: false, allow: admin, redirect: admin ? null : '/menus' });
      return () => { alive = false; };
    }

    // 3) آخرًا، اسأل الباكند بشكل صريح
    (async () => {
      const me = await whoAmICached();
      if (!alive) return;
      const isAdmin = !!(me?.is_staff || me?.is_superuser || String(me?.role).toLowerCase() === 'admin');
      setState({ loading: false, allow: isAdmin, redirect: isAdmin ? null : '/menus' });
    })();

    return () => { alive = false; };
  }, [propToken]);

  if (state.loading) return <div style={styleSpinner}>جارِ التحقق من الصلاحية…</div>;
  if (!state.allow) return <Navigate to={state.redirect || '/'} replace />;
  return children;
}

