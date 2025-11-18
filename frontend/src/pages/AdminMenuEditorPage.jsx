// src/pages/AdminMenuEditorPage.jsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from '../services/axios';
import {
  Container, Typography, Box, Card, CardContent,
  CardMedia, Grid, TextField, Button, Snackbar,
  InputAdornment, Stack, Chip, IconButton, Divider, Alert, Switch, FormControlLabel,
  Accordion, AccordionSummary, AccordionDetails,
  Dialog, DialogTitle, DialogContent,
  List, ListItemButton, ListItemText,
} from '@mui/material';
import FolderIcon from '@mui/icons-material/Folder';
import SaveIcon from '@mui/icons-material/Save';
import DeleteIcon from '@mui/icons-material/Delete';
import SearchIcon from '@mui/icons-material/Search';
import AddPhotoAlternateIcon from '@mui/icons-material/AddPhotoAlternate';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutline';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { useTranslation } from 'react-i18next';

const bySort = (a, b) =>
  (a?.sort_order ?? 0) - (b?.sort_order ?? 0) || (a?.id || 0) - (b?.id || 0);

const formatEuro = (v) => {
  const n = Number(String(v ?? '').replace(',', '.'));
  if (!Number.isFinite(n)) return v ?? '';
  try { return n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  catch { return n.toFixed(2); }
};

const normalizeNumber = (v) => {
  if (v === null || v === undefined || v === '') return '';
  const s = String(v).replace(',', '.');
  const n = Number(s);
  return Number.isFinite(n) ? n : '';
};

const AdminMenuEditorPage = () => {
  const { t } = useTranslation();
  const { menuId } = useParams();
  const [sections, setSections] = useState([]);
  const [dishesBySection, setDishesBySection] = useState({});
  const [newSectionName, setNewSectionName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [error, setError] = useState('');
  // UI-only additions for large menus (pure presentation state)
  const [sectionSearch, setSectionSearch] = useState({}); // { [sectionId]: string }
  const sectionRefs = useRef({}); // { [sectionId]: HTMLElement }
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorCtx, setEditorCtx] = useState({ sectionId: null, index: null });

  useEffect(() => {
    fetchSections();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menuId]);

  // Optimized aggregator-based fetch to reduce N+1 requests
  const fetchSectionsOptimized = React.useCallback(async () => {
    try {
      const { data } = await axios.get('/menu/', { params: { branch: menuId } });
      const secs = Array.isArray(data?.sections) ? data.sections : [];
      setSections(secs.map((s) => ({ id: s.id, name: s.name })));
      const dishes = {};
      for (const section of secs) {
        const arr = Array.isArray(section.dishes) ? section.dishes : [];
        dishes[section.id] = arr.map((d) => {
          const rows = (d.prices || []).slice().sort(bySort)
            .map((p, i) => ({ id: p.id, label: p.label || '', price: String(p.price ?? ''), is_default: !!p.is_default, sort_order: i }));
          return {
            ...d,
            _priceRows: rows.length ? rows : [{ id: undefined, label: '', price: '', is_default: true, sort_order: 0 }],
            _originalPriceIds: new Set(rows.map(r => r.id).filter(Boolean)),
          };
        });
      }
      setDishesBySection(dishes);
      setError('');
    } catch (e) {
      setError(t('load_sections_failed') || 'تعذر تحميل الأقسام/الأطباق');
    }
  }, [axios, menuId, t]);

  useEffect(() => {
    fetchSectionsOptimized();
  }, [fetchSectionsOptimized]);

  

  const fetchSections = async () => {
    try {
      const res = await axios.get(`/sections/`, { params: { menu: menuId } });
      const secs = Array.isArray(res.data) ? res.data : [];
      setSections(secs);

      const dishes = {};
      for (let section of secs) {
        const dishRes = await axios.get(`/dishes/`, { params: { section: section.id } });
        const arr = Array.isArray(dishRes.data) ? dishRes.data : [];
        // أضف حالة محرر الأسعار لكل طبق
        dishes[section.id] = arr.map((d) => {
          const rows = (d.prices || []).slice().sort(bySort)
            .map((p, i) => ({
              id: p.id,
              label: p.label || '',
              price: String(p.price ?? ''),
              is_default: !!p.is_default,
              sort_order: i
            }));
          return {
            ...d,
            _priceRows: rows.length
              ? rows
              : [{ id: undefined, label: '', price: '', is_default: true, sort_order: 0 }],
            _originalPriceIds: new Set(rows.map(r => r.id).filter(Boolean)),
          };
        });
      }
      setDishesBySection(dishes);
      setError('');
    } catch (e) {
      setError(t('load_sections_failed') || 'تعذر تحميل الأقسام/الأطباق');
    }
  };

  // --------- تعديل حقول الطبق العامة ---------
  const updateDishField = (sectionId, index, patch) => {
    setDishesBySection((prev) => {
      const list = [...(prev[sectionId] || [])];
      list[index] = { ...list[index], ...patch };
      return { ...prev, [sectionId]: list };
    });
  };

  // --------- إدارة صفوف الأسعار للطبق ---------
  const addPriceRow = (sectionId, index) => {
    setDishesBySection((prev) => {
      const list = [...(prev[sectionId] || [])];
      const d = { ...list[index] };
      const rows = [...(d._priceRows || [])];
      const willBeDefault = rows.length === 0 || !rows.some(r => r.is_default);
      rows.push({
        id: undefined,
        label: '',
        price: '',
        is_default: willBeDefault,
        sort_order: rows.length,
      });
      d._priceRows = rows;
      list[index] = d;
      return { ...prev, [sectionId]: list };
    });
  };

  const removePriceRow = (sectionId, index, rowIdx) => {
    setDishesBySection((prev) => {
      const list = [...(prev[sectionId] || [])];
      const d = { ...list[index] };
      const rows = [...(d._priceRows || [])];
      rows.splice(rowIdx, 1);
      if (rows.length && !rows.some(r => r.is_default)) rows[0].is_default = true;
      rows.forEach((r, i) => r.sort_order = i);
      d._priceRows = rows;
      list[index] = d;
      return { ...prev, [sectionId]: list };
    });
  };

  const updatePriceRow = (sectionId, index, rowIdx, patch) => {
    setDishesBySection((prev) => {
      const list = [...(prev[sectionId] || [])];
      const d = { ...list[index] };
      const rows = [...(d._priceRows || [])];
      const row = { ...rows[rowIdx], ...patch };
      rows[rowIdx] = row;
      if (patch.hasOwnProperty('is_default') && row.is_default) {
        rows.forEach((r, i) => { r.is_default = i === rowIdx; });
      }
      d._priceRows = rows;
      list[index] = d;
      return { ...prev, [sectionId]: list };
    });
  };

  // --------- حفظ طبق (بيانات + أسعار) ---------
  const handleSaveDish = async (dish, index, sectionId) => {
    try {
      // 1) حفظ حقول الطبق (بدون price)
      const formData = new FormData();
      formData.append('name', dish.name);
      formData.append('description', dish.description || '');
      formData.append('section', sectionId);
      const manual = String(dish.manual_codes || '').trim();
      // Sync legacy allergy_info with codes for older displays
      formData.append('allergy_info', manual);
      // Auto-enable manual override when codes are provided
      formData.append('has_manual_codes', '1');
      formData.append('manual_codes', manual);
      if (dish.image instanceof File) formData.append('image', dish.image);

      await axios.patch(`/dishes/${dish.id}/`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      // 2) حفظ الأسعار (UPSERT + DELETE)
      const rows = (dish._priceRows || []).map((p, i) => ({
        ...p,
        sort_order: i,
        price: normalizeNumber(p.price),
      })).filter((p) => p.price !== '');

      if (rows.length > 0 && !rows.some(r => r.is_default)) {
        rows[0].is_default = true;
      }

      const currentIds = new Set();
      await Promise.all(rows.map((p) => {
        const payload = {
          label: (p.label || '').trim(),
          price: p.price,
          is_default: !!p.is_default,
          sort_order: p.sort_order ?? 0,
        };
        if (p.id) {
          currentIds.add(p.id);
          return axios.patch(`/v2/dishes/${dish.id}/prices/${p.id}/`, payload);
        }
        return axios.post(`/v2/dishes/${dish.id}/prices/`, payload);
      }));

      const toDelete = [...(dish._originalPriceIds || new Set())].filter(id => !currentIds.has(id));
      await Promise.all(toDelete.map((id) => axios.delete(`/v2/dishes/${dish.id}/prices/${id}/`)));

      setSuccessMessage(t('dish_saved_successfully') || 'تم حفظ الطبق بنجاح');
      await fetchSections();
    } catch (error) {
      if (error?.response) {
        console.error('❌ Server response:', error.response.data);
        alert((t('error_saving_dish') || 'خطأ في حفظ الطبق') + ':\n' + JSON.stringify(error.response.data, null, 2));
      } else {
        console.error('❌ Unexpected error:', error?.message);
        alert((t('unexpected_error') || 'خطأ غير متوقع') + ':\n' + (error?.message || ''));
      }
    }
  };

  const handleDeleteDish = async (dishId) => {
    await axios.delete(`/dishes/${dishId}/`);
    fetchSections();
  };

  const handleAddSection = async () => {
    if (!newSectionName.trim()) return;
    await axios.post(`/sections/`, { name: newSectionName, menu: menuId });
    setNewSectionName('');
    fetchSections();
  };

  const handleAddDish = async (sectionId) => {
    const newDish = {
      name: t('new_dish_default'),
      description: '',
      section: sectionId,
      allergy_info: ''
    };
    try {
      await axios.post(`/dishes/`, newDish);
      fetchSections();
    } catch (error) {
      console.error('Error adding dish:', error.response?.data || error.message);
    }
  };

  const matchesSearch = (dish) =>
    !searchQuery?.trim() ||
    (dish.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (dish.description || '').toLowerCase().includes(searchQuery.toLowerCase());

  // Local search inside each section (UI only)
  const matchesLocalSearch = (sectionId, dish) => {
    const q = (sectionSearch[sectionId] || '').trim().toLowerCase();
    if (!q) return true;
    return (
      (dish.name || '').toLowerCase().includes(q) ||
      (dish.description || '').toLowerCase().includes(q)
    );
  };

  // Compact mini view of a dish; opens dialog for full editor
  const MiniDishCard = React.memo(function MiniDishCard({ dish, onEdit }) {
    const rows = dish._priceRows || [];
    const def = rows.find(r => r.is_default) || rows[0];
    const priceText = def && def.price !== '' && def.price != null ? `${formatEuro(def.price)}` : '';
    return (
      <Card variant="outlined" sx={{ height: '100%' }}>
        <Box display="flex" alignItems="center">
          {dish.image && typeof dish.image === 'string' ? (
            <CardMedia component="img" image={dish.image} alt={dish.name} loading="lazy" decoding="async"
              sx={{ width: 72, height: 72, objectFit: 'cover' }} />
          ) : null}
          <CardContent sx={{ flex: 1 }}>
            <Typography variant="subtitle1" noWrap title={dish.name}>{dish.name}</Typography>
            {priceText ? (
              <Typography variant="body2" color="text.secondary">{priceText}</Typography>
            ) : null}
            <Box mt={1}>
              <Button size="small" variant="contained" onClick={onEdit}>
                {t('edit') || 'Edit'}
              </Button>
            </Box>
          </CardContent>
        </Box>
      </Card>
    );
  });


  return (
    <Container sx={{ mt: 4, direction: document.dir }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <TextField
          placeholder={t('search_dish')}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          size="small"
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
        />
        <Typography variant="h6" fontWeight="bold">
          {t('manage_menu')} #{menuId}
        </Typography>
        <Box>
          <TextField
            size="small"
            placeholder={t('new_section_name')}
            value={newSectionName}
            onChange={(e) => setNewSectionName(e.target.value)}
            sx={{ mr: 1 }}
          />
          <Button variant="contained" onClick={handleAddSection}>
            {t('add')}
          </Button>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Box display="flex" gap={2}>
        {sections.length > 1 && (
          <Box sx={{ width: 220, position: 'sticky', top: 16, alignSelf: 'flex-start' }}>
            <Typography variant="subtitle2" sx={{ px: 1, mb: 1 }} color="text.secondary">
              {t('sections') || 'Sections'}
            </Typography>
            <List dense>
              {sections.map((s) => (
                <ListItemButton key={s.id} onClick={() => sectionRefs.current[s.id]?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
                  <ListItemText primary={s.name} />
                </ListItemButton>
              ))}
            </List>
          </Box>
        )}

        <Box sx={{ flex: 1 }}>
          {sections.map((section) => (
            <Box key={section.id} mb={2} ref={(el) => { if (el) sectionRefs.current[section.id] = el; }}>
              <Accordion disableGutters>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Box display="flex" alignItems="center" gap={1}>
                    <FolderIcon fontSize="small" />
                    <Typography variant="h6">{section.name}</Typography>
                  </Box>
                </AccordionSummary>
                <AccordionDetails>
                  <Box mb={2} display="flex" justifyContent="space-between" alignItems="center" gap={2}>
                    <TextField
                      size="small"
                      placeholder={t('search_in_section') || 'Search in section'}
                      value={sectionSearch[section.id] || ''}
                      onChange={(e) => setSectionSearch((prev) => ({ ...prev, [section.id]: e.target.value }))}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <SearchIcon />
                          </InputAdornment>
                        ),
                      }}
                      sx={{ maxWidth: 360 }}
                    />
                    <Button variant="outlined" onClick={() => handleAddDish(section.id)}>
                      {t('add_new_dish')}
                    </Button>
                  </Box>

                  <Grid container spacing={2}>
                    {(dishesBySection[section.id] || [])
                      .filter(matchesSearch)
                      .filter((dish) => matchesLocalSearch(section.id, dish))
                      .map((dish, index) => (
                        <Grid item xs={12} sm={6} md={4} key={dish.id}>
                          <MiniDishCard
                            dish={dish}
                            onEdit={() => {
                              setEditorCtx({ sectionId: section.id, index });
                              setEditorOpen(true);
                            }}
                          />
                        </Grid>
                      ))}
                  </Grid>
                </AccordionDetails>
              </Accordion>
            </Box>
          ))}
        </Box>
      </Box>

      {false && sections.map((section) => (
        <Box key={section.id} mb={4}>
          <Typography variant="h6" mb={2}>
            <FolderIcon fontSize="small" /> {section.name}
          </Typography>

          <Button
            variant="outlined"
            onClick={() => handleAddDish(section.id)}
            sx={{ mb: 2 }}
          >
            ➕ {t('add_new_dish')}
          </Button>

          <Grid container spacing={2}>
            {(dishesBySection[section.id] || [])
              .filter(matchesSearch)
              .map((dish, index) => (
                <Grid item xs={12} key={dish.id}>
                  <Card sx={{ display: 'flex', alignItems: 'stretch', overflow: 'hidden' }}>
                    {dish.image && typeof dish.image === 'string' && (
                      <CardMedia
                        component="img"
                        image={dish.image}
                        alt={dish.name}
                        loading="lazy"
                        decoding="async"
                        sx={{ width: 160, height: '100%', objectFit: 'cover' }}
                      />
                    )}
                    <CardContent sx={{ flex: 1, width: '100%' }}>
                      <Grid container spacing={1}>
                        <Grid item xs={12} sm={3}>
                          <TextField
                            label={t('dish_name')}
                            fullWidth
                            value={dish.name}
                            onChange={(e) => updateDishField(section.id, index, { name: e.target.value })}
                          />
                        </Grid>

                        {/* السعر القديم لم يعد محرَّرًا هنا — سنعرض الأسعار أسفل كمحرر متعدد */}
                        <Grid item xs={12} sm={3}>
                          <TextField
                            label={t('description')}
                            fullWidth
                            value={dish.description || ''}
                            onChange={(e) => updateDishField(section.id, index, { description: e.target.value })}
                          />
                        </Grid>
                        <Grid item xs={12} sm={3}>
                          <TextField
                            label={t('labels.codes') || 'Allergen codes'}
                            fullWidth
                            value={dish.manual_codes || dish.display_codes || dish.allergy_info || ''}
                            onChange={(e) => updateDishField(section.id, index, { manual_codes: e.target.value })}
                          />
                        </Grid>
                        <Grid item xs={12} sm={3}>
                          <Button
                            variant="outlined"
                            component="label"
                            fullWidth
                            startIcon={<AddPhotoAlternateIcon />}
                          >
                            {t('upload_image')}
                            <input
                              type="file"
                              accept="image/*"
                              hidden
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) updateDishField(section.id, index, { image: file });
                              }}
                            />
                          </Button>
                        </Grid>
                      </Grid>

                      {/* عرض مختصر لأسعار الطبق الحالية */}
                      <Box mt={1}>
                        <Stack direction="row" spacing={1} flexWrap="wrap">
                          {(dish._priceRows || []).slice().sort(bySort).map((p, i) => (
                            <Chip
                              key={p.id ?? `tmp-${i}`}
                              label={`${p.label ? p.label + ' – ' : ''}${formatEuro(p.price)} €${p.is_default ? ' • ' + (t('default') || 'افتراضي') : ''}`}
                              color={p.is_default ? 'primary' : 'default'}
                              variant={p.is_default ? 'filled' : 'outlined'}
                              size="small"
                            />
                          ))}
                        </Stack>
                      </Box>

                      {/* محرر الأسعار المتعددة */}
                      <Box mt={2} p={2} sx={{ border: '1px dashed', borderColor: 'divider', borderRadius: 1 }}>
                        <Typography variant="subtitle1" fontWeight="bold" mb={1}>
                          {t('prices')}
                        </Typography>
                        <Stack spacing={1}>
                          {(dish._priceRows || []).map((row, rIdx) => (
                            <Box
                              key={row.id ?? `tmp-${rIdx}`}
                              display="grid"
                              gridTemplateColumns="1fr 160px 120px 40px"
                              gap={1}
                              alignItems="center"
                            >
                              <TextField
                                size="small"
                                label={t('price_label')}
                                value={row.label}
                                onChange={(e) =>
                                  updatePriceRow(section.id, index, rIdx, { label: e.target.value })
                                }
                              />
                              <TextField
                                size="small"
                                label={t('price_amount')}
                                value={row.price}
                                onChange={(e) =>
                                  updatePriceRow(section.id, index, rIdx, { price: e.target.value })
                                }
                              />
                              <Button
                                size="small"
                                variant={row.is_default ? 'contained' : 'outlined'}
                                onClick={() => updatePriceRow(section.id, index, rIdx, { is_default: true })}
                              >
                                {t('default')}
                              </Button>
                              <IconButton color="error" onClick={() => removePriceRow(section.id, index, rIdx)} title={t('remove')}>
                                <RemoveCircleOutlineIcon />
                              </IconButton>
                            </Box>
                          ))}

                          <Box display="flex" gap={1} mt={1}>
                            <Button size="small" startIcon={<AddCircleOutlineIcon />} onClick={() => addPriceRow(section.id, index)}>
                              {t('add_price')}
                            </Button>
                          </Box>
                        </Stack>
                      </Box>

                      <Box mt={2} display="flex" justifyContent="flex-end" gap={1}>
                        <Button
                          variant="contained"
                          color="primary"
                          startIcon={<SaveIcon />}
                          onClick={() => handleSaveDish(dish, index, section.id)}
                        >
                          {t('save')}
                        </Button>
                        <Button
                          variant="outlined"
                          color="error"
                          startIcon={<DeleteIcon />}
                          onClick={() => handleDeleteDish(dish.id)}
                        >
                          {t('delete')}
                        </Button>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
          </Grid>
        </Box>
      ))}

      {/* Editor dialog renders the existing dish editor UI */}
      <Dialog open={editorOpen} onClose={() => setEditorOpen(false)} maxWidth="lg" fullWidth>
        {(() => {
          const section = sections.find((s) => s.id === (editorCtx.sectionId ?? -1));
          const dish = (editorCtx.sectionId != null && editorCtx.index != null)
            ? (dishesBySection[editorCtx.sectionId] || [])[editorCtx.index]
            : null;
          if (!section || !dish) return null;
          return (
            <>
              <DialogTitle>{dish.name}</DialogTitle>
              <DialogContent dividers>
                <Card sx={{ display: 'flex', alignItems: 'stretch', overflow: 'hidden' }}>
                  {dish.image && typeof dish.image === 'string' && (
                    <CardMedia
                      component="img"
                      image={dish.image}
                      alt={dish.name}
                      loading="lazy"
                      decoding="async"
                      sx={{ width: 160, height: '100%', objectFit: 'cover' }}
                    />
                  )}
                  <CardContent sx={{ flex: 1, width: '100%' }}>
                    <Grid container spacing={1}>
                      <Grid item xs={12} sm={3}>
                        <TextField
                          label={t('dish_name')}
                          fullWidth
                          value={dish.name}
                          onChange={(e) => updateDishField(section.id, editorCtx.index, { name: e.target.value })}
                        />
                      </Grid>

                      <Grid item xs={12} sm={3}>
                        <TextField
                          label={t('description')}
                          fullWidth
                          value={dish.description || ''}
                          onChange={(e) => updateDishField(section.id, editorCtx.index, { description: e.target.value })}
                        />
                      </Grid>
                      <Grid item xs={12} sm={3}>
                        <TextField
                          label={t('labels.codes') || 'Allergen codes'}
                          fullWidth
                          value={dish.manual_codes || dish.display_codes || dish.allergy_info || ''}
                          onChange={(e) => updateDishField(section.id, editorCtx.index, { manual_codes: e.target.value })}
                        />
                      </Grid>
                      <Grid item xs={12} sm={3}>
                        <Button
                          variant="outlined"
                          component="label"
                          fullWidth
                          startIcon={<AddPhotoAlternateIcon />}
                        >
                          {t('upload_image')}
                          <input
                            type="file"
                            accept="image/*"
                            hidden
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) updateDishField(section.id, editorCtx.index, { image: file });
                            }}
                          />
                        </Button>
                      </Grid>
                    </Grid>

                    <Box mt={1}>
                      <Stack direction="row" spacing={1} flexWrap="wrap">
                        {(dish._priceRows || []).slice().sort(bySort).map((p, i) => (
                          <Chip
                            key={p.id ?? `tmp-${i}`}
                            label={`${p.label ? p.label + ' �?? ' : ''}${formatEuro(p.price)} �??${p.is_default ? ' �?? ' + (t('default') || '�?�?�?�?�?�?�?') : ''}`}
                            color={p.is_default ? 'primary' : 'default'}
                            variant={p.is_default ? 'filled' : 'outlined'}
                            size="small"
                          />
                        ))}
                      </Stack>
                    </Box>

                    <Box mt={2} p={2} sx={{ border: '1px dashed', borderColor: 'divider', borderRadius: 1 }}>
                      <Typography variant="subtitle1" fontWeight="bold" mb={1}>
                        {t('prices')}
                      </Typography>
                      <Stack spacing={1}>
                        {(dish._priceRows || []).map((row, rIdx) => (
                          <Box
                            key={row.id ?? `tmp-${rIdx}`}
                            display="grid"
                            gridTemplateColumns="1fr 160px 120px 40px"
                            gap={1}
                            alignItems="center"
                          >
                            <TextField
                              size="small"
                              label={t('price_label')}
                              value={row.label}
                              onChange={(e) =>
                                updatePriceRow(section.id, editorCtx.index, rIdx, { label: e.target.value })
                              }
                            />
                            <TextField
                              size="small"
                              label={t('price_amount')}
                              value={row.price}
                              onChange={(e) =>
                                updatePriceRow(section.id, editorCtx.index, rIdx, { price: e.target.value })
                              }
                            />
                            <Button
                              size="small"
                              variant={row.is_default ? 'contained' : 'outlined'}
                              onClick={() => updatePriceRow(section.id, editorCtx.index, rIdx, { is_default: true })}
                            >
                              {t('default')}
                            </Button>
                            <IconButton color="error" onClick={() => removePriceRow(section.id, editorCtx.index, rIdx)} title={t('remove')}>
                              <RemoveCircleOutlineIcon />
                            </IconButton>
                          </Box>
                        ))}

                        <Box display="flex" gap={1} mt={1}>
                          <Button size="small" startIcon={<AddCircleOutlineIcon />} onClick={() => addPriceRow(section.id, editorCtx.index)}>
                            {t('add_price')}
                          </Button>
                        </Box>
                      </Stack>
                    </Box>

                    <Box mt={2} display="flex" justifyContent="flex-end" gap={1}>
                      <Button
                        variant="contained"
                        color="primary"
                        startIcon={<SaveIcon />}
                        onClick={() => handleSaveDish(dish, editorCtx.index, section.id)}
                      >
                        {t('save')}
                      </Button>
                      <Button
                        variant="outlined"
                        color="error"
                        startIcon={<DeleteIcon />}
                        onClick={() => handleDeleteDish(dish.id)}
                      >
                        {t('delete')}
                      </Button>
                    </Box>
                  </CardContent>
                </Card>
              </DialogContent>
            </>
          );
        })()}
      </Dialog>

      <Snackbar
        open={Boolean(successMessage)}
        autoHideDuration={3000}
        onClose={() => setSuccessMessage('')}
        message={successMessage}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </Container>
  );
};

export default AdminMenuEditorPage;






