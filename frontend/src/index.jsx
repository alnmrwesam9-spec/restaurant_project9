import React from 'react';
import ReactDOM from 'react-dom/client';

import App from './App.jsx';
import i18n from './i18n';
import './styles/fonts.css';
import './index.css';

import { ThemeProvider, CssBaseline } from '@mui/material';
import { I18nextProvider } from 'react-i18next';
import { makeAppTheme } from './theme';

import { CacheProvider } from '@emotion/react';
import createCache from '@emotion/cache';
import { prefixer } from 'stylis';
import rtlPlugin from 'stylis-plugin-rtl';
import DevErrorBoundary from './components/DevErrorBoundary.jsx';

// إنشاء كاش Emotion بحسب الاتجاه
function createEmotionCache(dir) {
  return createCache({
    key: dir === 'rtl' ? 'mui-rtl' : 'mui',
    stylisPlugins: dir === 'rtl' ? [prefixer, rtlPlugin] : [prefixer],
  });
}

function Root() {
  const [lng, setLng] = React.useState(i18n.language || 'ar');
  const dir = lng === 'ar' ? 'rtl' : 'ltr';

  React.useEffect(() => {
    const handler = (l) => setLng(l || 'ar');
    i18n.on('languageChanged', handler);
    return () => i18n.off('languageChanged', handler);
  }, []);

  React.useEffect(() => {
    document.documentElement.setAttribute('dir', dir);
  }, [lng, dir]);

  // نمرّر اللغة إلى الثيم ليضبط --font-base و --font-heading
  const theme = React.useMemo(() => makeAppTheme('light', dir, lng), [dir, lng]);
  const cache = React.useMemo(() => createEmotionCache(dir), [dir]);

  return (
    <I18nextProvider i18n={i18n}>
      <CacheProvider value={cache}>
        <ThemeProvider theme={theme}>
          <CssBaseline />
          <App />
        </ThemeProvider>
      </CacheProvider>
    </I18nextProvider>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <DevErrorBoundary>
      <Root />
    </DevErrorBoundary>
  </React.StrictMode>
);
