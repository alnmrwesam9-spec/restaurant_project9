// src/pages/AdminUserDetailsPage.jsx
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from '../services/axios';
import {
  Box,
  Typography,
  Container,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Grid,
  Card,
  CardContent,
  CardMedia,
  Fade,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl as MuiFormControl,
  InputLabel as MuiInputLabel,
  Select as MuiSelect,
  MenuItem as MuiMenuItem,
  Stack,
  Chip,
} from '@mui/material';
import FolderIcon from '@mui/icons-material/Folder';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import { useTranslation } from 'react-i18next';
import * as XLSX from 'xlsx';

const bySort = (a, b) =>
  (a?.sort_order ?? 0) - (b?.sort_order ?? 0) || (a?.id || 0) - (b?.id || 0);

const formatEuro = (v) => {
  const n = Number(String(v ?? '').replace(',', '.'));
  if (!Number.isFinite(n)) return v ?? '';
  try { return n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  catch { return n.toFixed(2); }
};

const AdminUserDetailsPage = () => {
  const { t, i18n } = useTranslation();
  const { userId } = useParams();

  const [menus, setMenus] = useState([]);
  const [sections, setSections] = useState([]);
  const [dishesBySection, setDishesBySection] = useState({});
  const [selectedMenuId, setSelectedMenuId] = useState('');
  const [error, setError] = useState('');
  const [showContent, setShowContent] = useState(false);

  // استيراد/تصدير
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);

  // ربط الأعمدة
  const [headers, setHeaders] = useState([]);
  const [mapping, setMapping] = useState({ name: '', description: '', price: '', allergy: '' });
  const [mapOpen, setMapOpen] = useState(false);
  const [pendingFile, setPendingFile] = useState(null);

  useEffect(() => {
    fetchUserMenus();
    setTimeout(() => setShowContent(true), 100);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  useEffect(() => {
    if (selectedMenuId) {
      fetchSectionsAndDishes(selectedMenuId);
    } else {
      setSections([]);
      setDishesBySection({});
    }
  }, [selectedMenuId]);

  // ===== API =====
  const fetchUserMenus = async () => {
    try {
      const res = await axios.get(`/menus/?user=${userId}`);
      setMenus(res.data);
      setError('');
    } catch (err) {
      setError(t('load_menus_failed'));
    }
  };

  const fetchSectionsAndDishes = async (menuId) => {
    try {
      const resSections = await axios.get(`/sections/?menu=${menuId}`);
      setSections(resSections.data);

      const dishesObj = {};
      for (let section of resSections.data) {
        const resDishes = await axios.get(`/dishes/?section=${section.id}`);
        dishesObj[section.id] = resDishes.data || [];
      }
      setDishesBySection(dishesObj);
    } catch (err) {
      setError(t('load_sections_failed'));
    }
  };

  // ===== تصدير إكسل (يدعم أسعار متعددة) =====
  const exportHeaders = () => {
    const lang = (i18n.language || 'en').slice(0, 2);
    if (lang === 'ar') {
      return { name: 'اسم الطبق', description: 'الوصف', price: 'السعر', prices_all: 'جميع الأسعار', allergy: 'عناصر الحساسية' };
    }
    if (lang === 'de') {
      return { name: 'Gerichtname', description: 'Beschreibung', price: 'Preis', prices_all: 'Alle Preise', allergy: 'Allergiehinweise' };
    }
    return { name: 'Name', description: 'Description', price: 'Price', prices_all: 'Prices (All)', allergy: 'Allergy Info' };
  };

  const safeSheetName = (s) =>
    String(s || '')
      .slice(0, 31)
      .replace(/[:\\/?*\[\]]/g, '.');

  const exportToExcel = async () => {
    if (!selectedMenuId) return;
    setExporting(true);
    try {
      // اجلب بيانات طازجة محليًا لتفادي مشاكل setState غير المتزامنة
      const wb = XLSX.utils.book_new();
      const hdr = exportHeaders();

      const { data: secs } = await axios.get(`/sections/?menu=${selectedMenuId}`);

      for (const section of secs || []) {
        const { data: dishes = [] } = await axios.get(`/dishes/?section=${section.id}`);

        const rows = (dishes || []).map((d) => {
          const prices = (d.prices || []).slice().sort(bySort);
          const defaultPrice = prices.find((p) => p.is_default)?.price ?? d.price ?? '';
          const allPrices = prices.length
            ? prices.map((p) => `${p.label ? p.label + ': ' : ''}${p.price}`).join(' | ')
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

      const currentMenu = menus.find((m) => m.id === selectedMenuId);
      const filename = `${(currentMenu?.name || 'menu').replace(/[\\/:*?"<>|]/g, '_')}.xlsx`;
      XLSX.writeFile(wb, filename);
    } catch (err) {
      console.error('❌ export error:', err);
      alert(t('export_failed_generic') || 'Failed to export Excel');
    } finally {
      setExporting(false);
    }
  };

  // ===== استيراد إكسل (ينشئ سعر افتراضي عبر v2) =====
  const parsePrice = (v) => {
    if (v == null || v === '') return null;
    const s = String(v).trim().replace(/[^\d,.\-]/g, '').replace(',', '.');
    const n = Number(s);
    return Number.isFinite(n) ? Number(n.toFixed(2)) : null;
  };

  const norm = (s) =>
    String(s || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '')
      .replace(/[_\-]/g, '');

  const tryAutoMapping = (hdrs) => {
    const pick = (aliases) => {
      const normalizedAliases = aliases.map(norm);
      return hdrs.find((h) => normalizedAliases.includes(norm(h))) || '';
    };
    return {
      name: pick(['اسم الطبق', 'name', 'dish', 'dish name', 'item', 'meal', 'gericht', 'gerichtname']),
      description: pick(['الوصف', 'description', 'desc', 'details', 'notes', 'beschreibung']),
      price: pick(['السعر', 'price', 'cost', 'amount', 'value', 'rate', 'preis']),
      allergy: pick([
        'عناصر الحساسية',
        'allergy',
        'allergy info',
        'allergens',
        'allergyinformation',
        'allergieinformationen',
        'allergene',
      ]),
    };
  };

  const onPickFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!selectedMenuId) {
      alert(t('select_menu_first') || 'Please select a menu first.');
      e.target.value = '';
      return;
    }
    setPendingFile(file);

    try {
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
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data);

      let failed = 0;
      let firstErrorMsg = '';

      for (const sheet of wb.SheetNames) {
        const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheet], { defval: '' });
        if (!rows.length) {
          console.warn(`${t('sheet_is_empty')}: "${sheet}"`);
          continue;
        }

        // إنشاء القسم في القائمة المحددة
        const secRes = await axios.post(`/sections/`, { name: sheet, menu: selectedMenuId });
        const sectionId = secRes.data.id;

        for (const [i, row] of rows.entries()) {
          const name = String(row[map.name] || '').trim();
          if (!name) continue;
          const description = String(map.description ? row[map.description] : '').trim();
          const allergy_info = String(map.allergy ? row[map.allergy] : '').trim();
          const priceVal = parsePrice(map.price ? row[map.price] : null);

          try {
            // 1) أنشئ الطبق أولًا بدون price
            const dishRes = await axios.post(`/dishes/`, { name, description, allergy_info, section: sectionId });
            const dishId = dishRes?.data?.id;

            // 2) إن وُجد سعر، أنشئ سعر افتراضي عبر v2
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
            console.error('❌ dish add failed:', { name, description, allergy_info, section: sectionId }, 'server:', dishErr.response?.data || dishErr);
          }
        }
      }

      if (failed) {
        alert(t('import_done_with_errors', { count: failed, first: firstErrorMsg }));
      } else {
        alert(t('import_done_success'));
      }

      // إعادة تحميل الأقسام/الأطباق
      fetchSectionsAndDishes(selectedMenuId);
    } catch (err) {
      console.error('❌ import error:', err.response?.data || err);
      alert(t('import_failed_generic'));
    } finally {
      setImporting(false);
      const input = document.querySelector('input[type="file"][data-adminuserdetails]');
      if (input) input.value = '';
    }
  };

  return (
    <Fade in={showContent} timeout={600}>
      <Container sx={{ mt: 4, direction: 'rtl' }}>
        <Typography variant="h6" fontWeight="bold" gutterBottom>
          🧾 {t('user_details')} <strong>ID: {userId}</strong>
        </Typography>

        {/* اختيار القائمة */}
        <FormControl fullWidth margin="normal">
          <InputLabel>{t('select_menu')}</InputLabel>
          <Select
            value={selectedMenuId}
            onChange={(e) => setSelectedMenuId(e.target.value)}
            startAdornment={<FolderIcon sx={{ mr: 1 }} />}
            label={t('select_menu')}
          >
            {menus.map((menu) => (
              <MenuItem key={menu.id} value={menu.id}>
                {menu.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* أزرار الاستيراد/التصدير للقائمة المحددة */}
        {selectedMenuId && (
          <Box mt={2} display="flex" gap={2}>
            <Button
              variant="outlined"
              startIcon={<UploadFileIcon />}
              component="label"
              disabled={importing || exporting}
            >
              {importing ? t('import_in_progress') : t('import_excel')}
              <input
                type="file"
                hidden
                accept=".xlsx,.xls"
                onChange={onPickFile}
                data-adminuserdetails
              />
            </Button>

            <Button
              variant="outlined"
              color="success"
              startIcon={<FileDownloadIcon />}
              onClick={exportToExcel}
              disabled={importing || exporting}
            >
              {exporting ? (t('exporting') || '...') : t('export_excel')}
            </Button>
          </Box>
        )}

        {/* عرض الأقسام والأطباق */}
        {sections.map((section) => (
          <Box key={section.id} mt={4}>
            <Typography variant="h6" fontWeight="bold" color="primary" mb={2}>
              📁 {section.name}
            </Typography>

            <Grid container spacing={2}>
              {(dishesBySection[section.id] || []).map((dish) => {
                const prices = (dish.prices || []).slice().sort(bySort);
                const hasMulti = prices.length > 0;
                return (
                  <Grid item xs={12} sm={6} md={4} key={dish.id}>
                    <Card sx={{ transition: '0.3s', '&:hover': { transform: 'scale(1.03)', boxShadow: 6 } }}>
                      {dish.image && (
                        <CardMedia
                          component="img"
                          height="160"
                          image={dish.image}
                          alt={dish.name}
                          sx={{ objectFit: 'cover' }}
                        />
                      )}
                      <CardContent>
                        <Typography variant="h6" fontWeight="bold">
                          🍴 {dish.name}
                        </Typography>

                        {/* أسعار متعددة */}
                        <Box mt={0.5}>
                          {hasMulti ? (
                            <Stack direction="row" spacing={1} flexWrap="wrap">
                              {prices.map((p) => (
                                <Chip
                                  key={p.id || `tmp-${p.sort_order}`}
                                  label={`${p.label ? p.label + ' – ' : ''}${formatEuro(p.price)} €${p.is_default ? ' • ' + (t('default') || 'افتراضي') : ''}`}
                                  color={p.is_default ? 'primary' : 'default'}
                                  variant={p.is_default ? 'filled' : 'outlined'}
                                  size="small"
                                />
                              ))}
                            </Stack>
                          ) : (
                            dish.price != null && dish.price !== '' && (
                              <Typography variant="body2" color="text.secondary">
                                💶 {formatEuro(dish.price)} €
                              </Typography>
                            )
                          )}
                        </Box>

                        <Typography variant="body2">
                          {dish.description || t('no_description')}
                        </Typography>
                        {dish.allergy_info && (
                          <Typography variant="body2" color="error">
                            🧬 {t('allergy_info')}: {dish.allergy_info}
                          </Typography>
                        )}
                      </CardContent>
                    </Card>
                  </Grid>
                );
              })}
            </Grid>
          </Box>
        ))}

        {error && (
          <Typography color="error" mt={3}>
            {error}
          </Typography>
        )}

        {/* Dialog: ربط الأعمدة */}
        <Dialog open={mapOpen} onClose={() => setMapOpen(false)} fullWidth maxWidth="sm">
          <DialogTitle>{t('map_columns_title')}</DialogTitle>
          <DialogContent sx={{ pt: 2 }}>
            {[
              { key: 'name',        label: t('field_dish_name_required') },
              { key: 'description', label: t('field_description') },
              { key: 'price',       label: t('field_price') },
              { key: 'allergy',     label: t('field_allergy') },
            ].map(({ key, label }) => (
              <MuiFormControl key={key} fullWidth margin="normal">
                <MuiInputLabel>{label}</MuiInputLabel>
                <MuiSelect
                  value={mapping[key] || ''}
                  label={label}
                  onChange={(e) => setMapping((m) => ({ ...m, [key]: e.target.value }))}
                >
                  <MuiMenuItem value="">
                    <em>{t('option_none')}</em>
                  </MuiMenuItem>
                  {headers.map((h) => (
                    <MuiMenuItem key={h} value={h}>
                      {h}
                    </MuiMenuItem>
                  ))}
                </MuiSelect>
              </MuiFormControl>
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
    </Fade>
  );
};

export default AdminUserDetailsPage;
