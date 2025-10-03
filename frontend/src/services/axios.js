// src/services/axios.js
// axios instance + JWT interceptors (attach token, auto-refresh, map 401/403)
// ---------------------------------------------------------------------------

import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  withCredentials: false,
  headers: { 'Content-Type': 'application/json' },
});

// Helpers ----------------------------------------------------------
export const getAccess = () => localStorage.getItem('access_token');
export const getRefresh = () => localStorage.getItem('refresh_token');

export const setAccess = (t) => {
  if (t) localStorage.setItem('access_token', t);
  else localStorage.removeItem('access_token');
};
export const setRefresh = (t) => {
  if (t) localStorage.setItem('refresh_token', t);
  else localStorage.removeItem('refresh_token');
};

// عند بدء التشغيل، لو فيه توكن خزّله بالهيدر
const bootAccess = getAccess();
if (bootAccess) api.defaults.headers.common.Authorization = `Bearer ${bootAccess}`;

// Interceptors -----------------------------------------------------
let isRefreshing = false;
let pendingQueue = [];

const flushQueue = (err, token = null) => {
  pendingQueue.forEach((p) => (err ? p.reject(err) : p.resolve(token)));
  pendingQueue = [];
};

// request: أرفق الـ Authorization إن وجد
api.interceptors.request.use((config) => {
  const token = getAccess();
  if (token && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// response: جرّب refresh مرة واحدة على 401
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const { config, response } = error;
    const status = response?.status;

    // 403: رجّع خطأ مضبوط برسالة مفهومة
    if (status === 403) {
      return Promise.reject({
        ...error,
        friendly: 'forbidden',
      });
    }

    // 401: نحاول نعمل refresh مرة واحدة
    if (status === 401 && !config.__isRetryRequest) {
      if (isRefreshing) {
        // نضيف الطلب للطابور ليتعاد بعد نجاح الـ refresh
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

        // خزّن التوكن الجديد و أعد الطلبات المعلّقة
        setAccess(newAccess);
        api.defaults.headers.common.Authorization = `Bearer ${newAccess}`;
        flushQueue(null, newAccess);

        // أعد تنفيذ الطلب الأصلي
        config.headers.Authorization = `Bearer ${newAccess}`;
        return api(config);
      } catch (err) {
        flushQueue(err, null);
        // نظّف واعِد توجيه للّوجين من عند الراوتر (أو اترك الصفحة تتعامل)
        setAccess(null);
        setRefresh(null);
        sessionStorage.removeItem('role');
        sessionStorage.removeItem('token');
        return Promise.reject({
          ...error,
          friendly: 'unauthorized',
        });
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

// whoami: مفيدة للحراس
export async function whoAmI() {
  try {
    const { data } = await api.get('/auth/whoami');
    return data;
  } catch {
    return null;
  }
}

export default api;
