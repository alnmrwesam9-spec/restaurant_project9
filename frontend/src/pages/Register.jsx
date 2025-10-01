import React, { useState, useEffect, useMemo } from "react";
import { useNavigate, Link } from "react-router-dom";
import axios from "axios";
import {
  Box,
  Button,
  TextField,
  Typography,
  Avatar,
  Stack,
  Divider,
  Paper,
  Alert,
} from "@mui/material";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import { useTranslation } from "react-i18next";
import i18n from "../i18n";

import api from "../services/axios"; // ✅ العميل الموحّد (baseURL = /api في الإنتاج)

export default function RegisterPage({ onLogin }) {
  const { t } = useTranslation();
  const navigate = useNavigate();

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

  // RTL setup
  const isRTL = useMemo(() => i18n.language === "ar", [i18n.language]);
  useEffect(() => {
    document.dir = isRTL ? "rtl" : "ltr";
    document.documentElement.lang = i18n.language;
  }, [isRTL, i18n.language]);
  const changeLang = (lang) => i18n.changeLanguage(lang);

  const handleChange = (e) =>
    setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleRegister = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      // ✅ أهم نقطة: مسار نسبي عبر Nginx، بدون أي http://127.0.0.1:8000
      await api.post("/register/", {
        ...formData,
        role: "owner",
      });

      // بعد التسجيل: اطلب JWT
      const loginRes = await api.post("/token/", {
        username: formData.username,
        password: formData.password,
      });

      const access = loginRes?.data?.access;
      const refresh = loginRes?.data?.refresh;
      if (!access) throw new Error("Missing access token after register");

      // وحّد التخزين مع صفحة تسجيل الدخول
      sessionStorage.setItem("token", access);
      sessionStorage.setItem("role", "user");
      localStorage.removeItem("token");
      localStorage.removeItem("role");

      // حدّث الهيدر الافتراضي للعميل
      api.defaults.headers.common.Authorization = `Bearer ${access}`;

      onLogin?.(access);
      navigate("/menus");
    } catch (err) {
      console.error(err);
      // رسائل أنسب للمستخدم
      if (axios.isAxiosError && axios.isAxiosError(err)) {
        const status = err.response?.status;
        if (status === 400 || status === 422) {
          setError(t("register_error") || "فشل في التسجيل، تحقق من البيانات.");
        } else if (status === 403) {
          setError(t("forbidden") || "غير مخوّل لإتمام العملية.");
        } else if (status >= 500) {
          setError(t("server_down") || "مشكلة في الخادم، حاول لاحقًا.");
        } else {
          setError(t("network_error") || "مشكلة شبكة، تحقق من الاتصال.");
        }
      } else {
        setError(t("register_error") || "فشل في التسجيل.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const layoutDirection = {
    xs: "column",
    md: isRTL ? "row-reverse" : "row",
  };

  return (
    <Box
      component="main"
      sx={{
        minHeight: "100svh",
        display: "flex",
        flexDirection: layoutDirection,
        bgcolor: "#f3f4f6",
      }}
    >
      {/* Left = Form */}
      <Box
        sx={{
          flex: { xs: "1 1 auto", md: "5 1 0" },
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          px: { xs: 2.5, md: 6 },
          py: { xs: 4, md: 6 },
        }}
      >
        <Box sx={{ width: "100%", maxWidth: 420 }}>
          {/* Brand */}
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 3 }}>
            <Avatar
              variant="rounded"
              sx={{
                bgcolor: "#111",
                color: "#fff",
                fontWeight: 800,
                width: 36,
                height: 36,
                borderRadius: 2,
              }}
            >
              IB
            </Avatar>
            <Typography fontWeight={700}>IBLA</Typography>
          </Stack>

          <Typography variant="h4" fontWeight={800} sx={{ mb: 2 }}>
            {t("register") || "تسجيل حساب جديد"}
          </Typography>

          {/* Language */}
          <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
            <Button size="small" variant="outlined" onClick={() => changeLang("ar")}>
              AR
            </Button>
            <Button size="small" variant="outlined" onClick={() => changeLang("de")}>
              DE
            </Button>
            <Button size="small" variant="outlined" onClick={() => changeLang("en")}>
              EN
            </Button>
          </Stack>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <Box component="form" onSubmit={handleRegister} noValidate>
            <TextField
              fullWidth
              margin="normal"
              label={t("username") || "الاسم"}
              name="username"
              value={formData.username}
              onChange={handleChange}
              required
            />
            <TextField
              fullWidth
              margin="normal"
              label={t("email") || "البريد الإلكتروني"}
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
            />
            <TextField
              fullWidth
              margin="normal"
              label={t("first_name") || "الاسم الأول"}
              name="first_name"
              value={formData.first_name}
              onChange={handleChange}
              required
            />
            <TextField
              fullWidth
              margin="normal"
              label={t("last_name") || "اسم العائلة"}
              name="last_name"
              value={formData.last_name}
              onChange={handleChange}
              required
            />
            <TextField
              fullWidth
              margin="normal"
              label={t("password") || "كلمة المرور"}
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              required
            />
            <TextField
              fullWidth
              margin="normal"
              label={t("confirm_password") || "أعد كتابة كلمة المرور"}
              type="password"
              name="password2"
              value={formData.password2}
              onChange={handleChange}
              required
            />

            <Button
              fullWidth
              type="submit"
              variant="contained"
              disabled={submitting}
              sx={{
                mt: 2.5,
                py: 1.2,
                textTransform: "none",
                fontWeight: 800,
                borderRadius: 2,
                bgcolor: "#111",
                "&:hover": { bgcolor: "#000" },
              }}
            >
              {submitting ? (t("loading") || "جاري المعالجة…") : (t("register") || "تسجيل حساب جديد")}
            </Button>
          </Box>

          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            {(t("have_account") || "هل لديك حساب بالفعل؟")}{" "}
            <Link to="/login">{t("sign_in") || "تسجيل الدخول"}</Link>
          </Typography>

          <Stack direction="row" spacing={2} alignItems="center" sx={{ mt: 2 }}>
            <Divider sx={{ flex: 1 }} />
            <Typography variant="caption" color="text.secondary">
              {t("fast_register") || "تسجيل سريع (قريبًا)"}
            </Typography>
            <Divider sx={{ flex: 1 }} />
          </Stack>
        </Box>
      </Box>

      {/* Right = Dark card */}
      <Box
        sx={{
          flex: { xs: "0 0 44vh", md: "7 1 0" },
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
            bgcolor: "#000",
            color: "#fff",
            borderRadius: { xs: 6, md: 8 },
            p: { xs: 3, md: 6 },
            overflow: "hidden",
          }}
        >
          <Typography
            aria-hidden
            sx={{
              position: "absolute",
              inset: 0,
              fontSize: { xs: 200, md: 360 },
              fontWeight: 900,
              letterSpacing: -6,
              color: "rgba(255,255,255,0.06)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              userSelect: "none",
            }}
          >
            IBLA
          </Typography>

          <Stack spacing={2} sx={{ position: "relative" }}>
            <Typography variant="overline" sx={{ opacity: 0.7 }}>
              IBLATECH
            </Typography>
            <Typography variant="h4" fontWeight={800}>
              {t("create_account") || "أنشئ حسابك"}
            </Typography>
            <Typography variant="body2" sx={{ opacity: 0.85, maxWidth: 520 }}>
              {t("register_intro") ||
                "لوحة واحدة لإدارة القوائم والأطباق والأسعار واللغات."}
            </Typography>
            <Typography variant="caption" sx={{ opacity: 0.7 }}>
              {t("join_now") || "انضم للمطاعم التي تستخدم قوائمنا الرقمية."}
            </Typography>
          </Stack>
        </Paper>
      </Box>
    </Box>
  );
}
