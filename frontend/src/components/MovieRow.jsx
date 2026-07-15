import React from "react";
import { Link } from "react-router-dom";
import MovieCard from "./MovieCard.jsx";

export default function MovieRow({ title, movies, viewAllLink }) {
  return (
    <section className="section">
      <div className="section__head">
        <h2 className="section__title">{title}</h2>
        {viewAllLink && (
          <Link to={viewAllLink} className="section__link">
            Смотреть все →
          </Link>
        )}
      </div>
      <div className="sprocket sprocket--tight" />

      {movies.length === 0 ? (
        <p className="empty-state">Пока здесь пусто.</p>
      ) : (
        <div className="row-scroll">
          {movies.map((movie) => (
            <MovieCard key={movie.id} movie={movie} />
          ))}
        </div>
      )}
    </section>
  );
}
