// src/pages/MenusPage.container.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../services/axios';
import { Link } from 'react-router-dom';
import {
  Container, Typography, TextField, Button, Stack, Card, CardContent, Box, Alert,
  CircularProgress, Grid, Chip, Snackbar,
  Dialog, DialogTitle, DialogContent, DialogActions, List, ListItem, ListItemIcon,
  ListItemText, Checkbox, Skeleton, CardActionArea, Divider,
  IconButton, Autocomplete, Switch, FormControlLabel, Tooltip, InputAdornment, MenuItem, Select,
  Grow, Fade
} from '@mui/material';
import { useTheme } from '@mui/material/styles';

import AddIcon from '@mui/icons-material/Add';
import FolderIcon from '@mui/icons-material/Folder';
import DeleteIcon from '@mui/icons-material/Delete';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import LinkIcon from '@mui/icons-material/Link';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import SettingsIcon from '@mui/icons-material/Settings';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import ScienceIcon from '@mui/icons-material/Science';
import RefreshIcon from '@mui/icons-material/Refresh';
import MenuIcon from '@mui/icons-material/Menu';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import SearchIcon from '@mui/icons-material/Search';
import LanguageIcon from '@mui/icons-material/Language';

// defer loading xlsx to cut initial bundle size
let _XLSX = null;
const ensureXLSX = async () => {
  if (_XLSX) return _XLSX;
  const mod = await import('xlsx');
  _XLSX = mod?.default ?? mod;
  return _XLSX;
};

import { useTranslation } from 'react-i18next';
import { jwtDecode } from 'jwt-decode';

import AppSidebar, { SIDEBAR_WIDTH, RAIL_WIDTH } from '../components/AppSidebar';
import useLocalStorage from '../hooks/useLocalStorage';
import { PLACEHOLDER, PLACEHOLDER_HERO, firstValid } from '../utils/helpers';

// ⬇️ الإضافة الجديدة للفصل بين المنطق والواجهة
import { MenusProvider } from './MenusPage.context';
import MenusPageView from './MenusPage.view';


/** أبعاد بطاقات الأطباق */
const CARD_W = 280;
const CARD_H = 300;
const IMG_H  = 160;
const NAME_MIN_H = 44;
const PRICE_ROW_H = 26;

/** حد عرض المحتوى */
const CONTENT_MAX = 1040;

/** خيارات للأكواد */
const COMMON_CODES = ['A','B','C','D','E','F','G','H','J','K','L','M','N','O','P','Q','R'];

const splitCodes = (v) =>
  String(v || '')
    .toUpperCase()
    .replace(/\s+/g, '')
    .split(/[,\s]+/)
    .filter(Boolean);

const sanitizeCodesArray = (arr) => {
  const clean = new Set();
  const bad   = new Set();
  arr.forEach((raw) => {
    const token = String(raw || '').toUpperCase().trim();
    if (!token) return;
    if (/^[A-Z]{1,2}$/.test(token) || /^E?\d{3,4}$/.test(token)) {
      clean.add(token);
    } else {
      if (token.includes(',')) {
        splitCodes(token).forEach((s) => clean.add(s));
      } else {
        bad.add(token);
      }
    }
  });
  return { ok: Array.from(clean), bad: Array.from(bad) };
};

const joinCodes = (arr) => (arr && arr.length ? arr.join(',') : '');

function CodesEditor({ value = [], onChange, label, helper, disabled }) {
  const { t } = useTranslation();
  const [local, setLocal] = useState(Array.isArray(value) ? value : splitCodes(value));
  useEffect(() => {
    setLocal(Array.isArray(value) ? value : splitCodes(value));
  }, [value]);

  const { ok, bad } = sanitizeCodesArray(local);
  const error = bad.length > 0;

  return (
    <Autocomplete
      multiple
      freeSolo
      options={COMMON_CODES}
      value={local}
      onChange={(_, newVal) => {
        const flat = newVal
          .flatMap((item) => (typeof item === 'string' ? splitCodes(item) : [item]))
          .filter(Boolean);
        const { ok } = sanitizeCodesArray(flat);
        setLocal(ok);
        onChange && onChange(ok);
      }}
      renderTags={(value, getTagProps) =>
        value.map((option, index) => (
          <Chip variant="outlined" label={option} {...getTagProps({ index })} key={`${option}-${index}`} />
        ))
      }
      renderInput={(params) => (
        <TextField
          {...params}
          size="small"
          label={label || t('labels.codes')}
          placeholder={t('placeholders.codes')}
          error={error}
          helperText={error ? t('errors.unknown_codes', { list: bad.join('، ') }) : (helper || t('helpers.codes_helper'))}
        />
      )}
      disabled={disabled}
      sx={{ minWidth: { xs: '100%', sm: 160 } }}
    />
  );
}

function MenusPage({ token }) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const isRTL = i18n.language === 'ar';

  const eqId = (a, b) => String(a) === String(b);
  const isNumericId = (v) => /^\d+$/.test(String(v ?? ''));

  // Sidebar
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useLocalStorage('sidebar_collapsed', false);
  const [selectedMenuId, setSelectedMenuId] = useLocalStorage('menus_selected', null);

  const sidebarOffset = useMemo(
    () => ({ md: collapsed ? `${RAIL_WIDTH}px` : `${SIDEBAR_WIDTH}px` }),
    [collapsed]
  );

  // Data
  const [menus, setMenus] = useState([]);
  const [newMenuName, setNewMenuName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sections, setSections] = useState([]);
  const [dishesBySection, setDishesBySection] = useState({});
  const [exportingId, setExportingId] = useState(null);
  const [snack, setSnack] = useState({ open: false, msg: '' });

  // Profile
  const [profile, setProfile] = useState({ display_name: '', avatar: '', username: '' });

  // Display
  const [selectedDisplay, setSelectedDisplay] = useState({ logo: '', hero_image: '' });
  const [displayLoading, setDisplayLoading] = useState(false);

  // Excel
  const [excelDialog, setExcelDialog] = useState(false);
  const [excelBusy, setExcelBusy] = useState(false);
  const [excelError, setExcelError] = useState('');
  const [excelFileName, setExcelFileName] = useState('');
  const [importMenuName, setImportMenuName] = useState('');
  const [excelRun, setExcelRun] = useState(false);
  const [excelProg, setExcelProg] = useState({ open: false, total: 0, done: 0, ok: 0, fail: 0, note: '' });
  const [sheetsPreview, setSheetsPreview] = useState([]);
  const [wbBinary, setWbBinary] = useState(null);

  // Dish dialog
  const [dishOpen, setDishOpen] = useState(false);
  const [dishSel, setDishSel] = useState(null);

  // Generate dialog
  const [genOpen, setGenOpen] = useState(false);
  const [genBusy, setGenBusy] = useState(false);
  const [genForce, setGenForce] = useState(false);
  const [genDryRun, setGenDryRun] = useState(true);

  const [genLang, setGenLang] = useState('de');
  const [genUseLLM, setGenUseLLM] = useState(false);
  const [genLLMDryRun, setGenLLMDryRun] = useState(true);
  const [genModel, setGenModel] = useState('gpt-4.1-mini');
  const [genMaxTerms, setGenMaxTerms] = useState(8);
  const [genTemperature, setGenTemperature] = useState(0.2);
  const [genDishIdsText, setGenDishIdsText] = useState('');

  const [llmGuessCodes, setLlmGuessCodes] = useState(true);
  const [llmDebug, setLlmDebug] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [saveAsGlobal, setSaveAsGlobal] = useState(false);
  const [upsertBusy, setUpsertBusy] = useState(false);
  const [llmSelect, setLlmSelect] = useState({});
  const [candFilter, setCandFilter] = useState('');
  const [selectToggleStamp, setSelectToggleStamp] = useState(0);

  const [genRules, setGenRules] = useState(null);
  const [genPreview, setGenPreview] = useState([]);
  const [genCounts, setGenCounts] = useState(null);
  const [genLLM, setGenLLM] = useState(null);

  const formatEuro = (v) => {
    const n = Number(String(v ?? '').replace(',', '.'));
    if (!Number.isFinite(n)) return v ?? '';
    try {
      return n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    } catch {
      return n.toFixed(2);
    }
  };

  // ✅ تأكيد اختيار أول مصدر صورة صالح فعلاً وتجاهل قيم سيئة
  const safeSrc = (value) => {
    if (value == null) return null;
    const cleaned = typeof value === 'string' ? value.trim() : value;
    if (!cleaned || cleaned === 'null' || cleaned === 'undefined') return null;
    return cleaned;
  };

  const dishCardImage = (dish) =>
    firstValid(
      safeSrc(dish?.image),
      safeSrc(dish?.image_url),
      safeSrc(profile?.avatar),
      PLACEHOLDER
    );

  const bySort = (a, b) => (a?.sort_order ?? 0) - (b?.sort_order ?? 0) || (a?.id || 0) - (b?.id || 0);

  const pickPrimarySecondary = (dish) => {
    const prices = (dish?.prices || []).slice().sort(bySort);
    if (prices.length) {
      const primary = prices.find((p) => p.is_default) || prices[0];
      const rest = prices.filter((p) => p !== primary);
      const secondary = rest[0] || null;
      return { primary, secondary, more: Math.max(0, rest.length - 1), all: prices };
    }
    if (dish?.price != null && dish.price !== '') {
      return { primary: { label: '', price: dish.price }, secondary: null, more: 0, all: [{ label: '', price: dish.price, is_default: true }] };
    }
    return { primary: null, secondary: null, more: 0, all: [] };
  };

  const hiddenFileId = 'excel-import-input';
  const openExcelPicker = () => document.getElementById(hiddenFileId)?.click();

  const handleUploadAvatar = async (fileOrEvent) => {
    const file = fileOrEvent?.target?.files?.[0] ?? fileOrEvent;
    if (!file) return;
    try {
      const fd = new FormData();
      fd.append('avatar', file);
      const res = await api.patch('/me/profile/', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      const avatar = res?.data?.avatar || '';
      setProfile((p) => ({ ...p, avatar }));
      setSnack({ open: true, msg: t('toast.saved') });
    } catch (err) {
      console.error(err);
      setSnack({ open: true, msg: t('toast.save_failed') });
    }
  };

  // API
  const fetchMenus = async () => {
    setLoading(true);
    try {
      const res = await api.get('/menus/');
      const list = Array.isArray(res.data) ? res.data : [];
      setMenus(list);

      if (!list.length) {
        setSelectedMenuId(null);
      } else {
        const current = /^\d+$/.test(String(selectedMenuId ?? '')) ? String(selectedMenuId) : null;
        const exists = current && list.some((m) => eqId(m.id, current));
        setSelectedMenuId(exists ? current : String(list[0].id));
      }
      setError('');
    } catch {
      setError(t('errors.load_menus_failed'));
    } finally {
      setLoading(false);
    }
  };

  const fetchSectionsAndDishes = async (menuId) => {
    if (!/^\d+$/.test(String(menuId ?? ''))) {
      setSections([]);
      setDishesBySection({});
      return;
    }
    try {
      const { data } = await api.get('/menu/', { params: { branch: menuId } });
      const secs = Array.isArray(data?.sections) ? data.sections : [];
      setSections(secs);
      const dishesObj = {};
      for (const sec of secs) {
        dishesObj[sec.id] = Array.isArray(sec.dishes) ? sec.dishes : [];
      }
      setDishesBySection(dishesObj);
    } catch { /* ignore */ }
  };

  const fetchMyProfile = async () => {
    try {
      const res = await api.get('/me/profile/');
      const display_name = res?.data?.display_name || '';
      const avatar = res?.data?.avatar || '';
      const username = res?.data?.username || '';
      setProfile((p) => ({
        ...p,
        display_name: display_name || username || p.display_name,
        username: username || p.username,
        avatar: avatar || '',
      }));
    } catch { /* ignore */ }
  };

  const fetchDisplaySettings = async (menuId) => {
    setSelectedDisplay({ logo: '', hero_image: '' });
    if (!/^\d+$/.test(String(menuId ?? ''))) return;
    setDisplayLoading(true);
    try {
      const res = await api.get(`/menus/${menuId}/display-settings/`);
      setSelectedDisplay({
        logo: res?.data?.logo || '',
        hero_image: res?.data?.hero_image || '',
      });
    } catch {
      setSelectedDisplay({ logo: '', hero_image: '' });
    } finally {
      setDisplayLoading(false);
    }
  };

  useEffect(() => {
    try {
      const tk = token || sessionStorage.getItem('token') || localStorage.getItem('token');
      if (tk) {
        const d = jwtDecode(tk);
        const name =
          d?.user?.full_name || d?.user?.name || d?.name || d?.username || d?.email || t('labels.user');
        setProfile((p) => ({ ...p, display_name: p.display_name || name }));
        const role = (d?.user?.role || d?.role || '').toString().toLowerCase();
        setIsAdmin(role === 'admin');
      }
    } catch {}
  }, [token, t]);

  useEffect(() => { fetchMenus(); fetchMyProfile(); }, []); // eslint-disable-line
  // React Query: aggregated menu fetch (single request)
  const { data: aggMenuData } = useQuery({
    queryKey: ['menu-aggregate', selectedMenuId],
    enabled: /^\d+$/.test(String(selectedMenuId ?? '')),
    queryFn: async () => {
      const { data } = await api.get('/menu/', { params: { branch: selectedMenuId } });
      return data;
    },
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    keepPreviousData: true,
  });

  useEffect(() => {
    if (/^\d+$/.test(String(selectedMenuId ?? ''))) {
      // sections + dishes from cached query
      const secs = Array.isArray(aggMenuData?.sections) ? aggMenuData.sections : [];
      setSections(secs);
      const dishesBy = {};
      for (const sec of secs) dishesBy[sec.id] = Array.isArray(sec.dishes) ? sec.dishes : [];
      setDishesBySection(dishesBy);
      fetchDisplaySettings(selectedMenuId);
    } else {
      setSections([]); setDishesBySection({}); setSelectedDisplay({ logo: '', hero_image: '' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMenuId, aggMenuData]);

  const handleCreateMenu = async () => {
    if (!newMenuName.trim()) return;
    try {
      const res = await api.post('/menus/', { name: newMenuName });
      setNewMenuName('');
      await fetchMenus();
      setSelectedMenuId(String(res?.data?.id || ''));
    } catch {
      setError(t('errors.create_menu_failed'));
    }
  };

  const deleteMenuNow = async (menuId) => {
    const idToDelete = String(menuId || selectedMenuId || '');
    if (!idToDelete) return;
    try {
      await api.delete(`/menus/${idToDelete}/`);
      setSnack({ open: true, msg: t('toast.deleted_successfully') });
      await fetchMenus();
      const remaining = menus.filter((m) => !eqId(m.id, idToDelete));
      const next = remaining[0]?.id ? String(remaining[0].id) : null;
      setSelectedMenuId(next);
    } catch {
      setSnack({ open: true, msg: t('toast.delete_failed') });
    }
  };

  const publicUrl = (menu) => menu?.public_slug ? `${window.location.origin}/show/menu/${menu.public_slug}` : '';

  const copyPublicLink = async (menu) => {
    const url = publicUrl(menu);
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setSnack({ open: true, msg: t('toast.link_copied') });
    } catch { alert(url); }
  };

  const exportHeaders = () => {
    const lang = (i18n.language || 'en').slice(0, 2);
    if (lang === 'ar') return { name: t('export.sheet_headers.name_ar'), description: t('export.sheet_headers.description_ar'), price: t('export.sheet_headers.price_ar'), prices_all: t('export.sheet_headers.prices_all_ar'), allergy: t('export.sheet_headers.allergy_ar') };
    if (lang === 'de') return { name: t('export.sheet_headers.name_de'), description: t('export.sheet_headers.description_de'), price: t('export.sheet_headers.price_de'), prices_all: t('export.sheet_headers.prices_all_de'), allergy: t('export.sheet_headers.allergy_de') };
    return { name: t('export.sheet_headers.name_en'), description: t('export.sheet_headers.description_en'), price: t('export.sheet_headers.price_en'), prices_all: t('export.sheet_headers.prices_all_en'), allergy: t('export.sheet_headers.allergy_en') };
  };
  const safeSheetName = (s) => String(s || '').slice(0, 31).replace(/[:\\/?*\[\]]/g, '.');

  const handleExportMenu = async (menu) => {
    setExportingId(menu.id);
    try {
      const XLSX = await ensureXLSX();
      const wb = XLSX.utils.book_new();
      const hdr = exportHeaders();
      const { data } = await api.get('/menu/', { params: { branch: menu.id } });
      const secs = Array.isArray(data?.sections) ? data.sections : [];
      for (const sec of secs) {
        const dishes = Array.isArray(sec.dishes) ? sec.dishes : [];
        const rows = dishes.map((d) => {
          const prices = (d.prices || []).slice().sort(bySort);
          const def = prices.find((p) => p.is_default)?.price ?? d.price ?? '';
          const all = prices.length
            ? prices.map((p) => `${p.label ? p.label + ': ' : ''}${p.price}`).join(' | ')
            : (d.price != null ? String(d.price) : '');
          const allergenCodes = d.display_codes || d.allergy_info || '';
          return {
            [hdr.name]: d.name || '',
            [hdr.description]: d.description || '',
            [hdr.price]: def !== '' ? Number(def) : '',
            [hdr.prices_all]: all,
            [hdr.allergy]: allergenCodes,
          };
        });
        const ws = XLSX.utils.json_to_sheet(rows, {
          header: [hdr.name, hdr.description, hdr.price, hdr.prices_all, hdr.allergy],
        });
        XLSX.utils.book_append_sheet(wb, ws, safeSheetName(sec.name));
      }
      if (secs.length === 0) {
        const ws = XLSX.utils.aoa_to_sheet([[hdr.name, hdr.description, hdr.price, hdr.prices_all, hdr.allergy]]);
        XLSX.utils.book_append_sheet(wb, ws, safeSheetName(menu.name));
      }
      XLSX.writeFile(wb, `${menu.name}.xlsx`);
    } catch (e) {
      console.error(e);
      setSnack({ open: true, msg: t('errors.export_failed_generic') });
    } finally {
      setExportingId(null);
    }
  };

  // ====== LLM helpers (كما كانت) ======
  const headerSynonyms = useMemo(
    () => ({
      name: ['name','item','title','dish','dishname','اسم','اسم الطبق','الاسم','الصنف','طبق','اسم الوجبة','gericht','gerichtname','name des gerichts','speise'],
      description: ['description','desc','details','about','الوصف','وصف','تفاصيل','نبذة','beschreibung','details de','beschreibungstext'],
      price: ['price','cost','amount','unitprice','€','eur','euro','preis','kosten','السعر','سعر','ثمن'],
      allergy: ['allergy','allergies','allergen','allergyinfo','allergy info','allergens','الحساسية','عناصر الحساسية','تحذير حساسية','مسببات الحساسية','allergie','allergien','allergenhinweise'],
    }),
    []
  );

  const normalize = (s) => {
    if (s == null) return '';
    let x = String(s).toLowerCase();
    x = x.normalize('NFKD').replace(/[\u064B-\u0652]/g, '');
    x = x.replace(/[^\p{L}\p{N}]+/gu, ' ').trim().replace(/\s+/g, ' ');
    return x;
  };

  const detectColumnMap = (headers) => {
    const map = { name: null, description: null, price: null, allergy: null };
    const normHeaders = headers.map((h) => ({ raw: h, norm: normalize(h) }));
    const claim = (key, idx) => { if (!map[key]) map[key] = normHeaders[idx].raw; };
    normHeaders.forEach((h, idx) => {
      for (const key of Object.keys(headerSynonyms)) {
        if (headerSynonyms[key].some((cand) => h.norm === normalize(cand))) claim(key, idx);
      }
    });
    normHeaders.forEach((h, idx) => {
      if (!map.name && /\b(name|item|dish|اسم|طبق|gericht)\b/.test(h.norm)) claim('name', idx);
      if (!map.description && /\b(desc|description|وصف|beschreibung)\b/.test(h.norm)) claim('description', idx);
      if (!map.price && /\b(price|cost|eur|euro|€|سعر|preis)\b/.test(h.norm)) claim('price', idx);
      if (!map.allergy && /\ballerg/i.test(h.norm)) claim('allergy', idx);
    });
    const missing = ['name'].filter((k) => !map[k]);
    return { map, missing };
  };

  // ----- helpers for rate limiting / retries ---------------------------------
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  // Keep overall throughput under DRF user throttle (200/min ≈ 3.33 rps)
  const REQUEST_DELAY_MS = 600; // per worker; with concurrency=2 ≈ ~2.8 rps

  const postWithBackoff = async (url, payload, options = {}) => {
    const maxAttempts = 5;
    let attempt = 0;
    let lastErr;
    while (attempt < maxAttempts) {
      try {
        const res = await api.post(url, payload, options);
        // steady pace between successful requests
        await sleep(REQUEST_DELAY_MS);
        return res;
      } catch (err) {
        lastErr = err;
        const status = err?.response?.status;
        const retryAfter = parseInt(err?.response?.headers?.['retry-after'] ?? '0', 10);
        // Backoff only on 429/5xx; otherwise rethrow
        if (status !== 429 && !(status >= 500)) throw err;
        const extra = attempt * 400; // linear backoff step
        const waitMs = Math.max(REQUEST_DELAY_MS, (retryAfter || 0) * 1000) + extra;
        await sleep(waitMs);
        attempt += 1;
      }
    }
    throw lastErr || new Error('too_many_retries');
  };

  const parseWorkbookToPreview = (wb, XLSX) => {
    const previews = [];
    wb.SheetNames.forEach((sheetName) => {
      const ws = wb.Sheets[sheetName];
      if (!ws) return;
      const json = XLSX.utils.sheet_to_json(ws, { defval: '' });
      if (!json.length) {
        previews.push({ name: sheetName, count: 0, sample: [], map: { name: null, description: null, price: null, allergy: null }, missing: ['name'], enabled: false });
        return;
      }
      const headers = Object.keys(json[0]);
      const { map, missing } = detectColumnMap(headers);
      previews.push({ name: sheetName, count: json.length, sample: json.slice(0, 3), map, missing, enabled: missing.length === 0 });
    });
    return previews;
  };

  const pickCol = (row, key, map) => (map[key] ? row[map[key]] : '');
  const parseNumber = (v) => {
    if (v === '' || v == null) return null;
    const s = String(v).replace(/[^\d,.\-]/g, '').replace(',', '.');
    const n = Number(s);
    return isFinite(n) ? n : null;
  };

  const handleExcelChosenKeepWB = async (ev) => {
    const file = ev.target.files?.[0];
    if (!file) return;
    setExcelError(''); setExcelBusy(true);
    setExcelFileName(file.name);
    setImportMenuName(file.name.replace(/\.(xlsx|xls|csv)$/i, '') || t('import.default_menu_name'));
    try {
      const data = await file.arrayBuffer();
      const XLSX = await ensureXLSX();
      const wb = XLSX.read(data, { type: 'array' });
      setSheetsPreview(parseWorkbookToPreview(wb, XLSX));
      setExcelDialog(true);
      setWbBinary(data);
    } catch {
      setExcelError(t('errors.failed_to_parse_excel'));
    } finally {
      setExcelBusy(false);
      ev.target.value = '';
    }
  };

  const doImportNow = async () => {
    if (!wbBinary) return;
    setExcelError(''); setExcelBusy(true);
    try {
      const XLSX = await ensureXLSX();
      const wb = XLSX.read(wbBinary, { type: 'array' });
      const menuRes = await postWithBackoff('/menus/', { name: importMenuName || t('import.default_menu_name') });
      const menuId = menuRes.data.id;
      const enabledSheets = sheetsPreview.filter((s) => s.enabled);
      const sectionIdByName = {};
      for (const s of enabledSheets) {
        const secRes = await postWithBackoff('/sections/', { name: s.name, menu: menuId });
        sectionIdByName[s.name] = secRes.data.id;
      }
      // Build tasks (one POST /dishes/ per row). Price sent nested to halve requests.
      const tasks = [];
      for (const s of enabledSheets) {
        const ws = wb.Sheets[s.name];
        if (!ws) continue;
        const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
        const map = s.map || { name: null, description: null, price: null, allergy: null };
        for (const row of rows) {
          const name = String(pickCol(row, 'name', map) || '').trim();
          if (!name) continue;
          const description = String(pickCol(row, 'description', map) || '').trim();
          const price = parseNumber(pickCol(row, 'price', map));
          const allergy_info = String(pickCol(row, 'allergy', map) || '').trim();
          const payload = {
            name,
            description,
            allergy_info,
            section: sectionIdByName[s.name],
            ...(price != null
              ? { prices: [{ label: '', price, is_default: true, sort_order: 0 }] }
              : {}),
          };
          tasks.push(payload);
        }
      }

      // Progress UI
      setExcelRun(true);
      setExcelProg({ open: true, total: tasks.length, done: 0, ok: 0, fail: 0, note: '' });

      const concurrency = 3;
      let done = 0, ok = 0, fail = 0;
      const runPool = async (items, limit, worker) => {
        let idx = 0, active = 0;
        return await new Promise((resolve) => {
          const pump = () => {
            if (done + fail >= items.length) return resolve();
            while (active < limit && idx < items.length) {
              const item = items[idx++];
              active++;
              worker(item)
                .then(() => { ok++; })
                .catch(() => { fail++; })
                .finally(() => {
                  done++;
                  active--;
                  setExcelProg((p) => ({ ...p, done, ok, fail }));
                  pump();
                });
            }
          };
          pump();
        });
      };

      await runPool(tasks, concurrency, async (payload) => {
        await postWithBackoff('/dishes/', payload);
      });

      setSnack({ open: true, msg: t('toast.import_done') });
      setExcelDialog(false); setExcelBusy(false); setWbBinary(null);
      setExcelRun(false); setExcelProg({ open: false, total: 0, done: 0, ok: 0, fail: 0, note: '' });
      // small cool-down before listing menus to avoid immediate 429
      await sleep(1000);
      await fetchMenus();
      setSelectedMenuId(String(menuId));
    } catch {
      setExcelError(t('errors.import_failed_generic'));
      setExcelBusy(false);
      setExcelRun(false);
    }
  };

  const parseDishIds = (raw) => {
    if (!raw) return undefined;
    const ids = raw.split(/[,\s]+/).map((t) => t.trim()).filter(Boolean).map((t) => Number(t)).filter((n) => Number.isFinite(n));
    return ids.length ? ids : undefined;
  };

  const shapePreviewFromRules = (rulesPayload, dryRunFlag) => {
    if (!rulesPayload) return { rows: [], counters: null, missingCount: 0 };
    const items = Array.isArray(rulesPayload.items) ? rulesPayload.items : [];
    const rows = items.map((it) => {
      const before = (it.before || '').trim();
      const after = (it.after || '').trim();
      const skipped = !!it.skipped;
      let action = 'no_change';
      if (skipped) action = 'skip_manual';
      else if (dryRunFlag) {
        action = after === before ? 'no_change' : 'would_change';
        if (it.reason && it.reason.includes('override') && it.reason.includes('manual')) action = 'would_override_manual';
      } else {
        action = after === before ? 'no_change' : 'changed';
      }
      return { id: it.dish_id, name: it.name || t('labels.dish'), action, current: before || '∅', new: after || '', skipped, reason: it.reason || '' };
    });
    const countVal = rulesPayload.count ?? rulesPayload.processed ?? rows.length;
    const appliedVal = rulesPayload.applied ?? rulesPayload.changed ?? 0;
    const counters = { count: countVal, applied: appliedVal };
    const missingCount = rows.filter((r) => !r.skipped && (!r.new || r.new.trim() === '')).length;
    return { rows, counters, missingCount };
  };

  const buildGenerateBody = (dry) => {
    const base = {
      force: genForce, dry_run: !!dry, lang: (genLang || 'de').toLowerCase(),
      use_llm: !!genUseLLM, llm_dry_run: !!genLLMDryRun,
      llm_model: genModel, llm_max_terms: Number(genMaxTerms) || 8, llm_temperature: Number(genTemperature) || 0.2,
      llm_guess_codes: !!llmGuessCodes, llm_debug: !!llmDebug, dish_ids: parseDishIds(genDishIdsText),
    };
    if (!base.dish_ids) delete base.dish_ids;
    return base;
  };

  const previewGenerate = async () => {
    setGenBusy(true); setGenCounts(null); setGenLLM(null);
    try {
      const body = buildGenerateBody(true);
      const res = await api.post('/dishes/batch-generate-allergen-codes/', body, { timeout: 60000 });
      const rules = res?.data?.rules || null;
      const llm = res?.data?.llm || null;

      setGenRules(rules);
      const shaped = shapePreviewFromRules(rules, true);
      setGenPreview(shaped.rows);
      setGenCounts({
        processed: shaped.counters?.count ?? 0,
        skipped: (rules?.items || []).filter((it) => it.skipped).length,
        changed: shaped.rows.filter((r) => r.action === 'would_change' || r.action === 'would_override_manual').length,
        missingAfterRules: shaped.missingCount,
      });
      setGenLLM(llm || null);
      setGenDryRun(true);
    } catch (e) {
      console.error(e);
      const serverMsg = e?.response?.data?.detail || e?.response?.data?.error || e?.message || t('errors.failed_preview_allergens');
      setSnack({ open: true, msg: serverMsg });
    } finally { setGenBusy(false); }
  };

  const runGenerate = async () => {
    setGenBusy(true);
    try {
      const body = buildGenerateBody(false);
      if (body.use_llm) body.llm_dry_run = false;
      const res = await api.post('/dishes/batch-generate-allergen-codes/', body, { timeout: 60000 });
      const rules = res?.data?.rules || null;
      const llm = res?.data?.llm || null;

      setGenRules(rules);
      const shaped = shapePreviewFromRules(rules, false);
      setGenPreview(shaped.rows);
      setGenCounts({
        processed: shaped.counters?.count ?? 0,
        skipped: (rules?.items || []).filter((it) => it.skipped).length,
        changed: shaped.rows.filter((r) => r.action === 'changed').length,
        missingAfterRules: shaped.missingCount,
      });
      setGenLLM(llm || null);
      setGenDryRun(false);

      setSnack({ open: true, msg: t('toast.generation_done') });
      if (isNumericId(selectedMenuId)) await fetchSectionsAndDishes(selectedMenuId);
    } catch (e) {
      console.error(e);
      const serverMsg = e?.response?.data?.detail || e?.response?.data?.error || e?.message || t('errors.generation_failed');
      setSnack({ open: true, msg: serverMsg });
    } finally { setGenBusy(false); }
  };

  useEffect(() => {
    if (!genLLM || !Array.isArray(genLLM.items)) { setLlmSelect({}); return; }
    const next = {};
    for (const it of genLLM.items) {
      const cands = Array.isArray(it.candidates) ? it.candidates : [];
      cands.sort((a, b) => (b.confidence || 0) - (a.confidence || 0));
      for (const c of cands) {
        if (c.mapped_ingredient_id) continue;
        const key = `${it.dish_id}::${c.term}`;
        const arr = sanitizeCodesArray(splitCodes(c.guess_codes || '')).ok;
        next[key] = { checked: false, term: c.term, codesArr: arr, dishId: it.dish_id, confidence: c.confidence || 0 };
      }
    }
    setLlmSelect(next);
  }, [genLLM]);

  const handleUpsertSelected = async () => {
    const entries = Object.entries(llmSelect)
      .filter(([, v]) => v.checked && (v.term || '').trim())
      .map(([, v]) => ({ term: String(v.term || '').trim(), allergen_codes: joinCodes(sanitizeCodesArray(v.codesArr || []).ok) }))
      .filter((it) => it.term && it.allergen_codes);

    if (!entries.length) { setSnack({ open: true, msg: t('errors.select_at_least_one') }); return; }

    setUpsertBusy(true);
    try {
      const payload = { lang: (genLang || 'de').toLowerCase(), as_global: isAdmin ? !!saveAsGlobal : false, items: entries };
      await api.post('/lexicon/llm-add/', payload, { timeout: 60000 });
      setSnack({ open: true, msg: t('toast.saved') });
    } catch (e) {
      console.error(e);
      const msg = e?.response?.data?.detail || e?.message || t('toast.save_failed');
      setSnack({ open: true, msg });
    } finally { setUpsertBusy(false); }
  };

  const selectedMenu = useMemo(() => menus.find((m) => eqId(m.id, selectedMenuId)) || null, [menus, selectedMenuId]);

  // ✅ اختيار الهيرو من: إعدادات العرض > الشعار > أفاتار > بليس‌هولدر
  const heroSrc = useMemo(
    () =>
      firstValid(
        safeSrc(selectedDisplay?.hero_image),
        safeSrc(selectedDisplay?.logo),
        safeSrc(profile?.avatar),
        PLACEHOLDER_HERO
      ),
    [selectedDisplay, profile]
  );

  const dividerSideKey = isRTL ? 'borderRight' : 'borderLeft';
  const openDish = (dish) => { setDishSel(dish); setDishOpen(true); };
  const selectedCount = useMemo(() => Object.values(llmSelect).filter((v) => v.checked).length, [llmSelect, selectToggleStamp]);

  const filteredLLMItems = useMemo(() => {
    if (!genLLM || !Array.isArray(genLLM.items)) return [];
    const q = candFilter.trim().toLowerCase();
    const list = genLLM.items.map((it) => ({
      ...it,
      candidates: (it.candidates || []).filter((c) => !q || String(c.term || '').toLowerCase().includes(q))
        .sort((a, b) => (b.confidence || 0) - (a.confidence || 0)),
    }));
    return list;
  }, [genLLM, candFilter]);

  const toggleSelectAllVisible = (checked) => {
    const upd = { ...llmSelect };
    filteredLLMItems.forEach((it) => {
      (it.candidates || []).forEach((c) => {
        if (c.mapped_ingredient_id) return;
        const key = `${it.dish_id}::${c.term}`;
        if (upd[key]) upd[key].checked = checked;
      });
    });
    setLlmSelect(upd);
  };

  // لغات
  const LANGS = [
    { code: 'ar', label: 'العربية' },
    { code: 'en', label: 'English' },
    { code: 'de', label: 'Deutsch' },
  ];

  const changeLang = async (lng) => {
    await i18n.changeLanguage(lng);
    document.dir = lng === 'ar' ? 'rtl' : 'ltr';
  };

  // ⬇️ كل ما يحتاجه الـ View — نجمعه في value
  const value = {
    // أساسيات
    t, i18n, theme, isRTL,

    // ثوابت واجهة
    CONTENT_MAX, CARD_W, CARD_H, IMG_H, NAME_MIN_H, PRICE_ROW_H, PLACEHOLDER, PLACEHOLDER_HERO,

    // Sidebar & layout
    AppSidebar, SIDEBAR_WIDTH, RAIL_WIDTH,
    sidebar: { mobileOpen, setMobileOpen, collapsed, setCollapsed, sidebarOffset },
    handleUploadAvatar,                 // ✅ مُمَرّر للـ Sidebar

    // بيانات عامة
    menus, setMenus, loading, error,
    selectedMenuId, setSelectedMenuId, selectedMenu,
    sections, dishesBySection,
    profile,

    // عرض/صور
    selectedDisplay, displayLoading, heroSrc, dividerSideKey,

    // إنشاء قائمة جديدة
    newMenuName, setNewMenuName, handleCreateMenu,

    // روابط عامة
    publicUrl, copyPublicLink, deleteMenuNow,

    // تصدير إكسل
    exportingId, handleExportMenu, exportHeaders,

    // إدخال إكسل
    hiddenFileId, openExcelPicker,
    excelDialog, setExcelDialog,
    excelBusy, excelError, excelFileName,
    importMenuName, setImportMenuName,
    sheetsPreview, setSheetsPreview,
    handleExcelChosenKeepWB, doImportNow,
    excelRun, excelProg,

    // دايالوج الطبق
    dishOpen, setDishOpen, dishSel, setDishSel, openDish,

    // توليد الأكواد
    genOpen, setGenOpen, genBusy, genForce, setGenForce, genDryRun, setGenDryRun,
    genLang, setGenLang, genUseLLM, setGenUseLLM, genLLMDryRun, setGenLLMDryRun,
    genModel, setGenModel, genMaxTerms, setGenMaxTerms, genTemperature, setGenTemperature,
    genDishIdsText, setGenDishIdsText, llmGuessCodes, setLlmGuessCodes, llmDebug, setLlmDebug,
    isAdmin, saveAsGlobal, setSaveAsGlobal, upsertBusy,
    llmSelect, setLlmSelect, candFilter, setCandFilter,
    genRules, setGenRules, genPreview, setGenPreview, genCounts, setGenCounts, genLLM, setGenLLM,
    selectedCount, filteredLLMItems,
    previewGenerate, runGenerate, toggleSelectAllVisible, handleUpsertSelected,

    // أدوات كروت الأطباق
    formatEuro, dishCardImage, pickPrimarySecondary,

    // snack
    snack, setSnack,

    // لغات
    LANGS, changeLang,

    // أيقونات نحتاجها داخل الـ View
    Icons: {
      AddIcon, FolderIcon, DeleteIcon, FileDownloadIcon, LinkIcon, ContentCopyIcon, SettingsIcon,
      UploadFileIcon, CheckCircleIcon, WarningAmberIcon, ScienceIcon, RefreshIcon, MenuIcon,
      InfoOutlinedIcon, SearchIcon, LanguageIcon,
    },
    MUI: {
      Container, Typography, TextField, Button, Stack, Card, CardContent, Box, Alert,
      CircularProgress, Grid, Chip, Snackbar,
      Dialog, DialogTitle, DialogContent, DialogActions, List, ListItem, ListItemIcon,
      ListItemText, Checkbox, Skeleton, CardActionArea, Divider,
      IconButton, Autocomplete, Switch, FormControlLabel, Tooltip, InputAdornment, MenuItem, Select,
      Grow, Fade
    },
    Link,
    CodesEditor,
  };

  return (
    <MenusProvider value={value}>
      <MenusPageView />
    </MenusProvider>
  );
}

export default MenusPage;

