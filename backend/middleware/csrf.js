const crypto = require("crypto");

// Защита от CSRF по схеме "double submit cookie":
// 1. Сервер выдаёт клиенту читаемый (не HttpOnly) токен в cookie XSRF-TOKEN.
// 2. Frontend читает его и присылает обратно в заголовке X-XSRF-TOKEN на
//    каждый изменяющий запрос (POST/PUT/PATCH/DELETE).
// 3. Сервер сверяет cookie и заголовок — стороннему сайту (в отличие от
//    HttpOnly-куки авторизации) его невозможно прочитать и подставить,
//    т.к. Same-Origin Policy не даёт читать чужие cookie через JS.

const CSRF_COOKIE = "XSRF-TOKEN";
const CSRF_HEADER = "x-xsrf-token";
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function ensureCsrfCookie(req, res, next) {
  const isProd = process.env.NODE_ENV === "production";
  if (!req.cookies || !req.cookies[CSRF_COOKIE]) {
    const token = crypto.randomBytes(24).toString("hex");
    res.cookie(CSRF_COOKIE, token, {
      httpOnly: false, // должен быть читаем на фронтенде
      sameSite: isProd ? "none" : "lax", // прод: фронтенд и бэкенд на разных доменах
      secure: isProd,
      path: "/",
    });
    req.csrfToken = token;
  } else {
    req.csrfToken = req.cookies[CSRF_COOKIE];
  }
  next();
}

function verifyCsrf(req, res, next) {
  if (SAFE_METHODS.has(req.method)) return next();
  const cookieToken = req.cookies ? req.cookies[CSRF_COOKIE] : null;
  const headerToken = req.get(CSRF_HEADER);
  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    return res.status(403).json({ message: "Недействительный CSRF-токен. Обновите страницу и попробуйте снова." });
  }
  next();
}

module.exports = { ensureCsrfCookie, verifyCsrf, CSRF_COOKIE, CSRF_HEADER };
