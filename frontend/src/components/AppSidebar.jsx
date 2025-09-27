// src/components/AppSidebar.jsx
import React from "react";
import {
  Box, Drawer, Avatar, Typography, IconButton, Button,
  List, ListItemButton, ListItemIcon, ListItemText, Divider, Tooltip
} from "@mui/material";
import FolderIcon from "@mui/icons-material/Folder";
import ImageIcon from "@mui/icons-material/Image";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import ChevronLeft from "@mui/icons-material/ChevronLeft";
import ChevronRight from "@mui/icons-material/ChevronRight";
import { keyframes } from "@mui/system";
import { useTranslation } from "react-i18next";

export const RAIL_WIDTH = 72;
export const SIDEBAR_WIDTH = 280;

export default function AppSidebar({
  mobileOpen,
  onMobileClose,
  collapsed,
  onToggleCollapsed,
  profile,
  menus = [],
  selectedMenuId,
  onSelectMenu,
  onPickImport,
  onUploadAvatar,
  isRTL = false,
}) {
  const { t } = useTranslation();
  const side = isRTL ? "right" : "left";
  const displayName = profile?.display_name || "User";
  const avatarSrc = profile?.avatar || undefined;
  const initial = (displayName || "U").trim()[0]?.toUpperCase() || "U";
  const accent = (theme) => theme.palette.primary.main;

  // حركة اختيار القائمة
  const slideIn = keyframes`
    0% { transform: scaleY(0); opacity: 0; }
    100% { transform: scaleY(1); opacity: 1; }
  `;

  const HeaderFull = (
    <Box
      sx={{
        px: 2, pt: 2, pb: 1.5,
        display: "flex",
        alignItems: "center",
        gap: 1.25,
        backdropFilter: "blur(10px)",
      }}
    >
      <Avatar src={avatarSrc} sx={{ width: 44, height: 44, fontWeight: 700 }}>
        {!avatarSrc ? initial : null}
      </Avatar>

      <Box sx={{ minWidth: 0 }}>
        <Typography variant="subtitle2" noWrap sx={{ fontWeight: 700 }}>
          {displayName}
        </Typography>

        <Button
          size="small"
          variant="text"
          component="label"
          startIcon={<ImageIcon />}
          sx={{
            px: 0, minWidth: 0,
            color: "text.secondary",
            "&:hover": { color: accent }
          }}
        >
          {t("change_photo") || "Change Photo"}
          <input hidden type="file" accept="image/*" onChange={onUploadAvatar} aria-label="upload avatar" />
        </Button>
      </Box>

      <Box sx={{ flex: 1 }} />

      <Tooltip title={t("collapse_sidebar") || "Collapse"}>
        <IconButton onClick={onToggleCollapsed} size="small">
          {isRTL ? <ChevronRight /> : <ChevronLeft />}
        </IconButton>
      </Tooltip>
    </Box>
  );

  const MenusList = (
    <>
      <Typography
        variant="caption"
        sx={{
          px: 2, pt: 1, pb: 0.75,
          color: "text.secondary",
          fontWeight: 600,
          letterSpacing: .3
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
                onClick={() => onSelectMenu(m.id)}
                sx={(theme) => ({
                  borderRadius: 1.5,
                  mb: .5,
                  position: "relative",
                  overflow: "hidden",
                  transition: "all .2s ease",
                  "&:hover": {
                    background: "rgba(0,0,0,0.04)",
                    transform: "translateX(2px)"
                  },
                  "&.Mui-selected": {
                    background: "rgba(0,0,0,0.02)",
                    boxShadow: "inset 0 0 0 1px rgba(0,0,0,.08)",
                  },
                })}
              >
                {/* خط بنفسجي صغير عند الاختيار */}
                {selected && (
                  <Box
                    sx={{
                      position: "absolute",
                      top: 6, bottom: 6,
                      [isRTL ? "right" : "left"]: 4,
                      width: 3,
                      borderRadius: 1,
                      bgcolor: accent,
                      transformOrigin: "top",
                      animation: `${slideIn} .2s ease-out`
                    }}
                  />
                )}

                <ListItemIcon sx={{ minWidth: 36, color: selected ? accent : "text.secondary" }}>
                  <FolderIcon />
                </ListItemIcon>

                <ListItemText
                  primary={
                    <Typography variant="body2" sx={{ fontWeight: selected ? 700 : 500 }}>
                      {m.name}
                    </Typography>
                  }
                />

                {m.is_published && (
                  <Tooltip title={t("badges.published") || "Published"}>
                    <Box
                      sx={{
                        width: 8, height: 8,
                        borderRadius: "50%",
                        bgcolor: "success.main",
                        mr: isRTL ? 0 : .5, ml: isRTL ? .5 : 0
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
        <Avatar src={avatarSrc} sx={{ mt: 1, fontWeight: 700 }}>
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
        {collapsed ? Rail : (
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
          },
        }}
        sx={{ display: { xs: "block", md: "none" } }}
      >
        {FullPanel}
      </Drawer>
    </>
  );
}
