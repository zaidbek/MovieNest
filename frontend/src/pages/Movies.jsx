import React from "react";
import CatalogPage from "./CatalogPage.jsx";

export default function Movies() {
  return (
    <CatalogPage
      type="movie"
      title="Фильмы"
      subtitle="Ищите и фильтруйте фильмы по жанру, году и рейтингу"
    />
  );
}
