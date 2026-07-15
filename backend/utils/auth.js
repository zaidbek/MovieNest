const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET.length < 16) {
  // Не даём серверу запуститься с небезопасным/отсутствующим секретом —
  // иначе токены авторизации можно подделать.
  throw new Error(
    "JWT_SECRET не задан или слишком короткий. Задайте надёжный секрет (32+ символов) в backend/.env"
  );
}

const TOKEN_COOKIE = "mn_token";
const TOKEN_TTL = "30d"; // пользователь остаётся в аккаунте после F5 / перезапуска браузера
const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const BCRYPT_ROUNDS = 12;

async function hashPassword(password) {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_TTL });
}

function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

function cookieOptions() {
  const isProd = process.env.NODE_ENV === "production";
  // Фронтенд (GitHub Pages) и бэкенд (Render/Railway/…) в проде живут на
  // РАЗНЫХ доменах — это межсайтовый (cross-site) запрос. Браузер отправляет
  // cookie в таком запросе, только если sameSite: "none" (и обязательно
  // secure: true — без этого браузер такую cookie просто отбросит).
  // Локально (dev) фронтенд и бэкенд общаются через Vite-прокси на одном
  // origin, поэтому там достаточно и безопаснее "lax".
  return {
    httpOnly: true, // недоступна для JS в браузере — защита от кражи токена через XSS
    secure: isProd, // только по HTTPS в проде (обязательно вместе с sameSite: none)
    sameSite: isProd ? "none" : "lax",
    maxAge: TOKEN_TTL_MS,
    path: "/",
  };
}

function setAuthCookie(res, token) {
  res.cookie(TOKEN_COOKIE, token, cookieOptions());
}

function clearAuthCookie(res) {
  res.clearCookie(TOKEN_COOKIE, { ...cookieOptions(), maxAge: undefined });
}

module.exports = {
  TOKEN_COOKIE,
  hashPassword,
  verifyPassword,
  signToken,
  verifyToken,
  setAuthCookie,
  clearAuthCookie,
};
