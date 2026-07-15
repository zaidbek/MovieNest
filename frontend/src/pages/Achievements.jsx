import React, { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { fetchMyProfile } from "../api/auth.js";
import { LoadingState, ErrorState } from "../components/StateBlocks.jsx";

export default function Achievements() {
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

  if (initializing) return <LoadingState label="Загружаем достижения…" />;
  if (!user) return <Navigate to="/login" state={{ from: "/achievements" }} replace />;
  if (error) return <ErrorState message={error} />;
  if (!profile) return <LoadingState label="Загружаем достижения…" />;

  const { achievements } = profile.stats;
  const unlockedCount = achievements.filter((a) => a.unlocked).length;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Достижения</h1>
        <p className="page-subtitle">Получено {unlockedCount} из {achievements.length}</p>
      </div>

      <div className="achievements-grid">
        {achievements.map((a) => (
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
    </div>
  );
}
