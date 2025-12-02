// src/pages/MenuPublicSettings.jsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import axios from '../services/axios';
import {
  Box, Button, Card, CardContent, CardMedia, Chip, CircularProgress, Container,
  Dialog, DialogActions, DialogContent, DialogTitle, Divider, FormControlLabel,
  MenuItem, Paper, Select, Slider, Snackbar, Stack, TextField,
  ToggleButton, ToggleButtonGroup, Tooltip, Typography, Checkbox,
  Accordion, AccordionSummary, AccordionDetails, Collapse, IconButton
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { alpha, useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import LinkIcon from '@mui/icons-material/Link';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import PublishIcon from '@mui/icons-material/Publish';
import UnpublishedIcon from '@mui/icons-material/Unpublished';
import UploadFileIcon from '@mui/icons-material/UploadFile';
// ⛔️ أزلنا الاستيراد المباشر لمكتبة QRCode
// import QRCode from 'react-qr-code';
const QRCode = React.lazy(() => import('react-qr-code')); // ✅ تحميل كسول

import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import OpeningHoursEditor from '../components/OpeningHoursEditor';

const buildURL = (path) => new URL(path, window.location.origin).toString();

/* خطوط جاهزة مبسّطة */
const FONT_PRESETS = [
  { id: 'inter', label: 'Inter', css: 'Inter, system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif' },
  { id: 'manrope', label: 'Manrope', css: '"Manrope", system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif' },
  { id: 'ibm-ar', label: 'IBM Plex Sans Arabic', css: '"IBM Plex Sans Arabic", "Inter", system-ui, -apple-system, "Segoe UI", Arial, sans-serif' },
  { id: 'cairo', label: 'Cairo', css: '"Cairo", "Inter", system-ui, -apple-system, "Segoe UI", Arial, sans-serif' },
  { id: 'noto-naskh', label: 'Noto Naskh Arabic', css: '"Noto Naskh Arabic", "Inter", system-ui, -apple-system, "Segoe UI", Arial, serif' },
];

/* تدرجات لونية جاهزة للخلفيات */
const GRADIENT_PRESETS = [
  { id: 'purple', label: 'Purple Dream', gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' },
  { id: 'ocean', label: 'Ocean Blue', gradient: 'linear-gradient(135deg, #2E3192 0%, #1BFFFF 100%)' },
  { id: 'sunset', label: 'Sunset Orange', gradient: 'linear-gradient(135deg, #FF512F 0%, #F09819 100%)' },
  { id: 'forest', label: 'Forest Green', gradient: 'linear-gradient(135deg, #134E5E 0%, #71B280 100%)' },
  { id: 'rose', label: 'Rose Gold', gradient: 'linear-gradient(135deg, #ED4264 0%, #FFEDBC 100%)' },
];

const defaultParsed = {
  mode: 'default',
  bg: '', text: '', icon: '',
  font: '',               // CSS font-family
  scale: 1,               // global font scale
  price_color: '#1d4ed8',
  price_scale: 1,
  placeholder_gradient: GRADIENT_PRESETS[0].gradient, // default gradient
  show_logo: 1,
  show_hero: 1,
  show_search: 1,
  show_sections: 1,
  show_prices: 1,
};

const parseTheme = (themeStr) => {
  if (!themeStr || typeof themeStr !== 'string') return { ...defaultParsed };
  const raw = themeStr.trim();
  if (raw === 'default' || raw === 'light' || raw === 'dark') return { ...defaultParsed, mode: raw };

  const splitCommaSafe = (s) => {
    const parts = [];
    let buf = '';
    let quote = '';
    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      if (quote) {
        if (ch === quote) quote = '';
        buf += ch;
      } else if (ch === '"' || ch === "'") {
        quote = ch; buf += ch;
      } else if (ch === ',') {
        if (buf.trim()) parts.push(buf.trim());
        buf = '';
      } else {
        buf += ch;
      }
    }
    if (buf.trim()) parts.push(buf.trim());
    return parts;
  };

  if (raw.startsWith('custom3:')) {
    const [_p, rest = ''] = raw.split(':');
    const [bg = '', text = '', icon = ''] = splitCommaSafe(rest).map((s) => s.trim());
    return { ...defaultParsed, mode: 'custom3', bg, text, icon };
  }
  if (raw.startsWith('custom:')) {
    const out = { ...defaultParsed, mode: 'custom' };
    const [_p, rest = ''] = raw.split(':');
    for (const kv of splitCommaSafe(rest)) {
      const i = kv.indexOf('=');
      if (i < 0) continue;
      const k = kv.slice(0, i).trim();
      let v = kv.slice(i + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      if (k === 'bg' || k === 'text' || k === 'icon' || k === 'font' || k === 'price_color' || k === 'placeholder_gradient') out[k] = v;
      else if (k === 'scale' || k === 'price_scale') {
        const n = parseFloat(String(v).replace(',', '.')); if (Number.isFinite(n)) out[k] = n;
      } else if (k.startsWith('show_')) {
        out[k] = String(v) === '0' ? 0 : 1;
      }
    }
    return out;
  }
  return { ...defaultParsed };
};

const buildThemeString = (f) => {
  // If user has selected a non-default gradient, force custom mode
  const hasCustomGradient = f.placeholder_gradient && f.placeholder_gradient !== GRADIENT_PRESETS[0].gradient;

  if (f.mode === 'custom3') {
    return `custom3:${f.bg || '#ffffff'},${f.text || '#111111'},${f.icon || '#2bbdbe'}`;
  }
  if (f.mode === 'custom' || hasCustomGradient) {
    const parts = [];
    if (f.bg) parts.push(`bg=${f.bg}`);
    if (f.text) parts.push(`text=${f.text}`);
    if (f.icon) parts.push(`icon=${f.icon}`);
    if (f.font) parts.push(`font="${f.font}"`);
    if (f.scale && f.scale !== 1) parts.push(`scale=${f.scale}`);
    if (f.price_color) parts.push(`price_color=${f.price_color}`);
    if (f.price_scale && f.price_scale !== 1) parts.push(`price_scale=${f.price_scale}`);
    if (f.placeholder_gradient) parts.push(`placeholder_gradient="${f.placeholder_gradient}"`);
    ['show_logo', 'show_hero', 'show_search', 'show_sections', 'show_prices', 'show_images']
      .forEach(k => parts.push(`${k}=${f[k] ? 1 : 0}`));
    return `custom:${parts.join(',')}`;
  }
  return f.mode || 'default';
};

/* عنصر معاينة فورية صغير */
function PreviewCard({ font, scale, priceColor, priceScale, tOr }) {
  // Load the first family from provided CSS stack for preview
  React.useEffect(() => {
    const full = font || '';
    if (!full) return;
    let family = '';
    const m = full.match(/^\s*(["'])(.*?)\1/);
    if (m) family = m[2]; else family = full.split(',')[0]?.trim().replace(/^(["'])|(["'])$/g, '') || '';
    if (!family) return;
    const href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family).replace(/%20/g, '+')}\:wght@400;600;700;800&display=swap`;
    let link = document.getElementById('preview-font-link');
    if (!link) { link = document.createElement('link'); link.id = 'preview-font-link'; link.rel = 'stylesheet'; document.head.appendChild(link); }
    link.href = href;
    return () => { const el = document.getElementById('preview-font-link'); if (el && el.href === href) try { el.remove(); } catch { } };
  }, [font]);
  return (
    <Card elevation={1} sx={{ borderRadius: 3, overflow: 'hidden' }}>
      <Box sx={{ width: '100%', height: 120, background: '#e5e7eb', display: { xs: 'none', sm: 'block' } }} />
      <CardContent sx={{ p: 1.5, fontFamily: font || 'inherit' }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Typography sx={{ fontWeight: 800, fontSize: `calc(1rem * ${scale || 1})` }}>{tOr('sample_dish', 'Sample Dish')}</Typography>
          <Chip
            size="small"
            label="€ 4,00"
            sx={{
              borderRadius: 999,
              bgcolor: priceColor || '#1d4ed8',
              color: '#fff',
              fontWeight: 800,
              height: 24,
              fontSize: `calc(0.8rem * ${priceScale || 1})`,
            }}
          />
        </Stack>
        <Typography sx={{ color: '#64748b', mt: .5, fontSize: `calc(0.9rem * ${scale || 1})` }}>
          {tOr('sample_description', 'Short description will be here…')}
        </Typography>
      </CardContent>
    </Card>
  );
}

export default function MenuPublicSettings() {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const isSmDown = useMediaQuery(theme.breakpoints.down('md'));
  const isXsDown = useMediaQuery(theme.breakpoints.down('sm'));
  const navigate = useNavigate();
  const { menuId } = useParams();

  // ✅ Fallback ترجمة
  const tOr = (key, fallback) => {
    try {
      const val = t ? t(key) : key;
      return !val || val === key ? fallback : val;
    } catch {
      return fallback;
    }
  };

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [snack, setSnack] = useState('');
  const [menu, setMenu] = useState(null);
  const [profileSlug, setProfileSlug] = useState('');
  const [confirmUnpublish, setConfirmUnpublish] = useState(false);
  const qrRef = useRef(null);

  // UX State for collapsible sections
  const [isHoursOpen, setIsHoursOpen] = useState(false);
  const [isSocialOpen, setIsSocialOpen] = useState(false);

  const [form, setForm] = useState({
    display_name: '',
    phone: '',
    whatsapp: '',
    address: '',
    social_tiktok: '',
    social_instagram: '',
    social_facebook: '',
    hours: '',
    logo: null,
    logo_url: '',
    hero_image: null,
    hero_image_url: '',
    hero_crop: 'center',
    ...defaultParsed,
    // Stored separately from theme string
    show_images: 1,
  });
  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  // ===== fetch
  const fetchMenu = async () => {
    const res = await axios.get(`/menus/${menuId}/`);
    setMenu(res.data || null);
  };
  const fetchProfile = async () => {
    try {
      const res = await axios.get('/me/profile/');
      const slug = res.data?.slug || res.data?.username || res.data?.profile_slug || '';
      setProfileSlug(slug);
    } catch { setProfileSlug(''); }
  };
  const fetchDisplaySettings = async () => {
    const res = await axios.get(`/menus/${menuId}/display-settings/`);
    const d = res.data || {};
    const parsed = parseTheme(d.theme || 'default');
    setForm((f) => ({
      ...f,
      display_name: d.display_name || '',
      phone: d.phone || '',
      whatsapp: d.whatsapp || '',
      address: d.address || '',
      social_tiktok: d.social_tiktok || '',
      social_instagram: d.social_instagram || '',
      social_facebook: d.social_facebook || '',
      hours: d.hours || '',
      logo: null,
      logo_url: d.logo || '',
      hero_image: null,
      hero_image_url: d.hero_image || '',
      hero_crop: d.hero_crop || 'center',
      ...parsed,
      show_images: typeof d.show_images !== 'undefined' ? (d.show_images ? 1 : 0) : (f.show_images ?? 1),
    }));
  };

  const fetchAll = async () => {
    setLoading(true);
    try {
      await Promise.all([fetchMenu(), fetchProfile()]);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { fetchAll(); /* eslint-disable-next-line */ }, [menuId]);
  useEffect(() => { if (menu?.is_published) fetchDisplaySettings(); /* eslint-disable-next-line */ }, [menu?.is_published]);

  const isPublished = !!menu?.is_published;
  const publicLink = useMemo(() => {
    if (menu?.public_slug) return buildURL(`/show/menu/${menu.public_slug}?_=${Date.now()}`);
    return profileSlug ? buildURL(`/show/restaurant/${profileSlug}?_=${Date.now()}`) : '';
  }, [menu?.public_slug, profileSlug]);

  // ===== publish/unpublish
  const publish = async () => {
    try {
      await axios.post(`/menus/${menuId}/publish/`);
      await fetchMenu(); await fetchDisplaySettings();
      setSnack(tOr('published_successfully', 'Published'));
    } catch { setSnack(tOr('publish_failed', 'Publish failed')); }
  };
  const unpublish = async () => {
    try {
      await axios.post(`/menus/${menuId}/unpublish/`);
      await fetchMenu();
      setSnack(tOr('unpublished_successfully', 'Unpublished'));
    } catch { setSnack(tOr('unpublish_failed', 'Unpublish failed')); }
    finally { setConfirmUnpublish(false); }
  };

  // ===== link/qr
  const copyUrl = async () => {
    if (!publicLink || !menu?.public_slug) return;
    try { await navigator.clipboard.writeText(publicLink); setSnack(tOr('copied', 'Copied')); }
    catch { setSnack(tOr('copy_failed', 'Copy failed')); }
  };
  const openUrl = () => { if (menu?.public_slug) window.open(publicLink, '_blank', 'noopener,noreferrer'); };
  const downloadQR = () => {
    if (!qrRef.current || !menu?.public_slug) return;
    const svg = qrRef.current.querySelector('svg'); if (!svg) return;
    if (!svg.getAttribute('xmlns')) svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    const source = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = `menu-${menu.public_slug}.svg`; a.click(); URL.revokeObjectURL(a.href);
  };

  // ===== save (مع فحص النوع/الحجم قبل الرفع)
  const handleSave = async () => {
    setSaving(true);
    try {
      const ok = (f) => !f || (
        ['image/jpeg', 'image/png', 'image/webp'].includes(f.type) &&
        f.size <= 5 * 1024 * 1024
      );

      if (!ok(form.logo) || !ok(form.hero_image)) {
        setSnack(
          tOr(
            'invalid_image',
            'صيغة/حجم الصورة غير مسموح (PNG/JPEG/WEBP، حد أقصى 5MB)'
          )
        );
        setSaving(false);
        return;
      }

      const fd = new FormData();
      fd.append('display_name', form.display_name);
      fd.append('phone', form.phone);
      if (typeof form.whatsapp === 'string' && form.whatsapp.trim() !== '') {
        fd.append('whatsapp', form.whatsapp.trim());
      }
      fd.append('address', form.address);
      fd.append('social_tiktok', form.social_tiktok || '');
      fd.append('social_instagram', form.social_instagram || '');
      fd.append('social_facebook', form.social_facebook || '');
      // Compact hours if too large for backend CharField(255)
      const compactHours = (() => {
        const val = form.hours || '';
        if (val && val.length <= 240) return val; // already short
        try {
          const obj = JSON.parse(val);
          const days = obj?.days || obj;
          const dks = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
          const compact = dks.map((k, i) => {
            const d = days?.[k] || {};
            const en = d?.enabled ? 1 : 0;
            const times = Array.isArray(d?.slots) ? d.slots.map(s => `${s.from}-${s.to}`).join(',') : '';
            return `d${i}=${en}${times ? '@' + times : ''}`;
          }).join(';');
          return compact;
        } catch {
          return String(val).slice(0, 250);
        }
      })();
      fd.append('hours', compactHours);
      // hero crop position (top/center/bottom)
      fd.append('hero_crop', form.hero_crop || 'center');
      fd.append('theme', buildThemeString(form));
      // show_images is already included in theme string, no need to send separately
      if (form.logo instanceof File) fd.append('logo', form.logo);
      if (form.hero_image instanceof File) fd.append('hero_image', form.hero_image);

      const putRes = await axios.put(`/menus/${menuId}/display-settings/`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      // If the menu is already published, republish to push changes to the public endpoint
      try { if (menu?.is_published) await axios.post(`/menus/${menuId}/publish/`); } catch { }
      // quick verify: re-fetch and compare show_images value
      try {
        const vr = await axios.get(`/menus/${menuId}/display-settings/`);
        const serverVal = vr?.data?.show_images ? 1 : 0;
        if (serverVal !== (form.show_images ? 1 : 0)) {
          setSnack(tOr('warning_show_images_not_saved', 'Saved, but show_images not updated on server'));
        } else {
          setSnack(tOr('saved', 'Saved'));
        }
      } catch {
        setSnack(tOr('saved', 'Saved'));
      }
      await fetchDisplaySettings();
    } catch {
      setSnack(tOr('save_failed', 'Save failed'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <Container sx={{ mt: 6, display: 'flex', justifyContent: 'center' }}><CircularProgress /></Container>;
  }
  if (!menu) {
    return <Container sx={{ mt: 6 }}><Typography color="error">{tOr('menu_not_found', 'Menu not found')}</Typography></Container>;
  }

  // ألوان جزء المعاينة الداكن
  const darkPaperBg = '#0c1421';
  const darkPaperBorder = alpha('#fff', 0.2);

  return (
    <Container
      maxWidth="lg"
      sx={{
        mt: { xs: 2.5, sm: 3.5, md: 4 },
        mb: { xs: 4, md: 6 },
        px: { xs: 1.5, sm: 2, md: 3 },
      }}
    >
      {/* Header */}
      <Box
        display="flex"
        alignItems="center"
        justifyContent="space-between"
        mb={{ xs: 1.5, md: 2 }}
        sx={{ flexWrap: 'wrap', gap: 1.5 }}
      >
        <Typography variant={isSmDown ? 'h6' : 'h5'} fontWeight={800} sx={{ lineHeight: 1.25 }}>
          {tOr('unified_public_and_display_settings', 'إعدادات النشر وعرض القائمة')}
        </Typography>

        <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: 'wrap', rowGap: 1 }}>
          <Chip
            size={isSmDown ? 'small' : 'medium'}
            label={isPublished ? tOr('published', 'منشورة') : tOr('not_published', 'غير منشورة')}
            color={isPublished ? 'success' : 'default'}
            variant={isPublished ? 'filled' : 'outlined'}
            sx={{ fontWeight: 600 }}
          />
          {isPublished ? (
            <Button
              variant="contained"
              color="error"
              startIcon={<UnpublishedIcon />}
              onClick={() => setConfirmUnpublish(true)}
              sx={{ borderRadius: 2 }}
              size={isSmDown ? 'small' : 'medium'}
              fullWidth={isXsDown}
              data-tour="public-settings-publish"
            >
              {tOr('unpublish', 'إلغاء النشر')}
            </Button>
          ) : (
            <Button
              variant="contained"
              color="primary"
              startIcon={<PublishIcon />}
              onClick={publish}
              sx={{ borderRadius: 2 }}
              size={isSmDown ? 'small' : 'medium'}
              fullWidth={isXsDown}
              data-tour="public-settings-publish"
            >
              {tOr('publish', 'نشر')}
            </Button>
          )}
        </Stack>
      </Box>

      {/* Help / Guide */}
      <Accordion
        sx={{
          mb: 3,
          borderRadius: 3,
          '& .MuiAccordionSummary-content': { my: 0.5 },
          '& .MuiAccordionDetails-root': {
            pt: 0,
            overflowWrap: 'anywhere',
            wordBreak: 'break-word',
            lineHeight: 1.7,
          },
        }}
      >

        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography fontWeight={800}>{tOr('public.help.title', 'Help & Guide')}</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Typography sx={{ mb: 1.5 }}>
            {tOr('public.help.intro', 'Publish your menu, copy the public link or QR, and customize the look for visitors.')}
          </Typography>

          <Typography variant="subtitle2" sx={{ mt: 1 }}>{tOr('public.help.publish_title', 'Publish / Unpublish')}</Typography>
          <Typography color="text.secondary" sx={{ mb: 1 }}>{tOr('public.help.publish_body', 'Publishing creates a public link to share. You can unpublish to hide the page without deleting anything.')}</Typography>

          <Typography variant="subtitle2" sx={{ mt: 1 }}>{tOr('public.help.link_qr_title', 'Public link & QR')}</Typography>
          <Typography color="text.secondary" sx={{ mb: 1 }}>{tOr('public.help.link_qr_body', 'Use Open to preview, Copy link to share, and Download QR to print and place in the venue.')}</Typography>

          <Typography variant="subtitle2" sx={{ mt: 1 }}>{tOr('public.help.theme_title', 'Colors & Theme')}</Typography>
          <Typography color="text.secondary" sx={{ mb: 1 }}>{tOr('public.help.theme_body', 'Pick a preset or build a custom theme. You can also change price color and scale.')}</Typography>

          <Typography variant="subtitle2" sx={{ mt: 1 }}>{tOr('public.help.font_title', 'Fonts & Size')}</Typography>
          <Typography color="text.secondary" sx={{ mb: 1 }}>{tOr('public.help.font_body', 'Switch between available fonts and adjust global text scale for readability.')}</Typography>

          <Typography variant="subtitle2" sx={{ mt: 1 }}>{tOr('public.help.toggles_title', 'What to show for visitors?')}</Typography>
          <Typography color="text.secondary">{tOr('public.help.toggles_body', 'Show/hide logo, hero image, search, section names and prices without changing your data.')}</Typography>
        </AccordionDetails>
      </Accordion>

      {/* Public Link + QR */}
      <Paper variant="outlined" sx={{ p: { xs: 1.75, sm: 2.5 }, mb: 3, borderRadius: 3, borderColor: 'divider' }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={{ xs: 1.5, md: 2 }} alignItems={{ xs: 'stretch', md: 'center' }}>
          <Box sx={{ flex: 1, width: '100%', minWidth: 0 }}>
            <TextField
              fullWidth
              label={tOr('public_link', 'الرابط العام')}
              value={publicLink}
              size={isSmDown ? 'small' : 'medium'}
              InputProps={{ readOnly: true }}
              sx={{ '& .MuiInputBase-root': { borderRadius: 2 } }}
              data-tour="public-link-field"
            />
            <Stack direction="row" spacing={1} mt={1} flexWrap="wrap">
              <Tooltip title={menu?.public_slug ? tOr('open_public_page', 'افتح') : tOr('publish_first_tooltip', 'انشر أولًا')}>
                <span>
                  <Button
                    variant="contained"
                    color="primary"
                    startIcon={<LinkIcon />}
                    onClick={openUrl}
                    disabled={!menu?.public_slug}
                    sx={{ borderRadius: 2 }}
                    size={isSmDown ? 'small' : 'medium'}
                    fullWidth={isXsDown}
                    data-tour="public-link-open"
                  >
                    {tOr('open_link', 'فتح')}
                  </Button>
                </span>
              </Tooltip>
              <Tooltip title={menu?.public_slug ? tOr('copy_public_link', 'نسخ') : tOr('publish_first_tooltip', 'انشر أولًا')}>
                <span>
                  <Button
                    variant="outlined"
                    startIcon={<ContentCopyIcon />}
                    onClick={copyUrl}
                    disabled={!menu?.public_slug}
                    sx={{ borderRadius: 2 }}
                    size={isSmDown ? 'small' : 'medium'}
                    fullWidth={isXsDown}
                    data-tour="public-link-copy"
                  >
                    {tOr('copy_link', 'نسخ الرابط')}
                  </Button>
                </span>
              </Tooltip>
              <Tooltip title={menu?.public_slug ? tOr('download_qr', 'تنزيل QR') : tOr('publish_first_tooltip', 'انشر أولًا')}>
                <span>
                  <Button
                    variant="outlined"
                    startIcon={<FileDownloadIcon />}
                    onClick={downloadQR}
                    disabled={!menu?.public_slug}
                    sx={{ borderRadius: 2 }}
                    size={isSmDown ? 'small' : 'medium'}
                    fullWidth={isXsDown}
                    data-tour="public-link-qr"
                  >
                    {tOr('download_qr', 'تنزيل QR')}
                  </Button>
                </span>
              </Tooltip>
            </Stack>
          </Box>

          {/* QR */}
          <Box
            ref={qrRef}
            sx={{
              width: { xs: '100%', md: 160 },
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              p: { xs: 1, md: 1.5 },
              borderRadius: 2,
              border: '1px solid',
              borderColor: 'divider',
              bgcolor: 'background.paper',
              alignSelf: { xs: 'stretch', md: 'auto' }
            }}
            data-tour="public-qr"
          >
            {menu?.public_slug ? (
              // ✅ لفّ مكتبة QRCode داخل Suspense (تحميل كسول)
              <React.Suspense fallback={null}>
                <QRCode value={publicLink} size={isXsDown ? 120 : 96} bgColor="#ffffff" fgColor="#000000" />
              </React.Suspense>
            ) : (
              <Typography color="text.secondary" variant="body2" align="center">
                {tOr('publish_to_generate_qr', 'انشر لتوليد QR')}
              </Typography>
            )}
          </Box>
        </Stack>
      </Paper>

      {/* Two columns */}
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={{ xs: 1.75, md: 2 }}
        alignItems="stretch"
        sx={{ mt: 2 }}
      >
        {/* Left Preview / Assets */}
        <Box
          sx={{
            width: { xs: '100%', md: 320, lg: 380, xl: 420 },
            flexShrink: 0,
            alignSelf: { md: 'flex-start' },
            position: { md: 'sticky' },
            top: { md: 80 },
          }}
        >
          <Paper
            sx={{
              p: { xs: 1.75, sm: 2.5 },
              borderRadius: 3,
              bgcolor: '#0c1421',
              color: '#fff',
              border: '1px solid',
              borderColor: alpha('#fff', 0.2)
            }}
          >
            <Typography variant="subtitle1" fontWeight={800} mb={2}>{tOr('settings', 'الإعدادات')}</Typography>

            {/* Logo */}
            <Typography variant="subtitle2" fontWeight={700} mb={1}>{tOr('logo', 'الشعار')}</Typography>
            <Box
              sx={{
                width: '100%',
                height: { xs: 100, sm: 120 },
                borderRadius: 2,
                border: `1px dashed ${alpha('#fff', 0.35)}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                mb: 1.5,
                overflow: 'hidden',
                bgcolor: alpha('#fff', 0.04)
              }}
              data-tour="logo-box"
            >
              {(form.logo ? URL.createObjectURL(form.logo) : form.logo_url)
                ? <CardMedia component="img" image={form.logo ? URL.createObjectURL(form.logo) : form.logo_url} alt="logo" sx={{ objectFit: 'contain', width: '100%', height: '100%' }} />
                : <Typography variant="caption" sx={{ color: alpha('#fff', 0.7) }}>{tOr('no_logo', 'لا يوجد شعار')}</Typography>}
            </Box>
            <Button
              component="label"
              variant="outlined"
              startIcon={<UploadFileIcon />}
              sx={{ mb: 2, borderRadius: 2, textTransform: 'none', color: '#fff', borderColor: alpha('#fff', 0.4), '&:hover': { borderColor: alpha('#fff', 0.7) } }}
              size={isSmDown ? 'small' : 'medium'}
              fullWidth={isXsDown}
              data-tour="upload-logo"
            >
              {tOr('upload_logo', 'رفع الشعار')}
              <input hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => { const file = e.target.files?.[0]; if (file) update('logo', file); }} />
            </Button>

            {/* Hero */}
            <Typography variant="subtitle2" fontWeight={700} mb={1}>{tOr('hero', 'صورة الغلاف')}</Typography>
            <Box
              sx={{
                width: '100%',
                height: { xs: 180, sm: 220 },
                borderRadius: 3,
                border: `1px dashed ${alpha('#fff', 0.35)}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                bgcolor: alpha('#fff', 0.04),
                mb: 1.5
              }}
              data-tour="hero-box"
            >
              {(form.hero_image ? URL.createObjectURL(form.hero_image) : form.hero_image_url)
                ? <CardMedia component="img" image={form.hero_image ? URL.createObjectURL(form.hero_image) : form.hero_image_url} alt="hero" sx={{ objectFit: 'cover', objectPosition: form.hero_crop || 'center', width: '100%', height: '100%' }} />
                : <Typography variant="body2" sx={{ color: alpha('#fff', 0.7) }}>{tOr('no_hero', 'لا توجد صورة')}</Typography>}
            </Box>
            {/* ⬇️ زر رفع لصورة الغلاف */}
            <Button
              component="label"
              variant="outlined"
              startIcon={<UploadFileIcon />}
              sx={{ mb: 2, borderRadius: 2, textTransform: 'none', color: '#fff', borderColor: alpha('#fff', 0.4), '&:hover': { borderColor: alpha('#fff', 0.7) } }}
              size={isSmDown ? 'small' : 'medium'}
              fullWidth={isXsDown}
              data-tour="upload-hero"
            >
              {tOr('upload_hero', 'رفع صورة الغلاف')}
              <input hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => { const file = e.target.files?.[0]; if (file) update('hero_image', file); }} />
            </Button>

            <Typography variant="caption" sx={{ color: alpha('#fff', 0.75), display: 'block', mb: 1 }}>
              {tOr('hero_image_recommendation', 'الصورة المقترحة 1920×1080 – نسبة 16:9')}
            </Typography>
            <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
              <Typography variant="body2" sx={{ color: alpha('#fff', 0.9), alignSelf: 'center' }}>{tOr('crop_position', 'Crop position')}</Typography>
              <ToggleButtonGroup
                exclusive
                size={isSmDown ? 'small' : 'medium'}
                color="primary"
                value={form.hero_crop || 'center'}
                onChange={(e, v) => { if (v) update('hero_crop', v); }}
              >
                <ToggleButton value="top">{tOr('crop_top', 'Top')}</ToggleButton>
                <ToggleButton value="center">{tOr('crop_center', 'Center')}</ToggleButton>
                <ToggleButton value="bottom">{tOr('crop_bottom', 'Bottom')}</ToggleButton>
              </ToggleButtonGroup>
            </Stack>

            {/* LIVE PREVIEW */}
            <Typography variant="subtitle2" fontWeight={700} mb={1}>{tOr('preview', 'معاينة')}</Typography>
            <Box sx={{ bgcolor: '#0b1220', p: 1.25, borderRadius: 2, border: `1px solid ${alpha('#fff', 0.12)}` }} data-tour="live-preview">
              <PreviewCard
                font={form.font}
                scale={form.scale}
                priceColor={form.price_color}
                priceScale={form.price_scale}
                tOr={tOr}
              />
            </Box>
          </Paper>
        </Box>

        {/* Right: form */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Paper variant="outlined" sx={{ p: { xs: 1.75, sm: 2.5 }, borderRadius: 3 }}>
            <Typography variant="subtitle1" fontWeight={800} mb={2}>
              {tOr('display_settings_title', 'إعدادات عرض هذه القائمة')}
            </Typography>

            <Stack spacing={{ xs: 1.5, sm: 2 }}>
              {/* 1. Restaurant Name */}
              <TextField
                label={tOr('display_name', 'اسم المطعم')}
                value={form.display_name}
                onChange={(e) => update('display_name', e.target.value)}
                fullWidth
                size={isSmDown ? 'small' : 'medium'}
                sx={{ '& .MuiInputBase-root': { borderRadius: 2 } }}
              />

              {/* 2. Phone + WhatsApp */}
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <TextField
                  label={tOr('phone', 'الهاتف')}
                  value={form.phone}
                  onChange={(e) => update('phone', e.target.value)}
                  fullWidth
                  size={isSmDown ? 'small' : 'medium'}
                  sx={{ '& .MuiInputBase-root': { borderRadius: 2 } }}
                />
                <TextField
                  label={tOr('whatsapp', 'WhatsApp')}
                  value={form.whatsapp}
                  onChange={(e) => update('whatsapp', e.target.value)}
                  fullWidth
                  size={isSmDown ? 'small' : 'medium'}
                  sx={{ '& .MuiInputBase-root': { borderRadius: 2 } }}
                />
              </Stack>

              {/* 3. Address */}
              <TextField
                label={tOr('address', 'العنوان')}
                value={form.address}
                onChange={(e) => update('address', e.target.value)}
                fullWidth
                multiline
                minRows={2}
                size={isSmDown ? 'small' : 'medium'}
                sx={{ '& .MuiInputBase-root': { borderRadius: 2 } }}
              />

              {/* 4. Opening Hours (Collapsible) */}
              <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, overflow: 'hidden' }}>
                <Box
                  onClick={() => setIsHoursOpen(!isHoursOpen)}
                  sx={{
                    p: 1.5,
                    bgcolor: alpha(theme.palette.primary.main, 0.04),
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    userSelect: 'none'
                  }}
                >
                  <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                    {tOr('opening_hours', 'Opening Hours')}
                  </Typography>
                  <IconButton size="small" sx={{ transform: isHoursOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
                    <ExpandMoreIcon />
                  </IconButton>
                </Box>
                <Collapse in={isHoursOpen}>
                  <Box sx={{ p: 1.5, borderTop: '1px solid', borderColor: 'divider' }}>
                    <OpeningHoursEditor
                      title={tOr('opening_hours', 'Opening Hours')}
                      value={form.hours}
                      onChange={(v) => update('hours', v)}
                      language={(i18n && i18n.language) || 'de'}
                    />
                  </Box>
                </Collapse>
              </Box>

              {/* 5. Social Media Links (Collapsible) */}
              <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, overflow: 'hidden' }}>
                <Box
                  onClick={() => setIsSocialOpen(!isSocialOpen)}
                  sx={{
                    p: 1.5,
                    bgcolor: alpha(theme.palette.primary.main, 0.04),
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    userSelect: 'none'
                  }}
                >
                  <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                    {tOr('social_media_links', 'روابط التواصل الاجتماعي')}
                  </Typography>
                  <IconButton size="small" sx={{ transform: isSocialOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
                    <ExpandMoreIcon />
                  </IconButton>
                </Box>
                <Collapse in={isSocialOpen}>
                  <Stack spacing={2} sx={{ p: 1.5, borderTop: '1px solid', borderColor: 'divider' }}>
                    <TextField
                      label={tOr('tiktok_link', 'TikTok Link')}
                      placeholder="https://www.tiktok.com/@username"
                      value={form.social_tiktok}
                      onChange={(e) => update('social_tiktok', e.target.value)}
                      fullWidth
                      size={isSmDown ? 'small' : 'medium'}
                      sx={{ '& .MuiInputBase-root': { borderRadius: 2 } }}
                    />
                    <TextField
                      label={tOr('instagram_link', 'Instagram Link')}
                      placeholder="https://www.instagram.com/username"
                      value={form.social_instagram}
                      onChange={(e) => update('social_instagram', e.target.value)}
                      fullWidth
                      size={isSmDown ? 'small' : 'medium'}
                      sx={{ '& .MuiInputBase-root': { borderRadius: 2 } }}
                    />
                    <TextField
                      label={tOr('facebook_link', 'Facebook Link')}
                      placeholder="https://www.facebook.com/username"
                      value={form.social_facebook}
                      onChange={(e) => update('social_facebook', e.target.value)}
                      fullWidth
                      size={isSmDown ? 'small' : 'medium'}
                      sx={{ '& .MuiInputBase-root': { borderRadius: 2 } }}
                    />
                  </Stack>
                </Collapse>
              </Box>


              {/* Theme mode */}
              <Box data-tour="theme-mode">
                <Typography variant="subtitle2" color="text.secondary" mb={1}>{tOr('theme', 'الثيم')}</Typography>
                <ToggleButtonGroup
                  exclusive
                  value={form.mode}
                  onChange={(_, val) => val && update('mode', val)}
                  size={isSmDown ? 'small' : 'medium'}
                  sx={{
                    flexWrap: 'wrap',
                    gap: 1,
                    '& .MuiToggleButton-root': {
                      textTransform: 'none',
                      borderRadius: 2,
                      px: { xs: 1.25, sm: 2 },
                      fontWeight: 700
                    }
                  }}
                >
                  <ToggleButton value="default">{tOr('theme_default', 'افتراضي')}</ToggleButton>
                  <ToggleButton value="light">{tOr('theme_light', 'فاتح')}</ToggleButton>
                  <ToggleButton value="dark">{tOr('theme_dark', 'داكن')}</ToggleButton>
                  <ToggleButton value="custom3">{tOr('theme_custom_simple', 'مخصص (3 ألوان)')}</ToggleButton>
                  <ToggleButton value="custom">{tOr('theme_custom_advanced', 'مخصص (متقدم)')}</ToggleButton>
                </ToggleButtonGroup>
              </Box>

              {/* Colors */}
              {(form.mode === 'custom3' || form.mode === 'custom') && (
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} data-tour="colors">
                  {['bg', 'text', 'icon'].map((key) => (
                    <Box key={key} sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="caption" display="block" mb={0.5}>
                        {key === 'bg' ? tOr('bg_color', 'لون الخلفية') : key === 'text' ? tOr('text_color', 'لون النص') : tOr('icon_color', 'لون الأيقونات')}
                      </Typography>
                      <input
                        type="color"
                        value={form[key] || (key === 'bg' ? '#ffffff' : key === 'text' ? '#111111' : '#2bbdbe')}
                        onChange={(e) => update(key, e.target.value)}
                        style={{
                          width: '100%',
                          height: 44,
                          border: `1px solid ${theme.palette.divider}`,
                          borderRadius: 8,
                          background: 'transparent'
                        }}
                      />
                    </Box>
                  ))}
                </Stack>
              )}

              {/* Typography & Visibility */}
              {form.mode === 'custom' && (
                <>
                  <Divider textAlign="left">{tOr('typography', 'typography')}</Divider>
                  <Stack spacing={2}>
                    <Box data-tour="font-select">
                      <Typography variant="caption" display="block" mb={0.5}>{tOr('font_family', 'Font Family')}</Typography>
                      <Select
                        fullWidth
                        value={FONT_PRESETS.find(f => f.css === form.font)?.css || ''}
                        onChange={(e) => update('font', e.target.value)}
                        displayEmpty
                        size={isSmDown ? 'small' : 'medium'}
                        sx={{ borderRadius: 2 }}
                      >
                        <MenuItem value="">{tOr('system_default', 'System default')}</MenuItem>
                        {FONT_PRESETS.map(f => <MenuItem key={f.id} value={f.css}>{tOr(`font_${f.id}`, f.label)}</MenuItem>)}
                      </Select>
                    </Box>

                    <Box data-tour="font-scale">
                      <Typography variant="caption" display="block" mb={0.5}>{tOr('font_scale', 'Font Scale')}</Typography>
                      <Slider
                        min={0.85}
                        max={1.25}
                        step={0.01}
                        value={form.scale || 1}
                        onChange={(_, v) => update('scale', Number(v))}
                        valueLabelDisplay="auto"
                        size="small"
                      />
                    </Box>

                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                      <Box sx={{ flex: 1 }} data-tour="price-color">
                        <Typography variant="caption" display="block" mb={0.5}>{tOr('price_color', 'Price Color')}</Typography>
                        <input
                          type="color"
                          value={form.price_color || '#1d4ed8'}
                          onChange={(e) => update('price_color', e.target.value)}
                          style={{
                            width: '100%',
                            height: 44,
                            border: `1px solid ${theme.palette.divider}`,
                            borderRadius: 8,
                            background: 'transparent'
                          }}
                        />
                      </Box>
                      <Box sx={{ flex: 2 }} data-tour="price-scale">
                        <Typography variant="caption" display="block" mb={0.5}>{tOr('price_scale', 'Price Scale')}</Typography>
                        <Slider
                          min={0.8}
                          max={1.5}
                          step={0.01}
                          value={form.price_scale || 1}
                          onChange={(_, v) => update('price_scale', Number(v))}
                          valueLabelDisplay="auto"
                          size="small"
                        />
                      </Box>
                    </Stack>

                    {/* Gradient Selector */}
                    <Box data-tour="gradient-selector">
                      <Typography variant="caption" display="block" mb={1}>
                        {tOr('placeholder_gradient', 'Dish Placeholder Gradient')}
                      </Typography>
                      <Stack direction="row" spacing={1.5} flexWrap="wrap" sx={{ gap: 1.5 }}>
                        {GRADIENT_PRESETS.map((preset) => (
                          <Tooltip key={preset.id} title={tOr(`gradient_${preset.id}`, preset.label)} arrow>
                            <Box
                              onClick={() => update('placeholder_gradient', preset.gradient)}
                              sx={{
                                width: 80,
                                height: 50,
                                borderRadius: 2,
                                background: preset.gradient,
                                cursor: 'pointer',
                                border: form.placeholder_gradient === preset.gradient ? '3px solid #1976d2' : '2px solid #e0e0e0',
                                boxShadow: form.placeholder_gradient === preset.gradient ? '0 4px 12px rgba(25,118,210,0.3)' : '0 2px 4px rgba(0,0,0,0.1)',
                                transition: 'all 0.2s ease',
                                '&:hover': {
                                  transform: 'scale(1.05)',
                                  boxShadow: '0 6px 16px rgba(0,0,0,0.15)',
                                },
                              }}
                            />
                          </Tooltip>
                        ))}
                      </Stack>
                    </Box>
                  </Stack>

                  <Divider textAlign="left" sx={{ mt: 2 }}>
                    {tr('visibility', 'العناصر الظاهرة')}
                  </Divider>
                  <Stack direction="row" spacing={2} flexWrap="wrap" data-tour="visibility">
                    {['show_logo', 'show_hero', 'show_search', 'show_sections', 'show_prices', 'show_images'].map((k) => (
                      <FormControlLabel
                        key={k}
                        control={<Checkbox checked={!!form[k]} onChange={(e) => update(k, e.target.checked ? 1 : 0)} />}
                        label={tOr(k, k)}
                      />
                    ))}
                  </Stack>
                </>
              )}

              <Box display="flex" justifyContent="flex-end">
                <Button
                  variant="contained"
                  color="primary"
                  onClick={handleSave}
                  disabled={saving}
                  sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 800, px: 3 }}
                  size={isSmDown ? 'small' : 'medium'}
                  fullWidth={isXsDown}
                  data-tour="save"
                >
                  {saving ? tOr('saving', 'حفظ...') : tOr('save', 'حفظ')}
                </Button>
              </Box>
            </Stack>
          </Paper>
        </Box >
      </Stack >

      <Dialog open={confirmUnpublish} onClose={() => setConfirmUnpublish(false)} fullWidth maxWidth="xs">
        <DialogTitle sx={{ pb: 1 }}>{tOr('confirm_unpublish_title', 'إلغاء النشر؟')}</DialogTitle>
        <DialogContent sx={{ pt: 0 }}>{tOr('confirm_unpublish_body', 'هل أنت متأكد من إلغاء نشر هذه القائمة؟')}</DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setConfirmUnpublish(false)} size={isSmDown ? 'small' : 'medium'}>{tOr('cancel', 'إلغاء')}</Button>
          <Button color="warning" variant="contained" onClick={unpublish} size={isSmDown ? 'small' : 'medium'}>{tOr('unpublish', 'إلغاء النشر')}</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={!!snack} message={snack} autoHideDuration={2400} onClose={() => setSnack('')} />
    </Container >
  );
}
