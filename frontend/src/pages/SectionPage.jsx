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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import FastfoodIcon from '@mui/icons-material/Fastfood';
import RestaurantMenuIcon from '@mui/icons-material/RestaurantMenu';
import RefreshIcon from '@mui/icons-material/Refresh';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
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
function SortableSection({ section, t, isRTL, onEdit }) {
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
        <Box sx={{ flex: 1 }}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            {section.name}
          </Typography>
          {section.description && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {section.description}
            </Typography>
          )}
        </Box>

        <Divider
          flexItem
          orientation="vertical"
          sx={{ mx: 1, display: { xs: 'none', sm: 'block' } }}
        />

        <IconButton
          size="small"
          onClick={() => onEdit(section)}
          sx={{ color: 'primary.main' }}
          title={t('edit') || 'Edit'}
        >
          <EditIcon fontSize="small" />
        </IconButton>

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

  // Edit dialog state
  const [editDialog, setEditDialog] = useState(false);
  const [editingSection, setEditingSection] = useState(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [saving, setSaving] = useState(false);

  // Delete confirmation dialog
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);

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

  const handleEdit = (section) => {
    setEditingSection(section);
    setEditName(section.name || '');
    setEditDescription(section.description || '');
    setEditDialog(true);
  };

  const handleSaveEdit = async () => {
    if (!editName.trim()) {
      setError(t('section_name_required') || 'اسم القسم مطلوب.');
      return;
    }

    setSaving(true);
    try {
      await axios.patch(`/sections/${editingSection.id}/`, {
        name: editName.trim(),
        description: editDescription.trim(),
      });
      setEditDialog(false);
      setEditingSection(null);
      await fetchSections();
      setError('');
    } catch (err) {
      console.error('Update section error:', err.response?.data || err.message);
      setError(t('update_section_failed') || 'فشل تحديث القسم.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteClick = () => {
    setDeleteDialog(true);
  };

  const handleDeleteConfirm = async () => {
    if (!editingSection) return;

    setDeleting(true);
    try {
      await axios.delete(`/sections/${editingSection.id}/`);
      setDeleteDialog(false);
      setEditDialog(false);
      setEditingSection(null);
      await fetchSections();
      setError('');
    } catch (err) {
      console.error('Delete section error:', err.response?.data || err.message);
      setError(t('delete_section_failed') || 'فشل حذف القسم.');
    } finally {
      setDeleting(false);
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
                  onEdit={handleEdit}
                />
              ))}
            </Stack>
          </SortableContext>
        </DndContext>
      )}

      {/* Edit Dialog */}
      <Dialog
        open={editDialog}
        onClose={() => !saving && setEditDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {t('edit_section') || 'تعديل القسم'}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              fullWidth
              label={t('section_name') || 'اسم القسم'}
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              required
            />
            <TextField
              fullWidth
              label={t('section_description') || 'وصف القسم'}
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              multiline
              rows={2}
              placeholder={t('section_description_placeholder') || 'وصف اختياري يظهر تحت اسم القسم'}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, justifyContent: 'space-between' }}>
          <Button
            onClick={handleDeleteClick}
            color="error"
            startIcon={<DeleteIcon />}
            disabled={saving || deleting}
          >
            {t('delete') || 'حذف'}
          </Button>
          <Box>
            <Button onClick={() => setEditDialog(false)} disabled={saving}>
              {t('cancel') || 'إلغاء'}
            </Button>
            <Button
              onClick={handleSaveEdit}
              variant="contained"
              disabled={saving}
              sx={{ ml: 1 }}
            >
              {saving ? (t('saving') || 'جاري الحفظ...') : (t('save') || 'حفظ')}
            </Button>
          </Box>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialog}
        onClose={() => !deleting && setDeleteDialog(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>
          {t('confirm_delete') || 'تأكيد الحذف'}
        </DialogTitle>
        <DialogContent>
          <Typography>
            {t('delete_section_confirm') || 'هل أنت متأكد من حذف هذا القسم؟ لن يتم حذف الأطباق لكن لن يظهر هذا القسم في المنيو.'}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDeleteDialog(false)} disabled={deleting}>
            {t('cancel') || 'إلغاء'}
          </Button>
          <Button
            onClick={handleDeleteConfirm}
            variant="contained"
            color="error"
            disabled={deleting}
          >
            {deleting ? (t('deleting') || 'جاري الحذف...') : (t('delete') || 'حذف')}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default SectionPage;
