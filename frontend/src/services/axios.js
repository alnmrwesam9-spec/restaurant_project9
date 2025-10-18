// src/services/axios.js
// axios instance + JWT interceptors (attach token, auto-refresh, map 401/403)

import axios from 'axios';

// في التطوير والإنتاج: استعمل مسار نسبي وخلّ البروكسي/NGINX يتكفّل
// Always route through Vite proxy (dev) or reverse proxy (prod)
const apiBase = (() => {
  try {
    const env = typeof import.meta !== 'undefined' ? import.meta.env : null;
    const fromEnv = env?.VITE_API_BASE_URL || env?.VITE_API_BASE || '';
    if (fromEnv) {
      if (/^https?:\/\//i.test(fromEnv)) {
        return fromEnv.replace(/\/+$/, '');
      }
      return fromEnv;
    }
  } catch (_) {}
  return '/api';
})();

const api = axios.create({
  baseURL: apiBase,
  withCredentials: false,
  timeout: 20000,
  headers: { 'Content-Type': 'application/json' },
});

/* ----------------------------- Token helpers ----------------------------- */
export const getAccess = () =>
  localStorage.getItem('access_token') || localStorage.getItem('access');

export const getRefresh = () =>
  localStorage.getItem('refresh_token') || localStorage.getItem('refresh');

export const setAccess = (t) => {
  if (t) {
    localStorage.setItem('access_token', t);
    localStorage.setItem('access', t);
  } else {
    localStorage.removeItem('access_token');
    localStorage.removeItem('access');
  }
};

export const setRefresh = (t) => {
  if (t) {
    localStorage.setItem('refresh_token', t);
    localStorage.setItem('refresh', t);
  } else {
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('refresh');
  }
};

/* ---------------------------- Unauthorized hook --------------------------- */
let onUnauthorized = null;
export function setOnUnauthorized(fn) {
  onUnauthorized = typeof fn === 'function' ? fn : null;
}

/* ------------------------------- Boot header ------------------------------ */
const bootAccess = getAccess();
if (bootAccess) {
  api.defaults.headers.common.Authorization = `Bearer ${bootAccess}`;
}

/* --------------------------------- Queue --------------------------------- */
let isRefreshing = false;
let pendingQueue = [];
const flushQueue = (err, token = null) => {
  pendingQueue.forEach((p) => (err ? p.reject(err) : p.resolve(token)));
  pendingQueue = [];
};

/* ------------------------------- Interceptors ----------------------------- */
// request: attach Authorization
api.interceptors.request.use((config) => {
  const token = getAccess();
  config.headers = config.headers || {};
  // Normalize legacy/ambiguous endpoints to match Django URLs
  try {
    const orig = config.url || '';
    if (typeof orig === 'string') {
      const qIndex = orig.indexOf('?');
      const path = qIndex >= 0 ? orig.slice(0, qIndex) : orig;
      const qs = qIndex >= 0 ? orig.slice(qIndex) : '';

      const ensureSlash = (p) => (p.endsWith('/') ? p : p + '/');
      let p = path;

      // Map /allergens -> /allergens/codes/
      if (p === '/allergens' || p === '/allergens/') {
        p = '/allergens/codes/';
      }
      // Map /additives -> /additives/codes/
      if (p === '/additives' || p === '/additives/') {
        p = '/additives/codes/';
      }
      // Ensure trailing slash for DRF routers
      if (p === '/lexemes') p = '/lexemes/';
      if (p === '/ingredients') p = '/ingredients/';

      const normalized = p + qs;
      if (normalized !== orig) config.url = normalized;
    }
  } catch (_) {
    // no-op: never block the request on normalization
  }
  if (token && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// response: try refresh on 401 (except for token endpoints)
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const { config, response } = error || {};
    const status = response?.status;
    const url = (config && (config.url || '')) || '';

    if (status === 403) {
      return Promise.reject({ ...error, friendly: 'forbidden' });
    }

    // استثناء طلبات المصادقة نفسها من منطق الـ refresh
    // (تسجيل الدخول أو تحديث التوكن) كي لا نرمي المستخدم خارج الصفحة
    const isAuthEndpoint =
      /\/token\/?$/.test(url) ||                     // POST /api/token/
      /\/auth\/login\/?$/.test(url) ||               // POST /api/auth/login/
      /\/(token|auth)\/refresh\/?$/.test(url);       // POST /api/token/refresh/ أو /api/auth/refresh/

    // لو فشل طلب المصادقة نفسه (401 أثناء تسجيل الدخول/التحديث)
    // رجّع الخطأ للواجهة حتى تعرض الرسالة، بدون أي إعادة توجيه
    if (status === 401 && isAuthEndpoint) {
      return Promise.reject(error);
    }

    // For other 401 responses try a single refresh
    if (status === 401 && !config.__isRetryRequest) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          pendingQueue.push({
            resolve: (token) => {
              config.headers = config.headers || {};
              config.headers.Authorization = `Bearer ${token}`;
              config.__isRetryRequest = true;
              resolve(api(config));
            },
            reject,
          });
        });
      }

      config.__isRetryRequest = true;
      isRefreshing = true;

      try {
        const refresh = getRefresh();
        if (!refresh) throw new Error('No refresh token');

        const { data } = await api.post('/token/refresh/', { refresh });
        const newAccess = data?.access;
        if (!newAccess) throw new Error('No access from refresh');

        setAccess(newAccess);
        api.defaults.headers.common.Authorization = `Bearer ${newAccess}`;
        flushQueue(null, newAccess);

        config.headers = config.headers || {};
        config.headers.Authorization = `Bearer ${newAccess}`;
        return api(config);
      } catch (err) {
        flushQueue(err, null);
        setAccess(null);
        setRefresh(null);
        sessionStorage.removeItem('token');
        sessionStorage.removeItem('role');
        delete api.defaults.headers.common.Authorization;
        if (onUnauthorized) onUnauthorized();
        return Promise.reject({ ...error, friendly: 'unauthorized' });
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

/* ------------------------------- Small helper ----------------------------- */
export async function whoAmI() {
  try {
    const { data } = await api.get('/auth/whoami');
    return data;
  } catch {
    return null;
  }
}

export default api;
