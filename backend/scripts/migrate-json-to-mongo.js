/**
 * Одноразовый скрипт миграции: переносит данные из старых локальных
 * JSON-файлов (backend/data/*.json) в MongoDB.
 *
 * Зачем это нужно: если сайт уже некоторое время работал на старом
 * хранилище (файлы), в них могут быть реальные пользователи, начисленный
 * XP, история просмотров и т.д. Простой переход на MongoDB "с нуля" обнулил
 * бы прогресс всех, кто уже зарегистрировался. Этот скрипт один раз
 * копирует всё, что есть в файлах, в соответствующие коллекции MongoDB —
 * дальше сервер работает уже полностью через базу данных (см. server.js,
 * store/*.js), а эти JSON-файлы можно удалить.
 *
 * Запуск (из папки backend, с уже заданным MONGODB_URI в .env):
 *   node scripts/migrate-json-to-mongo.js
 *
 * Скрипт идемпотентен: коллекции очищаются перед вставкой (upsert по
 * уникальным ключам), поэтому его можно безопасно запустить повторно.
 */
require("dotenv").config();
const path = require("path");
const { readJSON } = require("../store/jsonStore");
const { connect, ensureIndexes } = require("../store/db");

const DATA_DIR = path.join(__dirname, "..", "data");

async function migrateCollection(db, { file, collectionName, uniqueKeys }) {
  const filePath = path.join(DATA_DIR, file);
  const rows = readJSON(filePath, []);
  if (!rows.length) {
    console.log(`— ${file}: пусто, пропускаем`);
    return 0;
  }

  const col = db.collection(collectionName);
  let upserted = 0;

  for (const row of rows) {
    const filter = {};
    for (const key of uniqueKeys) filter[key] = row[key];
    await col.updateOne(filter, { $set: row }, { upsert: true });
    upserted += 1;
  }

  console.log(`✅ ${file} → коллекция "${collectionName}": ${upserted} записей`);
  return upserted;
}

async function run() {
  console.log("Подключаемся к MongoDB...");
  const db = await connect();
  await ensureIndexes();

  await migrateCollection(db, {
    file: "users.json",
    collectionName: "users",
    uniqueKeys: ["id"],
  });
  await migrateCollection(db, {
    file: "xp_history.json",
    collectionName: "xp_history",
    uniqueKeys: ["id"],
  });
  await migrateCollection(db, {
    file: "achievements.json",
    collectionName: "achievements",
    uniqueKeys: ["userId", "key"],
  });
  await migrateCollection(db, {
    file: "user_challenges.json",
    collectionName: "user_challenges",
    uniqueKeys: ["userId", "challengeId"],
  });
  await migrateCollection(db, {
    file: "comments.json",
    collectionName: "comments",
    uniqueKeys: ["id"],
  });
  await migrateCollection(db, {
    file: "daily_login.json",
    collectionName: "daily_login",
    uniqueKeys: ["userId", "date"],
  });
  await migrateCollection(db, {
    file: "watch_history.json",
    collectionName: "watch_history",
    uniqueKeys: ["userId", "movieId"],
  });

  console.log("\n🎉 Миграция завершена. Данные теперь в MongoDB.");
  console.log(
    "Старые JSON-файлы в backend/data больше не используются сервером — их можно оставить как есть (они в .gitignore) или удалить вручную."
  );
  process.exit(0);
}

run().catch((err) => {
  console.error("❌ Ошибка миграции:", err);
  process.exit(1);
});
