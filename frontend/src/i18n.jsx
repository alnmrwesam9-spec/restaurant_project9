// frontend/src/i18n.jsx
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import HttpBackend from 'i18next-http-backend';
import LanguageDetector from 'i18next-browser-languagedetector';

i18n
  .use(HttpBackend)           // تحميل ملفات الترجمة من /public/locales
  .use(LanguageDetector)      // كشف اللغة من المتصفح / LocalStorage / إلخ
  .use(initReactI18next)      // ربط i18next مع React
  .init({
    fallbackLng: 'ar',
    supportedLngs: ['ar', 'en', 'de'],

    ns: ['translation'],
    defaultNS: 'translation',
    fallbackNS: 'translation',

    debug: false,
    load: 'currentOnly',      // لا تحمل ar-SA مثلاً، اكتفِ بـ ar

    interpolation: {
      escapeValue: false,     // React يقوم بالحماية تلقائيًا
    },

    backend: {
      // مهم: مسار مطلق ليعمل على جميع الصفحات/المسارات
      loadPath: '/locales/{{lng}}/translation.json',
    },

    detection: {
      order: ['querystring', 'localStorage', 'cookie', 'navigator', 'htmlTag'],
      caches: ['localStorage'],
    },

    react: {
      useSuspense: false,     // نُكمل بدون Suspense حالياً
      bindI18n: 'languageChanged',
    },

    // يقلل من رسائل "was not initialized" عند الإقلاع
    initImmediate: false,
  });

// خيار إضافي: وعد جاهزية إن أردت الانتظار قبل الرندر في index.jsx
export const i18nReady = new Promise((resolve) => {
  if (i18n.isInitialized) resolve();
  else i18n.on('initialized', () => resolve());
});

export default i18n;
