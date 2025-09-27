import React, { useEffect, useState } from 'react';
import api from '../services/axios';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Typography,
  Card,
  CardContent,
  Button,
  Stack,
  Alert,
  Box,
  TextField,
  MenuItem,
  Tooltip,
  Avatar,
  Chip,
  Divider,
  InputAdornment,
  Paper,
  ThemeProvider,
  createTheme,
  Switch,
} from '@mui/material';
import PersonIcon from '@mui/icons-material/Person';
import ListIcon from '@mui/icons-material/List';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import InfoIcon from '@mui/icons-material/Info';
import SearchIcon from '@mui/icons-material/Search';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import { useTranslation } from 'react-i18next';

/* ألوان IBLA */
const COLORS = {
  primary: '#2bbdbe',
  primary2:'#2bd9c1',  // للتدرّج
  danger:  '#ee3029',
  warn:    '#000000ff',
  success: '#28a745',
  text:    '#1f2937',
  border:  '#e5e7eb',
  bg:      '#f1f5f9',
  chipBg:  '#eef9f9',
};

/* سويتش Aqua (تدرّج + وهج) */
/* سويتش Aqua مضبوط (لا يطلع برا ويمشي للنهاية) */
const AquaSwitch = (props) => (
  <Switch
    disableRipple
    focusVisibleClassName=".Mui-focusVisible"
    {...props}
    sx={{
      width: 45,
      height: 23,
      padding: 0,
      '& .MuiSwitch-switchBase': {
        padding: 0,
        margin: 0,
        transitionDuration: '700ms',
        '&.Mui-checked': {
          transform: 'translateX(22px)', // 48 - 4 - 22 = 22
          color: '#fff',
          '& + .MuiSwitch-track': {
            background: `linear-gradient(90deg, ${COLORS.primary2} 0%, ${COLORS.primary} 100%)`,
            opacity: 1,
            border: 0,
          },
        },
      },
      '& .MuiSwitch-thumb': {
        width: 22,
        height: 22,
        boxSizing: 'border-box',
        backgroundColor: '#fff',
        // ظل خفيف بدون حلقة خارجية (حتى ما يطلع برّا التراك)
      },
      '& .MuiSwitch-track': {
        borderRadius: 26 / 2,
        backgroundColor: '#e9eef5',
        opacity: 1,
        transition: 'all .2s ease',
      },
    }}
  />
);


/* زرّ Pill خفيف */
const PillButton = (props) => (
  <Button
    variant="outlined"
    size="small"
    {...props}
    sx={{
      borderRadius: 1,
      px: 1.6,
      py: 0.5,
      borderColor: COLORS.border,
      color: COLORS.text,
      textTransform: 'none',
      boxShadow: 'none',
      display: 'inline-flex',
      alignItems: 'center',
      columnGap: '8px',                 // ✅ مسافة مضمونة بين الأيقونة والنص
      '&:hover': { borderColor: COLORS.primary, backgroundColor: COLORS.chipBg },

      // ✅ اضبط هوامش الأيقونة بما يناسب RTL/LTR
      '& .MuiButton-startIcon': {
        margin: 0,
        marginInlineStart: '8px',       // يعمل RTL/LTR
        marginInlineEnd: 0,
      },
      '& .MuiButton-endIcon': {
        margin: 0,
        marginInlineEnd: '8px',
        marginInlineStart: 0,
      },

      // ✅ حجم أيقونة لطيف ومتناسق
      '& .MuiSvgIcon-root': { fontSize: 18 },

      ...props.sx,
    }}
  />
);
/* ثيم (زوايا خفيفة جدًا) */
const theme = createTheme({
  direction: 'rtl',
  palette: {
    primary: { main: COLORS.primary },
    success: { main: COLORS.success },
    warning: { main: COLORS.warn },
    error:   { main: COLORS.danger },
    background: { default: COLORS.bg, paper: '#fff' },
  },
  typography: { fontFamily: 'inherit' },
  shape: { borderRadius: 7 }, // زوايا ناعمة
  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          border: `1px solid ${COLORS.border}`,
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          borderRadius: 8,
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { borderRadius: 12, fontWeight: 600 },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: { borderRadius: 10, textTransform: 'none' },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: { '& .MuiOutlinedInput-root': { borderRadius: 8 } },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: { borderRadius: 8 },
      },
    },
  },
});

const AdminUsersPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [error, setError] = useState('');

  useEffect(() => {
    const ctrl = new AbortController();
    const fetchUsers = async () => {
      try {
        const res = await api.get('/users/', { signal: ctrl.signal });
        setUsers(Array.isArray(res.data) ? res.data : []);
        setError('');
      } catch (err) {
        if (err?.name === 'CanceledError' || err?.name === 'AbortError') return;
        setError(t('load_users_failed') || 'Failed to load users.');
      }
    };
    fetchUsers();
    return () => ctrl.abort();
  }, [t]);

  useEffect(() => {
    let list = Array.isArray(users) ? [...users] : [];
    const q = searchTerm.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (u) =>
          u?.username?.toLowerCase().includes(q) ||
          u?.email?.toLowerCase().includes(q)
      );
    }
    if (roleFilter !== 'all') {
      const rf = roleFilter.toLowerCase();
      list = list.filter((u) => {
        const role = (u?.role || '').toLowerCase();
        const isAdmin =
          u?.is_staff === true || u?.is_superuser === true || role === 'admin';
        if (rf === 'admin') return isAdmin;
        return role === rf;
      });
    }
    setFilteredUsers(list);
  }, [users, searchTerm, roleFilter]);

  const handleToggleActive = async (userId, isActive) => {
    const user = users.find((u) => u.id === userId);
    if (user?.username === 'admin') {
      setError(t('cannot_deactivate_admin') || 'Cannot deactivate built-in admin.');
      return;
    }
    try {
      await api.patch(`/users/${userId}/`, { is_active: !isActive });
      const res = await api.get('/users/');
      setUsers(Array.isArray(res.data) ? res.data : []);
      setError('');
    } catch {
      setError(t('error_updating_status') || 'Error updating status.');
    }
  };

  const handleUserMenusClick = (id) => navigate(`/admin/users/${id}/menus`);
  const handleUserDetailsClick = (id) => navigate(`/admin/users/${id}/details`);
  const handleEditUser = (id) => navigate(`/admin/users/${id}/edit`);

  return (
    <ThemeProvider theme={theme}>
      <Container maxWidth="lg" sx={{ mt: 6, pb: 6, direction: 'rtl' }}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2, mb: 2 }}>
          <Typography variant="h4" fontWeight={800} color={COLORS.text}>
            {t('manage_users') || 'إدارة المستخدمين'}
          </Typography>
          <Avatar sx={{ bgcolor: COLORS.primary, width: 40, height: 40 }}>
            <PersonIcon sx={{ color: '#fff' }} />
          </Avatar>
        </Box>
        <Typography
          variant="body2"
          color="text.secondary"
          textAlign="center"
          sx={{ mb: 3 }}
        >
          {t('manage_users_sub') || 'تحكم بالوصول، مكّن فريقك، واحفظ كل شيء متزامناً.'}
        </Typography>

        {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

        {/* Filters */}
        <Paper
          elevation={0}
          sx={{
            p: 1.5,
            mb: 3,
            border: `1px solid ${COLORS.border}`,
            bgcolor: '#fff',
          }}
        >
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1.5}
            alignItems={{ xs: 'stretch', sm: 'center' }}
          >
            <TextField
              select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              sx={{ width: { xs: '100%', sm: 160 } }}
            >
              <MenuItem value="all">{t('all') || 'الكل'}</MenuItem>
              <MenuItem value="admin">{t('admin') || 'مسؤول'}</MenuItem>
              <MenuItem value="Owner">{t('user') || 'مستخدم'}</MenuItem>
            </TextField>

            <TextField
              fullWidth
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={t('search_by_name_or_email') || 'ابحث بالاسم أو البريد الإلكتروني'}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
              }}
            />
          </Stack>
        </Paper>

        {/* Users list */}
        <Stack spacing={1.5}>
          {filteredUsers.map((user) => {
            const isAdmin =
              user?.username === 'admin' ||
              user?.is_staff === true ||
              user?.is_superuser === true ||
              (user?.role || '').toLowerCase() === 'admin';

            return (
              <Card key={user.id} sx={{ bgcolor: '#fff' }}>
                <CardContent sx={{ p: 2 }}>
                  <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2}>
                    {/* Left */}
                    <Stack spacing={0.5}>
                      <Typography variant="h6" fontWeight={800} color={COLORS.text}>
                        {user.username}
                      </Typography>

                      <Typography variant="body2" color="text.secondary">
                        {user.email || '—'}
                      </Typography>

                      <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5 }}>
                        <Chip
                          label={(t('role') || 'الدور') + ': ' + (t(user.role) || user.role || (isAdmin ? (t('admin') || 'مسؤول') : (t('user') || 'مستخدم')))}
                          size="small"
                          sx={{
                            borderRadius: 12,
                            bgcolor: COLORS.chipBg,
                            color: COLORS.text,
                            fontWeight: 700,
                          }}
                        />
                        <Chip
                          label={user.is_active ? (t('active') || 'نشط') : (t('inactive') || 'غير نشط')}
                          size="small"
                          sx={{
                            borderRadius: 12,
                            bgcolor: user.is_active ? COLORS.success : COLORS.danger,
                            color: '#fff',
                            fontWeight: 800,
                          }}
                        />
                      </Stack>
                    </Stack>

                    {/* Right controls */}
                    <Stack direction="row" alignItems="center" spacing={1.2}>
                      {isAdmin ? (
                        // ✅ تظهر شارة "محمي" مرة واحدة فقط هنا
                       <Chip
  label={
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      {t('protected') || 'محمي'}
      <LockOutlinedIcon sx={{ fontSize: 16 }} />
    </Box>
  }
  size="small"
  sx={{
    borderRadius: 12,
    bgcolor: COLORS.warn,
    color: '#fff',
    fontWeight: 1000,
    px: 1,
    '& .MuiChip-label': { display: 'flex', alignItems: 'center', px: 0 },
  }}
/>

                      ) : (
                        <Tooltip title={t('toggle_activation') || 'تفعيل/تعطيل'}>
                          <Box>
                            <AquaSwitch
                              checked={!!user.is_active}
                              onChange={() => handleToggleActive(user.id, user.is_active)}
                            />
                          </Box>
                        </Tooltip>
                      )}
                    </Stack>
                  </Stack>

                  <Divider sx={{ my: 1.25 }} />

                  {/* Actions */}
                  <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                    <PillButton startIcon={<InfoIcon />} onClick={() => handleEditUser(user.id)}>
                      {t('full_details') || 'تفاصيل'}
                    </PillButton>
                    <PillButton startIcon={<MenuBookIcon />} onClick={() => handleUserMenusClick(user.id)}>
                      {t('view_menus') || 'القوائم'}
                    </PillButton>
                    <PillButton startIcon={<ListIcon />} onClick={() => handleUserDetailsClick(user.id)}>
                      {t('view_data') || 'البيانات'}
                    </PillButton>
                  </Stack>
                </CardContent>
              </Card>
            );
          })}
        </Stack>
      </Container>
    </ThemeProvider>
  );
};

export default AdminUsersPage;
