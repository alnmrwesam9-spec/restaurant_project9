const API = import.meta.env.VITE_API_BASE_URL || '';
const MEDIA = import.meta.env.VITE_MEDIA_BASE_URL || API.replace(/\/api\/?$/, '');

export function toImageUrl(pathOrUrl) {
  if (!pathOrUrl) return '';
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl; // مطلق جاهز
  const base = (MEDIA || '').replace(/\/$/, '');
  const p = String(pathOrUrl).startsWith('/') ? pathOrUrl : '/' + pathOrUrl;
  return base + p;
}
