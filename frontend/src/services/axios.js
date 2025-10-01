// frontend/src/services/axios.js
import axios from "axios";

// ==== مصدر الحقيقة لجميع طلبات الـ API ====
// يمر عبر Nginx على نفس الدومين: http(s)://<host>/api/ -> Django
const api = axios.create({
  baseURL: "/api",
  timeout: 15000,
  withCredentials: false,
  headers: {
    Accept: "application/json",
    "Content-Type": "application/json",
  },
});

// قراءة التوكن من التخزين (ندعم أكثر من اسم مفتاح تحسبًا لاختلافات سابقة)
function readAccess() {
  return (
    window.localStorage.getItem("access") ||
    window.localStorage.getItem("token") ||
    window.localStorage.getItem("accessToken") ||
    ""
  );
}
function readRefresh() {
  return (
    window.localStorage.getItem("refresh") ||
    window.localStorage.getItem("refreshToken") ||
    ""
  );
}
function saveAccess(token) {
  if (token) {
    window.localStorage.setItem("access", token);
  }
}
function logoutAndGoLogin() {
  try {
    window.localStorage.removeItem("access");
    window.localStorage.removeItem("refresh");
    window.localStorage.removeItem("token");
    window.localStorage.removeItem("accessToken");
    window.localStorage.removeItem("userRole");
  } catch {}
  // اترك المسار كما تستعمله في مشروعك
  window.location.href = "/login";
}

// ----- Request interceptor: يحقن Authorization تلقائيًا -----
api.interceptors.request.use(
  (config) => {
    const access = readAccess();
    if (access && !config.headers?.Authorization) {
      config.headers = {
        ...config.headers,
        Authorization: `Bearer ${access}`,
      };
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ----- Response interceptor: يحدّث التوكن عند 401 مرة واحدة ثم يعيد المحاولة -----
let isRefreshing = false;
let pendingQueue = [];

function processQueue(error, token = null) {
  pendingQueue.forEach((p) => {
    if (error) p.reject(error);
    else p.resolve(token);
  });
  pendingQueue = [];
}

api.interceptors.response.use(
  (resp) => resp,
  async (error) => {
    const original = error.config;

    // 403 -> صلاحيات غير كافية (أبقِ الرسالة كما هي في الواجهة)
    if (error?.response?.status === 403) {
      return Promise.reject(error);
    }

    // معالجة 401 لتحديث التوكن
    if (error?.response?.status === 401 && !original?._retry) {
      original._retry = true;

      const refresh = readRefresh();
      if (!refresh) {
        logoutAndGoLogin();
        return Promise.reject(error);
      }

      if (isRefreshing) {
        // انتظر نتيجة تحديث جارية
        return new Promise((resolve, reject) => {
          pendingQueue.push({
            resolve: (token) => {
              original.headers.Authorization = `Bearer ${token}`;
              resolve(api(original));
            },
            reject,
          });
        });
      }

      isRefreshing = true;

      try {
        const { data } = await api.post("/token/refresh/", { refresh });
        const newAccess = data?.access;
        if (!newAccess) throw new Error("refresh failed");

        saveAccess(newAccess);
        processQueue(null, newAccess);
        original.headers.Authorization = `Bearer ${newAccess}`;
        return api(original);
      } catch (e) {
        processQueue(e, null);
        logoutAndGoLogin();
        return Promise.reject(e);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default api;
