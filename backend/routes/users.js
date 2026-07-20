const express = require("express");
const { requireAuth } = require("../middleware/auth");
const usersRepo = require("../store/usersRepo");
const watchProgressRepo = require("../store/watchProgressRepo");
const statsRepo = require("../store/statsRepo");
const achievementsRepo = require("../store/achievementsRepo");
const challengesRepo = require("../store/challengesRepo");
const xpRepo = require("../store/xpRepo");
const { levelProgress } = require("../store/gamification");
const { evaluateProgress } = require("../store/progressEvaluator");

const router = express.Router();

// GET /api/users/me — полный профиль текущего пользователя: XP, уровень,
// достижения, прогресс по челленджам, избранное и историю начислений.
router.get("/me", requireAuth, async (req, res) => {
  const stats = await statsRepo.computeStats(req.user.id);
  const achievements = await achievementsRepo.achievementsWithStatus(req.user.id, stats);
  const challenges = await challengesRepo.challengesWithProgress(req.user.id, stats);
  const xpHistory = await xpRepo.recentForUser(req.user.id, 10);
  const inProgress = (await watchProgressRepo.allForUser(req.user.id))
    .filter((h) => !h.completed && h.watchedSeconds > 0);

  res.json({
    user: usersRepo.publicUser(req.user),
    stats: {
      ...stats,
      ...levelProgress(stats.xp),
      // Обратная совместимость со старым полем, которое уже использует фронтенд:
      viewsCount: stats.totalWatched,
      achievements,
    },
    challenges,
    xpHistory,
    inProgress,
  });
});

// POST /api/users/favorites/:movieId — переключить фильм в/из избранного.
router.post("/favorites/:movieId", requireAuth, async (req, res) => {
  const result = await usersRepo.toggleFavorite(req.user.id, req.params.movieId);
  const evalResult = await evaluateProgress(req.user.id);
  res.json({
    added: result.added,
    favorites: result.user.favorites,
    unlockedAchievements: evalResult.unlockedAchievements,
    completedChallenges: evalResult.completedChallenges,
  });
});

module.exports = router;
