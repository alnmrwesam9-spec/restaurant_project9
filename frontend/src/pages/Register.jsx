// src/pages/Register.jsx
// -----------------------------------------------------------------------------
// Register page — باستخدام أيقونة/لوغو حقيقيين + شارة "بواسطة ايبلا تيك" تحت الشعار
// -----------------------------------------------------------------------------

import React, { useState, useEffect, useMemo } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../services/axios";
import {
  Box,
  Button,
  TextField,
  Typography,
  Stack,
  Alert,
  LinearProgress,
  InputAdornment,
  Divider,
  Paper,
  useTheme,
  Fade,
  Slide,
  Chip,
  Avatar,
} from "@mui/material";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import CancelOutlinedIcon from "@mui/icons-material/CancelOutlined";
import HourglassEmptyIcon from "@mui/icons-material/HourglassEmpty";
import { alpha } from "@mui/material/styles";
import { useTranslation } from "react-i18next";
import i18n from "../i18n";

// -----------------------------------------------------------------------------
// محاولات مرنة للمسارات حسب الإعدادات في الباكند
// -----------------------------------------------------------------------------
async function registerOnce(payload) {
  try {
    return await api.post("/auth/register", payload);
  } catch (e) {
    if (e?.response?.status !== 404) throw e;
  }
  return api.post("/register/", payload);
}

async function loginOnce(payload) {
  try {
    return await api.post("/auth/login", payload);
  } catch (e) {
    if (e?.response?.status !== 404) throw e;
  }
  return api.post("/token/", payload);
}

export default function Register({ onLogin }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const theme = useTheme();

  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
    password2: "",
    first_name: "",
    last_name: "",
  });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});

  // availability state
  const [checkingUser, setCheckingUser] = useState(false);
  const [userAvailable, setUserAvailable] = useState(null);
  const [checkingEmail, setCheckingEmail] = useState(false);
  const [emailAvailable, setEmailAvailable] = useState(null);

  // password strength (zxcvbn lazy)
  const [zx, setZx] = useState(null);
  const [pwdScore, setPwdScore] = useState(0);
  const [pwdMsg, setPwdMsg] = useState("");

  // RTL
  const isRTL = useMemo(() => i18n.language === "ar", [i18n.language]);
  useEffect(() => {
    document.dir = isRTL ? "rtl" : "ltr";
    document.documentElement.lang = i18n.language;
  }, [isRTL, i18n.language]);
  const changeLang = (lang) => i18n.changeLanguage(lang);

  // zxcvbn (lazy import)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const mod = await import("zxcvbn");
        if (!cancelled) setZx(() => mod.default || mod);
      } catch {
        /* optional */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleChange = (e) =>
    setFormData({ ...formData, [e.target.name]: e.target.value });

  // username availability
  useEffect(() => {
    const u = (formData.username || "").trim();
    if (!u) {
      setUserAvailable(null);
      setCheckingUser(false);
      return;
    }
    const id = setTimeout(async () => {
      setCheckingUser(true);
      try {
        const { data } = await api.get(
          `/auth/username-available/?username=${encodeURIComponent(u)}`
        );
        setUserAvailable(Boolean(data?.available));
      } catch {
        setUserAvailable(null);
      } finally {
        setCheckingUser(false);
      }
    }, 400);
    return () => clearTimeout(id);
  }, [formData.username]);

  // email availability
  useEffect(() => {
    const e = (formData.email || "").trim();
    if (!e) {
      setEmailAvailable(null);
      setCheckingEmail(false);
      return;
    }
    const id = setTimeout(async () => {
      setCheckingEmail(true);
      try {
        const { data } = await api.get(
          `/auth/email-available/?email=${encodeURIComponent(e)}`
        );
        setEmailAvailable(Boolean(data?.available));
      } catch {
        setEmailAvailable(null);
      } finally {
        setCheckingEmail(false);
      }
    }, 400);
    return () => clearTimeout(id);
  }, [formData.email]);

  // password strength
  useEffect(() => {
    const pwd = formData.password || "";
    if (!pwd) {
      setPwdScore(0);
      setPwdMsg("");
      return;
    }
    if (zx) {
      const res = zx(pwd);
      setPwdScore(res?.score ?? 0);
      const labels = [
        t("very_weak") || "ضعيفة جدًا",
        t("weak") || "ضعيفة",
        t("fair") || "متوسطة",
        t("strong") || "قوية",
        t("very_strong") || "قوية جدًا",
      ];
      setPwdMsg(labels[res?.score ?? 0]);
    } else {
      let score = 0;
      if (pwd.length >= 8) score++;
      if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd)) score++;
      if (/\d/.test(pwd)) score++;
      if (/[^A-Za-z0-9]/.test(pwd)) score++;
      if (pwd.length >= 12) score++;
      score = Math.min(score, 4);
      setPwdScore(score);
      const labels = ["ضعيفة جدًا", "ضعيفة", "متوسطة", "قوية", "قوية جدًا"];
      setPwdMsg(labels[score]);
    }
  }, [formData.password, zx, t]);

  const passwordsMatch =
    (formData.password || "") === (formData.password2 || "");
  const canSubmit =
    !submitting &&
    !!formData.username &&
    !!formData.email &&
    !!formData.first_name &&
    !!formData.last_name &&
    !!formData.password &&
    passwordsMatch &&
    pwdScore >= 3;

  // -----------------------------------------------------------------------------
  // منطق التسجيل/التسجيل الدخول + التخزين والتوجيه
  // -----------------------------------------------------------------------------
  const handleRegister = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    setFieldErrors({});

    if (!passwordsMatch) {
      setError(t("passwords_do_not_match") || "كلمتا المرور غير متطابقتين.");
      setSubmitting(false);
      return;
    }

    try {
      await registerOnce({
        username: formData.username,
        email: formData.email,
        password: formData.password,
        role: "owner",
        first_name: formData.first_name,
        last_name: formData.last_name,
      });

      const loginRes = await loginOnce({
        username: formData.username,
        password: formData.password,
      });

      const accessToken =
        loginRes?.data?.access ||
        loginRes?.data?.token ||
        loginRes?.data?.access_token;
      const refreshToken =
        loginRes?.data?.refresh || loginRes?.data?.refresh_token;

      if (!accessToken) throw new Error("No access token");

      localStorage.setItem("access_token", accessToken);
      if (refreshToken) localStorage.setItem("refresh_token", refreshToken);
      api.defaults.headers.common.Authorization = `Bearer ${accessToken}`;

      let role = "owner";
      try {
        const me = await api.get("/auth/whoami");
        role = me?.data?.role || role;
      } catch {}
      localStorage.setItem("role", role);
      if (typeof onLogin === "function") onLogin(accessToken);

      navigate(role === "admin" ? "/admin/users" : "/menus", { replace: true });
    } catch (err) {
      const data = err?.response?.data;
      let msg = t("register_error") || "حدث خطأ أثناء إنشاء الحساب.";
      const fe = {};
      if (data && typeof data === "object") {
        for (const k of [
          "username",
          "email",
          "password",
          "first_name",
          "last_name",
          "non_field_errors",
          "detail",
          "role",
        ]) {
          if (data[k])
            fe[k] = Array.isArray(data[k]) ? data[k].join(" ") : String(data[k]);
        }
        msg =
          fe.detail ||
          fe.non_field_errors ||
          fe.password ||
          fe.email ||
          fe.username ||
          data.error ||
          msg;
      }
      setFieldErrors(fe);
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // === عناصر صغيرة لحبوب اللغات ===
  const Pill = ({ code, onClick }) => (
    <Chip
      label={code}
      onClick={onClick}
      variant="outlined"
      size="small"
      sx={{ borderColor: "divider", bgcolor: "background.paper", fontWeight: 600 }}
    />
  );

  const strengthValue = ((pwdScore || 0) / 4) * 100;

  return (
    <Box
      component="main"
      sx={{
        minHeight: "100svh",
        display: "grid",
        gridTemplateColumns: { xs: "1fr", md: "5fr 7fr" },
        bgcolor: "background.default",
      }}
    >
      {/* ============ Left column (FORM) ============ */}
      <Box
        sx={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          px: { xs: 2.5, md: 6 },
          py: { xs: 4, md: 6 },
          borderRight: !isRTL ? { md: `1px solid ${theme.palette.divider}` } : undefined,
          borderLeft: isRTL ? { md: `1px solid ${theme.palette.divider}` } : undefined,
          bgcolor: "background.default",
        }}
      >
        <Box sx={{ width: "100%", maxWidth: 420 }}>
          {/* Brand (icon + logo) + Lang pills */}
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 3 }}>
            {/* ⬇︎ شعار + شارة تحت الشعار */}
            <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0.5 }}>
              <Stack direction="row" alignItems="center" spacing={1.2}>
                <Avatar
                  variant="rounded"
                  src="/assets/icon.svg"
                  alt="IBLA Dish Logo"
                  sx={{ width: 80, height: 80, borderRadius: 2, bgcolor: "transparent" }}
                />
                <Box
  component="img"
  src="/assets/logo.svg"
  alt="IBLA DISH"
  sx={{
    height: 80,
    transform: 'translateY(-3px)',
    '@media (min-width:900px)': { transform: 'translateY(-4px)' },
  }}
/>

              </Stack>

              {/* الشارة تحت الشعار */}
<Box sx={{ mt: 0.25, display: 'flex', alignItems: 'center', gap: 1 }}>
  <Box sx={{ width: 28, height: 1, bgcolor: 'divider.main', borderTop: (t) => `1px solid ${t.palette.divider}` }} />

  {/* ⬅︎ اجعل النص رابطًا خارجيًا */}
  <Box
    component="a"
    href="https://www.iblatech.de/"
    target="_blank"
    rel="noopener noreferrer"
    sx={{ textDecoration: 'none' }}
  >
    <Typography
      variant="caption"
      sx={{
        px: 1.2,
        py: 0.35,
        borderRadius: 999,
        bgcolor: 'action.hover',
        color: 'text.secondary',
        fontWeight: 800,
        letterSpacing: 0.3,
        lineHeight: 1,
        userSelect: 'none',
        cursor: 'pointer',
        '&:hover': { bgcolor: 'action.selected' },
      }}
    >
      {t('powered_by') || 'بواسطة ايبلا تيك'}
    </Typography>
  </Box>

  <Box sx={{ width: 28, height: 1, bgcolor: 'divider.main', borderTop: (t) => `1px solid ${t.palette.divider}` }} />
</Box>

            </Box>

            {/* حبوب اللغات */}
            <Stack direction="row" spacing={1}>
              <Pill code="EN" onClick={() => changeLang("en")} />
              <Pill code="DE" onClick={() => changeLang("de")} />
              <Pill code="AR" onClick={() => changeLang("ar")} />
            </Stack>
          </Stack>

          <Fade in timeout={700}>
            <Typography variant="h4" fontWeight={800} sx={{ mb: 1.5 }}>
              {t("register") || "تسجيل حساب جديد"}
            </Typography>
          </Fade>
          <Fade in timeout={800}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              {t("create_account") || "إنشاء حسابك للبدء بإدارة القوائم والأطباق."}
            </Typography>
          </Fade>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <Box component="form" onSubmit={handleRegister} noValidate>
            <Slide in direction={isRTL ? "left" : "right"} timeout={900}>
              <TextField
                fullWidth
                margin="normal"
                label={t("username") || "اسم المستخدم"}
                name="username"
                value={formData.username}
                onChange={handleChange}
                required
                InputProps={{
                  endAdornment: checkingUser ? (
                    <InputAdornment position="end">
                      <HourglassEmptyIcon fontSize="small" />
                    </InputAdornment>
                  ) : userAvailable === true ? (
                    <InputAdornment position="end">
                      <CheckCircleOutlineIcon color="success" fontSize="small" />
                    </InputAdornment>
                  ) : userAvailable === false ? (
                    <InputAdornment position="end">
                      <CancelOutlinedIcon color="error" fontSize="small" />
                    </InputAdornment>
                  ) : null,
                }}
                helperText={
                  fieldErrors.username ||
                  (userAvailable === false
                    ? t("username_taken") || "اسم المستخدم مستخدم بالفعل."
                    : " ")
                }
                error={!!fieldErrors.username || userAvailable === false}
                sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
              />
            </Slide>

            <Slide in direction={isRTL ? "left" : "right"} timeout={950}>
              <TextField
                fullWidth
                margin="normal"
                label={t("email") || "البريد الإلكتروني"}
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                InputProps={{
                  endAdornment: checkingEmail ? (
                    <InputAdornment position="end">
                      <HourglassEmptyIcon fontSize="small" />
                    </InputAdornment>
                  ) : emailAvailable === true ? (
                    <InputAdornment position="end">
                      <CheckCircleOutlineIcon color="success" fontSize="small" />
                    </InputAdornment>
                  ) : emailAvailable === false ? (
                    <InputAdornment position="end">
                      <CancelOutlinedIcon color="error" fontSize="small" />
                    </InputAdornment>
                  ) : null,
                }}
                helperText={
                  fieldErrors.email ||
                  (emailAvailable === false ? t("email_in_use") || "البريد مستخدم بالفعل." : " ")
                }
                error={!!fieldErrors.email || emailAvailable === false}
                sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
              />
            </Slide>

            <Slide in direction={isRTL ? "left" : "right"} timeout={1000}>
              <TextField
                fullWidth
                margin="normal"
                label={t("first_name") || "الاسم"}
                name="first_name"
                value={formData.first_name}
                onChange={handleChange}
                required
                error={!!fieldErrors.first_name}
                helperText={fieldErrors.first_name || " "}
                sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
              />
            </Slide>

            <Slide in direction={isRTL ? "left" : "right"} timeout={1050}>
              <TextField
                fullWidth
                margin="normal"
                label={t("last_name") || "الكنية"}
                name="last_name"
                value={formData.last_name}
                onChange={handleChange}
                required
                error={!!fieldErrors.last_name}
                helperText={fieldErrors.last_name || " "}
                sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
              />
            </Slide>

            <Slide in direction={isRTL ? "left" : "right"} timeout={1100}>
              <TextField
                fullWidth
                margin="normal"
                label={t("password") || "كلمة المرور"}
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                required
                error={!!fieldErrors.password}
                helperText={fieldErrors.password || pwdMsg || " "}
                sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
              />
            </Slide>

            {!!formData.password && (
              <Box sx={{ mt: 0.5 }}>
                <LinearProgress
                  variant="determinate"
                  value={strengthValue}
                  sx={{
                    height: 8,
                    borderRadius: 1,
                    "& .MuiLinearProgress-bar": { transition: "width 240ms ease" },
                  }}
                />
              </Box>
            )}

            <Slide in direction={isRTL ? "left" : "right"} timeout={1150}>
              <TextField
                fullWidth
                margin="normal"
                label={t("confirm_password") || "تأكيد كلمة المرور"}
                type="password"
                name="password2"
                value={formData.password2}
                onChange={handleChange}
                required
                error={!!formData.password2 && !passwordsMatch}
                helperText={
                  !!formData.password2 && !passwordsMatch
                    ? t("passwords_do_not_match") || "كلمتا المرور غير متطابقتين."
                    : " "
                }
                sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
              />
            </Slide>

            <Button
              fullWidth
              type="submit"
              variant="contained"
              disabled={!canSubmit}
              sx={{
                mt: 2.5,
                py: 1.2,
                textTransform: "none",
                fontWeight: 800,
                borderRadius: 2,
                boxShadow: "none",
              }}
            >
              {submitting ? t("loading") || "جارٍ التحميل…" : t("register") || "تسجيل"}
            </Button>

            <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
              {t("have_account") || "لديك حساب؟"}{" "}
              <Link to="/login">{t("sign_in") || "تسجيل الدخول"}</Link>
            </Typography>

            <Stack direction="row" spacing={2} alignItems="center" sx={{ mt: 2 }}>
              <Divider sx={{ flex: 1 }} />
              <Typography variant="caption" color="text.secondary">
                {t("fast_register") || "تسجيل سريع قريبًا…"}
              </Typography>
              <Divider sx={{ flex: 1 }} />
            </Stack>
          </Box>
        </Box>
      </Box>

      {/* ============ Right column (PROMO DARK CARD) ============ */}
      <Box
        sx={{
          position: "relative",
          minHeight: { xs: 320, md: "100svh" },
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          px: { xs: 2, md: 4 },
          py: { xs: 4, md: 6 },
        }}
      >
        <Paper
          elevation={0}
          sx={{
            position: "relative",
            width: "100%",
            height: { xs: "100%", md: "90%" },
            maxWidth: 720,
            bgcolor: "var(--brand-sidebar)",
            color: "common.white",
            borderRadius: { xs: 6, md: 8 },
            p: { xs: 3, md: 6 },
            overflow: "hidden",
            border: "1px solid",
            borderColor: "divider",
          }}
        >
          {/* تأثيرات خفيفة */}
          <Box
            sx={{
              pointerEvents: "none",
              position: "absolute",
              top: -80,
              right: -120,
              width: 420,
              height: 420,
              transform: "rotate(35deg)",
              background: (t) =>
                `linear-gradient(90deg, ${alpha(t.palette.common.white, 0.08)}, ${alpha(
                  t.palette.common.white,
                  0
                )} 60%)`,
              filter: "blur(1px)",
            }}
          />
          <Box
            sx={{
              pointerEvents: "none",
              position: "absolute",
              bottom: -120,
              left: -140,
              width: 480,
              height: 480,
              transform: "rotate(-30deg)",
              background: (t) =>
                `linear-gradient(90deg, ${alpha(t.palette.primary.main, 0.12)}, ${alpha(
                  t.palette.common.white,
                  0
                )} 70%)`,
              filter: "blur(2px)",
            }}
          />

          {/* Watermark */}
          <Typography
            aria-hidden
            sx={{
              position: "absolute",
              inset: 0,
              fontSize: { xs: 200, md: 320 },
              fontWeight: 900,
              letterSpacing: -4,
              color: (t) => alpha(t.palette.common.white, 0.06),
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              userSelect: "none",
              textAlign: "center",
              px: 2,
            }}
          >
            IBLA&nbsp;DISH
          </Typography>

          {/* Content */}
          <Box sx={{ position: "relative" }}>
            <Fade in timeout={700}>
              <Typography variant="h4" fontWeight={900} sx={{ mb: 1, color: theme.palette.common.white }}>
                {t("create_account") || "Create your account"}
              </Typography>
            </Fade>
            <Fade in timeout={800}>
              <Typography variant="body2" sx={{ opacity: 0.85, maxWidth: 560, mb: 2 }}>
                {t("register_intro") ||
                  "One dashboard to manage your menus, dishes, prices and languages."}
              </Typography>
            </Fade>

            <Stack spacing={1.2}>
              <Slide in direction={isRTL ? "left" : "right"} timeout={900}>
                <Typography variant="body2">• {t("feature_menu") || "Menu management system"}</Typography>
              </Slide>
              <Slide in direction={isRTL ? "left" : "right"} timeout={1000}>
                <Typography variant="body2">
                  • {t("feature_realtime") || "Real-time order tracking"}
                </Typography>
              </Slide>
              <Slide in direction={isRTL ? "left" : "right"} timeout={1100}>
                <Typography variant="body2">
                  • {t("feature_analytics") || "Analytics & reporting"}
                </Typography>
              </Slide>
            </Stack>

            <Typography variant="caption" sx={{ opacity: 0.75, mt: 2, display: "block" }}>
              {t("join_now") || "Join restaurants already using our digital menus."}
            </Typography>
          </Box>
        </Paper>
      </Box>
    </Box>
  );
}
