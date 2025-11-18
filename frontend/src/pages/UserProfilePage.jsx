// frontend/src/pages/UserProfilePage.jsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Container, Card, CardContent, CardHeader, Avatar, Button, Stack, TextField,
  Divider, Typography, Snackbar, Alert, Box, IconButton
} from '@mui/material';
import AddAPhotoIcon from '@mui/icons-material/AddAPhoto';
import api from '../services/axios';
import { useTranslation } from 'react-i18next';

export default function UserProfilePage() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [snack, setSnack] = useState('');

  const [form, setForm] = useState({
    full_name: '',
    email: '',
    can_change_email: false,
    avatar_url: '',
  });
  const [avatarFile, setAvatarFile] = useState(null);
  const [passwordForm, setPasswordForm] = useState({ current: '', next: '', confirm: '' });
  const [pwdBusy, setPwdBusy] = useState(false);
  const [saveBusy, setSaveBusy] = useState(false);
  const fileRef = useRef(null);

  const initialRef = useRef(null);
  const isDirty = useMemo(() => {
    const init = initialRef.current || {};
    if (!init) return false;
    const basicChanged = (init.full_name || '') !== (form.full_name || '') ||
      (init.email || '') !== (form.email || '');
    return basicChanged || !!avatarFile;
  }, [form.full_name, form.email, avatarFile]);

  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (!isDirty) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  const fetchMe = async () => {
    setLoading(true);
    setError('');
    try {
      let data = null;
      try {
        const res = await api.get('/auth/me/');
        data = res?.data || null;
      } catch (_) {
        const res = await api.get('/me/profile/');
        data = res?.data || null;
      }
      const fn = (data?.full_name || '').trim();
      setForm({
        full_name: fn,
        email: data?.email || '',
        can_change_email: !!data?.can_change_email,
        avatar_url: data?.avatar_url || '',
      });
      initialRef.current = {
        full_name: fn,
        email: data?.email || '',
      };
    } catch (e) {
      setError(t('load_failed') || 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchMe(); /* eslint-disable-next-line */ }, []);

  const onPickAvatar = (e) => {
    const f = e.target.files?.[0] || null;
    if (f) setAvatarFile(f);
  };

  const avatarPreview = useMemo(() => {
    if (avatarFile) return URL.createObjectURL(avatarFile);
    return form.avatar_url || '';
  }, [avatarFile, form.avatar_url]);

  const saveProfile = async () => {
    setSaveBusy(true);
    setError('');
    try {
      const fd = new FormData();
      if (avatarFile) fd.append('avatar', avatarFile);
      if (typeof form.full_name === 'string') fd.append('full_name', form.full_name || '');
      if (form.can_change_email && typeof form.email === 'string') fd.append('email', form.email || '');

      let res;
      try {
        res = await api.patch('/auth/me/', fd);
      } catch (_) {
        res = await api.patch('/me/profile/', fd);
      }
      const data = res?.data || {};
      setForm((f) => ({
        ...f,
        full_name: (data?.full_name || '').trim(),
        email: data?.email || f.email,
        avatar_url: data?.avatar_url || f.avatar_url,
        can_change_email: !!data?.can_change_email,
      }));
      initialRef.current = {
        full_name: (data?.full_name || '').trim(),
        email: data?.email || '',
      };
      setAvatarFile(null);
      if (fileRef.current) fileRef.current.value = '';
      setSnack(t('saved_successfully') || 'Saved successfully');
    } catch (e) {
      setError(t('save_failed') || 'Save failed');
    } finally {
      setSaveBusy(false);
    }
  };

  const resetForm = () => {
    const init = initialRef.current || {};
    setForm((f) => ({ ...f, full_name: init.full_name || '', email: init.email || '' }));
    setAvatarFile(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  const changePassword = async () => {
    setPwdBusy(true);
    setError('');
    try {
      if (!passwordForm.next || passwordForm.next !== passwordForm.confirm) {
        setError(t('confirm_password') || 'Confirm password');
        setPwdBusy(false);
        return;
      }
      const payload = {
        current_password: passwordForm.current,
        new_password: passwordForm.next,
        confirm_password: passwordForm.confirm,
      };
      let res = await api.post('/auth/me/change-password/', payload);
      if (res?.status >= 200 && res?.status < 300) {
        setSnack(t('password_updated') || 'Password updated');
        setPasswordForm({ current: '', next: '', confirm: '' });
      }
    } catch (e) {
      const msg = e?.response?.data?.detail || e?.response?.data?.current_password?.[0] || e?.response?.data?.new_password?.[0] || e?.response?.data?.confirm_password?.[0] || (t('save_failed') || 'Save failed');
      setError(msg);
    } finally {
      setPwdBusy(false);
    }
  };

  return (
    <Container maxWidth="sm" sx={{ mt: 4, mb: 6 }}>
      <Card variant="outlined" sx={{ mb: 3 }}>
        <CardHeader title={t('my_profile') || 'My Profile'} />
        <CardContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
              {error}
            </Alert>
          )}
          <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
            <Box sx={{ position: 'relative' }}>
              <Avatar src={avatarPreview || undefined} sx={{ width: 64, height: 64 }} />
              <IconButton
                component="label"
                sx={{
                  position: 'absolute', bottom: -8, right: -8, bgcolor: 'primary.main', color: 'primary.contrastText',
                  width: 32, height: 32, '&:hover': { bgcolor: 'primary.dark' }
                }}
                title={t('change_photo') || 'Change Photo'}
              >
                <AddAPhotoIcon fontSize="small" />
                <input ref={fileRef} hidden type="file" accept="image/*" onChange={onPickAvatar} />
              </IconButton>
            </Box>
            <Typography variant="body2" color="text.secondary">
              {t('upload_avatar_hint') || 'Upload a square image for best results.'}
            </Typography>
          </Stack>

          <Stack spacing={2}>
            <TextField
              label={t('full_name') || 'Full name'}
              value={form.full_name}
              onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
              fullWidth
            />
            <TextField
              label={t('email') || 'Email'}
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              fullWidth
              disabled={!form.can_change_email}
            />
          </Stack>

          <Stack direction="row" spacing={2} sx={{ mt: 3 }}>
            <Button variant="contained" onClick={saveProfile} disabled={saveBusy || !isDirty}>
              {t('save') || 'Save'}
            </Button>
            <Button variant="text" onClick={resetForm} disabled={saveBusy}>
              {t('cancel') || 'Cancel'}
            </Button>
          </Stack>
        </CardContent>
      </Card>

      <Card variant="outlined">
        <CardHeader title={t('change_password') || 'Change Password'} />
        <CardContent>
          <Stack spacing={2}>
            <TextField
              type="password"
              label={t('current_password') || 'Current password'}
              value={passwordForm.current}
              onChange={(e) => setPasswordForm((p) => ({ ...p, current: e.target.value }))}
              fullWidth
            />
            <TextField
              type="password"
              label={t('new_password') || 'New password'}
              value={passwordForm.next}
              onChange={(e) => setPasswordForm((p) => ({ ...p, next: e.target.value }))}
              fullWidth
            />
            <TextField
              type="password"
              label={t('confirm_password') || 'Confirm password'}
              value={passwordForm.confirm}
              onChange={(e) => setPasswordForm((p) => ({ ...p, confirm: e.target.value }))}
              fullWidth
            />
          </Stack>
          <Stack direction="row" spacing={2} sx={{ mt: 3 }}>
            <Button variant="contained" onClick={changePassword} disabled={pwdBusy}>
              {t('save') || 'Save'}
            </Button>
            <Button variant="text" onClick={() => setPasswordForm({ current: '', next: '', confirm: '' })} disabled={pwdBusy}>
              {t('cancel') || 'Cancel'}
            </Button>
          </Stack>
        </CardContent>
      </Card>

      <Snackbar open={!!snack} autoHideDuration={2400} onClose={() => setSnack('')} message={snack} />
    </Container>
  );
}

