// src/pages/PublicMenuPage.jsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FixedSizeList as VirtualList } from 'react-window';
import { useParams } from 'react-router-dom';
import axios from '../services/axios';
import PublicOpeningHours from '../components/PublicOpeningHours';
import {
  Alert, Avatar, Box, Button, Card, CardContent, Chip, CircularProgress, Container,
  Dialog, IconButton, InputAdornment, Stack, TextField, Tooltip, Typography,
  useMediaQuery, useScrollTrigger
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import SearchIcon from '@mui/icons-material/Search';
import ShareIcon from '@mui/icons-material/Share';
import PrintIcon from '@mui/icons-material/Print';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import CloseIcon from '@mui/icons-material/Close';
import ShoppingBagIcon from '@mui/icons-material/ShoppingBag';

import { useTranslation } from 'react-i18next';
import { motion, useMotionValue, useTransform } from 'framer-motion';

const PLACEHOLDER = '/static/img/dish-placeholder.png';
const CARD_HEIGHT_MD = 360;

/* ========== ثيم افتراضي ========== */
const fallback = {
  mode: 'light', bg: '#f6f8fb', text: '#0f172a', icon: '#ff8a50',
  font: '', scale: 1,
  price_color: '#1d4ed8', price_scale: 1,
  placeholder_gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  show_logo: 1, show_hero: 1, show_search: 1, show_sections: 1, show_prices: 1, show_images: 1,
};

/* ========== German-only allergen chip ========== */
const AllergenChip = ({ dish, sx, withTooltip = true }) => {
  const codes = (dish?.display_codes || '').toString().trim();
  if (!codes) return null;

  const chip = (
    <Chip
      size="small"
      label={codes}
      variant="filled"
      sx={{
        zIndex: 2,
        bgcolor: '#fff',
        color: '#111827',
        border: '1px solid #e5e7eb',
        boxShadow: '0 2px 10px rgba(0,0,0,.08)',
        fontWeight: 800,
        height: 26,
        '& .MuiChip-label': { px: 1.25, letterSpacing: .25 },
        ...sx,
      }}
    />
  );

  if (!withTooltip) return chip;

  const tip = dish?.allergen_explanation_de || codes;

  return (
    <Tooltip title={tip} arrow>
      {chip}
    </Tooltip>
  );
};

/* ===== Dialog Allergen Codes (German-only) =====
   - Displays allergen codes in dialog
   - Uses only display_codes field
 */
const DialogAllergenCodes = ({ dish, isRTL = false, sx }) => {
  const raw = (dish?.display_codes || '').toString().trim();
  if (!raw) return null;

  const parts = raw.split(/[\s,;/|]+/g).map(s => s.trim()).filter(Boolean);
  if (!parts.length) return null;

  // Close button is on the right => codes on the left
  const sidePosition = isRTL ? { left: 12 } : { left: 12 };

  return (
    <Stack
      direction="row"
      spacing={0.75}
      sx={{
        position: 'absolute',
        top: 12,
        zIndex: 5,              // Above image
        pointerEvents: 'none',  // Don't block button clicks
        ...sidePosition,
        ...sx
      }}
    >
      {parts.map((p, i) => (
        <Chip
          key={`${p}-${i}`}
          size="small"
          label={p.toUpperCase()}
          variant="filled"
          sx={{
            bgcolor: '#fff',
            color: '#111827',
            border: '1px solid #e5e7eb',
            boxShadow: '0 2px 10px rgba(0,0,0,.08)',
            fontWeight: 800,
            height: 26,
            '& .MuiChip-label': { px: 1, letterSpacing: .25 },
          }}
        />
      ))}
    </Stack>
  );
};

/* ========== أدوات مساعدة ========== */
function parseTheme(themeStr) {
  if (!themeStr || typeof themeStr !== 'string') return { ...fallback };
  const val = themeStr.trim();
  if (val === 'dark') return { ...fallback, mode: 'dark', bg: '#0b0e13', text: '#f5f7fb' };
  if (val === 'light' || val === 'default') return { ...fallback };

  const splitCommaSafe = (s) => {
    const parts = []; let buf = ''; let quote = '';
    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      if (quote) { if (ch === quote) quote = ''; buf += ch; }
      else if (ch === '"' || ch === "'") { quote = ch; buf += ch; }
      else if (ch === ',') { if (buf.trim()) parts.push(buf.trim()); buf = ''; }
      else { buf += ch; }
    }
    if (buf.trim()) parts.push(buf.trim());
    return parts;
  };

  if (val.startsWith('custom3:')) {
    const raw = val.split(':')[1] || '';
    const [bg = fallback.bg, text = fallback.text, icon = fallback.icon] = splitCommaSafe(raw).map((s) => s.trim());
    return { ...fallback, mode: 'light', bg, text, icon };
  }
  if (val.startsWith('custom:')) {
    const out = { ...fallback, mode: 'custom' };
    const raw = val.split(':')[1] || '';
    for (const kv of splitCommaSafe(raw)) {
      const i = kv.indexOf('='); if (i < 0) continue;
      const k = kv.slice(0, i).trim(); let v = kv.slice(i + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      if (k === 'bg' || k === 'text' || k === 'icon' || k === 'font' || k === 'price_color' || k === 'placeholder_gradient') out[k] = v;
      else if (k === 'scale' || k === 'price_scale') {
        const n = parseFloat(String(v).replace(',', '.'));
        if (Number.isFinite(n)) out[k] = n;
      } else if (k.startsWith('show_')) out[k] = String(v) === '0' ? 0 : 1;
    }
    return out;
  }
  return { ...fallback };
}

function formatPriceEUR(value, locale = 'de-DE') {
  if (value == null || value === '') return null;
  const num = Number(String(value).replace(',', '.'));
  if (!Number.isFinite(num)) return null;
  try { return new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' }).format(num); }
  catch { return `${num.toFixed(2)} €`; }
}
function isMatch(q, ...fields) {
  if (!q) return true;
  const s = q.toLowerCase();
  return fields.some((f) => (f || '').toLowerCase().includes(s));
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

/* صورة موحّدة الارتفاع */
function DishImage({ sources, alt }) {
  const [idx, setIdx] = useState(0);
  const src = sources[idx] || PLACEHOLDER;
  return (
    <Box sx={{ position: 'relative', width: '100%', height: 160, bgcolor: '#f3f4f6' }}>
      <Box
        component="img"
        src={src}
        alt={alt}
        loading="lazy"
        onError={() => setIdx((i) => (i + 1 < sources.length ? i + 1 : i))}
        sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center', display: 'block' }}
      />
    </Box>
  );
}

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
  // Force German language for public view and remove language switcher
  useEffect(() => { try { i18n.changeLanguage('de'); } catch { } }, [i18n]);


  /* تحميل البيانات */
  useEffect(() => {
    let mounted = true;
    setLoading(true); setError('');
    axios.get(`/public/menus/${publicSlug}/?_=${Date.now()}`)
      .then((res) => { if (mounted) setMenu(res.data || null); })
      .catch(() => { if (mounted) { setMenu(null); setError(t('public_menu_error') || 'تعذر التحميل.'); } })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [publicSlug, t]);

  /* Toggle favorite dish removed - Visitor cannot toggle */

  const rp = menu?.restaurant_profile || {};
  const ds = menu?.display_settings || {};
  const parsedTheme = useMemo(() => parseTheme(ds?.theme || rp?.theme || 'default'), [ds?.theme, rp?.theme]);

  /* إظهار الصور من الإعدادات */
  const _showImagesRaw = (ds?.show_images ?? parsedTheme.show_images ?? 1);
  const showImages = _showImagesRaw === 1 || _showImagesRaw === true || String(_showImagesRaw) === '1';

  /* تحميل خط جوجل */
  useEffect(() => {
    const full = parsedTheme.font || '';
    if (!full) return () => { };
    let family = '';
    const m = full.match(/^\s*(["'])(.*?)\1/);
    family = m ? m[2] : (full.split(',')[0]?.trim().replace(/^(["'])|(["'])$/g, '') || '');
    if (!family) return () => { };
    const href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family).replace(/%20/g, '+')}\:wght@400;600;700;800&display=swap`;
    let link = document.getElementById('public-font-link');
    if (!link) { link = document.createElement('link'); link.id = 'public-font-link'; link.rel = 'stylesheet'; document.head.appendChild(link); }
    link.href = href;
    return () => { const el = document.getElementById('public-font-link'); if (el && el.href === href) try { el.remove(); } catch { } };
  }, [parsedTheme.font]);

  const sections = useMemo(() => {
    const arr = menu?.sections || [];
    return [...arr].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || String(a.name).localeCompare(String(b.name)));
  }, [menu]);

  const sectionOptions = useMemo(() => {
    const arr = sections.map((s) => ({ id: s.id ?? slugify(s.name), name: s.name }));
    const map = new Map(); for (const o of arr) if (!map.has(o.id)) map.set(o.id, o);
    return Array.from(map.values());
  }, [sections]);

  const filteredSections = useMemo(() => {
    const q = query.trim();
    const list = q ? sections : (activeSectionId ? sections.filter((s) => (s.id ?? slugify(s.name)) === activeSectionId) : sections);
    return list.map((s) => ({ ...s, dishes: (s.dishes || []).filter((d) => isMatch(q, d.name, d.description, d.display_codes)) }))
      .filter((s) => s.dishes && s.dishes.length > 0);
  }, [sections, query, activeSectionId]);

  const favoriteDishes = useMemo(() => {
    if (query.trim()) return []; // Hide recommendations when searching
    return (menu?.sections || []).flatMap(s => s.dishes || []).filter(d => d.is_favorite);
  }, [menu, query]);

  const publicUrl = useMemo(() => `${window.location.origin}/show/menu/${publicSlug}`, [publicSlug]);
  const onShare = async (dish) => {
    try {
      const title = dish ? dish.name : (ds.display_name || rp.display_name || menu?.name || 'Menu');
      const url = dish ? `${publicUrl}#dish-${dish.id ?? slugify(dish?.name)}` : publicUrl;
      if (navigator.share) await navigator.share({ title, text: title, url });
      else { await navigator.clipboard.writeText(url); alert(t('copied') || 'Copied'); }
    } catch { }
  };
  const onPrint = () => window.print();
  useScrollTrigger({ disableHysteresis: true, threshold: 120 });

  if (loading) {
    return <Container maxWidth="lg" sx={{ mt: 6, display: 'flex', justifyContent: 'center' }}><CircularProgress /></Container>;
  }
  if (error || !menu) {
    return <Container maxWidth="lg" sx={{ mt: 6 }}><Alert severity="error" sx={{ mb: 2 }}>{error || (t('public_menu_not_available') || 'القائمة غير متاحة.')}</Alert></Container>;
  }

  const bgHero = parsedTheme.show_hero ? (ds.hero_image || rp.hero_image || '') : '';
  const heroCrop = ds.hero_crop || 'center';
  const logoUrl = parsedTheme.show_logo ? (ds.logo || rp.logo || '') : '';
  const title = ds.display_name || rp.display_name || menu.name || 'Restaurant';
  const priceColor = parsedTheme.price_color || '#1d4ed8';
  const priceScale = parsedTheme.price_scale || 1;

  const scrollToSection = (id) => {
    setActiveSectionId((cur) => (cur === id ? null : id));
    const el = sectionRefs.current[id];
    if (el) {
      const y = el.getBoundingClientRect().top + window.scrollY - 88;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
  };

  const getSortedPrices = (dish) => {
    const prices = Array.isArray(dish.prices) ? dish.prices : (dish.price != null ? [{ id: 'single', label: '', price: dish.price, is_default: true }] : []);
    return prices.slice().sort((a, b) =>
      (a?.is_default === b?.is_default ? 0 : a.is_default ? -1 : 1) || (a?.sort_order ?? 0) - (b?.sort_order ?? 0)
    );
  };

  const PriceChips = ({ dish, max }) => {
    if (!parsedTheme.show_prices) return null;
    const sorted = getSortedPrices(dish);
    const shown = typeof max === 'number' ? sorted.slice(0, max) : sorted;
    const extra = typeof max === 'number' ? Math.max(0, sorted.length - max) : 0;
    return (
      <Stack direction="row" spacing={0.6} alignItems="center" flexWrap="nowrap" sx={{ minHeight: 26 }}>
        {shown.map((p) => (
          <Chip
            key={p.id || `${p.label}-${p.price}`}
            size="small"
            label={`${p.label ? p.label + ' · ' : ''}${formatPriceEUR(p.price, i18n.language === 'ar' ? 'de-DE' : i18n.language)}`}
            sx={{
              borderRadius: 999,
              bgcolor: p.is_default ? priceColor : '#e5e7eb',
              color: p.is_default ? '#fff' : '#0f172a',
              fontWeight: 800,
              height: 26,
              fontSize: `calc(0.8125rem * ${priceScale})`,
            }}
          />
        ))}
        {extra > 0 && <Chip size="small" label={`+${extra}`} sx={{ borderRadius: 999, bgcolor: '#f1f5f9', color: '#0f172a', fontWeight: 800, height: 26, fontSize: `calc(0.8125rem * ${priceScale})` }} />}
      </Stack>
    );
  };

  function PriceBlock({ dish, locale, color, scale }) {
    const prices = Array.isArray(dish.prices) ? dish.prices : (dish.price != null ? [{ id: 'single', label: '', price: dish.price, is_default: true }] : []);
    if (prices.length <= 1) {
      const p = prices[0];
      if (!p) return null;
      return (
        <Typography sx={{ mt: .5, fontWeight: 800, color, fontSize: `calc(0.95rem * ${scale})` }}>
          {formatPriceEUR(p.price, locale)}
        </Typography>
      );
    }
    return <PriceChips dish={dish} />;
  }

  const sectionVariants = { hidden: { opacity: 0, y: 24 }, show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 90, damping: 16 } } };
  const cardVariants = { hidden: { opacity: 0, y: 24, scale: 0.98 }, show: (i = 0) => ({ opacity: 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 110, damping: 14, delay: i * 0.05 } }) };

  const DishCard = ({ dish, imgSources, index = 0, fixedHeight }) => (
    <motion.div variants={cardVariants} custom={index} initial="hidden" animate="show" style={{ height: '100%' }}>
      <Card
        component={motion.div}
        whileHover={{ y: -4, boxShadow: '0 10px 26px rgba(15,23,42,0.08)' }}
        onClick={() => setSelectedDish({ ...dish, imgSources })}
        elevation={0}
        sx={{
          cursor: 'pointer',
          borderRadius: 3,
          border: '1px solid #e5e7eb',
          bgcolor: '#fff',
          overflow: 'hidden',
          height: { xs: 'auto', md: fixedHeight ? `${fixedHeight}px` : 'auto' },
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 1px 0 rgba(0,0,0,.02)',
          position: 'relative',

          // حل مشكلة الحواف الحادة
          transition: 'all 0.12s ease-out',
          '&:hover': {
            borderRadius: 3,
          },
        }}
      >

        {/* شارة الأكواد بخلفية بيضاء واضحة */}
        <AllergenChip dish={dish} withTooltip sx={{ position: 'absolute', top: 8, right: 8, zIndex: 2 }} />

        {/* Favorite toggle button */}
        {/* Favorite toggle button removed for visitors */}

        {/* If showImages is ON and dish has image */}
        {showImages && dish.image && <DishImage sources={imgSources} alt={dish.name} />}

        {/* If showImages is ON but dish has NO image - show placeholder */}
        {showImages && !dish.image && (
          <Box sx={{ width: '100%', height: 160, borderTopLeftRadius: 12, borderTopRightRadius: 12, background: 'linear-gradient(135deg,#f5f7fa,#e8edf3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.2rem', opacity: 0.5 }}>
            🍽️
          </Box>
        )}

        {/* If showImages is OFF -  show beautiful header */}
        {!showImages && (
          <Box sx={{ width: '100%', py: 2.5, px: 2, background: parsedTheme.placeholder_gradient || 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1, borderTopLeftRadius: 12, borderTopRightRadius: 12 }}>
            <Typography sx={{ fontSize: '2.5rem', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))' }}>🍽️</Typography>
            <Typography variant="subtitle2" sx={{ color: '#fff', fontWeight: 700, textAlign: 'center', fontSize: `calc(0.875rem * ${parsedTheme.scale || 1})`, textShadow: '0 1px 2px rgba(0,0,0,0.15)', letterSpacing: '0.3px' }}>
              {dish.name}
            </Typography>
          </Box>
        )}

        <CardContent sx={{ flexGrow: 1, py: 1.5, fontFamily: parsedTheme.font || 'inherit' }}>
          {showImages && (
            <Typography variant="subtitle1" sx={{ fontWeight: 800, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', minHeight: '2.4em', fontSize: `calc(1rem * ${parsedTheme.scale || 1})` }} title={dish.name}>
              {dish.name}
            </Typography>
          )}

          <PriceBlock dish={dish} locale={i18n.language === 'ar' ? 'de-DE' : i18n.language} color={priceColor} scale={priceScale} />

          {dish.description ? (
            <Typography variant="body2" sx={{ mt: .25, color: '#475569', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', minHeight: '2.6em', fontSize: `calc(0.95rem * ${parsedTheme.scale || 1})` }}>
              {dish.description}
            </Typography>
          ) : <Box sx={{ minHeight: '2.6em' }} />}
        </CardContent>
      </Card>
    </motion.div>
  );

  return (
    <Box className="public-root" dir={dir} sx={{ '--c-bg': parsedTheme.bg, '--c-text': parsedTheme.text, '--c-icon': parsedTheme.icon, '--c-font': parsedTheme.font || 'inherit', '--c-scale': parsedTheme.scale || 1, bgcolor: 'var(--c-bg)', color: 'var(--c-text)', minHeight: '100vh', fontFamily: 'var(--c-font, inherit)' }}>
      <style>{`
        .public-root .MuiTypography-root { font-size: calc(1rem * var(--c-scale, 1)) !important; font-family: var(--c-font, inherit) !important; }
        .public-root .MuiChip-root { font-family: var(--c-font, inherit) !important; }
      `}</style>

      {/* شريط علوي */}
      <Box sx={{ position: 'sticky', top: 0, zIndex: 50, px: 2, py: 1.25, display: 'flex', alignItems: 'center', gap: 1.25, borderBottom: (th) => `1px solid ${th.palette.divider}`, bgcolor: 'rgba(255,255,255,0.9)', backdropFilter: 'saturate(140%) blur(6px)' }}>
        {parsedTheme.show_logo && (
          <Avatar src={logoUrl || undefined} sx={{ bgcolor: '#fff', color: 'var(--c-text)', border: '1px solid #e5e7eb', width: 36, height: 36 }}>
            {!logoUrl && (title?.[0] || 'R')}
          </Avatar>
        )}
        <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>{title}</Typography>
      </Box>

      {/* هيرو */}
      {parsedTheme.show_hero && (
        <Box sx={{ position: 'relative', width: '100%', height: { xs: 220, md: 380 }, backgroundImage: bgHero ? `url(${bgHero})` : 'none', backgroundSize: 'cover', backgroundPosition: heroCrop, overflow: 'hidden' }}>
          <Box sx={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(0,0,0,0.15), rgba(0,0,0,0.35))' }} />
          <Container maxWidth={false} sx={{ position: 'relative', height: '100%', px: 1 }}>
            <Box sx={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', bottom: { xs: 14, md: 56 }, width: { xs: 'min(92%, 480px)', sm: 'min(92%, 620px)', md: 'min(70%, 760px)' }, p: { xs: 1, md: 2.25 }, bgcolor: parsedTheme.mode === 'dark' ? 'rgba(15,18,22,0.62)' : 'rgba(255,255,255,0.82)', border: '1px solid rgba(0,0,0,0.08)', boxShadow: '0 10px 30px rgba(0,0,0,0.12)', borderRadius: 2.5, backdropFilter: 'saturate(140%) blur(8px)', textAlign: 'center' }}>

              {parsedTheme.show_search && (
                <TextField
                  fullWidth
                  placeholder={t('search_in_menu') || (isRTL ? 'ابحث عن طبق...' : 'Search the menu...')}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  InputProps={{ startAdornment: (<InputAdornment position="start"><SearchIcon /></InputAdornment>) }}
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: 999, height: { xs: 38, md: 44 } }, '& input': { color: 'var(--c-text)' }, '& .MuiOutlinedInput-notchedOutline': { borderColor: 'transparent' }, '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'transparent' }, mb: 0.8 }}
                  data-tour="public-search"
                />
              )}

              {parsedTheme.show_sections && (
                <Box data-tour="public-sections" sx={{ display: 'flex', gap: 1, overflowX: 'auto', whiteSpace: 'nowrap', pb: 0.5, mx: -0.5, px: 0.5, '&::-webkit-scrollbar': { display: 'none' }, scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                  {/* All tab */}
                  <Chip
                    label={isRTL ? 'الكل' : 'alle'}
                    onClick={() => setActiveSectionId(null)}
                    sx={{
                      cursor: 'pointer',
                      bgcolor: activeSectionId === null ? 'var(--c-icon)' : 'rgba(0,0,0,0.04)',
                      color: activeSectionId === null ? '#000' : 'var(--c-text)',
                      fontWeight: activeSectionId === null ? 800 : 600,
                      borderRadius: 999,
                      px: 1.5,
                      height: 32,
                      transition: 'all 0.2s ease',
                      '&:hover': { bgcolor: activeSectionId === null ? 'var(--c-icon)' : 'rgba(0,0,0,0.08)' },
                    }}
                  />
                  {sectionOptions.map((opt) => {
                    const active = activeSectionId === opt.id;
                    return (
                      <Chip key={opt.id} label={opt.name} onClick={() => scrollToSection(opt.id)} clickable
                        sx={{ flex: '0 0 auto', borderRadius: 999, bgcolor: active ? '#0f172a' : '#e5e7eb', color: active ? '#fff' : '#0f172a', fontWeight: 700, height: 28, '& .MuiChip-label': { px: 1.2 } }} />
                    );
                  })}
                </Box>
              )}
            </Box>
          </Container>
        </Box>
      )}

      {/* المحتوى */}
      <Container maxWidth={false} sx={{ maxWidth: 'min(1200px, 100%)', px: 2, mt: parsedTheme.show_hero ? 6 : 3 }}>
        <Box sx={{
          overflowX: 'hidden',
          width: '100%',
          maxWidth: '100%',
          '& .MuiPaper-root': { overflowX: 'hidden', maxWidth: '100%' },
          '& .MuiPaper-root *': { minWidth: { xs: 0 } },
          '& .MuiPaper-root > .MuiStack-root > .MuiStack-root > .MuiStack-root': {
            flexWrap: { xs: 'wrap', md: 'nowrap' },
            justifyContent: { xs: 'space-between', md: 'flex-start' },
          },
          '& .MuiPaper-root .MuiTypography-caption': {
            maxWidth: '100%',
            display: 'inline-block',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          },
        }}>
          <PublicOpeningHours
            hours={ds.hours}
            address={ds.address || rp.address}
            phone={ds.phone || rp.phone}
            whatsapp={ds.whatsapp}
            language={i18n.language}
          />
        </Box>
        {favoriteDishes.length > 0 && !activeSectionId && (
          <Box sx={{ mb: 6 }}>
            <Typography variant="h5" sx={{ fontWeight: 900, mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
              <span style={{ fontSize: '1.5em' }}>⭐</span> {t('recommended_dishes') || (isRTL ? 'أطباق موصى بها' : 'Recommended Dishes')}
            </Typography>
            <Box sx={{
              display: 'flex',
              gap: 2,
              overflowX: 'auto',
              pb: 2,
              mx: -2,
              px: 2,
              scrollSnapType: 'x mandatory',
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
              '&::-webkit-scrollbar': { display: 'none' }
            }}>
              {favoriteDishes.map((dish, i) => {
                const imgSources = publicDishImageSources(dish, ds, rp);
                return (
                  <Box key={dish.id} sx={{
                    minWidth: { xs: '85%', sm: '45%', md: '32%', lg: '28%', xl: '24%' },
                    maxWidth: { xs: '85%', sm: '45%', md: '32%', lg: '28%', xl: '24%' },
                    flex: '0 0 auto',
                    scrollSnapAlign: 'start'
                  }}>
                    <DishCard dish={dish} imgSources={imgSources} index={i} fixedHeight={CARD_HEIGHT_MD} />
                  </Box>
                );
              })}
            </Box>
          </Box>
        )}

        {filteredSections.length === 0 ? (
          <Alert severity="info">{t('no_results') || 'لا توجد نتائج.'}</Alert>
        ) : (
          filteredSections.map((section) => {
            const secId = section.id ?? slugify(section.name);
            const dishes = section.dishes || [];
            return (
              <Box key={secId} ref={(el) => (sectionRefs.current[secId] = el)} sx={{ mb: 4 }}>
                <Typography variant="h6" sx={{ fontWeight: 900, mb: 1.5 }}>{section.name}</Typography>

                {!isMdUp ? (
                  <Box sx={{ display: 'flex', gap: 1.25, overflowX: 'auto', pb: 1, mx: -1, px: 1, scrollSnapType: 'x mandatory', '&::-webkit-scrollbar': { display: 'none' } }}>
                    {dishes.map((dish, i) => {
                      const imgSources = publicDishImageSources(dish, ds, rp);
                      return (
                        <Box key={dish.id} sx={{ width: 280, flex: '0 0 auto' }} id={`dish-${dish.id ?? slugify(dish.name)}`} {...(i === 0 ? { 'data-tour': 'public-dish-card' } : {})}>
                          <DishCard dish={dish} imgSources={imgSources} index={i} />
                        </Box>
                      );
                    })}
                  </Box>
                ) : (
                  // Desktop: virtualize when many cards to reduce DOM nodes
                  dishes.length > 60 ? (
                    <VirtualList
                      height={CARD_HEIGHT_MD * 3 + 48}
                      itemCount={Math.ceil(dishes.length / 3)}
                      itemSize={CARD_HEIGHT_MD + 16}
                      width={'100%'}
                      style={{ overflowX: 'hidden' }}
                    >
                      {({ index, style }) => {
                        const start = index * 3;
                        const rowItems = dishes.slice(start, start + 3);
                        return (
                          <div style={style}>
                            <Box sx={{ display: 'grid', gridTemplateColumns: { md: 'repeat(3, minmax(0, 1fr))' }, gap: 2, alignItems: 'stretch' }}>
                              {rowItems.map((dish, i) => {
                                const globalIndex = start + i;
                                const imgSources = publicDishImageSources(dish, ds, rp);
                                return (
                                  <Box key={dish.id} id={`dish-${dish.id ?? slugify(dish.name)}`} {...(globalIndex === 0 ? { 'data-tour': 'public-dish-card' } : {})} sx={{ height: { md: CARD_HEIGHT_MD } }}>
                                    <DishCard dish={dish} imgSources={imgSources} index={globalIndex} fixedHeight={CARD_HEIGHT_MD} />
                                  </Box>
                                );
                              })}
                              {rowItems.length < 3 && Array.from({ length: 3 - rowItems.length }).map((_, k) => (
                                <Box key={`pad-${k}`} />
                              ))}
                            </Box>
                          </div>
                        );
                      }}
                    </VirtualList>
                  ) : (
                    <Box sx={{ display: 'grid', gridTemplateColumns: { md: 'repeat(3, minmax(0, 1fr))' }, gap: 2, alignItems: 'stretch' }}>
                      {dishes.map((dish, i) => {
                        const imgSources = publicDishImageSources(dish, ds, rp);
                        return (
                          <Box key={dish.id} id={`dish-${dish.id ?? slugify(dish.name)}`} {...(i === 0 ? { 'data-tour': 'public-dish-card' } : {})} sx={{ height: { md: CARD_HEIGHT_MD } }}>
                            <DishCard dish={dish} imgSources={imgSources} index={i} fixedHeight={CARD_HEIGHT_MD} />
                          </Box>
                        );
                      })}
                    </Box>
                  )
                )}
              </Box>
            );
          })
        )}
      </Container>

      {/* أدوات عائمة */}
      <Stack spacing={1} sx={{ position: 'fixed', right: 16, bottom: 16, zIndex: 1000 }}>
        <Tooltip title={t('to_top') || (isRTL ? 'إلى الأعلى' : 'To top')}>
          <IconButton onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} sx={{ bgcolor: 'var(--c-icon)', color: '#000', '&:hover': { bgcolor: 'var(--c-icon)' } }}><ArrowUpwardIcon /></IconButton>
        </Tooltip>
      </Stack>

      {/* مربع الحوار */}
      {selectedDish && (
        <Dialog
          open={!!selectedDish}
          onClose={() => setSelectedDish(null)}
          fullWidth
          maxWidth="sm"
          transitionDuration={{ enter: 120, exit: 100 }}
          disableAutoFocus
          disableRestoreFocus
          keepMounted
          disableScrollLock
          disableEnforceFocus
          slotProps={{ backdrop: { transitionDuration: 100, sx: { backdropFilter: 'blur(6px) saturate(120%)', backgroundColor: 'rgba(15,23,42,0.25)' } } }}
          PaperProps={{ sx: { overflow: 'hidden', borderRadius: { xs: 2, sm: 3 }, bgcolor: 'rgba(255,255,255,0.78)', backdropFilter: 'saturate(160%) blur(10px)', border: '1px solid rgba(0,0,0,0.07)', boxShadow: '0 30px 70px rgba(0,0,0,0.28)' } }}
        >
          <Box sx={{ position: 'relative' }}>
            {/* رموز فقط فوق الصورة — الجهة المقابلة لزر الإغلاق (الإغلاق يمين -> الرموز يسار) */}
            <DialogAllergenCodes dish={selectedDish} isRTL={isRTL} />

            <DialogHeroImage
              sources={publicDishImageSources(selectedDish, ds, rp)}
              alt={selectedDish.name}
              dish={selectedDish}
              gradientColor={parsedTheme.placeholder_gradient}
            />
          </Box>

          {/* النص والأزرار */}
          <Box sx={{ p: { xs: 2.2, md: 3 }, fontFamily: parsedTheme.font || 'inherit' }}>
            <Box sx={{ display: 'flex', alignItems: 'start', justifyContent: 'space-between', gap: 2, mb: 1 }}>
              <Typography variant="h6" sx={{ fontWeight: 900, lineHeight: 1.2, fontSize: `calc(1.05rem * ${parsedTheme.scale || 1})` }}>
                {selectedDish.name}
              </Typography>

              {/* ===== عرض كل الأسعار داخل مربع الحوار ===== */}
              {parsedTheme.show_prices && (
                <PriceChips dish={selectedDish} />
              )}
            </Box>

            {/* Description - الوصف */}
            {(selectedDish.description || selectedDish.description_de || selectedDish.description_en || selectedDish.description_ar) && (
              <Typography variant="body1" sx={{ mt: 1, mb: 2, color: '#334155', lineHeight: 1.6, fontSize: `calc(0.95rem * ${parsedTheme.scale || 1})` }}>
                {selectedDish.description || selectedDish.description_de || selectedDish.description_en || selectedDish.description_ar}
              </Typography>
            )}

            {/* German-only allergen display */}
            {(() => {
              const raw = (selectedDish?.display_codes || '').toString().trim();
              if (!raw) return null;
              const parts = raw.split(/[\s,;\/|]+/g).map(s => s.trim()).filter(Boolean);
              const codes = parts.join(',');
              const text = selectedDish?.allergen_explanation_de || '';
              return (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" sx={{ color: '#0f172a', fontWeight: 700 }}>{codes}</Typography>
                  {text ? <Typography variant="caption" sx={{ color: '#475569', display: 'block', mt: 0.25 }}>{text}</Typography> : null}
                </Box>
              );
            })()}

            {/* ⚠️ لا نعرض أي عبارات شرح للحساسية داخل الحوار (رموز فقط) */}

            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 1 }}>
              <Button
                variant="outlined"
                startIcon={<ShareIcon />}
                onClick={() => onShare(selectedDish)}
                sx={{
                  borderRadius: 2,
                  py: 1.1,
                  px: 3,
                  borderColor: '#e5e7eb',
                  color: '#0f172a',
                  fontWeight: 600,
                  '&:hover': {
                    borderColor: '#cbd5e1',
                    bgcolor: '#f8fafc'
                  }
                }}
              >
                {t('share') || (isRTL ? 'مشاركة' : 'Share')}
              </Button>
            </Box>
          </Box>

          {/* زر الإغلاق: يمين و zIndex أعلى من الرموز */}
          <IconButton
            onClick={() => setSelectedDish(null)}
            sx={{
              position: 'absolute',
              top: 8,
              right: 8,             // ✅ يمين
              zIndex: 6,            // ✅ فوق الرموز
              bgcolor: 'rgba(255,255,255,0.92)',
              border: '1px solid rgba(0,0,0,0.06)'
            }}
          >
            <CloseIcon />
          </IconButton>
        </Dialog>
      )}

      <style>{`
        @media print {
          .MuiContainer-root { max-width: 100% !important; padding: 0 12mm !important; }
          [role="tooltip"], .MuiStack-root[style*="position: fixed"] { display: none !important; }
          * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          img, .MuiCard-root { break-inside: avoid; page-break-inside: avoid; }
        }
      `}</style>
    </Box>
  );
}

/* ===== صورة مربع الحوار مع حركة خفيفة ===== */
function DialogHeroImage({ sources, alt, dish, gradientColor }) {
  const [idx, setIdx] = useState(0);
  const src = sources[idx] || PLACEHOLDER;

  // Check if the dish has an actual image (not placeholder/logo/avatar)
  const hasRealImage = dish?.image && dish.image.trim() !== '';

  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const rotateX = useTransform(my, [-50, 50], [6, -6]);
  const rotateY = useTransform(mx, [-50, 50], [-6, 6]);

  const handleMove = (e) => {
    if (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    mx.set(Math.max(-50, Math.min(50, (x / (rect.width / 2)) * 50)));
    my.set(Math.max(-50, Math.min(50, (y / (rect.height / 2)) * 50)));
  };

  const handleLeave = () => { mx.set(0); my.set(0); };

  // If no real image, show beautiful placeholder
  if (!hasRealImage) {
    return (
      <Box sx={{
        position: 'relative',
        width: '100%',
        height: { xs: 240, md: 360 },
        background: gradientColor || 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden'
      }}>
        <motion.div
          animate={{
            scale: [1, 1.1, 1],
            rotate: [0, 5, -5, 0]
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            repeatType: 'mirror',
            ease: 'easeInOut'
          }}
          style={{ fontSize: '6rem', filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.2))' }}
        >
          🍽️
        </motion.div>
        <Box sx={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(circle at 30% 40%, rgba(255,255,255,0.15), transparent 60%)'
        }} />
      </Box>
    );
  }

  // Otherwise show the image with animation
  return (
    <Box sx={{ position: 'relative', overflow: 'hidden' }}>
      <motion.div style={{ position: 'absolute', inset: 0, rotateX, rotateY }} transition={{ type: 'spring', stiffness: 120, damping: 18 }}>
        <Box sx={{ position: 'absolute', inset: 0, background: 'radial-gradient(1200px 400px at 20% 0%, rgba(255,255,255,.35), transparent)' }} />
      </motion.div>

      <motion.div onMouseMove={handleMove} onMouseLeave={handleLeave} style={{ perspective: 1200, transformStyle: 'preserve-3d' }}>
        <motion.div style={{ rotateX, rotateY }} transition={{ type: 'spring', stiffness: 120, damping: 18 }}>
          <Box sx={{ position: 'relative', width: '100%', height: { xs: 240, md: 360 }, bgcolor: '#0b0e13' }}>
            <motion.img
              src={src}
              alt={alt}
              onError={() => setIdx((i) => (i + 1 < sources.length ? i + 1 : i))}
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center', display: 'block' }}
              animate={{ scale: [1.04, 1.08, 1.04] }}
              transition={{ duration: 12, repeat: Infinity, repeatType: 'mirror', ease: 'easeInOut' }}
            />
            <Box sx={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(0,0,0,.0), rgba(0,0,0,.22))' }} />
          </Box>
        </motion.div>
      </motion.div>
    </Box>
  );
}

