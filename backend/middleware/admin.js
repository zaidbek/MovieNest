const { ROLES } = require("../config/roles");

// Доступ для админ-раздела статистики/контента: роль admin ИЛИ superadmin.
function requireAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ message: "Требуется авторизация" });
  if (req.user.role !== ROLES.ADMIN && req.user.role !== ROLES.SUPER_ADMIN) {
    return res.status(403).json({ message: "Доступ только для администраторов" });
  }
  next();
}

// Доступ к управлению ролями (назначение/снятие администраторов) — строго
// только для Super Admin. Обязательно применяется ПОСЛЕ requireAuth, чтобы
// req.user был актуальным (роль всегда читается заново из базы данных на
// каждый запрос — см. middleware/auth.js), а не взят из старого JWT/кэша.
function requireSuperAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ message: "Требуется авторизация" });
  if (req.user.role !== ROLES.SUPER_ADMIN) {
    return res.status(403).json({ message: "Доступ только для Super Admin" });
  }
  next();
}

module.exports = { requireAdmin, requireSuperAdmin };
