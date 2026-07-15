import React, { useEffect, useState } from "react";
import { fetchMovies, fetchGenres } from "../api/api.js";
import MovieCard from "../components/MovieCard.jsx";
import FilterBar from "../components/FilterBar.jsx";
import { ErrorState, EmptyState } from "../components/StateBlocks.jsx";
import { GridSkeleton } from "../components/Skeletons.jsx";

export default function CatalogPage({ type, title, subtitle }) {
  const [movies, setMovies] = useState(null);
  const [genres, setGenres] = useState([]);
  const [error, setError] = useState(null);

  const [search, setSearch] = useState("");
  const [genre, setGenre] = useState("");
  const [sort, setSort] = useState("");

  // Загружаем список жанров один раз для текущего типа (movie/cartoon)
  useEffect(() => {
    let isMounted = true;
    fetchGenres(type)
      .then((result) => { if (isMounted) setGenres(result); })
      .catch(() => { if (isMounted) setGenres([]); });
    return () => { isMounted = false; };
  }, [type]);

  // При смене категории (Фильмы/Мультфильмы/Дорамы) сбрасываем предыдущий
  // результат и ошибку — иначе на миг могли мелькнуть данные другой
  // категории или её ошибка перед приходом свежего ответа.
  useEffect(() => {
    setMovies(null);
    setError(null);
  }, [type]);

  // Перезагружаем фильмы при изменении поиска / жанра / сортировки
  useEffect(() => {
    let isMounted = true;
    const timeoutId = setTimeout(() => {
      fetchMovies({ type, search, genre, sort })
        .then((result) => {
          if (isMounted) {
            setMovies(result);
            setError(null);
          }
        })
        .catch((err) => {
          if (isMounted) setError(err.message);
        });
    }, 250); // небольшой дебаунс для поля поиска

    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
    };
  }, [type, search, genre, sort]);

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">{title}</h1>
        <p className="page-subtitle">{subtitle}</p>
      </div>

      <FilterBar
        search={search}
        onSearchChange={setSearch}
        genre={genre}
        onGenreChange={setGenre}
        genres={genres}
        sort={sort}
        onSortChange={setSort}
        resultCount={movies ? movies.length : "…"}
      />

      {error && <ErrorState message={error} />}

      {!error && movies === null && <GridSkeleton />}

      {!error && movies !== null && movies.length === 0 && <EmptyState />}

      {!error && movies !== null && movies.length > 0 && (
        <div className="grid">
          {movies.map((movie) => (
            <MovieCard key={movie.id} movie={movie} />
          ))}
        </div>
      )}
    </>
  );
}
