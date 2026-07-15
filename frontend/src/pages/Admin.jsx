import React, { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { useToast } from "../context/ToastContext.jsx";
import {
  fetchAdminUsers,
  fetchAdminUserDetail,
  createMovie,
  updateMovie,
  deleteMovie,
  fetchAdmins,
  promoteUser,
  demoteUser,
  promoteUserByEmail,
} from "../api/admin.js";
import { fetchMovies } from "../api/api.js";
import { LoadingState, ErrorState, EmptyState } from "../components/StateBlocks.jsx";

const ROLE_LABELS_RU = { user: "Пользователь", admin: "Админ", superadmin: "Super Admin" };

function formatDuration(totalSeconds) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  if (h > 0) return `${h} ч ${m} мин`;
  return `${m} мин`;
}

function formatDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("ru-RU", { year: "numeric", month: "short", day: "numeric" });
}

export default function Admin() {
  const { user, initializing } = useAuth();
  const { showToast } = useToast();
  const [tab, setTab] = useState("users");
  const [search, setSearch] = useState("");
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailError, setDetailError] = useState(null);
  const [usersReloadKey, setUsersReloadKey] = useState(0);

  const isStaff = user && (user.role === "admin" || user.role === "superadmin");
  const isSuperAdmin = user && user.role === "superadmin";

  useEffect(() => {
    if (!isStaff || tab !== "users") return;
    let mounted = true;
    const timeout = setTimeout(() => {
      fetchAdminUsers({ search })
        .then((res) => { if (mounted) setData(res); })
        .catch((err) => { if (mounted) setError(err.message); });
    }, 250); // лёгкий debounce для поиска
    return () => { mounted = false; clearTimeout(timeout); };
  }, [isStaff, search, tab, usersReloadKey]);

  useEffect(() => {
    if (!selectedId) { setDetail(null); return; }
    let mounted = true;
    setDetail(null);
    setDetailError(null);
    fetchAdminUserDetail(selectedId)
      .then((res) => { if (mounted) setDetail(res); })
      .catch((err) => { if (mounted) setDetailError(err.message); });
    return () => { mounted = false; };
  }, [selectedId]);

  if (initializing) return <LoadingState label="Проверяем доступ…" />;
  if (!user) return <Navigate to="/login" state={{ from: "/admin" }} replace />;
  if (!isStaff) return <Navigate to="/" replace />;

  async function handlePromote(targetUser) {
    try {
      await promoteUser(targetUser.id);
      showToast(`${targetUser.email} назначен(а) администратором`, { type: "success" });
      setUsersReloadKey((k) => k + 1);
    } catch (err) {
      showToast(err.message, { type: "error" });
    }
  }

  async function handleDemote(targetUser) {
    try {
      await demoteUser(targetUser.id);
      showToast(`У ${targetUser.email} сняты права администратора`, { type: "success" });
      setUsersReloadKey((k) => k + 1);
    } catch (err) {
      showToast(err.message, { type: "error" });
    }
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Админ-панель</h1>
        <p className="page-subtitle">Статистика пользователей и управление контентом сайта</p>
      </div>

      <div className="admin-tabs">
        <button
          type="button"
          className={`admin-tab ${tab === "users" ? "is-active" : ""}`}
          onClick={() => setTab("users")}
        >
          Пользователи
        </button>
        <button
          type="button"
          className={`admin-tab ${tab === "content" ? "is-active" : ""}`}
          onClick={() => setTab("content")}
        >
          Контент (фильмы, мультфильмы, дорамы)
        </button>
        {isSuperAdmin && (
          <button
            type="button"
            className={`admin-tab ${tab === "admins" ? "is-active" : ""}`}
            onClick={() => setTab("admins")}
          >
            👑 Администраторы
          </button>
        )}
      </div>

      {tab === "users" && (
        <UsersPanel
          search={search}
          setSearch={setSearch}
          data={data}
          error={error}
          selectedId={selectedId}
          setSelectedId={setSelectedId}
          detail={detail}
          detailError={detailError}
          isSuperAdmin={isSuperAdmin}
          onPromote={handlePromote}
          onDemote={handleDemote}
        />
      )}

      {tab === "content" && <ContentManager />}

      {tab === "admins" && isSuperAdmin && (
        <AdminsPanel onPromote={handlePromote} onDemote={handleDemote} />
      )}
    </div>
  );
}

function UsersPanel({ search, setSearch, data, error, selectedId, setSelectedId, detail, detailError, isSuperAdmin, onPromote, onDemote }) {
  return (
    <div>
      <div className="admin-search">
        <input
          type="text"
          placeholder="Поиск по email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {error && <ErrorState message={error} />}
      {!error && !data && <LoadingState label="Загружаем пользователей…" />}
      {!error && data && data.users.length === 0 && <EmptyState message="Пользователи не найдены" />}

      {!error && data && data.users.length > 0 && (
        <table className="admin-table">
          <thead>
            <tr>
              <th>Email</th>
              <th>Роль</th>
              <th>Фильмы</th>
              <th>Мульт.</th>
              <th>Дорамы</th>
              <th>Время</th>
              <th>Уровень</th>
              <th>XP</th>
              <th>Регистрация</th>
              <th>Последний вход</th>
              {isSuperAdmin && <th>Управление</th>}
            </tr>
          </thead>
          <tbody>
            {data.users.map((u) => (
              <React.Fragment key={u.id}>
                <tr className="admin-table__row">
                  <td onClick={() => setSelectedId(selectedId === u.id ? null : u.id)}>{u.email}</td>
                  <td onClick={() => setSelectedId(selectedId === u.id ? null : u.id)}>{ROLE_LABELS_RU[u.role] || u.role}</td>
                  <td onClick={() => setSelectedId(selectedId === u.id ? null : u.id)}>{u.moviesWatched}</td>
                  <td onClick={() => setSelectedId(selectedId === u.id ? null : u.id)}>{u.cartoonsWatched}</td>
                  <td onClick={() => setSelectedId(selectedId === u.id ? null : u.id)}>{u.doramasWatched}</td>
                  <td onClick={() => setSelectedId(selectedId === u.id ? null : u.id)}>{formatDuration(u.timeSpentSeconds)}</td>
                  <td onClick={() => setSelectedId(selectedId === u.id ? null : u.id)}>{u.level}</td>
                  <td onClick={() => setSelectedId(selectedId === u.id ? null : u.id)}>{u.xp}</td>
                  <td onClick={() => setSelectedId(selectedId === u.id ? null : u.id)}>{formatDate(u.createdAt)}</td>
                  <td onClick={() => setSelectedId(selectedId === u.id ? null : u.id)}>{formatDate(u.lastLoginAt)}</td>
                  {isSuperAdmin && (
                    <td onClick={(e) => e.stopPropagation()}>
                      {u.role === "superadmin" && <span className="page-subtitle">—</span>}
                      {u.role === "user" && (
                        <button type="button" className="btn btn--ghost" onClick={() => onPromote(u)}>
                          Сделать админом
                        </button>
                      )}
                      {u.role === "admin" && (
                        <button type="button" className="btn btn--ghost" onClick={() => onDemote(u)}>
                          Снять права
                        </button>
                      )}
                    </td>
                  )}
                </tr>
                {selectedId === u.id && (
                  <tr className="admin-table__detail-row">
                    <td colSpan={isSuperAdmin ? 11 : 10}>
                      {detailError && <ErrorState message={detailError} />}
                      {!detailError && !detail && <LoadingState label="Загружаем детали…" />}
                      {!detailError && detail && <AdminUserDetail detail={detail} />}
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ── Управление администраторами (только Super Admin) ────────────────────────

function AdminsPanel({ onPromote, onDemote }) {
  const { showToast } = useToast();
  const [admins, setAdmins] = useState(null);
  const [error, setError] = useState(null);
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let mounted = true;
    fetchAdmins()
      .then((res) => { if (mounted) setAdmins(res.admins); })
      .catch((err) => { if (mounted) setError(err.message); });
    return () => { mounted = false; };
  }, [reloadKey]);

  async function handleAddByEmail(e) {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) return;
    setSubmitting(true);
    try {
      await promoteUserByEmail(trimmed);
      showToast(`${trimmed} назначен(а) администратором`, { type: "success" });
      setEmail("");
      setReloadKey((k) => k + 1);
    } catch (err) {
      showToast(err.message, { type: "error" });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDemoteClick(admin) {
    await onDemote(admin);
    setReloadKey((k) => k + 1);
  }

  return (
    <div>
      <div className="page-header">
        <p className="page-subtitle">
          Найдите пользователя по e-mail и назначьте его администратором одной кнопкой.
          Изменения сохраняются в базе данных сразу — код проекта менять не нужно.
        </p>
      </div>

      <form className="admin-search" onSubmit={handleAddByEmail} style={{ display: "flex", gap: 8 }}>
        <input
          type="email"
          placeholder="email пользователя…"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <button type="submit" className="btn btn--primary" disabled={submitting}>
          {submitting ? "Добавляем…" : "Назначить админом"}
        </button>
      </form>

      {error && <ErrorState message={error} />}
      {!error && !admins && <LoadingState label="Загружаем администраторов…" />}
      {!error && admins && admins.length === 0 && <EmptyState message="Администраторов пока нет" />}

      {!error && admins && admins.length > 0 && (
        <table className="admin-table">
          <thead>
            <tr>
              <th>Email</th>
              <th>Роль</th>
              <th>Регистрация</th>
              <th>Последний вход</th>
              <th>Управление</th>
            </tr>
          </thead>
          <tbody>
            {admins.map((a) => (
              <tr key={a.id}>
                <td>{a.email}</td>
                <td>{ROLE_LABELS_RU[a.role] || a.role}</td>
                <td>{formatDate(a.createdAt)}</td>
                <td>{formatDate(a.lastLoginAt)}</td>
                <td>
                  {a.role === "superadmin" ? (
                    <span className="page-subtitle">Нельзя изменить</span>
                  ) : (
                    <button type="button" className="btn btn--ghost" onClick={() => handleDemoteClick(a)}>
                      Снять права
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function AdminUserDetail({ detail }) {
  const { stats, achievements, challenges, watchHistory, recentActions } = detail;
  return (
    <div className="admin-detail">
      <div className="admin-detail__col">
        <h3>Прогресс по фильмам</h3>
        {watchHistory.length === 0 && <p className="page-subtitle">Ещё ничего не смотрел(а)</p>}
        {watchHistory.map((h) => (
          <div key={h.movieId} className="in-progress-row">
            <span className="in-progress-row__type" title={h.title}>{h.title}</span>
            <div className="progress-bar progress-bar--sm">
              <div className="progress-bar__fill" style={{ width: `${h.percent}%` }} />
            </div>
            <span className="in-progress-row__percent">{h.percent}%</span>
          </div>
        ))}
      </div>
      <div className="admin-detail__col">
        <h3>Достижения ({achievements.filter((a) => a.unlocked).length}/{achievements.length})</h3>
        <div className="admin-detail__chips">
          {achievements.filter((a) => a.unlocked).map((a) => (
            <span key={a.key} className="badge-inline" title={a.title}>{a.icon}</span>
          ))}
        </div>
        <h3>Задания ({stats.challengesCompleted}/{challenges.length})</h3>
        <div className="admin-detail__chips">
          {challenges.filter((c) => c.completed).map((c) => (
            <span key={c.id} className="badge-inline" title={c.title}>{c.icon}</span>
          ))}
        </div>
      </div>
      <div className="admin-detail__col">
        <h3>Последние действия</h3>
        <ul className="admin-detail__actions">
          {recentActions.map((a, i) => (
            <li key={i}>
              <span>{a.label}</span>
              <time>{formatDate(a.at)}</time>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// ── Управление контентом (добавление / редактирование / удаление дорам) ────

const EMPTY_FORM = {
  type: "dorama",
  slug: "",
  title: "",
  description: "",
  poster: "",
  rating: "",
  year: "",
  genre: "",
  country: "",
  duration: "",
  episodesCount: "",
  trailerUrl: "",
  recommended: false,
  popular: false,
  newRelease: false,
};

function movieToForm(movie) {
  return {
    type: movie.type || "dorama",
    slug: movie.slug || "",
    title: movie.title || "",
    description: movie.description || "",
    poster: movie.poster || "",
    rating: movie.rating ?? "",
    year: movie.year ?? "",
    genre: (movie.genre || []).join(", "),
    country: movie.country || "",
    duration: movie.duration ?? "",
    episodesCount: movie.episodesCount ?? "",
    trailerUrl: movie.trailerUrl || "",
    recommended: Boolean(movie.recommended),
    popular: Boolean(movie.popular),
    newRelease: Boolean(movie.newRelease),
  };
}

const CONTENT_TABS = [
  { value: "movie", label: "Фильмы" },
  { value: "cartoon", label: "Мультфильмы" },
  { value: "dorama", label: "Дорамы" },
];

const TYPE_LABELS_RU = { movie: "Фильм", cartoon: "Мультфильм", dorama: "Дорама" };

function ContentManager() {
  const { showToast } = useToast();
  const [contentType, setContentType] = useState("dorama");
  const [movies, setMovies] = useState(null);
  const [error, setError] = useState(null);
  const [editingMovie, setEditingMovie] = useState(null); // null = закрыто, {} = создание, {..} = редактирование
  const [pendingDeleteId, setPendingDeleteId] = useState(null);

  function reload() {
    setMovies(null);
    fetchMovies({ type: contentType })
      .then(setMovies)
      .catch((err) => setError(err.message));
  }

  useEffect(() => { reload(); }, [contentType]);

  async function handleDelete(id) {
    try {
      await deleteMovie(id);
      showToast("Удалено", { type: "info" });
      setPendingDeleteId(null);
      reload();
    } catch (err) {
      showToast(err.message, { type: "error" });
    }
  }

  return (
    <div>
      <div className="admin-tabs" style={{ marginBottom: 16 }}>
        {CONTENT_TABS.map((t) => (
          <button
            key={t.value}
            type="button"
            className={`admin-tab ${contentType === t.value ? "is-active" : ""}`}
            onClick={() => setContentType(t.value)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="admin-content-toolbar">
        <button type="button" className="btn btn--primary" onClick={() => setEditingMovie({ type: contentType })}>
          + Добавить {TYPE_LABELS_RU[contentType].toLowerCase()}
        </button>
      </div>

      {error && <ErrorState message={error} />}
      {!error && !movies && <LoadingState label="Загружаем список…" />}
      {!error && movies && movies.length === 0 && <EmptyState message="Ничего не найдено" />}

      {!error && movies && movies.length > 0 && (
        <div className="admin-content-list">
          {movies.map((m) => (
            <div key={m.id} className="admin-content-row">
              <img
                className="admin-content-row__poster"
                src={m.poster}
                alt={m.title}
                onError={(e) => { e.target.src = "https://placehold.co/88x128/0d1117/e8b84b?text=%20"; }}
              />
              <div className="admin-content-row__info">
                <p className="admin-content-row__title">{m.title}</p>
                <p className="admin-content-row__meta">
                  {m.year} · ★ {(m.rating ?? 0).toFixed(1)}
                  {m.episodesCount ? ` · ${m.episodesCount} сер.` : ""}
                  {" · "}
                  {(m.genre || []).join(", ")}
                </p>
              </div>
              <div className="admin-content-row__actions">
                <button type="button" className="btn btn--ghost" onClick={() => setEditingMovie(m)}>Изменить</button>
                {pendingDeleteId === m.id ? (
                  <>
                    <button type="button" className="btn btn--gold" onClick={() => handleDelete(m.id)}>Точно?</button>
                    <button type="button" className="btn btn--ghost" onClick={() => setPendingDeleteId(null)}>Отмена</button>
                  </>
                ) : (
                  <button type="button" className="btn btn--ghost" onClick={() => setPendingDeleteId(m.id)}>Удалить</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {editingMovie && (
        <MovieFormModal
          movie={editingMovie}
          onClose={() => setEditingMovie(null)}
          onSaved={() => { setEditingMovie(null); reload(); }}
        />
      )}
    </div>
  );
}

function MovieFormModal({ movie, onClose, onSaved }) {
  const { showToast } = useToast();
  const isEdit = Boolean(movie && movie.id);
  const [form, setForm] = useState(isEdit ? movieToForm(movie) : EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function slugify(text) {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9а-яё\s-]/gi, "")
      .replace(/\s+/g, "-");
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError(null);

    if (!form.title.trim()) { setFormError("Введите название"); return; }
    const slug = form.slug.trim() || slugify(form.title);
    if (!slug) { setFormError("Не удалось сформировать slug — укажите его вручную"); return; }

    const payload = {
      slug,
      title: form.title.trim(),
      description: form.description.trim(),
      poster: form.poster.trim(),
      rating: form.rating !== "" ? Number(form.rating) : 0,
      year: form.year !== "" ? Number(form.year) : new Date().getFullYear(),
      genre: form.genre.split(",").map((g) => g.trim()).filter(Boolean),
      type: form.type,
      country: form.country.trim(),
      duration: form.duration !== "" ? Number(form.duration) : null,
      episodesCount: form.episodesCount !== "" ? Number(form.episodesCount) : null,
      trailerUrl: form.trailerUrl.trim(),
      recommended: form.recommended,
      popular: form.popular,
      newRelease: form.newRelease,
    };

    setSaving(true);
    try {
      if (isEdit) {
        await updateMovie(movie.id, payload);
        showToast("Изменения сохранены", { type: "success" });
      } else {
        await createMovie(payload);
        showToast(`${TYPE_LABELS_RU[form.type]} добавлен(а)`, { type: "success" });
      }
      onSaved();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="admin-modal-backdrop" onClick={onClose}>
      <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
        <h2>{isEdit ? `Редактировать: ${TYPE_LABELS_RU[form.type]}` : `Новый(ая) ${TYPE_LABELS_RU[form.type].toLowerCase()}`}</h2>

        {formError && <p className="admin-form-error">{formError}</p>}

        <form onSubmit={handleSubmit}>
          <div className="admin-form-grid">
            <label className="admin-form-field">
              Тип контента
              <select value={form.type} onChange={(e) => set("type", e.target.value)} disabled={isEdit}>
                {CONTENT_TABS.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </label>

            <label className="admin-form-field admin-form-field--full">
              Название
              <input type="text" value={form.title} onChange={(e) => set("title", e.target.value)} required />
            </label>

            <label className="admin-form-field">
              Slug (необязательно)
              <input type="text" value={form.slug} onChange={(e) => set("slug", e.target.value)} placeholder="сформируется автоматически" />
            </label>

            <label className="admin-form-field">
              Год
              <input type="number" min="1888" max="2100" value={form.year} onChange={(e) => set("year", e.target.value)} />
            </label>

            <label className="admin-form-field">
              Рейтинг (0–10)
              <input type="number" min="0" max="10" step="0.1" value={form.rating} onChange={(e) => set("rating", e.target.value)} />
            </label>

            {form.type === "dorama" ? (
              <label className="admin-form-field">
                Кол-во серий
                <input type="number" min="0" value={form.episodesCount} onChange={(e) => set("episodesCount", e.target.value)} />
              </label>
            ) : (
              <label className="admin-form-field">
                Длительность (мин)
                <input type="number" min="0" value={form.duration} onChange={(e) => set("duration", e.target.value)} />
              </label>
            )}

            <label className="admin-form-field">
              Страна
              <input type="text" value={form.country} onChange={(e) => set("country", e.target.value)} />
            </label>

            <label className="admin-form-field">
              Жанры (через запятую)
              <input type="text" value={form.genre} onChange={(e) => set("genre", e.target.value)} placeholder="Драма, Комедия" />
            </label>

            <label className="admin-form-field admin-form-field--full">
              Постер (URL)
              <input type="url" value={form.poster} onChange={(e) => set("poster", e.target.value)} placeholder="https://…" />
            </label>

            <label className="admin-form-field admin-form-field--full">
              Трейлер / видео (URL для встраивания)
              <input type="url" value={form.trailerUrl} onChange={(e) => set("trailerUrl", e.target.value)} placeholder="https://…" />
            </label>

            <label className="admin-form-field admin-form-field--full">
              Описание
              <textarea value={form.description} onChange={(e) => set("description", e.target.value)} />
            </label>

            <div className="admin-form-field--full admin-form-checkboxes">
              <label>
                <input type="checkbox" checked={form.recommended} onChange={(e) => set("recommended", e.target.checked)} />
                Рекомендуемое
              </label>
              <label>
                <input type="checkbox" checked={form.popular} onChange={(e) => set("popular", e.target.checked)} />
                Популярное
              </label>
              <label>
                <input type="checkbox" checked={form.newRelease} onChange={(e) => set("newRelease", e.target.checked)} />
                Новинка
              </label>
            </div>
          </div>

          <div className="admin-modal__actions">
            <button type="button" className="btn btn--ghost" onClick={onClose}>Отмена</button>
            <button type="submit" className="btn btn--primary" disabled={saving}>
              {saving ? "Сохраняем…" : isEdit ? "Сохранить" : "Добавить"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
