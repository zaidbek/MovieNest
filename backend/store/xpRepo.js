const path = require("path");
const crypto = require("crypto");
const { enqueueMutation } = require("./jsonStore");
const usersRepo = require("./usersRepo");

const XP_HISTORY_FILE = path.join(__dirname, "..", "data", "xp_history.json");

/**
 * Начисляет XP пользователю: обновляет кэшированное значение xp в users.json
 * и добавляет запись в xp_history.json (полный аудит начислений — не теряется
 * после перезапуска сервера, т.к. хранится в файле, а не в памяти).
 */
async function awardXp(userId, amount, reason) {
  const result = await usersRepo.addXp(userId, amount);
  if (!result) return null;
  await enqueueMutation(XP_HISTORY_FILE, (history) => {
    const entry = {
      id: crypto.randomUUID(),
      userId,
      amount,
      reason,
      createdAt: new Date().toISOString(),
    };
    return { data: [...history, entry] };
  });
  return result; // { user, prevLevel, newLevel, leveledUp }
}

function recentForUser(userId, limit = 20) {
  const { readJSON } = require("./jsonStore");
  const history = readJSON(XP_HISTORY_FILE, []);
  return history
    .filter((h) => h.userId === userId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit);
}

module.exports = { awardXp, recentForUser };
