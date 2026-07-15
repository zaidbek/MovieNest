import React, { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { fetchMyChallenges } from "../api/engagement.js";
import { LoadingState, ErrorState } from "../components/StateBlocks.jsx";

export default function Challenges() {
  const { user, initializing } = useAuth();
  const [challenges, setChallenges] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!user) return;
    let mounted = true;
    fetchMyChallenges()
      .then((data) => { if (mounted) setChallenges(data); })
      .catch((err) => { if (mounted) setError(err.message); });
    return () => { mounted = false; };
  }, [user]);

  if (initializing) return <LoadingState label="Загружаем задания…" />;
  if (!user) return <Navigate to="/login" state={{ from: "/challenges" }} replace />;
  if (error) return <ErrorState message={error} />;
  if (!challenges) return <LoadingState label="Загружаем задания…" />;

  const doneCount = challenges.filter((c) => c.completed).length;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Задания</h1>
        <p className="page-subtitle">Выполнено {doneCount} из {challenges.length} · за каждое задание +300 XP</p>
      </div>

      <div className="challenges-grid">
        {challenges.map((c) => {
          const percent = Math.min(100, Math.round((c.progress / c.target) * 100));
          return (
            <div key={c.id} className={`challenge-card ${c.completed ? "is-complete" : ""}`}>
              <div className="challenge-card__head">
                <span className="challenge-card__icon">{c.icon}</span>
                <div>
                  <p className="challenge-card__title">{c.title}</p>
                  <p className="challenge-card__desc">{c.description}</p>
                </div>
              </div>
              <div className="progress-bar progress-bar--sm">
                <div className="progress-bar__fill" style={{ width: `${percent}%` }} />
              </div>
              <div className="challenge-card__foot">
                <span>{c.progress} / {c.target}</span>
                {c.completed
                  ? <span className="challenge-card__status">Выполнено ✓</span>
                  : <span className="challenge-card__reward">+{c.rewardXp} XP</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
