import React, { useEffect, useState, useCallback } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { fetchMovieBySlug, fetchMovies } from "../api/api.js";
import { LoadingState, ErrorState } from "../components/StateBlocks.jsx";
import { StarIcon, ChevronLeftIcon, ShareIcon } from "../components/Icons.jsx";
import { useViewTracking } from "../hooks/useViewTracking.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useToast } from "../context/ToastContext.jsx";
import { toggleFavorite } from "../api/engagement.js";
import AchievementModal from "../components/AchievementModal.jsx";
import Comments from "../components/Comments.jsx";

// ── helpers ────────────────────────────────────────────────────────────────
function scoreMatch(a, b) {
  let score = 0;
  const aGenres = new Set(a.genre || []);
  for (const g of (b.genre || [])) if (aGenres.has(g)) score += 3;
  if (Math.abs(a.year - b.year) <= 5) score += 1;
  if (b.popular) score += 1;
  if (b.recommended) score += 2;
  score += b.rating * 0.5;
  return score;
}

function getRecommended(current, pool) {
  return pool
    .filter(m => m.id !== current.id)
    .map(m => ({ m, score: scoreMatch(current, m) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 18)
    .map(x => x.m);
}

const TYPE_LABELS = { movie: "Фильм", cartoon: "Мультфильм", dorama: "Дорама" };
const BACK_LINKS  = { movie: "/movies", cartoon: "/cartoons", dorama: "/doramas" };

// ── component ──────────────────────────────────────────────────────────────
export default function WatchPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { user, setUser } = useAuth();
  const { showToast } = useToast();
  const [movie, setMovie] = useState(null);
  const [pool, setPool]   = useState([]);
  const [recs, setRecs]   = useState([]);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null); // null | "unavailable" | "copied"
  const [activeEp, setActiveEp] = useState(null);
  const [achievementQueue, setAchievementQueue] = useState([]);

  const isFavorite = !!(user && movie && (user.favorites || []).includes(String(movie.id)));

  async function handleToggleFavorite() {
    if (!user) { navigate("/login", { state: { from: `/watch/${slug}` } }); return; }
    try {
      const result = await toggleFavorite(movie.id);
      setUser((u) => ({ ...u, favorites: result.favorites }));
      showToast(result.added ? "Добавлено в избранное ♥" : "Удалено из избранного", { type: "info", duration: 2000 });
      const badges = [...(result.unlockedAchievements || []), ...(result.completedChallenges || [])];
      if (badges.length) setAchievementQueue((q) => [...q, ...badges]);
    } catch (err) {
      showToast(err.message, { type: "error" });
    }
  }

  const handleViewResult = useCallback((result) => {
    if (result?.newMilestones?.includes(100)) {
      showToast(`Просмотр засчитан ✓ +${result.xpAwarded} XP`, { type: "success", duration: 3000 });
    } else if (result?.newMilestones?.length) {
      showToast(`Просмотрено ${result.newMilestones[result.newMilestones.length - 1]}%`, { type: "info", duration: 2000 });
    }
    if (result?.leveledUp) {
      showToast(`Новый уровень: ${result.newLevel}! 🎉`, { type: "success", duration: 3000 });
    }
    const badges = [...(result?.unlockedAchievements || []), ...(result?.completedChallenges || [])];
    if (badges.length) {
      setAchievementQueue((q) => [...q, ...badges]);
    }
  }, [showToast]);

  // Отправляет реальный прогресс просмотра на сервер каждые 5 секунд (пока вкладка
  // активна) и получает обратно вехи 25/50/75/100%, начисленный XP, новые
  // достижения/челленджи — вся защита от накрутки на сервере (см.
  // backend/store/watchProgressRepo.js)
  useViewTracking(movie?.id, { onResult: handleViewResult });

  // Load movie + same-type pool
  const load = useCallback(async (s) => {
    setMovie(null); setError(null); setNotice(null); setActiveEp(null);
    try {
      const m = await fetchMovieBySlug(s);
      setMovie(m);
      const all = await fetchMovies({ type: m.type });
      setPool(all);
      setRecs(getRecommended(m, all));
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => { load(slug); }, [slug, load]);

  // When pool or movie changes, refresh recs
  useEffect(() => {
    if (movie && pool.length) setRecs(getRecommended(movie, pool));
  }, [movie, pool]);

  function getVideoUrl() {
    if (activeEp !== null && movie.episodes) {
      const ep = movie.episodes.find(e => e.number === activeEp);
      return ep?.videoUrl || "";
    }
    return movie.trailerUrl || movie.videoUrl || "";
  }

  function handleShare() {
    const url = window.location.href;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url).then(() => {
        setNotice("copied");
        setTimeout(() => setNotice(null), 2500);
      });
    } else {
      setNotice("copied");
      setTimeout(() => setNotice(null), 2500);
    }
  }

  function handleEpisode(ep) {
    setActiveEp(ep.number);
    setNotice(null);
    if (!ep.videoUrl) setNotice("unavailable");
  }

  if (error) return <ErrorState message={error} />;
  if (!movie) return <LoadingState label="Загружаем…" />;

  const videoUrl = getVideoUrl();
  const typeLabel = TYPE_LABELS[movie.type] || "Фильм";
  const backLink  = BACK_LINKS[movie.type] || "/movies";
  const isDorama  = movie.type === "dorama";

  return (
    <div className="watch-layout">
      {/* ── LEFT COLUMN ── */}
      <div className="watch-main">
        {/* Back */}
        <Link to={backLink} className="back-link" style={{ marginBottom: 14 }}>
          <ChevronLeftIcon style={{ width: 15, height: 15 }} />
          Назад к каталогу
        </Link>

        {/* Player */}
        <div className="watch-player">
          {videoUrl ? (
            <iframe
              src={videoUrl}
              title={movie.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          ) : (
            <div className="watch-player__placeholder">
              <img src={movie.poster} alt={movie.title} />
              <div className="watch-player__no-video">
                <span>Видео пока недоступно</span>
              </div>
            </div>
          )}
        </div>

        {/* Episode tabs (doramas) */}
        {isDorama && movie.episodes && (
          <div className="watch-episodes">
            <p className="watch-episodes__label">Серии ({movie.episodesCount})</p>
            <div className="watch-episodes__list">
              {movie.episodes.map(ep => (
                <button
                  key={ep.number}
                  type="button"
                  className={`watch-ep-btn ${activeEp === ep.number ? "watch-ep-btn--active" : ""}`}
                  onClick={() => handleEpisode(ep)}
                >
                  {ep.number}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Notice */}
        {notice === "unavailable" && (
          <div className="watch-notice watch-notice--warn">Видео для этой серии пока не добавлено</div>
        )}
        {notice === "copied" && (
          <div className="watch-notice watch-notice--ok">Ссылка скопирована!</div>
        )}
        {!user && (
          <div className="watch-notice">
            <Link to="/login" state={{ from: `/watch/${slug}` }}>Войдите</Link>, чтобы просмотр засчитывался в вашей статистике и достижениях.
          </div>
        )}

        {/* Meta */}
        <div className="watch-meta">
          <div className="watch-meta__top">
            <span className={`watch-type-badge watch-type-badge--${movie.type}`}>{typeLabel}</span>
            <h1 className="watch-title">{movie.title}</h1>
          </div>

          <div className="watch-stats">
            <span className="ticket ticket--lg"><StarIcon className="ticket__star" /> {(movie.rating ?? 0).toFixed(1)}</span>
            <span className="watch-stat">{movie.year}</span>
            {movie.duration && <span className="watch-stat">{movie.duration} мин</span>}
            {isDorama && movie.country && <span className="watch-stat">{movie.country}</span>}
            {isDorama && movie.episodesCount && <span className="watch-stat">{movie.episodesCount} серий</span>}
          </div>

          <div className="watch-genres">
            {(movie.genre || []).map(g => <span key={g} className="genre-tag">{g}</span>)}
          </div>

          <p className="watch-desc">{movie.description}</p>

          <div className="watch-actions">
            <button type="button" className={`btn ${isFavorite ? "btn--gold" : "btn--ghost"}`} onClick={handleToggleFavorite}>
              {isFavorite ? "♥ В избранном" : "♡ В избранное"}
            </button>
            <button type="button" className="btn btn--ghost" onClick={handleShare}>
              <ShareIcon style={{ width: 17, height: 17 }} />
              Поделиться
            </button>
          </div>
        </div>

        <Comments movieId={movie.id} />
      </div>

      {/* ── RIGHT COLUMN ── */}
      <aside className="watch-sidebar">
        <h2 className="watch-sidebar__title">Рекомендуемые</h2>
        <div className="watch-rec-list">
          {recs.map(m => (
            <RecCard key={m.id} movie={m} onNavigate={() => navigate(`/watch/${m.slug}`)} />
          ))}
        </div>
      </aside>

      <AchievementModal queue={achievementQueue} onDone={() => setAchievementQueue([])} />
    </div>
  );
}

function RecCard({ movie, onNavigate }) {
  return (
    <button type="button" className="rec-card" onClick={onNavigate}>
      <div className="rec-card__poster">
        <img
          src={movie.poster}
          alt={movie.title}
          loading="lazy"
          onError={e => { e.target.src = `https://placehold.co/160x240/0d1117/e8b84b?text=${encodeURIComponent(movie.title.slice(0,10))}`; }}
        />
        <span className="rec-card__rating"><StarIcon style={{ width: 10, height: 10 }} />{(movie.rating ?? 0).toFixed(1)}</span>
      </div>
      <div className="rec-card__info">
        <p className="rec-card__title">{movie.title}</p>
        <p className="rec-card__sub">{movie.year}{movie.duration ? ` · ${movie.duration} мин` : ""}{movie.episodesCount ? ` · ${movie.episodesCount} сер.` : ""}</p>
        <div className="rec-card__genres">
          {(movie.genre || []).slice(0, 2).map(g => <span key={g} className="genre-tag genre-tag--sm">{g}</span>)}
        </div>
      </div>
    </button>
  );
}
