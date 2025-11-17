// frontend/src/i18n.jsx
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import HttpBackend from 'i18next-http-backend'
import LanguageDetector from 'i18next-browser-languagedetector'

i18n
  .use(HttpBackend)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: 'de',
    supportedLngs: ['ar', 'en', 'de'],

    ns: ['translation'],
    defaultNS: 'translation',
    fallbackNS: 'translation',

    debug: false,
    load: 'languageOnly',

    interpolation: {
      escapeValue: false,
    },

    backend: {
      loadPath: '/locales/{{lng}}/translation.json',
    },

    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
    },

    react: {
      useSuspense: false,
      bindI18n: 'languageChanged',
    },

    initImmediate: false,
  })

export const i18nReady = new Promise((resolve) => {
  if (i18n.isInitialized) resolve()
  else i18n.on('initialized', () => resolve())
})

export default i18n
