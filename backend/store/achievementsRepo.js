const { getCollection } = require("./db");
const { ACHIEVEMENTS, achievementsUnlockedBy } = require("./gamification");

async function achCol() {
  return getCollection("achievements");
}

async function achievementsForUser(userId) {
  const col = await achCol();
  const rows = await col.find({ userId }).toArray();
  return rows.sort((a, b) => a.earnedAt.localeCompare(b.earnedAt));
}

/**
 * Проверяет статистику пользователя против списка достижений и записывает
 * в коллекцию achievements те, что ещё не были выданы. Возвращает список
 * НОВЫХ достижений (для показа модалки на фронте).
 */
async function evaluateAchievements(userId, stats) {
  const unlockedKeys = achievementsUnlockedBy(stats).map((a) => a.key);
  if (!unlockedKeys.length) return [];

  const col = await achCol();
  const already = await col.find({ userId, key: { $in: unlockedKeys } }).toArray();
  const alreadyKeys = new Set(already.map((a) => a.key));
  const toAdd = unlockedKeys.filter((k) => !alreadyKeys.has(k));
  if (!toAdd.length) return [];

  const now = new Date().toISOString();
  const additions = toAdd.map((key) => ({ userId, key, earnedAt: now }));
  try {
    await col.insertMany(additions, { ordered: false });
  } catch (err) {
    // Гонка (два запроса одновременно разблокировали одно и то же достижение) —
    // уникальный индекс {userId, key} отклонит дубликат, это ожидаемо и не ошибка.
    if (!err || err.code !== 11000) throw err;
  }

  return ACHIEVEMENTS.filter((a) => toAdd.includes(a.key));
}

async function achievementsWithStatus(userId, stats) {
  const earned = await achievementsForUser(userId);
  const earnedKeys = new Set(earned.map((a) => a.key));
  return ACHIEVEMENTS.map((a) => ({
    key: a.key,
    icon: a.icon,
    title: a.title,
    description: a.description,
    unlocked: earnedKeys.has(a.key) || a.check(stats),
    earnedAt: earned.find((e) => e.key === a.key)?.earnedAt || null,
  }));
}

module.exports = { achievementsForUser, evaluateAchievements, achievementsWithStatus };
