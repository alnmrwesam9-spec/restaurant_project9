import React, { useState, useEffect, useRef } from "react";
import api from "../services/axios";
import {
  Box,
  Typography,
  Button,
  TextField,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tabs,
  Tab,
  Chip,
  Switch,
  FormControlLabel,
} from "@mui/material";
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  Upload as UploadIcon,
  Download as DownloadIcon,
  Refresh as RefreshIcon,
} from "@mui/icons-material";


// API Endpoints (without /api prefix since baseURL includes it)
const API = {
  allergens: "/allergens/codes/",
  additives: "/allergens/codes/", // Same endpoint, filtered by kind
  lexemes: "/lexemes/",
  ingredients: "/ingredients/",
};

const CSV = {
  lexemes: {
    export: "/lexemes/export/",
    import: "/lexemes/import/",
  },
  ingredients: {
    export: "/ingredients/export/",
    import: "/ingredients/import/",
  },
};

export default function AdminAllergensPage() {
  // Tab state: 0=Allergens, 1=Additives, 2=Lexemes, 3=Ingredients
  const [tabIndex, setTabIndex] = useState(0);
  const [kind, setKind] = useState("allergens"); // allergens | additives | lexemes | ingredients

  // Common state
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [okMsg, setOkMsg] = useState("");
  const [q, setQ] = useState("");
  const [ordering, setOrdering] = useState(""); // e.g. "code" or "name_de"

  // Dialog state
  const [openDialog, setOpenDialog] = useState(false);
  const [editItem, setEditItem] = useState(null); // null = create
  const [formData, setFormData] = useState({});

  // Auth check
  const [hasAuth, setHasAuth] = useState(false);

  // Debounce ref
  const reqIdRef = useRef(0);

  // Advanced settings toggle (for Lexemes/Ingredients)
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    // Simple check if user is admin (or at least logged in)
    const token = localStorage.getItem("access_token");
    setHasAuth(!!token);
  }, []);

  // Sync tabIndex -> kind
  useEffect(() => {
    switch (tabIndex) {
      case 0: setKind("allergens"); break;
      case 1: setKind("additives"); break;
      case 2: setKind("lexemes"); break;
      case 3: setKind("ingredients"); break;
      default: setKind("allergens");
    }
    setQ("");
    setOrdering("");
    setItems([]);
  }, [tabIndex]);

  // Debounce search
  const [debouncedQ, setDebouncedQ] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 500);
    return () => clearTimeout(t);
  }, [q]);

  // Load items when kind or search changes
  async function loadItems() {
    setError("");
    setOkMsg("");
    if (!hasAuth) {
      // setError("الرجاء تسجيل الدخول كمشرف أولًا.");
      // return;
    }
    const myReqId = ++reqIdRef.current;
    try {
      setLoading(true);
      let url = API[kind];
      const params = new URLSearchParams();
      if (debouncedQ) params.append("q", debouncedQ);
      if (ordering) params.append("ordering", ordering);

      if (kind === "allergens") {
        params.append("kind", "ALLERGEN");
      } else if (kind === "additives") {
        params.append("kind", "ADDITIVE");
      }

      const { data } = await api.get(`${url}?${params.toString()}`);
      if (myReqId !== reqIdRef.current) return;
      const arr = Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : data?.results || [];
      setItems(arr);
    } catch (e) {
      if (myReqId !== reqIdRef.current) return;
      setError(e?.response?.data?.detail || e.message || "خطأ أثناء الجلب");
    } finally {
      if (myReqId === reqIdRef.current) setLoading(false);
    }
  }

  useEffect(() => {
    loadItems();
  }, [kind, debouncedQ, ordering]);

  // CSV handlers
  function onLexemesExport() {
    setError("");
    setOkMsg("");
    api.get(CSV.lexemes.export, { responseType: "blob" })
      .then((res) => {
        const blob = new Blob([res.data], { type: "text/csv;charset=utf-8" });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "lexemes.csv";
        a.click();
        window.URL.revokeObjectURL(url);
      })
      .catch(() => setError("فشل تصدير CSV"));
  }

  async function onLexemesImport(fileObj) {
    setError("");
    setOkMsg("");
    if (!fileObj) return;
    const fd = new FormData();
    fd.append("file", fileObj);
    try {
      setLoading(true);
      await api.post(CSV.lexemes.import, fd, { headers: { "Content-Type": "multipart/form-data" } });
      setOkMsg("تم استيراد المعجم بنجاح");
      await loadItems();
    } catch {
      setError("فشل استيراد CSV");
    } finally {
      setLoading(false);
    }
  }

  function onIngredientsExport() {
    setError("");
    setOkMsg("");
    api.get(CSV.ingredients.export, { responseType: "blob" })
      .then((res) => {
        const blob = new Blob([res.data], { type: "text/csv;charset=utf-8" });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "ingredients.csv";
        a.click();
        window.URL.revokeObjectURL(url);
      })
      .catch(() => setError("فشل تصدير CSV"));
  }

  async function onIngredientsImport(fileObj) {
    setError("");
    setOkMsg("");
    if (!fileObj) return;
    const fd = new FormData();
    fd.append("file", fileObj);
    try {
      setLoading(true);
      await api.post(CSV.ingredients.import, fd, { headers: { "Content-Type": "multipart/form-data" } });
      setOkMsg("تم استيراد المكوّنات بنجاح");
      await loadItems();
    } catch {
      setError("فشل استيراد CSV");
    } finally {
      setLoading(false);
    }
  }

  // CRUD Handlers
  function createItem() {
    setEditItem(null);
    setFormData({});
    setOpenDialog(true);
  }

  function editRow(row) {
    setEditItem(row);
    setFormData({ ...row });
    setOpenDialog(true);
  }

  async function deleteRow(id) {
    if (!window.confirm("هل أنت متأكد من الحذف؟")) return;
    try {
      setLoading(true);
      await api.delete(`${API[kind]}${id}/`);
      setOkMsg("تم الحذف بنجاح");
      loadItems();
    } catch (e) {
      setError(e?.response?.data?.detail || "فشل الحذف");
    } finally {
      setLoading(false);
    }
  }

  async function saveItem() {
    try {
      setLoading(true);
      const isEdit = !!editItem;
      const url = isEdit ? `${API[kind]}${editItem.id}/` : API[kind];
      const method = isEdit ? "put" : "post";

      const payload = buildPayload(formData, kind);

      // If creating allergen/additive, ensure kind is set
      if (!isEdit && (kind === "allergens" || kind === "additives")) {
        payload.kind = kind === "allergens" ? "ALLERGEN" : "ADDITIVE";
      }

      await api[method](url, payload);
      setOkMsg("تم الحفظ بنجاح");
      setOpenDialog(false);
      loadItems();
    } catch (e) {
      console.error(e);
      setError(e?.response?.data?.detail || "فشل الحفظ");
    } finally {
      setLoading(false);
    }
  }

  // Helpers
  function buildPayload(data, k) {
    const out = { ...data };
    if (k === "lexemes") {
      // Ensure ingredient is null if empty or dash
      if (!out.ingredient || out.ingredient === "-" || out.ingredient.trim() === "") {
        out.ingredient = null;
      }
      // Ensure allergens is array of codes
      if (typeof out.allergens === 'string') {
        out.allergens = out.allergens.split(",").map(s => s.trim()).filter(Boolean);
      }
    } else if (k === "ingredients") {
      if (typeof out.allergens === 'string') {
        out.allergens = out.allergens.split(",").map(s => s.trim()).filter(Boolean);
      }
    }
    return out;
  }

  // Render
  return (
    <Box p={3} dir="rtl">
      <Typography variant="h4" gutterBottom>
        إدارة الحساسيّات والمكوّنات
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {okMsg && <Alert severity="success" sx={{ mb: 2 }}>{okMsg}</Alert>}

      <Paper sx={{ mb: 2 }}>
        <Tabs
          value={tabIndex}
          onChange={(e, v) => setTabIndex(v)}
          indicatorColor="primary"
          textColor="primary"
          variant="scrollable"
          scrollButtons="auto"
        >
          <Tab label="Allergens (A-N)" />
          <Tab label="Additives (E-Nummern)" />
          <Tab label="Lexemes (المعجم)" />
          <Tab label="Ingredients (المكوّنات)" />
        </Tabs>
      </Paper>

      <Box display="flex" gap={2} mb={2} alignItems="center" flexWrap="wrap">
        <TextField
          label="بحث"
          size="small"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          sx={{ width: 300 }}
        />
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={createItem}
          disabled={loading}
        >
          إضافة جديد
        </Button>
        <Button
          startIcon={<RefreshIcon />}
          onClick={loadItems}
          disabled={loading}
        >
          تحديث
        </Button>

        {(kind === "lexemes" || kind === "ingredients") && (
          <FormControlLabel
            control={<Switch checked={showAdvanced} onChange={(e) => setShowAdvanced(e.target.checked)} />}
            label="Advanced Settings"
          />
        )}

        <Box flexGrow={1} />

        {kind === "lexemes" && (
          <>
            <Button startIcon={<DownloadIcon />} onClick={onLexemesExport}>CSV Export</Button>
            <Button component="label" startIcon={<UploadIcon />}>
              CSV Import
              <input type="file" hidden onChange={(e) => onLexemesImport(e.target.files[0])} accept=".csv" />
            </Button>
          </>
        )}
        {kind === "ingredients" && (
          <>
            <Button startIcon={<DownloadIcon />} onClick={onIngredientsExport}>CSV Export</Button>
            <Button component="label" startIcon={<UploadIcon />}>
              CSV Import
              <input type="file" hidden onChange={(e) => onIngredientsImport(e.target.files[0])} accept=".csv" />
            </Button>
          </>
        )}
      </Box>

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead sx={{ bgcolor: "#f5f5f5" }}>
            <TableRow>
              {(kind === "allergens" || kind === "additives") && (
                <>
                  <TableCell>Code</TableCell>
                  <TableCell>Name (DE)</TableCell>
                  <TableCell>Actions</TableCell>
                </>
              )}
              {kind === "lexemes" && (
                <>
                  <TableCell>Term</TableCell>
                  <TableCell>Lang</TableCell>
                  <TableCell>Ingredient</TableCell>
                  <TableCell>Allergens</TableCell>
                  {showAdvanced && <TableCell>Priority</TableCell>}
                  <TableCell>Actions</TableCell>
                </>
              )}
              {kind === "ingredients" && (
                <>
                  <TableCell>Name (DE)</TableCell>
                  <TableCell>Synonyms</TableCell>
                  <TableCell>Allergens</TableCell>
                  <TableCell>Actions</TableCell>
                </>
              )}
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} align="center">
                  <CircularProgress size={24} />
                </TableCell>
              </TableRow>
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center">
                  لا توجد بيانات
                </TableCell>
              </TableRow>
            ) : (
              items.map((row) => (
                <TableRow key={row.id}>
                  {(kind === "allergens" || kind === "additives") && (
                    <>
                      <TableCell><Chip label={row.code} size="small" color={kind === "allergens" ? "primary" : "secondary"} /></TableCell>
                      <TableCell>{row.name_de}</TableCell>
                      <TableCell>
                        <IconButton size="small" onClick={() => editRow(row)}><EditIcon /></IconButton>
                        <IconButton size="small" color="error" onClick={() => deleteRow(row.id)}><DeleteIcon /></IconButton>
                      </TableCell>
                    </>
                  )}
                  {kind === "lexemes" && (
                    <>
                      <TableCell>{row.term}</TableCell>
                      <TableCell>{row.lang}</TableCell>
                      <TableCell>{row.ingredient || "-"}</TableCell>
                      <TableCell>
                        {Array.isArray(row.allergens) && row.allergens.map(c => (
                          <Chip key={c} label={c} size="small" style={{ marginRight: 2 }} />
                        ))}
                      </TableCell>
                      {showAdvanced && <TableCell>{row.priority}</TableCell>}
                      <TableCell>
                        <IconButton size="small" onClick={() => editRow(row)}><EditIcon /></IconButton>
                        <IconButton size="small" color="error" onClick={() => deleteRow(row.id)}><DeleteIcon /></IconButton>
                      </TableCell>
                    </>
                  )}
                  {kind === "ingredients" && (
                    <>
                      <TableCell>{row.name}</TableCell>
                      <TableCell>{Array.isArray(row.synonyms) ? row.synonyms.join(", ") : row.synonyms}</TableCell>
                      <TableCell>
                        {Array.isArray(row.allergens) && row.allergens.map(c => (
                          <Chip key={c} label={c} size="small" style={{ marginRight: 2 }} />
                        ))}
                      </TableCell>
                      <TableCell>
                        <IconButton size="small" onClick={() => editRow(row)}><EditIcon /></IconButton>
                        <IconButton size="small" color="error" onClick={() => deleteRow(row.id)}><DeleteIcon /></IconButton>
                      </TableCell>
                    </>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Dialog */}
      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editItem ? "تعديل" : "إضافة جديد"}</DialogTitle>
        <DialogContent>
          {(kind === "allergens" || kind === "additives") && (
            <>
              <TextField
                label="Code"
                fullWidth
                margin="normal"
                value={formData.code || ""}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
              />
              <TextField
                label="Name (DE)"
                fullWidth
                margin="normal"
                value={formData.name_de || ""}
                onChange={(e) => setFormData({ ...formData, name_de: e.target.value })}
              />
            </>
          )}
          {kind === "lexemes" && (
            <>
              <TextField
                label="Term"
                fullWidth
                margin="normal"
                value={formData.term || ""}
                onChange={(e) => setFormData({ ...formData, term: e.target.value })}
              />
              <TextField
                label="Ingredient (Name)"
                fullWidth
                margin="normal"
                value={formData.ingredient || ""}
                onChange={(e) => setFormData({ ...formData, ingredient: e.target.value })}
                helperText="اختياري: اسم المكوّن المرتبط"
              />
              <TextField
                label="Allergens (Codes)"
                fullWidth
                margin="normal"
                value={Array.isArray(formData.allergens) ? formData.allergens.join(",") : formData.allergens || ""}
                onChange={(e) => setFormData({ ...formData, allergens: e.target.value })}
                helperText="مفصولة بفواصل، مثال: A, G, 1"
              />
              {showAdvanced && (
                <>
                  <TextField
                    label="Priority"
                    type="number"
                    fullWidth
                    margin="normal"
                    value={formData.priority || 0}
                    onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) || 0 })}
                  />
                  <FormControlLabel
                    control={
                      <Switch
                        checked={formData.is_regex || false}
                        onChange={(e) => setFormData({ ...formData, is_regex: e.target.checked })}
                      />
                    }
                    label="Is Regex?"
                  />
                </>
              )}
            </>
          )}
          {kind === "ingredients" && (
            <>
              <TextField
                label="Name (DE)"
                fullWidth
                margin="normal"
                value={formData.name || ""}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
              <TextField
                label="Synonyms"
                fullWidth
                margin="normal"
                multiline
                rows={2}
                value={Array.isArray(formData.synonyms) ? formData.synonyms.join("\n") : formData.synonyms || ""}
                onChange={(e) => setFormData({ ...formData, synonyms: e.target.value.split("\n") })}
                helperText="كل مرادف في سطر جديد"
              />
              <TextField
                label="Allergens (Codes)"
                fullWidth
                margin="normal"
                value={Array.isArray(formData.allergens) ? formData.allergens.join(",") : formData.allergens || ""}
                onChange={(e) => setFormData({ ...formData, allergens: e.target.value })}
                helperText="مفصولة بفواصل، مثال: A, G, 1"
              />
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>إلغاء</Button>
          <Button onClick={saveItem} variant="contained">حفظ</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
