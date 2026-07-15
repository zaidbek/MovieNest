import React from "react";
import SearchBar from "./SearchBar.jsx";

export default function FilterBar({
  search,
  onSearchChange,
  genre,
  onGenreChange,
  genres,
  sort,
  onSortChange,
  resultCount,
}) {
  return (
    <div className="filters">
      <SearchBar value={search} onChange={onSearchChange} placeholder="Поиск по названию…" />

      <select className="select" value={genre} onChange={(e) => onGenreChange(e.target.value)}>
        <option value="">Все жанры</option>
        {genres.map((g) => (
          <option key={g} value={g}>
            {g}
          </option>
        ))}
      </select>

      <select className="select" value={sort} onChange={(e) => onSortChange(e.target.value)}>
        <option value="">Без сортировки</option>
        <option value="rating">По рейтингу</option>
        <option value="year">По году</option>
        <option value="title">По названию</option>
      </select>

      <span className="filters__count">
        Найдено: {resultCount}
      </span>
    </div>
  );
}
