const express = require("express");
const fs = require("fs");
const path = require("path");

const { requireAuth } = require("../middleware/auth");
const watchProgressRepo = require("../store/watchProgressRepo");

const router = express.Router();
const MOVIES_DB_PATH = path.join(__dirname, "..", "data", "movies.json");

function findMovie(movieId) {
  try {
    const movies = JSON.parse(fs.readFileSync(MOVIES_DB_PATH, "utf-8"));
    return movies.find((m) => String(m.id) === String(movieId)) || null;
  } catch {
    return null;
  }
}

// POST /api/views/:movieId/start
// Открывает (или возобновляет) серверную сессию отслеживания реального просмотра.
// Клиент обязан вызвать это при старте плеера и присылать /heartbeat каждые
// несколько секунд, пока вкладка активна — иначе прогресс не будет расти.
router.post("/:movieId/start", requireAuth, async (req, res) => {
  const { movieId } = req.params;
  const movie = findMovie(movieId);
  if (!movie) return res.status(404).json({ message: "Фильм не найден" });

  const durationSeconds = Math.max(60, (movie.duration || 90) * 60);
  const row = await watchProgressRepo.startSession(
    req.user.id,
    movieId,
    durationSeconds,
    movie.type,
    movie.genre
  );

  res.json({
    sessionId: row.sessionId,
    watchedSeconds: row.watchedSeconds,
    percent: row.percent,
    durationSeconds: row.durationSeconds,
    completed: row.completed,
  });
});

// POST /api/views/:movieId/heartbeat
// Основная точка защиты от накрутки — вся логика в store/watchProgressRepo.js:
// сервер начисляет только реально прошедшее серверное время между пульсами,
// не доверяя клиентским данным, и требует активную вкладку/фокус.
router.post("/:movieId/heartbeat", requireAuth, async (req, res) => {
  const { movieId } = req.params;
  const { sessionId, visible, focused } = req.body || {};
  if (!sessionId) return res.status(400).json({ message: "Отсутствует sessionId" });

  const result = await watchProgressRepo.heartbeat(req.user.id, movieId, {
    sessionId,
    visible: !!visible,
    focused: !!focused,
  });

  if (result.error === "NO_SESSION") {
    return res.status(409).json({ message: "Сессия просмотра не начата", code: result.error });
  }
  if (result.error === "SESSION_MISMATCH") {
    // Другая вкладка/устройство перехватили сессию — это ожидаемо и не ошибка клиента.
    return res.status(409).json({ message: "Активна другая вкладка просмотра", code: result.error });
  }
  if (result.error === "ALREADY_COMPLETED") {
    return res.json({ completed: true, percent: 100, newMilestones: [] });
  }

  res.json(result);
});

// GET /api/views/:movieId
router.get("/:movieId", requireAuth, (req, res) => {
  const progress = watchProgressRepo.progressForUser(req.user.id, req.params.movieId);
  res.json(
    progress || { watchedSeconds: 0, percent: 0, completed: false, milestonesReached: [] }
  );
});

// GET /api/views/me
router.get("/me", requireAuth, (req, res) => {
  res.json({ totalViews: watchProgressRepo.countCompletedForUser(req.user.id) });
});

module.exports = router;
