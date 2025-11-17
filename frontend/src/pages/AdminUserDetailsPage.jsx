// src/pages/AdminUserDetailsPage.jsx
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from '../services/axios';
import {
  Box,
  Typography,
  Container,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Grid,
  Card,
  CardContent,
  CardMedia,
  Fade,
  Stack,
  Chip,
} from '@mui/material';
import FolderIcon from '@mui/icons-material/Folder';
import { useTranslation } from 'react-i18next';

const bySort = (a, b) =>
  (a?.sort_order ?? 0) - (b?.sort_order ?? 0) || (a?.id || 0) - (b?.id || 0);

const formatEuro = (v) => {
  const n = Number(String(v ?? '').replace(',', '.'));
  if (!Number.isFinite(n)) return v ?? '';
  try { return n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  catch { return n.toFixed(2); }
};

const AdminUserDetailsPage = () => {
  const { t } = useTranslation();
  const { userId } = useParams();

  const [menus, setMenus] = useState([]);
  const [sections, setSections] = useState([]);
  const [dishesBySection, setDishesBySection] = useState({});
  const [selectedMenuId, setSelectedMenuId] = useState('');
  const [error, setError] = useState('');
  const [showContent, setShowContent] = useState(false);

  useEffect(() => {
    fetchUserMenus();
    const to = setTimeout(() => setShowContent(true), 100);
    return () => clearTimeout(to);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  useEffect(() => {
    if (selectedMenuId) {
      fetchSectionsAndDishes(selectedMenuId);
    } else {
      setSections([]);
      setDishesBySection({});
    }
  }, [selectedMenuId]);

  const fetchUserMenus = async () => {
    try {
      const res = await axios.get(`/menus/?user=${userId}`);
      setMenus(res.data);
      setError('');
    } catch (err) {
      setError(t('load_menus_failed'));
    }
  };

  const fetchSectionsAndDishes = async (menuId) => {
    try {
      const { data } = await axios.get('/menu/', { params: { branch: menuId } });
      const secs = Array.isArray(data?.sections) ? data.sections : [];
      setSections(secs);
      const dishesObj = {};
      for (let section of secs) {
        dishesObj[section.id] = Array.isArray(section.dishes) ? section.dishes : [];
      }
      setDishesBySection(dishesObj);
    } catch (err) {
      setError(t('load_sections_failed'));
    }
  };

  return (
    <Fade in={showContent} timeout={600}>
      <Container sx={{ mt: 4, direction: 'rtl' }}>
        <Typography variant="h6" fontWeight="bold" gutterBottom>
          {t('user_details')} <strong>ID: {userId}</strong>
        </Typography>

        <FormControl fullWidth margin="normal">
          <InputLabel>{t('select_menu')}</InputLabel>
          <Select
            value={selectedMenuId}
            onChange={(e) => setSelectedMenuId(e.target.value)}
            startAdornment={<FolderIcon sx={{ mr: 1 }} />}
            label={t('select_menu')}
          >
            {menus.map((menu) => (
              <MenuItem key={menu.id} value={menu.id}>
                {menu.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {sections.map((section) => (
          <Box key={section.id} mt={4}>
            <Typography variant="h6" fontWeight="bold" color="primary" mb={2}>
              {section.name}
            </Typography>

            <Grid container spacing={2}>
              {(dishesBySection[section.id] || []).map((dish) => {
                const prices = (dish.prices || []).slice().sort(bySort);
                const hasMulti = prices.length > 0;
                return (
                  <Grid item xs={12} sm={6} md={4} key={dish.id}>
                    <Card sx={{ transition: '0.3s', '&:hover': { transform: 'scale(1.03)', boxShadow: 6 } }}>
                      {dish.image && (
                        <CardMedia
                          component="img"
                          height="160"
                          image={dish.image}
                          alt={dish.name}
                          loading="lazy"
                          decoding="async"
                          sx={{ objectFit: 'cover' }}
                        />
                      )}
                      <CardContent>
                        <Typography variant="h6" fontWeight="bold">
                          {dish.name}
                        </Typography>

                        <Box mt={0.5}>
                          {hasMulti ? (
                            <Stack direction="row" spacing={1} flexWrap="wrap">
                              {prices.map((p) => (
                                <Chip
                                  key={p.id || `tmp-${p.sort_order}`}
                                  label={`${p.label ? p.label + ': ' : ''}${formatEuro(p.price)}`}
                                  color={p.is_default ? 'primary' : 'default'}
                                  variant={p.is_default ? 'filled' : 'outlined'}
                                  size="small"
                                />
                              ))}
                            </Stack>
                          ) : (
                            dish.price != null && dish.price !== '' && (
                              <Typography variant="body2" color="text.secondary">
                                {formatEuro(dish.price)}
                              </Typography>
                            )
                          )}
                        </Box>

                        <Typography variant="body2">
                          {dish.description || t('no_description')}
                        </Typography>
                        {dish.allergy_info && (
                          <Typography variant="body2" color="error">
                            {t('allergy_info')}: {dish.allergy_info}
                          </Typography>
                        )}
                      </CardContent>
                    </Card>
                  </Grid>
                );
              })}
            </Grid>
          </Box>
        ))}

        {error && (
          <Typography color="error" mt={3}>
            {error}
          </Typography>
        )}
      </Container>
    </Fade>
  );
};

export default AdminUserDetailsPage;
