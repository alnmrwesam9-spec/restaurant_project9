// src/pages/MenusPage.view.jsx
import React from 'react';
import { useMenusPage } from './MenusPage.context';
import { alpha } from '@mui/material/styles';

function MenusPageView() {
  const ctx = useMenusPage();
  const {
    t, i18n, theme, isRTL,
    CONTENT_MAX, CARD_W, CARD_H, IMG_H, NAME_MIN_H, PRICE_ROW_H, PLACEHOLDER, PLACEHOLDER_HERO,

    // Layout & sidebar
    AppSidebar, SIDEBAR_WIDTH, RAIL_WIDTH,
    sidebar,

    // Data
    menus, loading, error,
    selectedMenuId, setSelectedMenuId, selectedMenu,
    sections, dishesBySection,
    profile,

    // Display
    selectedDisplay, displayLoading, heroSrc, dividerSideKey,

    // Top actions
    newMenuName, setNewMenuName, handleCreateMenu,
    publicUrl, copyPublicLink, deleteMenuNow,

    // Export
    exportingId, handleExportMenu,

    // Excel
    hiddenFileId, openExcelPicker,
    excelDialog, setExcelDialog, excelBusy, excelError, excelFileName,
    importMenuName, setImportMenuName, sheetsPreview, setSheetsPreview,
    handleExcelChosenKeepWB, doImportNow, excelRun, excelProg,

    // Dish dialog
    dishOpen, setDishOpen, dishSel, setDishSel, openDish,

    // Generate dialog
    genOpen, setGenOpen, genBusy, genForce, setGenForce, genDryRun,
    genLang, setGenLang, genUseLLM, setGenUseLLM, genLLMDryRun, setGenLLMDryRun,
    genModel, setGenModel, genMaxTerms, setGenMaxTerms, genTemperature, setGenTemperature,
    genDishIdsText, setGenDishIdsText, llmGuessCodes, setLlmGuessCodes, llmDebug, setLlmDebug,
    isAdmin, saveAsGlobal, setSaveAsGlobal, upsertBusy,
    llmSelect, setLlmSelect, candFilter, setCandFilter, selectedCount,
    genRules, setGenRules, genPreview, setGenPreview, genCounts, setGenCounts, genLLM, setGenLLM,
    filteredLLMItems, previewGenerate, runGenerate, toggleSelectAllVisible, handleUpsertSelected,

    // Utils
    formatEuro, dishCardImage, pickPrimarySecondary,

    // Feedback
    snack, setSnack,

    // Langs
    LANGS, changeLang,

    // For JSX imports usage
    Icons, MUI, Link, CodesEditor,
  } = ctx;

  const {
    Container, Typography, TextField, Button, Stack, Card, CardContent, Box, Alert,
    CircularProgress, Grid, Chip, Snackbar,
    Dialog, DialogTitle, DialogContent, DialogActions, List, ListItem, ListItemIcon,
    ListItemText, Checkbox, Skeleton, CardActionArea, Divider,
    IconButton, Autocomplete, Switch, FormControlLabel, Tooltip, InputAdornment, MenuItem, Select,
    Grow, Fade
  } = MUI;

  const {
    AddIcon, FolderIcon, DeleteIcon, FileDownloadIcon, LinkIcon, ContentCopyIcon, SettingsIcon,
    UploadFileIcon, CheckCircleIcon, WarningAmberIcon, ScienceIcon, RefreshIcon, MenuIcon,
    InfoOutlinedIcon, SearchIcon, LanguageIcon,
  } = Icons;

  // Delete confirmation dialog state
  const [confirmDeleteOpen, setConfirmDeleteOpen] = React.useState(false);
  const [pendingDeleteId, setPendingDeleteId] = React.useState(null);

  const openDeleteConfirm = (id) => {
    setPendingDeleteId(id);
    setConfirmDeleteOpen(true);
  };

  const handleCancelDelete = () => {
    setConfirmDeleteOpen(false);
    setPendingDeleteId(null);
  };

  const handleConfirmDelete = () => {
    if (pendingDeleteId) {
      deleteMenuNow(pendingDeleteId);
    }
    setConfirmDeleteOpen(false);
    setPendingDeleteId(null);
  };

  // ���� ���� �������
  const SafeImg = React.forwardRef(function SafeImg(
    { src, alt, fallback, onError, ...props },
    ref
  ) {
    const handleErr = (e) => {
      e.currentTarget.onerror = null;
      if (fallback) e.currentTarget.src = fallback;
      if (typeof onError === 'function') onError(e);
    };
    return (
      <Box
        component="img"
        ref={ref}
        src={src || fallback}
        alt={alt}
        loading="lazy"
        decoding="async"
        onError={handleErr}
        {...props}
      />
    );
  });

  // ���� ��������
  const HERO_SOURCES = {
    lg: '/assets/hero/brand-4x1.svg',
    md: '/assets/hero/brand-16x9.svg',
    sm: '/assets/hero/brand-1x1.svg',
  };

  function ResponsiveHero({ alt, fallback, height = 170, srcFallback }) {
    return (
      <picture>
        <source media="(min-width: 1200px)" srcSet={HERO_SOURCES.lg} />
        <source media="(min-width: 600px)" srcSet={HERO_SOURCES.md} />
        <img
          src={srcFallback || HERO_SOURCES.sm}
          alt={alt}
          loading="lazy"
          decoding="async"
          style={{
            width: '100%',
            height: 'clamp(120px, 28vw, 180px)',
            objectFit: 'contain',
            display: 'block',
            borderRadius: 8,
            boxShadow: '0 6px 24px rgba(0,0,0,.06)',
            background: 'transparent'
          }}
          onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = fallback; }}
        />
      </picture>
    );
  }

  // �� ����� ���� (������)
  const scrollRowSx = {
    display: 'flex',
    gap: 1,
    overflowX: 'auto',
    flexWrap: 'nowrap',
    whiteSpace: 'nowrap',
    px: 0.5,
    py: 0.5,
    WebkitOverflowScrolling: 'touch',
    '& > *': { flex: '0 0 auto' },
    '&::-webkit-scrollbar': { display: 'none' },
    scrollbarWidth: 'none',
    msOverflowStyle: 'none',
  };

  // ����� ������ ������� (������)
  const cardsHScrollSx = {
    display: 'flex',
    gap: 8,
    overflowX: 'auto',
    flexWrap: 'nowrap',
    px: 0.5,
    py: 0.5,
    scrollSnapType: 'x mandatory',
    WebkitOverflowScrolling: 'touch',
    '& > *': { flex: '0 0 auto', scrollSnapAlign: 'start' },
    '&::-webkit-scrollbar': { display: 'none' },
    scrollbarWidth: 'none',
    msOverflowStyle: 'none',
  };

  const pillSx = { borderRadius: 999, whiteSpace: 'nowrap' };

  return (
    <Box
      sx={{
        display: 'flex',
        direction: i18n.dir(),
        bgcolor: 'background.default',
        width: '100%',
        minWidth: 0,
        overflowX: 'clip',
      }}
    >
      <AppSidebar
        mobileOpen={sidebar.mobileOpen}
        onMobileClose={() => sidebar.setMobileOpen(false)}
        collapsed={sidebar.collapsed}
        onToggleCollapsed={() => sidebar.setCollapsed(!sidebar.collapsed)}
        profile={profile}
        menus={menus}
        selectedMenuId={selectedMenuId}
        onSelectMenu={(id) => { setSelectedMenuId(id == null ? null : String(id)); sidebar.setMobileOpen(false); }}
        onPickImport={() => { sidebar.setMobileOpen(false); openExcelPicker(); }}
        onUploadAvatar={ctx.handleUploadAvatar}
        isRTL={isRTL}
      />

      {/* ������� ������� ������� ������� (���� window) */}
      <Box
        className="main-scroll-area"
        sx={{
          flex: 1,
          minWidth: 0,
          overflowX: 'clip',
          overflowY: 'auto',
          position: 'relative',
          height: '100vh',
          overscrollBehaviorY: 'contain',
          overscrollBehaviorX: 'none',
          ...(isRTL ? { mr: sidebar.sidebarOffset } : { ml: sidebar.sidebarOffset }),
          transition: theme.transitions.create('margin', { duration: 180 })
        }}
      >
        <Container
          maxWidth="lg"
          sx={{
            px: { xs: 1, sm: 2 },
            py: { xs: 2, sm: 3 },
            overflowX: 'clip',
            pb: { xs: 8, md: 4 }
          }}
        >
          <Box sx={(theme) => theme.mixins.toolbar} />

          <input
            id={hiddenFileId}
            type="file"
            accept=".xlsx,.xls"
            style={{ display: 'none' }}
            onChange={handleExcelChosenKeepWB}
          />

          {/* ���� ���� � ������ */}
          <Box
            sx={{
              display: { xs: 'flex', md: 'none' },
              alignItems: 'center',
              gap: 1,
              mb: 1.5,
              position: 'sticky',
              top: 0,
              zIndex: 1,
              backgroundColor: 'background.default',
              py: 0.5,
              borderRadius: 1
            }}
          >
            <IconButton
              aria-label={t('aria.open_sidebar')}
              onClick={() => sidebar.setMobileOpen(true)}
              size="small"
              sx={{ border: '1px solid', borderColor: 'divider', bgcolor: 'background.paper' }}
            >
              <MenuIcon fontSize="small" />
            </IconButton>

            <Autocomplete
              size="small"
              disableClearable
              options={menus}
              getOptionLabel={(o) => o?.name || ''}
              value={menus.find((m) => String(m.id) === String(selectedMenuId)) || null}
              onChange={(_, v) => v?.id && setSelectedMenuId(String(v.id))}
              sx={{ flex: 1, bgcolor: 'background.paper', borderRadius: 1, minWidth: 0 }}
              renderInput={(params) => (
                <TextField {...params} label={t('labels.menu')} />
              )}
            />

            <LanguageIcon fontSize="small" />
            <Select size="small" value={i18n.language} onChange={(e) => changeLang(e.target.value)}>
              {LANGS.map((l) => (
                <MenuItem key={l.code} value={l.code}>{l.label}</MenuItem>
              ))}
            </Select>
          </Box>

          {/* ������� + ����� ����� ����� */}
          <Box sx={{ maxWidth: CONTENT_MAX, mx: 'auto', mb: 2, minWidth: 0 }}>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.25} alignItems={{ md: 'center' }} justifyContent="space-between">
              <Typography variant="h2" fontWeight={700} data-tour="menus-title">
                {t('my_menus')}
              </Typography>

              {/* ����� ��� ������� + �� ������� */}
              <Stack direction="row" spacing={1} sx={{ width: '100%', maxWidth: 520 }} data-tour="menu-create">
                <TextField
                  fullWidth
                  placeholder={t('labels.new_menu_name')}
                  value={newMenuName}
                  onChange={(e) => ctx.setNewMenuName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleCreateMenu(); }}
                  sx={{ bgcolor: 'background.paper', '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                />
                <Button
                  onClick={handleCreateMenu}
                  startIcon={<AddIcon />}
                  variant="contained"
                  color="primary"
                  sx={{ borderRadius: 999, px: 2, boxShadow: 'none' }}
                >
                  {t('actions.add')}
                </Button>
              </Stack>
            </Stack>
          </Box>

          {/* Excel/Errors/Loading */}
          {excelBusy && !excelDialog && (
            <Grid container sx={{ my: 2, overflowX: 'clip', pb: { xs: 8, md: 4 } }}>
              <Grid item xs={12}>
                <Box sx={{ maxWidth: CONTENT_MAX, mx: 'auto', display: 'flex', alignItems: 'center', gap: 2, minWidth: 0 }}>
                  <CircularProgress size={22} />
                  <Typography>{t('excel.reading')}</Typography>
                </Box>
              </Grid>
            </Grid>
          )}
          {excelError && (
            <Grid container sx={{ overflowX: 'clip', pb: { xs: 8, md: 4 } }}>
              <Grid item xs={12}>
                <Box sx={{ maxWidth: CONTENT_MAX, mx: 'auto', minWidth: 0 }}>
                  <Alert severity="error" sx={{ mb: 2 }}>{excelError}</Alert>
                </Box>
              </Grid>
            </Grid>
          )}

          {loading ? (
            <Box sx={{ maxWidth: CONTENT_MAX, mx: 'auto', display: 'flex', justifyContent: 'center', my: 4, minWidth: 0 }}>
              <CircularProgress />
            </Box>
          ) : error ? (
            <Grid container sx={{ overflowX: 'clip', pb: { xs: 8, md: 4 } }}>
              <Grid item xs={12}>
                <Box sx={{ maxWidth: CONTENT_MAX, mx: 'auto', minWidth: 0 }}>
                  <Alert severity="error">{error}</Alert>
                </Box>
              </Grid>
            </Grid>
          ) : !selectedMenu ? (
            <Grid container sx={{ overflowX: 'clip', pb: { xs: 8, md: 4 } }}>
              <Grid item xs={12}>
                <Box sx={{ maxWidth: CONTENT_MAX, mx: 'auto', minWidth: 0 }}>
                  <Alert severity="info">?? {t('empty.no_menus_yet')}</Alert>
                </Box>
              </Grid>
            </Grid>
          ) : (
            <Grid container spacing={2} alignItems="stretch" justifyContent="center" sx={{ overflowX: 'clip', pb: { xs: 8, md: 4 } }}>
              <Grid item xs={12}>
                <Box sx={{ maxWidth: CONTENT_MAX, mx: 'auto', minWidth: 0 }}>
                  {/* ����� ������� �������� */}
                  <Card
                    variant="outlined"
                    sx={{
                      borderRadius: 3,
                      overflow: 'hidden',
                      boxShadow: '0 8px 28px rgba(18, 28, 45, .06)',
                      bgcolor: (t) => alpha(t.palette.secondary.main, 0.06),
                      borderColor: (t) => alpha(t.palette.secondary.main, 0.28),
                    }}
                  >
                    <Grid container sx={{ overflowX: 'clip', pb: { xs: 8, md: 4 } }}>
                      <Grid item xs={12} md={7}>
                        <CardContent sx={{ pb: 2 }}>
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: .25 }}>
                            {t('labels.status')}
                          </Typography>

                          <Stack direction="row" alignItems="center" spacing={1.25} sx={{ mb: 1 }}>
                            <FolderIcon fontSize="small" />
                            <Typography variant="subtitle1" fontWeight={800}>{selectedMenu.name}</Typography>
                            {selectedMenu.is_published
                              ? <Chip size="small" color="success" label={t('labels.published')} sx={{ fontWeight: 700 }} />
                              : <Chip size="small" variant="outlined" label={t('labels.not_published')} />
                            }
                          </Stack>

                          <Button
                            component={Link}
                            to={`/menus/${selectedMenu.id}/public-settings`}
                            startIcon={<SettingsIcon />}
                            size="small"
                            variant="outlined"
                            sx={{ mb: 2, borderRadius: 999 }}
                          >
                            {t('actions.settings')}
                          </Button>

                          {/* ����� ���� � ����� ���� ��� xs */}
                          <Box sx={{ display: { xs: 'block', sm: 'none' }, mb: 1 }}>
                            <Box sx={scrollRowSx}>
                              <Button
                                component={Link}
                                to={`/menus/${selectedMenu.id}`}
                                variant="contained"
                                color="primary"
                                size="small"
                                data-tour="menu-go"
                                data-vp="mobile"
                                sx={{ ...pillSx, boxShadow: 'none' }}
                              >
                                {t('actions.go_to_menu')}
                              </Button>
                              <Button
                                size="small"
                                startIcon={<FileDownloadIcon />}
                                onClick={() => handleExportMenu(selectedMenu)}
                                disabled={exportingId === selectedMenu.id}
                                variant="outlined"
                                sx={pillSx}
                              >
                                {exportingId === selectedMenu.id ? t('export.exporting') : t('export.export_excel')}
                              </Button>
                              {/* �� ������� (������) */}
                              <Button
                                size="small"
                                startIcon={<ScienceIcon />}
                                variant="outlined"
                                data-tour="generate-allergens"
                                data-vp="mobile"
                                sx={pillSx}
                                onClick={() => {
                                  setGenOpen(true);
                                  setGenCounts(null);
                                  setGenPreview([]);
                                  setGenRules(null);
                                  setGenLLM(null);
                                  ctx.setGenDryRun(true);
                                  setCandFilter('');
                                }}
                              >
                                {t('actions.generate_allergens')}
                              </Button>
                              {!!selectedMenu.is_published && !!selectedMenu.public_slug && (
                                <Button
                                  size="small"
                                  startIcon={<LinkIcon />}
                                  component="a"
                                  href={publicUrl(selectedMenu)}
                                  target="_blank"
                                  rel="noreferrer"
                                  variant="outlined"
                                  sx={pillSx}
                                >
                                  {t('actions.public_page')}
                                </Button>
                              )}
                            </Box>
                          </Box>

                          {/* ����� ���� � ����� ���� */}
                          <Stack direction="row" spacing={1} flexWrap="wrap" alignItems="center" sx={{ mb: 1, display: { xs: 'none', sm: 'flex' } }}>
                            <Button
                              component={Link}
                              to={`/menus/${selectedMenu.id}`}
                              variant="contained"
                              color="primary"
                              size="small"
                              data-tour="menu-go"
                              data-vp="desktop"
                              sx={{ borderRadius: 999, boxShadow: 'none' }}
                            >
                              {t('actions.go_to_menu')}
                            </Button>
                            <Button
                              size="small"
                              startIcon={<FileDownloadIcon />}
                              onClick={() => handleExportMenu(selectedMenu)}
                              disabled={exportingId === selectedMenu.id}
                              variant="outlined"
                              sx={{ borderRadius: 999 }}
                            >
                              {exportingId === selectedMenu.id ? t('export.exporting') : t('export.export_excel')}
                            </Button>
                            <Button
                              size="small"
                              startIcon={<ScienceIcon />}
                              variant="outlined"
                              data-tour="generate-allergens"
                              data-vp="desktop"
                              sx={{ borderRadius: 999 }}
                              onClick={() => {
                                setGenOpen(true);
                                setGenCounts(null);
                                setGenPreview([]);
                                setGenRules(null);
                                setGenLLM(null);
                                ctx.setGenDryRun(true);
                                setCandFilter('');
                              }}
                            >
                              {t('actions.generate_allergens')}
                            </Button>
                            {!!selectedMenu.is_published && !!selectedMenu.public_slug && (
                              <Button
                                size="small"
                                startIcon={<LinkIcon />}
                                component="a"
                                href={publicUrl(selectedMenu)}
                                target="_blank"
                                rel="noreferrer"
                                variant="outlined"
                                sx={{ borderRadius: 999 }}
                              >
                                {t('actions.public_page')}
                              </Button>
                            )}
                          </Stack>

                          {/* ����� ������ � ������ ��� */}
                          <Box sx={{ display: { xs: 'block', sm: 'none' } }}>
                            <Box sx={scrollRowSx}>
                              {!!selectedMenu.is_published && !!selectedMenu.public_slug && (
                                <Button
                                  size="small"
                                  startIcon={<ContentCopyIcon />}
                                  onClick={() => copyPublicLink(selectedMenu)}
                                  variant="text"
                                  sx={pillSx}
                                >
                                  {t('actions.copy_link')}
                                </Button>
                              )}
                              <Button
                                size="small"
                                color="error"
                                startIcon={<DeleteIcon />}
                                onClick={() => openDeleteConfirm(selectedMenu.id)}
                                variant="text"
                                sx={pillSx}
                              >
                                {t('actions.delete')}
                              </Button>
                            </Box>
                          </Box>

                          {/* ����� ������ � ����� ���� */}
                          <Stack direction="row" spacing={1.5} alignItems="center" sx={{ display: { xs: 'none', sm: 'flex' } }}>
                            {!!selectedMenu.is_published && !!selectedMenu.public_slug && (
                              <Button
                                size="small"
                                startIcon={<ContentCopyIcon />}
                                onClick={() => copyPublicLink(selectedMenu)}
                                variant="text"
                                sx={{ borderRadius: 2 }}
                              >
                                {t('actions.copy_link')}
                              </Button>
                            )}
                            <Button
                              size="small"
                              color="error"
                              startIcon={<DeleteIcon />}
                              onClick={() => openDeleteConfirm(selectedMenu.id)}
                              variant="text"
                              sx={{ borderRadius: 2 }}
                            >
                              {t('actions.delete')}
                            </Button>
                          </Stack>
                        </CardContent>
                      </Grid>

                      {/* Placeholder ���� ������ ��� ���� */}
                      {displayLoading && (
                        <Grid
                          item
                          xs={12}
                          md={5}
                          sx={{
                            display: { xs: 'none', md: 'block' },
                            [dividerSideKey]: { md: '1px solid', xs: 0 },
                            borderColor: 'divider'
                          }}
                        >
                          <Skeleton variant="rectangular" width="100%" height={220} />
                        </Grid>
                      )}
                    </Grid>

                    {/* ������ ������� ���� ������� */}
                    <Box sx={{ px: { xs: 1.5, md: 2 }, pb: 2 }}>
                      {displayLoading ? (
                        <Skeleton variant="rectangular" height={170} sx={{ borderRadius: 2 }} />
                      ) : (
                        <Grow in timeout={800}>
                          <Box>
                            <ResponsiveHero
                              alt={t('aria.menu_preview')}
                              fallback={PLACEHOLDER_HERO}
                              height={170}
                              srcFallback={heroSrc}
                            />
                          </Box>
                        </Grow>
                      )}
                    </Box>
                  </Card>

                  {/* ������� �������� */}
                  <Box mt={4}>
                    {sections.map((section) => (
                      <Box key={section.id} mb={4}>
                        <Fade in timeout={1200}>
                          <Typography variant="h6" fontWeight={800} sx={{ mb: 2 }}>
                            {section.name}
                          </Typography>
                        </Fade>

                        {/* ������: ����� ���� */}
                        <Box sx={{ display: { xs: 'block', sm: 'none' } }}>
                          <Box sx={cardsHScrollSx} data-tour="dish-cards" data-vp="mobile">
                            {(dishesBySection[section.id] || []).map((dish, idx) => {
                              const { primary } = pickPrimarySecondary(dish);
                              const code = dish?.display_codes || dish?.allergy_info || '';
                              const explain = (dish?.allergen_explanation_de || '').trim();

                              return (
                                <Grow in timeout={400 + idx * 120} key={dish.id}>
                                  <Card
                                    sx={{
                                      width: { xs: 'clamp(200px, 72vw, 280px)', sm: CARD_W },
                                      minWidth: { xs: 'clamp(200px, 72vw, 280px)', sm: CARD_W },
                                      height: CARD_H,
                                      display: 'flex',
                                      flexDirection: 'column',
                                      borderRadius: 2,
                                      overflow: 'hidden',
                                      boxShadow: '0 2px 10px rgba(0,0,0,.04)',
                                      '&:hover': { boxShadow: '0 6px 18px rgba(0,0,0,.08)', transform: 'translateY(-2px)' },
                                      transition: 'box-shadow .25s ease, transform .25s ease',
                                      position: 'relative',
                                      bgcolor: 'background.paper'
                                    }}
                                  >
                                    {code && (
                                      <Tooltip title={explain || code} arrow>
                                        <Chip
                                          size="small"
                                          color="warning"
                                          variant="outlined"
                                          label={code}
                                          sx={{ position: 'absolute', top: 8, left: 8, zIndex: 1 }}
                                        />
                                      </Tooltip>
                                    )}

                                    <CardActionArea sx={{ height: '100%' }} onClick={() => openDish(dish)}>
                                      <SafeImg
                                        src={dishCardImage(dish)}
                                        fallback={PLACEHOLDER}
                                        alt={dish.name || t('labels.dish')}
                                        sx={{ width: '100%', height: IMG_H, objectFit: 'cover', display: 'block' }}
                                      />
                                      <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                                        <Typography
                                          variant="subtitle1"
                                          fontWeight={800}
                                          sx={{
                                            minHeight: NAME_MIN_H,
                                            display: '-webkit-box',
                                            WebkitLineClamp: 2,
                                            WebkitBoxOrient: 'vertical',
                                            overflow: 'hidden',
                                            wordBreak: 'break-word',
                                            mb: 0.5,
                                          }}
                                        >
                                          {dish.name}
                                        </Typography>

                                        <Box sx={{ minHeight: PRICE_ROW_H, display: 'flex', alignItems: 'center', gap: 1 }}>
                                          {primary ? (
                                            <Typography variant="body1" fontWeight={800} color="primary.main">
                                              {formatEuro(primary.price)}
                                            </Typography>
                                          ) : (
                                            <Typography variant="body2" color="text.secondary">
                                              {t('labels.no_price')}
                                            </Typography>
                                          )}
                                        </Box>
                                      </CardContent>
                                    </CardActionArea>
                                  </Card>
                                </Grow>
                              );
                            })}
                          </Box>
                        </Box>

                        {/* �������: Grid */}
                        <Grid
                          container
                          spacing={2}
                          alignItems="stretch"
                          sx={{ display: { xs: 'none', sm: 'flex' }, overflowX: 'clip' }}
                          data-tour="dish-cards"
                          data-vp="desktop"
                        >
                          {(dishesBySection[section.id] || []).map((dish, idx) => {
                            const { primary } = pickPrimarySecondary(dish);
                            const code = dish?.display_codes || dish?.allergy_info || '';
                            const explain = (dish?.allergen_explanation_de || '').trim();

                            return (
                              <Grid
                                item
                                key={dish.id}
                                xs="auto"
                                sx={{
                                  flex: { xs: '1 1 100%', sm: `0 0 ${CARD_W}px` },
                                  maxWidth: { xs: '100%', sm: `${CARD_W}px` },
                                }}
                              >
                                <Grow in timeout={500 + idx * 120}>
                                  <Card
                                    sx={{
                                      width: '100%',
                                      height: CARD_H,
                                      display: 'flex',
                                      flexDirection: 'column',
                                      borderRadius: 2,
                                      overflow: 'hidden',
                                      boxShadow: '0 2px 10px rgba(0,0,0,.04)',
                                      '&:hover': { boxShadow: '0 6px 18px rgba(0,0,0,.08)', transform: 'translateY(-2px)' },
                                      transition: 'box-shadow .25s ease, transform .25s ease',
                                      position: 'relative',
                                      bgcolor: 'background.paper'
                                    }}
                                  >
                                    {code && (
                                      <Tooltip title={explain || code} arrow>
                                        <Chip
                                          size="small"
                                          color="warning"
                                          variant="outlined"
                                          label={code}
                                          sx={{ position: 'absolute', top: 8, left: 8, zIndex: 1 }}
                                        />
                                      </Tooltip>
                                    )}

                                    <CardActionArea sx={{ height: '100%' }} onClick={() => openDish(dish)}>
                                      <SafeImg
                                        src={dishCardImage(dish)}
                                        fallback={PLACEHOLDER}
                                        alt={dish.name || t('labels.dish')}
                                        sx={{ width: '100%', height: IMG_H, objectFit: 'cover', display: 'block' }}
                                      />
                                      <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                                        <Typography
                                          variant="subtitle1"
                                          fontWeight={800}
                                          sx={{
                                            minHeight: NAME_MIN_H,
                                            display: '-webkit-box',
                                            WebkitLineClamp: 2,
                                            WebkitBoxOrient: 'vertical',
                                            overflow: 'hidden',
                                            wordBreak: 'break-word',
                                            mb: 0.5,
                                          }}
                                        >
                                          {dish.name}
                                        </Typography>

                                        <Box sx={{ minHeight: PRICE_ROW_H, display: 'flex', alignItems: 'center', gap: 1 }}>
                                          {primary ? (
                                            <Typography variant="body1" fontWeight={800} color="primary.main">
                                              {formatEuro(primary.price)}
                                            </Typography>
                                          ) : (
                                            <Typography variant="body2" color="text.secondary">
                                              {t('labels.no_price')}
                                            </Typography>
                                          )}
                                        </Box>
                                      </CardContent>
                                    </CardActionArea>
                                  </Card>
                                </Grow>
                              </Grid>
                            );
                          })}
                        </Grid>
                      </Box>
                    ))}
                  </Box>
                </Box>
              </Grid>
            </Grid>
          )}

          {/* Delete confirmation dialog */}
          <Dialog open={confirmDeleteOpen} onClose={handleCancelDelete} maxWidth="xs" fullWidth
                  PaperProps={{ sx: { borderRadius: 3 } }}>
            <DialogTitle sx={{ fontWeight: 800 }}>{t('actions.delete')}</DialogTitle>
            <DialogContent dividers>
              <Typography variant="body2" color="text.secondary">
                {t('confirm_delete_menu') || 'Are you sure you want to delete this menu?'}
              </Typography>
            </DialogContent>
            <DialogActions>
              <Button onClick={handleCancelDelete}>{t('actions.cancel')}</Button>
              <Button
                variant="contained"
                color="error"
                startIcon={<DeleteIcon />}
                onClick={handleConfirmDelete}
                sx={{ borderRadius: 999, boxShadow: 'none' }}
              >
                {t('actions.delete')}
              </Button>
            </DialogActions>
          </Dialog>

          {/* Import dialog */}
          <Dialog open={excelDialog} onClose={() => !excelBusy && setExcelDialog(false)} maxWidth="md" fullWidth
                  PaperProps={{ sx: { borderRadius: 3 } }}>
            <DialogTitle sx={{ fontWeight: 800 }}>{t('excel.preview_title')}</DialogTitle>
            <DialogContent dividers>
              <Stack spacing={2}>
                <TextField
                  fullWidth
                  label={t('labels.menu_name')}
                  value={importMenuName}
                  onChange={(e) => setImportMenuName(e.target.value)}
                  helperText={excelFileName ? `${t('excel.source_file')} ${excelFileName}` : ''}
                />
                {sheetsPreview.length === 0 ? (
                  <Alert severity="warning">{t('excel.no_sheets')}</Alert>
                ) : (
                  <>
                    <Typography variant="subtitle1" fontWeight="bold">{t('excel.sheets_analysis')}</Typography>
                    <List dense>
                      {sheetsPreview.map((s, i) => {
                        const ok = s.missing.length === 0 && s.count > 0;
                        return (
                          <ListItem
                            key={s.name}
                            secondaryAction={
                              <Checkbox
                                edge="end"
                                checked={!!s.enabled}
                                onChange={(e) =>
                                  setSheetsPreview((prev) =>
                                    prev.map((p, idx) => (idx === i ? { ...p, enabled: e.target.checked } : p))
                                  )
                                }
                              />
                            }
                          >
                            <ListItemIcon>
                              {ok ? <CheckCircleIcon color="success" /> : <WarningAmberIcon color="warning" />}
                            </ListItemIcon>
                            <ListItemText
                              primary={`${s.name} � ${s.count} ${t('excel.rows')}`}
                              secondary={
                                <Box component="span" sx={{ direction: 'ltr', display: 'inline' }}>
                                  <strong>{t('excel.detected_columns')}:</strong>{' '}
                                  {['name','description','price','allergy'].map((k) => (
                                    <Chip
                                      key={k}
                                      size="small"
                                      label={`${k}: ${s.map[k] || t('excel.not_found')}`}
                                      sx={{ mr: 0.5, mt: 0.5 }}
                                      color={s.map[k] ? 'default' : 'warning'}
                                      variant={s.map[k] ? 'outlined' : 'filled'}
                                    />
                                  ))}
                                </Box>
                              }
                            />
                          </ListItem>
                        );
                      })}
                    </List>
                  </>
                )}
                {excelError && <Alert severity="error">{excelError}</Alert>}
              </Stack>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setExcelDialog(false)} disabled={excelBusy}>{t('actions.cancel')}</Button>
              <Button
                variant="contained"
                startIcon={<UploadFileIcon />}
                onClick={doImportNow}
                disabled={
                  excelBusy ||
                  !importMenuName.trim() ||
                  sheetsPreview.filter((s) => s.enabled && s.missing.length === 0 && s.count > 0).length === 0
                }
                color="primary"
                sx={{ borderRadius: 999, boxShadow: 'none' }}
              >
                {excelBusy ? t('excel.importing') : t('excel.start_import')}
              </Button>
            </DialogActions>
          </Dialog>

          {/* Progress dialog for Excel import */}
          <Dialog open={excelRun} onClose={() => {}} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
            <DialogTitle sx={{ fontWeight: 800 }}>{t('excel.importing') || 'Importing�'}</DialogTitle>
            <DialogContent dividers>
              <Stack spacing={2}>
                <Typography variant="body2" color="text.secondary">
                  {t('excel.progress') || 'Progress'}: {excelProg.done} / {excelProg.total}
                </Typography>
                <Box sx={{ width: '100%' }}>
                  <Box sx={{ width: '100%', height: 8, bgcolor: 'divider', borderRadius: 999, overflow: 'hidden' }}>
                    <Box sx={{ width: `${Math.round((excelProg.done / Math.max(1, excelProg.total)) * 100)}%`, height: '100%', bgcolor: 'primary.main', transition: 'width .2s' }} />
                  </Box>
                </Box>
                <Stack direction="row" spacing={2}>
                  <Chip size="small" color="success" label={`${t('excel.ok') || 'OK'}: ${excelProg.ok}`} />
                  <Chip size="small" color="warning" label={`${t('excel.failed') || 'Failed'}: ${excelProg.fail}`} />
                </Stack>
              </Stack>
            </DialogContent>
          </Dialog>

          {/* ������ ����� */}
          <Dialog open={dishOpen} onClose={() => setDishOpen(false)} maxWidth="sm" fullWidth
                  PaperProps={{ sx: { borderRadius: 3 } }}>
            <DialogTitle sx={{ fontWeight: 800 }}>
              {dishSel?.name || ''}
            </DialogTitle>
            <DialogContent dividers>
              {dishSel && (
                <Stack spacing={2}>
                  <SafeImg
                    src={dishCardImage(dishSel)}
                    fallback={PLACEHOLDER}
                    alt={dishSel.name || t('labels.dish')}
                    sx={{ width: '100%', height: 260, objectFit: 'cover', borderRadius: 8, display: 'block' }}
                  />
                  <Box>
                    <Typography variant="subtitle2" sx={{ mb: 0.5, fontWeight: 800 }}>
                      {t('labels.prices')}
                    </Typography>
                    <Stack direction="row" spacing={1} flexWrap="wrap">
                      {pickPrimarySecondary(dishSel).all.map((p, idx) => (
                        <Chip key={idx} color={p.is_default ? 'primary' : 'default'} label={`${p.label ? p.label + ' � ' : ''}${formatEuro(p.price)}`} />
                      ))}
                      {pickPrimarySecondary(dishSel).all.length === 0 && (
                        <Chip variant="outlined" label={t('labels.no_price')} />
                      )}
                    </Stack>
                  </Box>

                  {!!dishSel.description && (
                    <Box>
                      <Typography variant="subtitle2" sx={{ mb: 0.5, fontWeight: 800 }}>
                        {t('labels.description')}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {dishSel.description}
                      </Typography>
                    </Box>
                  )}

                  <Divider />
                  <Stack spacing={1}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                      {t('labels.allergy_info')}
                    </Typography>

                    {(dishSel.display_codes || dishSel.allergy_info) ? (
                      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                        <Tooltip title={(dishSel.allergen_explanation_de || dishSel.display_codes || dishSel.allergy_info)} arrow>
                          <Chip size="small" color="warning" variant="outlined" label={dishSel.display_codes || dishSel.allergy_info} />
                        </Tooltip>
                        {!!dishSel.allergen_explanation_de && (
                          <Typography variant="body2" color="text.secondary">
                            {dishSel.allergen_explanation_de}
                          </Typography>
                        )}
                      </Stack>
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        {t('labels.none')}
                      </Typography>
                    )}

                    <Box sx={{ mt: 1 }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 0.5 }}>
                        {t('labels.allergen_evidence')}
                      </Typography>
                      {Array.isArray(dishSel.allergen_rows) && dishSel.allergen_rows.length > 0 ? (
                        <List dense sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, maxHeight: 240, overflow: 'auto' }}>
                          {dishSel.allergen_rows.map((row) => (
                            <ListItem key={row.id} sx={{ alignItems: 'flex-start' }}>
                              <ListItemIcon>
                                <Chip size="small" label={row.allergen_code} color="warning" variant="outlined" />
                              </ListItemIcon>
                            <ListItemText
                              primaryTypographyProps={{ component: 'div' }}
                              secondaryTypographyProps={{ component: 'div' }}
                              primary={
                                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                                  <Chip size="small" variant="outlined" label={row.source || 'regex'} />
                                  {typeof row.confidence === 'number' && (
                                    <Chip size="small" variant="outlined" label={`${t('labels.conf')} ${(row.confidence*100).toFixed(0)}%`} />
                                  )}
                                  {row.is_confirmed && <Chip size="small" color="success" label={t('labels.confirmed')} />}
                                </Stack>
                              }
                              secondary={(row.rationale && row.rationale.trim()) ? row.rationale : t('labels.no_reason_given')}
                            />
                            </ListItem>
                          ))}
                        </List>
                      ) : (
                        <Alert severity="info" sx={{ mb: 0 }}>
                          {t('empty.no_evidence_rows')}
                        </Alert>
                      )}
                    </Box>
                  </Stack>
                </Stack>
              )}
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setDishOpen(false)} variant="contained" color="primary" sx={{ borderRadius: 999, boxShadow: 'none' }}>
                {t('actions.close')}
              </Button>
            </DialogActions>
          </Dialog>

          {/* Dialog ����� ������� */}
          <Dialog open={genOpen} onClose={() => !genBusy && setGenOpen(false)} maxWidth="md" fullWidth
                  PaperProps={{ sx: { borderRadius: 3 } }}>
            <DialogTitle sx={{ fontWeight: 800 }}>
              {t('actions.generate_allergens')}
            </DialogTitle>
            <DialogContent dividers>
              <Stack spacing={2}>
                <Alert severity="info" icon={<InfoOutlinedIcon />}>
                  {t('notes.allergen_generate_note')}
                </Alert>

                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                  <Tooltip title={t('tooltips.force_regenerate')}>
                    <Box data-tour="allergen-toggle-force">
                      <FormControlLabel control={<Switch checked={genForce} onChange={(e) => setGenForce(e.target.checked)} />} label={t('force_regenerate')} />
                    </Box>
                  </Tooltip>
                  <Tooltip title={t('tooltips.use_llm')}>
                    <Box data-tour="allergen-toggle-use-llm">
                      <FormControlLabel
                        control={
                          <Switch
                            checked={genUseLLM}
                            onChange={(e) => setGenUseLLM(e.target.checked)}
                          />
                        }
                        label="use_llm"
                      />
                    </Box>
                  </Tooltip>
                  <Tooltip title={t('tooltips.llm_dry_run')}>
                    <Box data-tour="allergen-toggle-llm-dry-run">
                      <FormControlLabel control={<Switch checked={genLLMDryRun} onChange={(e) => setGenLLMDryRun(e.target.checked)} />} label="llm_dry_run" />
                    </Box>
                  </Tooltip>
                  <Tooltip title={t('tooltips.llm_guess_codes')}>
                    <Box data-tour="allergen-toggle-llm-guess-codes">
                      <FormControlLabel control={<Switch checked={llmGuessCodes} onChange={(e) => setLlmGuessCodes(e.target.checked)} />} label="llm_guess_codes" />
                    </Box>
                  </Tooltip>
                  <Tooltip title={t('tooltips.llm_debug')}>
                    <Box data-tour="allergen-toggle-llm-debug">
                      <FormControlLabel control={<Switch checked={llmDebug} onChange={(e) => setLlmDebug(e.target.checked)} />} label="llm_debug" />
                    </Box>
                  </Tooltip>
                </Stack>

                <Grid container spacing={2}>
                  <Grid item xs={12} sm={4}>
                    <Tooltip title={t('tooltips.lang')}>
                      <TextField fullWidth label="lang" value={genLang} onChange={(e) => setGenLang(e.target.value)} helperText={t('helpers.lang')} />
                    </Tooltip>
                  </Grid>
                  <Grid item xs={12} sm={8}>
                    <Tooltip title={t('tooltips.dish_ids')}>
                      <TextField fullWidth label={t('dish_ids_optional')} value={genDishIdsText} onChange={(e) => setGenDishIdsText(e.target.value)} helperText={t('helpers.dish_ids')} />
                    </Tooltip>
                  </Grid>

                  {/* ?? ���� LLM �� ���� ������ */}
                  <Grid item xs={12} sm={6}>
                    <Tooltip title={t('tooltips.llm_model')}>
                      <TextField
                        fullWidth
                        label="llm_model"
                        value={genModel}
                        onChange={(e) => setGenModel(e.target.value)}
                        inputProps={{ 'data-tour': 'allergen-llm-model' }}
                      />
                    </Tooltip>
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <Tooltip title={t('tooltips.llm_max_terms')}>
                      <TextField
                        fullWidth
                        type="number"
                        label="llm_max_terms"
                        value={genMaxTerms}
                        onChange={(e) => setGenMaxTerms(e.target.value)}
                        inputProps={{ min: 1, max: 20, 'data-tour': 'allergen-llm-max-terms' }}
                      />
                    </Tooltip>
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <Tooltip title={t('tooltips.llm_temperature')}>
                      <Box data-tour="allergen-llm-temperature">
                        <TextField
                          fullWidth
                          type="number"
                          label="llm_temperature"
                          value={genTemperature}
                          onChange={(e) => setGenTemperature(e.target.value)}
                          inputProps={{ step: 0.1, min: 0, max: 1 }}
                        />
                      </Box>
                    </Tooltip>
                  </Grid>
                </Grid>

                <Stack direction="row" spacing={1}>
                  <Tooltip title={t('tooltips.preview')}>
                    <span>
                      <Button
                        variant="outlined"
                        startIcon={<RefreshIcon />}
                        onClick={previewGenerate}
                        disabled={genBusy}
                        data-tour="allergen-preview"
                        sx={{ borderRadius: 999 }}
                      >
                        {genBusy ? t('loading') : t('actions.preview')}
                      </Button>
                    </span>
                  </Tooltip>
                  <Tooltip title={t('tooltips.run')}>
                    <span>
                      <Button
                        variant="contained"
                        color="primary"
                        startIcon={<ScienceIcon />}
                        onClick={runGenerate}
                        disabled={genBusy}
                        data-tour="allergen-run"
                        sx={{ borderRadius: 999, boxShadow: 'none' }}
                      >
                        {genBusy ? t('loading') : t('actions.run')}
                      </Button>
                    </span>
                  </Tooltip>
                </Stack>

                {genCounts && (
                  <>
                    <Alert severity="success">
                      {(genDryRun ? t('results.preview_result') : t('results.run_result'))}
                      : {` ${t('results.processed')}: ${genCounts.processed} | ${t('results.skipped')}: ${genCounts.skipped} | ${t('results.changed')}: ${genCounts.changed}`}
                      {typeof genCounts.missingAfterRules === 'number' && (<> | {t('results.missing_after_rules')}: {genCounts.missingAfterRules}</>)}
                    </Alert>
                    {genCounts.processed > 0 && genCounts.changed === 0 && (
                      <Alert severity="warning" sx={{ mt: 1 }}>
                        {t('warnings.no_matches_rules', { lang: genLang })}
                      </Alert>
                    )}
                  </>
                )}

                {!!genPreview.length && (
                  <>
                    <Typography variant="subtitle2" fontWeight={800}>
                      {t('results.changes_preview')}
                    </Typography>
                    <Box sx={{ maxHeight: 260, overflow: 'auto', border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 1 }}>
                      <List dense>
                        {genPreview.slice(0, 300).map((row, idx) => (
                          <ListItem key={`${row.id}-${idx}`}>
                            <ListItemIcon>
                              {(row.action === 'no_change' || row.action === 'skip_manual') ? <WarningAmberIcon color="warning" /> : <CheckCircleIcon color="success" />}
                            </ListItemIcon>
                            <ListItemText
                              primary={`${row.name} � ${t(`row_action.${row.action}`)}${row.reason ? ` (${row.reason})` : ''}`}
                              secondary={row.new ? `${row.current || '�'}  ?  ${row.new}` : (row.current || '�')}
                            />
                          </ListItem>
                        ))}
                      </List>
                    </Box>
                    {genPreview.length > 300 && (
                      <Typography variant="caption" color="text.secondary">
                        {t('results.preview_truncated')}
                      </Typography>
                    )}
                  </>
                )}

                {genLLM && (
                  <>
                    <Divider />
                    <Stack direction="row" alignItems="center" spacing={1} sx={{ flexWrap: 'wrap' }}>
                      <Typography variant="subtitle2" fontWeight={800}>LLM</Typography>
                      <Chip size="small" label={`items: ${genLLM.count ?? 0}`} />
                      <TextField
                        size="small"
                        value={candFilter}
                        onChange={(e) => setCandFilter(e.target.value)}
                        placeholder={t('placeholders.filter_term')}
                        sx={{ ml: 1, minWidth: 220 }}
                        InputProps={{ startAdornment: (<InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>) }}
                      />
                      <Box sx={{ flexGrow: 1 }} />
                      <Chip size="small" color="primary" variant="outlined" label={`${selectedCount} ${t('labels.selected')}`} />
                      <Button size="small" onClick={() => toggleSelectAllVisible(true)}>{t('actions.select_visible')}</Button>
                      <Button size="small" onClick={() => toggleSelectAllVisible(false)}>{t('actions.unselect_visible')}</Button>
                      {!!genLLM.note && (<Tooltip title={genLLM.note}><InfoOutlinedIcon fontSize="small" /></Tooltip>)}
                    </Stack>

                    {Array.isArray(filteredLLMItems) && filteredLLMItems.length > 0 ? (
                      <Box sx={{ border: '1px dashed', borderColor: 'divider', borderRadius: 1, p: 1 }}>
                        <List dense sx={{ maxHeight: 320, overflow: 'auto' }}>
                          {filteredLLMItems.slice(0, 200).map((it, idx) => (
                            <Box key={`${it.dish_id}-${idx}`} sx={{ mb: 1.5 }}>
                              <Typography variant="body2" sx={{ fontWeight: 800, mb: .5 }}>
                                {t('labels.dish_short')} #{it.dish_id} � {it.status || t('labels.pending')}{it.reused ? ` (${t('labels.reused')})` : ''}
                              </Typography>
                              {Array.isArray(it.candidates) && it.candidates.length ? (
                                it.candidates.map((c) => {
                                  const key = `${it.dish_id}::${c.term}`;
                                  const sel = llmSelect[key] || { checked: false, term: c.term, codesArr: (c.guess_codes || '').split(/[,\s]+/).filter(Boolean), confidence: c.confidence || 0 };
                                  return (
                                    <ListItem key={key} sx={{ py: .75, alignItems: 'flex-start' }}>
                                      <ListItemIcon sx={{ mt: .25 }}>
                                        {c.mapped_ingredient_id ? <CheckCircleIcon color="success" /> : (
                                          <Checkbox
                                            edge="start"
                                            checked={!!sel.checked}
                                            onChange={(e) =>
                                              setLlmSelect((p) => ({ ...p, [key]: { ...(p[key]||{}), checked: e.target.checked, term: sel.term, codesArr: sel.codesArr, dishId: it.dish_id, confidence: sel.confidence } }))
                                            }
                                            tabIndex={-1}
                                            disableRipple
                                          />
                                        )}
                                      </ListItemIcon>
                                      <ListItemText
                                        sx={{ mr: 1 }}
                                        primary={`${c.term}${c.mapped_ingredient_id ? ` [#${c.mapped_ingredient_id}]` : ''}${(c.confidence!=null) ? ` � ${t('labels.conf')}=${(c.confidence*100).toFixed(0)}%` : ''}`}
                                        secondary={(c.reason ? `� ${c.reason}` : '') + (c.guess_codes ? ` � ${t('labels.suggested')}: ${c.guess_codes}` : '')}
                                      />
                                      {!c.mapped_ingredient_id && (
                                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ minWidth: { sm: 460 } }}>
                                          <TextField
                                            size="small"
                                            label={t('labels.term')}
                                            value={sel.term}
                                            onChange={(e) =>
                                              setLlmSelect((p) => ({ ...p, [key]: { ...(p[key]||{}), term: e.target.value, dishId: it.dish_id, codesArr: sel.codesArr, confidence: sel.confidence } }))
                                            }
                                            sx={{ width: { xs: '100%', sm: 260 } }}
                                          />
                                          <CodesEditor
                                            value={sel.codesArr}
                                            onChange={(arr) =>
                                              setLlmSelect((p) => ({ ...p, [key]: { ...(p[key]||{}), codesArr: arr, term: sel.term, dishId: it.dish_id, confidence: sel.confidence } }))
                                            }
                                            label={t('labels.codes')}
                                            helper={t('helpers.codes_helper')}
                                          />
                                        </Stack>
                                      )}
                                    </ListItem>
                                  );
                                })
                              ) : (
                                <Typography variant="caption" color="text.secondary">
                                  {t('empty.no_candidates')}
                                </Typography>
                              )}
                            </Box>
                          ))}
                        </List>

                        <Divider sx={{ my: 1 }} />
                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }}>
                          {isAdmin ? (
                            <FormControlLabel control={<Switch checked={saveAsGlobal} onChange={(e) => setSaveAsGlobal(e.target.checked)} />} label={t('labels.save_as_global')} />
                          ) : (
                            <Typography variant="caption" color="text.secondary">
                              {t('helpers.save_to_private_lexicon')}
                            </Typography>
                          )}
                          <Button variant="contained" color="primary" disabled={upsertBusy || selectedCount === 0} onClick={handleUpsertSelected}
                                  sx={{ borderRadius: 999, boxShadow: 'none' }}>
                            {upsertBusy ? t('loading') : t('actions.add_selected_to_lexicon')}
                          </Button>
                        </Stack>

                        {genLLM?.items?.length > 200 && (
                          <Typography variant="caption" color="text.secondary">
                            {t('results.preview_truncated')}
                          </Typography>
                        )}
                      </Box>
                    ) : (
                      <Alert severity="info">
                        {genLLM?.note || t('empty.no_llm_work_needed')}
                      </Alert>
                    )}
                  </>
                )}
              </Stack>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setGenOpen(false)} disabled={genBusy}>
                {t('actions.close')}
              </Button>
            </DialogActions>
          </Dialog>

          <Snackbar
            open={snack.open}
            autoHideDuration={2000}
            onClose={() => setSnack((s) => ({ ...s, open: false }))}
            message={snack.msg}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
          />
        </Container>
      </Box>
    </Box>
  );
}

export default React.memo(MenusPageView);

