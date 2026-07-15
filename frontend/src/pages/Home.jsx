import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { fetchMovies } from "../api/api.js";
import MovieRow from "../components/MovieRow.jsx";
import SearchBar from "../components/SearchBar.jsx";
import { ErrorState } from "../components/StateBlocks.jsx";
import { HeroSkeleton, RowSkeleton } from "../components/Skeletons.jsx";
import { StarIcon, PlayIcon } from "../components/Icons.jsx";

export default function Home() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    let isMounted = true;
    async function loadHome() {
      try {
        const [recommended, popularMovies, popularCartoons, popularDoramas, newMovies, newCartoons, newDoramas] =
          await Promise.all([
            fetchMovies({ section: "recommended" }),
            fetchMovies({ section: "popular", type: "movie" }),
            fetchMovies({ section: "popular", type: "cartoon" }),
            fetchMovies({ section: "popular", type: "dorama" }),
            fetchMovies({ section: "new", type: "movie" }),
            fetchMovies({ section: "new", type: "cartoon" }),
            fetchMovies({ section: "new", type: "dorama" }),
          ]);
        if (isMounted) {
          setData({
            recommended,
            popularMovies,
            popularCartoons,
            popularDoramas,
            newReleases: [...newMovies, ...newCartoons, ...newDoramas].sort(() => Math.random() - 0.5).slice(0, 12),
            hero: recommended[0] || popularMovies[0] || null,
          });
        }
      } catch (err) {
        if (isMounted) setError(err.message);
      }
    }
    loadHome();
    return () => { isMounted = false; };
  }, []);

  function handleSearchSubmit(e) {
    e.preventDefault();
    if (!query.trim()) return;
    navigate(`/search?q=${encodeURIComponent(query.trim())}`);
  }

  if (error) return <ErrorState message={error} />;
  if (!data) return (
    <>
      <HeroSkeleton />
      <RowSkeleton />
      <RowSkeleton />
    </>
  );

  const { hero, recommended, popularMovies, popularCartoons, popularDoramas, newReleases } = data;

  return (
    <>
      {hero && (
        <section className="hero">
          <img src={hero.poster} alt="" className="hero__bg" aria-hidden="true" />
          <div className="hero__gradient" />
          <div className="hero__content">
            <span className="hero__eyebrow">
              <StarIcon style={{ width: 14, height: 14 }} />
              Рекомендуем посмотреть
            </span>
            <h1 className="hero__title">{hero.title}</h1>
            <div className="hero__meta">
              <span className="ticket"><StarIcon className="ticket__star" /> {(hero.rating ?? 0).toFixed(1)}</span>
              <span>{hero.year}</span>
              <span>{hero.genre.join(", ")}</span>
            </div>
            <p className="hero__desc">{hero.description}</p>
            <div className="hero__actions">
              <Link to={`/movie/${hero.slug}`} className="btn btn--primary">
                <PlayIcon className="watch-icon" />
                Подробнее
              </Link>
              <form onSubmit={handleSearchSubmit} style={{ flex: "1 1 260px", maxWidth: 320 }}>
                <SearchBar value={query} onChange={setQuery} placeholder="Найти фильм, мультфильм, дораму…" />
              </form>
            </div>
          </div>
        </section>
      )}
      <MovieRow title="Рекомендуемые" movies={recommended} viewAllLink="/movies" />
      <MovieRow title="Популярные фильмы" movies={popularMovies} viewAllLink="/movies" />
      <MovieRow title="Популярные мультфильмы" movies={popularCartoons} viewAllLink="/cartoons" />
      <MovieRow title="Популярные дорамы" movies={popularDoramas} viewAllLink="/doramas" />
      <MovieRow title="Новинки" movies={newReleases} viewAllLink="/movies" />
    </>
  );
}
