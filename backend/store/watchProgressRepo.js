const path = require("path");
const crypto = require("crypto");
const { readJSON, enqueueMutation } = require("./jsonStore");
const xpRepo = require("./xpRepo");
const { xpForMovieType } = require("./gamification");
const { evaluateProgress } = require("./progressEvaluator");

const WATCH_HISTORY_FILE = path.join(__dirname, "..", "data", "watch_history.json");

const MILESTONES = [25, 50, 75, 100];

// Раз в сколько мс клиент обязан присылать "пульс" во время просмотра.
const HEARTBEAT_INTERVAL_MS = 5000;
// Сколько реального времени можно засчитать за один пульс максимум — защищает
// от накрутки через подделку JS (например, если клиент пришлёт elapsedMs=999999,
// сервер всё равно поверит только собственным часам и не более этого предела).
// Это же ограничение делает бессмысленной перемотку вперёд: сервер не знает
// и не спрашивает текущую позицию плеера — он učитывает только то время, которое
// РЕАЛЬНО прошло между двумя пульсами, поэтому "перемотанные" минуты просто
// не могли пройти на часах сервера и не засчитываются.
const MAX_CREDIT_MS = HEARTBEAT_INTERVAL_MS * 2;

function key(userId, movieId) {
  return `${userId}::${movieId}`;
}

function findRow(history, userId, movieId) {
  return history.find((h) => h.userId === userId && h.movieId === String(movieId));
}

/**
 * Начинает (или возобновляет) сессию просмотра. Выдаёт новый sessionId и делает
 * его единственным "активным" — если пользователь откроет тот же фильм во второй
 * вкладке, та вкладка получит другой sessionId, и старая перестанет засчитываться
 * (её пульсы будут отклонены как "неактивная сессия"). Так открытие нескольких
 * вкладок не даёт задвоить прогресс.
 */
async function startSession(userId, movieId, durationSeconds, movieType, genres) {
  const sessionId = crypto.randomUUID();
  const result = await enqueueMutation(WATCH_HISTORY_FILE, (history) => {
    const idx = history.findIndex((h) => h.userId === userId && h.movieId === String(movieId));
    const now = new Date().toISOString();
    if (idx === -1) {
      const row = {
        userId,
        movieId: String(movieId),
        movieType,
        genres: genres || [],
        durationSeconds,
        watchedSeconds: 0,
        percent: 0,
        milestonesReached: [],
        completed: false,
        completedAt: null,
        sessionId,
        lastHeartbeatAtMs: Date.now(),
        startedAt: now,
        updatedAt: now,
      };
      return { data: [...history, row], returnValue: row };
    }
    const existing = history[idx];
    const row = {
      ...existing,
      sessionId, // новая вкладка/перезагрузка получает новую активную сессию
      lastHeartbeatAtMs: Date.now(),
      updatedAt: now,
    };
    const next = [...history];
    next[idx] = row;
    return { data: next, returnValue: row };
  });
  return result;
}

/**
 * Обрабатывает "пульс" от плеера. Вся логика начисления времени — на сервере:
 * - если пульс пришёл не от активной сессии (другая вкладка её "перехватила") —
 *   ничего не засчитывается;
 * - если вкладка была неактивна/свёрнута (visible=false или focused=false) —
 *   ничего не засчитывается (эквивалент паузы);
 * - засчитывается не более MAX_CREDIT_MS реального серверного времени с
 *   предыдущего пульса — клиентским данным о "прошедшем времени" сервер не верит.
 */
async function heartbeat(userId, movieId, { sessionId, visible, focused }) {
  const now = Date.now();

  const result = await enqueueMutation(WATCH_HISTORY_FILE, (history) => {
    const idx = history.findIndex((h) => h.userId === userId && h.movieId === String(movieId));
    if (idx === -1) return { data: history, returnValue: { error: "NO_SESSION" } };

    const row = { ...history[idx] };

    if (row.completed) {
      return { data: history, returnValue: { error: "ALREADY_COMPLETED", row } };
    }
    if (row.sessionId !== sessionId) {
      return { data: history, returnValue: { error: "SESSION_MISMATCH", row } };
    }

    const gapMs = now - (row.lastHeartbeatAtMs || now);
    const engaged = visible === true && focused === true;
    const creditMs = engaged ? Math.max(0, Math.min(gapMs, MAX_CREDIT_MS)) : 0;

    const prevPercent = row.percent;
    const watchedSeconds = Math.min(row.durationSeconds, row.watchedSeconds + creditMs / 1000);
    const percent = row.durationSeconds > 0 ? (watchedSeconds / row.durationSeconds) * 100 : 0;

    const newMilestones = MILESTONES.filter(
      (m) => percent >= m && !row.milestonesReached.includes(m)
    );
    const completed = percent >= 100;

    const updated = {
      ...row,
      watchedSeconds,
      percent: Math.round(percent * 10) / 10,
      milestonesReached: [...row.milestonesReached, ...newMilestones],
      completed,
      completedAt: completed ? new Date().toISOString() : row.completedAt,
      lastHeartbeatAtMs: now,
      updatedAt: new Date().toISOString(),
    };

    const next = [...history];
    next[idx] = updated;
    return { data: next, returnValue: { row: updated, newMilestones, justCompleted: completed && prevPercent < 100 } };
  });

  if (result.error) return result;

  let xpAwarded = 0;
  let leveledUp = false;
  let newLevel = null;
  let unlockedAchievements = [];
  let completedChallenges = [];

  if (result.justCompleted) {
    xpAwarded = xpForMovieType(result.row.movieType);
    const xpResult = await xpRepo.awardXp(userId, xpAwarded, `watch:${result.row.movieType}:${result.row.movieId}`);
    leveledUp = !!xpResult?.leveledUp;
    newLevel = xpResult?.newLevel ?? null;

    const evalResult = await evaluateProgress(userId);
    unlockedAchievements = evalResult.unlockedAchievements;
    completedChallenges = evalResult.completedChallenges;
  }

  return {
    watchedSeconds: result.row.watchedSeconds,
    percent: result.row.percent,
    completed: result.row.completed,
    newMilestones: result.newMilestones,
    xpAwarded,
    leveledUp,
    newLevel,
    unlockedAchievements,
    completedChallenges,
  };
}

function progressForUser(userId, movieId) {
  const history = readJSON(WATCH_HISTORY_FILE, []);
  return findRow(history, userId, movieId) || null;
}

function countCompletedForUser(userId) {
  const history = readJSON(WATCH_HISTORY_FILE, []);
  return history.filter((h) => h.userId === userId && h.completed).length;
}

function allForUser(userId) {
  const history = readJSON(WATCH_HISTORY_FILE, []);
  return history
    .filter((h) => h.userId === userId)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

function allCompletedCounts() {
  const history = readJSON(WATCH_HISTORY_FILE, []);
  const map = new Map();
  for (const h of history) {
    if (!h.completed) continue;
    map.set(h.userId, (map.get(h.userId) || 0) + 1);
  }
  return map;
}

module.exports = {
  startSession,
  heartbeat,
  progressForUser,
  countCompletedForUser,
  allForUser,
  allCompletedCounts,
};
