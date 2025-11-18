import React from 'react';
import {
  AppBar, Toolbar, Typography, Button, Box, MenuItem, Select
} from '@mui/material';
import useMediaQuery from '@mui/material/useMediaQuery';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

const AdminNavbar = ({ onLogout }) => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const hideLangSwitcher = useMediaQuery('(max-width:768px)');

  const handleChangeLanguage = (e) => {
    const selectedLang = e.target.value;
    i18n.changeLanguage(selectedLang);
    document.dir = selectedLang === 'ar' ? 'rtl' : 'ltr';
  };

  return (
    <AppBar
      position="static"
      color="primary"
      sx={{
        mb: 4,
        backgroundColor: 'var(--brand)', // برتقالي IBLA DISH
        color: 'var(--brand-contrast)',
      }}
    >
      <Toolbar
        sx={{
          justifyContent: 'space-between',
          direction: i18n.language === 'ar' ? 'rtl' : 'ltr',
        }}
      >
        {/* اليمين */}
        <Box display="flex" alignItems="center" gap={2} sx={{ '@media (max-width:640px)': { gap: 1 } }}>
          <AdminPanelSettingsIcon />
          <Typography
            variant="h6"
            fontWeight={700}
            onClick={() => navigate('/admin')}
            sx={{ cursor: 'pointer' }}
          >
            {t('admin_dashboard')}
          </Typography>

          <Button
            color="inherit"
            onClick={() => navigate(-1)}
            sx={{
              textTransform: 'none',
              gap: 1,
              px: 1.25,
              '@media (max-width:640px)': {
                px: 0.75,
                minWidth: 'unset',
                fontSize: '0.9rem',
                gap: 0.75,
              },
              '&:hover': { backgroundColor: 'rgba(255,255,255,0.15)' },
            }}
          >
            <ArrowBackIcon />
            {t('back')}
          </Button>
        </Box>

        {/* اليسار */}
        <Box display="flex" alignItems="center" gap={2} sx={{ '@media (max-width:640px)': { gap: 1 } }}>
          {!hideLangSwitcher && (
            <Select
              value={i18n.language}
              onChange={handleChangeLanguage}
              size="small"
              sx={{
                minWidth: 90,
                color: 'var(--brand-contrast)',
                '& .MuiSvgIcon-root': { color: 'var(--brand-contrast)' },
                '& .MuiOutlinedInput-notchedOutline': { borderColor: 'transparent' },
                '@media (max-width:768px)': { display: 'none' },
              }}
            >
              <MenuItem value="ar">{t('arabic')}</MenuItem>
              <MenuItem value="en">{t('english')}</MenuItem>
              <MenuItem value="de">{t('german')}</MenuItem>
            </Select>
          )}

          <Button
            onClick={onLogout}
            variant="outlined"
            sx={{
              color: 'var(--brand-contrast)',
              borderColor: 'var(--brand-contrast)',
              textTransform: 'none',
              px: 1.5,
              '@media (max-width:640px)': {
                px: 0.9,
                minWidth: 'unset',
                fontSize: '0.9rem',
              },
              '&:hover': {
                backgroundColor: 'rgba(255,255,255,0.15)',
                borderColor: 'var(--brand-contrast)',
              },
            }}
          >
            {t('logout')}
          </Button>
        </Box>
      </Toolbar>
    </AppBar>
  );
};
export default AdminNavbar;
