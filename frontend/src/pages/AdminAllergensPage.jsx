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

  // بحث وترتيب
  const [q, setQ] = useState("");
  const debouncedQ = useDebouncedValue(q, 450);
  const [ordering, setOrdering] = useState("code");

  // نموذج
  const [form, setForm] = useState({ code: "", name_de: "", name_en: "", name_ar: "" });
  const [editId, setEditId] = useState(null);
  const onFormChange = (k, v) => setForm((s) => ({ ...s, [k]: v }));

  // نوع الجدول
  const [kind, setKind] = useState("allergens"); // "allergens" | "additives"
  const isAllergen = kind === "allergens";
  const ep = useCallback((suffix) => `/${kind}/${suffix}`, [kind]);

  // لو الإضافات تستخدم number/label_* بدال code/name_* نطبّع المفاتيح
  const normalizeItem = useCallback(
    (raw) => {
      if (isAllergen) return raw;
      // حاول اكتشاف الشكل
      const code = raw.code ?? raw.number ?? "";
      const name_en = raw.name_en ?? raw.label_en ?? "";
      const name_de = raw.name_de ?? raw.label_de ?? "";
      const name_ar = raw.name_ar ?? raw.label_ar ?? "";
      return { ...raw, code, name_en, name_de, name_ar };
    },
    [isAllergen]
  );

  // عكس التطبيع للـ payload قبل الإرسال لو كنا بالإضافات
  const buildPayload = useCallback(
    (data) => {
      if (isAllergen) return data;
      // إن كان الـ API يتوقع number/label_*
      return {
        number: data.code,
        label_de: data.name_de || "",
        label_en: data.name_en || "",
        label_ar: data.name_ar || "",
      };
    },
    [isAllergen]
  );

  // خريطة ترتيب عند الإضافات
  const mapOrdering = useCallback(
    (o) => {
      if (kind !== "additives") return o;
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
    [kind]
  );

  const hasAuth = !!api.defaults.headers?.common?.Authorization;

  // ربط المسار بالنوع
  const location = useLocation();
  const navigate = useNavigate();
  useEffect(() => {
    if (location.pathname.includes("/admin/additives")) setKind("additives");
    else setKind("allergens");
  }, [location.pathname]);

  const switchKind = (k) => {
    setKind(k);
    navigate(k === "additives" ? "/admin/additives" : "/admin/allergens", { replace: true });
  };

  // لتجنّب حالة "الطلب القديم يكتب فوق الجديد"
  const reqIdRef = useRef(0);

  const load = useCallback(async () => {
    setError("");
    setOkMsg("");
    if (!hasAuth) {
      setError("الرجاء تسجيل الدخول كمشرف أولًا.");
      return;
    }
    const myReqId = ++reqIdRef.current;
    try {
      setBusy(true);
      const { data } = await api.get(ep("codes/"), {
        params: { q: debouncedQ || undefined, ordering: mapOrdering(ordering) },
      });
      if (myReqId !== reqIdRef.current) return; // تجاهل نتيجة قديمة
      const arr = Array.isArray(data) ? data : data.results || [];
      setItems(arr.map(normalizeItem));
    } catch (e) {
      if (myReqId !== reqIdRef.current) return;
      setError(e?.response?.data?.detail || e.message || "فشل الجلب");
    } finally {
      if (myReqId === reqIdRef.current) setBusy(false);
    }
  }, [debouncedQ, ordering, ep, mapOrdering, normalizeItem, hasAuth]);

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
      const { data } = await api.post(ep("bulk-upload/"), fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setOkMsg(`تم: أُضيف ${data.created || 0} وتحدّث ${data.updated || 0} وتخطّى ${data.skipped || 0}.`);
      setFile(null); // تنظيف
      await load();
    } catch (e) {
      setError(e?.response?.data?.detail || e.message || "فشل الرفع");
    } finally {
      setBusy(false);
    }
  };

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

  // CRUD
  const createItem = async () => {
    setError("");
    // ✅ تحقّق قبل busy
    if (!form.code.trim()) {
      setError("أدخل الكود");
      return;
    }
    try {
      setBusy(true);
      await api.post(ep("codes/"), buildPayload(form));
      setForm({ code: "", name_de: "", name_en: "", name_ar: "" });
      await load();
    } catch (e) {
      setError(e?.response?.data?.detail || e.message || "فشل الإضافة");
    } finally {
      setBusy(false);
    }
  };

  const startEdit = (x) => {
    setEditId(x.id);
    setForm({
      code: x.code ?? "",
      name_de: x.name_de ?? "",
      name_en: x.name_en ?? "",
      name_ar: x.name_ar ?? "",
    });
  };

  const saveEdit = async () => {
    if (!editId) return;
    setError("");
    try {
      setBusy(true);
      await api.put(ep(`codes/${editId}/`), buildPayload(form));
      setEditId(null);
      setForm({ code: "", name_de: "", name_en: "", name_ar: "" });
      await load();
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
      await api.delete(ep(`codes/${id}/`));
      await load();
    } catch (e) {
      setError(e?.response?.data?.detail || e.message || "فشل الحذف");
    } finally {
      setBusy(false);
    }
  };

  // الجلب الأوّلي + عند تغيّر العوامل
  useEffect(() => {
    load();
  }, [load]);

  // عناوين الأعمدة حسب اللغة المختارة
  const cols = useMemo(
    () => [
      { key: "code", label: "الكود" },
      { key: "name_en", label: "الاسم (EN)" },
      { key: "name_de", label: "(DE) الاسم" },
      // اظهار AR لو في بيانات/اهتمام
      { key: "name_ar", label: "(AR) الاسم" },
    ],
    []
  );

  return (
    <div className="container" style={{ padding: 16 }}>
      {/* مبدّل النوع */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <button type="button" onClick={() => switchKind("allergens")} disabled={isAllergen}>
          حساسيات
        </button>
        <button type="button" onClick={() => switchKind("additives")} disabled={!isAllergen}>
          إضافات (E)
        </button>
      </div>

      <h2>إدارة أكواد {isAllergen ? "الحساسية" : "الإضافات (E-Numbers)"} </h2>

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

      <form onSubmit={upload} style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <input
          type="file"
          accept=".csv"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          // إعادة الضبط المرئي بعد النجاح
          value={file ? undefined : ""}
        />
        <button type="submit" disabled={busy}>رفع CSV</button>
        <button type="button" onClick={exportCSV} disabled={busy}>CSV</button>
        <button type="button" onClick={load} disabled={busy}>تحديث</button>
      </form>

      {/* تحكّم: بحث + ترتيب */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12, alignItems: "center" }}>
        <input
          type="text"
          placeholder="ابحث بالكود أو الاسم..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && load()}
          style={{ padding: 8, flex: 1 }}
        />
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
        <button type="button" onClick={load} disabled={busy}>بحث</button>
      </div>

      {/* سطر إدخال سريع */}
      <div style={{ display: "grid", gridTemplateColumns: "120px 1fr 1fr 1fr auto", gap: 8, margin: "8px 0 12px" }}>
        <input placeholder="الكود *" value={form.code} onChange={(e) => onFormChange("code", e.target.value)} />
        <input placeholder="الاسم (DE)" value={form.name_de} onChange={(e) => onFormChange("name_de", e.target.value)} />
        <input placeholder="الاسم (EN)" value={form.name_en} onChange={(e) => onFormChange("name_en", e.target.value)} />
        <input placeholder="الاسم (AR)" value={form.name_ar} onChange={(e) => onFormChange("name_ar", e.target.value)} />
        <button type="button" onClick={createItem} disabled={busy}>إضافة</button>
      </div>

      {busy ? (
        <p>جارٍ التحميل…</p>
      ) : (
        <table border="1" cellPadding="8" style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              {cols.map((c) => (
                <th key={c.key}>{c.label}</th>
              ))}
              <th>إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {items.map((x) => (
              <tr key={x.id}>
                {editId === x.id ? (
                  <>
                    <td>
                      <input value={form.code} onChange={(e) => onFormChange("code", e.target.value)} />
                    </td>
                    <td>
                      <input value={form.name_en} onChange={(e) => onFormChange("name_en", e.target.value)} />
                    </td>
                    <td>
                      <input value={form.name_de} onChange={(e) => onFormChange("name_de", e.target.value)} />
                    </td>
                    <td>
                      <input value={form.name_ar} onChange={(e) => onFormChange("name_ar", e.target.value)} />
                    </td>
                    <td>
                      <button onClick={saveEdit} disabled={busy}>حفظ</button>
                      <button onClick={cancelEdit} disabled={busy} style={{ marginInlineStart: 8 }}>إلغاء</button>
                    </td>
                  </>
                ) : (
                  <>
                    <td>{x.code}</td>
                    <td>{x.name_en}</td>
                    <td>{x.name_de}</td>
                    <td>{x.name_ar}</td>
                    <td>
                      <button onClick={() => startEdit(x)} disabled={busy}>تعديل</button>
                      <button onClick={() => delItem(x.id)} disabled={busy} style={{ marginInlineStart: 8 }}>حذف</button>
                    </td>
                  </>
                )}
              </tr>
            ))}
            {!items.length && (
              <tr>
                <td colSpan={cols.length + 1} style={{ textAlign: "center" }}>
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
