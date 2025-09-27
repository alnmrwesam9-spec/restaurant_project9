// src/components/UserNavbar.jsx
import React, { useEffect, useMemo, useState } from 'react';
import {
  AppBar, Toolbar, Typography, Button, Box, Select, MenuItem, Avatar
} from '@mui/material';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import HomeIcon from '@mui/icons-material/Home';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import LogoutIcon from '@mui/icons-material/Logout';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import i18n from '../i18n';

import { SIDEBAR_WIDTH, RAIL_WIDTH } from './AppSidebar';

export const APPBAR_H_XS = 56;
export const APPBAR_H_SM = 64;

const UserNavbar = ({
  onLogout,
  brandName = 'IBLA',
  brandLogo = '',
}) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const isRTL = i18n.language === 'ar';

  const theme = useTheme();
  const mdUp = useMediaQuery(theme.breakpoints.up('md'));

  const handleGoHome = () => navigate('/menus');
  const handleGoBack = () => navigate(-1);

  const handleChangeLanguage = (e) => {
    const selectedLang = e.target.value;
    i18n.changeLanguage(selectedLang);
    document.dir = selectedLang === 'ar' ? 'rtl' : 'ltr';
  };

  const readCollapsed = () => {
    try { return JSON.parse(localStorage.getItem('sidebar_collapsed') ?? 'false'); }
    catch { return false; }
  };
  const [collapsed, setCollapsed] = useState(readCollapsed());

  useEffect(() => {
    let timer = 0;
    let last = readCollapsed();
    const tick = () => {
      const cur = readCollapsed();
      if (cur !== last) {
        last = cur;
        setCollapsed(cur);
      }
      timer = window.setTimeout(tick, 250);
    };
    tick();
    const onVis = () => setCollapsed(readCollapsed());
    document.addEventListener('visibilitychange', onVis);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);

  const sideGap = useMemo(
    () => (mdUp ? (collapsed ? RAIL_WIDTH : SIDEBAR_WIDTH) : 0),
    [collapsed, mdUp]
  );

  const BackIcon = (
    <ArrowBackIcon fontSize="small" sx={{ transform: isRTL ? 'scaleX(-1)' : 'none' }} />
  );

  const brandInitials = (brandName || 'A').trim().slice(0, 2).toUpperCase();

  return (
    <AppBar
      position="sticky"        // <- الحل: خليها sticky بدل fixed
      elevation={0}
      color="transparent"
      sx={{
        top: 0,
        zIndex: (t) => t.zIndex.drawer + 1, // فوق الـSidebar
        width: { xs: '100%', md: `calc(100% - ${sideGap}px)` },
        ...(isRTL ? { mr: { md: `${sideGap}px` } } : { ml: { md: `${sideGap}px` } }),
        bgcolor: 'rgba(255,255,255,0.72)',
        backdropFilter: 'saturate(180%) blur(10px)',
        borderBottom: '1px solid',
        borderColor: 'divider',
      }}
    >
      <Toolbar
        sx={{
          minHeight: { xs: APPBAR_H_XS, sm: APPBAR_H_SM },
          px: { xs: 1, sm: 2 },
          justifyContent: 'space-between',
          direction: isRTL ? 'rtl' : 'ltr',
        }}
      >
        {/* يسار: شعار المنصة */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {brandLogo ? (
            <Box
              component="img"
              src={brandLogo}
              alt={brandName}
              sx={{
                width: 28, height: 28, borderRadius: 1,
                boxShadow: '0 2px 8px rgba(0,0,0,.08)',
                objectFit: 'cover'
              }}
            />
          ) : (
            <Avatar
              variant="rounded"
              sx={{
                width: 28, height: 28,
                fontSize: 14, fontWeight: 800,
                bgcolor: 'text.primary', color: 'background.paper',
                borderRadius: 1.25,
              }}
            >
              {brandInitials}
            </Avatar>
          )}

          <Typography
            variant="subtitle2"
            sx={{
              fontWeight: 800,
              letterSpacing: .2,
              display: { xs: 'none', sm: 'block' },
            }}
          >
            {brandName}
          </Typography>
        </Box>

        {/* الوسط: Home / Back يظهر فقط على الشاشات mdUp */}
        {mdUp && (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.1,
              color: 'text.secondary',
            }}
          >
            <Typography variant="body2" sx={{ opacity: .7 }}>/</Typography>

            <Button
              color="inherit"
              size="small"
              onClick={handleGoHome}
              sx={{
                textTransform: 'none',
                color: 'text.secondary',
                '&:hover': { color: 'text.primary', background: 'transparent' },
                px: .5,
                gap: .5,
              }}
            >
              <HomeIcon fontSize="small" />
              <Typography variant="body2">{t('home')}</Typography>
            </Button>

            <Typography variant="body2" sx={{ opacity: .6 }}>•</Typography>

            <Button
              color="inherit"
              size="small"
              onClick={handleGoBack}
              sx={{
                textTransform: 'none',
                color: 'text.secondary',
                '&:hover': { color: 'text.primary', background: 'transparent' },
                px: .5,
                gap: .5,
              }}
            >
              {BackIcon}
              <Typography variant="body2">{t('back')}</Typography>
            </Button>
          </Box>
        )}

        {/* يمين: اللغة + تسجيل الخروج */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
          <Select
            value={i18n.language}
            onChange={handleChangeLanguage}
            size="small"
            variant="standard"
            disableUnderline
            sx={{
              fontSize: 14,
              color: 'text.primary',
              '& .MuiSelect-icon': {
                mr: isRTL ? .5 : 0, ml: isRTL ? 0 : .5, color: 'text.secondary'
              },
              '& .MuiSelect-select': {
                px: 1,
                py: .25,
                borderRadius: 1,
                '&:hover': { backgroundColor: 'action.hover' },
              },
            }}
          >
            <MenuItem value="ar">{t('arabic')}</MenuItem>
            <MenuItem value="en">{t('english')}</MenuItem>
            <MenuItem value="de">{t('german')}</MenuItem>
          </Select>

          <Button
            onClick={onLogout}
            size="small"
            variant="outlined"
            startIcon={<LogoutIcon />}
            sx={{
              textTransform: 'none',
              fontWeight: 700,
              color: 'text.primary',
              borderColor: 'divider',
              bgcolor: 'background.paper',
              '&:hover': { borderColor: 'text.primary', bgcolor: 'background.default' },
              borderRadius: 2
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
