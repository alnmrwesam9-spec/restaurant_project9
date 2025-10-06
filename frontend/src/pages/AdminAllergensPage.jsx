import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import api from "../services/axios";


// Debounce helper
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

  // ✅ الحالة الجديدة للرفع إلى القاموس العام (للإضافات فقط)
  const [uploadToGlobal, setUploadToGlobal] = useState(false);

  // بحث وترتيب
  const [q, setQ] = useState("");
  const debouncedQ = useDebouncedValue(q, 450);
  const [ordering, setOrdering] = useState("code");

  // نموذج
  const [form, setForm] = useState({ code: "", name_de: "", name_en: "", name_ar: "" });
  const [editId, setEditId] = useState(null);
  const onFormChange = (k, v) => setForm((s) => ({ ...s, [k]: v }));

  // ====== أنواع الجداول (مُحدَّثة) ======
  const [kind, setKind] = useState("allergens"); // "additives" | "lexemes" | "ingredients"
  const KIND_OPTS = [
    { value: "allergens", label: "الحساسيّات" },
    { value: "additives", label: "الإضافات (E)" },
    { value: "lexemes",   label: "المعجم النصّي" },
    { value: "ingredients", label: "المكوّنات" },
  ];

  const isAllergen = kind === "allergens";
  const isAdditive = kind === "additives";
  const isLexeme   = kind === "lexemes";
  const isIngredient = kind === "ingredients";

  // ====== خرائط نقاط النهاية ======
  const API = {
    allergens:   "/allergens/codes/",
    additives:   "/additives/codes/",
    lexemes:     "/lexemes/",
    ingredients: "/ingredients/",
  };
  const CSV = {
    lexemes:   { export: "/lexemes/export/",   import: "/lexemes/import/" },
    // لاحقًا يمكن نضيف لـ ingredients عند الحاجة
  };

  // مُساعد مسار نهائي للأنواع التي تدعم CRUD القديم (allergens/additives)
  const ep = useCallback((suffix = "") => `${API[kind]}${suffix}`, [API, kind]);

  // خريطة ترتيب عند الإضافات
  const mapOrdering = useCallback(
    (o) => {
      if (!isAdditive) return o;
      const m = {
        code: "number",
        "-code": "-number",
        name_de: "label_de",
        "-name_de": "-label_de",
        name_en: "label_en",
        "-name_en": "-label_en",
        name_ar: "label_ar",
        "-name_ar": "-label_ar",
      };
      return m[o] || o;
    },
    [isAdditive]
  );

  const hasAuth = !!api.defaults.headers?.common?.Authorization;

  // ربط المسار بالنوع
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
    // لو عندك روتات لكل نوع
    const to = `/admin/${k}`;
    navigate(to, { replace: true });
  };

  // لتجنّب حالة "الطلب القديم يكتب فوق الجديد"
  const reqIdRef = useRef(0);

  // ====== الجلب الديناميكي حسب النوع (بديل load السابق) ======
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

      // results أو مصفوفة
      const arr = Array.isArray(data?.results)
        ? data.results
        : (Array.isArray(data) ? data : (data?.results || []));

      setItems(arr);
    } catch (e) {
      if (myReqId !== reqIdRef.current) return;
      setError(e?.response?.data?.detail || e.message || "خطأ أثناء الجلب");
    } finally {
      if (myReqId === reqIdRef.current) setBusy(false);
    }
  }
  useEffect(() => { loadItems(); }, [kind, debouncedQ, ordering]); // الجلب عند تغيّر النوع/البحث/الترتيب

  // ====== CSV للـ Lexemes ======
  function onLexemesExport() {
    setError("");
    setOkMsg("");
    api.get(CSV.lexemes.export, { responseType: "blob" })
      .then(res => {
        const blob = new Blob([res.data], { type: "text/csv;charset=utf-8" });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = "lexemes.csv"; a.click();
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
    // إن أردت الاستيراد لمالك معيّن:
    // fd.append("owner", currentOwnerId || "");
    try {
      setBusy(true);
      await api.post(CSV.lexemes.import, fd, { headers: { "Content-Type": "multipart/form-data" } });
      setOkMsg("تم استيراد المعجم بنجاح");
      await loadItems();
    } catch {
      setError("فشل استيراد CSV");
    } finally { setBusy(false); }
  }

  // ====== تصدير CSV (لـ allergens/additives فقط كما كان) ======
  const exportCSV = async () => {
    setError("");
    setOkMsg("");
    if (!hasAuth) {
      setError("الرجاء تسجيل الدخول كمشرف.");
      return;
    }
    try {
      const res = await api.get(ep("export/"), { responseType: "blob" });
      const blob = new Blob([res.data], { type: "text/csv;charset=utf-8" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${isAllergen ? "allergens" : "additives"}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      setError(e?.response?.data?.detail || e.message || "فشل التصدير");
    }
  };

  // ====== رفع CSV (لـ allergens/additives فقط كما كان) ======
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

      // ✅ نضيف ?global=1 فقط للإضافات
      const qs = !isAllergen && uploadToGlobal ? "?global=1" : "";

      const { data } = await api.post(ep(`bulk-upload/${qs}`), fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setOkMsg(`تم: أُضيف ${data.created || 0} وتحدّث ${data.updated || 0} وتخطّى ${data.skipped || 0}.`);
      setFile(null); // تنظيف
      await loadItems();
    } catch (e) {
      setError(e?.response?.data?.detail || e.message || "فشل الرفع");
    } finally {
      setBusy(false);
    }
  };

  // ====== CRUD (لـ allergens/additives فقط كما كان) ======
  const createItem = async () => {
    setError("");
    if (!form.code.trim()) {
      setError("أدخل الكود");
      return;
    }
    try {
      setBusy(true);
      // ✅ نضيف ?global=1 فقط للإضافات
      const qs = !isAllergen && uploadToGlobal ? "?global=1" : "";
      await api.post(ep(``), buildPayload(form, isAllergen), { headers: { "Content-Type": "application/json" } });
      // ملاحظة: في الكود القديم كنت ترسل ep("codes/")، والآن API[kind] = "/.../codes/" بالفعل
      // لذا الإرسال لـ ep(``) يكافئ "/.../codes/"

      setForm({ code: "", name_de: "", name_en: "", name_ar: "" });
      await loadItems();
    } catch (e) {
      setError(e?.response?.data?.detail || e.message || "فشل الإضافة");
    } finally {
      setBusy(false);
    }
  };

  const startEdit = (x) => {
    setEditId(x.id);
    setForm({
      code: x.code ?? x.number ?? "",
      name_de: x.name_de ?? x.label_de ?? "",
      name_en: x.name_en ?? x.label_en ?? "",
      name_ar: x.name_ar ?? x.label_ar ?? "",
    });
  };

  const saveEdit = async () => {
    if (!editId) return;
    setError("");
    try {
      setBusy(true);
      // ⚠️ لا نضيف global=1 للتعديل حسب السياسة
      await api.put(ep(`${editId}/`), buildPayload(form, isAllergen));
      setEditId(null);
      setForm({ code: "", name_de: "", name_en: "", name_ar: "" });
      await loadItems();
    } catch (e) {
      setError(e?.response?.data?.detail || e.message || "فشل التعديل");
    } finally {
      setBusy(false);
    }
  };

  const cancelEdit = () => {
    setEditId(null);
    setForm({ code: "", name_de: "", name_en: "", name_ar: "" });
  };

  const delItem = async (id) => {
    if (!window.confirm("حذف هذا الكود؟")) return;
    try {
      setBusy(true);
      setError("");
      // ⚠️ لا نضيف global=1 للحذف حسب السياسة
      await api.delete(ep(`${id}/`));
      await loadItems();
    } catch (e) {
      setError(e?.response?.data?.detail || e.message || "فشل الحذف");
    } finally {
      setBusy(false);
    }
  };

  // ====== أدوات تحويل البيانات (لـ allergens/additives كما في القديم) ======
  const buildPayload = (data, isAllergenLocal) => {
    if (isAllergenLocal) return data;
    // إن كان الـ API يتوقع number/label_* (للإضافات)
    return {
      number: data.code,
      label_de: data.name_de || "",
      label_en: data.name_en || "",
      label_ar: data.name_ar || "",
    };
  };

  // ====== جداول العرض حسب النوع ======
  function renderHeader() {
    if (isAllergen) return (<tr><th>الكود</th><th>الاسم (DE)</th><th>الاسم (EN)</th><th>الاسم (AR)</th><th>إجراءات</th></tr>);
    if (isAdditive) return (<tr><th>الكود</th><th>الاسم (EN)</th><th>الاسم (DE)</th><th>الاسم (AR)</th><th>إجراءات</th></tr>);
    if (isLexeme)   return (<tr><th>lang</th><th>term</th><th>is_regex</th><th>allergens_ids</th><th>ingredient_id</th><th>active</th><th>priority</th><th>weight</th></tr>);
    if (isIngredient) return (<tr><th>name</th><th>allergens_ids</th><th>additives</th><th>synonyms</th></tr>);
    return null;
  }

  function renderRow(it) {
    if (isAllergen) {
      return (
        <tr key={it.id}>
          {editId === it.id ? (
            <>
              <td><input value={form.code} onChange={(e) => onFormChange("code", e.target.value)} /></td>
              <td><input value={form.name_de} onChange={(e) => onFormChange("name_de", e.target.value)} /></td>
              <td><input value={form.name_en} onChange={(e) => onFormChange("name_en", e.target.value)} /></td>
              <td><input value={form.name_ar} onChange={(e) => onFormChange("name_ar", e.target.value)} /></td>
              <td>
                <button onClick={saveEdit} disabled={busy}>حفظ</button>
                <button onClick={cancelEdit} disabled={busy} style={{ marginInlineStart: 8 }}>إلغاء</button>
              </td>
            </>
          ) : (
            <>
              <td>{it.code}</td>
              <td>{it.name_de}</td>
              <td>{it.name_en}</td>
              <td>{it.name_ar}</td>
              <td>
                <button onClick={() => startEdit(it)} disabled={busy}>تعديل</button>
                <button onClick={() => delItem(it.id)} disabled={busy} style={{ marginInlineStart: 8 }}>حذف</button>
              </td>
            </>
          )}
        </tr>
      );
    }

    if (isAdditive) {
      const displayCode = it.code || it.number;
      const de = it.name_de ?? it.label_de;
      const en = it.name_en ?? it.label_en;
      const ar = it.name_ar ?? it.label_ar;
      return (
        <tr key={it.id || it.number}>
          {editId === it.id ? (
            <>
              <td><input value={form.code} onChange={(e) => onFormChange("code", e.target.value)} /></td>
              <td><input value={form.name_en} onChange={(e) => onFormChange("name_en", e.target.value)} /></td>
              <td><input value={form.name_de} onChange={(e) => onFormChange("name_de", e.target.value)} /></td>
              <td><input value={form.name_ar} onChange={(e) => onFormChange("name_ar", e.target.value)} /></td>
              <td>
                <button onClick={saveEdit} disabled={busy}>حفظ</button>
                <button onClick={cancelEdit} disabled={busy} style={{ marginInlineStart: 8 }}>إلغاء</button>
              </td>
            </>
          ) : (
            <>
              <td>{displayCode}</td>
              <td>{en}</td>
              <td>{de}</td>
              <td>{ar}</td>
              <td>
                <button onClick={() => startEdit(it)} disabled={busy}>تعديل</button>
                <button onClick={() => delItem(it.id)} disabled={busy} style={{ marginInlineStart: 8 }}>حذف</button>
              </td>
            </>
          )}
        </tr>
      );
    }

    if (isLexeme) {
      return (
        <tr key={it.id}>
          <td>{it.lang}</td>
          <td>{it.term}</td>
          <td>{it.is_regex ? "✓" : ""}</td>
          <td>{(it.allergens || []).join(",")}</td>
          <td>{it.ingredient || it.ingredient_id || ""}</td>
          <td>{it.is_active ? "✓" : ""}</td>
          <td>{it.priority ?? 0}</td>
          <td>{it.weight ?? 0}</td>
        </tr>
      );
    }

    if (isIngredient) {
      return (
        <tr key={it.id}>
          <td>{it.name}</td>
          <td>{(it.allergens || []).join(",")}</td>
          <td>{Array.isArray(it.additives) ? it.additives.join(",") : (it.additives || "")}</td>
          <td>{typeof it.synonyms === "string" ? it.synonyms : JSON.stringify(it.synonyms || [])}</td>
        </tr>
      );
    }

    return null;
  }

  // عناوين الأعمدة القديمة لم تعد ضرورية لكن لو أردت استخدامها لمرجعية
  const cols = useMemo(
    () => [
      { key: "code", label: "الكود" },
      { key: "name_en", label: "الاسم (EN)" },
      { key: "name_de", label: "(DE) الاسم" },
      { key: "name_ar", label: "(AR) الاسم" },
    ],
    []
  );

  return (
    <div className="container" style={{ padding: 16 }}>
      {/* مُبدّل النوع (Dropdown) */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12, alignItems: "center" }}>
        <select value={kind} onChange={(e)=>switchKind(e.target.value)}>
          {KIND_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <h2 style={{ margin: 0 }}>
          إدارة {isAllergen ? "أكواد الحساسية" : isAdditive ? "الإضافات (E-Numbers)" : isLexeme ? "المعجم النصّي" : "المكوّنات"}
        </h2>
      </div>

      {error && (
        <div style={{ background: "#fee", color: "#900", padding: 12, borderRadius: 8, marginBottom: 12 }}>
          {error}
        </div>
      )}

      {okMsg && (
        <div style={{ background: "#eefaf0", color: "#075d2d", padding: 12, borderRadius: 8, marginBottom: 12 }}>
          {okMsg}
        </div>
      )}

      {/* شريط الأدوات */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12, alignItems: "center", flexWrap: "wrap" }}>
        {/* أدوات CSV للأنواع القديمة */}
        {(isAllergen || isAdditive) && (
          <form onSubmit={upload} style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              type="file"
              accept=".csv"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              value={file ? undefined : ""} // إعادة الضبط المرئي بعد النجاح
            />
            <button type="submit" disabled={busy}>رفع CSV</button>
            <button type="button" onClick={exportCSV} disabled={busy}>CSV</button>

            {/* ✅ Checkbox يظهر فقط للإضافات */}
            {isAdditive && (
              <label style={{ marginInlineStart: 12 }}>
                <input
                  type="checkbox"
                  checked={uploadToGlobal}
                  onChange={(e) => setUploadToGlobal(e.target.checked)}
                />
                {" "}رفع إلى القاموس العام
              </label>
            )}
          </form>
        )}

        {/* أدوات CSV للـ Lexemes */}
        {isLexeme && (
          <div className="flex items-center gap-2" style={{ display: "flex", gap: 8 }}>
            <button onClick={onLexemesExport} disabled={busy}>CSV (تصدير)</button>
            <label style={{ display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
              رفع CSV
              <input
                type="file"
                accept=".csv"
                hidden
                onChange={e => e.target.files?.[0] && onLexemesImport(e.target.files[0])}
              />
            </label>
          </div>
        )}

        {/* تحكّم: بحث + ترتيب */}
        <div style={{ display: "flex", gap: 8, alignItems: "center", flex: 1, minWidth: 260 }}>
          <input
            type="text"
            placeholder="ابحث بالكود أو الاسم..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && loadItems()}
            style={{ padding: 8, flex: 1 }}
          />
          {/* خيارات الترتيب كما كانت؛ تعمل مع addtives عبر mapOrdering */}
          <select value={ordering} onChange={(e) => setOrdering(e.target.value)} style={{ padding: 8 }}>
            <option value="code">ترتيب: الكود ↑</option>
            <option value="-code">ترتيب: الكود ↓</option>
            <option value="name_de">الاسم DE ↑</option>
            <option value="-name_de">الاسم DE ↓</option>
            <option value="name_en">الاسم EN ↑</option>
            <option value="-name_en">الاسم EN ↓</option>
            <option value="name_ar">الاسم AR ↑</option>
            <option value="-name_ar">الاسم AR ↓</option>
          </select>
          <button type="button" onClick={loadItems} disabled={busy}>بحث</button>
        </div>
      </div>

      {/* سطر إدخال سريع — يظهر فقط للحساسيّات/الإضافات */}
      {(isAllergen || isAdditive) && (
        <div style={{ display: "grid", gridTemplateColumns: "120px 1fr 1fr 1fr auto", gap: 8, margin: "8px 0 12px" }}>
          <input placeholder="الكود *" value={form.code} onChange={(e) => onFormChange("code", e.target.value)} />
          <input placeholder="الاسم (DE)" value={form.name_de} onChange={(e) => onFormChange("name_de", e.target.value)} />
          <input placeholder="الاسم (EN)" value={form.name_en} onChange={(e) => onFormChange("name_en", e.target.value)} />
          <input placeholder="الاسم (AR)" value={form.name_ar} onChange={(e) => onFormChange("name_ar", e.target.value)} />
          <button type="button" onClick={createItem} disabled={busy}>إضافة</button>
        </div>
      )}

      {busy ? (
        <p>جارٍ التحميل…</p>
      ) : (
        <table border="1" cellPadding="8" style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>{renderHeader()}</thead>
          <tbody>
            {items.map((x) => renderRow(x))}
            {!items.length && (
              <tr>
                <td colSpan={(isAllergen || isAdditive) ? 5 : (isLexeme ? 8 : 4)} style={{ textAlign: "center" }}>
                  لا توجد بيانات
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
