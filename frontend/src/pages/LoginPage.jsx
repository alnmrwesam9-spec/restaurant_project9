// src/pages/LoginPage.jsx
// -----------------------------------------------------------------------------
// Arcana-style Login (UI only)
// - Left: clean light panel with logo, "Sign in", fields, remember me, black CTA, links, social
// - Right: large dark card with rounded corners, glossy streaks, big watermark "A", welcome copy
// - Preserves your login logic (axios instance, JWT decode, role-based navigate, i18n)
// - Responsive & RTL-aware
// -----------------------------------------------------------------------------

import React, { useMemo, useState, useEffect } from 'react';
import axios from 'axios';
import api from '../services/axios';
import { jwtDecode } from 'jwt-decode';

import {
  Box,
  Paper,
  TextField,
  Button,
  Typography,
  InputAdornment,
  IconButton,
  Avatar,
  FormControlLabel,
  Checkbox,
  Stack,
  Divider,
} from '@mui/material';

import MailOutlineIcon from '@mui/icons-material/MailOutline';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import GoogleIcon from '@mui/icons-material/Google';
import GitHubIcon from '@mui/icons-material/GitHub';
import FacebookIcon from '@mui/icons-material/Facebook';

import { useTranslation } from 'react-i18next';
import { useNavigate, Link } from 'react-router-dom';

const FALLBACK_IMG =
  'https://images.unsplash.com/photo-1542831371-29b0f74f9713?q=80&w=1600&auto=format&fit=crop';

// ============================================================================
// Helpers
// ============================================================================
function isAdminFromClaims(decoded) {
  if (!decoded || typeof decoded !== 'object') return false;
  const directRole =
    decoded.role ??
    decoded.user?.role ??
    (Array.isArray(decoded.roles) ? decoded.roles[0] : undefined);

  if (typeof directRole === 'string') {
    const r = directRole.toLowerCase();
    if (['admin', 'administrator', 'superadmin', 'role_admin'].includes(r)) return true;
  }
  if (
    decoded.is_admin === true ||
    decoded.isAdmin === true ||
    decoded.is_staff === true ||
    decoded.is_superuser === true ||
    decoded.user?.is_staff === true ||
    decoded.user?.is_superuser === true
  )
    return true;

  const norm = (arr) =>
    (Array.isArray(arr) ? arr : [])
      .map((x) => (typeof x === 'string' ? x : x?.name || x?.codename || ''))
      .filter(Boolean)
      .map((s) => s.toLowerCase());

  const groups = norm(decoded.groups || decoded.user?.groups);
  if (groups.some((g) => g.includes('admin') || g.includes('staff') || g.includes('super'))) return true;

  const perms = norm(decoded.permissions || decoded.user?.permissions);
  if (perms.some((p) => p.includes('admin') || p.includes('staff') || p.includes('super'))) return true;

  return false;
}

// ============================================================================
// Component
// ============================================================================
export default function LoginPage({ onLogin }) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();

  // form state
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [remember, setRemember] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [token, setToken] = useState(null);

  // RTL
  const isRTL = useMemo(() => i18n.language === 'ar', [i18n.language]);
  useEffect(() => {
    document.dir = isRTL ? 'rtl' : 'ltr';
    document.documentElement.lang = i18n.language;
  }, [isRTL, i18n.language]);
  const changeLang = (lang) => i18n.changeLanguage(lang);

  // login
  const handleLogin = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const { data } = await api.post('/token/', { username, password });
      const accessToken = data?.access;
      if (!accessToken) throw new Error('Missing access token');

      let role = 'user';
      try {
        const decoded = jwtDecode(accessToken);
        role = isAdminFromClaims(decoded) ? 'admin' : 'user';
      } catch {
        role = 'user';
      }

      sessionStorage.setItem('token', accessToken);
      sessionStorage.setItem('role', role);
      localStorage.removeItem('token');
      localStorage.removeItem('role');

      api.defaults.headers.common.Authorization = `Bearer ${accessToken}`;
      setToken(accessToken);
      onLogin?.(accessToken);
      navigate(role === 'admin' ? '/admin/users' : '/menus', { replace: true });
    } catch (err) {
      if (axios.isAxiosError && axios.isAxiosError(err)) {
        const status = err.response?.status;
        if (status === 400 || status === 401) {
          setError(t('bad_credentials') || 'Wrong username or password.');
        } else if (status >= 500) {
          setError(t('server_down') || 'Server error. Please try later.');
        } else {
          setError(t('network_error') || 'Network error. Check your connection.');
        }
      } else {
        setError(t('login_error') || 'Login failed. Check your credentials.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  // layout direction (keep container LTR; fields switch with dir)
  const layoutDirection = {
    xs: 'column',
    md: isRTL ? 'row-reverse' : 'row',
  };

  return (
    <Box
      component="main"
      sx={{
        minHeight: '100svh',
        display: 'flex',
        flexDirection: layoutDirection,
        bgcolor: '#f3f4f6', // light grey like the shot
      }}
    >
      {/* ===================== Left (Form) ===================== */}
      <Box
        sx={{
          flex: { xs: '1 1 auto', md: '5 1 0' },
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          px: { xs: 2.5, md: 6 },
          py: { xs: 4, md: 6 },
        }}
      >
        <Box sx={{ width: '100%', maxWidth: 420 }}>
          {/* Brand */}
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 3 }}>
            <Avatar
              variant="rounded"
              sx={{
                bgcolor: '#111',
                color: '#fff',
                fontWeight: 800,
                width: 36,
                height: 36,
                borderRadius: 2,
              }}
            >
              IB
            </Avatar>
            <Typography fontWeight={700}>IBLA</Typography>
          </Stack>

          <Typography variant="h4" fontWeight={800} sx={{ mb: 2 }}>
            {t('sign_in') || 'Sign in'}
          </Typography>

          {/* Language tiny pills (optional) */}
          <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
            <Button size="small" variant="outlined" onClick={() => changeLang('ar')}>
              AR
            </Button>
            <Button size="small" variant="outlined" onClick={() => changeLang('de')}>
              DE
            </Button>
            <Button size="small" variant="outlined" onClick={() => changeLang('en')}>
              EN
            </Button>
          </Stack>

          <Box component="form" onSubmit={handleLogin} noValidate>
            <TextField
              fullWidth
              required
              margin="normal"
              label={t('email_address') || 'Email Address'}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoFocus
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <MailOutlineIcon />
                  </InputAdornment>
                ),
              }}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
            />

            <TextField
              fullWidth
              required
              margin="normal"
              label={t('password') || 'Password'}
              type={showPass ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <LockOutlinedIcon />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton onClick={() => setShowPass((v) => !v)} edge="end">
                      {showPass ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
            />

            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mt: 0.5 }}>
              <FormControlLabel
                control={
                  <Checkbox
                    size="small"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                  />
                }
                label={t('remember_me') || 'Remember me'}
                sx={{ mr: 0 }}
              />
              <Button size="small" variant="text" onClick={() => alert(t('feature_soon') || 'Soon')}>
                {t('forgot_password') || 'Forgot Password'}
              </Button>
            </Stack>

            {!!error && (
              <Box
                sx={{
                  mt: 2,
                  p: 1.2,
                  borderRadius: 1.5,
                  bgcolor: '#fdecea',
                  color: '#b71c1c',
                  fontSize: 14,
                }}
              >
                {error}
              </Box>
            )}
            {!!token && !error && (
              <Box
                sx={{
                  mt: 2,
                  p: 1.2,
                  borderRadius: 1.5,
                  bgcolor: '#e8f5e9',
                  color: '#1b5e20',
                  fontSize: 14,
                }}
              >
                {t('login_success') || 'Logged in successfully.'}
              </Box>
            )}

            <Button
              fullWidth
              type="submit"
              variant="contained"
              disabled={submitting}
              sx={{
                mt: 2.5,
                py: 1.2,
                textTransform: 'none',
                fontWeight: 800,
                letterSpacing: 0.2,
                borderRadius: 2,
                bgcolor: '#111',
                boxShadow: 'none',
                '&:hover': { bgcolor: '#000' },
              }}
            >
              {submitting ? (t('loading') || 'Loading…') : (t('sign_in') || 'Sign in')}
            </Button>
          </Box>

          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            {(t('no_account') || "Don't have an account?")}{' '}
            <Link to="/register">{t('sign_up') || 'Sign up'}</Link>
          </Typography>

          <Stack direction="row" spacing={2} alignItems="center" sx={{ mt: 2 }}>
            <Divider sx={{ flex: 1 }} />
            <Typography variant="caption" color="text.secondary">
              {t('or_continue_with') || 'Or continue with'}
            </Typography>
            <Divider sx={{ flex: 1 }} />
          </Stack>

          {/* Social */}
          <Stack direction="row" spacing={2} sx={{ mt: 2 }}>
            {[GoogleIcon, GitHubIcon, FacebookIcon].map((Icon, idx) => (
              <IconButton
                key={idx}
                size="large"
                sx={{
                  border: '1px solid #e5e7eb',
                  bgcolor: '#fff',
                  width: 48,
                  height: 48,
                  borderRadius: '50%',
                  '&:hover': { bgcolor: '#fafafa' },
                }}
                onClick={() => alert(t('feature_soon') || 'Soon')}
              >
                <Icon />
              </IconButton>
            ))}
          </Stack>
        </Box>
      </Box>

      {/* ===================== Right (Dark Card) ===================== */}
      <Box
        sx={{
          flex: { xs: '0 0 44vh', md: '7 1 0' },
          minHeight: { xs: 320, md: '100svh' },
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          px: { xs: 2, md: 4 },
          py: { xs: 4, md: 6 },
        }}
      >
        <Paper
          elevation={0}
          sx={{
            position: 'relative',
            width: '100%',
            height: { xs: '100%', md: '90%' },
            maxWidth: 720,
            bgcolor: '#000000ff',
            color: '#fff',
            borderRadius: { xs: 6, md: 8 }, // big rounded like the shot
            p: { xs: 3, md: 6 },
            overflow: 'hidden',
          }}
        >
          {/* Glossy diagonal streaks */}
          <Box
            sx={{
              pointerEvents: 'none',
              position: 'absolute',
              top: -80,
              right: -120,
              width: 420,
              height: 420,
              transform: 'rotate(35deg)',
              background:
                'linear-gradient(90deg, rgba(255,255,255,0.06), rgba(255,255,255,0) 60%)',
              filter: 'blur(1px)',
            }}
          />
          <Box
            sx={{
              pointerEvents: 'none',
              position: 'absolute',
              bottom: -120,
              left: -140,
              width: 480,
              height: 480,
              transform: 'rotate(-30deg)',
              background:
                'linear-gradient(90deg, rgba(142,190,255,0.1), rgba(255,255,255,0) 70%)',
              filter: 'blur(2px)',
            }}
          />

          {/* Watermark "A" */}
          <Typography
            aria-hidden
            sx={{
              position: 'absolute',
              inset: 0,
              fontSize: { xs: 280, md: 420 },
              fontWeight: 900,
              letterSpacing: -6,
              color: 'rgba(255,255,255,0.06)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              userSelect: 'none',
            }}
          >
            IBLA
          </Typography>

          {/* Content */}
          <Stack spacing={2} sx={{ position: 'relative' }}>
            <Typography variant="overline" sx={{ opacity: 0.7 }}>
                IBLATECH 
            </Typography>
            <Typography variant="h4" fontWeight={800}>
              {t('welcome_to_my web') || 'Welcome to '}
            </Typography>
            <Typography variant="body2" sx={{ opacity: 0.85, maxWidth: 520 }}>
              {t('From a single page you control dishes, prices, languages, and allergen info. Fast and simple — without complications.') ||
                'Every menu… always up-to-date, always in your customers’ hands'}
            </Typography>
            <Typography variant="caption" sx={{ opacity: 0.7 }}>
              {t('joined_1k') || ""}
            </Typography>

            {/* Speech-bubble CTA card */}
            <Box
              sx={{
                mt: 2,
                bgcolor: '#1a1a1f',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: '28px',
                p: 3,
                maxWidth: 540,
                position: 'relative',
                '&:after': {
                  content: '""',
                  position: 'absolute',
                  right: 20,
                  top: -18,
                  width: 36,
                  height: 36,
                  borderBottomLeftRadius: '18px',
                  backgroundColor: '#1a1a1f',
                  borderTop: '1px solid rgba(255,255,255,0.06)',
                  borderRight: '1px solid rgba(255,255,255,0.06)',
                  transform: 'rotate(45deg)',
                },
              }}
            >
              <Typography variant="h6" fontWeight={800} sx={{ mb: 1 }}>
                {t('A modern platform to manage restaurant menus with ease') || 'A modern platform to manage restaurant menus with ease'}
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.85, mb: 2 }}>
                {t('So far: 15+ restaurants and 300+ customers are using our digital menus') ||
                  'So far: 15+ restaurants and 300+ customers are using our digital menus'}
              </Typography>

              <Stack direction="row" spacing={1.2} alignItems="center">
                {[0, 1, 2].map((i) => (
                  <Avatar
                    key={i}
                    sx={{
                      width: 28,
                      height: 28,
                      border: '2px solid #0f0f12',
                    }}
                    src={`https://i.pravatar.cc/60?img=${10 + i}`}
                  />
                ))}
                <Box
                  sx={{
                    ml: 0.5,
                    px: 1,
                    py: 0.25,
                    borderRadius: 999,
                    fontSize: 12,
                    bgcolor: '#2a2a33',
                    border: '1px solid rgba(255,255,255,0.06)',
                  }}
                >
                  +2
                </Box>
              </Stack>
            </Box>
          </Stack>
        </Paper>
      </Box>
    </Box>
  );
}
