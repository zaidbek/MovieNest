import React from "react";
import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="state-block">
      <p className="state-block__title">Страница не найдена — 404</p>
      <p>Возможно, ссылка устарела или содержит ошибку.</p>
      <Link to="/" className="btn btn--primary" style={{ marginTop: 12 }}>
        На главную
      </Link>
    </div>
  );
}
