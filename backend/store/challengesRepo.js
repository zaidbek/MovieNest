const { getCollection } = require("./db");
const { CHALLENGES } = require("./gamification");
const xpRepo = require("./xpRepo");

async function challengesCol() {
  return getCollection("user_challenges");
}

async function progressRowsForUser(userId) {
  const col = await challengesCol();
  return col.find({ userId }).toArray();
}

/**
 * Возвращает список всех челленджей с текущим прогрессом пользователя —
 * используется страницей "Задания" на фронтенде.
 */
async function challengesWithProgress(userId, stats) {
  const rows = await progressRowsForUser(userId);
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
  const col = await challengesCol();
  const completedNow = [];

  for (const c of CHALLENGES) {
    const value = stats[c.metric] || 0;
    if (value < c.target) continue;

    const existing = await col.findOne({ userId, challengeId: c.id });
    if (existing && existing.completed) continue;

    const row = {
      userId,
      challengeId: c.id,
      progress: c.target,
      target: c.target,
      completed: true,
      completedAt: new Date().toISOString(),
    };

    try {
      await col.updateOne(
        { userId, challengeId: c.id },
        { $set: row },
        { upsert: true }
      );
    } catch (err) {
      // Гонка одновременных запросов — уникальный индекс {userId, challengeId}
      // не даёт задвоить строку, продолжаем как будто уже отмечено выполненным.
      if (!err || err.code !== 11000) throw err;
      continue;
    }

    await xpRepo.awardXp(userId, c.rewardXp, `challenge:${c.id}`);
    completedNow.push(c);
  }

  return completedNow;
}

module.exports = { challengesWithProgress, evaluateChallenges, progressRowsForUser };
