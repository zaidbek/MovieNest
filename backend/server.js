require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const cookieParser = require("cookie-parser");

const moviesRouter = require("./routes/movies");
const authRouter = require("./routes/auth");
const usersRouter = require("./routes/users");
const viewsRouter = require("./routes/views");
const leaderboardRouter = require("./routes/leaderboard");
const commentsRouter = require("./routes/comments");
const challengesRouter = require("./routes/challenges");
const adminRouter = require("./routes/admin");
const usersRepo = require("./store/usersRepo");

const { apiLimiter } = require("./middleware/rateLimiters");
const { ensureCsrfCookie, verifyCsrf } = require("./middleware/csrf");

const app = express();
const PORT = process.env.PORT || 5000;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "http://localhost:5173";
const isProd = process.env.NODE_ENV === "production";

// Мы читаем куки (JWT-токен) — приложение работает за прокси (Vite/Nginx),
// это нужно, чтобы secure-cookie и req.ip определялись корректно.
app.set("trust proxy", 1);

// ── Безопасность ────────────────────────────────────────────────────────
app.use(
  helmet({
    contentSecurityPolicy: isProd
      ? {
          directives: {
            defaultSrc: ["'self'"],
            imgSrc: ["'self'", "https:", "data:"],
            scriptSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            connectSrc: ["'self'"],
            frameSrc: ["https:"], // разрешаем встраивание видеоплееров (iframe)
            objectSrc: ["'none'"],
          },
        }
      : false, // в dev-режиме CSP отключён, чтобы не мешать Vite HMR
    crossOriginEmbedderPolicy: false,
  })
);

app.use(
  cors({
    origin: CLIENT_ORIGIN,
    credentials: true, // разрешаем отправку cookie между фронтендом и бэкендом
  })
);

app.use(express.json({ limit: "200kb" }));
app.use(cookieParser());
app.use(ensureCsrfCookie);
app.use(verifyCsrf);
app.use(apiLimiter);

// Лог запросов — удобно для отладки во время разработки
app.use((req, res, next) => {
  console.log(`${new Date().toLocaleTimeString()} — ${req.method} ${req.url}`);
  next();
});

// ── Маршруты ────────────────────────────────────────────────────────────
app.use("/api/auth", authRouter);
app.use("/api/users", usersRouter);
app.use("/api/views", viewsRouter);
app.use("/api/leaderboard", leaderboardRouter);
app.use("/api/comments", commentsRouter);
app.use("/api/challenges", challengesRouter);
app.use("/api/admin", adminRouter);
app.use("/api/movies", moviesRouter);

app.get("/", (req, res) => {
  res.json({
    message: "MovieNest API работает 🎬",
    endpoints: [
      "GET /api/movies",
      "GET /api/movies/genres",
      "GET /api/movies/:slug",
      "POST /api/movies (только admin)",
      "PUT /api/movies/:id (только admin)",
      "DELETE /api/movies/:id (только admin)",
      "POST /api/auth/register",
      "POST /api/auth/login",
      "POST /api/auth/logout",
      "GET /api/auth/me",
      "GET /api/users/me",
      "POST /api/views/:movieId",
      "GET /api/leaderboard",
      "GET /api/comments/:movieId",
      "POST /api/comments/:movieId",
    ],
  });
});

// Обработка несуществующих маршрутов
app.use((req, res) => {
  res.status(404).json({ message: "Маршрут не найден" });
});

// Единый обработчик ошибок — не даём стектрейсам утекать в ответ клиенту
app.use((err, req, res, next) => {
  console.error("Необработанная ошибка:", err);
  if (err.type === "entity.too.large") {
    return res.status(413).json({ message: "Слишком большой запрос" });
  }
  res.status(500).json({ message: "Внутренняя ошибка сервера" });
});

// При старте сервера гарантируем, что аккаунт с захардкоженным в коде email
// Super Admin'а (config/roles.js) действительно имеет роль "superadmin" в
// базе данных — на случай, если он регистрировался раньше или роль была
// изменена вручную. Если такой аккаунт ещё не зарегистрирован — ничего не
// произойдёт, роль будет выдана автоматически при регистрации/входе.
usersRepo
  .ensureSuperAdminRole()
  .catch((err) => console.error("Не удалось проверить роль Super Admin при старте:", err));

app.listen(PORT, () => {
  console.log(`🎬 MovieNest API запущен на http://localhost:${PORT}`);
});
