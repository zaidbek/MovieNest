const path = require("path");
const { readJSON } = require("./jsonStore");
const usersRepo = require("./usersRepo");
const { levelForXp } = require("./gamification");

const WATCH_HISTORY_FILE = path.join(__dirname, "..", "data", "watch_history.json");
const USER_CHALLENGES_FILE = path.join(__dirname, "..", "data", "user_challenges.json");

/**
 * Единая точка агрегации статистики пользователя — используется для проверки
 * достижений, челленджей, для профиля, лидерборда и админ-панели.
 * Считает только ЗАВЕРШЁННЫЕ (100%) просмотры — досмотренное до конца видео,
 * прогресс которого прошёл проверку на сервере (см. watchProgressRepo.js).
 */
function computeStats(userId) {
  const user = usersRepo.findById(userId);
  const history = readJSON(WATCH_HISTORY_FILE, []);
  const userChallenges = readJSON(USER_CHALLENGES_FILE, []);

  const mine = history.filter((h) => h.userId === userId);
  const completed = mine.filter((h) => h.completed);

  const moviesWatched = completed.filter((h) => h.movieType === "movie").length;
  const cartoonsWatched = completed.filter((h) => h.movieType === "cartoon").length;
  const doramasWatched = completed.filter((h) => h.movieType === "dorama").length;
  const totalWatched = completed.length;

  const genreSet = new Set();
  completed.forEach((h) => (h.genres || []).forEach((g) => genreSet.add(g)));

  const totalWatchedSeconds = mine.reduce((sum, h) => sum + (h.watchedSeconds || 0), 0);

  const xp = user?.xp || 0;
  const level = levelForXp(xp);

  const challengesCompleted = userChallenges.filter((c) => c.userId === userId && c.completed).length;

  return {
    userId,
    moviesWatched,
    cartoonsWatched,
    doramasWatched,
    totalWatched,
    distinctGenres: genreSet.size,
    // Каждое зачтённое сервером завершение по конструкции не может быть накручено
    // перемоткой вперёд — сервер начисляет только реально прошедшее время (см.
    // watchProgressRepo.js), поэтому любое завершённое = "без перемотки".
    fullWatchesNoSkip: totalWatched,
    xp,
    level,
    favoritesCount: (user?.favorites || []).length,
    referrals: user?.referrals || 0,
    loginStreak: user?.loginStreak || 0,
    challengesCompleted,
    totalWatchedSeconds,
  };
}

module.exports = { computeStats };
