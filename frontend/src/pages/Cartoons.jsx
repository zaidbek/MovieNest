import React from "react";
import CatalogPage from "./CatalogPage.jsx";

export default function Cartoons() {
  return (
    <CatalogPage
      type="cartoon"
      title="Мультфильмы"
      subtitle="Ищите и фильтруйте мультфильмы по жанру, году и рейтингу"
    />
  );
}
