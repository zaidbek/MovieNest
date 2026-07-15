// Единый источник правды по ролям пользователей.
//
// ВАЖНО: e-mail единственного Super Admin'а задаётся здесь, в коде проекта,
// а НЕ в .env. Это сделано намеренно:
//   - .env-файл обычно не попадает в GitHub (он в .gitignore) и не хранится
//     в базе данных — при редеплое/на новом сервере такие настройки легко
//     потерять;
//   - роль Super Admin — это не "секрет" (пароль/ключ), а часть бизнес-логики
//     приложения, поэтому ей место в исходном коде, который версионируется;
//   - все ОСТАЛЬНЫЕ роли (admin/user) хранятся только в базе данных
//     (backend/data/users.json) и управляются через Admin Panel — их можно
//     менять после публикации на GitHub без единой правки кода.
//
// Если понадобится сменить владельца Super Admin — это единственная строка,
// которую нужно поменять в коде.
const SUPER_ADMIN_EMAIL = "makhatovzqid@gmail.com";

const ROLES = Object.freeze({
  USER: "user",
  ADMIN: "admin",
  SUPER_ADMIN: "superadmin",
});

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function isSuperAdminEmail(email) {
  return normalizeEmail(email) === SUPER_ADMIN_EMAIL;
}

// Роль, которую должен иметь пользователь с данным email при регистрации /
// при проверке целостности данных. Всегда либо "superadmin" (для
// захардкоженного владельца), либо "user" по умолчанию — обычные админы
// назначаются позже, через базу данных, а не на этапе регистрации.
function roleForNewUser(email) {
  return isSuperAdminEmail(email) ? ROLES.SUPER_ADMIN : ROLES.USER;
}

module.exports = {
  SUPER_ADMIN_EMAIL,
  ROLES,
  isSuperAdminEmail,
  roleForNewUser,
  normalizeEmail,
};
