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
const { connect, ensureIndexes } = require("./store/db");

const { apiLimiter } = require("./middleware/rateLimiters");
const { ensureCsrfCookie, verifyCsrf } = require("./middleware/csrf");

const app = express();
const PORT = process.env.PORT || 5000;
const isProd = process.env.NODE_ENV === "production";

// CLIENT_ORIGIN задаётся в Render Dashboard → Environment (см. render.yaml,
// там sync: false — значение вводится вручную). Известный адрес фронтенда
// на GitHub Pages добавлен как резервный вариант: если переменную забыли
// задать или в ней опечатка (например, лишний "/" на конце), сайт всё равно
// не сломается полностью из-за CORS. Можно передать несколько адресов через
// запятую в CLIENT_ORIGIN, если понадобится (например, свой домен + Pages).
const DEFAULT_CLIENT_ORIGIN = "http://localhost:5173";
const FALLBACK_CLIENT_ORIGINS = ["https://zaidbek.github.io"];

function stripTrailingSlash(value) {
  return String(value || "").trim().replace(/\/+$/, "");
}

const allowedOrigins = new Set(
  [
    ...String(process.env.CLIENT_ORIGIN || DEFAULT_CLIENT_ORIGIN).split(","),
    ...FALLBACK_CLIENT_ORIGINS,
  ]
    .map(stripTrailingSlash)
    .filter(Boolean)
);

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
    origin(origin, callback) {
      // origin отсутствует у запросов не из браузера (curl, health-check
      // Render'а и т.п.) — их разрешаем, credentials там не участвуют.
      if (!origin) return callback(null, true);
      if (allowedOrigins.has(stripTrailingSlash(origin))) return callback(null, true);
      console.warn(`CORS: запрос с неразрешённого origin "${origin}" отклонён`);
      return callback(null, false);
    },
    credentials: true, // разрешаем отправку cookie между фронтендом и бэкендом
  })
);

app.use(express.json({ limit: "200kb" }));
app.use(cookieParser());
app.use(ensureCsrfCookie);

// GET /api/csrf-token — отдаёт CSRF-токен в теле JSON-ответа.
// Зачем это нужно: cookie XSRF-TOKEN устанавливается на домене backend'а
// (onrender.com). Frontend живёт на ДРУГОМ домене (github.io) — а
// document.cookie в браузере может прочитать только cookie СВОЕГО домена,
// чужие ему в принципе не видны (это не CORS, а изоляция cookie по домену).
// Поэтому раньше frontend никогда не мог прочитать этот токен и любой
// POST/PUT/DELETE-запрос получал 403 "Недействительный CSRF-токен".
// Теперь frontend получает значение токена явно, в теле этого ответа
// (см. frontend/src/api/client.js), и присылает его обратно в заголовке
// X-XSRF-TOKEN — а сверяется он всё так же с cookie, которая браузер сам
// прикрепляет к каждому запросу на backend (это работает независимо от
// того, может ли JS её прочитать).
app.get("/api/csrf-token", (req, res) => {
  res.json({ csrfToken: req.csrfToken });
});

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
//
// ВАЖНО: сервер начинает принимать запросы только ПОСЛЕ того, как соединение
// с MongoDB установлено и индексы проверены — так любой ранний запрос не
// столкнётся с ещё не готовой базой данных, а если MONGODB_URI не задан или
// недоступен, это будет видно сразу в логах при старте, а не как загадочная
// ошибка 500 на каком-то случайном запросе позже.
async function start() {
  try {
    await connect();
    await ensureIndexes();
    await usersRepo.ensureSuperAdminRole();
  } catch (err) {
    console.error("❌ Не удалось подключиться к MongoDB при старте сервера:", err.message);
    console.error("   Проверьте переменную окружения MONGODB_URI (см. backend/.env.example).");
  }

  app.listen(PORT, () => {
    console.log(`🎬 MovieNest API запущен на http://localhost:${PORT}`);
  });
}

start();
