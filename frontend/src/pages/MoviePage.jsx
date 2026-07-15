import React, { useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { fetchMovieBySlug } from "../api/api.js";
import { LoadingState, ErrorState } from "../components/StateBlocks.jsx";
import { ChevronLeftIcon, PlayIcon, StarIcon, AlertIcon } from "../components/Icons.jsx";

const TYPE_LABELS = { movie: "Фильм", cartoon: "Мультфильм", dorama: "Дорама" };
const BACK_LINKS  = { movie: "/movies", cartoon: "/cartoons", dorama: "/doramas" };

export default function MoviePage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [movie, setMovie] = useState(null);
  const [error, setError] = useState(null);
  const [showUnavailable, setShowUnavailable] = useState(false);

  useEffect(() => {
    let mounted = true;
    setMovie(null); setError(null); setShowUnavailable(false);
    fetchMovieBySlug(slug)
      .then(d => { if (mounted) setMovie(d); })
      .catch(err => { if (mounted) setError(err.message); });
    return () => { mounted = false; };
  }, [slug]);

  function handleWatchClick() {
    if (movie.trailerUrl || movie.videoUrl) {
      navigate(`/watch/${movie.slug}`);
    } else {
      setShowUnavailable(true);
    }
  }

  if (error) return <ErrorState message={error} />;
  if (!movie) return <LoadingState label="Загружаем…" />;

  const typeLabel = TYPE_LABELS[movie.type] || "Фильм";
  const backLink  = BACK_LINKS[movie.type]  || "/movies";
  const isDorama  = movie.type === "dorama";

  return (
    <article className="movie-page">
      <div style={{ gridColumn: "1 / -1" }}>
        <Link to={backLink} className="back-link">
          <ChevronLeftIcon style={{ width: 16, height: 16 }} />
          Назад к каталогу
        </Link>
      </div>

      <div className="movie-page__poster">
        <img src={movie.poster} alt={`Постер: ${movie.title}`}
          onError={e => { e.target.src = `https://placehold.co/300x450/0d1117/e8b84b?text=${encodeURIComponent(movie.title.slice(0,12))}`; }} />
      </div>

      <div>
        <span className="movie-page__type">{typeLabel}</span>
        <h1 className="movie-page__title">{movie.title}</h1>

        <div className="movie-page__meta">
          <span className="ticket ticket--lg"><StarIcon className="ticket__star" /> {(movie.rating ?? 0).toFixed(1)}</span>
          <span>{movie.year} год</span>
          {movie.duration && <span>{movie.duration} мин</span>}
          {isDorama && movie.country && <span>{movie.country}</span>}
          {isDorama && movie.episodesCount && <span>{movie.episodesCount} серий</span>}
          <div className="genre-tags">
            {(movie.genre || []).map(g => <span key={g} className="genre-tag">{g}</span>)}
          </div>
        </div>

        <p className="movie-page__desc-label">Описание</p>
        <p className="movie-page__desc">{movie.description}</p>

        <div className="movie-page__actions">
          <button type="button" className="btn btn--primary" onClick={handleWatchClick}>
            <PlayIcon className="watch-icon" />
            Смотреть
          </button>
        </div>

        {showUnavailable && (
          <div className="video-notice">
            <AlertIcon style={{ width: 18, height: 18 }} />
            Видео пока недоступно
          </div>
        )}

        {/* Episode list for doramas */}
        {isDorama && Array.isArray(movie.episodes) && movie.episodes.length > 0 && (
          <div className="episode-list">
            <h2 className="episode-list__title">Список серий</h2>
            <ul>
              {movie.episodes.map(ep => (
                <li key={ep.number} className="episode-item">
                  <span className="episode-item__name">Серия {ep.number}</span>
                  <button type="button" className="btn btn--ghost episode-item__btn"
                    onClick={() => navigate(`/watch/${movie.slug}`)}>
                    <PlayIcon style={{ width: 13, height: 13 }} />
                    Смотреть
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </article>
  );
}
