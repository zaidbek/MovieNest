const { MongoClient } = require("mongodb");

// Единая точка подключения к MongoDB (Atlas free tier или любой другой сервер).
// В отличие от локальных JSON-файлов, эта база живёт ОТДЕЛЬНО от контейнера
// backend'а — поэтому перезапуск/пересборка/"засыпание" сервера на Render
// (или любом другом хостинге) больше не может стереть данные пользователей:
// они физически хранятся на сервере MongoDB, а не на диске контейнера.
//
// Строка подключения берётся из переменной окружения MONGODB_URI, например:
//   mongodb+srv://user:password@cluster0.xxxxx.mongodb.net/movienest
// Имя базы данных — это последний сегмент пути в самой строке (здесь "movienest").
// См. backend/.env.example и DEPLOY.md — там описано, как создать бесплатный
// кластер на MongoDB Atlas и получить эту строку.

const uri = process.env.MONGODB_URI;

if (!uri) {
  console.error(
    "❌ MONGODB_URI не задан в переменных окружения. Без него сервер не может " +
      "подключиться к базе данных, и XP/пользователи/лидерборд не будут сохраняться. " +
      "Смотрите backend/.env.example и DEPLOY.md."
  );
}

const client = uri ? new MongoClient(uri, { maxPoolSize: 10 }) : null;

let connectPromise = null;

/**
 * Ленивое подключение — переиспользует один и тот же промис/соединение на
 * все запросы (пул соединений держит сам драйвер MongoDB). Вызывается из
 * каждого репозитория перед обращением к коллекции, но реально соединение
 * устанавливается только один раз за жизнь процесса.
 */
function connect() {
  if (!client) {
    return Promise.reject(new Error("MONGODB_URI не задан"));
  }
  if (!connectPromise) {
    connectPromise = client
      .connect()
      .then(() => {
        console.log("✅ MongoDB подключена");
        return client.db(); // имя базы — из строки подключения
      })
      .catch((err) => {
        connectPromise = null; // при ошибке разрешаем повторить попытку на следующем запросе
        throw err;
      });
  }
  return connectPromise;
}

async function getCollection(name) {
  const db = await connect();
  return db.collection(name);
}

// Индексы гарантируют уникальность (email, id пользователя и т.п.) и ускоряют
// частые выборки (например, "все начисления XP этого пользователя").
// Вызывается один раз при старте сервера — создание уже существующего
// индекса безопасно (MongoDB просто ничего не делает).
async function ensureIndexes() {
  const db = await connect();
  await Promise.all([
    db.collection("users").createIndex({ id: 1 }, { unique: true }),
    db.collection("users").createIndex({ email: 1 }, { unique: true }),
    db.collection("xp_history").createIndex({ userId: 1 }),
    db.collection("achievements").createIndex({ userId: 1, key: 1 }, { unique: true }),
    db.collection("user_challenges").createIndex({ userId: 1, challengeId: 1 }, { unique: true }),
    db.collection("comments").createIndex({ movieId: 1 }),
    db.collection("daily_login").createIndex({ userId: 1, date: 1 }, { unique: true }),
    db.collection("watch_history").createIndex({ userId: 1, movieId: 1 }, { unique: true }),
  ]);
  console.log("✅ Индексы MongoDB проверены/созданы");
}

module.exports = { connect, getCollection, ensureIndexes, client };
