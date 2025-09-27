// src/theme.jsx
import { createTheme } from '@mui/material/styles';

export const makeAppTheme = (mode = 'light', direction = 'rtl', locale = 'ar') => {
  const isArabic = String(locale || 'ar').toLowerCase().startsWith('ar');

  // سنستخدم متغير CSS كمرجع أساسي، ونضبطه بحسب اللغة
  const cssFamily = `var(--font-base), system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif`;

  return createTheme({
    palette: {
      mode,
      primary: { main: '#000000', contrastText: '#fff' },
      secondary: { main: '#ffffffff' },
    },
    direction,
    typography: {
      fontFamily: cssFamily,
      h1: { fontFamily: 'var(--font-heading)', fontWeight: 700, lineHeight: 1.2 },
      h2: { fontFamily: 'var(--font-heading)', fontWeight: 700, lineHeight: 1.25 },
      h3: { fontFamily: 'var(--font-heading)', fontWeight: 700 },
      h4: { fontFamily: 'var(--font-heading)', fontWeight: 800 },
      button: { textTransform: 'none' },
    },
    components: {
      MuiCssBaseline: {
        // نحقن ستايل يضبط المتغيرات بحسب اللغة
        styleOverrides: `
          html, body, #root { height: 100%; }
          * { font-feature-settings: "kern"; }
          :root {
            /* العربية ← AppArabic ، غير ذلك ← AppLatin */
            --font-base: ${isArabic ? 'AppArabic' : 'AppLatin'};
            --font-heading: var(--font-base);
          }
        `,
      },
    },
  });
};
