const { TOKEN_COOKIE, verifyToken } = require("../utils/auth");
const { findById } = require("../store/usersRepo");

function getUserFromRequest(req) {
  const token = req.cookies ? req.cookies[TOKEN_COOKIE] : null;
  if (!token) return null;
  try {
    const payload = verifyToken(token);
    const user = findById(payload.sub);
    return user || null;
  } catch (err) {
    return null;
  }
}

function requireAuth(req, res, next) {
  const user = getUserFromRequest(req);
  if (!user) return res.status(401).json({ message: "Требуется авторизация" });
  req.user = user;
  next();
}

function optionalAuth(req, res, next) {
  req.user = getUserFromRequest(req);
  next();
}

module.exports = { requireAuth, optionalAuth };
