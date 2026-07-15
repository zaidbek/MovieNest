const rateLimit = require("express-rate-limit");

// Общий лимит на все API-запросы — базовая защита от DoS/скрапинга.
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 1200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Слишком много запросов. Попробуйте позже." },
});

// Жёсткий лимит на вход/регистрацию — защита от brute-force подбора пароля.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  message: { message: "Слишком много попыток входа. Попробуйте через 15 минут." },
});

// Лимит на добавление комментариев — защита от спама.
const commentLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Слишком много комментариев подряд. Подождите немного." },
});

module.exports = { apiLimiter, authLimiter, commentLimiter };
