// src/pages/SectionPage.jsx
import React, { useEffect, useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from '../services/axios';
import {
  Container,
  Typography,
  TextField,
  Button,
  Stack,
  Card,
  CardContent,
  Box,
  Alert,
  CircularProgress,
  IconButton,
  Divider,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import FastfoodIcon from '@mui/icons-material/Fastfood';
import RestaurantMenuIcon from '@mui/icons-material/RestaurantMenu';
import RefreshIcon from '@mui/icons-material/Refresh';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import { useTranslation } from 'react-i18next';

// @dnd-kit imports
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
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// Sortable Section Component
function SortableSection({ section, t, isRTL }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: section.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      variant="outlined"
      sx={{
        borderColor: 'divider',
        bgcolor: 'background.paper',
        borderRadius: 3,
        cursor: isDragging ? 'grabbing' : 'default',
      }}
    >
      <CardContent
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
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
            color: 'text.secondary',
            '&:hover': { color: 'primary.main' },
            '&:active': { cursor: 'grabbing' },
          }}
        >
          <DragIndicatorIcon />
        </Box>

        <FastfoodIcon sx={{ color: 'primary.main' }} />
        <Typography variant="h6" sx={{ fontWeight: 700, flex: 1 }}>
          {section.name}
        </Typography>

        <Divider
          flexItem
          orientation="vertical"
          sx={{ mx: 1, display: { xs: 'none', sm: 'block' } }}
        />

        <Button
          variant="outlined"
          size="small"
          component={Link}
          to={`/sections/${section.id}/dishes`}
          sx={{ borderRadius: 999 }}
          data-tour="section-view-dishes"
        >
          {t('view_dishes') || 'View dishes'}
        </Button>
      </CardContent>
    </Card>
  );
}

const SectionPage = () => {
  const { t, i18n } = useTranslation();
  const isRTL = useMemo(() => i18n.language === 'ar', [i18n.language]);
  const { menuId } = useParams();

  const [sections, setSections] = useState([]);
  const [newSection, setNewSection] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(false);

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    fetchSections();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menuId]);

  const fetchSections = async () => {
    setBusy(true);
    try {
      const res = await axios.get(`/sections/?menu=${menuId}`);
      setSections(res.data || []);
      setError('');
    } catch (err) {
      console.error('Load sections error:', err.response?.data || err.message);
      setError(t('load_sections_failed') || 'تعذر تحميل الأقسام.');
    } finally {
      setBusy(false);
    }
  };

  const handleAddSection = async () => {
    if (!newSection.trim()) return;
    setCreating(true);
    try {
      await axios.post('/sections/', { name: newSection.trim(), menu: menuId });
      setNewSection('');
      await fetchSections();
    } catch (err) {
      console.error('Create section error:', err.response?.data || err.message);
      setError(t('create_section_failed') || 'تعذر إنشاء القسم.');
    } finally {
      setCreating(false);
    }
  };

  const handleDragEnd = async (event) => {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = sections.findIndex((s) => s.id === active.id);
    const newIndex = sections.findIndex((s) => s.id === over.id);

    if (oldIndex === -1 || newIndex === -1) return;

    // Update local state immediately for smooth UX
    const newSections = arrayMove(sections, oldIndex, newIndex);
    setSections(newSections);

    // Save to backend
    try {
      // Option 1: Send new order as array of IDs
      const order = newSections.map((s) => s.id);
      await axios.post('/sections/reorder/', { menu: menuId, order });
    } catch (err) {
      console.error('Reorder error:', err.response?.data || err.message);
      // Revert on error
      setSections(sections);
      setError(t('reorder_failed') || 'فشل حفظ الترتيب الجديد.');
    }
  };

  return (
    <Container
      maxWidth="md"
      sx={{
        mt: 4,
        mb: 4,
        direction: isRTL ? 'rtl' : 'ltr',
      }}
    >
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          mb: 2,
        }}
      >
        <RestaurantMenuIcon sx={{ color: 'primary.main' }} />
        <Typography variant="h5" fontWeight={800}>
          {t('sections') || 'Sections'}
        </Typography>

        <Box sx={{ flexGrow: 1 }} />

        <IconButton
          onClick={fetchSections}
          title={t('refresh') || 'Refresh'}
          size="small"
          sx={{
            border: '1px solid',
            borderColor: 'divider',
            bgcolor: 'background.paper',
            '&:hover': { bgcolor: 'action.hover' },
          }}
        >
          {busy ? <CircularProgress size={18} /> : <RefreshIcon fontSize="small" />}
        </IconButton>
      </Box>

      {/* Create form */}
      <Card
        variant="outlined"
        sx={{
          mb: 3,
          borderColor: 'divider',
          bgcolor: 'background.paper',
          borderRadius: 3,
        }}
      >
        <CardContent>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
            <TextField
              fullWidth
              label={t('new_section_name') || 'New section name'}
              value={newSection}
              onChange={(e) => setNewSection(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddSection();
              }}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
              data-tour="section-name-input"
            />
            <Button
              variant="contained"
              color="primary"
              startIcon={<AddIcon />}
              onClick={handleAddSection}
              disabled={creating}
              sx={{ borderRadius: 999, boxShadow: 'none', px: 2.5 }}
              data-tour="section-add"
            >
              {creating ? (t('loading') || 'Loading…') : (t('add') || 'Add')}
            </Button>
          </Stack>
        </CardContent>
      </Card>

      {!!error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Content */}
      {busy ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      ) : sections.length === 0 ? (
        <Card
          variant="outlined"
          sx={{ borderColor: 'divider', bgcolor: 'background.paper', borderRadius: 3 }}
        >
          <CardContent sx={{ textAlign: 'center' }}>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 1 }}>
              {t('empty.no_sections') || 'لا توجد أقسام بعد.'}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {t('hint.add_first_section') || 'أضف أول قسم لبدء إضافة الأطباق.'}
            </Typography>
          </CardContent>
        </Card>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={sections.map((s) => s.id)}
            strategy={verticalListSortingStrategy}
          >
            <Stack spacing={2}>
              {sections.map((section) => (
                <SortableSection
                  key={section.id}
                  section={section}
                  t={t}
                  isRTL={isRTL}
                />
              ))}
            </Stack>
          </SortableContext>
        </DndContext>
      )}
    </Container>
  );
};

export default SectionPage;
