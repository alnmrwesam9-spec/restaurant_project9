import React, { useEffect, useState } from 'react';
import { Box, Checkbox, IconButton, Stack, TextField, Typography, Collapse, Divider, InputAdornment, Popover, List, ListItemButton, ListItemText } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutline';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import AccessTimeIcon from '@mui/icons-material/AccessTime';

const DAY_KEYS = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];

const defaultDay = () => ({ enabled: true, slots: [{ from: '11:00', to: '21:00' }] });
const defaultSchedule = () => DAY_KEYS.reduce((acc, k) => { acc[k] = defaultDay(); return acc; }, {});

function parseCompact(str) {
  // Accept formats like: d0=1@11:00-21:00;d1=0;d2=1@09:00-17:00,18:00-22:00
  try {
    const out = defaultSchedule();
    const parts = String(str).split(/[;|]/).map(s => s.trim()).filter(Boolean);
    for (const p of parts) {
      const m = p.match(/^(d([0-6])|mo|tu|we|th|fr|sa|su)\s*=\s*([01])(?:@(.+))?$/i);
      if (!m) continue;
      const code = m[1].toLowerCase();
      let idx = null;
      if (code.startsWith('d')) idx = parseInt(m[2], 10);
      else {
        const map = { mo:0, tu:1, we:2, th:3, fr:4, sa:5, su:6 };
        idx = map[code];
      }
      if (idx == null) continue;
      const key = DAY_KEYS[idx];
      const enabled = m[3] === '1';
      const times = (m[4] || '').split(',').map(s=>s.trim()).filter(Boolean);
      const slots = times.map(t => { const [a,b] = t.split('-'); return { from: a, to: b }; });
      out[key] = { enabled, slots: slots.length? slots : [{ from: '11:00', to: '21:00' }] };
    }
    return out;
  } catch { return null; }
}

function parseHours(value) {
  if (!value) return defaultSchedule();
  try {
    const obj = JSON.parse(value);
    let daysObj = null;
    if (obj && typeof obj === 'object') {
      if (obj.days && typeof obj.days === 'object') daysObj = obj.days;
      else if (obj.week && Array.isArray(obj.week)) {
        daysObj = {};
        obj.week.forEach((d) => {
          if (!d || !d.day) return;
          const key = String(d.day).toLowerCase();
          const slots = (d.ranges || d.slots || []).map((r) => ({ from: r[0] || r.from || '', to: r[1] || r.to || '' }));
          daysObj[key] = { enabled: !!d.enabled, slots };
        });
      } else if (Array.isArray(obj)) {
        daysObj = {};
        obj.forEach((d) => {
          if (!d || !d.day) return;
          const key = String(d.day).toLowerCase();
          const slots = (d.ranges || d.slots || []).map((r) => ({ from: r[0] || r.from || '', to: r[1] || r.to || '' }));
          daysObj[key] = { enabled: !!d.enabled, slots };
        });
      }
    }
    if (daysObj) {
      const base = defaultSchedule();
      for (const k of DAY_KEYS) {
        const v = daysObj[k] || daysObj[k[0].toUpperCase() + k.slice(1)] || null;
        if (v) base[k] = { enabled: !!v.enabled, slots: (Array.isArray(v.slots) ? v.slots : []).map((r) => ({ from: r.from || (Array.isArray(r) ? r[0] : ''), to: r.to || (Array.isArray(r) ? r[1] : '') })).filter(s => s.from && s.to) };
      }
      return base;
    }
  } catch {}
  const compact = parseCompact(value);
  if (compact) return compact;
  return defaultSchedule();
}

function getDayLabel(index, language) {
  const base = new Date(Date.UTC(2021, 0, 4 + index)); // Monday = 0
  const lang = (language || 'en').startsWith('ar') ? 'ar' : (language || 'en');
  return base.toLocaleDateString(lang, { weekday: 'long' });
}

export default function OpeningHoursEditor({ value, onChange, language = 'en', title }) {
  const [schedule, setSchedule] = useState(() => parseHours(value));
  useEffect(() => { setSchedule(parseHours(value)); }, [value]);

  const theme = useTheme();
  const isSmDown = useMediaQuery(theme.breakpoints.down('sm'));

  const emit = (next) => {
    setSchedule(next);
    try { onChange && onChange(JSON.stringify({ days: next })); } catch {}
  };

  const updateSlot = (k, idx, field, val) => {
    const next = { ...schedule, [k]: { ...schedule[k], slots: schedule[k].slots.map((s,i)=> i===idx? { ...s, [field]: val }: s) } };
    emit(next);
  };
  const addSlot = (k) => emit({ ...schedule, [k]: { ...schedule[k], slots: [...schedule[k].slots, { from: '11:00', to: '21:00' }] } });
  const removeSlot = (k, idx) => {
    const slots = schedule[k].slots.filter((_,i)=>i!==idx);
    emit({ ...schedule, [k]: { ...schedule[k], slots: slots.length ? slots : [{ from: '11:00', to: '21:00' }] } });
  };
  const toggleDay = (k, enabled) => emit({ ...schedule, [k]: { ...schedule[k], enabled } });

  const lang = (language || 'en').startsWith('de') ? 'de-DE' : ((language || 'en').startsWith('ar') ? 'ar' : 'en-US');
  const isArabic = (language || 'en').startsWith('ar');
  const timeInputProps = { step: 300, lang, inputMode: 'numeric', pattern: '[0-9:]*', style: { direction: 'ltr' } };

  const genTimes = (step = 30) => {
    const arr = [];
    for (let h = 0; h < 24; h++) {
      for (let m = 0; m < 60; m += step) {
        const hh = String(h).padStart(2, '0');
        const mm = String(m).padStart(2, '0');
        arr.push(`${hh}:${mm}`);
      }
    }
    return arr;
  };

  function TimeField({ value, onChange }) {
    return (
      isArabic ? (
        <TextField
          type="time"
          size="small"
          value={value}
          onChange={(e)=>onChange(e.target.value)}
          inputProps={{ ...timeInputProps, step: 300, lang, style: { direction: 'ltr' } }}
          InputProps={{ startAdornment: (<InputAdornment position="start"><AccessTimeIcon fontSize="small"/></InputAdornment>) }}
          sx={{ '& .MuiInputBase-root': { borderRadius: 999, width: 140, px: 1 } }}
        />
      ) : (
        <TimeFieldList value={value} onChange={onChange} />
      )
    );
  }

  function TimeFieldList({ value, onChange }) {
    const [anchor, setAnchor] = useState(null);
    const [text, setText] = useState(value || '');
    useEffect(() => setText(value || ''), [value]);
    const open = Boolean(anchor);
    const times = React.useMemo(() => genTimes(30), []);

    const handlePick = (val) => {
      onChange(val);
      setText(val);
      setAnchor(null);
    };

    return (
      <>
        <TextField
          type="text"
          size="small"
          value={text}
          onChange={(e)=>setText(e.target.value)}
          onBlur={() => {
            const m = String(text || '').match(/^(\d{1,2}):(\d{2})$/);
            if (!m) { setText(value || ''); return; }
            let h = Math.max(0, Math.min(23, parseInt(m[1], 10)));
            let mm = Math.max(0, Math.min(59, parseInt(m[2], 10)));
            const val = `${String(h).padStart(2,'0')}:${String(mm).padStart(2,'0')}`;
            onChange(val);
            setText(val);
          }}
          inputProps={{ inputMode: 'numeric', pattern: '[0-9:]*', style: { direction: 'ltr' }, placeholder: '09:00' }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <IconButton size="small" onClick={(e)=>setAnchor(e.currentTarget)} aria-label="pick time">
                  <AccessTimeIcon fontSize="small" />
                </IconButton>
              </InputAdornment>
            ),
            sx: { borderRadius: 999, width: 140, px: 1 }
          }}
        />
        <Popover
          open={open}
          anchorEl={anchor}
          onClose={() => setAnchor(null)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
          transformOrigin={{ vertical: 'top', horizontal: 'left' }}
          slotProps={{ paper: { sx: { maxHeight: 260, width: 140 } } }}
        >
          <List dense sx={{ py: 0 }}>
            {times.map((t) => (
              <ListItemButton key={t} selected={t===value} onClick={()=>handlePick(t)}>
                <ListItemText primaryTypographyProps={{ sx:{ fontSize: 14 } }} primary={t} />
              </ListItemButton>
            ))}
          </List>
        </Popover>
      </>
    );
  }

  // Per-day expand/collapse (listbox-like) – collapsed on mobile by default
  const [openDays, setOpenDays] = useState(() => {
    const init = {};
    DAY_KEYS.forEach((d) => (init[d] = !isSmDown));
    return init;
  });
  useEffect(() => {
    setOpenDays((prev) => {
      const next = { ...prev };
      DAY_KEYS.forEach((d) => (next[d] = !isSmDown));
      return next;
    });
  }, [isSmDown]);

  const closedLabel = (language || 'en').startsWith('ar') ? 'مغلق' : ((language || 'en').startsWith('de') ? 'Geschlossen' : 'Closed');

  const summary = (day) => {
    if (!day?.enabled) return closedLabel;
    const slots = Array.isArray(day.slots) ? day.slots : [];
    if (!slots.length) return closedLabel;
    if (slots.length === 1) return `${slots[0].from} - ${slots[0].to}`;
    return `${slots[0].from} - ${slots[0].to} (+${slots.length - 1})`;
  };

  // Whole-list collapse
  const [expandedList, setExpandedList] = useState(!isSmDown);
  useEffect(() => { setExpandedList(!isSmDown); }, [isSmDown]);

  // today summary
  const todayIdx = ((new Date().getDay() + 6) % 7);
  const todayLabel = getDayLabel(todayIdx, language);
  const todaySummary = summary(schedule[DAY_KEYS[todayIdx]]);

  return (
    <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0, border: '1px solid #e5e7eb', borderRadius: 3 }}>
      {/* Header for the whole list */}
      <Stack direction="row" alignItems="center" sx={{ px: 1, py: 0.75 }}>
        <IconButton size="small" onClick={()=>setExpandedList((v)=>!v)} aria-label="toggle list">
          <ExpandMoreIcon sx={{ transform: expandedList ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
        </IconButton>
        <Typography sx={{ fontWeight: 800, mr: 1 }}>{title || ( (language||'en').startsWith('ar') ? 'ساعات العمل' : ((language||'en').startsWith('de') ? 'Öffnungszeiten' : 'Opening Hours') )}</Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', ml: 'auto', mr: 1 }}>{todayLabel}: {todaySummary}</Typography>
      </Stack>
      <Divider sx={{ opacity: 0.6 }} />
      <Collapse in={expandedList} timeout="auto" unmountOnExit={false}>
      {DAY_KEYS.map((k, i) => {
        const day = schedule[k];
        const isOpen = !!openDays[k];
        return (
          <Box component="li" key={k} sx={{ px: 1 }}>
            {/* Header row */}
            <Stack direction="row" alignItems="center" spacing={1} sx={{ py: 0.75 }}>
              <Checkbox checked={!!day.enabled} onChange={(e)=>toggleDay(k, e.target.checked)} />
              <Typography sx={{ width: 140, minWidth: 140, fontWeight: 800 }}>{getDayLabel(i, language)}</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ flex: 1, textAlign: 'start', opacity: day.enabled ? 1 : 0.7 }}>
                {summary(day)}
              </Typography>
              <IconButton size="small" onClick={() => setOpenDays((s) => ({ ...s, [k]: !s[k] }))} aria-label="expand">
                <ExpandMoreIcon sx={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
              </IconButton>
            </Stack>

            {/* Body (slots) */}
            <Collapse in={isOpen} timeout="auto" unmountOnExit={false}>
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap', pb: 1, pl: { xs: 6, sm: 7 } }}>
                {day.slots.map((slot, idx) => (
                  <Stack key={idx} direction="row" spacing={1} alignItems="center" sx={{ mr: 1, mb: 0.5 }}>
                    <TimeField value={slot.from} onChange={(val)=>updateSlot(k, idx, 'from', val)} />
                    <Typography variant="body2">-</Typography>
                    <TimeField value={slot.to} onChange={(val)=>updateSlot(k, idx, 'to', val)} />
                    {day.slots.length > 1 && (
                      <IconButton aria-label="remove interval" size="small" onClick={()=>removeSlot(k, idx)}>
                        <RemoveCircleOutlineIcon fontSize="small" />
                      </IconButton>
                    )}
                  </Stack>
                ))}
                <IconButton aria-label="add interval" size="small" onClick={()=>addSlot(k)}>
                  <AddCircleOutlineIcon fontSize="small" />
                </IconButton>
              </Stack>
            </Collapse>
            {i < DAY_KEYS.length - 1 && <Divider sx={{ opacity: 0.6 }} />}
          </Box>
        );
      })}
      </Collapse>
    </Box>
  );
}
