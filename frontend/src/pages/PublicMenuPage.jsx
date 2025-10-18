// src/pages/PublicMenuPage.jsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from '../services/axios';
import {
  Alert, Avatar, Box, Button, Card, CardContent, Chip, CircularProgress, Container,
  Dialog, Grid, IconButton, InputAdornment, Stack, TextField, Tooltip, Typography,
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

// === Framer Motion (حركات) ===
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion';

const LANGS = ['ar', 'de', 'en'];
const PLACEHOLDER = '/static/img/dish-placeholder.png';

/** ثيم افتراضي مبسّط */
const fallback = {
  mode: 'light', bg: '#f6f8fb', text: '#0f172a', icon: '#ff8a50',
  font: '', scale: 1,
  price_color: '#1d4ed8', price_scale: 1,
  show_logo: 1, show_hero: 1, show_search: 1, show_sections: 1, show_prices: 1,
};

function parseTheme(themeStr) {
  if (!themeStr || typeof themeStr !== 'string') return { ...fallback };
  const val = themeStr.trim();
  if (val === 'dark') return { ...fallback, mode: 'dark', bg: '#0b0e13', text: '#f5f7fb' };
  if (val === 'light' || val === 'default') return { ...fallback };

  if (val.startsWith('custom3:')) {
    const raw = val.split(':')[1] || '';
    const [bg = fallback.bg, text = fallback.text, icon = fallback.icon] = raw.split(',').map((s) => s.trim());
    return { ...fallback, mode: 'light', bg, text, icon };
  }
  if (val.startsWith('custom:')) {
    const out = { ...fallback, mode: 'custom' };
    for (const kv of (val.split(':')[1] || '').split(',').map(s => s.trim()).filter(Boolean)) {
      const i = kv.indexOf('='); if (i < 0) continue;
      const k = kv.slice(0, i).trim(); let v = kv.slice(i + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      if (k === 'bg' || k === 'text' || k === 'icon' || k === 'font' || k === 'price_color') out[k] = v;
      else if (k === 'scale' || k === 'price_scale') {
        const n = parseFloat(String(v).replace(',', '.')); if (Number.isFinite(n)) out[k] = n;
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

/** صورة داخل حاوية بارتفاع ثابت — توحيد قياس الكروت */
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

  // persist language
  useEffect(() => {
    const k = `publicMenu.lang.${publicSlug}`;
    const saved = localStorage.getItem(k);
    if (saved && LANGS.includes(saved)) i18n.changeLanguage(saved);
  }, [publicSlug, i18n]);
  useEffect(() => {
    const k = `publicMenu.lang.${publicSlug}`;
    try { localStorage.setItem(k, i18n.language); } catch {}
  }, [i18n.language, publicSlug]);

  // load public payload
  useEffect(() => {
    let mounted = true;
    setLoading(true); setError('');
    axios.get(`/public/menus/${publicSlug}/`)
      .then((res) => { if (mounted) setMenu(res.data || null); })
      .catch(() => { if (mounted) { setMenu(null); setError(t('public_menu_error') || 'تعذر التحميل.'); }})
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [publicSlug, t]);

  const rp = menu?.restaurant_profile || {};
  const ds = menu?.display_settings || {};
  const parsedTheme = useMemo(() => parseTheme(ds?.theme || rp?.theme || 'default'), [ds?.theme, rp?.theme]);

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
    const list = activeSectionId ? sections.filter((s) => (s.id ?? slugify(s.name)) === activeSectionId) : sections;
    return list.map((s) => ({ ...s, dishes: (s.dishes || []).filter((d) => isMatch(q, d.name, d.description, d.display_codes)) }))
               .filter((s) => s.dishes && s.dishes.length > 0);
  }, [sections, query, activeSectionId]);

  const publicUrl = useMemo(() => `${window.location.origin}/show/menu/${publicSlug}`, [publicSlug]);
  const onShare = async (dish) => {
    try {
      const title = dish ? dish.name : (ds.display_name || rp.display_name || menu?.name || 'Menu');
      const url = dish ? `${publicUrl}#dish-${dish.id ?? slugify(dish?.name)}` : publicUrl;
      if (navigator.share) await navigator.share({ title, text: title, url });
      else { await navigator.clipboard.writeText(url); alert(t('copied') || 'Copied'); }
    } catch {}
  };
  const onPrint = () => window.print();
  useScrollTrigger({ disableHysteresis: true, threshold: 120 });

  if (loading) {
    return <Container maxWidth="lg" sx={{ mt: 6, display: 'flex', justifyContent: 'center' }}><CircularProgress/></Container>;
  }
  if (error || !menu) {
    return <Container maxWidth="lg" sx={{ mt: 6 }}><Alert severity="error" sx={{ mb: 2 }}>{error || (t('public_menu_not_available') || 'القائمة غير متاحة.')}</Alert></Container>;
  }

  const bgHero = parsedTheme.show_hero ? (ds.hero_image || rp.hero_image || '') : '';
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
        {extra > 0 && <Chip size="small" label={`+${extra}`} sx={{ borderRadius: 999, bgcolor: '#f1f5f9', color: '#0f172a', fontWeight: 800, height: 26, fontSize: `calc(0.8125rem * ${priceScale})` }}/>}
      </Stack>
    );
  };

  /** سعر كنص إذا كان هناك سعر واحد، وإلا تبقى الشارات */
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

  /** Variants للحركات العامة */
  const sectionVariants = {
    hidden: { opacity: 0, y: 24 },
    show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 90, damping: 16 } },
  };
  const cardVariants = {
    hidden: { opacity: 0, y: 24, scale: 0.98 },
    show: (i = 0) => ({
      opacity: 1,
      y: 0,
      scale: 1,
      transition: { type: 'spring', stiffness: 110, damping: 14, delay: i * 0.05 },
    }),
  };

  /** بطاقة موحَّدة القياس + موشن (تم تحويلها لِـ initial/animate بدلاً من whileInView) */
  const DishCard = ({ dish, imgSources, index = 0 }) => (
    <motion.div
      variants={cardVariants}
      custom={index}
      initial="hidden"
      animate="show"       // ✅ بدل whileInView
      whileHover={{ y: -4, boxShadow: '0 10px 26px rgba(15,23,42,0.08)' }}
      transition={{ type: 'spring', stiffness: 250, damping: 18 }}
      style={{ height: '100%' }}
    >
      <Card
        onClick={() => setSelectedDish({ ...dish, imgSources })}
        elevation={0}
        sx={{
          cursor: 'pointer',
          borderRadius: 3,
          border: '1px solid #e5e7eb',
          bgcolor: '#fff',
          overflow: 'hidden',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 1px 0 rgba(0,0,0,.02)',
        }}
      >
        {/* صورة بارتفاع ثابت */}
        <DishImage sources={imgSources} alt={dish.name} />

        {/* محتوى منسّق كلاسيكي */}
        <CardContent sx={{ flexGrow: 1, py: 1.5, fontFamily: parsedTheme.font || 'inherit' }}>
          <Typography
            variant="subtitle1"
            sx={{
              fontWeight: 800,
              lineHeight: 1.2,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              minHeight: '2.4em',
              fontSize: `calc(1rem * ${parsedTheme.scale || 1})`,
            }}
            title={dish.name}
          >
            {dish.name}
          </Typography>

          <PriceBlock
            dish={dish}
            locale={i18n.language === 'ar' ? 'de-DE' : i18n.language}
            color={priceColor}
            scale={priceScale}
          />

          {dish.description ? (
            <Typography
              variant="body2"
              sx={{
                mt: .25,
                color: '#475569',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
                minHeight: '2.6em',
                fontSize: `calc(0.95rem * ${parsedTheme.scale || 1})`,
              }}
            >
              {dish.description}
            </Typography>
          ) : <Box sx={{ minHeight: '2.6em' }} />}
        </CardContent>
      </Card>
    </motion.div>
  );

  return (
    <Box
      className="public-root"
      dir={dir}
      sx={{
        '--c-bg': parsedTheme.bg,
        '--c-text': parsedTheme.text,
        '--c-icon': parsedTheme.icon,
        '--c-font': parsedTheme.font || 'inherit',
        '--c-scale': parsedTheme.scale || 1,
        bgcolor: 'var(--c-bg)',
        color: 'var(--c-text)',
        minHeight: '100vh',
        fontFamily: 'var(--c-font, inherit)',
      }}
    >
      {/* Global scaling */}
      <style>{`
        .public-root .MuiTypography-root { 
          font-size: calc(1rem * var(--c-scale, 1)) !important; 
          font-family: var(--c-font, inherit) !important;
        }
        .public-root .MuiChip-root { 
          font-family: var(--c-font, inherit) !important;
        }
      `}</style>

      {/* Top bar */}
      <motion.div
        initial={{ y: -24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 140, damping: 16 }}
      >
        <Box sx={{
          position: 'sticky', top: 0, zIndex: 50, px: 2, py: 1.25,
          display: 'flex', alignItems: 'center', gap: 1.25,
          borderBottom: (th) => `1px solid ${th.palette.divider}`,
          bgcolor: 'rgba(255,255,255,0.9)',
          backdropFilter: 'saturate(140%) blur(6px)',
        }}>
          {parsedTheme.show_logo && (
            <Avatar src={logoUrl || undefined} sx={{ bgcolor: '#fff', color: 'var(--c-text)', border: '1px solid #e5e7eb', width: 36, height: 36 }}>
              {!logoUrl && (title?.[0] || 'R')}
            </Avatar>
          )}
          <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>{title}</Typography>
        </Box>
      </motion.div>

      {/* Hero */}
      {parsedTheme.show_hero && (
        <motion.div
          initial={{ scale: 0.98, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 90, damping: 16, delay: .05 }}
        >
          <Box sx={{ position: 'relative', width: '100%', height: { xs: 220, md: 380 }, backgroundImage: bgHero ? `url(${bgHero})` : 'none', backgroundSize: 'cover', backgroundPosition: 'center', overflow: 'hidden' }}>
            <Box sx={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(0,0,0,0.15), rgba(0,0,0,0.35))' }} />
            <Container maxWidth={false} sx={{ position: 'relative', height: '100%', px: 1 }}>
              <Box sx={{
                position: 'absolute', left: '50%', transform: 'translateX(-50%)',
                bottom: { xs: 14, md: 56 },
                width: { xs: 'min(92%, 480px)', sm: 'min(92%, 620px)', md: 'min(70%, 760px)' },
                p: { xs: 1, md: 2.25 },
                bgcolor: parsedTheme.mode === 'dark' ? 'rgba(15,18,22,0.62)' : 'rgba(255,255,255,0.82)',
                border: '1px solid rgba(0,0,0,0.08)',
                boxShadow: '0 10px 30px rgba(0,0,0,0.12)',
                borderRadius: 2.5,
                backdropFilter: 'saturate(140%) blur(8px)',
                textAlign: 'center'
              }}>
                {/* Lang pills */}
                <Stack direction="row" spacing={0.5} justifyContent="flex-end" sx={{ mb: 0.6 }}>
                  {LANGS.map((lng) => (
                    <motion.div whileHover={{ y: -2 }} key={lng}>
                      <Button size="small" onClick={() => i18n.changeLanguage(lng)}
                        variant={i18n.language?.startsWith(lng) ? 'contained' : 'text'}
                        sx={{ color: i18n.language?.startsWith(lng) ? '#000' : 'var(--c-text)', bgcolor: i18n.language?.startsWith(lng) ? '#e5e7eb' : 'transparent', borderRadius: 999, minWidth: 36, px: 1 }}>
                        {lng.toUpperCase()}
                      </Button>
                    </motion.div>
                  ))}
                </Stack>

                {parsedTheme.show_search && (
                  <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .15 }}>
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
                      data-tour="public-search"
                    />
                  </motion.div>
                )}

                {parsedTheme.show_sections && (
                  <Box data-tour="public-sections" sx={{ display: 'flex', gap: 1, overflowX: 'auto', whiteSpace: 'nowrap', pb: 0.5, mx: -0.5, px: 0.5, '&::-webkit-scrollbar': { display: 'none' }, scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                    {sectionOptions.map((opt, i) => {
                      const active = activeSectionId === opt.id;
                      return (
                        <motion.div
                          key={opt.id}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.05 + i * 0.03 }}
                        >
                          <Chip label={opt.name} onClick={() => scrollToSection(opt.id)} clickable
                            sx={{ flex: '0 0 auto', borderRadius: 999, bgcolor: active ? '#0f172a' : '#e5e7eb', color: active ? '#fff' : '#0f172a', fontWeight: 700, height: 28, '& .MuiChip-label': { px: 1.2 } }}/>
                        </motion.div>
                      );
                    })}
                  </Box>
                )}
              </Box>
            </Container>
          </Box>
        </motion.div>
      )}

      {/* Content */}
      <Container maxWidth={false} sx={{ maxWidth: 'min(1200px, 100%)', px: 2, mt: parsedTheme.show_hero ? 6 : 3 }}>
        {filteredSections.length === 0 ? (
          <Alert severity="info">{t('no_results') || 'لا توجد نتائج.'}</Alert>
        ) : (
          filteredSections.map((section) => {
            const secId = section.id ?? slugify(section.name);
            const dishes = section.dishes || [];
            return (
              <motion.div
                key={secId}
                ref={(el) => (sectionRefs.current[secId] = el)}
                variants={sectionVariants}
                initial="hidden"
                animate="show"         // ✅ يعمل دائماً بعد التحميل
                style={{ marginBottom: 32 }}
              >
                <Typography variant="h6" sx={{ fontWeight: 900, mb: 1.5 }}>{section.name}</Typography>

                {/* موبايل: سلايدر أفقي */}
                {!isMdUp ? (
                  <Box sx={{ display: 'flex', gap: 1.25, overflowX: 'auto', pb: 1, mx: -1, px: 1, scrollSnapType: 'x mandatory', '&::-webkit-scrollbar': { display: 'none' } }}>
                    {dishes.map((dish, i) => {
                      const imgSources = publicDishImageSources(dish, ds, rp);
                      return (
                        <Box key={dish.id} sx={{ width: 280, flex: '0 0 auto' }} id={`dish-${dish.id ?? slugify(dish.name)}`} {...(i===0 ? { 'data-tour': 'public-dish-card' } : {})}>
                          <DishCard dish={dish} imgSources={imgSources} index={i} />
                        </Box>
                      );
                    })}
                  </Box>
                ) : (
                  // دِسكتوب: شبكة 3 أعمدة — جميع البطاقات بنفس الارتفاع
                  <Grid container spacing={2} alignItems="stretch">
                    {dishes.map((dish, i) => {
                      const imgSources = publicDishImageSources(dish, ds, rp);
                      return (
                        <Grid item xs={12} sm={6} md={4} key={dish.id} id={`dish-${dish.id ?? slugify(dish.name)}`} {...(i===0 ? { 'data-tour': 'public-dish-card' } : {})}>
                          <DishCard dish={dish} imgSources={imgSources} index={i} />
                        </Grid>
                      );
                    })}
                  </Grid>
                )}
              </motion.div>
            );
          })
        )}
      </Container>

      {/* Footer */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.3 }}
      >
        <Box sx={{ mt: 6, mb: 4, textAlign: 'center', color: 'var(--c-text)' }}>
          <Typography variant="caption" sx={{ opacity: 0.8 }}>
            {title} — {t('public_menu') || (isRTL ? 'عرض قائمة عامة' : 'Public Menu')}
          </Typography>
        </Box>
      </motion.div>

      {/* أدوات عائمة */}
      <Stack spacing={1} sx={{ position: 'fixed', right: 16, bottom: 16, zIndex: 1000 }}>
        <Tooltip title={t('to_top') || (isRTL ? 'إلى الأعلى' : 'To top')}>
          <motion.div whileHover={{ y: -2 }} whileTap={{ scale: 0.95 }}>
            <IconButton onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} sx={{ bgcolor: 'var(--c-icon)', color: '#000', '&:hover': { bgcolor: 'var(--c-icon)' } }} data-tour="public-to-top">
              <ArrowUpwardIcon />
            </IconButton>
          </motion.div>
        </Tooltip>
        <Tooltip title={t('share') || (isRTL ? 'مشاركة' : 'Share')}>
          <motion.div whileHover={{ y: -2 }} whileTap={{ scale: 0.95 }}>
            <IconButton onClick={() => onShare()} sx={{ bgcolor: 'var(--c-icon)', color: '#000', '&:hover': { bgcolor: 'var(--c-icon)' } }} data-tour="public-share">
              <ShareIcon />
            </IconButton>
          </motion.div>
        </Tooltip>
        <Tooltip title={t('print') || (isRTL ? 'طباعة' : 'Print')}>
          <motion.div whileHover={{ y: -2 }} whileTap={{ scale: 0.95 }}>
            <IconButton onClick={onPrint} sx={{ bgcolor: 'var(--c-icon)', color: '#000', '&:hover': { bgcolor: 'var(--c-icon)' } }} data-tour="public-print">
              <PrintIcon />
            </IconButton>
          </motion.div>
        </Tooltip>
      </Stack>

      {/* حوار الطبق (موشن احترافي للصورة) */}
      <AnimatePresence>
        {selectedDish && (
          <Dialog
            open={!!selectedDish}
            onClose={() => setSelectedDish(null)}
            fullWidth
            maxWidth="sm"
            keepMounted              // ✅ لا يعيد بناء DOM ويمنع aria-hidden المتكرر
            disableScrollLock        // ✅ لا يلمس body overflow
            disableEnforceFocus      // ✅ يمنع قفزات تركيز تسبب reflow
            slotProps={{
              backdrop: { sx: { backdropFilter: 'blur(8px) saturate(120%)', backgroundColor: 'rgba(15,23,42,0.25)' } }
            }}
            PaperProps={{
              sx: {
                overflow: 'hidden', borderRadius: { xs: 2, sm: 3 },
                bgcolor: 'rgba(255,255,255,0.78)', backdropFilter: 'saturate(160%) blur(12px)',
                border: '1px solid rgba(0,0,0,0.07)', boxShadow: '0 30px 70px rgba(0,0,0,0.28)',
              }
            }}
          >
            {/* كتلة موشّن كاملة للتحكم بالظهور/الخروج */}
            <motion.div
              initial={{ opacity: 0, y: 16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 120, damping: 18 }}
            >
              {/* ====== منطقة الصورة مع Ken Burns + Tilt ====== */}
              <DialogHeroImage
                sources={publicDishImageSources(selectedDish, ds, rp)}
                alt={selectedDish.name}
              />

              {/* ====== نص وأزرار ====== */}
              <Box sx={{ p: { xs: 2.2, md: 3 }, fontFamily: parsedTheme.font || 'inherit' }}>
                <Box sx={{ display: 'flex', alignItems: 'start', justifyContent: 'space-between', gap: 2, mb: 1 }}>
                  <Typography variant="h6" sx={{ fontWeight: 900, lineHeight: 1.2, fontSize: `calc(1.05rem * ${parsedTheme.scale || 1})` }}>
                    {selectedDish.name}
                  </Typography>

                  {parsedTheme.show_prices && (
                    <Chip
                      label={formatPriceEUR(selectedDish.price, i18n.language === 'ar' ? 'de-DE' : i18n.language)}
                      size="small"
                      sx={{
                        borderRadius: 999,
                        bgcolor: parsedTheme.price_color || '#1d4ed8',
                        color: '#fff',
                        fontWeight: 800,
                        height: 28,
                        fontSize: `calc(0.8125rem * ${parsedTheme.price_scale || 1})`,
                      }}
                    />
                  )}
                </Box>

                {selectedDish.description ? (
                  <Typography variant="body1" sx={{ color: '#334155', mb: 2, fontSize: `calc(1rem * ${parsedTheme.scale || 1})` }}>
                    {selectedDish.description}
                  </Typography>
                ) : null}

                <Stack direction="row" alignItems="center" spacing={1.25}>
                  <motion.div whileHover={{ y: -1 }} whileTap={{ scale: 0.98 }} style={{ width: '100%' }}>
                    <Button
                      variant="contained"
                      startIcon={<ShoppingBagIcon />}
                      sx={{ flexGrow: 1, width: '100%', borderRadius: 2, py: 1.1, background: parsedTheme.price_color || '#1d4ed8', boxShadow: 'none', '&:hover': { background: parsedTheme.price_color || '#1d4ed8', opacity: .9, boxShadow: 'none' } }}
                      onClick={() => { alert(isRTL ? 'تم إضافة الطلب (تجريبي).' : 'Order added (demo).'); }}
                    >
                      {isRTL ? 'اطلب الآن' : 'Order Now'}
                    </Button>
                  </motion.div>

                  <Tooltip title={t('share') || (isRTL ? 'مشاركة' : 'Share')}>
                    <motion.div whileTap={{ scale: 0.9 }}>
                      <IconButton onClick={() => onShare(selectedDish)} sx={{ bgcolor: '#fff', border: '1px solid #e5e7eb' }}>
                        <ShareIcon />
                      </IconButton>
                    </motion.div>
                  </Tooltip>

                  <Tooltip title={t('print') || (isRTL ? 'طباعة' : 'Print')}>
                    <motion.div whileTap={{ scale: 0.9 }}>
                      <IconButton onClick={onPrint} sx={{ bgcolor: '#fff', border: '1px solid #e5e7eb' }}>
                        <PrintIcon />
                      </IconButton>
                    </motion.div>
                  </Tooltip>
                </Stack>
              </Box>

              {/* زر إغلاق يطفو فوق الصورة */}
              <IconButton
                onClick={() => setSelectedDish(null)}
                sx={{
                  position: 'absolute', top: 8, left: 8,
                  bgcolor: 'rgba(255,255,255,0.92)', border: '1px solid rgba(0,0,0,0.06)'
                }}
              >
                <CloseIcon />
              </IconButton>
            </motion.div>
          </Dialog>
        )}
      </AnimatePresence>

      {/* Print styles */}
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

/** ===== مكوّن صورة الـDialog مع Ken Burns + Tilt/Parallax تفاعلي =====
 * - Ken Burns: تكبير/تصغير بطيء متناوب
 * - Tilt: تحريك الماوس يغيّر الميل حول المحورين X/Y (تعطيل تلقائي في الشاشات اللمسية)
 */
function DialogHeroImage({ sources, alt }) {
  const [idx, setIdx] = useState(0);
  const src = sources[idx] || PLACEHOLDER;

  // Motion values for tilt
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const rotateX = useTransform(my, [-50, 50], [6, -6]);
  const rotateY = useTransform(mx, [-50, 50], [-6, 6]);

  const handleMove = (e) => {
    // تعطيل على الشاشات اللمسية
    if (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    mx.set(Math.max(-50, Math.min(50, (x / (rect.width / 2)) * 50)));
    my.set(Math.max(-50, Math.min(50, (y / (rect.height / 2)) * 50)));
  };

  const handleLeave = () => {
    mx.set(0); my.set(0);
  };

  return (
    <Box sx={{ position: 'relative', overflow: 'hidden' }}>
      {/* طبقة ديكورية خفيفة تتحرك مع الميل */}
      <motion.div
        style={{ position: 'absolute', inset: 0, rotateX, rotateY }}
        transition={{ type: 'spring', stiffness: 120, damping: 18 }}
      >
        <Box sx={{
          position: 'absolute', inset: 0,
          background: 'radial-gradient(1200px 400px at 20% 0%, rgba(255,255,255,.35), transparent)'
        }} />
      </motion.div>

      {/* الصورة مع Ken Burns داخل حاوية تلتف بالـ tilt */}
      <motion.div
        onMouseMove={handleMove}
        onMouseLeave={handleLeave}
        style={{ perspective: 1200, transformStyle: 'preserve-3d' }}
      >
        <motion.div
          style={{ rotateX, rotateY }}
          transition={{ type: 'spring', stiffness: 120, damping: 18 }}
        >
          <Box sx={{ position: 'relative', width: '100%', height: { xs: 240, md: 360 }, bgcolor: '#0b0e13' }}>
            <motion.img
              src={src}
              alt={alt}
              onError={() => setIdx((i) => (i + 1 < sources.length ? i + 1 : i))}
              style={{
                position: 'absolute', inset: 0, width: '100%', height: '100%',
                objectFit: 'cover', objectPosition: 'center', display: 'block'
              }}
              // Ken Burns animation
              animate={{ scale: [1.04, 1.08, 1.04] }}
              transition={{ duration: 12, repeat: Infinity, repeatType: 'mirror', ease: 'easeInOut' }}
            />
            {/* ظل داخلي خفيف لتحسين القراءة فوق الصورة */}
            <Box sx={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(0,0,0,.0), rgba(0,0,0,.22))' }} />
          </Box>
        </motion.div>
      </motion.div>
    </Box>
  );
}
