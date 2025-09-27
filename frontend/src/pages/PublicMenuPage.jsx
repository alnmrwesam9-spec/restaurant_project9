// src/pages/PublicMenuPage.jsx
// -----------------------------------------------------------------------------
// Public menu page (mockup-matched UI) + mobile-optimized layout
// - Clean topbar (brand only)
// - Languages inside hero card (small pills)
// - Mobile: horizontal scroller per section (compact cards)
// - Desktop: 3-col grid
// - Hero section pills: single-row horizontal scroller
// - Card: PRICE FIRST then name (multi-price friendly, RTL-aware)
// - Dialog: price chips next to title, no restaurant info
// - Nice pop/blur animation, print friendly
// -----------------------------------------------------------------------------

import React, { useEffect, useMemo, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import axios from '../services/axios';
import {
  Box, Container, Typography, CircularProgress, Alert, Grid, Card,
  CardContent, Chip, TextField, InputAdornment, IconButton, Tooltip,
  Divider, Avatar, Stack, Button, useScrollTrigger, useMediaQuery, Dialog,
  Grow
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import SearchIcon from '@mui/icons-material/Search';
import ShareIcon from '@mui/icons-material/Share';
import PrintIcon from '@mui/icons-material/Print';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import PhoneIcon from '@mui/icons-material/Phone';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import CloseIcon from '@mui/icons-material/Close';
import ShoppingBagIcon from '@mui/icons-material/ShoppingBag';
import { useTranslation } from 'react-i18next';

/* ---------- Helpers ---------- */
const LANGS = ['ar', 'de', 'en'];
const PLACEHOLDER = '/static/img/dish-placeholder.png';

function parseTheme(themeStr) {
  const fallback = { mode: 'light', bg: '#f6f8fb', text: '#0f172a', icon: '#2bbdbe' };
  if (!themeStr || typeof themeStr !== 'string') return fallback;
  const val = themeStr.trim().toLowerCase();
  if (val === 'dark') return { mode: 'dark', bg: '#0b0e13', text: '#f5f7fb', icon: '#2bbdbe' };
  if (val === 'light' || val === 'default') return fallback;
  if (val.startsWith('custom3:') || val.startsWith('custom:')) {
    const raw = themeStr.split(':')[1] || '';
    const [bg = fallback.bg, text = fallback.text, icon = fallback.icon] = raw.split(',').map((s) => s.trim());
    return { mode: 'light', bg, text, icon };
  }
  return fallback;
}

function formatPriceEUR(value, locale = 'de-DE') {
  if (value == null || value === '') return null;
  const num = Number(String(value).replace(',', '.'));
  if (!Number.isFinite(num)) return null;
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' }).format(num);
  } catch {
    return `${num.toFixed(2)} €`;
  }
}

function isMatch(q, ...fields) {
  if (!q) return true;
  const needle = q.toLowerCase();
  return fields.some((f) => (f || '').toLowerCase().includes(needle));
}

const slugify = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]+/gi, '-');

function publicDishImageSources(dish, ds, rp) {
  const list = [];
  if (dish?.image) list.push(dish.image);
  if (ds?.logo) list.push(ds.logo);
  if (rp?.avatar) list.push(rp.avatar);
  if (rp?.logo) list.push(rp.logo);
  list.push(PLACEHOLDER);
  const seen = new Set();
  return list.filter((u) => {
    const key = String(u || '').trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function DishImage({ sources, alt, sx }) {
  const [idx, setIdx] = useState(0);
  const src = sources[idx] || PLACEHOLDER;
  return (
    <Box
      component="img"
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => setIdx((i) => (i + 1 < sources.length ? i + 1 : i))}
      sx={sx}
    />
  );
}

/* ---------- Component ---------- */
export default function PublicMenuPage() {
  const { publicSlug } = useParams();
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const isMdUp = useMediaQuery(theme.breakpoints.up('md'));

  const [loading, setLoading] = useState(true);
  const [menu, setMenu] = useState(null);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [activeSectionId, setActiveSectionId] = useState(null);
  const [selectedDish, setSelectedDish] = useState(null);

  const sectionRefs = useRef({});

  const isRTL = i18n.language?.startsWith('ar');
  const dir = isRTL ? 'rtl' : 'ltr';

  // Persist language per-menu
  useEffect(() => {
    const key = `publicMenu.lang.${publicSlug}`;
    const saved = localStorage.getItem(key);
    if (saved && LANGS.includes(saved)) i18n.changeLanguage(saved);
  }, [publicSlug, i18n]);

  useEffect(() => {
    const key = `publicMenu.lang.${publicSlug}`;
    try {
      localStorage.setItem(key, i18n.language);
    } catch {}
  }, [i18n.language, publicSlug]);

  // Fetch public payload
  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError('');
    axios
      .get(`/public/menus/${publicSlug}/`)
      .then((res) => {
        if (mounted) setMenu(res.data || null);
      })
      .catch((e) => {
        if (!mounted) return;
        console.error('PublicMenuPage load error:', e?.response?.status, e?.response?.data || e?.message);
        setError(t('public_menu_error') || 'تعذر تحميل الصفحة العامة لهذه القائمة أو أنها غير منشورة.');
        setMenu(null);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [publicSlug, t]);

  const rp = menu?.restaurant_profile || {};
  const ds = menu?.display_settings || {};
  const parsedTheme = useMemo(() => parseTheme(ds?.theme || rp?.theme || 'default'), [ds?.theme, rp?.theme]);

  const sections = useMemo(() => {
    const arr = menu?.sections || [];
    return [...arr].sort(
      (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || String(a.name).localeCompare(String(b.name))
    );
  }, [menu]);

  // Unique section pills
  const sectionOptions = useMemo(() => {
    const arr = sections.map((s) => ({ id: s.id ?? slugify(s.name), name: s.name }));
    const map = new Map();
    for (const o of arr) if (!map.has(o.id)) map.set(o.id, o);
    return Array.from(map.values());
  }, [sections]);

  const filteredSections = useMemo(() => {
    const q = query.trim();
    const list = activeSectionId ? sections.filter((s) => (s.id ?? slugify(s.name)) === activeSectionId) : sections;
    return list
      .map((s) => ({
        ...s,
        dishes: (s.dishes || []).filter((d) => isMatch(q, d.name, d.description, d.display_codes)),
      }))
      .filter((s) => s.dishes && s.dishes.length > 0);
  }, [sections, query, activeSectionId]);

  const publicUrl = useMemo(() => `${window.location.origin}/show/menu/${publicSlug}`, [publicSlug]);

  const onShare = async (dish) => {
    try {
      const title = dish ? dish.name : (ds.display_name || rp.display_name || menu?.name || 'Menu');
      const url = dish ? `${publicUrl}#dish-${dish.id ?? slugify(dish?.name)}` : publicUrl;
      if (navigator.share) {
        await navigator.share({ title, text: title, url });
      } else {
        await navigator.clipboard.writeText(url);
        alert(t('copied') || 'Copied');
      }
    } catch {}
  };
  const onPrint = () => window.print();

  const trigger = useScrollTrigger({ disableHysteresis: true, threshold: 120 });

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ mt: 6, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress />
      </Container>
    );
  }
  if (error || !menu) {
    return (
      <Container maxWidth="lg" sx={{ mt: 6 }}>
        <Alert severity="error" sx={{ mb: 2 }}>
          {error || t('public_menu_not_available') || 'القائمة غير متاحة.'}
        </Alert>
      </Container>
    );
  }

  const bgHero = ds.hero_image || rp.hero_image || '';
  const logoUrl = ds.logo || rp.logo || '';
  const title = ds.display_name || rp.display_name || menu.name || 'Restaurant';
  const address = ds.address || rp.address || '';
  const phone = ds.phone || rp.phone || '';
  const hours = ds.hours || rp.hours || '';

  const searchBg = parsedTheme.mode === 'dark' ? 'rgba(15,18,22,0.62)' : 'rgba(255,255,255,0.82)';

  const scrollToSection = (id) => {
    setActiveSectionId((cur) => (cur === id ? null : id));
    const el = sectionRefs.current[id];
    if (el) {
      const y = el.getBoundingClientRect().top + window.scrollY - 88;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
  };

  // price chips helper
  const getSortedPrices = (dish) => {
    const prices = Array.isArray(dish.prices)
      ? dish.prices
      : (dish.price != null ? [{ id: 'single', label: '', price: dish.price, is_default: true }] : []);
    return prices
      .slice()
      .sort(
        (a, b) =>
          (a?.is_default === b?.is_default ? 0 : a.is_default ? -1 : 1) ||
          (a?.sort_order ?? 0) - (b?.sort_order ?? 0)
      );
  };

  const PriceChips = ({ dish, max }) => {
    const sorted = getSortedPrices(dish);
    const shown = typeof max === 'number' ? sorted.slice(0, max) : sorted;
    const extra = typeof max === 'number' ? Math.max(0, sorted.length - max) : 0;
    return (
      <Stack direction="row" spacing={0.6} alignItems="center" flexWrap="nowrap">
        {shown.map((p) => (
          <Chip
            key={p.id || `${p.label}-${p.price}`}
            size="small"
            label={`${p.label ? p.label + ' · ' : ''}${formatPriceEUR(
              p.price,
              i18n.language === 'ar' ? 'de-DE' : i18n.language
            )}`}
            sx={{
              borderRadius: 999,
              bgcolor: p.is_default ? '#1d4ed8' : '#e5e7eb',
              color: p.is_default ? '#fff' : '#0f172a',
              fontWeight: 800,
              height: 26,
            }}
          />
        ))}
        {extra > 0 && (
          <Chip
            size="small"
            label={`+${extra}`}
            sx={{ borderRadius: 999, bgcolor: '#f1f5f9', color: '#0f172a', fontWeight: 800, height: 26 }}
          />
        )}
      </Stack>
    );
  };

  // Reusable dish card (used in grid and slider)
  const DishCard = ({ dish, imgSources, compact = false }) => (
    <Card
      onClick={() => setSelectedDish({ ...dish, imgSources })}
      elevation={0}
      sx={{
        cursor: 'pointer',
        borderRadius: 3,
        border: '1px solid #e5e7eb',
        bgcolor: '#fff',
        overflow: 'hidden',
        boxShadow: '0 4px 16px rgba(0,0,0,0.06)',
        transition: 'transform .18s ease, box-shadow .18s ease',
        '&:hover': { transform: 'translateY(-3px)', boxShadow: '0 10px 24px rgba(0,0,0,0.10)' },
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        scrollSnapAlign: compact ? 'start' : 'initial',
      }}
    >
      <DishImage
        sources={imgSources}
        alt={dish.name}
        sx={{
          width: '100%',
          height: compact ? { xs: 140, sm: 180 } : { xs: 160, sm: 200, md: 220 },
          objectFit: 'cover',
          display: 'block'
        }}
      />

      <CardContent sx={{ flexGrow: 1, py: compact ? 1.25 : 2 }}>
        {/* PRICE FIRST then name */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, mb: compact ? 0.6 : 0.8 }}>
          <Box sx={{ minWidth: 0, maxWidth: '55%', overflow: 'hidden' }}>
            <PriceChips dish={dish} max={2} />
          </Box>
          <Typography
            variant="subtitle1"
            sx={{
              fontWeight: 800,
              lineHeight: 1.15,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              maxWidth: '45%',
              textAlign: 'end',
            }}
            title={dish.name}
          >
            {dish.name}
          </Typography>
        </Box>

        {dish.description ? (
          <Typography
            variant="body2"
            sx={{
              color: '#475569',
              mb: compact ? 0.75 : 1,
              display: '-webkit-box',
              WebkitLineClamp: compact ? 2 : 3,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {dish.description}
          </Typography>
        ) : null}

        {(dish.display_codes || dish.allergy_info) ? (
          <Stack direction="row" spacing={0.5} flexWrap="wrap">
            {(dish.display_codes || dish.allergy_info || '')
              .split(',').map((c) => c.trim()).filter(Boolean).map((c) => (
                <Chip key={c} size="small" label={c} variant="outlined" sx={{ borderColor: '#e5e7eb', bgcolor: '#f8fafc', height: 22 }} />
              ))}
          </Stack>
        ) : null}
      </CardContent>
    </Card>
  );

  return (
    <Box
      dir={dir}
      sx={{
        '--container-w': '1200px',
        '--radius': '16px',
        '--c-bg': parsedTheme.bg,
        '--c-text': parsedTheme.text,
        '--c-icon': parsedTheme.icon,
        bgcolor: parsedTheme.mode === 'dark' ? 'var(--c-bg)' : '#f5f7fb',
        color: 'var(--c-text)',
        minHeight: '100vh',
      }}
    >
      {/* Top Bar — brand only */}
      <Box
        sx={{
          position: 'sticky', top: 0, zIndex: 50, px: 2, py: 1.25,
          display: 'flex', alignItems: 'center', gap: 1.25,
          backdropFilter: trigger ? 'saturate(120%) blur(10px)' : 'none',
          borderBottom: (th) => (trigger ? `1px solid ${th.palette.divider}` : 'none'),
          bgcolor: trigger ? (parsedTheme.mode === 'dark' ? 'rgba(8,10,12,0.6)' : 'rgba(255,255,255,0.9)') : 'transparent',
          transition: 'all .25s ease',
        }}
      >
        <Avatar src={logoUrl || undefined} sx={{ bgcolor: '#fff', color: 'var(--c-text)', border: '1px solid #e5e7eb', width: 36, height: 36 }}>
          {!logoUrl && (title?.[0] || 'R')}
        </Avatar>
        <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>{title}</Typography>
      </Box>

      {/* Hero */}
      <Box sx={{ position: 'relative', width: '100%', height: { xs: 200, md: 380 }, backgroundImage: bgHero ? `url(${bgHero})` : 'none', backgroundSize: 'cover', backgroundPosition: 'center', overflow: 'hidden' }}>
        <Box sx={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(0,0,0,0.15), rgba(0,0,0,0.35))' }} />
        <Container maxWidth={false} sx={{ position: 'relative', height: '100%', px: 1 }}>
          <Box
            sx={{
              position: 'absolute',
              left: '50%', transform: 'translateX(-50%)',
              bottom: { xs: 14, md: 56 },
              width: { xs: 'min(92%, 480px)', sm: 'min(92%, 620px)', md: 'min(70%, 760px)' }, // ← أصغر كما طلبت
              p: { xs: 1, md: 2.25 },
              bgcolor: searchBg,
              border: '1px solid rgba(0,0,0,0.08)',
              boxShadow: '0 10px 30px rgba(0,0,0,0.12)',
              borderRadius: 2.5,
              backdropFilter: 'saturate(140%) blur(8px)',
              textAlign: 'center'
            }}
          >
            {/* Lang pills inside hero */}
            <Stack direction="row" spacing={0.5} justifyContent="flex-end" sx={{ mb: 0.6 }}>
              {LANGS.map((lng) => (
                <Button
                  key={lng}
                  size="small"
                  onClick={() => i18n.changeLanguage(lng)}
                  variant={i18n.language?.startsWith(lng) ? 'contained' : 'text'}
                  sx={{ color: i18n.language?.startsWith(lng) ? '#000' : 'var(--c-text)', bgcolor: i18n.language?.startsWith(lng) ? '#e5e7eb' : 'transparent', borderRadius: 999, minWidth: 36, px: 1 }}
                >
                  {lng.toUpperCase()}
                </Button>
              ))}
            </Stack>

            <TextField
              fullWidth
              placeholder={t('search_in_menu') || (isRTL ? 'ابحث عن طبق...' : 'Search the menu...')}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              InputProps={{ startAdornment: (<InputAdornment position="start"><SearchIcon /></InputAdornment>) }}
              sx={{
                '& .MuiOutlinedInput-root': { borderRadius: 999, height: { xs: 38, md: 44 } },
                '& input': { color: 'var(--c-text)' },
                '& .MuiOutlinedInput-notchedOutline': { borderColor: 'transparent' },
                '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'transparent' },
                mb: 0.8
              }}
            />
            {/* Section pills — single-row horizontal scroller */}
            <Box
              sx={{
                display: 'flex',
                gap: 1,
                overflowX: 'auto',
                whiteSpace: 'nowrap',
                pb: 0.5,
                mx: -0.5,
                px: 0.5,
                '&::-webkit-scrollbar': { display: 'none' },
                scrollbarWidth: 'none',
                msOverflowStyle: 'none',
              }}
            >
              {sectionOptions.map((opt) => {
                const active = activeSectionId === opt.id;
                return (
                  <Chip
                    key={opt.id}
                    label={opt.name}
                    onClick={() => scrollToSection(opt.id)}
                    clickable
                    sx={{
                      flex: '0 0 auto',
                      borderRadius: 999,
                      bgcolor: active ? '#0f172a' : '#e5e7eb',
                      color: active ? '#fff' : '#0f172a',
                      fontWeight: 700,
                      height: 28,
                      '& .MuiChip-label': { px: 1.2 }
                    }}
                  />
                );
              })}
            </Box>
          </Box>
        </Container>
      </Box>

      {/* Spacer under hero card */}
      <Box sx={{ height: { xs: 10, sm: 28, md: 72 } }} />

      {/* Info row */}
      <Container maxWidth={false} sx={{ maxWidth: 'min(var(--container-w), 100%)', px: 2 }}>
        <Stack direction="row" spacing={1} sx={{ mb: 2 }} flexWrap="wrap" alignItems="center" justifyContent="center" useFlexGap>
          {hours ? <Chip icon={<AccessTimeIcon />} label={hours} sx={{ bgcolor: '#fff', border: '1px solid #e5e7eb', borderRadius: 999, height: 32 }} variant="outlined" /> : null}
          {phone ? <Chip icon={<PhoneIcon />} label={phone} sx={{ bgcolor: '#fff', border: '1px solid #e5e7eb', borderRadius: 999, height: 32 }} variant="outlined" /> : null}
          {address ? <Chip icon={<LocationOnIcon />} label={address} sx={{ bgcolor: '#fff', border: '1px solid #e5e7eb', borderRadius: 999, height: 32 }} variant="outlined" /> : null}
        </Stack>

        <Divider sx={{ mb: 2, borderColor: '#e5e7eb' }} />

        {/* Sections */}
        {filteredSections.length === 0 ? (
          <Alert severity="info">{t('no_results') || 'لا توجد نتائج.'}</Alert>
        ) : (
          filteredSections.map((section) => {
            const secId = section.id ?? slugify(section.name);
            const dishes = section.dishes || [];
            return (
              <Box key={secId} sx={{ mb: 5 }} ref={(el) => (sectionRefs.current[secId] = el)}>
                <Typography variant="h6" sx={{ fontWeight: 900, mb: 1.5 }}>{section.name}</Typography>

                {/* Mobile: horizontal scroller; Desktop: 3-col grid */}
                {!isMdUp ? (
                  <Box
                    sx={{
                      display: 'flex',
                      gap: 1.25,
                      overflowX: 'auto',
                      pb: 1,
                      mx: -1,
                      px: 1,
                      scrollSnapType: 'x mandatory',
                      WebkitOverflowScrolling: 'touch',
                      '&::-webkit-scrollbar': { display: 'none' },
                      scrollbarWidth: 'none',
                      msOverflowStyle: 'none',
                    }}
                  >
                    {dishes.map((dish) => {
                      const imgSources = publicDishImageSources(dish, ds, rp);
                      return (
                        <Box key={dish.id} sx={{ minWidth: 260, maxWidth: 280, flex: '0 0 auto' }} id={`dish-${dish.id ?? slugify(dish.name)}`}>
                          <DishCard dish={dish} imgSources={imgSources} compact />
                        </Box>
                      );
                    })}
                  </Box>
                ) : (
                  <Grid container spacing={2}>
                    {dishes.map((dish) => {
                      const imgSources = publicDishImageSources(dish, ds, rp);
                      return (
                        <Grid item xs={12} sm={6} md={4} key={dish.id} id={`dish-${dish.id ?? slugify(dish.name)}`}>
                          <DishCard dish={dish} imgSources={imgSources} />
                        </Grid>
                      );
                    })}
                  </Grid>
                )}
              </Box>
            );
          })
        )}
      </Container>

      {/* Footer */}
      <Box sx={{ mt: 6, mb: 4, textAlign: 'center', color: 'var(--c-text)' }}>
        <Typography variant="caption" sx={{ opacity: 0.8 }}>
          {title} — {t('public_menu') || (isRTL ? 'عرض قائمة عامة' : 'Public Menu')}
        </Typography>
      </Box>

      {/* Floating tools */}
      <Stack spacing={1} sx={{ position: 'fixed', right: 16, bottom: 16, zIndex: 1000 }}>
        <Tooltip title={t('to_top') || (isRTL ? 'إلى الأعلى' : 'To top')}>
          <IconButton onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} sx={{ bgcolor: 'var(--c-icon)', color: '#000', '&:hover': { bgcolor: 'var(--c-icon)' } }}>
            <ArrowUpwardIcon />
          </IconButton>
        </Tooltip>
      </Stack>

      {/* Dish Details Dialog */}
      <Dialog
        open={!!selectedDish}
        onClose={() => setSelectedDish(null)}
        fullWidth
        maxWidth="sm"
        TransitionComponent={Grow}
        transitionDuration={360}
        slotProps={{
          backdrop: {
            sx: {
              backdropFilter: 'blur(8px) saturate(120%)',
              backgroundColor: 'rgba(15,23,42,0.25)',
            }
          }
        }}
        PaperProps={{
          sx: {
            overflow: 'hidden',
            borderRadius: { xs: 2, sm: 3 },
            bgcolor: 'rgba(255,255,255,0.78)',
            backdropFilter: 'saturate(160%) blur(12px)',
            border: '1px solid rgba(0,0,0,0.07)',
            boxShadow: '0 30px 70px rgba(0,0,0,0.28)',
            transformOrigin: 'center bottom',
            animation: 'pop .42s cubic-bezier(.2,.75,.2,1) both',
            '@keyframes pop': {
              from: { opacity: 0, transform: 'translateY(16px) scale(.98)' },
              to: { opacity: 1, transform: 'translateY(0) scale(1)' }
            }
          },
        }}
      >
        {selectedDish && (
          <Box>
            {/* header image */}
            <Box sx={{ position: 'relative' }}>
              <DishImage
                sources={selectedDish.imgSources || publicDishImageSources(selectedDish, ds, rp)}
                alt={selectedDish.name}
                sx={{ width: '100%', height: { xs: 200, md: 240 }, objectFit: 'cover', display: 'block' }}
              />
              <Stack direction="row" spacing={1} sx={{ position: 'absolute', top: 12, right: 12 }}>
                {!!selectedDish.is_new && (
                  <Chip label={isRTL ? 'جديد' : 'NEW'} size="small"
                        sx={{ borderRadius: 999, bgcolor: '#2563eb', color: '#fff', fontWeight: 800 }} />
                )}
              </Stack>
              <IconButton
                onClick={() => setSelectedDish(null)}
                sx={{ position: 'absolute', top: 8, left: 8, bgcolor: 'rgba(255,255,255,0.92)' }}
              >
                <CloseIcon />
              </IconButton>
            </Box>

            {/* body */}
            <Box sx={{ p: { xs: 2.2, md: 3 } }}>
              {/* Title + Prices */}
              <Box sx={{ display: 'flex', alignItems: 'start', justifyContent: 'space-between', gap: 2, mb: 1 }}>
                <Typography variant="h6" sx={{ fontWeight: 900, lineHeight: 1.2 }}>
                  {selectedDish.name}
                </Typography>

                <Stack direction="row" spacing={0.75} flexWrap="wrap" justifyContent="flex-end">
                  {(Array.isArray(selectedDish.prices) && selectedDish.prices.length > 0) ? (
                    [...selectedDish.prices]
                      .sort((a, b) => (a.is_default === b.is_default ? (a.sort_order ?? 0) - (b.sort_order ?? 0) : a.is_default ? -1 : 1))
                      .map((p) => (
                        <Chip
                          key={p.id || `${p.label}-${p.price}`}
                          label={`${p.label ? p.label + ' · ' : ''}${formatPriceEUR(p.price, i18n.language === 'ar' ? 'de-DE' : i18n.language)}`}
                          size="small"
                          sx={{
                            borderRadius: 999,
                            bgcolor: p.is_default ? '#1d4ed8' : '#e5e7eb',
                            color: p.is_default ? '#fff' : '#0f172a',
                            fontWeight: 800,
                            height: 28,
                          }}
                        />
                      ))
                  ) : (
                    <Chip
                      label={formatPriceEUR(selectedDish.price, i18n.language === 'ar' ? 'de-DE' : i18n.language)}
                      size="small"
                      sx={{ borderRadius: 999, bgcolor: '#1d4ed8', color: '#fff', fontWeight: 800, height: 28 }}
                    />
                  )}
                </Stack>
              </Box>

              {selectedDish.description ? (
                <Typography variant="body1" sx={{ color: '#334155', mb: 2 }}>
                  {selectedDish.description}
                </Typography>
              ) : null}

              {(selectedDish.display_codes || selectedDish.allergy_info) && (
                <>
                  <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1 }}>
                    {isRTL ? 'الحساسيّات' : 'Allergens'}
                  </Typography>
                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 2 }}>
                    {(selectedDish.display_codes || selectedDish.allergy_info || '')
                      .split(',').map((c) => c.trim()).filter(Boolean).map((c) => (
                        <Chip key={c} label={c}
                              sx={{ borderRadius: 999, bgcolor: '#eef2ff', border: '1px solid #e5e7eb' }} />
                      ))}
                  </Stack>
                </>
              )}

              <Stack direction="row" alignItems="center" spacing={1.25}>
                <Button
                  variant="contained"
                  startIcon={<ShoppingBagIcon />}
                  sx={{
                    flexGrow: 1,
                    borderRadius: 2,
                    py: 1.1,
                    background: '#1d4ed8',
                    boxShadow: 'none',
                    '&:hover': { background: '#1e40af', boxShadow: 'none' },
                  }}
                  onClick={() => {
                    alert(isRTL ? 'تم إضافة الطلب (تجريبي).' : 'Order added (demo).');
                  }}
                >
                  {isRTL ? 'اطلب الآن' : 'Order Now'}
                </Button>

                <Tooltip title={t('share') || (isRTL ? 'مشاركة' : 'Share')}>
                  <IconButton onClick={() => onShare(selectedDish)} sx={{ bgcolor: '#fff', border: '1px solid #e5e7eb' }}>
                    <ShareIcon />
                  </IconButton>
                </Tooltip>
                <Tooltip title={t('print') || (isRTL ? 'طباعة' : 'Print')}>
                  <IconButton onClick={onPrint} sx={{ bgcolor: '#fff', border: '1px solid #e5e7eb' }}>
                    <PrintIcon />
                  </IconButton>
                </Tooltip>
              </Stack>
            </Box>
          </Box>
        )}
      </Dialog>

      {/* Print styles */}
      <style>{`
        @media print {
          .MuiContainer-root { max-width: 100% !important; padding: 0 12mm !important; }
          .MuiButtonBase-root[aria-label="share"], .MuiButtonBase-root[aria-label="print"], [role="tooltip"], .MuiStack-root[style*="position: fixed"] { display: none !important; }
          * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          img { break-inside: avoid; }
          .MuiCard-root { page-break-inside: avoid; }
        }
      `}</style>
    </Box>
  );
}
