import React from "react";
import { AlertIcon } from "./Icons.jsx";

export function LoadingState({ label = "Загрузка…" }) {
  return (
    <div className="state-block">
      <div className="spinner" />
      <p>{label}</p>
    </div>
  );
}

export function ErrorState({ message = "Не удалось загрузить данные" }) {
  return (
    <div className="state-block">
      <AlertIcon style={{ width: 36, height: 36, color: "var(--accent-red)" }} />
      <p className="state-block__title">{message}</p>
      <p>Проверьте, что backend-сервер запущен (npm run dev в папке backend).</p>
    </div>
  );
}

export function EmptyState({ message = "Ничего не найдено" }) {
  return (
    <div className="state-block">
      <p className="state-block__title">{message}</p>
      <p>Попробуйте изменить запрос или сбросить фильтры.</p>
    </div>
  );
}
