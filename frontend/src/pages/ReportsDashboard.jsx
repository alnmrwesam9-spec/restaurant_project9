// src/pages/ReportsDashboard.jsx
// داشبورد UI + موشن (framer-motion) بدون مكتبات رسوم خارجية
// - KPIs: stagger + fade/slide
// - Line chart: رسم تدريجي لمسارات SVG
// - Donut: sweep متدرّج + نبضة خفيفة
// يعتمد على مفاتيح الترجمة المسطّحة

import React, { useMemo } from 'react';
import {
  Box, Button, Card, CardContent, Chip, Container, Divider, Grid,
  IconButton, Stack, Table, TableBody, TableCell, TableHead, TableRow,
  Typography, Avatar, Paper
} from '@mui/material';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';

// ---------------- Motion helpers ----------------
const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0 }
};
const fade = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 }
};
const containerStagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } }
};

// ---------------- KPI Card ----------------
const StatCard = ({ title, value, delta, delay = 0 }) => (
  <motion.div variants={fadeUp} transition={{ duration: 0.45, ease: 'easeOut', delay }}>
    <Card variant="outlined" sx={{ borderRadius: 3 }}>
      <CardContent>
        <Typography variant="body2" color="text.secondary" mb={0.5}>{title}</Typography>
        <Typography variant="h5" fontWeight={800}>{value}</Typography>
        {delta && (
          <Stack direction="row" spacing={0.5} alignItems="center" mt={0.5}>
            <ArrowUpwardIcon fontSize="small" color="success" />
            <Typography variant="caption" color="success.main">{delta}</Typography>
          </Stack>
        )}
      </CardContent>
    </Card>
  </motion.div>
);

// ---------------- Line Chart (animated SVG) ----------------
const LineChartLite = () => {
  const paths = useMemo(() => ([
    { d: 'M0,160 C100,80 180,120 260,70 C340,30 420,110 510,70 C560,55 600,90 600,90', color: '#5b8def' },
    { d: 'M0,180 C100,120 180,160 260,110 C340,80 420,160 510,120 C560,110 600,150 600,150', color: '#22c55e' },
  ]), []);

  return (
    <Box sx={{ width: '100%', height: 220 }}>
      <svg viewBox="0 0 600 220" width="100%" height="100%" preserveAspectRatio="none">
        {[40, 90, 140, 190].map((y) => (
          <motion.line
            key={y}
            x1="0" x2="600" y1={y} y2={y}
            stroke="#eef2f7"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.1 + y / 400 }}
          />
        ))}

        {paths.map((p, i) => (
          <motion.path
            key={i}
            d={p.d}
            fill="none"
            stroke={p.color}
            strokeWidth="3"
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1.2, ease: 'easeInOut', delay: 0.2 + i * 0.15 }}
          />
        ))}
      </svg>
    </Box>
  );
};

// ---------------- Donut (animated sweep) ----------------
const DonutTop3 = () => {
  const segs = [40, 35, 25];
  const colors = ['#5b8def', '#22c55e', '#94a3b8'];
  const r = 90, cx = 110, cy = 110;
  const C = 2 * Math.PI * r;

  let acc = 0;
  const segments = segs.map((pct, idx) => {
    const len = (pct / 100) * C;
    const dashArray = `${len} ${C - len}`;
    const dashOffset = C - (acc / 100) * C;
    acc += pct;
    return { dashArray, dashOffset, color: colors[idx], delay: 0.2 + idx * 0.2 };
  });

  return (
    <motion.div
      initial={{ rotate: -90, scale: 0.96, opacity: 0 }}
      animate={{ rotate: 0, scale: 1, opacity: 1 }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
      style={{ width: 220, height: 220, margin: '0 auto', position: 'relative' }}
    >
      <svg viewBox="0 0 220 220" width="100%" height="100%">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#eef2f7" strokeWidth="24" />
        {segments.map((s, i) => (
          <motion.circle
            key={i}
            cx={cx} cy={cy} r={r}
            fill="none"
            stroke={s.color}
            strokeWidth="24"
            strokeLinecap="butt"
            strokeDasharray={s.dashArray}
            strokeDashoffset={s.dashOffset}
            initial={{ strokeDashoffset: C }}
            animate={{ strokeDashoffset: s.dashOffset }}
            transition={{ duration: 1.1, ease: 'easeInOut', delay: s.delay }}
          />
        ))}
      </svg>

      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.9 }}
        style={{
          position: 'absolute', inset: 16, borderRadius: '50%',
          background: 'var(--mui-palette-background-paper)',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}
      >
        <motion.div
          animate={{ scale: [1, 1.03, 1] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
        >
          <Typography variant="h6" fontWeight={800}>Top 3</Typography>
        </motion.div>
      </motion.div>
    </motion.div>
  );
};

// ---------------- Page ----------------
export default function ReportsDashboard() {
  const { t } = useTranslation();

  const rows = [
    { id: '#12345', customer: 'Sophia Clark', date: '2023-08-15', amount: '$50.00', status: 'completed' },
    { id: '#12346', customer: 'Ethan Miller', date: '2023-08-14', amount: '$75.00', status: 'pending' },
    { id: '#12347', customer: 'Olivia Davis', date: '2023-08-13', amount: '$100.00', status: 'completed' },
    { id: '#12348', customer: 'Liam Wilson', date: '2023-08-12', amount: '$25.00', status: 'cancelled' },
    { id: '#12349', customer: 'Ava Martínez', date: '2023-08-11', amount: '$60.00', status: 'completed' },
  ];

  return (
    <Container maxWidth="lg" sx={{ py: 3 }}>
      {/* Header */}
      <Stack component={motion.div} variants={fade} initial="hidden" animate="visible"
             transition={{ duration: 0.35 }}
             direction="row" alignItems="center" justifyContent="space-between" mb={2}>
        <Typography variant="h6" fontWeight={800}>{t('reports_analytics')}</Typography>

        <Stack direction="row" spacing={1} alignItems="center">
          <Button variant="outlined" startIcon={<CalendarMonthIcon />} sx={{ borderRadius: 2 }}>
            {t('date_range') || 'Date Range'}
          </Button>
          <Button variant="contained" startIcon={<FileDownloadIcon />} sx={{ borderRadius: 2 }}>
            {t('export') || t('export_excel') || 'Export'}
          </Button>
          <Avatar sx={{ width: 32, height: 32 }}>IB</Avatar>
        </Stack>
      </Stack>

      {/* Stats with stagger */}
      <Grid container spacing={2} mb={2} component={motion.div}
            variants={containerStagger} initial="hidden" animate="visible">
        <Grid item xs={12} sm={6} md={3}><StatCard title={t('total_users')} value="12,345" delta="+12%" /></Grid>
        <Grid item xs={12} sm={6} md={3}><StatCard title={t('active_visitors')} value="2,345" delta="+8%" /></Grid>
        <Grid item xs={12} sm={6} md={3}><StatCard title={t('orders_today')} value="123" delta="+5%" /></Grid>
        <Grid item xs={12} sm={6} md={3}><StatCard title={t('revenue')} value="$4,567" delta="+10%" /></Grid>
      </Grid>

      {/* Charts */}
      <Grid container spacing={2} mb={2}>
        <Grid item xs={12} md={8}>
          <motion.div variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.2 }}
                      transition={{ duration: 0.45, ease: 'easeOut' }}>
            <Card variant="outlined" sx={{ borderRadius: 3, height: '100%' }}>
              <CardContent>
                <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
                  <Typography variant="subtitle1" fontWeight={800}>{t('users_visitors_over_time')}</Typography>
                  <IconButton size="small"><MoreVertIcon /></IconButton>
                </Stack>
                <LineChartLite />
              </CardContent>
            </Card>
          </motion.div>
        </Grid>

        <Grid item xs={12} md={4}>
          <motion.div variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.2 }}
                      transition={{ duration: 0.45, ease: 'easeOut', delay: 0.1 }}>
            <Card variant="outlined" sx={{ borderRadius: 3, height: '100%' }}>
              <CardContent>
                <Typography variant="subtitle1" fontWeight={800} mb={1}>{t('top_ordered_dishes')}</Typography>
                <DonutTop3 />
                <Stack direction="row" spacing={1} justifyContent="center" mt={2}>
                  <Chip size="small" label="Sushi" sx={{ bgcolor: '#5b8def', color: '#fff' }} />
                  <Chip size="small" label="Burger" sx={{ bgcolor: '#22c55e', color: '#fff' }} />
                  <Chip size="small" label="Pasta" sx={{ bgcolor: '#94a3b8', color: '#fff' }} />
                </Stack>
              </CardContent>
            </Card>
          </motion.div>
        </Grid>
      </Grid>

      {/* Recent Orders */}
      <motion.div variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.2 }}
                  transition={{ duration: 0.45, ease: 'easeOut' }}>
        <Card variant="outlined" sx={{ borderRadius: 3, mb: 2 }}>
          <CardContent>
            <Typography variant="subtitle1" fontWeight={800} mb={1}>{t('recent_orders')}</Typography>
            <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>{t('order_id')}</TableCell>
                    <TableCell>{t('customer')}</TableCell>
                    <TableCell>{t('date')}</TableCell>
                    <TableCell align="right">{t('amount')}</TableCell>
                    <TableCell>{t('status')}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.map((row, i) => (
                    <TableRow
                      key={row.id}
                      component={motion.tr}
                      initial={{ opacity: 0, y: 8 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.35, delay: 0.05 * i }}
                      hover
                    >
                      <TableCell sx={{ fontWeight: 700 }}>{row.id}</TableCell>
                      <TableCell>{row.customer}</TableCell>
                      <TableCell>{row.date}</TableCell>
                      <TableCell align="right">{row.amount}</TableCell>
                      <TableCell>
                        {row.status === 'completed' && <Chip size="small" label={t('completed')} color="success" />}
                        {row.status === 'pending' && <Chip size="small" label={t('pending')} color="warning" />}
                        {row.status === 'cancelled' && <Chip size="small" label={t('cancelled')} color="error" />}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Paper>
          </CardContent>
        </Card>
      </motion.div>

      {/* Highlights */}
      <Grid container spacing={2}>
        <Grid item xs={12} md={8}>
          <motion.div variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.2 }}
                      transition={{ duration: 0.45, ease: 'easeOut' }}>
            <Card variant="outlined" sx={{ borderRadius: 3, overflow: 'hidden' }}>
              <motion.div initial={{ scale: 1.02 }} animate={{ scale: 1 }} transition={{ duration: 1.2, ease: 'easeOut' }}>
                <Box sx={{ height: 210, backgroundImage: 'url(https://images.unsplash.com/photo-1550317138-10000687a72b?q=80&w=1400&auto=format&fit=crop)', backgroundSize: 'cover', backgroundPosition: 'center' }} />
              </motion.div>
              <CardContent>
                <Typography variant="subtitle2" fontWeight={800}>{t('most_popular_dish')}</Typography>
                <Typography variant="body2" color="text.secondary">Burger</Typography>
              </CardContent>
            </Card>
          </motion.div>
        </Grid>
        <Grid item xs={12} md={4}>
          <motion.div variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.2 }}
                      transition={{ duration: 0.45, ease: 'easeOut', delay: 0.05 }}>
            <Card variant="outlined" sx={{ borderRadius: 3, overflow: 'hidden' }}>
              <motion.div initial={{ scale: 1.02 }} animate={{ scale: 1 }} transition={{ duration: 1.2, ease: 'easeOut' }}>
                <Box sx={{ height: 210, backgroundImage: 'url(https://images.unsplash.com/photo-1505685296765-3a2736de412f?q=80&w=1200&auto=format&fit=crop)', backgroundSize: 'cover', backgroundPosition: 'center' }} />
              </motion.div>
              <CardContent>
                <Typography variant="subtitle2" fontWeight={800}>{t('peak_hours')}</Typography>
                <Typography variant="body2" color="text.secondary">6 PM - 8 PM</Typography>
              </CardContent>
            </Card>
          </motion.div>
        </Grid>
      </Grid>

      <Divider sx={{ my: 3 }} />
      <Typography variant="caption" color="text.secondary">
        {t('feature_soon')} — UI Mockup
      </Typography>
    </Container>
  );
}
