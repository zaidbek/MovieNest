import React, { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { fetchMovies } from "../api/api.js";
import MovieCard from "../components/MovieCard.jsx";
import { ErrorState, EmptyState } from "../components/StateBlocks.jsx";
import { GridSkeleton } from "../components/Skeletons.jsx";
import { ChevronLeftIcon } from "../components/Icons.jsx";

export default function SearchResults() {
  const [searchParams] = useSearchParams();
  const query = searchParams.get("q") || "";
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    let mounted = true;
    setResults(null); setError(null);
    fetchMovies({ search: query })
      .then(d => { if (mounted) setResults(d); })
      .catch(err => { if (mounted) setError(err.message); });
    return () => { mounted = false; };
  }, [query]);

  return (
    <>
      <div style={{ marginBottom: 24 }}>
        <Link to="/" className="back-link">
          <ChevronLeftIcon style={{ width: 15, height: 15 }} />
          На главную
        </Link>
      </div>
      <div className="page-header">
        <h1 className="page-title">Поиск: «{query}»</h1>
        {results && <p className="page-subtitle">Найдено: {results.length}</p>}
      </div>

      {error && <ErrorState message={error} />}
      {!error && results === null && <GridSkeleton />}
      {!error && results !== null && results.length === 0 && <EmptyState />}
      {!error && results && results.length > 0 && (
        <div className="grid">
          {results.map(m => <MovieCard key={m.id} movie={m} />)}
        </div>
      )}
    </>
  );
}
