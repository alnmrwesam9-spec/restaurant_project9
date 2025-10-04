// src/pages/Register.jsx
// -----------------------------------------------------------------------------
// Register page with live username/email availability + password strength meter.
// Keeps the original right-side black Paper card with watermark.
// Uses axios client (services/axios) with /api base
// -----------------------------------------------------------------------------

import React, { useState, useEffect, useMemo } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../services/axios";
import {
  Box,
  Button,
  TextField,
  Typography,
  Avatar,
  Stack,
  Alert,
  LinearProgress,
  InputAdornment,
  Divider,
  Paper,
} from "@mui/material";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import CancelOutlinedIcon from "@mui/icons-material/CancelOutlined";
import HourglassEmptyIcon from "@mui/icons-material/HourglassEmpty";
import { useTranslation } from "react-i18next";
import i18n from "../i18n";

export default function Register({ onLogin }) {
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

  // availability state
  const [checkingUser, setCheckingUser] = useState(false);
  const [userAvailable, setUserAvailable] = useState(null);

  const [checkingEmail, setCheckingEmail] = useState(false);
  const [emailAvailable, setEmailAvailable] = useState(null);

  // password strength
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

  // lazy-load zxcvbn (optional)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const mod = await import("zxcvbn");
        if (!cancelled) setZx(() => mod.default || mod);
      } catch {
        // ignore if not available
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

  const handleRegister = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    if (!passwordsMatch) {
      setError(t("passwords_do_not_match") || "كلمتا المرور غير متطابقتين.");
      setSubmitting(false);
      return;
    }

    try {
      await api.post("/register/", {
        username: formData.username,
        email: formData.email,
        password: formData.password,
        role: "owner",
        first_name: formData.first_name,
        last_name: formData.last_name,
      });

      const loginRes = await api.post("/token/", {
        username: formData.username,
        password: formData.password,
      });

      const token =
        loginRes?.data?.access ||
        loginRes?.data?.token ||
        loginRes?.data?.access_token;

      if (!token) throw new Error("No access token");

      sessionStorage.setItem("token", token);
      sessionStorage.setItem("role", "owner");
      if (typeof onLogin === "function") onLogin(token);

      navigate("/menus", { replace: true });
    } catch (err) {
      console.error(err);
      const msg =
        err?.response?.data?.password?.[0] ||
        err?.response?.data?.detail ||
        err?.response?.data?.error ||
        (t("register_error") || "حدث خطأ أثناء إنشاء الحساب.");
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const adornment = (checking, available) => {
    if (checking)
      return (
        <InputAdornment position="end">
          <HourglassEmptyIcon fontSize="small" />
        </InputAdornment>
      );
    if (available === true)
      return (
        <InputAdornment position="end">
          <CheckCircleOutlineIcon color="success" fontSize="small" />
        </InputAdornment>
      );
    if (available === false)
      return (
        <InputAdornment position="end">
          <CancelOutlinedIcon color="error" fontSize="small" />
        </InputAdornment>
      );
    return null;
  };

  return (
    <Box
      component="main"
      sx={{
        minHeight: "100svh",
        display: "flex",
        flexDirection: { xs: "column", md: isRTL ? "row-reverse" : "row" },
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
            {t("register") || "Register"}
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
              label={t("username") || "Username"}
              name="username"
              value={formData.username}
              onChange={handleChange}
              required
              InputProps={{
                endAdornment: adornment(checkingUser, userAvailable),
              }}
              helperText={
                userAvailable === false
                  ? t("username_taken") || "اسم المستخدم مستخدم بالفعل."
                  : " "
              }
              error={userAvailable === false}
            />

            <TextField
              fullWidth
              margin="normal"
              label={t("email") || "Email"}
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
              InputProps={{
                endAdornment: adornment(checkingEmail, emailAvailable),
              }}
              helperText={
                emailAvailable === false
                  ? t("email_in_use") || "البريد مستخدم بالفعل."
                  : " "
              }
              error={emailAvailable === false}
            />

            <TextField
              fullWidth
              margin="normal"
              label={t("first_name") || "First Name"}
              name="first_name"
              value={formData.first_name}
              onChange={handleChange}
              required
            />
            <TextField
              fullWidth
              margin="normal"
              label={t("last_name") || "Last Name"}
              name="last_name"
              value={formData.last_name}
              onChange={handleChange}
              required
            />

            <TextField
              fullWidth
              margin="normal"
              label={t("password") || "Password"}
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              required
              helperText={pwdMsg || " "}
            />
            {!!formData.password && (
              <Box sx={{ mt: 0.5 }}>
                <LinearProgress
                  variant="determinate"
                  value={((pwdScore || 0) / 4) * 100}
                  sx={{ height: 8, borderRadius: 1 }}
                />
              </Box>
            )}

            <TextField
              fullWidth
              margin="normal"
              label={t("confirm_password") || "Confirm Password"}
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
            />

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
                bgcolor: "#111",
                "&:hover": { bgcolor: "#000" },
              }}
            >
              {submitting ? t("loading") || "Loading…" : t("register") || "Register"}
            </Button>

            <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
              {t("have_account") || "Already have an account?"}{" "}
              <Link to="/login">{t("sign_in") || "Sign in"}</Link>
            </Typography>

            <Stack direction="row" spacing={2} alignItems="center" sx={{ mt: 2 }}>
              <Divider sx={{ flex: 1 }} />
              <Typography variant="caption" color="text.secondary">
                {t("fast_register") || "Fast register soon…"}
              </Typography>
              <Divider sx={{ flex: 1 }} />
            </Stack>
          </Box>
        </Box>
      </Box>

      {/* Right = Dark Paper card (kept from original) */}
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
              {t("create_account") || "Create your account"}
            </Typography>
            <Typography variant="body2" sx={{ opacity: 0.85, maxWidth: 520 }}>
              {t("register_intro") ||
                "One dashboard to manage your menus, dishes, prices and languages."}
            </Typography>
            <Typography variant="caption" sx={{ opacity: 0.7 }}>
              {t("join_now") || "Join restaurants already using our digital menus."}
            </Typography>
          </Stack>
        </Paper>
      </Box>
    </Box>
  );
}
