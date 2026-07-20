const express = require("express");
const fs = require("fs");
const path = require("path");

const { requireAuth } = require("../middleware/auth");
const { requireAdmin, requireSuperAdmin } = require("../middleware/admin");
const { ROLES, isSuperAdminEmail } = require("../config/roles");
const usersRepo = require("../store/usersRepo");
const statsRepo = require("../store/statsRepo");
const watchProgressRepo = require("../store/watchProgressRepo");
const achievementsRepo = require("../store/achievementsRepo");
const challengesRepo = require("../store/challengesRepo");
const xpRepo = require("../store/xpRepo");
const dailyLoginRepo = require("../store/dailyLoginRepo");
const { levelProgress } = require("../store/gamification");

const router = express.Router();
const MOVIES_FILE = path.join(__dirname, "..", "data", "movies.json");

function moviesById() {
  const movies = JSON.parse(fs.readFileSync(MOVIES_FILE, "utf-8"));
  const map = new Map();
  movies.forEach((m) => map.set(String(m.id), m));
  return map;
}

router.use(requireAuth, requireAdmin);

// GET /api/admin/users?search=&page=1&pageSize=20
// Раздел "Статистика пользователей": список всех пользователей с количеством
// просмотренных фильмов/мультфильмов/дорам, временем на сайте, датами
// регистрации и последнего входа. Поддерживает поиск по email.
router.get("/users", async (req, res) => {
  try {
    const search = String(req.query.search || "").trim().toLowerCase();
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize, 10) || 20));

    let users = await usersRepo.allUsers();
    if (search) {
      users = users.filter((u) => u.email.toLowerCase().includes(search));
    }

    const total = users.length;
    const start = (page - 1) * pageSize;
    const pageUsers = users.slice(start, start + pageSize);

    const rows = await Promise.all(
      pageUsers.map(async (u) => {
        const stats = await statsRepo.computeStats(u.id);
        const lp = levelProgress(stats.xp);
        return {
          id: u.id,
          email: u.email,
          role: u.role,
          avatarSeed: u.avatarSeed,
          createdAt: u.createdAt,
          lastLoginAt: u.lastLoginAt,
          loginStreak: u.loginStreak,
          moviesWatched: stats.moviesWatched,
          cartoonsWatched: stats.cartoonsWatched,
          doramasWatched: stats.doramasWatched,
          totalWatched: stats.totalWatched,
          timeSpentSeconds: stats.totalWatchedSeconds,
          level: lp.level,
          xp: stats.xp,
          challengesCompleted: stats.challengesCompleted,
        };
      })
    );

    res.json({ total, page, pageSize, users: rows });
  } catch (err) {
    console.error("Ошибка загрузки списка пользователей:", err);
    res.status(500).json({ message: "Не удалось загрузить список пользователей" });
  }
});

// GET /api/admin/users/:id — детальная карточка пользователя для админки:
// процент просмотра каждого фильма, последние действия, достижения, челленджи.
router.get("/users/:id", async (req, res) => {
  try {
    const user = await usersRepo.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "Пользователь не найден" });

    const stats = await statsRepo.computeStats(user.id);
    const lp = levelProgress(stats.xp);
    const movies = moviesById();

    const rawWatchHistory = await watchProgressRepo.allForUser(user.id);
    const watchHistory = rawWatchHistory.map((h) => ({
      movieId: h.movieId,
      title: movies.get(h.movieId)?.title || "Неизвестный фильм",
      type: h.movieType,
      percent: h.percent,
      completed: h.completed,
      watchedSeconds: Math.round(h.watchedSeconds),
      durationSeconds: h.durationSeconds,
      updatedAt: h.updatedAt,
    }));

    const [recentXp, achievements, challenges, loginHistory] = await Promise.all([
      xpRepo.recentForUser(user.id, 15),
      achievementsRepo.achievementsWithStatus(user.id, stats),
      challengesRepo.challengesWithProgress(user.id, stats),
      dailyLoginRepo.historyForUser(user.id),
    ]);

    const recentActions = [
      ...watchHistory.map((h) => ({
        type: "watch",
        label: `${h.completed ? "Досмотрел" : "Смотрит"} «${h.title}» (${h.percent}%)`,
        at: h.updatedAt,
      })),
      ...recentXp.map((x) => ({ type: "xp", label: `+${x.amount} XP (${x.reason})`, at: x.createdAt })),
    ]
      .sort((a, b) => b.at.localeCompare(a.at))
      .slice(0, 20);

    res.json({
      user: usersRepo.publicUser(user),
      stats: { ...stats, ...lp },
      achievements,
      challenges,
      watchHistory,
      loginHistory,
      recentActions,
    });
  } catch (err) {
    console.error("Ошибка загрузки карточки пользователя:", err);
    res.status(500).json({ message: "Не удалось загрузить данные пользователя" });
  }
});

// ── Управление ролями (только Super Admin) ─────────────────────────────────
// Всё, что ниже, дополнительно защищено requireSuperAdmin: доступ только для
// пользователя с ролью "superadmin" (единственный владелец — email
// захардкожен в backend/config/roles.js). Роли хранятся в базе данных
// (MongoDB, коллекция users), поэтому назначать/снимать администраторов можно
// прямо через сайт — без изменения исходного кода и без повторной публикации
// проекта в GitHub.

// GET /api/admin/admins — список всех администраторов и Super Admin'а.
router.get("/admins", requireSuperAdmin, async (req, res) => {
  try {
    const all = await usersRepo.allAdmins();
    const admins = all.map((u) => usersRepo.publicUser(u));
    res.json({ admins });
  } catch (err) {
    console.error("Ошибка загрузки списка администраторов:", err);
    res.status(500).json({ message: "Не удалось загрузить список администраторов" });
  }
});

// POST /api/admin/users/:id/promote — назначить пользователя администратором.
router.post("/users/:id/promote", requireSuperAdmin, async (req, res) => {
  try {
    const target = await usersRepo.findById(req.params.id);
    if (!target) return res.status(404).json({ message: "Пользователь не найден" });

    if (isSuperAdminEmail(target.email)) {
      return res.status(400).json({ message: "Этот пользователь уже является Super Admin" });
    }
    if (target.role === ROLES.ADMIN) {
      return res.status(400).json({ message: "Пользователь уже администратор" });
    }

    const updated = await usersRepo.setRole(target.id, ROLES.ADMIN);
    res.json({ user: usersRepo.publicUser(updated) });
  } catch (err) {
    console.error("Ошибка назначения администратора:", err);
    res.status(500).json({ message: "Не удалось назначить администратора" });
  }
});

// POST /api/admin/users/:id/demote — снять права администратора.
router.post("/users/:id/demote", requireSuperAdmin, async (req, res) => {
  try {
    const target = await usersRepo.findById(req.params.id);
    if (!target) return res.status(404).json({ message: "Пользователь не найден" });

    if (isSuperAdminEmail(target.email)) {
      return res.status(400).json({ message: "Нельзя снять права у Super Admin" });
    }
    if (target.role !== ROLES.ADMIN) {
      return res.status(400).json({ message: "Пользователь не является администратором" });
    }

    const updated = await usersRepo.setRole(target.id, ROLES.USER);
    res.json({ user: usersRepo.publicUser(updated) });
  } catch (err) {
    console.error("Ошибка снятия прав администратора:", err);
    res.status(500).json({ message: "Не удалось снять права администратора" });
  }
});

// POST /api/admin/users/by-email/promote — найти пользователя по e-mail и
// сразу назначить его администратором (кнопка "Добавить админа по email" в UI).
router.post("/users/by-email/promote", requireSuperAdmin, async (req, res) => {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    if (!email) return res.status(400).json({ message: "Укажите email" });

    const target = await usersRepo.findByEmail(email);
    if (!target) return res.status(404).json({ message: "Пользователь с таким email не найден" });

    if (isSuperAdminEmail(target.email)) {
      return res.status(400).json({ message: "Этот пользователь уже является Super Admin" });
    }
    if (target.role === ROLES.ADMIN) {
      return res.status(400).json({ message: "Пользователь уже администратор" });
    }

    const updated = await usersRepo.setRole(target.id, ROLES.ADMIN);
    res.json({ user: usersRepo.publicUser(updated) });
  } catch (err) {
    console.error("Ошибка назначения администратора по email:", err);
    res.status(500).json({ message: "Не удалось назначить администратора" });
  }
});

module.exports = router;
