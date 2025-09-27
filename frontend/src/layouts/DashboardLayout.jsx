// src/layouts/DashboardLayout.jsx
import React, { useState } from 'react';
import {
  Box,
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
  useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import MenuIcon from '@mui/icons-material/Menu';
import HomeIcon from '@mui/icons-material/Home';
import ViewModuleIcon from '@mui/icons-material/ViewModule';
import BookIcon from '@mui/icons-material/Book';
import SettingsIcon from '@mui/icons-material/Settings';

const drawerWidth = 240;

export default function DashboardLayout({
  children,
  brand = '—',
  hideAppBar = false,            // <- جديد: إخفاء الـNavbar لهذه الصفحة
}) {
  const theme = useTheme();
  const mdUp = useMediaQuery(theme.breakpoints.up('md'));

  const [mobileOpen, setMobileOpen] = useState(false);
  const toggleMobile = () => setMobileOpen(v => !v);

  const drawer = (
    <Box role="presentation" sx={{ width: drawerWidth }}>
      <Box sx={{ px: 2, py: 2 }}>
        <Typography variant="h6" fontWeight={800}>
          {brand || '—'}
        </Typography>
      </Box>
      <Divider />
      <List>
        <ListItemButton component="a" href="/">
          <ListItemIcon><HomeIcon /></ListItemIcon>
          <ListItemText primary="الرئيسية" />
        </ListItemButton>
        <ListItemButton component="a" href="/menus">
          <ListItemIcon><ViewModuleIcon /></ListItemIcon>
          <ListItemText primary="القائمة" />
        </ListItemButton>
        <ListItemButton component="a" href="/docs">
          <ListItemIcon><BookIcon /></ListItemIcon>
          <ListItemText primary="وثائق" />
        </ListItemButton>
        <ListItemButton component="a" href="/settings">
          <ListItemIcon><SettingsIcon /></ListItemIcon>
          <ListItemText primary="الإعدادات" />
        </ListItemButton>
      </List>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'grey.50' }}>
      {/* AppBar (يمكن إخفاؤه لهذه الصفحة) */}
      {!hideAppBar && (
        <AppBar position="sticky" elevation={1} sx={{ zIndex: (t) => t.zIndex.drawer + 1 }}>
          <Toolbar>
            {!mdUp && (
              <IconButton edge="start" color="inherit" onClick={toggleMobile} sx={{ mr: 1 }}>
                <MenuIcon />
              </IconButton>
            )}
            <Typography variant="h6" noWrap component="div" fontWeight={800}>
              {brand || '—'}
            </Typography>
          </Toolbar>
        </AppBar>
      )}

      {/* Drawer يسار/يمين حسب لغة الصفحة، مؤقّت على الموبايل ودائم على الشاشات الكبيرة */}
      <Drawer
        variant={mdUp ? 'permanent' : 'temporary'}
        open={mdUp ? true : mobileOpen}
        onClose={toggleMobile}
        ModalProps={{ keepMounted: true }}
        sx={{
          '& .MuiDrawer-paper': {
            width: drawerWidth,
            boxSizing: 'border-box',
          },
        }}
      >
        {drawer}
      </Drawer>

      {/* المحتوى */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          px: { xs: 1.5, sm: 2, md: 3 },
          py: 2,
          // إذا أخفينا AppBar، لا نحتاج padding-top كبير
          pt: hideAppBar ? 2 : 3,
        }}
      >
        {children}
      </Box>
    </Box>
  );
}
