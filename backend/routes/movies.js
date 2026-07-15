const express = require("express");
const path = require("path");
const { body, validationResult } = require("express-validator");
const { requireAuth } = require("../middleware/auth");
const { requireAdmin } = require("../middleware/admin");
const { readJSON, enqueueMutation } = require("../store/jsonStore");

const router = express.Router();
const DB_PATH = path.join(__dirname, "..", "data", "movies.json");

// Читаем через общий helper (readJSON) — он безопасно обрабатывает
// отсутствующий/пустой файл. Запись теперь идёт через enqueueMutation —
// ту же атомарную запись (tmp-файл + rename) и очередь на файл, что
// используют остальные репозитории (comments, users, xp и т.д.), поэтому
// параллельные admin-запросы (POST/PUT/DELETE) больше не могут повредить
// movies.json гонкой записи.
function readDB() {
  return readJSON(DB_PATH, []);
}

const movieValidators = [
  body("slug").isString().trim().isLength({ min: 1, max: 200 }).matches(/^[a-z0-9-]+$/i),
  body("title").isString().trim().isLength({ min: 1, max: 300 }),
  body("type").optional().isIn(["movie", "cartoon", "dorama"]),
  body("rating").optional().isFloat({ min: 0, max: 10 }),
  body("year").optional().isInt({ min: 1888, max: 2100 }),
];

// GET /api/movies
router.get("/", (req, res) => {
  try {
    const { type, search, genre, sort, section } = req.query;
    let movies = readDB();

    if (type) movies = movies.filter(m => m.type === type);
    if (search) {
      const q = search.trim().toLowerCase();
      movies = movies.filter(m => m.title.toLowerCase().includes(q));
    }
    if (genre) movies = movies.filter(m => m.genre.some(g => g.toLowerCase() === genre.toLowerCase()));
    if (section === "recommended") movies = movies.filter(m => m.recommended);
    else if (section === "popular")  movies = movies.filter(m => m.popular);
    else if (section === "new")      movies = movies.filter(m => m.newRelease);

    if (sort === "rating") movies = [...movies].sort((a, b) => b.rating - a.rating);
    else if (sort === "year") movies = [...movies].sort((a, b) => b.year - a.year);
    else if (sort === "title") movies = [...movies].sort((a, b) => a.title.localeCompare(b.title));

    res.json(movies);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Не удалось загрузить список" });
  }
});

// GET /api/movies/genres
router.get("/genres", (req, res) => {
  try {
    const movies = readDB();
    const { type } = req.query;
    const filtered = type ? movies.filter(m => m.type === type) : movies;
    const set = new Set();
    filtered.forEach(m => m.genre.forEach(g => set.add(g)));
    res.json([...set].sort());
  } catch (err) {
    res.status(500).json({ message: "Не удалось загрузить жанры" });
  }
});

// GET /api/movies/:slug
router.get("/:slug", (req, res) => {
  try {
    const movies = readDB();
    const movie = movies.find(m => m.slug === req.params.slug);
    if (!movie) return res.status(404).json({ message: "Фильм не найден" });
    res.json(movie);
  } catch (err) {
    res.status(500).json({ message: "Не удалось загрузить фильм" });
  }
});

// POST /api/movies — добавление контента. Только для администраторов:
// requireAuth проверяет, что пользователь вошёл в систему, requireAdmin —
// что у него именно роль admin (обычный пользователь получит 403).
router.post(
  "/",
  requireAuth,
  requireAdmin,
  movieValidators,
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: errors.array()[0].msg });
    }
    try {
      const result = await enqueueMutation(DB_PATH, (movies) => {
        if (movies.some((m) => m.slug === req.body.slug)) {
          return { data: movies, returnValue: { conflict: true } };
        }
        const nextId = movies.length ? Math.max(...movies.map(m => m.id)) + 1 : 1;
        const validTypes = ["movie", "cartoon", "dorama"];
        const newMovie = {
          id: nextId,
          slug: req.body.slug,
          title: req.body.title,
          description: req.body.description || "",
          poster: req.body.poster || "",
          rating: req.body.rating || 0,
          year: req.body.year || new Date().getFullYear(),
          genre: req.body.genre || [],
          type: validTypes.includes(req.body.type) ? req.body.type : "dorama",
          country: req.body.country || "",
          duration: req.body.duration || null,
          episodesCount: req.body.episodesCount || null,
          episodes: req.body.episodes || null,
          recommended: Boolean(req.body.recommended),
          popular: Boolean(req.body.popular),
          newRelease: Boolean(req.body.newRelease),
          trailerUrl: req.body.trailerUrl || "",
          videoUrl: req.body.videoUrl || "",
        };
        return { data: [...movies, newMovie], returnValue: newMovie };
      }, []);

      if (result?.conflict) {
        return res.status(409).json({ message: "Дорама с таким slug уже существует" });
      }
      res.status(201).json(result);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Не удалось добавить" });
    }
  }
);

// PUT /api/movies/:id — редактирование контента. Только для администраторов.
router.put(
  "/:id",
  requireAuth,
  requireAdmin,
  movieValidators,
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: errors.array()[0].msg });
    }
    try {
      const id = Number(req.params.id);
      const result = await enqueueMutation(DB_PATH, (movies) => {
        const idx = movies.findIndex((m) => m.id === id);
        if (idx === -1) return { data: movies, returnValue: { notFound: true } };

        const duplicateSlug = movies.some((m) => m.slug === req.body.slug && m.id !== id);
        if (duplicateSlug) return { data: movies, returnValue: { conflict: true } };

        const validTypes = ["movie", "cartoon", "dorama"];
        const existing = movies[idx];
        const updated = {
          ...existing,
          slug: req.body.slug,
          title: req.body.title,
          description: req.body.description ?? existing.description ?? "",
          poster: req.body.poster ?? existing.poster ?? "",
          rating: req.body.rating ?? existing.rating ?? 0,
          year: req.body.year ?? existing.year ?? new Date().getFullYear(),
          genre: req.body.genre ?? existing.genre ?? [],
          type: validTypes.includes(req.body.type) ? req.body.type : existing.type,
          country: req.body.country ?? existing.country ?? "",
          duration: req.body.duration ?? existing.duration ?? null,
          episodesCount: req.body.episodesCount ?? existing.episodesCount ?? null,
          episodes: req.body.episodes ?? existing.episodes ?? null,
          recommended: req.body.recommended !== undefined ? Boolean(req.body.recommended) : Boolean(existing.recommended),
          popular: req.body.popular !== undefined ? Boolean(req.body.popular) : Boolean(existing.popular),
          newRelease: req.body.newRelease !== undefined ? Boolean(req.body.newRelease) : Boolean(existing.newRelease),
          trailerUrl: req.body.trailerUrl ?? existing.trailerUrl ?? "",
          videoUrl: req.body.videoUrl ?? existing.videoUrl ?? "",
          id, // id никогда не меняется
        };
        const next = [...movies];
        next[idx] = updated;
        return { data: next, returnValue: updated };
      }, []);

      if (result?.notFound) return res.status(404).json({ message: "Дорама не найдена" });
      if (result?.conflict) return res.status(409).json({ message: "Дорама с таким slug уже существует" });
      res.json(result);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Не удалось обновить" });
    }
  }
);

// DELETE /api/movies/:id — удаление контента. Только для администраторов.
router.delete("/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const result = await enqueueMutation(DB_PATH, (movies) => {
      const idx = movies.findIndex((m) => m.id === id);
      if (idx === -1) return { data: movies, returnValue: { notFound: true } };
      const next = [...movies];
      const [removed] = next.splice(idx, 1);
      return { data: next, returnValue: { movie: removed } };
    }, []);

    if (result?.notFound) return res.status(404).json({ message: "Дорама не найдена" });
    res.json({ message: "Удалено", movie: result.movie });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Не удалось удалить" });
  }
});

module.exports = router;
