// src/components/UserNavbar.jsx
import React, { useEffect, useMemo, useState } from 'react';
import {
  AppBar, Toolbar, Typography, Button, Box, Select, MenuItem, Avatar
} from '@mui/material';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
// ⬇️ حُذفت: HomeIcon, ArrowBackIcon
import LogoutIcon from '@mui/icons-material/Logout';
import { Link } from 'react-router-dom'; // ⬅️ نستخدم Link بدل أزرار الوسط
import { useTranslation } from 'react-i18next';
import i18n from '../i18n';
import { SIDEBAR_WIDTH, RAIL_WIDTH } from './AppSidebar';

export const APPBAR_H_XS = 64;
export const APPBAR_H_SM = 72;

const UserNavbar = ({ onLogout }) => {
  const { t } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const theme = useTheme();
  const mdUp = useMediaQuery(theme.breakpoints.up('md'));
  // Hide header language switcher on small screens (max-width: 768px)
  const hideLangSwitcher = useMediaQuery('(max-width:768px)');

  const [collapsed, setCollapsed] = useState(() =>
    JSON.parse(localStorage.getItem('sidebar_collapsed') ?? 'false')
  );

  useEffect(() => {
    const sync = () =>
      setCollapsed(JSON.parse(localStorage.getItem('sidebar_collapsed') ?? 'false'));
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);

  const sideGap = useMemo(
    () => (mdUp ? (collapsed ? RAIL_WIDTH : SIDEBAR_WIDTH) : 0),
    [collapsed, mdUp]
  );

  const BRAND_H = 60;
  const BRAND_W = 65;
  const ICON_SRC = '/assets/icon.svg';
  const LOGO_SRC = '/assets/logo.svg';

  const [logoError, setLogoError] = useState(false);

  return (
    <AppBar
      position="sticky"
      elevation={0}
      sx={{
        top: 0,
        zIndex: (t) => t.zIndex.drawer + 1,
        width: { xs: '100%', md: `calc(100% - ${sideGap}px)` },
        ...(isRTL ? { mr: { md: `${sideGap}px` } } : { ml: { md: `${sideGap}px` } }),
        bgcolor: 'background.paper',
        borderBottom: '1px solid',
        borderColor: 'divider',
      }}
    >
      <Toolbar
        sx={{
          minHeight: { xs: APPBAR_H_XS, sm: APPBAR_H_SM },
          px: { xs: 1, sm: 2 },
          py: 0.5,
          justifyContent: 'space-between',
          direction: isRTL ? 'rtl' : 'ltr',
        }}
      >
        {/* يسار: الشعار — قابل للنقر للعودة للصفحة الرئيسية */}
        <Box
          component={Link}
          to="/menus"
          aria-label={t('home') || 'Home'}
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            textDecoration: 'none',
            color: 'inherit',
            cursor: 'pointer',
          }}
        >
          <Avatar
            variant="rounded"
            src={ICON_SRC}
            alt="IBLA Dish Icon"
            sx={{
              width: BRAND_H,
              height: BRAND_H,
              borderRadius: 2,
              bgcolor: 'transparent',
              lineHeight: 1,
            }}
            imgProps={{ style: { display: 'block' } }}
          />
          {!logoError ? (
            <Box
              component="img"
              src={LOGO_SRC}
              alt="IBLA Dish Logo"
              onError={() => setLogoError(true)}
              sx={{
                height: BRAND_W,
                display: 'block',
                lineHeight: 0,
                transform: 'translateY(-3px)',
              }}
            />
          ) : (
            <Typography sx={{ fontWeight: 900, letterSpacing: 0.2 }}>IBLA DISH</Typography>
          )}
        </Box>

        {/* ⛔️ تمت إزالة كبسولات (الصفحة الرئيسية / رجوع) لأنها لم تعد مطلوبة */}

        {/* يمين: لغة + خروج */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
          {!hideLangSwitcher && (
            <Select
              value={i18n.language}
              onChange={(e) => {
                const lng = e.target.value;
                i18n.changeLanguage(lng);
                document.dir = lng === 'ar' ? 'rtl' : 'ltr';
              }}
              size="small"
              variant="standard"
              disableUnderline
              sx={{
                fontSize: 14,
                color: 'text.primary',
                '& .MuiSelect-icon': { color: 'text.secondary' },
                // Extra safety: hide using CSS as well
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
            size="small"
            variant="outlined"
            startIcon={<LogoutIcon />}
            sx={{
              textTransform: 'none',
              fontWeight: 700,
              color: 'primary.main',
              borderColor: 'primary.main',
              '&:hover': { bgcolor: 'primary.main', color: 'primary.contrastText' },
              borderRadius: 2,
            }}
          >
            {t('logout')}
          </Button>
        </Box>
      </Toolbar>
    </AppBar>
  );
};

export default UserNavbar;
