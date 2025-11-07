// src/pages/LoginPage.jsx
import React, { useMemo, useState, useEffect } from 'react'
import axios from 'axios'
import api from '../services/axios'
import { jwtDecode } from 'jwt-decode'

import {
  Box,
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
  useTheme,
  Fade,
  Slide,
  Chip,
} from '@mui/material'
import { alpha } from '@mui/material/styles'
import MailOutlineIcon from '@mui/icons-material/MailOutline'
import LockOutlinedIcon from '@mui/icons-material/LockOutlined'
import Visibility from '@mui/icons-material/Visibility'
import VisibilityOff from '@mui/icons-material/VisibilityOff'
import GoogleIcon from '@mui/icons-material/Google'
import GitHubIcon from '@mui/icons-material/GitHub'
import FacebookIcon from '@mui/icons-material/Facebook'
import StarRoundedIcon from '@mui/icons-material/StarRounded'
import { useTranslation } from 'react-i18next'
import { useNavigate, Link } from 'react-router-dom'

// ===== Helpers =====
function isAdminFromClaims(decoded) {
  if (!decoded || typeof decoded !== 'object') return false
  const directRole =
    decoded.role ?? decoded.user?.role ?? (Array.isArray(decoded.roles) ? decoded.roles[0] : undefined)
  const ok = (s) => String(s || '').toLowerCase()
  if (['admin', 'administrator', 'superadmin', 'role_admin'].includes(ok(directRole))) return true
  if (
    decoded.is_admin === true || decoded.isAdmin === true ||
    decoded.is_staff === true || decoded.is_superuser === true ||
    decoded.user?.is_staff === true || decoded.user?.is_superuser === true
  ) return true
  return false
}

// جرّب /auth/login أولاً، ثم ارجع إلى /token/ إن كان 404
async function loginOnce(payload) {
  try {
    return await api.post('/auth/login', payload)
  } catch (e) {
    if (e?.response?.status !== 404) throw e
  }
  return api.post('/token/', payload)
}

export default function LoginPage({ onLogin }) {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const theme = useTheme()

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [remember, setRemember] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [token, setToken] = useState(null)

  const isRTL = useMemo(() => i18n.language === 'ar', [i18n.language])
  useEffect(() => {
    document.dir = isRTL ? 'rtl' : 'ltr'
    document.documentElement.lang = i18n.language
  }, [isRTL, i18n.language])
  const changeLang = (lang) => i18n.changeLanguage(lang)

  const handleLogin = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    setError('')

    try {
      const { data } = await loginOnce({ username: username.trim(), password })

      // دعم أكثر من شكل محتمل للرد
      const accessToken = data?.access || data?.access_token || data?.token
      const refreshToken = data?.refresh || data?.refresh_token
      if (!accessToken) throw new Error('Missing access token')

      // Authorization header
      api.defaults.headers.common.Authorization = `Bearer ${accessToken}`
      setToken(accessToken)
      onLogin?.(accessToken)

      // التخزين يعتمد على "تذكرني"
      const store = remember ? localStorage : sessionStorage
      store.setItem('access_token', accessToken)
      if (refreshToken) store.setItem('refresh_token', refreshToken)

      // تحديد الدور: whoami أولاً ثم فك التوكن
      let role = 'owner'
      try {
        const who = await api.get('/auth/whoami')
        const r = String(who?.data?.role || '').toLowerCase() || (who?.data?.is_staff ? 'admin' : 'owner')
        role = r === 'admin' ? 'admin' : 'owner'
      } catch {
        try {
          const decoded = jwtDecode(accessToken)
          role = isAdminFromClaims(decoded) ? 'admin' : 'owner'
        } catch { /* ignore */ }
      }

      store.setItem('role', role)
      navigate(role === 'admin' ? '/admin/users' : '/menus', { replace: true })
    } catch (err) {
      if (axios.isAxiosError && axios.isAxiosError(err)) {
        const st = err.response?.status
        if (st === 400 || st === 401) setError(t('bad_credentials') || 'بيانات الدخول غير صحيحة.')
        else if (st >= 500) setError(t('server_down') || 'خطأ من الخادم. حاول لاحقًا.')
        else setError(t('network_error') || 'خطأ شبكة. تحقق من الاتصال.')
      } else {
        setError(t('login_error') || 'فشل تسجيل الدخول. تحقق من البيانات.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  // عناصر صغيرة (معدّلة لرفع طبقة التفاعل)
  const Pill = ({ code, onClick }) => (
    <Chip
      label={code}
      onClick={onClick}
      clickable
      component="button"
      size="small"
      sx={{
        borderColor: 'divider',
        bgcolor: 'background.paper',
        fontWeight: 600,
        zIndex: 3,
      }}
    />
  )

  const Bullet = ({ children }) => (
    <Stack direction="row" spacing={1.2} alignItems="center">
      <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'primary.main' }} />
      <Typography variant="body2" sx={{ opacity: 0.9 }}>{children}</Typography>
    </Stack>
  )

  return (
    <Box
      component="main"
      sx={{
        minHeight: '100svh',
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', md: '5fr 7fr' },
        bgcolor: 'background.default',
      }}
    >
      {/* ============ Left column (FORM) ============ */}
      <Box
        sx={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          px: { xs: 2.5, md: 6 },
          py: { xs: 4, md: 6 },
          borderRight: !isRTL ? { md: `1px solid ${theme.palette.divider}` } : undefined,
          borderLeft:  isRTL ? { md: `1px solid ${theme.palette.divider}` } : undefined,
          bgcolor: 'background.default',
          zIndex: 2,
        }}
      >
        <Box sx={{ width: '100%', maxWidth: 420 }}>
          {/* رأس الصفحة: لُغات + شعار */}
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 3 }}>
            {/* ⬇︎ كتلة الشعار + الشارة أسفلها */}
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
              <Stack direction="row" alignItems="center" spacing={1.2}>
                <Avatar
                  variant="rounded"
                  src="/assets/icon.svg"
                  alt="IBLA Dish Logo"
                  sx={{ width: 80, height: 80, borderRadius: 2, bgcolor: 'transparent' }}
                />
                <Box
  component="img"
  src="/assets/logo.svg"
  alt="IBLA DISH"
  sx={{
    height: 80,
    transform: 'translateY(-3px)',
    '@media (min-width:900px)': { transform: 'translateY(-4px)' },
  }}
/>

              </Stack>

              {/* الشارة تحت الشعار */}
<Box sx={{ mt: 0.25, display: 'flex', alignItems: 'center', gap: 1 }}>
  <Box sx={{ width: 28, height: 1, bgcolor: 'divider.main', borderTop: (t) => `1px solid ${t.palette.divider}` }} />

  {/* ⬅︎ اجعل النص رابطًا خارجيًا */}
  <Box
    component="a"
    href="https://www.iblatech.de/"
    target="_blank"
    rel="noopener noreferrer"
    sx={{ textDecoration: 'none' }}
  >
    <Typography
      variant="caption"
      sx={{
        px: 1.2,
        py: 0.35,
        borderRadius: 999,
        bgcolor: 'action.hover',
        color: 'text.secondary',
        fontWeight: 800,
        letterSpacing: 0.3,
        lineHeight: 1,
        userSelect: 'none',
        cursor: 'pointer',
        '&:hover': { bgcolor: 'action.selected' },
      }}
    >
      {t('powered_by') || 'بواسطة ايبلا تيك'}
    </Typography>
  </Box>

  <Box sx={{ width: 28, height: 1, bgcolor: 'divider.main', borderTop: (t) => `1px solid ${t.palette.divider}` }} />
</Box>

            </Box>

            {/* ترتيب اللغات: EN DE AR */}
            <Stack direction="row" spacing={1}>
              <Pill code="EN" onClick={() => changeLang('en')} />
              <Pill code="DE" onClick={() => changeLang('de')} />
              <Pill code="AR" onClick={() => changeLang('ar')} />
            </Stack>
          </Stack>

          <Fade in timeout={700}>
            <Typography variant="h1" fontWeight={800} sx={{ mb: 1.5 }}>
              {t('sign_in') || 'Login'}
            </Typography>
          </Fade>
          <Fade in timeout={800}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              {t('welcome_back') || 'Welcome back! Please sign in to your account'}
            </Typography>
          </Fade>

          <Box component="form" onSubmit={handleLogin} noValidate>
            <Slide direction={isRTL ? 'left' : 'right'} in timeout={900}>
              <TextField
                fullWidth
                required
                margin="normal"
                label={t('email_address') || 'Email or Username'}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoFocus
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start"><MailOutlineIcon /></InputAdornment>
                  ),
                }}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
              />
            </Slide>

            <Slide direction={isRTL ? 'left' : 'right'} in timeout={1000}>
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
                    <InputAdornment position="start"><LockOutlinedIcon /></InputAdornment>
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
            </Slide>

            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mt: 0.5 }}>
              <FormControlLabel
                control={<Checkbox size="small" checked={remember} onChange={(e) => setRemember(e.target.checked)} />}
                label={t('remember_me') || 'Remember me'}
                sx={{ mr: 0 }}
              />
              <Button size="small" variant="text" onClick={() => alert(t('feature_soon') || 'Soon')}>
                {t('forgot_password') || 'Forgot password?'}
              </Button>
            </Stack>

            {!!error && (
              <Box sx={{
                mt: 2, p: 1.2, borderRadius: 1.5,
                bgcolor: theme.palette.error.light, color: theme.palette.error.contrastText,
                border: `1px solid ${theme.palette.error.main}`, fontSize: 14,
              }}>
                {error}
              </Box>
            )}
            {!!token && !error && (
              <Box sx={{
                mt: 2, p: 1.2, borderRadius: 1.5,
                bgcolor: theme.palette.success.light, color: theme.palette.success.contrastText,
                border: `1px solid ${theme.palette.success.main}`, fontSize: 14,
              }}>
                {t('login_success') || 'Logged in successfully.'}
              </Box>
            )}

            <Button
              fullWidth
              type="submit"
              variant="contained"
              disabled={submitting}
              sx={{
                mt: 2.5, py: 1.2, textTransform: 'none', fontWeight: 800, letterSpacing: 0.2,
                borderRadius: 2, boxShadow: 'none',
              }}
            >
              {submitting ? (t('loading') || 'Loading…') : (t('sign_in') || 'Log in')}
            </Button>
          </Box>

          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            {(t('no_account') || "Don't have an account?")}{' '}
            <Link to="/register">{t('sign_up') || 'Register'}</Link>
          </Typography>

          <Stack direction="row" spacing={2} alignItems="center" sx={{ mt: 2 }}>
            <Divider sx={{ flex: 1 }} />
            <Typography variant="caption" color="text.secondary">
              {t('or_continue_with') || 'Or continue with'}
            </Typography>
            <Divider sx={{ flex: 1 }} />
          </Stack>

          <Stack direction="row" spacing={2} sx={{ mt: 2 }}>
            {[GoogleIcon, GitHubIcon, FacebookIcon].map((Icon, idx) => (
              <IconButton
                key={idx}
                size="large"
                sx={{
                  border: '1px solid', borderColor: 'divider', bgcolor: 'background.paper',
                  width: 48, height: 48, borderRadius: '50%', '&:hover': { bgcolor: 'action.hover' },
                }}
                onClick={() => alert(t('feature_soon') || 'Soon')}
              >
                <Icon />
              </IconButton>
            ))}
          </Stack>
        </Box>
      </Box>

      {/* ============ Right column (PROMO DARK) ============ */}
      <Box
        sx={{
          position: 'relative',
          minHeight: { xs: 320, md: '100svh' },
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          px: { xs: 3, md: 4 },
          bgcolor: 'var(--brand-sidebar)',
          overflow: 'hidden',
        }}
      >
        <Box
          sx={{
            pointerEvents: 'none',
            position: 'absolute',
            inset: 0,
            background: `linear-gradient(180deg, transparent, ${alpha(theme.palette.common.black, 0.3)})`,
          }}
        />

        {/* Watermark */}
        <Typography
          aria-hidden
          sx={{
            position: 'absolute',
            inset: 0,
            fontSize: { xs: 200, md: 340 },
            fontWeight: 900,
            letterSpacing: -4,
            color: alpha(theme.palette.common.white, 0.06),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            userSelect: 'none',
            textAlign: 'center',
            px: 2,
            pointerEvents: 'none',
            zIndex: 0,
          }}
        >
          IBLA&nbsp;DISH
        </Typography>

        {/* المحتوى */}
        <Box sx={{ position: 'relative', maxWidth: 640, width: '100%' }}>
          <Fade in timeout={700}>
            <Typography
              variant="h4"
              fontWeight={900}
              align="center"
              sx={{ mb: 1, color: theme.palette.common.white }}
            >
              {t('streamline_ops_title')}
            </Typography>
          </Fade>

          <Fade in timeout={800}>
            <Typography
              variant="body2"
              align="center"
              sx={{ color: alpha(theme.palette.common.white, 0.9), mb: 2 }}
            >
              {t('streamline_ops_desc')}
            </Typography>
          </Fade>

          <Stack spacing={1.2} sx={{ mb: 2, alignItems: 'center', color: alpha(theme.palette.common.white, 0.9) }}>
            <Slide in direction={isRTL ? 'left' : 'right'} timeout={900}>
              <Box><Bullet>{t('feature_realtime')}</Bullet></Box>
            </Slide>
            <Slide in direction={isRTL ? 'left' : 'right'} timeout={1000}>
              <Box><Bullet>{t('feature_menu')}</Bullet></Box>
            </Slide>
            <Slide in direction={isRTL ? 'left' : 'right'} timeout={1100}>
              <Box><Bullet>{t('feature_analytics')}</Bullet></Box>
            </Slide>
          </Stack>

          <Fade in timeout={1200}>
            <Stack
              direction="row"
              spacing={1.2}
              alignItems="center"
              justifyContent="center"
              sx={{ color: alpha(theme.palette.common.white, 0.9) }}
            >
              {[0, 1, 2, 3].map((i) => (
                <Avatar
                  key={i}
                  sx={{ width: 28, height: 28, border: '2px solid', borderColor: 'var(--brand-sidebar)', fontSize: 12, fontWeight: 700 }}
                >
                  {String.fromCharCode(65 + i)}
                </Avatar>
              ))}
              <Typography variant="caption" sx={{ opacity: 0.95 }}>
                {t('trusted_by') || 'Trusted by 500+ restaurants'}
              </Typography>
              <Stack direction="row" spacing={0.25} alignItems="center">
                {[...Array(5)].map((_, i) => (
                  <StarRoundedIcon key={i} fontSize="small" sx={{ color: 'primary.main' }} />
                ))}
              </Stack>
              <Typography variant="caption" sx={{ opacity: 0.95 }}>
                4.8/5
              </Typography>
            </Stack>
          </Fade>
        </Box>
      </Box>
    </Box>
  )
}
