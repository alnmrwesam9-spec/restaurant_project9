// src/utils/localeFonts.js
export const FONT_STACKS = {
  ar: 'var(--font-ar)',
  en: 'var(--font-en)',
  de: 'var(--font-de)',
};

export function applyFontForLocale(lng) {
  const base = FONT_STACKS[lng] || FONT_STACKS.ar;
  const root = document.documentElement;
  root.style.setProperty('--font-base', base);
  root.style.setProperty('--font-heading', 'var(--font-base)');
}
