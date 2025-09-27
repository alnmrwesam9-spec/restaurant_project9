import React from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  Box,
  MenuItem,
  Select,
} from '@mui/material';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import HomeIcon from '@mui/icons-material/Home';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

const AdminNavbar = ({ onLogout }) => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();

  const handleChangeLanguage = (e) => {
    const selectedLang = e.target.value;
    i18n.changeLanguage(selectedLang);
    document.dir = selectedLang === 'ar' ? 'rtl' : 'ltr';
  };

  const handleGoBack = () => {
    navigate(-1); // رجوع للخلف
  };

  const handleGoHome = () => {
    navigate('/admin/users'); // رابط لوحة التحكم
  };

  return (
    <AppBar position="static" color="secondary" sx={{ mb: 4 }}>
      <Toolbar
        sx={{
          justifyContent: 'space-between',
          direction: i18n.language === 'ar' ? 'rtl' : 'ltr',
        }}
      >
        {/* اليمين: عنوان لوحة التحكم + أزرار التنقل */}
        <Box display="flex" alignItems="center" gap={2}>
          <AdminPanelSettingsIcon />
          <Typography variant="h6" component="div">
            {t('admin_dashboard')}
          </Typography>
          <Button
            color="inherit"
            onClick={handleGoBack}
            sx={{ textTransform: 'none', gap: 1 }}
          >
            <ArrowBackIcon />
            {t('back')}
          </Button>
          <Button
            color="inherit"
            onClick={handleGoHome}
            sx={{ textTransform: 'none', gap: 1 }}
          >
            <HomeIcon />
            {t('home')}
          </Button>
        </Box>

        {/* اليسار: اختيار اللغة وزر تسجيل الخروج */}
        <Box display="flex" alignItems="center" gap={2}>
          <Select
            value={i18n.language}
            onChange={handleChangeLanguage}
            size="small"
            sx={{
              color: 'white',
              borderColor: 'white',
              backgroundColor: 'rgba(0, 0, 0, 1)',
              '& .MuiSvgIcon-root': { color: 'white' },
            }}
          >
            <MenuItem value="ar">{t('arabic')}</MenuItem>
            <MenuItem value="en">{t('english')}</MenuItem>
            <MenuItem value="de">{t('german')}</MenuItem>
          </Select>

          <Button color="inherit" onClick={onLogout}>
            {t('logout')}
          </Button>
        </Box>
      </Toolbar>
    </AppBar>
  );
};

export default AdminNavbar;
