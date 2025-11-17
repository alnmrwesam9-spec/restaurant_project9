// src/pages/AdminUserMenusPage.jsx
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from '../services/axios';
import {
  Container,
  Typography,
  Grid,
  Card,
  CardContent,
  CardActionArea,
  Box,
  Alert,
  Button,
  CircularProgress,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import FolderIcon from '@mui/icons-material/Folder';
import { useTranslation } from 'react-i18next';

// Defer XLSX import to reduce initial bundle size
let _XLSX = null;
const ensureXLSX = async () => {
  if (_XLSX) return _XLSX;
  const mod = await import('xlsx');
  _XLSX = mod?.default ?? mod;
  return _XLSX;
};

const AdminUserMenusPage = () => {
  const { t, i18n } = useTranslation();
  const { userId } = useParams();
  const [menus, setMenus] = useState([]);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  // Excel import/export state
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [headers, setHeaders] = useState([]);
  const [mapping, setMapping] = useState({ name: '', description: '', price: '', allergy: '' });
  const [mapOpen, setMapOpen] = useState(false);
  const [pendingFile, setPendingFile] = useState(null);
  const [exportMenuId, setExportMenuId] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    fetchMenus();
    // refetch when userId changes; avoids TDZ on fetchMenus
  }, [userId]);

  const fetchMenus = async () => {
    try {
      const res = await axios.get(`/menus/?user=${userId}`);
      const arr = Array.isArray(res.data) ? res.data : [];
      setMenus(arr);
      if (arr.length && !exportMenuId) setExportMenuId(String(arr[0].id));
    } catch (err) {
      console.error(t('fetch_menus_error'), err);
      setError(t('load_menus_failed'));
    }
  };

  const handleMenuClick = (menuId) => {
    navigate(`/admin/menus/${menuId}/edit`);
  };

  const createMenuForUser = async () => {
    setError('');
    setCreating(true);
    try {
      await axios.post(`/admin/users/${userId}/create-menu/`, {});
      await fetchMenus();
    } catch (err) {
      const msg = err?.response?.data?.detail || err?.response?.data?.error || t('load_menus_failed');
      setError(msg);
    } finally {
      setCreating(false);
    }
  };

  // ===== Excel helpers =====
  const exportHeaders = () => {
    const lang = (i18n?.language || 'de').slice(0, 2);
    if (lang === 'ar') {
      return { name: 'اسم الطبق', description: 'الوصف', price: 'السعر', prices_all: 'كل الأسعار', allergy: 'معلومات الحساسية' };
    }
    if (lang === 'de') {
      return { name: 'Gerichtname', description: 'Beschreibung', price: 'Preis', prices_all: 'Alle Preise', allergy: 'Allergiehinweise' };
    }
    return { name: 'Name', description: 'Description', price: 'Price', prices_all: 'Prices (All)', allergy: 'Allergy Info' };
  };

  const safeSheetName = (s) => String(s || '').slice(0, 31).replace(/[:\\/?*\[\]]/g, '.');
  const parsePrice = (v) => {
    if (v == null || v === '') return null;
    const s = String(v).trim().replace(/[^\d,.\-]/g, '').replace(',', '.');
    const n = Number(s);
    return Number.isFinite(n) ? Number(n.toFixed(2)) : null;
  };
  const norm = (s) => String(s || '').trim().toLowerCase().replace(/\s+/g, '').replace(/[_\-]/g, '');
  const tryAutoMapping = (hdrs) => {
    const pick = (aliases) => {
      const normalizedAliases = aliases.map(norm);
      return hdrs.find((h) => normalizedAliases.includes(norm(h))) || '';
    };
    return {
      name: pick(['اسم الطبق', 'name', 'dish', 'dish name', 'item', 'meal', 'gericht', 'gerichtname']),
      description: pick(['الوصف', 'description', 'desc', 'details', 'notes', 'beschreibung']),
      price: pick(['السعر', 'price', 'cost', 'amount', 'value', 'rate', 'preis']),
      allergy: pick(['معلومات الحساسية', 'allergy', 'allergy info', 'allergens', 'allergyinformation', 'allergieinformationen', 'allergene']),
    };
  };

  const onPickFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setPendingFile(file);
    try {
      const XLSX = await ensureXLSX();
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data);
      const firstSheet = wb.SheetNames[0];
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[firstSheet], { defval: '' });
      const hdrs = rows.length ? Object.keys(rows[0]) : [];
      setHeaders(hdrs);
      setMapping(tryAutoMapping(hdrs));
      setMapOpen(true);
    } catch (err) {
      console.error('read headers error:', err);
      alert(t('import_failed_generic'));
      e.target.value = '';
      setPendingFile(null);
    }
  };

  const startImportWithMapping = async () => {
    if (!mapping.name) {
      alert(t('choose_dish_name_column_prompt'));
      return;
    }
    setMapOpen(false);
    if (pendingFile) {
      await importExcelFile(pendingFile, mapping);
      setPendingFile(null);
    }
  };

  const importExcelFile = async (file, map) => {
    setImporting(true);
    try {
      const XLSX = await ensureXLSX();
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data);

      // 1) Create a new menu for this user
      const baseName = String(file.name || 'Imported Menu').replace(/\.[^.]+$/, '');
      const createRes = await axios.post(`/admin/users/${userId}/create-menu/`, { name: baseName });
      const newMenuId = createRes?.data?.id;
      if (!newMenuId) throw new Error('Failed to create menu');

      let failed = 0;
      let firstErrorMsg = '';

      for (const sheet of wb.SheetNames) {
        const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheet], { defval: '' });
        if (!rows.length) {
          console.warn(`${t('sheet_is_empty')}: "${sheet}"`);
          continue;
        }
        const secRes = await axios.post(`/sections/`, { name: sheet, menu: newMenuId });
        const sectionId = secRes.data.id;

        for (const [i, row] of rows.entries()) {
          const name = String(row[map.name] || '').trim();
          if (!name) continue;
          const description = String(map.description ? row[map.description] : '').trim();
          const allergy_info = String(map.allergy ? row[map.allergy] : '').trim();
          const priceVal = parsePrice(map.price ? row[map.price] : null);
          try {
            const dishRes = await axios.post(`/dishes/`, { name, description, allergy_info, section: sectionId });
            const dishId = dishRes?.data?.id;
            if (dishId && priceVal != null) {
              await axios.post(`/v2/dishes/${dishId}/prices/`, {
                label: '',
                price: priceVal,
                is_default: true,
                sort_order: 0,
              });
            }
          } catch (dishErr) {
            failed += 1;
            const msg = dishErr.response?.data ? JSON.stringify(dishErr.response.data) : dishErr.message;
            if (!firstErrorMsg) firstErrorMsg = `#${i + 2} (${sheet}): ${msg}`;
            console.error('dish add failed:', { name, description, allergy_info, section: sectionId }, 'server:', dishErr.response?.data || dishErr);
          }
        }
      }

      if (failed) {
        alert(t('import_done_with_errors', { count: failed, first: firstErrorMsg }));
      } else {
        alert(t('import_done_success'));
      }
      await fetchMenus();
    } catch (err) {
      console.error('import error:', err.response?.data || err);
      alert(t('import_failed_generic'));
    } finally {
      setImporting(false);
      const input = document.querySelector('input[type="file"][data-adminusermenus]');
      if (input) input.value = '';
    }
  };

  const exportToExcel = async () => {
    if (!exportMenuId) return;
    setExporting(true);
    try {
      const XLSX = await ensureXLSX();
      const wb = XLSX.utils.book_new();
      const hdr = exportHeaders();
      const { data } = await axios.get('/menu/', { params: { branch: exportMenuId } });
      const secs = Array.isArray(data?.sections) ? data.sections : [];
      for (const section of secs || []) {
        const dishes = Array.isArray(section.dishes) ? section.dishes : [];
        const rows = (dishes || []).map((d) => {
          const prices = (d.prices || []).slice().sort();
          const defaultPrice = prices.find((p) => p.is_default)?.price ?? d.price ?? '';
          const allPrices = (d.prices || []).length
            ? (d.prices || []).map((p) => `${p.label ? p.label + ': ' : ''}${p.price}`).join(' | ')
            : (d.price != null ? String(d.price) : '');
          return {
            [hdr.name]: d.name || '',
            [hdr.description]: d.description || '',
            [hdr.price]: defaultPrice !== '' ? Number(defaultPrice) : '',
            [hdr.prices_all]: allPrices,
            [hdr.allergy]: d.allergy_info || '',
          };
        });
        const ws = XLSX.utils.json_to_sheet(rows, {
          header: [hdr.name, hdr.description, hdr.price, hdr.prices_all, hdr.allergy],
        });
        XLSX.utils.book_append_sheet(wb, ws, safeSheetName(section.name));
      }
      if (!secs || secs.length === 0) {
        const ws = XLSX.utils.aoa_to_sheet([[hdr.name, hdr.description, hdr.price, hdr.prices_all, hdr.allergy]]);
        XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
      }
      const currentMenu = menus.find((m) => String(m.id) === String(exportMenuId));
      const filename = `${(currentMenu?.name || 'menu').replace(/[\\/:*?"<>|]/g, '_')}.xlsx`;
      XLSX.writeFile(wb, filename);
    } catch (err) {
      console.error('export error:', err);
      alert(t('export_failed_generic') || 'Failed to export Excel');
    } finally {
      setExporting(false);
    }
  };

  return (
    <Container maxWidth="md" sx={{ mt: 4, direction: 'rtl' }}>
      <Typography variant="h5" fontWeight="bold" gutterBottom>
        📋 {t('user_menus')} {userId}
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* Top actions: Import/Export Excel */}
      <Box display="flex" alignItems="center" gap={1} sx={{ mb: 2 }}>
        <Button
          variant="outlined"
          startIcon={<UploadFileIcon />}
          component="label"
          disabled={importing}
        >
          {importing ? t('import_in_progress') : t('import_excel')}
          <input
            type="file"
            hidden
            accept=".xlsx,.xls"
            onChange={onPickFile}
            data-adminusermenus
          />
        </Button>
        <TextField
          select
          size="small"
          value={exportMenuId}
          onChange={(e) => setExportMenuId(e.target.value)}
          sx={{ minWidth: 220 }}
          disabled={!menus.length}
          placeholder={t('select_menu')}
          SelectProps={{ native: true }}
        >
          {menus.map((m) => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </TextField>
        <Button
          variant="outlined"
          color="success"
          startIcon={<FileDownloadIcon />}
          onClick={exportToExcel}
          disabled={!menus.length || !exportMenuId || exporting}
        >
          {exporting ? (t('exporting') || '...') : t('export_excel')}
        </Button>
      </Box>

      {Array.isArray(menus) && menus.length === 0 && (
        <Box
          sx={{
            border: '1px dashed',
            borderColor: 'divider',
            borderRadius: 3,
            p: 4,
            textAlign: 'center',
            mb: 3,
          }}
        >
          <Typography variant="body1" sx={{ mb: 2 }}>
            {t('no_menus_for_user') || 'لا توجد قوائم لهذا المستخدم.'}
          </Typography>
          <Button
            variant="contained"
            color="primary"
            onClick={createMenuForUser}
            disabled={creating}
            sx={{ borderRadius: 2, px: 2.5, fontWeight: 700 }}
          >
            {creating ? (
              <>
                <CircularProgress size={18} sx={{ mr: 1 }} />
                {t('creating') || 'جاري الإنشاء...'}
              </>
            ) : (
              t('create_menu_for_this_user') || 'إنشاء قائمة جديدة لهذا المستخدم'
            )}
          </Button>
        </Box>
      )}

      <Grid container spacing={2}>
        {menus.map((menu) => (
          <Grid item xs={12} sm={6} md={4} key={menu.id}>
            <Card
              variant="outlined"
              sx={{
                transition: '0.3s',
                '&:hover': { boxShadow: 4, transform: 'scale(1.03)' },
              }}
            >
              <CardActionArea onClick={() => handleMenuClick(menu.id)}>
                <CardContent>
                  <Box display="flex" alignItems="center" gap={1}>
                    <FolderIcon color="primary" />
                    <Typography variant="h6" noWrap>
                      {menu.name}
                    </Typography>
                  </Box>
                </CardContent>
              </CardActionArea>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Mapping dialog for import */}
      <Dialog open={mapOpen} onClose={() => setMapOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{t('map_columns_title')}</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          {[
            { key: 'name',        label: t('field_dish_name_required') },
            { key: 'description', label: t('field_description') },
            { key: 'price',       label: t('field_price') },
            { key: 'allergy',     label: t('field_allergy') },
          ].map(({ key, label }) => (
            <Box key={key} sx={{ mt: 1 }}>
              <Typography variant="subtitle2" sx={{ mb: 0.5 }}>{label}</Typography>
              <TextField
                fullWidth
                select
                size="small"
                value={mapping[key] || ''}
                onChange={(e) => setMapping((m) => ({ ...m, [key]: e.target.value }))}
              >
                <option value=""></option>
                {headers.map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </TextField>
            </Box>
          ))}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMapOpen(false)}>{t('btn_cancel')}</Button>
          <Button variant="contained" onClick={startImportWithMapping}>
            {t('btn_continue')}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default AdminUserMenusPage;
