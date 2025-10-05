// frontend/src/pages/AdminUsersPage.jsx
import React, { useEffect, useMemo, useState } from 'react';
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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
} from '@mui/material';
import PersonIcon from '@mui/icons-material/Person';
import ListIcon from '@mui/icons-material/List';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import InfoIcon from '@mui/icons-material/Info';
import SearchIcon from '@mui/icons-material/Search';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { useTranslation } from 'react-i18next';

/* ألوان IBLA (كما في الواجهة القديمة) */
const COLORS = {
  primary: '#2bbdbe',
  primary2: '#2bd9c1', // للتدرّج
  danger: '#ee3029',
  warn: '#000000ff',
  success: '#28a745',
  text: '#1f2937',
  border: '#e5e7eb',
  bg: '#f1f5f9',
  chipBg: '#eef9f9',
};

/* سويتش Aqua (تدرّج + وهج) — بدون أي تغيير بصري */
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
          transform: 'translateX(22px)',
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

/* زرّ Pill خفيف — كما هو */
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
      columnGap: '8px',
      '&:hover': { borderColor: COLORS.primary, backgroundColor: COLORS.chipBg },
      '& .MuiButton-startIcon': {
        margin: 0,
        marginInlineStart: '8px',
        marginInlineEnd: 0,
      },
      '& .MuiButton-endIcon': {
        margin: 0,
        marginInlineEnd: '8px',
        marginInlineStart: 0,
      },
      '& .MuiSvgIcon-root': { fontSize: 18 },
      ...props.sx,
    }}
  />
);

/* الثيم كما في النسخة القديمة */
const theme = createTheme({
  direction: 'rtl',
  palette: {
    primary: { main: COLORS.primary },
    success: { main: COLORS.success },
    warning: { main: COLORS.warn },
    error: { main: COLORS.danger },
    background: { default: COLORS.bg, paper: '#fff' },
  },
  typography: { fontFamily: 'inherit' },
  shape: { borderRadius: 7 },
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
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [error, setError] = useState('');

  // حالات الحذف (جديدة) — لا تغيّر المظهر العام
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  /* التحميل الأولي */
  useEffect(() => {
    const ctrl = new AbortController();
    const fetchUsers = async () => {
      try {
        const res = await api.get('/users/', { signal: ctrl.signal });
        setUsers(Array.isArray(res.data) ? res.data : []);
        setError('');
      } catch (err) {
        if (err?.name === 'CanceledError' || err?.name === 'AbortError') return;
        if (err?.response?.status === 403) {
          setError(t('forbidden') || 'لا تملك صلاحية عرض المستخدمين.');
        } else {
          setError(t('load_users_failed') || 'فشل في تحميل المستخدمين.');
        }
      }
    };
    fetchUsers();
    return () => ctrl.abort();
  }, [t]);

  /* فلترة وبحث أسرع بـ useMemo — بدون أي تغيير بصري */
  const filteredUsers = useMemo(() => {
    let list = Array.isArray(users) ? [...users] : [];
    const q = (searchTerm || '').trim().toLowerCase();

    if (q) {
      list = list.filter((u) =>
        [u?.username, u?.email, u?.first_name, u?.last_name]
          .filter(Boolean)
          .some((x) => String(x).toLowerCase().includes(q))
      );
    }

    if (roleFilter !== 'all') {
      const rf = String(roleFilter || '').toLowerCase();
      list = list.filter((u) => {
        const role = String(u?.role || '').toLowerCase();
        const isAdmin =
          u?.username === 'admin' ||
          u?.is_staff === true ||
          u?.is_superuser === true ||
          role === 'admin';
        if (rf === 'admin') return isAdmin;
        return role === rf;
      });
    }

    return list;
  }, [users, searchTerm, roleFilter]);

  /* تفعيل/تعطيل — تحديث متفائل مع حماية admin كما في القديم */
  const handleToggleActive = async (userId, isActive) => {
    const user = users.find((u) => u.id === userId);
    if (user?.username === 'admin') {
      setError(t('cannot_deactivate_admin') || 'لا يمكن تعطيل حساب المشرف المدمج.');
      return;
    }
    try {
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, is_active: !isActive } : u)));
      await api.patch(`/users/${userId}/`, { is_active: !isActive });
      setError('');
    } catch {
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, is_active: isActive } : u)));
      setError(t('error_updating_status') || 'حدث خطأ عند تحديث الحالة.');
    }
  };

  /* مسارات قديمة للحفاظ على السلوك */
  const handleUserMenusClick = (id) => navigate(`/admin/users/${id}/menus`);
  const handleUserDetailsClick = (id) => navigate(`/admin/users/${id}/details`);
  const handleEditUser = (id) => navigate(`/admin/users/${id}/edit`);

  /* فتح/إغلاق مربع حوار الحذف */
  const openDeleteDialog = (user) => setDeleteTarget(user);
  const closeDeleteDialog = () => {
    if (!deleting) setDeleteTarget(null);
  };

  /* تأكيد الحذف */
  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setError('');
    try {
      await api.delete(`/users/${deleteTarget.id}/`);
      setUsers((prev) => prev.filter((u) => u.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err) {
      const msg =
        err?.response?.data?.detail ||
        err?.response?.data?.error ||
        (t('delete_user_failed') || 'تعذّر حذف المستخدم.');
      setError(msg);
    } finally {
      setDeleting(false);
    }
  };

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
                          label={
                            (t('role') || 'الدور') +
                            ': ' +
                            (t(user.role) ||
                              user.role ||
                              (isAdmin ? (t('admin') || 'مسؤول') : (t('user') || 'مستخدم')))
                          }
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

                  {/* Actions — كما في الواجهة القديمة + زر حذف جديد بنفس الأسلوب */}
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

                    {/* زر الحذف — يحافظ على شكل PillButton ويستخدم لون الخطر */}
                    <Tooltip
                      title={
                        isAdmin
                          ? (t('cannot_delete_admin') || 'لا يمكن حذف حساب المشرف.')
                          : (t('delete') || 'حذف')
                      }
                    >
                      <span>
                        <PillButton
                          startIcon={<DeleteOutlineIcon />}
                          onClick={() => openDeleteDialog(user)}
                          disabled={isAdmin || deleting}
                          sx={{
                            borderColor: COLORS.danger,
                            color: COLORS.danger,
                            '&:hover': {
                              borderColor: COLORS.danger,
                              backgroundColor: 'rgba(238, 48, 41, 0.06)',
                            },
                          }}
                        >
                          {t('delete') || 'حذف'}
                        </PillButton>
                      </span>
                    </Tooltip>
                  </Stack>
                </CardContent>
              </Card>
            );
          })}
        </Stack>

        {/* Dialog تأكيد حذف — بدون تغيير بصري عام */}
        <Dialog open={!!deleteTarget} onClose={closeDeleteDialog}>
          <DialogTitle>{t('confirm_delete_title') || 'تأكيد حذف المستخدم'}</DialogTitle>
          <DialogContent>
            <Typography variant="body2">
              {t('confirm_delete_msg') || 'هل أنت متأكد أنك تريد حذف هذا المستخدم؟ لا يمكن التراجع عن هذه العملية.'}
            </Typography>
            {deleteTarget ? (
              <Box mt={1}>
                <Chip label={deleteTarget.username} />
              </Box>
            ) : null}
          </DialogContent>
          <DialogActions>
            <Button onClick={closeDeleteDialog} disabled={deleting}>
              {t('cancel') || 'إلغاء'}
            </Button>
            <Button
              onClick={confirmDelete}
              color="error"
              variant="contained"
              startIcon={deleting ? <CircularProgress size={16} /> : <DeleteOutlineIcon />}
              disabled={deleting}
            >
              {t('delete') || 'حذف'}
            </Button>
          </DialogActions>
        </Dialog>
      </Container>
    </ThemeProvider>
  );
};

export default AdminUsersPage;
