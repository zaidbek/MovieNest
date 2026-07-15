import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { useToast } from "../context/ToastContext.jsx";
import { ApiError } from "../api/client.js";

export default function Login() {
  const { login } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const redirectTo = location.state?.from || "/profile";

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
      showToast("Добро пожаловать!", { type: "success" });
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Не удалось войти");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={handleSubmit}>
        <h1 className="auth-card__title">Вход в MovieNest</h1>
        <p className="auth-card__subtitle">Продолжайте смотреть с того места, где остановились</p>

        <label className="field">
          <span>Email</span>
          <input type="email" required autoComplete="email" value={email}
            onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
        </label>

        <label className="field">
          <span>Пароль</span>
          <input type="password" required autoComplete="current-password" value={password}
            onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
        </label>

        {error && <p className="auth-card__error">{error}</p>}

        <button type="submit" className="btn btn--primary" disabled={loading} style={{ width: "100%", justifyContent: "center" }}>
          {loading ? "Входим…" : "Войти"}
        </button>

        <p className="auth-card__footer">
          Нет аккаунта? <Link to="/register">Зарегистрироваться</Link>
        </p>
      </form>
    </div>
  );
}
