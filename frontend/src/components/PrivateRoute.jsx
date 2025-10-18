// src/components/PrivateRoute.jsx
import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import api from '../services/axios';
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

async function pingAuth() {
  try {
    const { status } = await api.get('/me/profile/');
    return status >= 200 && status < 300;
  } catch {
    try {
      const { status } = await api.get('/auth/whoami');
      return status >= 200 && status < 300;
    } catch {
      return false;
    }
  }
}

export default function PrivateRoute({ children, token: propToken }) {
  const [state, setState] = useState({ loading: true, ok: false });

  useEffect(() => {
    let alive = true;

    const stored =
      propToken ||
      localStorage.getItem('access_token') ||
      localStorage.getItem('access') ||
      sessionStorage.getItem('token');

    // إن لم يوجد JWT صالح، لا نضيّع وقت على الشبكة
    if (!validJwt(stored)) {
      setState({ loading: false, ok: false });
      return () => { alive = false; };
    }

    (async () => {
      const ok = await pingAuth();
      if (!alive) return;
      setState({ loading: false, ok });
    })();

    return () => { alive = false; };
  }, [propToken]);

  if (state.loading) return <div style={styleSpinner}>جارِ التحقق…</div>;
  if (!state.ok) return <Navigate to="/" replace />;
  return children;
}
