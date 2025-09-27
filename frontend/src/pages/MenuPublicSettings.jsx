// src/pages/MenuPublicSettings.jsx
// تصميم Responsive:
// - موبايل: عامودي
// - شاشات كبيرة: كارد الإعدادات يسار + كارد الصور الداكن يمين (sticky)
// يدعم i18n بمفاتيحك المسطّحة

import React, { useEffect, useMemo, useRef, useState } from 'react';
import axios from '../services/axios';
import {
  Box, Button, CardMedia, CircularProgress, Container,
  Dialog, DialogActions, DialogContent, DialogTitle, Snackbar, TextField,
  Tooltip, Typography, Chip, Paper, ToggleButtonGroup, ToggleButton,
  Stack
} from '@mui/material';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import LinkIcon from '@mui/icons-material/Link';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import PublishIcon from '@mui/icons-material/Publish';
import UnpublishedIcon from '@mui/icons-material/Unpublished';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import QRCode from 'react-qr-code';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

const parseTheme = (themeStr) => {
  if (!themeStr) return { mode: 'default', bg: '#ffffff', text: '#111111', icon: '#1976d2' };
  if (themeStr.startsWith('custom3:')) {
    const [bg = '#ffffff', text = '#111111', icon = '#1976d2'] = themeStr.replace('custom3:', '').split(',');
    return { mode: 'custom3', bg, text, icon };
  }
  return { mode: themeStr, bg: '#ffffff', text: '#111111', icon: '#1976d2' };
};

const buildURL = (path) => new URL(path, window.location.origin).toString();

export default function MenuPublicSettings() {
  const { t } = useTranslation();
  const { menuId } = useParams();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [snack, setSnack] = useState('');
  const [menu, setMenu] = useState(null);
  const [profileSlug, setProfileSlug] = useState('');
  const [confirmUnpublish, setConfirmUnpublish] = useState(false);
  const qrRef = useRef(null);

  const [form, setForm] = useState({
    display_name: '',
    phone: '',
    address: '',
    hours: '',
    logo: null,
    logo_url: '',
    hero_image: null,
    hero_image_url: '',
    mode: 'default',
    bg: '#ffffff',
    text: '#111111',
    icon: '#1976d2',
  });
  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const fetchMenu = async () => {
    const res = await axios.get(`/menus/${menuId}/`);
    setMenu(res.data || null);
  };
 const fetchProfile = async () => {
   try {
     // endpoint الجديد المتوافق مع بقية المشروع
     const res = await axios.get('/me/profile/');
     // دعم أكثر من اسم حقل: slug أو username أو profile_slug
     const slug =
       res.data?.slug ||
       res.data?.username ||
       res.data?.profile_slug ||
       '';
     setProfileSlug(slug);
   } catch (e) {
     console.error(e);
     setProfileSlug(''); // لا تعطّل الصفحة إن فشل
   }
 };
  const fetchDisplaySettings = async () => {
    const res = await axios.get(`/menus/${menuId}/display-settings/`);
    const d = res.data || {};
    const parsed = parseTheme(d.theme || 'default');
    setForm((f) => ({
      ...f,
      display_name: d.display_name || '',
      phone: d.phone || '',
      address: d.address || '',
      hours: d.hours || '',
      logo: null,
      logo_url: d.logo || '',
      hero_image: null,
      hero_image_url: d.hero_image || '',
      ...parsed,
    }));
  };
  const navigate = useNavigate();

  const fetchAll = async () => {
    setLoading(true);
    try {
      await Promise.all([fetchMenu(), fetchProfile()]);
    } catch (e) {
      console.error(e);
      setSnack(t('load_failed'));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { fetchAll(); /* eslint-disable-next-line */ }, [menuId]);
  useEffect(() => { if (menu?.is_published) fetchDisplaySettings(); /* eslint-disable-next-line */ }, [menu?.is_published]);

  const publicLink = useMemo(() => {
    if (menu?.public_slug) return buildURL(`/show/menu/${menu.public_slug}`);
    return profileSlug ? buildURL(`/show/restaurant/${profileSlug}`) : '';
  }, [menu?.public_slug, profileSlug]);

  const isPublished = !!menu?.is_published;
  const hasPublic = isPublished && !!menu?.public_slug;

  const publish = async () => {
    try {
      await axios.post(`/menus/${menuId}/publish/`);
      await fetchMenu();
      setSnack(t('published_successfully'));
      await fetchDisplaySettings();
    } catch (e) {
      console.error(e);
      setSnack(t('publish_failed'));
    }
  };
  const unpublish = async () => {
    try {
      await axios.post(`/menus/${menuId}/unpublish/`);
      await fetchMenu();
      setSnack(t('unpublished_successfully'));
    } catch (e) {
      console.error(e);
      setSnack(t('unpublish_failed'));
    } finally {
      setConfirmUnpublish(false);
    }
  };

  const copyUrl = async () => {
    if (!publicLink || !hasPublic) return;
    try {
      await navigator.clipboard.writeText(publicLink);
      setSnack(t('copied'));
    } catch {
      try {
        const ta = document.createElement('textarea');
        ta.value = publicLink; document.body.appendChild(ta); ta.select();
        document.execCommand('copy'); document.body.removeChild(ta);
        setSnack(t('copied'));
      } catch {
        setSnack(t('copy_failed'));
      }
    }
  };
  const openUrl = () => { if (hasPublic) window.open(publicLink, '_blank', 'noopener,noreferrer'); };
  const downloadQR = () => {
    if (!qrRef.current || !hasPublic) return;
    const svg = qrRef.current.querySelector('svg');
    if (!svg) return;
    if (!svg.getAttribute('xmlns')) svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    const source = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `menu-${menu.public_slug || menuId}.svg`;
    a.click(); URL.revokeObjectURL(a.href);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('display_name', form.display_name);
      fd.append('phone', form.phone);
      fd.append('address', form.address);
      fd.append('hours', form.hours);
      if (form.mode === 'custom3') fd.append('theme', `custom3:${form.bg},${form.text},${form.icon}`);
      else fd.append('theme', form.mode);
      if (form.logo instanceof File) fd.append('logo', form.logo);
      if (form.hero_image instanceof File) fd.append('hero_image', form.hero_image);
      await axios.put(`/menus/${menuId}/display-settings/`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setSnack(t('saved'));
      await fetchDisplaySettings();
    } catch (e) {
      console.error(e);
      setSnack(t('save_failed'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Container sx={{ mt: 6, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress />
      </Container>
    );
  }
  if (!menu) {
    return (
      <Container sx={{ mt: 6 }}>
        <Typography color="error">{t('menu_not_found')}</Typography>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 6 }}>
      {/* Header */}
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
        <Typography variant="h5" fontWeight={800}>
          {t('unified_public_and_display_settings')}
        </Typography>
        <Stack direction="row" spacing={1} alignItems="center">
          <Chip
            label={isPublished ? t('published') : t('not_published')}
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
              sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700 }}
            >
              {t('unpublish')}
            </Button>
          ) : (
            <Button
              variant="contained"
              color="success"
              startIcon={<PublishIcon />}
              onClick={publish}
              sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700 }}
            >
              {t('publish')}
            </Button>
          )}
        </Stack>
      </Box>

      {/* Public Link Card */}
      <Paper
        variant="outlined"
        sx={{
          p: 2.5,
          mb: 3,
          borderRadius: 3,
          boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
        }}
      >
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="center">
          <Box sx={{ flex: 1, width: '100%' }}>
            <TextField
              fullWidth
              label={t('public_link')}
              value={hasPublic ? publicLink : (publicLink || '')}
              InputProps={{ readOnly: true }}
              sx={{ '& .MuiInputBase-root': { borderRadius: 2 } }}
            />
            <Stack direction="row" spacing={1} mt={1} flexWrap="wrap">
              <Tooltip title={hasPublic ? t('open_public_page') : t('publish_first_tooltip')}>
                <span>
                  <Button
                    variant="contained"
                    startIcon={<LinkIcon />}
                    onClick={openUrl}
                    disabled={!hasPublic}
                    sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700 }}
                  >
                    {t('open_link')}
                  </Button>
                </span>
              </Tooltip>
              <Tooltip title={hasPublic ? t('copy_public_link') : t('publish_first_tooltip')}>
                <span>
                  <Button
                    variant="outlined"
                    startIcon={<ContentCopyIcon />}
                    onClick={copyUrl}
                    disabled={!hasPublic}
                    sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700 }}
                  >
                    {t('copy_link')}
                  </Button>
                  
                </span>
              </Tooltip>
              <Tooltip title={hasPublic ? t('download_qr') : t('publish_first_tooltip')}>
                <span>
                  <Button
                    variant="outlined"
                    startIcon={<FileDownloadIcon />}
                    onClick={downloadQR}
                    disabled={!hasPublic}
                    sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700 }}
                  >
                    {t('download_qr')}
                  </Button>
                </span>
                
              </Tooltip>
               <span>
                  <Button
  variant="outlined"
  onClick={() => navigate('/reports')}
  sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700 }}
>
  {t('feature_soon')}
</Button>
</span>
            </Stack>
          </Box>

          {/* QR thumbnail */}
          <Box
            sx={{
              width: { xs: '100%', md: 160 },
              alignSelf: { md: 'stretch' },
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              p: 1.5,
              borderRadius: 2,
              border: '1px solid',
              borderColor: 'divider',
              bgcolor: 'background.paper'
            }}
            ref={qrRef}
          >
            {hasPublic ? (
              <QRCode value={publicLink} size={96} />
            ) : (
              <Typography color="text.secondary" variant="body2" align="center">
                {t('publish_to_generate_qr')}
              </Typography>
            )}
          </Box>
        </Stack>
      </Paper>

      {/* Two columns: settings (left) + brand assets (right sticky) */}
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="stretch" sx={{ mt: 2 }}>
        {/* Left: Display Settings */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Paper
            variant="outlined"
            sx={{ p: 2.5, borderRadius: 3, boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}
          >
            <Typography variant="subtitle1" fontWeight={800} mb={2}>
              {t('display_settings_title')}
            </Typography>

            <Stack spacing={2}>
              <TextField
                label={t('display_name')}
                value={form.display_name}
                onChange={(e) => update('display_name', e.target.value)}
                fullWidth
                sx={{ '& .MuiInputBase-root': { borderRadius: 2 } }}
              />

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <TextField
                  label={t('phone')}
                  value={form.phone}
                  onChange={(e) => update('phone', e.target.value)}
                  fullWidth
                  sx={{ '& .MuiInputBase-root': { borderRadius: 2 } }}
                />
                <TextField
                  label={t('hours')}
                  value={form.hours}
                  onChange={(e) => update('hours', e.target.value)}
                  fullWidth
                  sx={{ '& .MuiInputBase-root': { borderRadius: 2 } }}
                />
              </Stack>

              <TextField
                label={t('address')}
                value={form.address}
                onChange={(e) => update('address', e.target.value)}
                fullWidth
                multiline
                minRows={2}
                sx={{ '& .MuiInputBase-root': { borderRadius: 2 } }}
              />

              <Box>
                <Typography variant="subtitle2" color="text.secondary" mb={1}>
                  {t('theme')}
                </Typography>
                <ToggleButtonGroup
                  exclusive
                  value={form.mode}
                  onChange={(_, val) => val && update('mode', val)}
                  sx={{
                    '& .MuiToggleButton-root': {
                      textTransform: 'none',
                      borderRadius: 2,
                      px: 2,
                      fontWeight: 700,
                    },
                  }}
                >
                  <ToggleButton value="default">{t('theme_default')}</ToggleButton>
                  <ToggleButton value="light">{t('theme_light')}</ToggleButton>
                  <ToggleButton value="dark">{t('theme_dark')}</ToggleButton>
                  <ToggleButton value="custom3">{t('theme_custom')}</ToggleButton>
                </ToggleButtonGroup>
              </Box>

              {form.mode === 'custom3' && (
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="caption" display="block" mb={0.5}>{t('bg_color')}</Typography>
                    <input
                      type="color"
                      value={form.bg}
                      onChange={(e) => update('bg', e.target.value)}
                      style={{ width: '100%', height: 44, border: '1px solid #e0e0e0', borderRadius: 8 }}
                    />
                  </Box>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="caption" display="block" mb={0.5}>{t('text_color')}</Typography>
                    <input
                      type="color"
                      value={form.text}
                      onChange={(e) => update('text', e.target.value)}
                      style={{ width: '100%', height: 44, border: '1px solid #e0e0e0', borderRadius: 8 }}
                    />
                  </Box>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="caption" display="block" mb={0.5}>{t('icon_color')}</Typography>
                    <input
                      type="color"
                      value={form.icon}
                      onChange={(e) => update('icon', e.target.value)}
                      style={{ width: '100%', height: 44, border: '1px solid #e0e0e0', borderRadius: 8 }}
                    />
                  </Box>
                </Stack>
              )}

              <Box display="flex" justifyContent="flex-end">
                <Button
                  variant="contained"
                  onClick={handleSave}
                  disabled={saving}
                  sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 800, px: 3 }}
                >
                  {saving ? t('saving') : t('save')}
                </Button>
              </Box>
            </Stack>
          </Paper>
        </Box>

        {/* Right: Brand Assets (dark, sticky) */}
        <Box
          sx={{
            width: { xs: '100%', md: 420 },
            flexShrink: 0,
            alignSelf: { md: 'flex-start' },
            position: { md: 'sticky' },
            top: { md: 88 } // اضبط حسب ارتفاع الهيدر عندك
          }}
        >
          <Paper
            sx={{
              p: 2.5,
              borderRadius: 3,
              bgcolor: '#0e0f10',
              color: 'white',
              boxShadow: '0 1px 2px rgba(0,0,0,0.24)'
            }}
          >
            <Typography variant="subtitle1" fontWeight={800} mb={2}>
              {t('settings')}
            </Typography>

            {/* Logo */}
            <Typography variant="subtitle2" fontWeight={700} mb={1}>{t('logo')}</Typography>
            <Box
              sx={{
                width: '100%',
                height: 120,
                borderRadius: 2,
                border: '1px dashed rgba(255,255,255,0.35)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                mb: 1.5,
                overflow: 'hidden',
                bgcolor: 'rgba(255,255,255,0.04)'
              }}
            >
              {(form.logo ? URL.createObjectURL(form.logo) : form.logo_url) ? (
                <CardMedia
                  component="img"
                  image={form.logo ? URL.createObjectURL(form.logo) : form.logo_url}
                  alt="logo"
                  sx={{ objectFit: 'contain', width: '100%', height: '100%' }}
                />
              ) : (
                <Typography variant="caption" color="rgba(255,255,255,0.7)">{t('no_logo')}</Typography>
              )}
            </Box>
            <Button
              component="label"
              variant="outlined"
              startIcon={<UploadFileIcon />}
              sx={{
                mb: 2, borderRadius: 2, textTransform: 'none',
                color: 'white', borderColor: 'rgba(255,255,255,0.4)',
                '&:hover': { borderColor: 'rgba(255,255,255,0.7)' }
              }}
            >
              {t('upload_logo')}
              <input hidden type="file" accept="image/*"
                     onChange={(e) => { const file = e.target.files?.[0]; if (file) update('logo', file); }} />
            </Button>

            {/* Hero image */}
            <Typography variant="subtitle2" fontWeight={700} mb={1}>{t('hero')}</Typography>
            <Box
              sx={{
                width: '100%',
                height: 260, // مساحة كبيرة ثابتة
                borderRadius: 3,
                border: '1px dashed rgba(255,255,255,0.35)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                bgcolor: 'rgba(255,255,255,0.04)'
              }}
            >
              {(form.hero_image ? URL.createObjectURL(form.hero_image) : form.hero_image_url) ? (
                <CardMedia
                  component="img"
                  image={form.hero_image ? URL.createObjectURL(form.hero_image) : form.hero_image_url}
                  alt="hero"
                  sx={{ objectFit: 'cover', width: '100%', height: '100%' }}
                />
              ) : (
                <Typography variant="body2" color="rgba(255,255,255,0.7)">{t('no_hero')}</Typography>
              )}
            </Box>
            <Button
              component="label"
              variant="outlined"
              startIcon={<UploadFileIcon />}
              sx={{
                mt: 1.5, borderRadius: 2, textTransform: 'none',
                color: 'white', borderColor: 'rgba(255,255,255,0.4)',
                '&:hover': { borderColor: 'rgba(255,255,255,0.7)' }
              }}
            >
              {t('upload_image')}
              <input hidden type="file" accept="image/*"
                     onChange={(e) => { const file = e.target.files?.[0]; if (file) update('hero_image', file); }} />
            </Button>
            
          </Paper>
        </Box>
      </Stack>

      {/* Confirm Unpublish */}
      <Dialog open={confirmUnpublish} onClose={() => setConfirmUnpublish(false)}>
        <DialogTitle>{t('confirm_unpublish_title')}</DialogTitle>
        <DialogContent>{t('confirm_unpublish_body')}</DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmUnpublish(false)}>{t('cancel')}</Button>
          <Button color="warning" variant="contained" onClick={unpublish}>{t('unpublish')}</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={!!snack} message={snack} autoHideDuration={2500} onClose={() => setSnack('')} />
    </Container>
  );
}
