const path = require("path");
const { readJSON, enqueueMutation } = require("./jsonStore");
const usersRepo = require("./usersRepo");
const xpRepo = require("./xpRepo");
const { XP_REWARDS } = require("./gamification");

const FILE = path.join(__dirname, "..", "data", "daily_login.json");

/**
 * Регистрирует вход пользователя за сегодня (таблица daily_login), обновляет
 * стрик посещений (users.loginStreak) и начисляет ежедневный XP-бонус —
 * но не более одного раза за календарные сутки.
 */
async function recordDailyLogin(userId) {
  const loginResult = await usersRepo.recordLogin(userId);
  if (!loginResult) return null;
  const { isNewDay } = loginResult;

  if (isNewDay) {
    const today = new Date().toISOString().slice(0, 10);
    await enqueueMutation(FILE, (rows) => {
      const already = rows.some((r) => r.userId === userId && r.date === today);
      if (already) return { data: rows };
      return { data: [...rows, { userId, date: today, createdAt: new Date().toISOString() }] };
    });
    await xpRepo.awardXp(userId, XP_REWARDS.dailyLogin, "daily_login");
  }

  return { isNewDay, streak: loginResult.user.loginStreak };
}

function historyForUser(userId) {
  const rows = readJSON(FILE, []);
  return rows.filter((r) => r.userId === userId).sort((a, b) => a.date.localeCompare(b.date));
}

module.exports = { recordDailyLogin, historyForUser };
