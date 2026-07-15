import React from "react";
import { Link } from "react-router-dom";
import { StarIcon } from "./Icons.jsx";

const TYPE_LABELS = { movie: "Фильм", cartoon: "Мультфильм", dorama: "Дорама" };
const TYPE_CLASS  = { movie: "movie", cartoon: "cartoon", dorama: "dorama" };

export default function MovieCard({ movie }) {
  return (
    <Link to={`/movie/${movie.slug}`} className="movie-card">
      <div className="movie-card__poster-wrap">
        <img
          className="movie-card__poster"
          src={movie.poster}
          alt={movie.title}
          loading="lazy"
          onError={e => { e.target.src = `https://placehold.co/300x450/0d1117/e8b84b?text=${encodeURIComponent(movie.title.slice(0,12))}&font=montserrat`; }}
        />
        <span className={`movie-card__type movie-card__type--${TYPE_CLASS[movie.type] || "movie"}`}>
          {TYPE_LABELS[movie.type] || "Фильм"}
        </span>
        <span className="movie-card__rating">
          <StarIcon style={{ width: 11, height: 11 }} />
          {(movie.rating ?? 0).toFixed(1)}
        </span>
        <div className="movie-card__overlay">
          <div className="movie-card__info">
            <p className="movie-card__title">{movie.title}</p>
            <p className="movie-card__sub">
              {movie.year}
              {movie.duration ? ` · ${movie.duration} мин` : ""}
              {movie.episodesCount ? ` · ${movie.episodesCount} сер.` : ""}
            </p>
          </div>
        </div>
      </div>
    </Link>
  );
}
