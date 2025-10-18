// استيراد React و Hooks اللازمة
import React, { useEffect, useState, useMemo } from 'react';
// لأخذ userId من عنوان الرابط
import { useParams } from 'react-router-dom';
// نسخة axios المهيّأة لديك (تضيف الـ baseURL والـ headers)
import axios from '../services/axios';
// مكوّنات MUI التي سنستخدمها في الواجهة
import {
  Container, Typography, TextField, MenuItem, Button, Stack, Alert, Box, LinearProgress, Chip
} from '@mui/material';
// أيقونات للشرط المحقق أو غير المحقق
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
// الترجمة
import { useTranslation } from 'react-i18next';

const AdminEditUserPage = () => {
  // دالة الترجمة
  const { t } = useTranslation();
  // رقم/معرف المستخدم من البارامز
  const { userId } = useParams();

  // حالة بيانات النموذج المعروضة للمسؤول
  const [userData, setUserData] = useState({
    username: '',   // اسم المستخدم (للعرض فقط هنا)
    email: '',      // البريد الإلكتروني
    role: '',       // الدور (admin/owner)
    password: '',   // كلمة المرور الجديدة (اختياري)
  });

  // حالة لرسائل الخطأ العامة (غير الخاصة بكلمة المرور)
  const [error, setError] = useState('');
  // حالة لرسائل نجاح التحديث
  const [success, setSuccess] = useState('');
  // حالة لرسائل خطأ كلمة المرور القادمة من السيرفر
  const [passwordErrors, setPasswordErrors] = useState([]);

  // عند التحميل الأولي للصفحة؛ اجلب بيانات المستخدم
  useEffect(() => {
    fetchUser();
  }, []); // [] تعني مرة واحدة فقط عند التركيب

  // دالة جلب المستخدم من API
  const fetchUser = async () => {
    try {
      // جلب بيانات المستخدم حسب الـ userId
      const res = await axios.get(`/users/${userId}/`);
      // تعبئة الحقول (مع إفراغ كلمة المرور لأنها اختيارية)
      setUserData({ ...res.data, password: '' });
    } catch (err) {
      // عرض رسالة خطأ عامة عند الفشل
      setError(t('error_loading_user'));
    }
  };

  // تحديث الحالة عند تعديل أي حقل في النموذج
  const handleChange = (e) => {
    setUserData({ ...userData, [e.target.name]: e.target.value });
  };

  // ===== منطق تقييم قوة كلمة المرور (على الواجهة) =====
  const pwd = userData.password || ''; // الكلمة الحالية
  // تعريف القواعد بشكل مصفوفة؛ يسهل تكرارها وعرضها
  const rules = useMemo(() => ([
    { key: 'len',   test: (s) => s.length >= 8,              label: t('min_8_chars') },       // طول ≥ 8
    { key: 'low',   test: (s) => /[a-z]/.test(s),            label: t('has_lowercase') },     // حرف صغير
    { key: 'up',    test: (s) => /[A-Z]/.test(s),            label: t('has_uppercase') },     // حرف كبير
    { key: 'num',   test: (s) => /\d/.test(s),               label: t('has_number') },        // رقم
    { key: 'spec',  test: (s) => /[^A-Za-z0-9]/.test(s),     label: t('has_symbol') },        // رمز
    { key: 'notSeq',test: (s) => !/^\d+$/.test(s),           label: t('not_only_numbers') },  // ليست أرقامًا فقط
  ]), [t]); // أعِد تكوينها إذا تغيّرت اللغة

  // كم قاعدة من القواعد تحققت؟
  const satisfied = rules.filter(r => r.test(pwd)).length;
  // مستوى القوة بناءً على عدد القواعد المحققة
  const strength = pwd ? (satisfied <= 2 ? 'weak' : satisfied <= 4 ? 'medium' : 'strong') : '';
  // شريط التقدم كنسبة مئوية
  const progress = pwd ? Math.round((satisfied / rules.length) * 100) : 0;

  // هل يسمح بإرسال النموذج؟
  // نسمح بالإرسال إن كانت كلمة المرور فارغة (لا نريد تغييرها)
  // أو إن كانت غير فارغة لكنها تحقق حدًا أدنى (مثلاً 4 قواعد)
  const canSubmit = (!pwd) || (satisfied >= 4);

  // معالجة الإرسال
  const handleSubmit = async (e) => {
    e.preventDefault();                         // منع إعادة تحميل الصفحة
    setError(''); setSuccess('');               // تصفير الرسائل العامة
    setPasswordErrors([]);                      // تصفير أخطاء كلمة المرور السابقة

    try {
      // نبني الحمولة التي سنرسلها
      const payload = {
        email: userData.email, // تحديث البريد
        role: userData.role,   // تحديث الدور
        // ملاحظة: username للعرض فقط هنا (read_only في السيريلایزر)
      };
      // إذا أدخل المستخدم كلمة مرور جديدة (غير فارغة) نرسلها
      if (pwd && pwd.trim()) {
        payload.password = pwd;
      }

      // نستخدم PATCH لأن الباك إند يدعم التعديلات الجزئية
      await axios.patch(`/users/${userId}/`, payload);

      // نجاح: أظهر رسالة وامسح قيمة كلمة المرور من الحقل
      setSuccess(t('user_updated_successfully'));
      setUserData((u) => ({ ...u, password: '' }));
    } catch (err) {
      // حاول قراءة أخطاء السيرفر بصيغة JSON
      const data = err.response?.data;
      if (data?.password) {
        // server يرجع مثلا: {"password": ["This password is entirely numeric."]}
        setPasswordErrors(Array.isArray(data.password) ? data.password : [String(data.password)]);
      } else if (typeof data === 'object' && data !== null) {
        // جمع باقي الأخطاء إن وُجدت (مثل البريد مكرر)
        const msg = Object.entries(data)
          .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
          .join(' | ');
        setError(msg || t('error_updating_user'));
      } else {
        // خطأ عام غير متوقع
        setError(t('error_updating_user'));
      }
      setSuccess('');
    }
  };

  // ===== واجهة المستخدم =====
  return (
    // حاوية رئيسية بعرض صغير واتجاه الصفحة الحالي (RTL/LTR)
    <Container maxWidth="sm" sx={{ mt: 5, direction: document.dir }}>
      {/* العنوان */}
      <Typography variant="h5" fontWeight="bold" gutterBottom>
        ✏️ {t('edit_user')}
      </Typography>

      {/* رسائل عامة */}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

      {/* الفورم */}
      <Box component="form" onSubmit={handleSubmit} noValidate>
        <Stack spacing={3}>
          {/* اسم المستخدم — للعرض فقط */}
          <TextField
            label={`👤 ${t('username')}`}
            name="username"
            value={userData.username}
            onChange={handleChange}
            fullWidth
            required
            disabled                              // تعطيله لأن تغييره غير مدعوم هنا
          />

          {/* البريد الإلكتروني */}
          <TextField
            label={`📧 ${t('email')}`}
            name="email"
            type="email"
            value={userData.email}
            onChange={handleChange}
            fullWidth
            required
          />

          {/* كلمة مرور جديدة (اختيارية) */}
          <TextField
            label={`🔑 ${t('new_password')}`}
            name="password"
            type="password"
            value={userData.password}
            onChange={handleChange}
            fullWidth
          />

          {/* واجهة تقييم قوة كلمة المرور + الشروط + رسائل السيرفر */}
          {pwd && (
            <Box>
              {/* شريط قوة كلمة المرور */}
              <LinearProgress
                variant="determinate"
                value={progress}
                sx={{ height: 8, borderRadius: 999 }}
              />
              {/* شارة مختصرة للقوة العامة */}
              <Stack direction="row" spacing={1} mt={1} alignItems="center">
                {strength && (
                  <Chip
                    size="small"
                    label={
                      strength === 'strong'
                        ? t('strong')
                        : strength === 'medium'
                        ? t('medium')
                        : t('weak')
                    }
                    color={
                      strength === 'strong'
                        ? 'success'
                        : strength === 'medium'
                        ? 'warning'
                        : 'error'
                    }
                  />
                )}
              </Stack>

              {/* قائمة الشروط تتلوّن حسب تحققها */}
              <Stack direction="row" spacing={1} mt={1} flexWrap="wrap">
                {rules.map(r => {
                  const ok = r.test(pwd); // هل تحقق هذا الشرط؟
                  return (
                    <Chip
                      key={r.key}
                      size="small"
                      icon={ok ? <CheckIcon/> : <CloseIcon/>}
                      label={r.label}
                      variant={ok ? 'outlined' : 'filled'}
                      color={ok ? 'success' : 'default'}
                      sx={{ mr: 0.5, mb: 0.5 }}
                    />
                  );
                })}
              </Stack>

              {/* رسائل أخطاء كلمة المرور القادمة من السيرفر */}
              {passwordErrors.length > 0 && (
                <Alert severity="error" sx={{ mt: 1 }}>
                  {passwordErrors.map((m, i) => <div key={i}>{m}</div>)}
                </Alert>
              )}
            </Box>
          )}

          {/* اختيار الدور */}
          <TextField
            label={`🎭 ${t('role')}`}
            name="role"
            value={userData.role}
            onChange={handleChange}
            select
            fullWidth
            required
          >
            <MenuItem value="admin">{t('admin')}</MenuItem>
            <MenuItem value="owner">{t('owner')}</MenuItem>
          </TextField>

          {/* زر الحفظ — يعطل إذا كانت كلمة المرور ضعيفة (عند إدخالها) */}
          <Button type="submit" variant="contained" fullWidth disabled={!canSubmit}>
            💾 {t('save_changes')}
          </Button>
        </Stack>
      </Box>
    </Container>
  );
};

export default AdminEditUserPage;
