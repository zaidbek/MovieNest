const statsRepo = require("./statsRepo");
const achievementsRepo = require("./achievementsRepo");
const challengesRepo = require("./challengesRepo");

/**
 * Пересчитывает статистику пользователя и проверяет достижения + челленджи.
 * Вызывается после любого события, которое может изменить прогресс:
 * завершение просмотра, ежедневный вход, добавление в избранное, приглашение друга.
 */
async function evaluateProgress(userId) {
  const stats = statsRepo.computeStats(userId);
  const unlockedAchievements = await achievementsRepo.evaluateAchievements(userId, stats);
  const completedChallenges = await challengesRepo.evaluateChallenges(userId, stats);
  return { stats, unlockedAchievements, completedChallenges };
}

module.exports = { evaluateProgress };
