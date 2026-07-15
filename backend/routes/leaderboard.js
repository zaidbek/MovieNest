const express = require("express");
const path = require("path");
const { readJSON, writeJSONAtomic } = require("../store/jsonStore");
const usersRepo = require("../store/usersRepo");
const statsRepo = require("../store/statsRepo");
const { levelProgress, ACHIEVEMENTS } = require("../store/gamification");

const router = express.Router();
const LEADERBOARD_FILE = path.join(__dirname, "..", "data", "leaderboard.json");

function topAchievementFor(stats) {
  const unlocked = ACHIEVEMENTS.filter((a) => a.check(stats));
  return unlocked.length ? unlocked[unlocked.length - 1] : null;
}

// GET /api/leaderboard — ТОП-10 пользователей по опыту (XP).
router.get("/", (req, res) => {
  const users = usersRepo.allUsers();

  const rows = users
    .map((u) => {
      const stats = statsRepo.computeStats(u.id);
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
    .filter((u) => u.xp > 0)
    .sort((a, b) => b.xp - a.xp)
    .slice(0, 10)
    .map((u, idx) => ({ rank: idx + 1, ...u }));

  // Снимок для таблицы leaderboard (переживает перезапуск сервера, как и требуется).
  writeJSONAtomic(LEADERBOARD_FILE, { updatedAt: new Date().toISOString(), rows });

  res.json(rows);
});

module.exports = router;
