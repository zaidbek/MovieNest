const crypto = require("crypto");
const { getCollection } = require("./db");
const xpRepo = require("./xpRepo");
const { xpForMovieType } = require("./gamification");
const { evaluateProgress } = require("./progressEvaluator");

const MILESTONES = [25, 50, 75, 100];

// Раз в сколько мс клиент обязан присылать "пульс" во время просмотра.
const HEARTBEAT_INTERVAL_MS = 5000;
// Сколько реального времени можно засчитать за один пульс максимум — защищает
// от накрутки через подделку JS (например, если клиент пришлёт elapsedMs=999999,
// сервер всё равно поверит только собственным часам и не более этого предела).
// Это же ограничение делает бессмысленной перемотку вперёд: сервер не знает
// и не спрашивает текущую позицию плеера — он учитывает только то время, которое
// РЕАЛЬНО прошло между двумя пульсами, поэтому "перемотанные" минуты просто
// не могли пройти на часах сервера и не засчитываются.
const MAX_CREDIT_MS = HEARTBEAT_INTERVAL_MS * 2;

async function historyCol() {
  return getCollection("watch_history");
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
  const col = await historyCol();
  const now = new Date().toISOString();
  const movieIdStr = String(movieId);

  const existing = await col.findOne({ userId, movieId: movieIdStr });

  if (!existing) {
    const row = {
      userId,
      movieId: movieIdStr,
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
    await col.insertOne(row);
    return row;
  }

  const updated = await col.findOneAndUpdate(
    { userId, movieId: movieIdStr },
    {
      $set: {
        sessionId, // новая вкладка/перезагрузка получает новую активную сессию
        lastHeartbeatAtMs: Date.now(),
        updatedAt: now,
      },
    },
    { returnDocument: "after" }
  );
  return updated;
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
  const movieIdStr = String(movieId);
  const col = await historyCol();

  const row = await col.findOne({ userId, movieId: movieIdStr });
  if (!row) return { error: "NO_SESSION" };
  if (row.completed) return { error: "ALREADY_COMPLETED", row };
  if (row.sessionId !== sessionId) return { error: "SESSION_MISMATCH", row };

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

  // Условие в фильтре (sessionId + completed:false) — оптимистичная защита от
  // гонки: если между чтением и записью что-то изменилось (другая вкладка
  // перехватила сессию или видео уже засчиталось завершённым), обновление
  // просто не найдёт совпадающий документ, вместо того чтобы перезаписать
  // более новые данные устаревшими.
  const updated = await col.findOneAndUpdate(
    { userId, movieId: movieIdStr, sessionId, completed: false },
    {
      $set: {
        watchedSeconds,
        percent: Math.round(percent * 10) / 10,
        milestonesReached: [...row.milestonesReached, ...newMilestones],
        completed,
        completedAt: completed ? new Date().toISOString() : row.completedAt,
        lastHeartbeatAtMs: now,
        updatedAt: new Date().toISOString(),
      },
    },
    { returnDocument: "after" }
  );

  if (!updated) {
    // Кто-то другой успел изменить строку между чтением и записью — заново
    // прочитать актуальное состояние и сообщить как SESSION_MISMATCH, чтобы
    // фронтенд не потерял данные и не показал ошибку "из ниоткуда".
    const fresh = await col.findOne({ userId, movieId: movieIdStr });
    return { error: "SESSION_MISMATCH", row: fresh };
  }

  const result = {
    row: updated,
    newMilestones,
    justCompleted: completed && prevPercent < 100,
  };

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

async function progressForUser(userId, movieId) {
  const col = await historyCol();
  return col.findOne({ userId, movieId: String(movieId) });
}

async function countCompletedForUser(userId) {
  const col = await historyCol();
  return col.countDocuments({ userId, completed: true });
}

async function allForUser(userId) {
  const col = await historyCol();
  const rows = await col.find({ userId }).toArray();
  return rows.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

async function allCompletedCounts() {
  const col = await historyCol();
  const rows = await col.find({ completed: true }).toArray();
  const map = new Map();
  for (const h of rows) {
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
