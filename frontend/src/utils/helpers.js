const buildPublicAsset = (path) => {
  const base = import.meta?.env?.BASE_URL ?? '/';
  const normalizedBase = base.endsWith('/') ? base : `${base}/`;
  return `${normalizedBase}${String(path ?? '').replace(/^\/+/, '')}`;
};

export const PLACEHOLDER = buildPublicAsset('img/dish-placeholder.png');
export const PLACEHOLDER_HERO = buildPublicAsset('img/hero-placeholder.png');
export const firstValid = (...args) => args.find((x) => !!x && x !== 'null' && x !== 'undefined');
