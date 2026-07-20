const { getCollection } = require("./db");
const usersRepo = require("./usersRepo");
const xpRepo = require("./xpRepo");
const { XP_REWARDS } = require("./gamification");

async function dailyCol() {
  return getCollection("daily_login");
}

/**
 * Регистрирует вход пользователя за сегодня (коллекция daily_login), обновляет
 * стрик посещений (users.loginStreak) и начисляет ежедневный XP-бонус —
 * но не более одного раза за календарные сутки.
 */
async function recordDailyLogin(userId) {
  const loginResult = await usersRepo.recordLogin(userId);
  if (!loginResult) return null;
  const { isNewDay } = loginResult;

  if (isNewDay) {
    const today = new Date().toISOString().slice(0, 10);
    const col = await dailyCol();
    try {
      await col.insertOne({ userId, date: today, createdAt: new Date().toISOString() });
      await xpRepo.awardXp(userId, XP_REWARDS.dailyLogin, "daily_login");
    } catch (err) {
      // Уникальный индекс {userId, date} — если запись за сегодня уже есть
      // (например, два одновременных запроса при входе), просто не начисляем повторно.
      if (!err || err.code !== 11000) throw err;
    }
  }

  return { isNewDay, streak: loginResult.user.loginStreak };
}

async function historyForUser(userId) {
  const col = await dailyCol();
  const rows = await col.find({ userId }).toArray();
  return rows.sort((a, b) => a.date.localeCompare(b.date));
}

module.exports = { recordDailyLogin, historyForUser };
