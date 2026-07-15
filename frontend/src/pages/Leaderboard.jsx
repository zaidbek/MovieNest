import React, { useEffect, useState } from "react";
import { fetchLeaderboard } from "../api/engagement.js";
import { LoadingState, ErrorState, EmptyState } from "../components/StateBlocks.jsx";

function avatarUrl(seed) {
  return `https://api.dicebear.com/7.x/thumbs/svg?seed=${encodeURIComponent(seed || "movienest")}&backgroundColor=171c27`;
}

const RANK_MEDALS = { 1: "🥇", 2: "🥈", 3: "🥉" };

export default function Leaderboard() {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;
    fetchLeaderboard()
      .then((data) => { if (mounted) setRows(data); })
      .catch((err) => { if (mounted) setError(err.message); });
    return () => { mounted = false; };
  }, []);

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Рейтинг пользователей</h1>
        <p className="page-subtitle">ТОП-10 самых активных зрителей MovieNest по опыту (XP)</p>
      </div>

      {error && <ErrorState message={error} />}
      {!error && rows === null && <LoadingState label="Считаем места…" />}
      {!error && rows !== null && rows.length === 0 && <EmptyState message="Пока никто не посмотрел ни одного фильма" />}

      {!error && rows && rows.length > 0 && (
        <div className="leaderboard">
          <div className="leaderboard__top3">
            {rows.slice(0, 3).map((row) => (
              <div key={row.id} className={`leaderboard-top-card leaderboard-top-card--rank${row.rank}`}>
                <span className="leaderboard-top-card__medal">{RANK_MEDALS[row.rank]}</span>
                <img className="leaderboard-top-card__avatar" src={avatarUrl(row.avatarSeed)} alt="" />
                <p className="leaderboard-top-card__name">{row.username}</p>
                <p className="leaderboard-top-card__views">{row.xp} XP · {row.challengesCompleted} заданий</p>
                <p className="leaderboard-top-card__level">Уровень {row.level}</p>
                {row.achievement && (
                  <span className="badge-inline" title={row.achievement.title}>{row.achievement.icon}</span>
                )}
              </div>
            ))}
          </div>

          {rows.length > 3 && (
            <table className="leaderboard-table">
              <thead>
                <tr>
                  <th>Место</th>
                  <th></th>
                  <th>Пользователь</th>
                  <th>Уровень</th>
                  <th>XP</th>
                  <th>Задания</th>
                  <th>Достижение</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(3).map((row) => (
                  <tr key={row.id}>
                    <td>#{row.rank}</td>
                    <td><img className="leaderboard-table__avatar" src={avatarUrl(row.avatarSeed)} alt="" /></td>
                    <td>{row.username}</td>
                    <td>{row.level}</td>
                    <td>{row.xp}</td>
                    <td>{row.challengesCompleted}</td>
                    <td>{row.achievement ? <span title={row.achievement.title}>{row.achievement.icon}</span> : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </>
  );
}
