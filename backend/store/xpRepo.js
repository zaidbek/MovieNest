const crypto = require("crypto");
const { getCollection } = require("./db");
const usersRepo = require("./usersRepo");

async function historyCol() {
  return getCollection("xp_history");
}

/**
 * Начисляет XP пользователю: атомарно увеличивает поле xp в коллекции users
 * (см. usersRepo.addXp) и добавляет запись в xp_history — полный аудит
 * начислений, который хранится в MongoDB, а не в памяти процесса, поэтому
 * переживает перезапуск сервера, "засыпание" на бесплатном хостинге и
 * повторный вход пользователя.
 */
async function awardXp(userId, amount, reason) {
  const result = await usersRepo.addXp(userId, amount);
  if (!result) return null;
  const col = await historyCol();
  await col.insertOne({
    id: crypto.randomUUID(),
    userId,
    amount,
    reason,
    createdAt: new Date().toISOString(),
  });
  return result; // { user, prevLevel, newLevel, leveledUp }
}

async function recentForUser(userId, limit = 20) {
  const col = await historyCol();
  return col
    .find({ userId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray();
}

module.exports = { awardXp, recentForUser };
