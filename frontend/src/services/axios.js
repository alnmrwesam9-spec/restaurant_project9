// frontend/src/services/axios.js
import axios from "axios";

// قاعدة الـ API: نقرأ VITE_API_BASE أو نستخدم "/api" افتراضيًا
const API_BASE =
  (import.meta.env.VITE_API_BASE && import.meta.env.VITE_API_BASE.trim()) ||
  "/api";

const api = axios.create({
  baseURL: API_BASE,
  withCredentials: false,
  headers: { "Content-Type": "application/json" },
});

let onUnauthorizedCb = null;
export function setOnUnauthorized(fn) {
  onUnauthorizedCb = typeof fn === "function" ? fn : null;
}

// أضف Authorization إن وُجد access_token
api.interceptors.request.use((config) => {
  const token = window.localStorage.getItem("access_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// تعامل مع 401، مع استثناء مسارات التوكن (login/refresh)
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const { response, config } = error;
    if (!response) return Promise.reject(error);

    // لا تحاول تجديد/إعادة توجيه عند فشل /token/ أو /token/refresh/
    const url = (config?.url || "").toString();
    const isTokenEndpoint =
      url.endsWith("/token/") || url.endsWith("/token/refresh/") ||
      url.includes("/token/?") || url.includes("/token/refresh/?");

    if (response.status === 401 && !isTokenEndpoint) {
      const refresh = window.localStorage.getItem("refresh_token");
      if (refresh) {
        try {
          const { data } = await axios.post(`${API_BASE}/token/refresh/`, { refresh });
          if (data?.access) {
            window.localStorage.setItem("access_token", data.access);
            const retry = { ...config };
            retry.headers = { ...retry.headers, Authorization: `Bearer ${data.access}` };
            return api.request(retry);
          }
        } catch (_) {
          // سقوط للـ logout
        }
      }
      window.localStorage.removeItem("access_token");
      window.localStorage.removeItem("refresh_token");
      if (onUnauthorizedCb) onUnauthorizedCb();
    }

    return Promise.reject(error);
  }
);

export default api;
