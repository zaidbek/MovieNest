const express = require("express");
const { body, validationResult } = require("express-validator");

const usersRepo = require("../store/usersRepo");
const dailyLoginRepo = require("../store/dailyLoginRepo");
const { hashPassword, verifyPassword, signToken, setAuthCookie, clearAuthCookie } = require("../utils/auth");
const { requireAuth } = require("../middleware/auth");
const { authLimiter } = require("../middleware/rateLimiters");

const router = express.Router();

const registerValidators = [
  body("email").isEmail().withMessage("Введите корректный Email").normalizeEmail(),
  body("password")
    .isLength({ min: 8, max: 128 })
    .withMessage("Пароль должен быть от 8 до 128 символов")
    .matches(/[A-Za-zА-Яа-я]/)
    .withMessage("Пароль должен содержать хотя бы одну букву")
    .matches(/[0-9]/)
    .withMessage("Пароль должен содержать хотя бы одну цифру"),
];

const loginValidators = [
  body("email").isEmail().withMessage("Введите корректный Email").normalizeEmail(),
  body("password").isString().notEmpty().withMessage("Введите пароль"),
];

function handleValidation(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ message: errors.array()[0].msg, errors: errors.array() });
  }
  next();
}

// POST /api/auth/register
router.post("/register", authLimiter, registerValidators, handleValidation, async (req, res) => {
  try {
    const { email, password, ref } = req.body;
    const passwordHash = await hashPassword(password);
    const referrer = ref ? usersRepo.findByReferralCode(String(ref)) : null;
    const user = await usersRepo.createUser({ email, passwordHash, referredBy: referrer?.id || null });
    if (referrer) {
      await usersRepo.incrementReferrals(referrer.id);
      const { evaluateProgress } = require("../store/progressEvaluator");
      await evaluateProgress(referrer.id); // может завершить челлендж "Пригласи друга"
    }
    await dailyLoginRepo.recordDailyLogin(user.id);
    const token = signToken({ sub: user.id });
    setAuthCookie(res, token);
    res.status(201).json({ user: usersRepo.publicUser(usersRepo.findById(user.id)) });
  } catch (err) {
    if (err.message === "EMAIL_TAKEN") {
      return res.status(409).json({ message: "Пользователь с таким Email уже зарегистрирован" });
    }
    console.error("Ошибка регистрации:", err);
    res.status(500).json({ message: "Не удалось зарегистрироваться. Попробуйте позже." });
  }
});

// POST /api/auth/login
router.post("/login", authLimiter, loginValidators, handleValidation, async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = usersRepo.findByEmail(email);

    // Намеренно одинаковое сообщение об ошибке для "нет пользователя" и
    // "неверный пароль" — чтобы не раскрывать, какие email зарегистрированы.
    const genericError = { message: "Неверный Email или пароль" };

    if (!user) return res.status(401).json(genericError);

    if (user.lockUntil && new Date(user.lockUntil) > new Date()) {
      return res.status(423).json({
        message: "Аккаунт временно заблокирован из-за множества неудачных попыток входа. Попробуйте позже.",
      });
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      await usersRepo.recordLoginFailure(email);
      return res.status(401).json(genericError);
    }

    await usersRepo.resetLoginFailures(user.id);
    await dailyLoginRepo.recordDailyLogin(user.id);
    const token = signToken({ sub: user.id });
    setAuthCookie(res, token);
    res.json({ user: usersRepo.publicUser(usersRepo.findById(user.id)) });
  } catch (err) {
    console.error("Ошибка входа:", err);
    res.status(500).json({ message: "Не удалось войти. Попробуйте позже." });
  }
});

// POST /api/auth/logout
router.post("/logout", (req, res) => {
  clearAuthCookie(res);
  res.json({ message: "Вы вышли из аккаунта" });
});

// GET /api/auth/me — используется при загрузке приложения, чтобы восстановить сессию после F5
router.get("/me", requireAuth, (req, res) => {
  res.json({ user: usersRepo.publicUser(req.user) });
});

module.exports = router;
