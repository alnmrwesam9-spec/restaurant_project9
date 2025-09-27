import React, { useEffect, useState } from 'react';
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
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import FastfoodIcon from '@mui/icons-material/Fastfood';
import RestaurantMenuIcon from '@mui/icons-material/RestaurantMenu';
import { useTranslation } from 'react-i18next';

const SectionPage = () => {
  const { t } = useTranslation();
  const { menuId } = useParams();
  const [sections, setSections] = useState([]);
  const [newSection, setNewSection] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    fetchSections();
  }, []);

  const fetchSections = async () => {
    try {
      const res = await axios.get(`/sections/?menu=${menuId}`);
      setSections(res.data);
      setError('');
    } catch (err) {
      console.error('خطأ كامل:', err.response?.data || err.message);
      setError(t('load_sections_failed'));
    }
  };

  const handleAddSection = async () => {
    try {
      await axios.post('/sections/', { name: newSection, menu: menuId });
      setNewSection('');
      fetchSections();
    } catch (err) {
      console.error('خطأ في إنشاء القسم:', err.response?.data || err.message);
      setError(t('create_section_failed'));
    }
  };

  return (
    <Container maxWidth="md" sx={{ mt: 6, direction: 'rtl' }}>
      <Box display="flex" alignItems="center" gap={1} mb={4}>
        <RestaurantMenuIcon color="primary" />
        <Typography variant="h5" fontWeight="bold">
          {t('sections')}
        </Typography>
      </Box>

      <Stack direction="row" spacing={2} mb={4}>
        <TextField
          fullWidth
          label={t('new_section_name')}
          value={newSection}
          onChange={(e) => setNewSection(e.target.value)}
        />
        <Button
          variant="contained"
          color="primary"
          startIcon={<AddIcon />}
          onClick={handleAddSection}
        >
          {t('add')}
        </Button>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Stack spacing={2}>
        {sections.map((section) => (
          <Card key={section.id} variant="outlined">
            <CardContent
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <FastfoodIcon /> {section.name}
              </Typography>
              <Button
                variant="outlined"
                size="small"
                component={Link}
                to={`/sections/${section.id}/dishes`}
              >
                {t('view_dishes')}
              </Button>
            </CardContent>
          </Card>
        ))}
      </Stack>
    </Container>
  );
};

export default SectionPage;
