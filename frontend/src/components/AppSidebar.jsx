// src/components/AppSidebar.jsx
import React, { useEffect, useRef, useState } from "react";
import {
  Box,
  Drawer,
  Avatar,
  Typography,
  IconButton,
  Button,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
  Tooltip,
  useMediaQuery,
} from "@mui/material";
import FolderIcon from "@mui/icons-material/Folder";
// ⚠️ ImageIcon مُزال لأنه لم يعد مستخدمًا
import UploadFileIcon from "@mui/icons-material/UploadFile";
import ChevronLeft from "@mui/icons-material/ChevronLeft";
import ChevronRight from "@mui/icons-material/ChevronRight";
import AddIcon from "@mui/icons-material/Add";
import { keyframes } from "@mui/system";
import { useTheme } from "@mui/material/styles";
import { useTranslation } from "react-i18next";
import api from "../services/axios";

// ثوابت العرض
export const RAIL_WIDTH = 72;
export const SIDEBAR_WIDTH = 280;

// ارتفاع شريط التطبيق (لمعالجة تراكب الـ Drawer على الموبايل)
const APPBAR_H_XS = 56;
const APPBAR_H_SM = 64;

// أفاتار افتراضي عند فشل التحميل
const DEFAULT_AVATAR =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 128 128'><circle cx='64' cy='64' r='64' fill='%23eee'/><circle cx='64' cy='48' r='22' fill='%23c4c4c4'/><path d='M16 116c8-26 40-30 48-30s40 4 48 30' fill='%23c4c4c4'/></svg>";

export default function AppSidebar({
  mobileOpen,
  onMobileClose,
  collapsed,
  onToggleCollapsed,
  menus = [],
  selectedMenuId,
  onSelectMenu,
  onPickImport,
  isRTL = false,
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const mdUp = useMediaQuery(theme.breakpoints.up("md"));
  const side = isRTL ? "right" : "left";

  // الحالة المحلية للملف الشخصي + الانشغال بالرفع
  const [profile, setProfile] = useState(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);

  // جلب الملف الشخصي لعرض الاسم والصورة
  useEffect(() => {
    let on = true;
    (async () => {
      try {
        const { data } = await api.get("/me/profile/");
        if (on) setProfile(data);
      } catch (e) {
        console.warn("fetch profile failed", e);
      }
    })();
    return () => {
      on = false;
    };
  }, []);

  // رفع الأفاتار
  const saveAvatar = async (file) => {
    if (!file) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("avatar", file);
      const { data } = await api.patch("/me/profile/", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setProfile((prev) => ({ ...(prev || {}), ...(data || {}) }));
    } catch (err) {
      console.error(err);
      alert(t("errors.upload_failed") || "تعذر حفظ الصورة. جرّب لاحقًا.");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    await saveAvatar(file);
  };

  // عرض الاسم والصورة
  const displayName =
    profile?.display_name || profile?.username || (t("user") || "User");
  const avatarSrc = profile?.avatar_url || undefined;
  const initial = (displayName || "U").trim()[0]?.toUpperCase() || "U";
  const accent = (theme) => theme.palette.primary.main;

  // حركة اختيار القائمة
  const slideIn = keyframes`
    0% { transform: scaleY(0); opacity: 0; }
    100% { transform: scaleY(1); opacity: 1; }
  `;

  // ترويسة الشريط (وضع العرض الكامل)
  const HeaderFull = (
    <Box
      sx={{
        px: 2,
        pt: 2,
        pb: 1.5,
        display: "flex",
        alignItems: "center",
        gap: 1.25,
        backdropFilter: "blur(10px)",
      }}
    >
      {/* حاوية الصورة مع زر + */}
      <Box sx={{ position: "relative" }}>
        <Avatar
          src={avatarSrc}
          imgProps={{
            onError: (e) => {
              e.currentTarget.src = DEFAULT_AVATAR;
            },
          }}
          sx={{ width: 44, height: 44, fontWeight: 700 }}
        >
          {!avatarSrc ? initial : null}
        </Avatar>

        {/* زر + فقط لرفع الصورة */}
        <IconButton
          component="label"
          size="small"
          disabled={busy}
          sx={{
            position: "absolute",
            bottom: -4,
            [isRTL ? "left" : "right"]: -6,
            width: 22,
            height: 22,
            borderRadius: "50%",
            bgcolor: "primary.main",
            color: "primary.contrastText",
            boxShadow: "0 2px 8px rgba(195, 18, 18, 0.15)",
            "&:hover": { bgcolor: "primary.dark" },
          }}
          title={t("change_photo") || "Change Photo"}
        >
          <AddIcon fontSize="inherit" />
          <input
            ref={fileRef}
            hidden
            type="file"
            accept="image/*"
            onChange={onFile}
            aria-label="upload avatar"
          />
        </IconButton>
      </Box>

      <Box sx={{ minWidth: 0 }}>
        <Typography
          variant="subtitle2"
          noWrap
          sx={{ fontWeight: 700, color: "text.primary" }}
        >
          {displayName}
        </Typography>

        {/* ✅ حُذف زر النص "تغيير الصورة" نهائيًا */}
      </Box>

      <Box sx={{ flex: 1 }} />

      <Tooltip title={t("collapse_sidebar") || "Collapse"}>
        <IconButton onClick={onToggleCollapsed} size="small">
          {isRTL ? <ChevronRight /> : <ChevronLeft />}
        </IconButton>
      </Tooltip>
    </Box>
  );

  // قائمة القوائم
  const MenusList = (
    <>
      <Typography
        variant="caption"
        sx={{
          px: 2,
          pt: 1,
          pb: 0.75,
          color: "text.secondary",
          fontWeight: 600,
          letterSpacing: 0.3,
        }}
      >
        {t("my_menus") || "My Menus"}
      </Typography>

      <Box sx={{ px: 1, flex: 1, minHeight: 0, overflowY: "auto" }}>
        <List dense disablePadding>
          {menus.map((m) => {
            const selected = String(selectedMenuId) === String(m.id);
            return (
              <ListItemButton
                key={m.id}
                selected={selected}
                onClick={() => onSelectMenu?.(m.id)}
                sx={() => ({
                  borderRadius: 1.5,
                  mb: 0.5,
                  position: "relative",
                  overflow: "hidden",
                  transition: "all .2s ease",
                  "&:hover": {
                    background: "rgba(0,0,0,0.04)",
                    transform: "translateX(2px)",
                  },
                  "&.Mui-selected": {
                    background: "rgba(0,0,0,0.02)",
                    boxShadow: "inset 0 0 0 1px rgba(0,0,0,.08)",
                  },
                })}
              >
                {/* خط بارز عند الاختيار */}
                {selected && (
                  <Box
                    sx={{
                      position: "absolute",
                      top: 6,
                      bottom: 6,
                      [isRTL ? "right" : "left"]: 4,
                      width: 3,
                      borderRadius: 1,
                      bgcolor: accent,
                      transformOrigin: "top",
                      animation: `${slideIn} .2s ease-out`,
                    }}
                  />
                )}

                <ListItemIcon
                  sx={{ minWidth: 36, color: selected ? accent : "text.secondary" }}
                >
                  <FolderIcon />
                </ListItemIcon>

                <ListItemText
                  primary={
                    <Typography
                      variant="body2"
                      sx={{ fontWeight: selected ? 700 : 500, color: "text.primary" }}
                    >
                      {m.name}
                    </Typography>
                  }
                />

                {m.is_published && (
                  <Tooltip title={t("badges.published") || "Published"}>
                    <Box
                      sx={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        bgcolor: "success.main",
                        mr: isRTL ? 0 : 0.5,
                        ml: isRTL ? 0.5 : 0,
                      }}
                    />
                  </Tooltip>
                )}
              </ListItemButton>
            );
          })}
        </List>
      </Box>
    </>
  );

  // زر الاستيراد
  const ImportButton = (
    <Box sx={{ p: 1.5 }}>
      <Button
        fullWidth
        variant="contained"
        startIcon={<UploadFileIcon />}
        onClick={onPickImport}
        sx={{
          borderRadius: 2,
          textTransform: "none",
          fontWeight: 700,
          py: 1.05,
          boxShadow: "0 4px 14px rgba(0,0,0,.1)",
        }}
      >
        {t("import_excel") || "Import Excel"}
      </Button>
    </Box>
  );

  // محتوى اللوحة الكاملة
  const FullPanel = (
    <Box
      sx={{
        width: SIDEBAR_WIDTH,
        height: 1,
        display: "flex",
        flexDirection: "column",
        bgcolor: "background.paper",
        borderColor: "divider",
        backdropFilter: "blur(12px)",
        boxShadow: "0 8px 24px rgba(0,0,0,.06)",
      }}
    >
      {HeaderFull}
      <Divider />
      {MenusList}
      {ImportButton}
    </Box>
  );

  // Rail (الوضع المضغوط)
  const Rail = (
    <Box
      sx={{
        position: "fixed",
        top: 0,
        bottom: 0,
        [side]: 0,
        width: RAIL_WIDTH,
        borderRight: isRTL ? 0 : "1px solid",
        borderLeft: isRTL ? "1px solid" : 0,
        borderColor: "divider",
        bgcolor: "background.paper",
        backdropFilter: "blur(12px)",
        zIndex: (t) => t.zIndex.drawer,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        py: 1,
      }}
    >
      <Tooltip title={displayName}>
        <Avatar
          src={avatarSrc}
          imgProps={{
            onError: (e) => {
              e.currentTarget.src = DEFAULT_AVATAR;
            },
          }}
          sx={{ mt: 1, fontWeight: 700 }}
        >
          {!avatarSrc ? initial : null}
        </Avatar>
      </Tooltip>
      <Tooltip title={t("expand_sidebar") || "Expand"}>
        <IconButton onClick={onToggleCollapsed} size="small" sx={{ mt: 1 }}>
          {isRTL ? <ChevronLeft /> : <ChevronRight />}
        </IconButton>
      </Tooltip>
    </Box>
  );

  return (
    <>
      {/* ثابت على الشاشات الكبيرة */}
      <Box sx={{ display: { xs: "none", md: "block" } }}>
        {collapsed ? (
          Rail
        ) : (
          <Box
            sx={{
              position: "fixed",
              top: 0,
              bottom: 0,
              [side]: 0,
              width: SIDEBAR_WIDTH,
              bgcolor: "background.paper",
              borderColor: "divider",
              borderRight: isRTL ? 0 : "1px solid",
              borderLeft: isRTL ? "1px solid" : 0,
              boxShadow: "0 8px 24px rgba(0,0,0,.06)",
              zIndex: (t) => t.zIndex.drawer,
            }}
          >
            {FullPanel}
          </Box>
        )}
      </Box>

      {/* Drawer للموبايل */}
      <Drawer
        open={mobileOpen}
        onClose={onMobileClose}
        anchor={side}
        ModalProps={{ keepMounted: true }}
        PaperProps={{
          sx: {
            width: SIDEBAR_WIDTH,
            backdropFilter: "blur(12px)",
            boxShadow: "0 8px 24px rgba(0,0,0,.12)",
            bgcolor: "background.paper",
            // ⬅️ منع تراكب الـ AppBar: ندفع المحتوى للأسفل
            pt: { xs: `${APPBAR_H_XS}px`, sm: `${APPBAR_H_SM}px` },
          },
        }}
        sx={{ display: { xs: "block", md: "none" } }}
      >
        {FullPanel}
      </Drawer>
    </>
  );
}
