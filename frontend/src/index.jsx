// src/index.jsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'

// i18n & خطوط و css
import i18n from './i18n'                   // تأكد من صحة المسار
import './styles/fonts.css'                // ✅ خطوة 1
import './index.css'                       // إن وُجد

// MUI / Theme / Emotion (RTL)
import { ThemeProvider, CssBaseline } from '@mui/material'
import { I18nextProvider } from 'react-i18next'
import { makeAppTheme } from './theme'
import { CacheProvider } from '@emotion/react'
import createCache from '@emotion/cache'
import { prefixer } from 'stylis'
import rtlPlugin from 'stylis-plugin-rtl'

// تبديل الخط حسب اللغة
import { applyFontForLocale } from './utils/localeFonts.js'

// الجولة التفاعلية
import { TourProvider } from '@reactour/tour'

// --- Sentry (خامل دون DSN) ---
import * as Sentry from '@sentry/react'

if (import.meta?.env?.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.MODE,
    tracesSampleRate: parseFloat(import.meta.env.VITE_SENTRY_TRACES ?? '0.05'),
  })
}

// أنماط نافذة الجولة (يمكنك تخصيصها لاحقًا)
const tourStyles = {
  popover: (base) => ({
    ...base,
    borderRadius: 16,
    boxShadow: '0 10px 30px rgba(0,0,0,.25)',
    // اجعل العرض مناسباً للموبايل أيضاً
    maxWidth: 'min(92vw, 520px)',
    padding: '12px 14px',
  }),
}

function createEmotionCache(dir) {
  return createCache({
    key: dir === 'rtl' ? 'mui-rtl' : 'mui',
    stylisPlugins: dir === 'rtl' ? [prefixer, rtlPlugin] : [prefixer],
  })
}

function Root() {
  const [lng, setLng] = React.useState(i18n.language || 'en')
  const dir = lng.startsWith('ar') ? 'rtl' : 'ltr'

  // الاستماع لتغيير اللغة
  React.useEffect(() => {
    const onChange = (l) => setLng(l || 'en')
    i18n.on('languageChanged', onChange)
    return () => i18n.off('languageChanged', onChange)
  }, [])

  // ضبط اتجاه الصفحة واللغة + تطبيق الخط المناسب
  React.useEffect(() => {
    document.documentElement.setAttribute('dir', dir)
    document.documentElement.setAttribute('lang', lng)
    applyFontForLocale(lng) // ✅ تبديل الخط فورًا عبر CSS vars
  }, [lng, dir])

  const theme = React.useMemo(() => makeAppTheme('light', dir, lng), [dir, lng])
  const cache = React.useMemo(() => createEmotionCache(dir), [dir])

  return (
    <I18nextProvider i18n={i18n}>
      <CacheProvider value={cache}>
        <ThemeProvider theme={theme}>
          <CssBaseline />
          {/* TourProvider حول التطبيق مع احترام RTL */}
          <TourProvider rtl={dir === 'rtl'} steps={[]} styles={tourStyles}>
            <App />
          </TourProvider>
        </ThemeProvider>
      </CacheProvider>
    </I18nextProvider>
  )
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
)
