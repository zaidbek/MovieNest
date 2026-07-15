import React, { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { useToast } from "../context/ToastContext.jsx";
import { ApiError } from "../api/client.js";

export default function Register() {
  const { register } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const ref = searchParams.get("ref") || undefined;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);

    if (password !== confirm) {
      setError("Пароли не совпадают");
      return;
    }

    setLoading(true);
    try {
      await register(email, password, ref);
      showToast("Аккаунт создан! Добро пожаловать в MovieNest 🎬", { type: "success" });
      navigate("/profile", { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Не удалось зарегистрироваться");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={handleSubmit}>
        <h1 className="auth-card__title">Регистрация</h1>
        <p className="auth-card__subtitle">Создайте аккаунт, чтобы получать достижения и попадать в таблицу лидеров</p>
        {ref && <p className="auth-card__subtitle" style={{ color: "var(--accent-gold)" }}>Вас пригласил друг — после регистрации он получит награду 🎉</p>}

        <label className="field">
          <span>Email</span>
          <input type="email" required autoComplete="email" value={email}
            onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
        </label>

        <label className="field">
          <span>Пароль</span>
          <input type="password" required autoComplete="new-password" value={password}
            onChange={(e) => setPassword(e.target.value)} placeholder="Минимум 8 символов, буквы и цифры" />
        </label>

        <label className="field">
          <span>Повторите пароль</span>
          <input type="password" required autoComplete="new-password" value={confirm}
            onChange={(e) => setConfirm(e.target.value)} placeholder="••••••••" />
        </label>

        {error && <p className="auth-card__error">{error}</p>}

        <button type="submit" className="btn btn--primary" disabled={loading} style={{ width: "100%", justifyContent: "center" }}>
          {loading ? "Создаём аккаунт…" : "Зарегистрироваться"}
        </button>

        <p className="auth-card__footer">
          Уже есть аккаунт? <Link to="/login">Войти</Link>
        </p>
      </form>
    </div>
  );
}
