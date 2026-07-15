import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { useToast } from "../context/ToastContext.jsx";
import { fetchComments, postComment } from "../api/engagement.js";
import { ApiError } from "../api/client.js";

function timeAgo(iso) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "только что";
  if (mins < 60) return `${mins} мин назад`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} ч назад`;
  const days = Math.floor(hours / 24);
  return `${days} дн назад`;
}

export default function Comments({ movieId }) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [comments, setComments] = useState(null);
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let mounted = true;
    setComments(null);
    fetchComments(movieId)
      .then((data) => { if (mounted) setComments(data); })
      .catch(() => { if (mounted) setComments([]); });
    return () => { mounted = false; };
  }, [movieId]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!text.trim()) return;
    setSubmitting(true);
    try {
      const comment = await postComment(movieId, text.trim());
      setComments((list) => [comment, ...(list || [])]);
      setText("");
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "Не удалось отправить комментарий", { type: "error" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="comments">
      <h2 className="comments__title">Комментарии {comments ? `(${comments.length})` : ""}</h2>

      {user ? (
        <form className="comments__form" onSubmit={handleSubmit}>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Поделитесь впечатлениями о фильме…"
            maxLength={1000}
            rows={3}
          />
          <button type="submit" className="btn btn--primary" disabled={submitting || !text.trim()}>
            {submitting ? "Отправляем…" : "Отправить"}
          </button>
        </form>
      ) : (
        <p className="comments__login-prompt">
          <Link to="/login">Войдите</Link>, чтобы оставить комментарий.
        </p>
      )}

      {comments === null && <p className="comments__loading">Загружаем комментарии…</p>}
      {comments && comments.length === 0 && <p className="comments__empty">Пока нет комментариев — станьте первым!</p>}

      <ul className="comments__list">
        {comments && comments.map((c) => (
          <li key={c.id} className="comment-item">
            <div className="comment-item__head">
              <span className="comment-item__author">{c.username}</span>
              <span className="comment-item__time">{timeAgo(c.createdAt)}</span>
            </div>
            <p className="comment-item__text">{c.text}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
