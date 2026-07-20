const express = require("express");
const { body, validationResult } = require("express-validator");

const { requireAuth, optionalAuth } = require("../middleware/auth");
const { commentLimiter } = require("../middleware/rateLimiters");
const commentsRepo = require("../store/commentsRepo");

const router = express.Router();

// GET /api/comments/:movieId — публичный список комментариев
router.get("/:movieId", optionalAuth, async (req, res) => {
  const comments = await commentsRepo.listForMovie(String(req.params.movieId));
  res.json(comments);
});

// POST /api/comments/:movieId — оставить комментарий (только авторизованные)
router.post(
  "/:movieId",
  requireAuth,
  commentLimiter,
  body("text").isString().trim().isLength({ min: 1, max: commentsRepo.MAX_LENGTH }).withMessage("Комментарий не может быть пустым"),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: errors.array()[0].msg });
    }
    try {
      const comment = await commentsRepo.addComment({
        movieId: String(req.params.movieId),
        userId: req.user.id,
        username: req.user.email.split("@")[0],
        text: req.body.text,
      });
      res.status(201).json(comment);
    } catch (err) {
      res.status(500).json({ message: "Не удалось сохранить комментарий" });
    }
  }
);

module.exports = router;
