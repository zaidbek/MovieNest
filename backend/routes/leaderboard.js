const express = require("express");
const usersRepo = require("../store/usersRepo");
const statsRepo = require("../store/statsRepo");
const { levelProgress, ACHIEVEMENTS } = require("../store/gamification");

const router = express.Router();

function topAchievementFor(stats) {
  const unlocked = ACHIEVEMENTS.filter((a) => a.check(stats));
  return unlocked.length ? unlocked[unlocked.length - 1] : null;
}

// GET /api/leaderboard — ТОП-10 пользователей по опыту (XP).
// Считается "живьём" из MongoDB на каждый запрос — XP хранится в базе данных,
// поэтому лидерборд всегда актуален и не может "потеряться" при перезапуске
// сервера (раньше здесь был локальный файл-снимок leaderboard.json, который
// как раз и стирался при каждом перезапуске контейнера — теперь в этом нет
// нужды, т.к. первоисточник данных, users.xp, живёт в базе, а не в контейнере).
router.get("/", async (req, res) => {
  try {
    const users = await usersRepo.allUsers();

    const rows = (
      await Promise.all(
        users.map(async (u) => {
          const stats = await statsRepo.computeStats(u.id);
          const lp = levelProgress(stats.xp);
          return {
            id: u.id,
            username: u.email.split("@")[0],
            avatarSeed: u.avatarSeed,
            xp: stats.xp,
            level: lp.level,
            viewsCount: stats.totalWatched,
            challengesCompleted: stats.challengesCompleted,
            achievement: topAchievementFor(stats),
          };
        })
      )
    )
      .filter((u) => u.xp > 0)
      .sort((a, b) => b.xp - a.xp)
      .slice(0, 10)
      .map((u, idx) => ({ rank: idx + 1, ...u }));

    res.json(rows);
  } catch (err) {
    console.error("Ошибка загрузки лидерборда:", err);
    res.status(500).json({ message: "Не удалось загрузить лидерборд" });
  }
});

module.exports = router;
