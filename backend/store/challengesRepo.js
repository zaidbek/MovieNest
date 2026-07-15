const path = require("path");
const { readJSON, enqueueMutation } = require("./jsonStore");
const { CHALLENGES } = require("./gamification");
const xpRepo = require("./xpRepo");

const FILE = path.join(__dirname, "..", "data", "user_challenges.json");

function progressRowsForUser(userId) {
  const rows = readJSON(FILE, []);
  return rows.filter((r) => r.userId === userId);
}

/**
 * Возвращает список всех челленджей с текущим прогрессом пользователя —
 * используется страницей "Задания" на фронтенде.
 */
function challengesWithProgress(userId, stats) {
  const rows = progressRowsForUser(userId);
  return CHALLENGES.map((c) => {
    const row = rows.find((r) => r.challengeId === c.id);
    const progress = Math.min(stats[c.metric] || 0, c.target);
    return {
      id: c.id,
      icon: c.icon,
      title: c.title,
      description: c.description,
      target: c.target,
      progress,
      rewardXp: c.rewardXp,
      completed: !!row?.completed,
      completedAt: row?.completedAt || null,
    };
  });
}

/**
 * Сравнивает актуальную статистику пользователя с целями челленджей и
 * завершает (+ начисляет XP) те, что достигнуты впервые. Вся проверка —
 * на сервере, на основе статистики, посчитанной из серверных данных
 * (watch_history/xp_history/users), поэтому подмена данных в браузере
 * или запросы к API напрямую не могут "разлочить" челлендж без реального
 * выполнения условия.
 */
async function evaluateChallenges(userId, stats) {
  const completedNow = [];
  for (const c of CHALLENGES) {
    const value = stats[c.metric] || 0;
    if (value < c.target) continue;

    const result = await enqueueMutation(FILE, (rows) => {
      const idx = rows.findIndex((r) => r.userId === userId && r.challengeId === c.id);
      if (idx !== -1 && rows[idx].completed) {
        return { data: rows, returnValue: { alreadyCompleted: true } };
      }
      const row = {
        userId,
        challengeId: c.id,
        progress: c.target,
        target: c.target,
        completed: true,
        completedAt: new Date().toISOString(),
      };
      const next = [...rows];
      if (idx === -1) next.push(row); else next[idx] = row;
      return { data: next, returnValue: { alreadyCompleted: false } };
    });

    if (!result.alreadyCompleted) {
      await xpRepo.awardXp(userId, c.rewardXp, `challenge:${c.id}`);
      completedNow.push(c);
    }
  }
  return completedNow;
}

module.exports = { challengesWithProgress, evaluateChallenges, progressRowsForUser };
