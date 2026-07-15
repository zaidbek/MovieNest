import React, { useEffect, useState } from "react";
import { Navigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { useToast } from "../context/ToastContext.jsx";
import { fetchMyProfile } from "../api/auth.js";
import { LoadingState, ErrorState } from "../components/StateBlocks.jsx";

export default function MyProgress() {
  const { user, initializing } = useAuth();
  const { showToast } = useToast();
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

  if (initializing) return <LoadingState label="Загружаем прогресс…" />;
  if (!user) return <Navigate to="/login" state={{ from: "/progress" }} replace />;
  if (error) return <ErrorState message={error} />;
  if (!profile) return <LoadingState label="Загружаем прогресс…" />;

  const { stats, inProgress } = profile;
  const referralLink = `${window.location.origin}/register?ref=${user.referralCode}`;

  function copyReferralLink() {
    navigator.clipboard?.writeText(referralLink).then(() => {
      showToast("Реферальная ссылка скопирована", { type: "success", duration: 2500 });
    });
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Мой прогресс</h1>
        <p className="page-subtitle">Уровень {stats.level} · {stats.xp} XP всего</p>
      </div>

      <section className="profile-progress">
        <div className="profile-progress__head">
          <span>До {stats.level + 1} уровня</span>
          <span>{stats.xpIntoLevel} / {stats.xpForNextLevel} XP</span>
        </div>
        <div className="progress-bar">
          <div className="progress-bar__fill" style={{ width: `${stats.percent}%` }} />
        </div>
      </section>

      <section className="profile-stats">
        <div className="profile-stat-card">
          <span className="profile-stat-card__value">{stats.moviesWatched}</span>
          <span className="profile-stat-card__label">фильмов просмотрено</span>
        </div>
        <div className="profile-stat-card">
          <span className="profile-stat-card__value">{stats.cartoonsWatched}</span>
          <span className="profile-stat-card__label">мультфильмов просмотрено</span>
        </div>
        <div className="profile-stat-card">
          <span className="profile-stat-card__value">{stats.doramasWatched}</span>
          <span className="profile-stat-card__label">дорам просмотрено</span>
        </div>
        <div className="profile-stat-card">
          <span className="profile-stat-card__value">{stats.challengesCompleted}</span>
          <span className="profile-stat-card__label">заданий выполнено</span>
        </div>
      </section>

      {inProgress?.length > 0 && (
        <section className="section">
          <h2 className="section__title">Продолжить просмотр</h2>
          <div className="sprocket sprocket--tight" />
          <div className="in-progress-list">
            {inProgress.map((h) => (
              <div key={h.movieId} className="in-progress-row">
                <span className="in-progress-row__type">
                  {h.movieType === "cartoon" ? "Мультфильм" : h.movieType === "dorama" ? "Дорама" : "Фильм"}
                </span>
                <div className="progress-bar progress-bar--sm">
                  <div className="progress-bar__fill" style={{ width: `${h.percent}%` }} />
                </div>
                <span className="in-progress-row__percent">{h.percent}%</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="section">
        <h2 className="section__title">Пригласи друга</h2>
        <div className="sprocket sprocket--tight" />
        <p className="page-subtitle" style={{ marginBottom: 12 }}>
          Поделитесь ссылкой — когда друг зарегистрируется по ней, вы получите задание «Пригласи друга» и 300 XP.
        </p>
        <div className="referral-box">
          <code className="referral-box__link">{referralLink}</code>
          <button type="button" className="btn btn--ghost" onClick={copyReferralLink}>Скопировать</button>
        </div>
      </section>

      <p className="page-subtitle" style={{ marginTop: 24 }}>
        Больше про достижения и задания — на страницах <Link to="/achievements">Достижения</Link> и <Link to="/challenges">Задания</Link>.
      </p>
    </div>
  );
}
