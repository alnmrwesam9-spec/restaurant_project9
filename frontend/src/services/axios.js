// src/services/axios.js
// -----------------------------------------------------------------------------
// عميل Axios موحّد للتعامل مع الـ API (متوافق مع Vite).
// - لا يرسل Authorization للطلبات العامة (/public/* أو /api/public/*).
// - يضيف Authorization تلقائياً لغير العامة إذا وُجد التوكن في sessionStorage.
// - مهلة افتراضية أطول، وتمديد إضافي لاستدعاء توليد أكواد الحساسية.
// - قابل للضبط عبر متغيرات بيئة Vite:
//     VITE_API_BASE_URL   مثال: http://127.0.0.1:8000/api  أو  /api  (للبروكسي)
//     VITE_API_ORIGIN     مثال: http://127.0.0.1:8000     (يُستخدم للأصول/toAbsolute)
// -----------------------------------------------------------------------------

import axios from 'axios';

// ==== قراءة البيئة وفق Vite ====
const ENV = (typeof import.meta !== 'undefined' && import.meta.env) || {};

// إن وُضع VITE_API_BASE_URL نستخدمه كما هو (قد يكون مطلقاً أو نسبياً "/api")
// وإلا نبني من VITE_API_ORIGIN (أو localhost) + "/api"
const API_BASE = (() => {
  const raw = ENV.VITE_API_BASE_URL;
  if (typeof raw === 'string' && raw.trim()) {
    return raw.replace(/\/+$/, '');
  }
  const origin = (ENV.VITE_API_ORIGIN || 'http://localhost:8000').replace(/\/+$/, '');
  return `${origin}/api`;
})();

// أصل الخادم لاستخدامه في toAbsolute (لروابط الصور مثلاً)
const API_ORIGIN = (() => {
  if (ENV.VITE_API_ORIGIN) return ENV.VITE_API_ORIGIN.replace(/\/+$/, '');
  try {
    if (/^https?:\/\//i.test(API_BASE)) return new URL(API_BASE).origin.replace(/\/+$/, '');
  } catch {}
  return 'http://localhost:8000';
})();

// ==== إنشاء نسخة Axios خاصة بنا ====
const instance = axios.create({
  baseURL: API_BASE,     // كل المسارات النسبية تُركّب على هذا الأساس
  timeout: 90000,        // مهلة افتراضية 90 ثانية
  headers: { 'Content-Type': 'application/json' },
});

// ==== أدوات مساعدة ====

// قراءة التوكن من التخزين (نفضّل sessionStorage)
function getToken() {
  return (
    sessionStorage.getItem('token') ||
    sessionStorage.getItem('access') ||
    sessionStorage.getItem('access_token') ||
    ''
  );
}

// استخراج المسار كـ pathname مطلق لقرار "عام/غير عام"
function getRequestPath(config) {
  const url = config?.url || '';
  try {
    // ابنِ base مطلق حتى إن كان baseURL نسبياً (/api)
    const base = config?.baseURL || API_BASE;
    const baseAbs = /^https?:\/\//i.test(base)
      ? base
      : (typeof window !== 'undefined' ? `${window.location.origin}${base}` : `http://localhost${base}`);
    const u = new URL(url, baseAbs);
    return u.pathname || '';
  } catch {
    return String(url || '');
  }
}

// تحديد إن كان الطلب عاماً (لا يحتاج توكن)
function isPublicRequest(config) {
  const p = getRequestPath(config);
  return p.startsWith('/api/public/') || p.startsWith('/public/');
}

// إزالة أي رؤوس Authorization من كونفيغ الطلب
function stripAuth(config) {
  if (!config) return config;
  config.headers = config.headers || {};
  delete config.headers.Authorization;
  delete config.headers.authorization;
  if (config.headers.common) {
    delete config.headers.common.Authorization;
    delete config.headers.common.authorization;
  }
  return config;
}

// ==== Interceptors ====

// الطلبات: أضف التوكن لغير العام، واحذف الهيدر للعام
instance.interceptors.request.use((config) => {
  const pub = isPublicRequest(config);
  config.__isPublic = pub;

  if (pub) {
    stripAuth(config);
  } else {
    const token = getToken();
    if (token) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    }
  }

  // مهلة أطول تلقائيًا لاستدعاء توليد أكواد الحساسية
  try {
    const path = getRequestPath(config);
    if (
      path.endsWith('/dishes/batch-generate-allergen-codes/') ||
      path.includes('/dishes/batch-generate-allergen-codes')
    ) {
      const LONG_TIMEOUT = 120000; // 120 ثانية
      config.timeout = Math.max(config.timeout || 0, LONG_TIMEOUT);
    }
  } catch {
    /* تجاهل */
  }

  return config;
});

// hook اختياري عند 401 لطلبات غير عامة
let onUnauthorized = null;
export function setOnUnauthorized(fn) {
  onUnauthorized = typeof fn === 'function' ? fn : null;
}

// الردود: استدعِ onUnauthorized عند 401 لغير العام + لوج للمهلات
instance.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err?.response?.status;
    const cfg = err?.config || {};

    // لوج مفيد عند انقضاء المهلة
    if (err.code === 'ECONNABORTED' || /timeout/i.test(err.message || '')) {
      // eslint-disable-next-line no-console
      console.warn('Axios timeout:', {
        url: cfg?.url,
        timeout: cfg?.timeout,
        baseURL: cfg?.baseURL,
        message: err?.message,
      });
    }

    if (status === 401 && onUnauthorized && !cfg.__isPublic) {
      try { onUnauthorized(); } catch { /* تجاهل */ }
    }
    return Promise.reject(err);
  }
);

// تحويل أي مسار نسبي إلى رابط مطلق على أصل الـAPI (لصور مثلاً)
export const toAbsolute = (url) =>
  url ? (url.startsWith('http') ? url : `${API_ORIGIN.replace(/\/+$/, '')}${url}`) : '';

// نقاط نهاية إصدار/تحديث التوكن (للتوافق)
export const TOKEN_ENDPOINTS = {
  obtain: [`${API_BASE}/auth/token/`, `${API_ORIGIN}/api/token/`],
  refresh: [`${API_BASE}/auth/token/refresh/`, `${API_ORIGIN}/api/token/refresh/`],
};

// التصدير الافتراضي
export default instance;

// تصدير اختياري للفحص أو الاستخدامات الأخرى
export { API_BASE, API_ORIGIN };
