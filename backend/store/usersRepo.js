const crypto = require("crypto");
const { getCollection } = require("./db");
const { ROLES, isSuperAdminEmail, roleForNewUser } = require("../config/roles");

async function usersCol() {
  return getCollection("users");
}

// Мягкая миграция — старые записи могли быть созданы до того, как появились
// геймификация/роли. Подставляем безопасные значения по умолчанию, не
// переписывая документ в базе на каждом чтении.
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
  const { passwordHash, failedLoginAttempts, lockUntil, _id, ...safe } = full;
  return safe;
}

async function findByEmail(email) {
  const normalized = String(email).trim().toLowerCase();
  const col = await usersCol();
  const found = await col.findOne({ email: normalized });
  return withDefaults(found);
}

async function findById(id) {
  const col = await usersCol();
  const found = await col.findOne({ id });
  return withDefaults(found);
}

async function findByReferralCode(code) {
  if (!code) return null;
  const col = await usersCol();
  // referralCode — это первые 8 символов id, поэтому ищем по префиксу id.
  const found = await col.findOne({ id: new RegExp("^" + String(code)) });
  return withDefaults(found);
}

async function createUser({ email, passwordHash, referredBy = null }) {
  const normalized = String(email).trim().toLowerCase();
  const col = await usersCol();

  const existing = await col.findOne({ email: normalized });
  if (existing) {
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

  try {
    await col.insertOne(user);
  } catch (err) {
    // Дублирующийся email из-за гонки двух одновременных регистраций —
    // уникальный индекс на email в MongoDB ловит это надёжнее, чем проверка выше.
    if (err && err.code === 11000) throw new Error("EMAIL_TAKEN");
    throw err;
  }

  return user;
}

async function recordLoginFailure(email) {
  const normalized = String(email).trim().toLowerCase();
  const MAX_ATTEMPTS = 5;
  const LOCK_MS = 15 * 60 * 1000; // 15 минут блокировки после подбора пароля
  const col = await usersCol();

  const user = await col.findOne({ email: normalized });
  if (!user) return null;

  const failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
  const update = { failedLoginAttempts };
  if (failedLoginAttempts >= MAX_ATTEMPTS) {
    update.lockUntil = new Date(Date.now() + LOCK_MS).toISOString();
    update.failedLoginAttempts = 0;
  }

  const updated = await col.findOneAndUpdate(
    { email: normalized },
    { $set: update },
    { returnDocument: "after" }
  );
  return updated;
}

async function resetLoginFailures(userId) {
  const col = await usersCol();
  return col.findOneAndUpdate(
    { id: userId },
    { $set: { failedLoginAttempts: 0, lockUntil: null } },
    { returnDocument: "after" }
  );
}

// Начисляет XP пользователю и возвращает { user, prevLevel, newLevel, leveledUp }.
// XP НИКОГДА не должен уменьшаться автоматически — единственное место в коде,
// где меняется поле xp, поэтому это ограничение проверяется прямо здесь:
// отрицательная сумма (то есть попытка отнять XP) отклоняется программной
// ошибкой, а не молча выполняется.
async function addXp(userId, amount) {
  const { levelForXp } = require("./gamification");

  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error("XP_AMOUNT_MUST_BE_NON_NEGATIVE");
  }
  if (amount === 0) {
    const user = await findById(userId);
    if (!user) return null;
    const level = levelForXp(user.xp || 0);
    return { user, prevLevel: level, newLevel: level, leveledUp: false };
  }

  const col = await usersCol();
  // $inc — атомарная операция на стороне MongoDB: даже если несколько
  // запросов начисляют XP одному пользователю одновременно (например, две
  // вкладки досмотрели видео почти в одно время), очков не теряется и не
  // задваивается — сервер базы данных сам сериализует инкременты.
  const updated = await col.findOneAndUpdate(
    { id: userId },
    { $inc: { xp: amount } },
    { returnDocument: "after" }
  );
  if (!updated) return null;

  const newXp = updated.xp;
  const prevXp = newXp - amount;
  const prevLevel = levelForXp(prevXp);
  const newLevel = levelForXp(newXp);

  return {
    user: withDefaults(updated),
    prevLevel,
    newLevel,
    leveledUp: newLevel > prevLevel,
  };
}

// Записывает вход пользователя: обновляет lastLoginAt и стрик посещений (для челленджа
// "7 дней подряд"). Стрик увеличивается максимум один раз в календарный день.
async function recordLogin(userId) {
  const col = await usersCol();
  const before = withDefaults(await col.findOne({ id: userId }));
  if (!before) return null;

  const today = new Date().toISOString().slice(0, 10);
  const alreadyToday = before.lastLoginDate === today;
  let streak = before.loginStreak || 0;
  if (!alreadyToday) {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    streak = before.lastLoginDate === yesterday ? streak + 1 : 1;
  }

  const updated = await col.findOneAndUpdate(
    { id: userId },
    {
      $set: {
        lastLoginAt: new Date().toISOString(),
        lastLoginDate: today,
        loginStreak: streak,
      },
    },
    { returnDocument: "after" }
  );

  return { user: withDefaults(updated), isNewDay: !alreadyToday };
}

async function toggleFavorite(userId, movieId) {
  const col = await usersCol();
  const before = withDefaults(await col.findOne({ id: userId }));
  if (!before) return null;

  const favorites = new Set((before.favorites || []).map(String));
  const key = String(movieId);
  const added = !favorites.has(key);
  if (added) favorites.add(key); else favorites.delete(key);

  const updated = await col.findOneAndUpdate(
    { id: userId },
    { $set: { favorites: [...favorites] } },
    { returnDocument: "after" }
  );

  return { user: withDefaults(updated), added };
}

async function incrementReferrals(userId) {
  const col = await usersCol();
  const updated = await col.findOneAndUpdate(
    { id: userId },
    { $inc: { referrals: 1 } },
    { returnDocument: "after" }
  );
  return withDefaults(updated);
}

async function allUsers() {
  const col = await usersCol();
  const users = await col.find({}).toArray();
  return users.map(withDefaults);
}

// Список всех пользователей с ролью admin или superadmin — для раздела
// "Список всех администраторов" в Admin Panel (доступен только Super Admin).
async function allAdmins() {
  const users = await allUsers();
  return users.filter((u) => u.role === ROLES.ADMIN || u.role === ROLES.SUPER_ADMIN);
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
    throw new Error("INVALID_ROLE");
  }
  const col = await usersCol();
  const before = withDefaults(await col.findOne({ id: userId }));
  if (!before) return null;

  if (isSuperAdminEmail(before.email)) {
    throw new Error("CANNOT_MODIFY_SUPER_ADMIN");
  }

  const updated = await col.findOneAndUpdate(
    { id: userId },
    { $set: { role: nextRole } },
    { returnDocument: "after" }
  );
  return withDefaults(updated);
}

// Гарантирует, что аккаунт с захардкоженным в коде email Super Admin'а (если
// он уже зарегистрирован) имеет роль "superadmin" в базе данных — даже если
// он регистрировался до появления этой логики или его роль была случайно
// изменена напрямую в базе. Вызывается один раз при старте сервера.
async function ensureSuperAdminRole() {
  const col = await usersCol();
  const users = await col.find({}).toArray();
  const target = users.find((u) => isSuperAdminEmail(u.email));
  if (!target || target.role === ROLES.SUPER_ADMIN) return null;

  const updated = await col.findOneAndUpdate(
    { id: target.id },
    { $set: { role: ROLES.SUPER_ADMIN } },
    { returnDocument: "after" }
  );
  return withDefaults(updated);
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
