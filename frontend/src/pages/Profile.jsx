import React, { useEffect, useState } from "react";
import { Navigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { fetchMyProfile } from "../api/auth.js";
import { LoadingState, ErrorState } from "../components/StateBlocks.jsx";

function avatarUrl(seed) {
  return `https://api.dicebear.com/7.x/thumbs/svg?seed=${encodeURIComponent(seed || "movienest")}&backgroundColor=171c27`;
}

export default function Profile() {
  const { user, initializing } = useAuth();
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!user) return;
    let mounted = true;
    fetchMyProfile()
      .then((data) => { if (mounted) setProfile(data); })
      .catch((err) => { if (mounted) setError(err.message); });
    return () => { mounted = false; };
  }, [user]);

  if (initializing) return <LoadingState label="Загружаем профиль…" />;
  if (!user) return <Navigate to="/login" state={{ from: "/profile" }} replace />;
  if (error) return <ErrorState message={error} />;
  if (!profile) return <LoadingState label="Загружаем профиль…" />;

  const { stats } = profile;
  const joined = new Date(user.createdAt).toLocaleDateString("ru-RU", { year: "numeric", month: "long", day: "numeric" });
  const unlockedAchievements = stats.achievements.filter((a) => a.unlocked);

  return (
    <div className="profile-page">
      <section className="profile-hero">
        <img className="profile-hero__avatar" src={avatarUrl(user.avatarSeed)} alt="Аватар" />
        <div className="profile-hero__info">
          <h1 className="profile-hero__name">
            {user.email.split("@")[0]}
            {unlockedAchievements.slice(-1).map((a) => (
              <span key={a.key} className="badge-inline" title={a.title}>{a.icon}</span>
            ))}
            {user.role === "superadmin" && <span className="badge-inline" title="Super Admin">👑</span>}
            {user.role === "admin" && <span className="badge-inline" title="Администратор">🛠️</span>}
          </h1>
          <p className="profile-hero__email">{user.email}</p>
          <p className="profile-hero__joined">На MovieNest с {joined}</p>
        </div>
        <div className="profile-hero__level">
          <span className="profile-hero__level-num">{stats.level}</span>
          <span className="profile-hero__level-label">уровень</span>
        </div>
      </section>

      <section className="profile-stats">
        <div className="profile-stat-card">
          <span className="profile-stat-card__value">{stats.viewsCount}</span>
          <span className="profile-stat-card__label">просмотрено всего</span>
        </div>
        <div className="profile-stat-card">
          <span className="profile-stat-card__value">{unlockedAchievements.length}</span>
          <span className="profile-stat-card__label">наград получено</span>
        </div>
        <div className="profile-stat-card">
          <span className="profile-stat-card__value">{stats.favoritesCount}</span>
          <span className="profile-stat-card__label">в избранном</span>
        </div>
        <div className="profile-stat-card">
          <span className="profile-stat-card__value">{stats.challengesCompleted}</span>
          <span className="profile-stat-card__label">заданий выполнено</span>
        </div>
      </section>

      <section className="profile-progress">
        <div className="profile-progress__head">
          <span>До {stats.level + 1} уровня</span>
          <span>{stats.xpIntoLevel} / {stats.xpForNextLevel} XP</span>
        </div>
        <div className="progress-bar">
          <div className="progress-bar__fill" style={{ width: `${stats.percent}%` }} />
        </div>
      </section>

      <p className="page-subtitle" style={{ margin: "16px 0 28px" }}>
        Подробнее: <Link to="/progress">Мой прогресс</Link> · <Link to="/challenges">Задания</Link> · <Link to="/leaderboard">Рейтинг</Link>
        {(user.role === "admin" || user.role === "superadmin") && <> · <Link to="/admin">Админ-панель</Link></>}
      </p>

      <section className="section">
        <h2 className="section__title">Достижения</h2>
        <div className="sprocket sprocket--tight" />
        <div className="achievements-grid">
          {stats.achievements.map((a) => (
            <div key={a.key} className={`achievement-badge ${a.unlocked ? "is-unlocked" : "is-locked"}`}>
              <span className="achievement-badge__icon">{a.icon}</span>
              <span className="achievement-badge__title">{a.title}</span>
              <span className="achievement-badge__desc">{a.description}</span>
              {a.unlocked
                ? <span className="achievement-badge__status">Получено</span>
                : <span className="achievement-badge__status achievement-badge__status--locked">Заблокировано</span>}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
