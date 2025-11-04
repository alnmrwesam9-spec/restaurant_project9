import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from '../services/axios';
import {
  Container,
  Typography,
  Grid,
  Card,
  CardContent,
  CardActionArea,
  Box,
  Alert,
} from '@mui/material';
import FolderIcon from '@mui/icons-material/Folder';
import { useTranslation } from 'react-i18next';

const AdminUserMenusPage = () => {
  const { t } = useTranslation();
  const { userId } = useParams();
  const [menus, setMenus] = useState([]);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    fetchMenus();
  }, []);

  const fetchMenus = async () => {
    try {
      const res = await axios.get(`/menus/?user=${userId}`);
      setMenus(res.data);
    } catch (err) {
      console.error(t('fetch_menus_error'), err);
      setError(t('load_menus_failed'));
    }
  };

  const handleMenuClick = (menuId) => {
    navigate(`/admin/menus/${menuId}/edit`);
  };

  return (
    <Container maxWidth="md" sx={{ mt: 4, direction: 'rtl' }}>
      <Typography variant="h5" fontWeight="bold" gutterBottom>
        📋 {t('user_menus')} {userId}
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Grid container spacing={2}>
        {menus.map((menu) => (
          <Grid item xs={12} sm={6} md={4} key={menu.id}>
            <Card
              variant="outlined"
              sx={{
                transition: '0.3s',
                '&:hover': { boxShadow: 4, transform: 'scale(1.03)' },
              }}
            >
              <CardActionArea onClick={() => handleMenuClick(menu.id)}>
                <CardContent>
                  <Box display="flex" alignItems="center" gap={1}>
                    <FolderIcon color="primary" />
                    <Typography variant="h6" noWrap>
                      {menu.name}
                    </Typography>
                  </Box>
                </CardContent>
              </CardActionArea>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Container>
  );
};

export default AdminUserMenusPage;
