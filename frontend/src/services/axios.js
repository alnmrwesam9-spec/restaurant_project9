// src/services/axios.js
// axios instance + JWT interceptors (attach token, auto-refresh, map 401/403)

import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  withCredentials: false,
  headers: { 'Content-Type': 'application/json' },
});

/* ----------------------------- Token helpers ----------------------------- */
// نتعامل مع تسميتين لضمان التوافق الخلفي: access_token/refresh_token و access/refresh
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
// نوفّر hook ليستدعيه الـ App عند حصول 401 بعد فشل الـ refresh
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
// request: أرفق Authorization إن وجد
api.interceptors.request.use((config) => {
  const token = getAccess();
  if (token && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// response: جرّب refresh مرة واحدة على 401، ومرّر 403 برسالة مفهومة
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const { config, response } = error || {};
    const status = response?.status;

    if (status === 403) {
      return Promise.reject({ ...error, friendly: 'forbidden' });
    }

    // 401: محاولة refresh مرة واحدة مع دعم الانتظار للطلبات المتزامنة
    if (status === 401 && !config.__isRetryRequest) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          pendingQueue.push({
            resolve: (token) => {
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

        // خزّن وحدث الهيدرات
        setAccess(newAccess);
        api.defaults.headers.common.Authorization = `Bearer ${newAccess}`;
        flushQueue(null, newAccess);

        // أعد تنفيذ الطلب الأصلي
        config.headers.Authorization = `Bearer ${newAccess}`;
        return api(config);
      } catch (err) {
        flushQueue(err, null);
        // تنظيف شامل
        setAccess(null);
        setRefresh(null);
        sessionStorage.removeItem('token');
        sessionStorage.removeItem('role');
        delete api.defaults.headers.common.Authorization;

        // دع التطبيق يقرر التوجيه
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
