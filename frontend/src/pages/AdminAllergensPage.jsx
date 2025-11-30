import React, { useEffect, useRef, useState, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import api from "../services/axios";

// ====== Debounce helper ======
function useDebouncedValue(value, delay = 400) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

export default function AdminAllergensPage() {
  const [items, setItems] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [okMsg, setOkMsg] = useState("");
  const [file, setFile] = useState(null);
  const [uploadToGlobal, setUploadToGlobal] = useState(false);

  // Search and ordering
  const [q, setQ] = useState("");
  const debouncedQ = useDebouncedValue(q, 450);
  const [ordering, setOrdering] = useState("code");

  // Form state - unified for all types
  const [form, setForm] = useState({ code: "", name_de: "", term: "", allergens: "", ingredient: "" });
  const [editId, setEditId] = useState(null);
  const onFormChange = (k, v) => setForm((s) => ({ ...s, [k]: v }));

  // Table type selector
  const [kind, setKind] = useState("allergens");
  const KIND_OPTS = [
    { value: "allergens", label: "الحساسيّات (Allergens)" },
    { value: "additives", label: "الإضافات (E-Numbers)" },
    { value: "lexemes", label: "المعجم النصّي (Lexemes)" },
    { value: "ingredients", label: "المكوّنات (Ingredients)" },
  ];

  const isAllergen = kind === "allergens";
  const isAdditive = kind === "additives";
  const isLexeme = kind === "lexemes";
  const isIngredient = kind === "ingredients";

  // Advanced settings toggle for Lexemes
  const [showAdvanced, setShowAdvanced] = useState(false);

  // API endpoints
  const API = {
    allergens: "/allergens/codes/",
    additives: "/additives/codes/",
    lexemes: "/lexemes/",
    ingredients: "/ingredients/",
  };

  const CSV = {
    lexemes: { export: "/lexemes/export/", import: "/lexemes/import/" },
    ingredients: { export: "/ingredients/export/", import: "/ingredients/bulk-upload/" },
  };

  const ep = useCallback((suffix = "") => `${API[kind]}${suffix}`, [kind]);

  const mapOrdering = useCallback(
    (o) => {
      if (!isAdditive) return o;
      const m = { code: "number", "-code": "-number", name_de: "label_de", "-name_de": "-label_de" };
      return m[o] || o;
    },
    [isAdditive]
  );

  const hasAuth = !!api.defaults.headers?.common?.Authorization;

  // Route-based kind switching
  const location = useLocation();
  const navigate = useNavigate();
  useEffect(() => {
    const p = location.pathname;
    if (p.includes("/admin/additives")) setKind("additives");
    else if (p.includes("/admin/lexemes")) setKind("lexemes");
    else if (p.includes("/admin/ingredients")) setKind("ingredients");
    else setKind("allergens");
  }, [location.pathname]);

  const switchKind = (k) => {
    setKind(k);
    navigate(`/admin/${k}`, { replace: true });
    setQ("");
    setForm({ code: "", name_de: "", term: "", allergens: "", ingredient: "" });
    setEditId(null);
  };

  const reqIdRef = useRef(0);

  // Load items
  async function loadItems() {
    setError("");
    setOkMsg("");
    if (!hasAuth) {
      setError("الرجاء تسجيل الدخول كمشرف أولًا.");
      return;
    }
    const myReqId = ++reqIdRef.current;
    try {
      setBusy(true);
      const mappedOrdering = isAdditive ? mapOrdering(ordering) : ordering;
      const url = `${API[kind]}?q=${encodeURIComponent(debouncedQ || "")}&ordering=${encodeURIComponent(mappedOrdering || "")}`;
      const { data } = await api.get(url);
      if (myReqId !== reqIdRef.current) return;
      const arr = Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : data?.results || [];
      setItems(arr);
    } catch (e) {
      if (myReqId !== reqIdRef.current) return;
      setError(e?.response?.data?.detail || e.message || "خطأ أثناء الجلب");
    } finally {
      if (myReqId === reqIdRef.current) setBusy(false);
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
      setBusy(true);
      await api.post(CSV.lexemes.import, fd, { headers: { "Content-Type": "multipart/form-data" } });
      setOkMsg("تم استيراد المعجم بنجاح");
      await loadItems();
    } catch {
      setError("فشل استيراد CSV");
    } finally {
      setBusy(false);
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
      setBusy(true);
      await api.post(CSV.ingredients.import, fd, { headers: { "Content-Type": "multipart/form-data" } });
      setOkMsg("تم استيراد المكوّنات بنجاح");
      await loadItems();
    } catch {
      setError("فشل استيراد CSV");
    } finally {
      setBusy(false);
    }
  }

  const exportCSV = async () => {
    setError("");
    setOkMsg("");
    if (!hasAuth) {
      setError("الرجاء تسجيل الدخول كمشرف.");
      return;
    }
    try {
      const url = isAllergen ? "/allergens/export/" : "/additives/export/";
      const res = await api.get(url, { responseType: "blob" });
      const blob = new Blob([res.data], { type: "text/csv;charset=utf-8" });
      const objUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objUrl;
      a.download = `${isAllergen ? "allergens" : "additives"}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(objUrl);
    } catch (e) {
      setError(e?.response?.data?.detail || e.message || "فشل التصدير");
    }
  };

  const upload = async (e) => {
    e.preventDefault();
    setError("");
    setOkMsg("");
    if (!hasAuth) {
      setError("الرجاء تسجيل الدخول كمشرف.");
      return;
    }
    if (!file) {
      setError("اختر ملف CSV أولًا.");
      return;
    }
    try {
      setBusy(true);
      const fd = new FormData();
      fd.append("file", file);
      const qs = !isAllergen && uploadToGlobal ? "?global=1" : "";
      const url = isAllergen ? "/allergens/bulk-upload/" : "/additives/bulk-upload/";
      const { data } = await api.post(url + qs, fd, { headers: { "Content-Type": "multipart/form-data" } });
      setOkMsg(`تم: أُضيف ${data.created || 0} وتحدّث ${data.updated || 0} وتخطّى ${data.skipped || 0}.`);
      setFile(null);
      await loadItems();
    } catch (e) {
      setError(e?.response?.data?.detail || e.message || "فشل الرفع");
    } finally {
      setBusy(false);
    }
  };

  // Build payload for different types
  const buildPayload = (data, currentKind) => {
    if (currentKind === "allergens") {
      return { code: data.code, label_de: data.name_de };
    }
    if (currentKind === "additives") {
      return { number: data.code, label_de: data.name_de || "" };
    }
    if (currentKind === "lexemes") {
      const codes = data.allergens ? data.allergens.split(",").map(c => c.trim()).filter(Boolean) : [];
      return {
        term: data.term,
        lang: "de",
        allergens: codes,
        ingredient: data.ingredient || null,
        is_active: true,
      };
    }
    if (currentKind === "ingredients") {
      const codes = data.allergens ? data.allergens.split(",").map(c => c.trim()).filter(Boolean) : [];
      return { name: data.term, allergens: codes };
    }
    return {};
  };

  const createItem = async () => {
    setError("");
    if ((isAllergen || isAdditive) && !form.code.trim()) {
      setError("أدخل الكود");
      return;
    }
    if ((isLexeme || isIngredient) && !form.term.trim()) {
      setError("أدخل المصطلح/الاسم");
      return;
    }
    try {
      setBusy(true);
      await api.post(ep(``), buildPayload(form, kind), { headers: { "Content-Type": "application/json" } });
      setForm({ code: "", name_de: "", term: "", allergens: "", ingredient: "" });
      await loadItems();
    } catch (e) {
      setError(e?.response?.data?.detail || e.message || "فشل الإضافة");
    } finally {
      setBusy(false);
    }
  };

  const startEdit = (x) => {
    setEditId(x.id);
    if (isAllergen) {
      setForm({ code: x.code, name_de: x.name_de, term: "", allergens: "", ingredient: "" });
    } else if (isAdditive) {
      setForm({ code: x.code ?? x.number, name_de: x.name_de ?? x.label_de, term: "", allergens: "", ingredient: "" });
    } else if (isLexeme) {
      setForm({
        code: "",
        name_de: "",
        term: x.term,
        allergens: (x.allergens || []).join(", "),
        ingredient: x.ingredient || "",
      });
    } else if (isIngredient) {
      setForm({
        code: "",
        name_de: "",
        term: x.name,
        allergens: (x.allergens || []).join(", "),
        ingredient: "",
      });
    }
  };

  const saveEdit = async () => {
    if (!editId) return;
    setError("");
    try {
      setBusy(true);
      await api.put(ep(`${editId}/`), buildPayload(form, kind));
      setEditId(null);
      setForm({ code: "", name_de: "", term: "", allergens: "", ingredient: "" });
      await loadItems();
    } catch (e) {
      setError(e?.response?.data?.detail || e.message || "فشل التعديل");
    } finally {
      setBusy(false);
    }
  };

  const cancelEdit = () => {
    setEditId(null);
    setForm({ code: "", name_de: "", term: "", allergens: "", ingredient: "" });
  };

  const delItem = async (id) => {
    if (!window.confirm("حذف هذا العنصر؟")) return;
    try {
      setBusy(true);
      setError("");
      await api.delete(ep(`${id}/`));
      await loadItems();
    } catch (e) {
      setError(e?.response?.data?.detail || e.message || "فشل الحذف");
    } finally {
      setBusy(false);
    }
  };

  // Render table headers
  function renderHeader() {
    if (isAllergen)
      return (
        <tr>
          <th>الكود</th>
          <th>الاسم (DE)</th>
          <th>إجراءات</th>
        </tr>
      );
    if (isAdditive)
      return (
        <tr>
          <th>الكود</th>
          <th>الاسم (DE)</th>
          <th>إجراءات</th>
        </tr>
      );
    if (isLexeme)
      return (
        <tr>
          <th>المصطلح (Term)</th>
          <th>الحساسيات (Codes)</th>
          <th>المكون (Ingredient)</th>
          {showAdvanced && (
            <>
              <th>Regex?</th>
              <th>Active?</th>
              <th>Priority</th>
              <th>Weight</th>
            </>
          )}
          <th>إجراءات</th>
        </tr>
      );
    if (isIngredient)
      return (
        <tr>
          <th>الاسم (Name)</th>
          <th>الحساسيات (Codes)</th>
          <th>الإضافات (Additives)</th>
          <th>المرادفات (Synonyms)</th>
          <th>إجراءات</th>
        </tr>
      );
    return null;
  }

  // Render table rows
  function renderRow(it) {
    if (isAllergen) {
      return (
        <tr key={it.id}>
          {editId === it.id ? (
            <>
              <td>
                <input className="in" value={form.code} onChange={(e) => onFormChange("code", e.target.value)} />
              </td>
              <td>
                <input className="in" value={form.name_de} onChange={(e) => onFormChange("name_de", e.target.value)} />
              </td>
              <td className="row-actions">
                <button className="btn btn-primary" onClick={saveEdit} disabled={busy}>حفظ</button>
                <button className="btn" onClick={cancelEdit} disabled={busy}>إلغاء</button>
              </td>
            </>
          ) : (
            <>
              <td><span className="mono tag">{it.code}</span></td>
              <td>{it.name_de}</td>
              <td className="row-actions">
                <button className="btn btn-ghost" onClick={() => startEdit(it)} disabled={busy}>تعديل</button>
                <button className="btn btn-danger" onClick={() => delItem(it.id)} disabled={busy}>حذف</button>
              </td>
            </>
          )}
        </tr>
      );
    }

    if (isAdditive) {
      const displayCode = it.code || it.number;
      const de = it.name_de ?? it.label_de;
      return (
        <tr key={it.id || it.number}>
          {editId === it.id ? (
            <>
              <td>
                <input className="in" value={form.code} onChange={(e) => onFormChange("code", e.target.value)} />
              </td>
              <td>
                <input className="in" value={form.name_de} onChange={(e) => onFormChange("name_de", e.target.value)} />
              </td>
              <td className="row-actions">
                <button className="btn btn-primary" onClick={saveEdit} disabled={busy}>حفظ</button>
                <button className="btn" onClick={cancelEdit} disabled={busy}>إلغاء</button>
              </td>
            </>
          ) : (
            <>
              <td><span className="mono tag">E{String(displayCode).replace(/^E/i, "")}</span></td>
              <td>{de}</td>
              <td className="row-actions">
                <button className="btn btn-ghost" onClick={() => startEdit(it)} disabled={busy}>تعديل</button>
                <button className="btn btn-danger" onClick={() => delItem(it.id)} disabled={busy}>حذف</button>
              </td>
            </>
          )}
        </tr>
      );
    }

    if (isLexeme) {
      return (
        <tr key={it.id}>
          {editId === it.id ? (
            <>
              <td><input className="in" value={form.term} onChange={(e) => onFormChange("term", e.target.value)} /></td>
              <td><input className="in" value={form.allergens} onChange={(e) => onFormChange("allergens", e.target.value)} placeholder="A, G" /></td>
              <td><input className="in" value={form.ingredient} onChange={(e) => onFormChange("ingredient", e.target.value)} placeholder="Ingredient Name" /></td>
              {showAdvanced && <td colSpan={4}></td>}
              <td className="row-actions">
                <button className="btn btn-primary" onClick={saveEdit} disabled={busy}>حفظ</button>
                <button className="btn" onClick={cancelEdit} disabled={busy}>إلغاء</button>
              </td>
            </>
          ) : (
            <>
              <td className="mono">{it.term}</td>
              <td className="mono">{(it.allergens || []).join(", ")}</td>
              <td className="mono">{it.ingredient || "-"}</td>
              {showAdvanced && (
                <>
                  <td>{it.is_regex ? "✓" : ""}</td>
                  <td>{it.is_active ? "✓" : ""}</td>
                  <td className="mono">{it.priority ?? 0}</td>
                  <td className="mono">{it.weight ?? 0}</td>
                </>
              )}
              <td className="row-actions">
                <button className="btn btn-ghost" onClick={() => startEdit(it)} disabled={busy}>تعديل</button>
                <button className="btn btn-danger" onClick={() => delItem(it.id)} disabled={busy}>حذف</button>
              </td>
            </>
          )}
        </tr>
      );
    }

    if (isIngredient) {
      return (
        <tr key={it.id}>
          {editId === it.id ? (
            <>
              <td><input className="in" value={form.term} onChange={(e) => onFormChange("term", e.target.value)} /></td>
              <td><input className="in" value={form.allergens} onChange={(e) => onFormChange("allergens", e.target.value)} placeholder="A, G" /></td>
              <td colSpan={2}></td>
              <td className="row-actions">
                <button className="btn btn-primary" onClick={saveEdit} disabled={busy}>حفظ</button>
                <button className="btn" onClick={cancelEdit} disabled={busy}>إلغاء</button>
              </td>
            </>
          ) : (
            <>
              <td>{it.name}</td>
              <td className="mono">{(it.allergens || []).join(", ")}</td>
              <td className="mono">{Array.isArray(it.additives) ? it.additives.join(",") : it.additives || ""}</td>
              <td className="mono">{typeof it.synonyms === "string" ? it.synonyms : JSON.stringify(it.synonyms || [])}</td>
              <td className="row-actions">
                <button className="btn btn-ghost" onClick={() => startEdit(it)} disabled={busy}>تعديل</button>
                <button className="btn btn-danger" onClick={() => delItem(it.id)} disabled={busy}>حذف</button>
              </td>
            </>
          )}
        </tr>
      );
    }

    return null;
  }

  return (
    <div className="wrap" dir="rtl">
      <style>{`
        :root{
          --bg:#0b0f14; --card:#10161c; --card2:#0e141a; --muted:#9bb0c0; --text:#e9f1f7;
          --pri:#3b82f6; --pri-2:#2563eb; --ok:#16a34a; --err:#ef4444; --warn:#f59e0b; --line:#1f2a34;
          --chip:#132130; --chip-b:#26435b;
        }
        .wrap{padding:20px; color:var(--text); background:var(--bg); min-height:100vh; font-family:Inter, system-ui, -apple-system, Segoe UI, Roboto, "Noto Kufi Arabic", Arial;}
        .container{max-width:1200px; margin-inline:auto;}
        .toolbar{position:sticky; top:0; z-index:5; background:linear-gradient(180deg, rgba(11,15,20,0.95), rgba(11,15,20,0.85) 60%, rgba(11,15,20,0)); backdrop-filter: blur(6px); padding-bottom:8px; margin-bottom:12px; border-bottom:1px solid var(--line);}
        .bar{display:flex; gap:10px; align-items:center; flex-wrap:wrap; padding:10px;}
        .heading{display:flex; gap:10px; align-items:center; margin:0; font-weight:700;}
        select.sel, input.in, .search{background:var(--card); color:var(--text); border:1px solid var(--line); border-radius:10px; padding:8px 10px; outline:none;}
        select.sel:focus, input.in:focus{border-color:var(--pri); box-shadow:0 0 0 3px rgba(59,130,246,0.2);}
        .btn{background:var(--card2); color:var(--text); border:1px solid var(--line); padding:8px 12px; border-radius:10px; cursor:pointer; transition:.15s;}
        .btn:hover{transform:translateY(-1px); border-color:#2a3a48;}
        .btn:disabled{opacity:.6; cursor:not-allowed;}
        .btn-primary{background:linear-gradient(180deg, var(--pri), var(--pri-2)); border:0;}
        .btn-ghost{background:transparent; border-color:transparent;}
        .btn-danger{border-color:rgba(239,68,68,.35); color:#ffd5d5; background:rgba(239,68,68,.08);}
        .btn-danger:hover{background:rgba(239,68,68,.14);}
        .note{border-radius:12px; padding:12px 14px;}
        .ok{background:rgba(22,163,74,.1); border:1px solid rgba(22,163,74,.25); color:#d2f2dc;}
        .err{background:rgba(239,68,68,.08); border:1px solid rgba(239,68,68,.25); color:#ffd5d5;}
        .grid-quick{display:grid; grid-template-columns:1fr 1fr 1fr auto; gap:8px; margin:10px 0 12px;}
        @media (max-width: 800px){.grid-quick{grid-template-columns:1fr 1fr;} .grid-quick button{grid-column:1 / -1;}}
        .card{background:var(--card); border:1px solid var(--line); border-radius:14px;}
        .card.pad{padding:12px;}
        table.table{width:100%; border-collapse:separate; border-spacing:0; border:1px solid var(--line); border-radius:14px; overflow:hidden;}
        .table thead th{position:sticky; top:54px; background:linear-gradient(180deg, #0f1620, #0d141b); color:#cfe3f3; text-align:start; font-weight:700; padding:10px; border-bottom:1px solid var(--line);}
        .table tbody td{padding:10px; border-bottom:1px solid var(--line); vertical-align:middle;}
        .table tbody tr:hover{background:rgba(59,130,246,.06);}
        .table tbody tr:last-child td{border-bottom:0;}
        .mono{font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, "Courier New", monospace;}
        .tag{display:inline-block; padding:4px 8px; border-radius:999px; background:var(--chip); border:1px solid var(--chip-b);}
        .pill{display:inline-block; padding:2px 8px; border-radius:999px; background:rgba(245,158,11,.12); border:1px solid rgba(245,158,11,.35); color:#ffe6b3; font-size:.92em;}
        .row-actions{display:flex; gap:8px; align-items:center;}
        .spacer{flex:1;}
        .search-wrap{display:flex; gap:8px; align-items:center; min-width:260px; flex:1;}
        .search{flex:1;}
        .order{min-width:170px;}
        .subtools{display:flex; gap:8px; align-items:center; flex-wrap:wrap;}
        .skeleton{height:42px; border-radius:10px; background:linear-gradient(90deg, #0f1620, #0e141b, #0f1620); background-size:200% 100%; animation:shimmer 1.2s infinite; border:1px solid var(--line);}
        @keyframes shimmer{0%{background-position:200% 0} 100%{background-position:-200% 0}}
      `}</style>

      <div className="container">
        <div className="toolbar card">
          <div className="bar">
            <select className="sel" value={kind} onChange={(e) => switchKind(e.target.value)} aria-label="تبديل النوع">
              {KIND_OPTS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>

            <h2 className="heading">
              إدارة {isAllergen ? "أكواد الحساسية" : isAdditive ? "الإضافات (E-Numbers)" : isLexeme ? "المعجم النصّي" : "المكوّنات"}
            </h2>

            <div className="spacer" />

            {(isAllergen || isAdditive) && (
              <form onSubmit={upload} className="subtools" aria-label="أدوات CSV">
                <input className="in" type="file" accept=".csv" onChange={(e) => setFile(e.target.files?.[0] || null)} value={file ? undefined : ""} />
                <button className="btn btn-primary" type="submit" disabled={busy} title="رفع CSV">رفع CSV</button>
                <button className="btn" type="button" onClick={exportCSV} disabled={busy} title="تنزيل CSV">تنزيل CSV</button>
                {isAdditive && (
                  <label style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <input type="checkbox" checked={uploadToGlobal} onChange={(e) => setUploadToGlobal(e.target.checked)} />{" "}
                    رفع إلى القاموس العام
                  </label>
                )}
              </form>
            )}

            {isLexeme && (
              <div className="subtools">
                <button className="btn" onClick={onLexemesExport} disabled={busy}>CSV (تصدير)</button>
                <label className="btn" style={{ cursor: "pointer" }} title="رفع CSV">
                  رفع CSV
                  <input type="file" accept=".csv" hidden onChange={(e) => e.target.files?.[0] && onLexemesImport(e.target.files[0])} />
                </label>
                <label style={{ display: "inline-flex", alignItems: "center", gap: 6, marginInlineStart: 10 }}>
                  <input type="checkbox" checked={showAdvanced} onChange={(e) => setShowAdvanced(e.target.checked)} />
                  خيارات متقدمة
                </label>
              </div>
            )}

            {isIngredient && (
              <div className="subtools">
                <button className="btn" onClick={onIngredientsExport} disabled={busy}>CSV (تصدير)</button>
                <label className="btn" style={{ cursor: "pointer" }} title="رفع CSV">
                  رفع CSV
                  <input type="file" accept=".csv" hidden onChange={(e) => e.target.files?.[0] && onIngredientsImport(e.target.files[0])} />
                </label>
              </div>
            )}

            <div className="search-wrap">
              <input className="search" type="text" placeholder="ابحث بالكود أو الاسم (DE)..." value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && loadItems()} aria-label="حقل البحث" />
              <select className="sel order" value={ordering} onChange={(e) => setOrdering(e.target.value)}>
                <option value="code">ترتيب: الكود ↑</option>
                <option value="-code">ترتيب: الكود ↓</option>
                <option value="name_de">الاسم DE ↑</option>
                <option value="-name_de">الاسم DE ↓</option>
              </select>
              <button className="btn" type="button" onClick={loadItems} disabled={busy}>بحث</button>
            </div>
          </div>
        </div>

        {error && <div className="note err card pad" role="alert">{error}</div>}
        {okMsg && <div className="note ok card pad" role="status">{okMsg}</div>}

        <div className="card pad">
          <div className="grid-quick" style={{ gridTemplateColumns: (isLexeme || isIngredient) ? "1fr 1fr 1fr auto" : "120px 1fr auto" }}>
            {(isAllergen || isAdditive) && (
              <>
                <input className="in" placeholder="الكود *" value={form.code} onChange={(e) => onFormChange("code", e.target.value)} />
                <input className="in" placeholder="الاسم (DE)" value={form.name_de} onChange={(e) => onFormChange("name_de", e.target.value)} />
              </>
            )}
            {isLexeme && (
              <>
                <input className="in" placeholder="المصطلح (Term) *" value={form.term} onChange={(e) => onFormChange("term", e.target.value)} />
                <input className="in" placeholder="الحساسيات (A, G)" value={form.allergens} onChange={(e) => onFormChange("allergens", e.target.value)} />
                <input className="in" placeholder="المكون (Ingredient)" value={form.ingredient} onChange={(e) => onFormChange("ingredient", e.target.value)} />
              </>
            )}
            {isIngredient && (
              <>
                <input className="in" placeholder="الاسم (Name) *" value={form.term} onChange={(e) => onFormChange("term", e.target.value)} />
                <input className="in" placeholder="الحساسيات (A, G)" value={form.allergens} onChange={(e) => onFormChange("allergens", e.target.value)} />
                <div></div>
              </>
            )}
            <button className="btn btn-primary" type="button" onClick={createItem} disabled={busy}>إضافة</button>
          </div>
        </div>

        {busy ? (
          <div className="skeleton" aria-busy="true" aria-label="جارٍ التحميل"></div>
        ) : (
          <div className="card">
            <table className="table">
              <thead>{renderHeader()}</thead>
              <tbody>
                {items.map((x) => renderRow(x))}
                {!items.length && (
                  <tr>
                    <td colSpan={isAllergen || isAdditive ? 3 : isLexeme ? (showAdvanced ? 8 : 4) : 5} style={{ textAlign: "center", padding: 20 }}>
                      لا توجد بيانات
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
