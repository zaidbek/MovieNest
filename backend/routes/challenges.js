const express = require("express");
const { requireAuth } = require("../middleware/auth");
const statsRepo = require("../store/statsRepo");
const challengesRepo = require("../store/challengesRepo");

const router = express.Router();

// GET /api/challenges/me — список всех челленджей с прогрессом текущего пользователя.
router.get("/me", requireAuth, async (req, res) => {
  const stats = await statsRepo.computeStats(req.user.id);
  res.json(await challengesRepo.challengesWithProgress(req.user.id, stats));
});

module.exports = router;
