const { TOKEN_COOKIE, verifyToken } = require("../utils/auth");
const { findById } = require("../store/usersRepo");

async function getUserFromRequest(req) {
  const token = req.cookies ? req.cookies[TOKEN_COOKIE] : null;
  if (!token) return null;
  try {
    const payload = verifyToken(token);
    const user = await findById(payload.sub);
    return user || null;
  } catch (err) {
    return null;
  }
}

async function requireAuth(req, res, next) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return res.status(401).json({ message: "Требуется авторизация" });
    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

async function optionalAuth(req, res, next) {
  try {
    req.user = await getUserFromRequest(req);
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { requireAuth, optionalAuth };
