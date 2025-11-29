import React, { useEffect, useMemo, useState } from 'react';

import { useParams, useNavigate, useLocation } from 'react-router-dom';
import axios from '../services/axios';
import {
  Container, Typography, TextField, Button, Stack, Box, Grid,
  Card, CardContent, CardMedia, IconButton, Alert, Chip,
  Select, MenuItem, InputLabel, FormControl, Tooltip,
  Dialog, DialogTitle, DialogContent, DialogActions, GlobalStyles,
  InputAdornment, Autocomplete
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import AddPhotoAlternateIcon from '@mui/icons-material/AddPhotoAlternate';
import EditIcon from '@mui/icons-material/Edit';

import DeleteIcon from '@mui/icons-material/Delete';
import RestaurantIcon from '@mui/icons-material/Restaurant';
import SaveIcon from '@mui/icons-material/Save';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutline';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import { useTranslation } from 'react-i18next';

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import { toImageUrl } from '../utils/imageUrl';
import { useFilePreview } from '../hooks/useFilePreview';

const LANGS = [
  { code: 'en', label: 'EN' },
  { code: 'de', label: 'DE' },
  { code: 'ar', label: 'AR' },
];

const ITEM_THUMB = 64;
const ITEM_MIN_H = 84;
const ACTIONS_W = 64;

const hardClamp = (value = '', max = 120) => {
  const s = String(value);
  return s.length > max ? s.slice(0, max) + '…' : s;
};
const NAME_MAX = 25;
const DESC_MAX = 30;

// --- Constants for Price Labels ---
const PRESET_LABELS = ['Small', 'Medium', 'Large'];
const CUSTOM_LABEL_MAP = {
  ar: 'تسمية مخصصة',
  en: 'Custom Label',
  de: 'Benutzerdefiniert',
};

// --- Sortable Item Component ---
const SortableDishItem = ({
  dish,
  isRTL,
  handleEditDish,
  handleDeleteDish,
  setDeleteConfirm,
  openPreview,
  formatEuro,
  bySort
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: dish.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
    opacity: isDragging ? 0.5 : 1,
    position: 'relative',
  };

  const prices = (dish.prices || []).slice().sort(bySort);

  return (
    <Box
      ref={setNodeRef}
      style={style}
      sx={{
        display: 'grid',
        gridTemplateColumns: `32px ${ITEM_THUMB}px 1fr`,
        alignItems: 'center',
        columnGap: 1.2,
        p: 1,
        borderRadius: 2,
        minHeight: ITEM_MIN_H,
        cursor: 'default',
        userSelect: 'none',
        overflow: 'hidden',
        maxWidth: '100%',
        bgcolor: 'background.paper',
        border: '1px solid',
        borderColor: 'divider',
        '&:hover': { bgcolor: 'action.hover' }
      }}
    >
      {/* Drag Handle */}
      <Box
        {...attributes}
        {...listeners}
        sx={{
          cursor: 'grab',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'text.secondary',
          height: '100%',
          '&:active': { cursor: 'grabbing' }
        }}
      >
        <DragIndicatorIcon fontSize="small" />
      </Box>

      {/* Image */}
      <Card
        elevation={0}
        onClick={() => openPreview(dish)}
        sx={{
          width: ITEM_THUMB, height: ITEM_THUMB, borderRadius: 2, overflow: 'hidden',
          bgcolor: 'grey.100',
          cursor: 'pointer',
          '&:hover img': { transform: 'scale(1.6)' }
        }}
      >
        {dish.image ? (
          <CardMedia
            component="img"
            image={toImageUrl(dish.image)}
            alt={dish.name}
            sx={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform .25s ease' }}
          />
        ) : (
          <Box sx={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center', color: 'text.disabled' }}>
            <RestaurantIcon />
          </Box>
        )}
      </Card>

      {/* Content */}
      <Box
        onClick={() => openPreview(dish)}
        sx={{ minWidth: 0, overflow: 'hidden', cursor: 'pointer', ...(isRTL ? { pl: `${ACTIONS_W}px` } : { pr: `${ACTIONS_W}px` }) }}
      >
        <Typography
          variant="subtitle1"
          sx={{
            fontWeight: 800, lineHeight: 1.2,
            whiteSpace: 'normal',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden', textOverflow: 'ellipsis',
            overflowWrap: 'anywhere', wordBreak: 'break-all', hyphens: 'auto',
            direction: 'inherit', unicodeBidi: 'plaintext',
          }}
          title={dish.name || ''}
        >
          {hardClamp(dish.name, NAME_MAX)}
        </Typography>

        {!!dish.description && (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{
              mt: .25,
              whiteSpace: 'normal',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden', textOverflow: 'ellipsis',
              overflowWrap: 'anywhere', wordBreak: 'break-all', hyphens: 'auto',
              direction: 'inherit', unicodeBidi: 'plaintext',
            }}
            title={dish.description}
          >
            {hardClamp(dish.description, DESC_MAX)}
          </Typography>
        )}

        {/* Prices/Tags */}
        <Box sx={{ mt: .75, display: 'flex', gap: .5, alignItems: 'center', flexWrap: 'nowrap', overflow: 'hidden', minWidth: 0 }}>
          {prices.map((p) => (
            <Chip
              key={p.id || `p-${p.sort_order}`}
              size="small"
              label={`${p.label ? p.label + ' ' : ''}${formatEuro(p.price)}€`}
              variant={p.is_default ? 'filled' : 'outlined'}
              color={p.is_default ? 'primary' : 'default'}
              sx={{ flex: '0 0 auto' }}
            />
          ))}
          {(dish.display_codes || dish.allergy_info) && (dish.display_codes || dish.allergy_info).split(',').slice(0, 6).map((tag, i) => (
            <Chip key={`alg-${i}`} size="small" label={tag.trim()} variant="outlined" sx={{ flex: '0 0 auto' }} />
          ))
          }
        </Box>
      </Box>

      {/* Actions */}
      <Stack
        direction="row"
        spacing={0.5}
        sx={{
          position: 'absolute',
          top: '50%',
          transform: 'translateY(-50%)',
          ...(isRTL ? { left: 8 } : { right: 8 }),
          width: ACTIONS_W,
          justifyContent: isRTL ? 'flex-start' : 'flex-end',
          pointerEvents: 'auto',
          whiteSpace: 'nowrap'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <Tooltip title="Edit">
          <IconButton size="small" color="primary" onClick={() => handleEditDish(dish)}>
            <EditIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Delete">
          <IconButton size="small" color="error" onClick={() => setDeleteConfirm({ open: true, id: dish.id })}>
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Stack>
    </Box>
  );
};

const DishPage = () => {
  const { sectionId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';

  // Read menuId from query string if present
  const qs = new URLSearchParams(location.search);
  const menuFromQuery = qs.get('menu');

  const [dishes, setDishes] = useState([]);
  const [editingDishId, setEditingDishId] = useState(null);
  const [error, setError] = useState('');

  const [query, setQuery] = useState('');

  // Normalize input codes
  const normalizeCodes = (raw) => {
    const s = String(raw || "").toUpperCase().replace(/[()]/g, "");
    const parts = s.split(/[\s,]+/).map((t) => t.trim()).filter(Boolean);
    const out = [];
    const seen = new Set();
    for (const p of parts) {
      if (/^[A-Z]$/.test(p)) {
        if (!seen.has(p)) { seen.add(p); out.push(p); }
      } else if (/^\d+$/.test(p)) {
        const n = String(Number(p)); // strip leading zeros
        if (!seen.has(n)) { seen.add(n); out.push(n); }
      }
    }
    return out.join(",");
  };

  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewDish, setPreviewDish] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState({ open: false, id: null });

  // German-only allergen catalog
  const [allergenCatalog, setAllergenCatalog] = useState([]);
  const [selectedAllergens, setSelectedAllergens] = useState([]);

  const [newDish, setNewDish] = useState({
    name: '',
    description: '',
    image: null,
    allergy_info: '',
    has_manual_codes: false,
    manual_codes: '',
  });

  const previewUrl = useFilePreview(newDish.image);

  const [formPrices, setFormPrices] = useState([
    { id: undefined, label: '', price: '', is_default: true, sort_order: 0 },
  ]);
  const [originalPriceIds, setOriginalPriceIds] = useState(new Set());

  // Fetch allergen catalog (German-only)
  useEffect(() => {
    const fetchAllergenCatalog = async () => {
      try {
        const res = await axios.get('/allergens/codes/?ordering=code');
        setAllergenCatalog(res.data.results || res.data || []);
      } catch (err) {
        console.error('Failed to fetch allergen catalog', err);
      }
    };
    fetchAllergenCatalog();
  }, []);

  useEffect(() => { fetchDishes(); /* eslint-disable-next-line */ }, []);

  const fetchDishes = async () => {
    try {
      const res = await axios.get(`/dishes/?section=${sectionId}`);
      setDishes(res.data || []);
    } catch (err) {
      console.error(t('fetch_dishes_failed'), err);
      setError(t('fetch_dishes_failed'));
    }
  };

  const handleInputChange = (e) => {
    const { name, value, files } = e.target;
    setNewDish((prev) => ({ ...prev, [name]: files ? files[0] : value }));
  };

  const bySort = (a, b) =>
    (a.sort_order ?? 0) - (b.sort_order ?? 0) || (a.id || 0) - (b.id || 0);

  // Extract all unique labels from existing dishes to use as suggestions
  const existingLabels = useMemo(() => {
    const set = new Set();
    dishes.forEach(d => {
      if (d.prices) {
        d.prices.forEach(p => {
          if (p.label) set.add(p.label);
        });
      }
    });
    return Array.from(set).sort();
  }, [dishes]);

  const addPriceRow = () => {
    setFormPrices((rows) => ([
      ...rows,
      {
        id: undefined,
        label: 'Small', // Default to 'Small' instead of empty
        price: '',
        is_default: rows.length === 0 || !rows.some(r => r.is_default),
        sort_order: rows.length
      },
    ]));
  };
  const removePriceRow = (idx) => {
    setFormPrices((rows) => {
      const next = rows.slice(); next.splice(idx, 1);
      if (next.length && !next.some(r => r.is_default)) next[0].is_default = true;
      next.forEach((r, i) => { r.sort_order = i; });
      return next;
    });
  };
  const updatePriceRow = (idx, patch) => {
    setFormPrices((rows) => {
      const next = rows.slice();
      next[idx] = { ...next[idx], ...patch };
      if (Object.prototype.hasOwnProperty.call(patch, 'is_default') && patch.is_default) {
        next.forEach((r, i) => { r.is_default = i === idx; });
      }
      return next;
    });
  };

  const normalizeNumber = (v) => {
    if (v === null || v === undefined || v === '') return '';
    const s = String(v).replace(',', '.');
    const n = Number(s);
    return Number.isFinite(n) ? n : '';
  };
  const formatEuro = (v) => {
    const n = Number(String(v).replace(',', '.'));
    if (!Number.isFinite(n)) return v ?? '';
    try { return n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
    catch { return n.toFixed(2); }
  };

  const handleAddOrEditDish = async () => {
    setError('');
    const formData = new FormData();
    formData.append('name', newDish.name);
    formData.append('description', newDish.description);
    formData.append('section', sectionId);
    // Keep allergy_info for backward compatibility but don't rely on it
    const manual = (newDish.manual_codes || '').trim();
    formData.append('allergy_info', manual);
    if (newDish.image) formData.append('image', newDish.image);

    const pricesClean = formPrices
      .map((p, i) => ({ ...p, sort_order: i, price: normalizeNumber(p.price) }))
      .filter((p) => p.price !== '');

    if (pricesClean.length > 0 && !pricesClean.some(p => p.is_default)) {
      pricesClean[0].is_default = true;
    }

    try {
      let dishId = editingDishId;

      if (editingDishId) {
        await axios.put(`/dishes/${editingDishId}/`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      } else {
        const res = await axios.post('/dishes/', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
        dishId = res?.data?.id;
      }

      if (dishId) {
        // Save manual allergens using new endpoint
        const allergenIds = selectedAllergens.map(a => a.id);
        await axios.put(`/dishes/${dishId}/manual-allergens/`, { allergen_ids: allergenIds });

        // Save prices
        const currentIds = new Set();
        await Promise.all(pricesClean.map((p) => {
          const payload = { label: (p.label || '').trim(), price: p.price, is_default: !!p.is_default, sort_order: p.sort_order ?? 0 };
          if (p.id) { currentIds.add(p.id); return axios.patch(`/v2/dishes/${dishId}/prices/${p.id}/`, payload); }
          return axios.post(`/v2/dishes/${dishId}/prices/`, payload);
        }));
        const toDelete = [...originalPriceIds].filter(id => !currentIds.has(id));
        await Promise.all(toDelete.map((id) => axios.delete(`/v2/dishes/${dishId}/prices/${id}/`)));
      }

      setNewDish({ name: '', description: '', image: null, allergy_info: '', has_manual_codes: false, manual_codes: '' });
      setSelectedAllergens([]);
      setFormPrices([{ id: undefined, label: '', price: '', is_default: true, sort_order: 0 }]);
      setOriginalPriceIds(new Set());
      setEditingDishId(null);
      await fetchDishes();
    } catch (err) {
      console.error(t('save_dish_failed'), err?.response?.data || err?.message);
      setError(t('save_dish_failed'));
    }
  };

  const handleEditDish = (dish) => {
    setNewDish({
      name: dish.name || '',
      description: dish.description || '',
      image: null,
      allergy_info: dish.allergy_info || '',
      has_manual_codes: !!dish.has_manual_codes,
      manual_codes: (dish.manual_codes || dish.display_codes || dish.allergy_info || ''),
    });

    // Load manual allergens from allergen_rows
    if (dish.allergen_rows && Array.isArray(dish.allergen_rows)) {
      const manualRows = dish.allergen_rows.filter(row => row.source === 'manual');
      const manualAllergenIds = new Set(manualRows.map(row => row.allergen?.id || row.allergen).filter(Boolean));
      const selectedFromCatalog = allergenCatalog.filter(a => manualAllergenIds.has(a.id));
      setSelectedAllergens(selectedFromCatalog);
    } else {
      setSelectedAllergens([]);
    }

    const rows = (dish.prices || []).slice().sort(bySort);
    setFormPrices(
      rows.length
        ? rows.map((p, i) => ({ id: p.id, label: p.label || '', price: String(p.price ?? ''), is_default: !!p.is_default, sort_order: i }))
        : [{ id: undefined, label: '', price: '', is_default: true, sort_order: 0 }]
    );
    setOriginalPriceIds(new Set(rows.map(r => r.id).filter(Boolean)));
    setEditingDishId(dish.id);
    setError('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setPreviewOpen(false);
  };

  const handleDeleteDish = async (dishId) => {
    try {
      await axios.delete(`/dishes/${dishId}/`);
      setDishes((prev) => prev.filter((d) => d.id !== dishId));
      if (editingDishId === dishId) {
        setEditingDishId(null);
        setFormPrices([{ id: undefined, label: '', price: '', is_default: true, sort_order: 0 }]);
        setOriginalPriceIds(new Set());
      }
    } catch (err) {
      console.error(t('delete_failed'), err);
    }
  };

  const openPreview = (dish) => { setPreviewDish(dish); setPreviewOpen(true); };
  const closePreview = () => setPreviewOpen(false);

  // --- Drag and Drop Logic ---
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (!over || active.id !== over.id) {
      setDishes((items) => {
        const oldIndex = items.findIndex((i) => i.id === active.id);
        const newIndex = items.findIndex((i) => i.id === over.id);
        const newOrder = arrayMove(items, oldIndex, newIndex);

        // Call API
        const orderIds = newOrder.map(d => d.id);
        axios.post('/dishes/reorder/', { section: sectionId, order: orderIds })
          .catch(err => console.error("Reorder failed", err));

        return newOrder;
      });
    }
  };

  const filteredDishes = useMemo(() => {
    const q = (query || '').toString().toLowerCase().trim();
    if (!q) return dishes;
    return dishes.filter((d) => {
      const hay = [
        d.name, d.description, d.allergy_info,
        ...(d.prices || []).map((p) => `${p.label} ${p.price}`)
      ].filter(Boolean).join(' ').toLowerCase();
      return hay.includes(q);
    });
  }, [query, dishes]);

  return (
    <Container
      maxWidth="lg"
      dir={isRTL ? 'rtl' : 'ltr'}
      sx={{ py: { xs: 2, md: 4 }, overflowX: 'hidden' }}
    >
      <GlobalStyles styles={{
        'html, body, #root': { maxWidth: '100%', overflowX: 'hidden' },
        '*': { minWidth: 0 }
      }} />

      <Box sx={(theme) => ({ ...theme.mixins.toolbar, mb: { xs: 1, md: 2 } })} />

      <Box sx={{ mb: 1.5, display: 'flex', justifyContent: isRTL ? 'flex-end' : 'flex-start' }}>
        <Button
          size="small"
          variant="outlined"
          startIcon={<ArrowBackRoundedIcon />}
          onClick={() => {
            if (menuFromQuery) navigate(`/menus/${menuFromQuery}/sections`);
            else navigate(-1);
          }}
          sx={{ borderRadius: 999, textTransform: 'none', fontWeight: 700 }}
        >
          {t('back_to_sections') || 'العودة إلى الأقسام'}
        </Button>
      </Box>

      <Grid container spacing={2} alignItems="flex-start">
        {/* Left: Form */}
        <Grid xs={12} md={4} sx={{ minWidth: 0 }}>
          <Card variant="outlined" sx={{ borderRadius: 3, p: { xs: 2, md: 2 }, position: { md: 'sticky' }, top: { xs: 8, sm: 72 } }}>
            <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
              {t('dish_management') || 'Dish Management'}
            </Typography>

            <Stack spacing={1.25}>
              <TextField
                size="small"
                label={t('dish_name')}
                name="name"
                value={newDish.name}
                onChange={handleInputChange}
                fullWidth
                data-tour="dish-form-name"
              />

              <TextField
                size="small"
                label={t('description')}
                name="description"
                multiline
                minRows={3}
                value={newDish.description}
                onChange={handleInputChange}
                fullWidth
              />

              {/* German-only allergen multi-select */}
              <Autocomplete
                multiple
                size="small"
                options={allergenCatalog}
                getOptionLabel={(option) => `${option.code} – ${option.name_de}`}
                value={selectedAllergens}
                onChange={(event, newValue) => setSelectedAllergens(newValue)}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Allergene (manuelle Auswahl)"
                    placeholder="Wählen Sie Allergencodes..."
                  />
                )}
                renderTags={(value, getTagProps) =>
                  value.map((option, index) => (
                    <Chip
                      label={`${option.code} – ${option.name_de}`}
                      {...getTagProps({ index })}
                      size="small"
                    />
                  ))
                }
                isOptionEqualToValue={(option, value) => option.id === value.id}
              />

              <Box
                sx={{ border: '1px dashed', borderColor: 'divider', borderRadius: 2, p: 2, textAlign: 'center', bgcolor: 'background.default' }}
                data-tour="dish-form-image"
              >
                <Stack spacing={1} alignItems="center">
                  <AddPhotoAlternateIcon />
                  <Button variant="outlined" component="label" size="small" startIcon={<AddPhotoAlternateIcon />}>
                    {newDish.image ? newDish.image.name : (t('choose_image') || 'Upload image')}
                    <input type="file" hidden name="image" accept="image/*" onChange={handleInputChange} />
                  </Button>
                  <Typography variant="caption" color="text.secondary">
                    {t('image_hint') || 'PNG, JPG (up to 10MB)'}
                  </Typography>

                  {(previewUrl || newDish?.image) && (
                    <Box sx={{ mt: 1, width: '100%', height: 120, borderRadius: 2, overflow: 'hidden', bgcolor: 'grey.100' }}>
                      <Box component="img" src={previewUrl} alt="" sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </Box>
                  )}
                </Stack>
              </Box>

              <Box
                sx={{ p: 1.5, border: '1px dashed', borderColor: 'divider', borderRadius: 2 }}
                data-tour="dish-form-prices"
              >
                <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 700 }}>
                  {t('prices') || 'Multi-Price Editor'}
                </Typography>

                {/* ====== HERE: price rows with bigger label / smaller price ====== */}
                <Stack spacing={1}>
                  {formPrices.map((row, idx) => (
                    <Grid
                      key={row.id ?? `tmp-${idx}`}
                      container
                      spacing={1}
                      alignItems="center"
                    >
                      {/* Label + Price on the same row */}
                      <Grid xs={12} sm={9}>
                        <Box sx={{ display: 'flex', gap: 1 }}>
                          <Box sx={{ flex: 2 }}>
                            <Autocomplete
                              freeSolo
                              size="small"
                              options={[
                                'Small',
                                'Medium',
                                'Large',
                                ...existingLabels.filter(
                                  (l) => !['Small', 'Medium', 'Large'].includes(l)
                                ),
                              ]}
                              value={row.label || ''}
                              onChange={(event, newValue) => {
                                updatePriceRow(idx, { label: newValue || '' });
                              }}
                              onInputChange={(event, newInputValue) => {
                                updatePriceRow(idx, { label: newInputValue });
                              }}
                              renderInput={(params) => (
                                <TextField
                                  {...params}
                                  label={t('price_label') || 'Label'}
                                  placeholder={
                                    idx === 0
                                      ? t('small') || 'Small'
                                      : idx === 1
                                        ? t('medium') || 'Medium'
                                        : t('large') || 'Large'
                                  }
                                />
                              )}
                            />
                          </Box>

                          <Box sx={{ flex: 1 }}>
                            <TextField
                              size="small"
                              fullWidth
                              label={t('price_amount') || 'Price'}
                              value={row.price}
                              onChange={(e) =>
                                updatePriceRow(idx, { price: e.target.value })
                              }
                              inputProps={{ inputMode: 'decimal' }}
                            />
                          </Box>
                        </Box>
                      </Grid>

                      {/* Default + Remove buttons */}
                      <Grid xs={6} sm="auto">
                        <Button
                          size="small"
                          variant={row.is_default ? 'contained' : 'outlined'}
                          onClick={() => updatePriceRow(idx, { is_default: true })}
                          sx={{ borderRadius: 999 }}
                        >
                          {t('default') || 'Default'}
                        </Button>
                      </Grid>
                      <Grid xs={6} sm="auto">
                        <Tooltip title={t('remove') || 'Remove'}>
                          <IconButton
                            color="error"
                            onClick={() => removePriceRow(idx)}
                          >
                            <RemoveCircleOutlineIcon />
                          </IconButton>
                        </Tooltip>
                      </Grid>
                    </Grid>
                  ))}

                  <Box>
                    <Button
                      size="small"
                      startIcon={<AddCircleOutlineIcon />}
                      onClick={addPriceRow}
                    >
                      {t('add_price') || 'Add price'}
                    </Button>
                  </Box>
                </Stack>
              </Box>

              <Button
                fullWidth
                variant="contained"
                color="primary"
                startIcon={<SaveIcon />}
                onClick={handleAddOrEditDish}
                sx={{ borderRadius: 2 }}
                data-tour="dish-save"
              >
                {editingDishId ? (t('save_edit') || 'Save') : (t('add_dish') || 'Add / Update Dish')}
              </Button>

              {error && <Alert severity="error">{error}</Alert>}
            </Stack>
          </Card>
        </Grid>

        {/* Right: List */}
        <Grid xs={12} md={8} sx={{ minWidth: 0 }}>
          <Box sx={{ mb: 2 }}>
            <TextField
              fullWidth
              size="small"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('search_dishes') || 'Search dishes...'}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchRoundedIcon />
                  </InputAdornment>
                ),
                endAdornment: query ? (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={() => setQuery('')} aria-label="clear search">
                      <CloseRoundedIcon />
                    </IconButton>
                  </InputAdornment>
                ) : null,
              }}
            />
          </Box>

          <Card sx={{ borderRadius: 3, mb: 2, overflow: 'hidden', bgcolor: 'primary.main', color: 'primary.contrastText' }}>
            <CardContent sx={{ py: { xs: 3, md: 4 } }}>
              <Typography variant="h6" sx={{ fontWeight: 800, mb: 1 }}>
                {t('Welcome to the dish editing page') || 'Welcome to IBLA DISH — Admin'}
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.95 }}>
                {t('From here you can edit all the dishes at any time.') || 'Manage your dishes easily. Add items, update prices, and keep menus fresh.'}
              </Typography>
              <Box
                sx={(theme) => ({
                  mt: 2,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 1,
                  bgcolor: alpha(theme.palette.common.white, 0.12),
                  borderRadius: 999,
                  px: 1.5,
                  py: 0.75
                })}
              >
                <Typography variant="caption">{t('Contact support') || 'Contact support'}</Typography>
                <ChevronRightRoundedIcon fontSize="small" />
              </Box>
            </CardContent>
          </Card>

          <Card variant="outlined" sx={{ borderRadius: 3, overflow: 'hidden' }}>
            <CardContent sx={{ pb: 1 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 1.5 }}>
                {t('dish_list') || 'Dish List'}
              </Typography>

              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={filteredDishes} strategy={verticalListSortingStrategy}>
                  <Stack spacing={1.25}>
                    {filteredDishes.map((dish) => (
                      <SortableDishItem
                        key={dish.id}
                        dish={dish}
                        isRTL={isRTL}
                        handleEditDish={handleEditDish}
                        handleDeleteDish={handleDeleteDish}
                        setDeleteConfirm={setDeleteConfirm}
                        openPreview={openPreview}
                        formatEuro={formatEuro}
                        bySort={bySort}
                      />
                    ))}
                  </Stack>
                </SortableContext>
              </DndContext>
            </CardContent>
          </Card>
        </Grid>
      </Grid >

      <Dialog open={previewOpen} onClose={closePreview} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 800 }}>{previewDish?.name || t('labels.dish')}</DialogTitle>
        <DialogContent dividers sx={{ overflowX: 'hidden' }}>
          {previewDish && (
            <Stack spacing={2}>
              <Box sx={{ width: '100%', height: 260, borderRadius: 2, overflow: 'hidden', bgcolor: 'grey.100' }}>
                {previewDish.image ? (
                  <Box
                    component="img"
                    src={toImageUrl(previewDish.image)}
                    alt={previewDish.name}
                    sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <Box sx={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center', color: 'text.disabled' }}>
                    <RestaurantIcon fontSize="large" />
                  </Box>
                )}
              </Box>

              {!!previewDish.description && (
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{
                    whiteSpace: 'pre-wrap',
                    overflowWrap: 'anywhere',
                    wordBreak: 'break-word',
                    hyphens: 'auto',
                    direction: 'inherit',
                    unicodeBidi: 'plaintext',
                  }}
                >
                  {previewDish.description}
                </Typography>
              )}

              <Box>
                <Typography variant="subtitle2" sx={{ mb: .5, fontWeight: 800 }}>{t('prices') || 'Prices'}</Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap">
                  {(previewDish.prices || []).slice().sort(bySort).map((p) => (
                    <Chip
                      key={p.id || `pv-${p.sort_order}`}
                      label={`${p.label ? p.label + ' — ' : ''}${formatEuro(p.price)} €`}
                      color={p.is_default ? 'primary' : 'default'}
                      variant={p.is_default ? 'filled' : 'outlined'}
                      size="small"
                    />
                  ))}
                </Stack>
              </Box>

              {(previewDish.display_codes || previewDish.allergy_info) && (
                <Box>
                  <Typography variant="subtitle2" sx={{ mb: .5, fontWeight: 800 }}>{t('allergy_info') || 'Allergy Info'}</Typography>
                  <Stack direction="row" spacing={1} flexWrap="wrap">
                    {(previewDish.display_codes || previewDish.allergy_info).split(',').map((tag, i) => (
                      <Chip key={`pv-alg-${i}`} size="small" variant="outlined" label={tag.trim()} />
                    ))}
                  </Stack>
                </Box>
              )}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          {previewDish && (
            <Button variant="contained" onClick={() => handleEditDish(previewDish)} sx={{ borderRadius: 999 }}>
              {t('edit') || 'Edit'}
            </Button>
          )}
          <Button onClick={closePreview}>{t('actions.close') || 'Close'}</Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={deleteConfirm.open}
        onClose={() => setDeleteConfirm({ open: false, id: null })}
      >
        <DialogTitle>تأكيد الحذف</DialogTitle>
        <DialogContent>
          هل تريد حذف هذا الطبق نهائيًا؟
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirm({ open: false, id: null })}>
            إلغاء
          </Button>
          <Button
            color="error"
            onClick={async () => {
              await handleDeleteDish(deleteConfirm.id);
              setDeleteConfirm({ open: false, id: null });
            }}
          >
            حذف
          </Button>
        </DialogActions>
      </Dialog>
    </Container >
  );
};

export default DishPage;
