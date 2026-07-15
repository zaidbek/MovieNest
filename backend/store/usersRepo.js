const path = require("path");
const crypto = require("crypto");
const { readJSON, enqueueMutation } = require("./jsonStore");
const { ROLES, isSuperAdminEmail, roleForNewUser } = require("../config/roles");

const FILE = path.join(__dirname, "..", "data", "users.json");

// Мягкая миграция — старые записи в users.json могли быть созданы до того,
// как появились геймификация/роли. Подставляем безопасные значения по умолчанию,
// не переписывая файл на каждом чтении.
function withDefaults(user) {
  if (!user) return user;
  return {
    role: ROLES.USER,
    xp: 0,
    favorites: [],
    referrals: 0,
    referralCode: user.id ? user.id.slice(0, 8) : undefined,
    referredBy: null,
    loginStreak: 0,
    lastLoginAt: null,
    lastLoginDate: null,
    ...user,
  };
}

function publicUser(user) {
  if (!user) return null;
  const full = withDefaults(user);
  const { passwordHash, failedLoginAttempts, lockUntil, ...safe } = full;
  return safe;
}

function findByEmail(email) {
  const users = readJSON(FILE, []);
  const normalized = String(email).trim().toLowerCase();
  const found = users.find((u) => u.email === normalized) || null;
  return withDefaults(found);
}

function findById(id) {
  const users = readJSON(FILE, []);
  const found = users.find((u) => u.id === id) || null;
  return withDefaults(found);
}

function findByReferralCode(code) {
  if (!code) return null;
  const users = readJSON(FILE, []);
  const found = users.find((u) => u.id.startsWith(code)) || null;
  return withDefaults(found);
}

async function createUser({ email, passwordHash, referredBy = null }) {
  const normalized = String(email).trim().toLowerCase();
  return enqueueMutation(FILE, (users) => {
    if (users.some((u) => u.email === normalized)) {
      throw new Error("EMAIL_TAKEN");
    }
    // Роль при регистрации определяется ИСКЛЮЧИТЕЛЬНО функцией roleForNewUser:
    // захардкоженный в коде (config/roles.js) email Super Admin'а всегда
    // получает роль "superadmin", все остальные — "user". Никакой другой
    // способ (тело запроса регистрации, заголовки и т.п.) не может выдать
    // повышенную роль — это защищает от повышения привилегий обычным
    // пользователем. Роль "admin" нельзя получить при регистрации — её может
    // выдать только Super Admin через Admin Panel (см. setRole ниже).
    const id = crypto.randomUUID();
    const user = {
      id,
      email: normalized,
      passwordHash,
      avatarSeed: crypto.randomBytes(4).toString("hex"),
      createdAt: new Date().toISOString(),
      failedLoginAttempts: 0,
      lockUntil: null,
      role: roleForNewUser(normalized),
      xp: 0,
      favorites: [],
      referrals: 0,
      referralCode: id.slice(0, 8),
      referredBy: referredBy || null,
      loginStreak: 0,
      lastLoginAt: null,
      lastLoginDate: null,
    };
    return { data: [...users, user], returnValue: user };
  });
}

async function recordLoginFailure(email) {
  const normalized = String(email).trim().toLowerCase();
  const MAX_ATTEMPTS = 5;
  const LOCK_MS = 15 * 60 * 1000; // 15 минут блокировки после подбора пароля
  return enqueueMutation(FILE, (users) => {
    const idx = users.findIndex((u) => u.email === normalized);
    if (idx === -1) return { data: users, returnValue: null };
    const user = { ...users[idx] };
    user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
    if (user.failedLoginAttempts >= MAX_ATTEMPTS) {
      user.lockUntil = new Date(Date.now() + LOCK_MS).toISOString();
      user.failedLoginAttempts = 0;
    }
    const next = [...users];
    next[idx] = user;
    return { data: next, returnValue: user };
  });
}

async function resetLoginFailures(userId) {
  return enqueueMutation(FILE, (users) => {
    const idx = users.findIndex((u) => u.id === userId);
    if (idx === -1) return { data: users, returnValue: null };
    const user = { ...users[idx], failedLoginAttempts: 0, lockUntil: null };
    const next = [...users];
    next[idx] = user;
    return { data: next, returnValue: user };
  });
}

// Начисляет XP пользователю и возвращает { user, prevLevel, newLevel, leveledUp }.
async function addXp(userId, amount) {
  const { levelForXp } = require("./gamification");
  return enqueueMutation(FILE, (users) => {
    const idx = users.findIndex((u) => u.id === userId);
    if (idx === -1) return { data: users, returnValue: null };
    const before = withDefaults(users[idx]);
    const prevLevel = levelForXp(before.xp);
    const nextXp = Math.max(0, (before.xp || 0) + amount);
    const newLevel = levelForXp(nextXp);
    const user = { ...before, xp: nextXp };
    const next = [...users];
    next[idx] = user;
    return {
      data: next,
      returnValue: { user, prevLevel, newLevel, leveledUp: newLevel > prevLevel },
    };
  });
}

// Записывает вход пользователя: обновляет lastLoginAt и стрик посещений (для челленджа
// "7 дней подряд"). Стрик увеличивается максимум один раз в календарный день.
async function recordLogin(userId) {
  return enqueueMutation(FILE, (users) => {
    const idx = users.findIndex((u) => u.id === userId);
    if (idx === -1) return { data: users, returnValue: null };
    const before = withDefaults(users[idx]);
    const today = new Date().toISOString().slice(0, 10);
    let alreadyToday = before.lastLoginDate === today;
    let streak = before.loginStreak || 0;
    if (!alreadyToday) {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      streak = before.lastLoginDate === yesterday ? streak + 1 : 1;
    }
    const user = {
      ...before,
      lastLoginAt: new Date().toISOString(),
      lastLoginDate: today,
      loginStreak: streak,
    };
    const next = [...users];
    next[idx] = user;
    return { data: next, returnValue: { user, isNewDay: !alreadyToday } };
  });
}

async function toggleFavorite(userId, movieId) {
  return enqueueMutation(FILE, (users) => {
    const idx = users.findIndex((u) => u.id === userId);
    if (idx === -1) return { data: users, returnValue: null };
    const before = withDefaults(users[idx]);
    const favorites = new Set((before.favorites || []).map(String));
    const key = String(movieId);
    const added = !favorites.has(key);
    if (added) favorites.add(key); else favorites.delete(key);
    const user = { ...before, favorites: [...favorites] };
    const next = [...users];
    next[idx] = user;
    return { data: next, returnValue: { user, added } };
  });
}

async function incrementReferrals(userId) {
  return enqueueMutation(FILE, (users) => {
    const idx = users.findIndex((u) => u.id === userId);
    if (idx === -1) return { data: users, returnValue: null };
    const before = withDefaults(users[idx]);
    const user = { ...before, referrals: (before.referrals || 0) + 1 };
    const next = [...users];
    next[idx] = user;
    return { data: next, returnValue: user };
  });
}

function allUsers() {
  const users = readJSON(FILE, []);
  return users.map(withDefaults);
}

// Список всех пользователей с ролью admin или superadmin — для раздела
// "Список всех администраторов" в Admin Panel (доступен только Super Admin).
function allAdmins() {
  return allUsers().filter((u) => u.role === ROLES.ADMIN || u.role === ROLES.SUPER_ADMIN);
}

// Назначает/снимает роль admin для пользователя. Управлять ролями может
// только Super Admin (это проверяется в middleware/routes, здесь —
// дополнительные защитные инварианты на уровне данных):
//   - роль superadmin нельзя выдать через этот метод (только 1 захардкоженный
//     в коде владелец — см. config/roles.js);
//   - у пользователя с email Super Admin'а нельзя отобрать роль superadmin;
//   - разрешённые целевые роли — только "user" и "admin".
async function setRole(userId, nextRole) {
  if (nextRole !== ROLES.USER && nextRole !== ROLES.ADMIN) {
    const err = new Error("INVALID_ROLE");
    throw err;
  }
  return enqueueMutation(FILE, (users) => {
    const idx = users.findIndex((u) => u.id === userId);
    if (idx === -1) return { data: users, returnValue: null };
    const before = withDefaults(users[idx]);

    if (isSuperAdminEmail(before.email)) {
      const err = new Error("CANNOT_MODIFY_SUPER_ADMIN");
      throw err;
    }

    const user = { ...before, role: nextRole };
    const next = [...users];
    next[idx] = user;
    return { data: next, returnValue: user };
  });
}

// Гарантирует, что аккаунт с захардкоженным в коде email Super Admin'а (если
// он уже зарегистрирован) имеет роль "superadmin" в базе данных — даже если
// он регистрировался до появления этой логики или его роль была случайно
// изменена напрямую в файле данных. Вызывается один раз при старте сервера.
async function ensureSuperAdminRole() {
  return enqueueMutation(FILE, (users) => {
    const idx = users.findIndex((u) => isSuperAdminEmail(u.email));
    if (idx === -1 || users[idx].role === ROLES.SUPER_ADMIN) {
      return { data: users, returnValue: null };
    }
    const user = { ...users[idx], role: ROLES.SUPER_ADMIN };
    const next = [...users];
    next[idx] = user;
    return { data: next, returnValue: user };
  });
}

module.exports = {
  publicUser,
  withDefaults,
  findByEmail,
  findById,
  findByReferralCode,
  createUser,
  recordLoginFailure,
  resetLoginFailures,
  addXp,
  recordLogin,
  toggleFavorite,
  incrementReferrals,
  allUsers,
  allAdmins,
  setRole,
  ensureSuperAdminRole,
};
