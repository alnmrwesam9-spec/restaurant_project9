// src/theme.jsx
import { createTheme } from '@mui/material/styles'

/**
 * IBLA DISH — Unified MUI Theme
 * - Brand Primary: #f27141
 * - Neutrals: #111827 (charcoal), #ffffff (white)
 * - Text: #111827 (primary), #6b7280 (muted)
 * - Divider: #e5e7eb
 * Typography uses CSS vars that you set globally (e.g., in index.jsx) per locale:
 *   --font-base, --font-heading
 */
export const makeAppTheme = (mode = 'light', direction = 'ltr', locale = 'en') => {
  const isArabic = String(locale || 'ar').toLowerCase().startsWith('ar')

  // Font stacks driven by CSS vars, switched from your app bootstrap
  const baseFamily =
    'var(--font-base), system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif'
  const headingFamily = 'var(--font-heading)'

  // Brand tokens
  const BRAND = {
    primary: '#f27141',
    charcoal: '#111827',
    white: '#ffffff',
    textMain: '#111827',
    textMuted: '#6b7280',
    divider: '#e5e7eb',
    sidebarBg: '#111827', // AppBar/Sidebar background (neutral allowed)
  }

  return createTheme({
    palette: {
      mode,
      primary: { main: BRAND.primary, contrastText: BRAND.white },
      secondary: { main: BRAND.charcoal, contrastText: BRAND.white },
      background: { default: BRAND.white, paper: BRAND.white },
      text: { primary: BRAND.textMain, secondary: BRAND.textMuted },
      divider: BRAND.divider,
    },
    direction, // 'rtl' | 'ltr'
    shape: { borderRadius: 12 },

    typography: {
      fontFamily: baseFamily,
      // Clear, consistent scale
      h1: { fontFamily: headingFamily, fontWeight: 800, lineHeight: 1.2,  fontSize: '2.625rem' }, // ~42px
      h2: { fontFamily: headingFamily, fontWeight: 700, lineHeight: 1.25, fontSize: '2rem' },     // ~32px
      h3: { fontFamily: headingFamily, fontWeight: 700, lineHeight: 1.3,  fontSize: '1.75rem' },  // ~28px
      h4: { fontFamily: headingFamily, fontWeight: 700, lineHeight: 1.35, fontSize: '1.5rem' },   // ~24px
      h5: { fontFamily: headingFamily, fontWeight: 600, lineHeight: 1.4,  fontSize: '1.25rem' },  // ~20px
      h6: { fontFamily: headingFamily, fontWeight: 600, lineHeight: 1.4,  fontSize: '1.125rem' }, // ~18px
      subtitle1: { fontWeight: 600 },
      subtitle2: { fontWeight: 600 },
      body1: { fontWeight: 400, fontSize: '1rem', lineHeight: 1.6 },
      body2: { fontWeight: 400, fontSize: '0.875rem', lineHeight: 1.6 },
      button: { textTransform: 'none', fontWeight: 600, letterSpacing: 0.25 },
      // Make helper labels readable (MUI default is 0.75rem ≈ 12px)
      caption: { fontWeight: 400, fontSize: '0.8125rem' }, // ≈ 13px
      overline: { fontWeight: 600, textTransform: 'none', fontSize: '0.8125rem' },
    },

    components: {
      // Global CSS & brand vars
      MuiCssBaseline: {
        styleOverrides: `
          html, body, #root { height: 100%; }
          * { font-feature-settings: "kern"; }
          a { text-decoration: none; color: inherit; }

          :root {
            /* Locale-aware fonts (fallbacks are defined in JS stacks above) */
            --font-base: ${isArabic ? 'AppArabic' : 'AppLatin'};
            --font-heading: var(--font-base);

            /* Brand tokens (optional usage in sx/CSS) */
            --brand: ${BRAND.primary};
            --brand-contrast: ${BRAND.white};
            --brand-text: ${BRAND.textMain};
            --brand-muted: ${BRAND.textMuted};
            --brand-divider: ${BRAND.divider};
            --brand-sidebar: ${BRAND.sidebarBg};
          }

          /* Scrollbar polish */
          ::-webkit-scrollbar { width: 10px; height: 10px; }
          ::-webkit-scrollbar-thumb { background: ${BRAND.divider}; border-radius: 10px; }
        `,
      },

      // Buttons — contained primary by default, no heavy shadows
      MuiButton: {
        defaultProps: { variant: 'contained', color: 'primary' },
        styleOverrides: {
          root: ({ theme }) => ({
            borderRadius: theme.shape.borderRadius,
            boxShadow: 'none',
            '&.MuiButton-outlined': { borderColor: theme.palette.divider },
            '&:hover': { boxShadow: 'none' },
          }),
          sizeSmall: {
            // Keep small buttons legible across the app
            fontSize: '0.975rem', // 14px
            fontWeight: 600,
          },
        },
      },

      // AppBar — neutral dark background, white text
      MuiAppBar: {
        styleOverrides: {
          root: {
            backgroundColor: 'var(--brand-sidebar)',
            color: '#ffffff',
          },
        },
      },

      // Drawer/Sidebar — same neutral dark with subtle border
      MuiDrawer: {
        styleOverrides: {
          paper: {
            backgroundColor: 'var(--brand-sidebar)',
            color: '#ffffff',
            borderRight: `1px solid ${BRAND.divider}`,
          },
        },
      },

      // Tabs — brand indicator & selected color
      MuiTabs: {
        styleOverrides: {
          indicator: {
            height: 3,
            borderRadius: 3,
            backgroundColor: 'var(--brand)',
          },
        },
      },
      MuiTab: {
        styleOverrides: {
          root: {
            fontWeight: 600,
            '&.Mui-selected': { color: 'var(--brand)' },
          },
        },
      },

      // Chip — rounded + primary fill style
      MuiChip: {
        styleOverrides: {
          root: ({ theme }) => ({ borderRadius: theme.shape.borderRadius }),
          filledPrimary: { backgroundColor: 'var(--brand)', color: 'var(--brand-contrast)' },
          labelSmall: {
            // Avoid extra-small chip text (default ~11–12px)
            fontSize: '0.8125rem',
            fontWeight: 600,
          },
        },
      },

      // Paper/Card — subtle border (design-system friendly)
      MuiPaper: {
        defaultProps: { elevation: 0 },
        styleOverrides: {
          rounded: ({ theme }) => ({
            borderRadius: theme.shape.borderRadius,
            border: `1px solid ${BRAND.divider}`,
          }),
        },
      },

      // Links — brand colored on hover intent while keeping inherit color
      MuiLink: {
        styleOverrides: {
          root: {
            color: 'var(--brand)',
            '&:hover': { opacity: 0.9 },
          },
        },
      },
    },
  })
}

export default makeAppTheme
