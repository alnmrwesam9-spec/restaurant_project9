import React, { useMemo } from 'react';
import { Box, Chip, Collapse, Divider, IconButton, Paper, Stack, Typography } from '@mui/material';
import ScheduleIcon from '@mui/icons-material/Schedule';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import CallIcon from '@mui/icons-material/Call';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import CancelRoundedIcon from '@mui/icons-material/CancelRounded';

const DAY_KEYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

const normalizeUrl = (url) => {
  if (!url) return '';
  const trimmed = url.trim();
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  return `https://${trimmed}`;
};

const parseCompact = (str) => {
  try {
    const days = {};
    const parts = String(str).split(/[;|]/).map(s => s.trim()).filter(Boolean);
    for (const p of parts) {
      const m = p.match(/^(d([0-6])|mo|tu|we|th|fr|sa|su)\s*=\s*([01])(?:@(.+))?$/i);
      if (!m) continue;
      const code = m[1].toLowerCase();
      let idx = null;
      if (code.startsWith('d')) idx = parseInt(m[2], 10);
      else { const map = { mo: 0, tu: 1, we: 2, th: 3, fr: 4, sa: 5, su: 6 }; idx = map[code]; }
      const key = DAY_KEYS[idx];
      const enabled = m[3] === '1';
      const times = (m[4] || '').split(',').map(s => s.trim()).filter(Boolean);
      const slots = times.map(t => { const [a, b] = t.split('-'); return { from: a, to: b }; });
      days[key] = { enabled, slots };
    }
    if (Object.keys(days).length) return days;
  } catch { }
  return null;
};

const parseHours = (value) => {
  try {
    const obj = JSON.parse(value);
    if (obj && typeof obj === 'object') return obj.days || obj;
  } catch { }
  const compact = parseCompact(value);
  if (compact) return compact;
  return null; // not JSON / no compact
};

const dayLabel = (index, language) => {
  const base = new Date(Date.UTC(2021, 0, 4 + index));
  const lang = (language || 'de').startsWith('ar') ? 'ar' : (language || 'de');
  return base.toLocaleDateString(lang, { weekday: 'long' });
};

const toMinutes = (hhmm) => {
  if (!hhmm) return null;
  const [h, m] = String(hhmm).split(':').map((n) => parseInt(n, 10));
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return h * 60 + m;
};

function isOpenNow(daysMap) {
  if (!daysMap) return false;
  const now = new Date();
  const w = now.getDay(); // 0=Sun
  const index = (w + 6) % 7; // 0=Mon
  const key = DAY_KEYS[index];
  const d = daysMap[key];
  if (!d || !d.enabled) return false;
  const cur = now.getHours() * 60 + now.getMinutes();
  for (const s of d.slots || []) {
    const a = toMinutes(s.from); const b = toMinutes(s.to);
    if (a == null || b == null) continue;
    if (a <= b) { if (cur >= a && cur <= b) return true; }
    else { if (cur >= a || cur <= b) return true; }
  }
  return false;
}

function parseHM(hm) {
  const [hh, mm] = String(hm || '').split(':').map((n) => parseInt(n, 10));
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  return { hh, mm };
}

function buildAbs(dateBase, offsetDays, { hh, mm }) {
  const d = new Date(dateBase);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + offsetDays);
  d.setHours(hh, mm, 0, 0);
  return d;
}

function computeNextTransition(daysMap) {
  if (!daysMap) return { isOpen: false, closesAt: null, nextOpenAt: null };
  const now = new Date();
  const todayIndexMon0 = ((now.getDay() + 6) % 7);
  const curMin = now.getHours() * 60 + now.getMinutes();

  // gather windows for next 7 days
  const windows = [];
  for (let d = 0; d < 7; d++) {
    const key = DAY_KEYS[(todayIndexMon0 + d) % 7];
    const day = daysMap[key];
    if (!day || !day.enabled) continue;
    for (const s of day.slots || []) {
      const a = toMinutes(s.from); const b = toMinutes(s.to);
      if (a == null || b == null) continue;
      const startHM = parseHM(s.from); const endHM = parseHM(s.to);
      const start = buildAbs(now, d, startHM);
      let end = buildAbs(now, d, endHM);
      // overnight
      if (b <= a) end.setDate(end.getDate() + 1);
      windows.push({ start, end });
    }
  }
  windows.sort((x, y) => x.start - y.start);

  // Is open now?
  for (const w of windows) {
    if (now >= w.start && now <= w.end) {
      return { isOpen: true, closesAt: w.end, nextOpenAt: null };
    }
  }
  // Find next opening window
  for (const w of windows) {
    if (now < w.start) return { isOpen: false, closesAt: null, nextOpenAt: w.start };
  }
  return { isOpen: false, closesAt: null, nextOpenAt: null };
}

function formatTime(d, language) {
  const lang = (language || 'de').startsWith('ar') ? 'ar' : (language || 'de');
  // 12h for ar/en, 24h for de
  const is12h = !(language || 'de').startsWith('de');
  return d.toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit', hour12: is12h });
}

import FacebookIcon from '@mui/icons-material/Facebook';
import InstagramIcon from '@mui/icons-material/Instagram';

// Custom TikTok Icon since it's not in MUI and react-icons might not be installed
const TikTokIcon = (props) => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" {...props}>
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" />
  </svg>
);

export default function PublicOpeningHours({ hours, address, phone, whatsapp, social_tiktok, social_instagram, social_facebook, language = 'de' }) {
  const langKey = (language || 'de').startsWith('ar') ? 'ar' : ((language || 'de').startsWith('de') ? 'de' : 'en');
  const TXT = {
    en: { opening: 'Opening Hours', open: 'Open now', closed: 'Closed', closesAt: 'closes at', opensAt: 'opens at' },
    de: { opening: 'Öffnungszeiten', open: 'Jetzt geöffnet', closed: 'Geschlossen', closesAt: 'schließt um', opensAt: 'öffnet um' },
    ar: { opening: 'ساعات العمل', open: 'مفتوح الآن', closed: 'مغلق', closesAt: 'يغلق عند', opensAt: 'يفتح عند' },
  }[langKey];
  const days = useMemo(() => parseHours(hours), [hours]);
  const status = useMemo(() => computeNextTransition(days), [days]);
  const open = status.isOpen;
  const [expanded, setExpanded] = React.useState(false);
  React.useEffect(() => {
    try {
      const k = 'public.openingHours.expanded';
      const saved = localStorage.getItem(k);
      if (saved != null) setExpanded(saved === '1');
    } catch { }
  }, []);
  const toggleExpanded = () => {
    setExpanded((e) => {
      const v = !e; try { localStorage.setItem('public.openingHours.expanded', v ? '1' : '0'); } catch { }
      return v;
    });
  };

  return (
    <Paper elevation={0} sx={{ p: 2, mb: 2.5, borderRadius: 3, border: '1px solid #e5e7eb', bgcolor: '#fff' }}>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="flex-start">
        <Stack spacing={1} sx={{ minWidth: { md: 260 } }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <ScheduleIcon fontSize="small" />
            <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>{TXT.opening}</Typography>
            <Chip
              size="small"
              icon={open ? <CheckCircleRoundedIcon sx={{ color: '#fff !important' }} /> : <CancelRoundedIcon sx={{ color: '#fff !important' }} />}
              label={open ? `${TXT.open}${status.closesAt ? ` • ${TXT.closesAt} ${formatTime(status.closesAt, language)}` : ''}`
                : `${TXT.closed}${status.nextOpenAt ? ` • ${TXT.opensAt} ${formatTime(status.nextOpenAt, language)}` : ''}`}
              sx={{ ml: 1, borderRadius: 999, bgcolor: open ? '#16a34a' : '#ef4444', color: '#fff', height: 24, '& .MuiChip-label': { px: 1 } }}
            />
            <Box sx={{ flex: 1 }} />
            <Typography onClick={toggleExpanded} variant="caption" sx={{ cursor: 'pointer', userSelect: 'none', color: '#64748b' }}>
              {expanded ? (langKey === 'ar' ? 'إخفاء' : (langKey === 'de' ? 'Weniger' : 'Less')) : (langKey === 'ar' ? 'عرض المزيد' : (langKey === 'de' ? 'Mehr anzeigen' : 'Show more'))}
            </Typography>
            <IconButton size="small" onClick={toggleExpanded} aria-label={expanded ? 'Collapse' : 'Expand'}>
              <span style={{ display: 'inline-block', transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}>▾</span>
            </IconButton>
          </Stack>
          <Collapse in={expanded} timeout="auto" unmountOnExit={false}>
            {!days ? (
              <Typography variant="body2" color="text.secondary" sx={{ py: 0.75 }}>
                {TXT.closed}
              </Typography>
            ) : (
              <Box>
                {DAY_KEYS.map((k, i) => {
                  const d = days[k];
                  const label = dayLabel(i, language);
                  const isToday = (() => {
                    const now = new Date();
                    return ((now.getDay() + 6) % 7) === i;
                  })();
                  return (
                    <Stack key={k} direction="row" justifyContent="space-between" alignItems="center" sx={{ py: 0.5, opacity: !d || !d.enabled ? 0.65 : 1 }}>
                      <Typography sx={{ width: 140, minWidth: 140, fontWeight: isToday ? 800 : 600 }}>{label}</Typography>
                      <Stack direction="row" spacing={0.75} alignItems="center" sx={{ flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                        {(!d || !d.enabled || !(d.slots || []).length) ? (
                          <Chip size="small" label={TXT.closed} sx={{ borderRadius: 999, bgcolor: '#fee2e2', color: '#b91c1c', height: 22 }} />
                        ) : (
                          (d.slots || []).map((s, idx) => (
                            <Chip key={idx} size="small" label={`${s.from} - ${s.to}`} sx={{ borderRadius: 999, bgcolor: '#f1f5f9', color: '#0f172a', height: 22 }} />
                          ))
                        )}
                      </Stack>
                    </Stack>
                  );
                })}
              </Box>
            )}
          </Collapse>
        </Stack>

        <Divider flexItem orientation="vertical" sx={{ display: { xs: 'none', md: 'block' } }} />

        <Stack spacing={1} sx={{ flex: 1 }}>
          {address ? (
            <Stack direction="row" spacing={1.5} alignItems="flex-start">
              <LocationOnIcon fontSize="small" sx={{ flexShrink: 0, mt: 0.5, color: '#64748b' }} />
              <Typography variant="body2" sx={{ flex: 1, whiteSpace: 'pre-line', wordBreak: 'break-word', lineHeight: 1.6 }}>{address}</Typography>
            </Stack>
          ) : null}
          {phone ? (
            <Stack direction="row" spacing={1.5} alignItems="center">
              <CallIcon fontSize="small" sx={{ flexShrink: 0, color: '#64748b' }} />
              <Typography variant="body2" sx={{ flex: 1, wordBreak: 'break-all' }}>{phone}</Typography>
            </Stack>
          ) : null}
          {whatsapp ? (
            <Stack direction="row" spacing={1.5} alignItems="center">
              <WhatsAppIcon fontSize="small" sx={{ flexShrink: 0, color: '#64748b' }} />
              <Typography variant="body2" sx={{ flex: 1 }}>
                <a href={`https://wa.me/${String(whatsapp).replace(/\D+/g, '')}`} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'underline' }}>{whatsapp}</a>
              </Typography>
            </Stack>
          ) : null}

          {/* Social Media Links */}
          {(social_tiktok || social_instagram || social_facebook) && (
            <Stack
              direction="row"
              spacing={2}
              alignItems="center"
              justifyContent={{ xs: 'center', md: 'flex-start' }}
              sx={{
                pt: { xs: 2.5, md: 1 },
                mt: { xs: 1, md: 0 },
                width: '100%',
                borderTop: { xs: '1px solid #f1f5f9', md: 'none' }
              }}
            >
              {social_instagram && (
                <IconButton
                  component="a"
                  href={normalizeUrl(social_instagram)}
                  target="_blank"
                  rel="noopener noreferrer"
                  size="small"
                  sx={{ color: '#E1306C', bgcolor: '#fdf2f8', '&:hover': { bgcolor: '#fce7f3' } }}
                  title="Instagram"
                >
                  <InstagramIcon fontSize="small" />
                </IconButton>
              )}
              {social_facebook && (
                <IconButton
                  component="a"
                  href={normalizeUrl(social_facebook)}
                  target="_blank"
                  rel="noopener noreferrer"
                  size="small"
                  sx={{ color: '#1877F2', bgcolor: '#eff6ff', '&:hover': { bgcolor: '#dbeafe' } }}
                  title="Facebook"
                >
                  <FacebookIcon fontSize="small" />
                </IconButton>
              )}
              {social_tiktok && (
                <IconButton
                  component="a"
                  href={normalizeUrl(social_tiktok)}
                  target="_blank"
                  rel="noopener noreferrer"
                  size="small"
                  sx={{ color: '#000000', bgcolor: '#f3f4f6', '&:hover': { bgcolor: '#e5e7eb' } }}
                  title="TikTok"
                >
                  <TikTokIcon />
                </IconButton>
              )}
            </Stack>
          )}
        </Stack>
      </Stack>
    </Paper>
  );
}
