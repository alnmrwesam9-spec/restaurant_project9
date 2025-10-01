// frontend/src/pages/LoginPage.jsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/axios";

export default function LoginPage() {
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState(""); // بريد أو اسم مستخدم
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errMsg, setErrMsg] = useState("");

  const doLogin = async (payload) => {
    // DRF SimpleJWT الافتراضي: /api/token/
    return api.post("/token/", payload);
  };

  const fetchMe = async () => {
    // اختر أي endpoint موجود عندك لبيانات المستخدم
    // جرّب الأشهر ثم ارجع افتراضيًا
    try {
      const try1 = await api.get("/users/me/");
      return try1.data;
    } catch {
      try {
        const try2 = await api.get("/me/");
        return try2.data;
      } catch {
        return null;
      }
    }
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!identifier || !password) return;

    setErrMsg("");
    setLoading(true);
    try {
      // المحاولة الأولى باسم المستخدم
      let resp;
      try {
        resp = await doLogin({ username: identifier, password });
      } catch (e1) {
        // إن فشلت وربما كان بريدًا إلكترونيًا
        if (identifier.includes("@")) {
          resp = await doLogin({ email: identifier, password });
        } else {
          throw e1;
        }
      }

      const { access, refresh } = resp.data || {};
      if (!access || !refresh) throw new Error("Invalid token response");

      localStorage.setItem("access", access);
      localStorage.setItem("refresh", refresh);

      // حدّد الدور لتوجيه صحيح
      let isAdmin = false;
      let role = "Owner";
      try {
        const me = await fetchMe();
        if (me) {
          role =
            (me.role && String(me.role)) ||
            (me.is_staff ? "admin" : "Owner");
          isAdmin =
            me.username === "admin" ||
            me.is_staff === true ||
            me.is_superuser === true ||
            String(me.role || "").toLowerCase() === "admin";
          localStorage.setItem("userRole", role);
        }
      } catch {}

      if (isAdmin) navigate("/admin/users", { replace: true });
      else navigate("/menus", { replace: true });
    } catch (err) {
      setErrMsg("بيانات الدخول غير صحيحة");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-wrap">
      <form onSubmit={onSubmit} className="login-form">
        <h2>تسجيل الدخول</h2>
        {errMsg && <div className="alert alert-danger">{errMsg}</div>}
        <input
          type="text"
          placeholder="البريد أو اسم المستخدم"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          autoFocus
        />
        <input
          type="password"
          placeholder="كلمة المرور"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button disabled={loading} type="submit">
          {loading ? "جاري الدخول..." : "دخول"}
        </button>
      </form>
    </div>
  );
}
