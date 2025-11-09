// src/utils/localeFonts.js
export const FONT_STACKS = {
  ar: 'var(--font-ar)',   // معرّفة في fonts.css
  en: 'var(--font-en)',
  de: 'var(--font-de)',
}

export function applyFontForLocale(lang) {
  const lng = String(lang || 'de').slice(0, 2)
  const base = FONT_STACKS[lng] || FONT_STACKS.de
  const root = document.documentElement
  root.style.setProperty('--font-base', base)
  root.style.setProperty('--font-heading', 'var(--font-base)')
}
