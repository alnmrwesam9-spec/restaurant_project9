// src/pages/AdminUsersPage.jsx
import React, { useEffect, useMemo, useState } from 'react';
import api from '../services/axios';
import { useNavigate } from 'react-router-dom';
import {
  Container, Typography, Card, CardContent, Button, Stack, Alert, Box,
  TextField, MenuItem, Tooltip, Avatar, Chip, Divider, InputAdornment, Paper,
  Switch, Dialog, DialogTitle, DialogContent, DialogActions, CircularProgress,
  IconButton,
} from '@mui/material';
import PersonIcon from '@mui/icons-material/Person';
import ListIcon from '@mui/icons-material/List';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import InfoIcon from '@mui/icons-material/Info';
import SearchIcon from '@mui/icons-material/Search';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import LinkIcon from '@mui/icons-material/Link';
import { useTranslation } from 'react-i18next';
import { alpha, useTheme } from '@mui/material/styles';

const PillButton = (props) => {
  const theme = useTheme();
  return (
    <Button
      variant="outlined"
      size="small"
      {...props}
      sx={{
        borderRadius: 2,
        px: 1.6,
        py: 0.5,
        borderColor: 'divider',
        color: 'text.primary',
        textTransform: 'none',
        boxShadow: 'none',
        display: 'inline-flex',
        alignItems: 'center',
        columnGap: '8px',
        '&:hover': { borderColor: theme.palette.primary.main, backgroundColor: alpha(theme.palette.primary.main, 0.06) },
        '& .MuiSvgIcon-root': { fontSize: 18 },
        ...props.sx,
      }}
    />
  );
};

const AdminUsersPage = () => {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const navigate = useNavigate();

  const [users, setUsers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [error, setError] = useState('');

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const ctrl = new AbortController();
    (async () => {
      try {
        const res = await api.get('/users/', { signal: ctrl.signal });
        setUsers(Array.isArray(res.data) ? res.data : []);
        setError('');
      } catch (err) {
        if (err?.name === 'CanceledError' || err?.name === 'AbortError') return;
        if (err?.response?.status === 403) setError(t('forbidden') || 'لا تملك صلاحية عرض المستخدمين.');
        else setError(t('load_users_failed') || 'فشل في تحميل المستخدمين.');
      }
    })();
    return () => ctrl.abort();
  }, [t]);

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
          u?.username === 'admin' || u?.is_staff === true || u?.is_superuser === true || role === 'admin';
        if (rf === 'admin') return isAdmin;
        return role === rf;
      });
    }

    return list;
  }, [users, searchTerm, roleFilter]);

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

  const handleUserMenusClick = (id) => navigate(`/admin/users/${id}/menus`);
  const handleUserDetailsClick = (id) => navigate(`/admin/users/${id}/details`);
  const handleEditUser = (id) => navigate(`/admin/users/${id}/edit`);

  const openDeleteDialog = (user) => setDeleteTarget(user);
  const closeDeleteDialog = () => { if (!deleting) setDeleteTarget(null); };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setError('');
    try {
      await api.delete(`/users/${deleteTarget.id}/`);
      setUsers((prev) => prev.filter((u) => u.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err) {
      const msg = err?.response?.data?.detail || err?.response?.data?.error || (t('delete_user_failed') || 'تعذّر حذف المستخدم.');
      setError(msg);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 6, pb: 6, direction: i18n.dir() }}>
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: { xs: 'stretch', sm: 'center' },
          justifyContent: 'space-between',
          gap: 2,
          mb: 2,
          flexDirection: { xs: 'column', sm: 'row' },
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography variant="h4" fontWeight={800} color="text.primary">
            {t('manage_users') || 'إدارة المستخدمين'}
          </Typography>
          <Avatar sx={{ bgcolor: 'primary.main', width: 40, height: 40, color: 'primary.contrastText' }}>
            <PersonIcon />
          </Avatar>
        </Box>

        <Tooltip title={t('go_allergens') || 'الانتقال إلى إدارة أكواد الحساسية'}>
          <Button
            variant="contained"
            color="primary"
            startIcon={<LinkIcon />}
            onClick={() => navigate('/admin/allergens')}
            sx={{ alignSelf: { xs: 'stretch', sm: 'center' }, fontWeight: 700, borderRadius: 2, boxShadow: 'none' }}
          >
            {t('allergen_codes') || 'أكواد الحساسية'}
          </Button>
        </Tooltip>
      </Box>

      <Typography variant="body2" color="text.secondary" textAlign="center" sx={{ mb: 3 }}>
        {t('manage_users_sub') || 'تحكم بالوصول، مكّن فريقك، واحفظ كل شيء متزامناً.'}
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

      {/* Filters */}
      <Paper
        elevation={0}
        sx={{
          p: 1.5,
          mb: 3,
          border: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper',
          borderRadius: 3,
        }}
      >
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ xs: 'stretch', sm: 'center' }}>
          <TextField
            select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            sx={{ width: { xs: '100%', sm: 160 } }}
          >
            <MenuItem value="all">{t('all') || 'الكل'}</MenuItem>
            <MenuItem value="admin">{t('admin') || 'مسؤول'}</MenuItem>
            {/* ملاحظة: نُبقي الاسم كما كان (Owner) ليتطابق مع بيانات الخادم */}
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
            <Card key={user.id} variant="outlined" sx={{ bgcolor: 'background.paper', borderColor: 'divider', borderRadius: 3 }}>
              <CardContent sx={{ p: 2 }}>
                <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2}>
                  {/* Left */}
                  <Stack spacing={0.5}>
                    <Typography variant="h6" fontWeight={800} color="text.primary">
                      {user.username}
                    </Typography>

                    <Typography variant="body2" color="text.secondary">
                      {user.email || '—'}
                    </Typography>

                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5 }}>
                      <Chip
                        size="small"
                        label={`${t('role') || 'الدور'}: ${t(user.role) || user.role || (isAdmin ? (t('admin') || 'مسؤول') : (t('user') || 'مستخدم'))}`}
                        sx={{
                          borderRadius: 12,
                          bgcolor: alpha(theme.palette.primary.main, 0.06),
                          color: 'text.primary',
                          fontWeight: 700,
                          border: '1px solid',
                          borderColor: alpha(theme.palette.primary.main, 0.18),
                        }}
                      />
                      <Chip
                        size="small"
                        label={user.is_active ? (t('active') || 'نشط') : (t('inactive') || 'غير نشط')}
                        color={user.is_active ? 'success' : 'error'}
                        variant="filled"
                        sx={{ borderRadius: 12, fontWeight: 800 }}
                      />
                    </Stack>
                  </Stack>

                  {/* Right controls */}
                  <Stack direction="row" alignItems="center" spacing={1.2}>
                    {isAdmin ? (
                      <Chip
                        label={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            {t('protected') || 'محمي'} <LockOutlinedIcon sx={{ fontSize: 16 }} />
                          </Box>
                        }
                        size="small"
                        sx={{
                          borderRadius: 12,
                          bgcolor: 'warning.main',
                          color: theme.palette.getContrastText(theme.palette.warning.main),
                          fontWeight: 1000,
                          px: 1,
                          '& .MuiChip-label': { display: 'flex', alignItems: 'center', px: 0 },
                        }}
                      />
                    ) : (
                      <Tooltip title={t('toggle_activation') || 'تفعيل/تعطيل'}>
                        <Box>
                          <Switch
                            checked={!!user.is_active}
                            onChange={() => handleToggleActive(user.id, user.is_active)}
                            sx={{
                              '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                                backgroundColor: theme.palette.primary.main,
                                opacity: 1,
                              },
                              '& .MuiSwitch-track': {
                                backgroundColor: 'divider',
                              },
                            }}
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

                  <Tooltip
                    title={
                      isAdmin ? (t('cannot_delete_admin') || 'لا يمكن حذف حساب المشرف.') : (t('delete') || 'حذف')
                    }
                  >
                    <span>
                      <PillButton
                        startIcon={<DeleteOutlineIcon />}
                        onClick={() => setDeleteTarget(user)}
                        disabled={isAdmin || deleting}
                        sx={{
                          borderColor: alpha(theme.palette.error.main, 0.5),
                          color: 'error.main',
                          '&:hover': {
                            borderColor: 'error.main',
                            backgroundColor: alpha(theme.palette.error.main, 0.06),
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

      {/* Delete confirm dialog */}
      <Dialog open={!!deleteTarget} onClose={closeDeleteDialog} PaperProps={{ sx: { borderRadius: 3 } }}>
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
            sx={{ borderRadius: 2 }}
          >
            {t('delete') || 'حذف'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default AdminUsersPage;
