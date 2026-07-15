const path = require("path");
const { readJSON, enqueueMutation } = require("./jsonStore");
const { ACHIEVEMENTS, achievementsUnlockedBy } = require("./gamification");

const ACH_FILE = path.join(__dirname, "..", "data", "achievements.json");

function achievementsForUser(userId) {
  const achievements = readJSON(ACH_FILE, []);
  return achievements.filter((a) => a.userId === userId).sort((a, b) => a.earnedAt.localeCompare(b.earnedAt));
}

/**
 * Проверяет статистику пользователя против списка достижений и записывает
 * в achievements.json те, что ещё не были выданы. Возвращает список НОВЫХ
 * достижений (для показа модалки на фронте).
 */
async function evaluateAchievements(userId, stats) {
  const unlockedKeys = achievementsUnlockedBy(stats).map((a) => a.key);
  if (!unlockedKeys.length) return [];

  const newlyAwarded = await enqueueMutation(ACH_FILE, (achievements) => {
    const already = new Set(achievements.filter((a) => a.userId === userId).map((a) => a.key));
    const toAdd = unlockedKeys.filter((k) => !already.has(k));
    if (!toAdd.length) return { data: achievements, returnValue: [] };
    const now = new Date().toISOString();
    const additions = toAdd.map((key) => ({ userId, key, earnedAt: now }));
    return { data: [...achievements, ...additions], returnValue: toAdd };
  });

  return ACHIEVEMENTS.filter((a) => newlyAwarded.includes(a.key));
}

function achievementsWithStatus(userId, stats) {
  const earned = achievementsForUser(userId);
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
