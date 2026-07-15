import React, { useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { FilmLogoIcon, SearchIcon, UserIcon, LogoutIcon, TrophyIcon } from "./Icons.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useToast } from "../context/ToastContext.jsx";

function avatarUrl(seed) {
  return `https://api.dicebear.com/7.x/thumbs/svg?seed=${encodeURIComponent(seed || "movienest")}&backgroundColor=171c27`;
}

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [query, setQuery] = useState("");
  const navigate = useNavigate();
  const { user, initializing, logout } = useAuth();
  const { showToast } = useToast();

  function closeMobileUI() { setMenuOpen(false); setSearchOpen(false); setAccountOpen(false); }

  function handleSearchSubmit(e) {
    e.preventDefault();
    if (!query.trim()) return;
    navigate(`/search?q=${encodeURIComponent(query.trim())}`);
    closeMobileUI();
  }

  async function handleLogout() {
    await logout();
    closeMobileUI();
    showToast("Вы вышли из аккаунта", { type: "info" });
    navigate("/");
  }

  return (
    <header className="header">
      <div className="container header__inner">
        <Link to="/" className="logo" onClick={closeMobileUI}>
          <FilmLogoIcon className="logo__mark" style={{ color: "var(--accent-gold)" }} />
          <span className="logo__text">MovieNest</span>
        </Link>

        <nav className={`nav ${menuOpen ? "is-open" : ""}`}>
          <NavLink to="/" end className={({ isActive }) => `nav__link ${isActive ? "is-active" : ""}`} onClick={closeMobileUI}>Главная</NavLink>
          <NavLink to="/movies" className={({ isActive }) => `nav__link ${isActive ? "is-active" : ""}`} onClick={closeMobileUI}>Фильмы</NavLink>
          <NavLink to="/cartoons" className={({ isActive }) => `nav__link ${isActive ? "is-active" : ""}`} onClick={closeMobileUI}>Мультфильмы</NavLink>
          <NavLink to="/doramas" className={({ isActive }) => `nav__link ${isActive ? "is-active" : ""}`} onClick={closeMobileUI}>Дорамы</NavLink>
          <NavLink to="/leaderboard" className={({ isActive }) => `nav__link ${isActive ? "is-active" : ""}`} onClick={closeMobileUI}>
            <TrophyIcon style={{ width: 14, height: 14, marginRight: 4, verticalAlign: "-2px" }} />
            Рейтинг
          </NavLink>
          {user && (
            <>
              <NavLink to="/challenges" className={({ isActive }) => `nav__link ${isActive ? "is-active" : ""}`} onClick={closeMobileUI}>🎯 Задания</NavLink>
              <NavLink to="/achievements" className={({ isActive }) => `nav__link ${isActive ? "is-active" : ""}`} onClick={closeMobileUI}>🏆 Достижения</NavLink>
              <NavLink to="/progress" className={({ isActive }) => `nav__link ${isActive ? "is-active" : ""}`} onClick={closeMobileUI}>📈 Прогресс</NavLink>
              {(user.role === "admin" || user.role === "superadmin") && (
                <NavLink to="/admin" className={({ isActive }) => `nav__link ${isActive ? "is-active" : ""}`} onClick={closeMobileUI}>🛠️ Админ</NavLink>
              )}
            </>
          )}
          {/* Мобильная версия аккаунта показывается прямо внутри выпадающего меню */}
          <div className="nav__mobile-account">
            {!initializing && (user ? (
              <>
                <NavLink to="/profile" className="nav__link" onClick={closeMobileUI}>Профиль</NavLink>
                <button type="button" className="nav__link nav__link--btn" onClick={handleLogout}>Выйти</button>
              </>
            ) : (
              <>
                <NavLink to="/login" className="nav__link" onClick={closeMobileUI}>Войти</NavLink>
                <NavLink to="/register" className="nav__link" onClick={closeMobileUI}>Регистрация</NavLink>
              </>
            ))}
          </div>
        </nav>

        <div className="header__right">
          <button type="button" className="btn btn--ghost" aria-label="Поиск"
            onClick={() => setSearchOpen(v => !v)} style={{ padding: "10px 14px" }}>
            <SearchIcon style={{ width: 18, height: 18 }} />
          </button>

          <div className="header__account">
            {!initializing && (user ? (
              <button type="button" className="account-trigger" onClick={() => setAccountOpen(v => !v)} aria-label="Аккаунт">
                <img src={avatarUrl(user.avatarSeed)} alt="" className="account-trigger__avatar" />
              </button>
            ) : (
              <Link to="/login" className="btn btn--ghost header__login-btn">
                <UserIcon style={{ width: 17, height: 17 }} />
                Войти
              </Link>
            ))}

            {accountOpen && user && (
              <div className="account-dropdown">
                <p className="account-dropdown__email">{user.email}</p>
                <Link to="/profile" className="account-dropdown__link" onClick={closeMobileUI}>
                  <UserIcon style={{ width: 15, height: 15 }} /> Профиль
                </Link>
                <button type="button" className="account-dropdown__link" onClick={handleLogout}>
                  <LogoutIcon style={{ width: 15, height: 15 }} /> Выйти
                </button>
              </div>
            )}
          </div>

          <button type="button" className="menu-toggle" aria-label="Меню"
            onClick={() => setMenuOpen(v => !v)}>
            <span /><span /><span />
          </button>
        </div>
      </div>

      {searchOpen && (
        <div className="header__search is-open">
          <form className="container" onSubmit={handleSearchSubmit}>
            <div className="searchbar">
              <SearchIcon className="searchbar__icon" />
              <input type="text" autoFocus
                placeholder="Найти фильм, мультфильм или дораму…"
                value={query} onChange={e => setQuery(e.target.value)} />
            </div>
          </form>
        </div>
      )}
    </header>
  );
}
