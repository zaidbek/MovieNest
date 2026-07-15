const fs = require("fs");
const path = require("path");

// Простая, но безопасная работа с JSON-файлами как с "базой данных":
// - атомарная запись (через временный файл + rename), чтобы не повредить файл
//   при падении процесса посреди записи;
// - очередь записи на каждый файл, чтобы параллельные запросы не перезаписывали
//   данные друг друга (race condition при конкурентных POST-запросах).

const queues = new Map(); // filePath -> Promise (хвост очереди)

function readJSON(filePath, fallback = []) {
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    if (!raw.trim()) return fallback;
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === "ENOENT") return fallback;
    console.error(`Ошибка чтения ${filePath}:`, err.message);
    return fallback;
  }
}

function writeJSONAtomic(filePath, data) {
  const dir = path.dirname(filePath);
  const tmpPath = path.join(dir, `.${path.basename(filePath)}.${process.pid}.${Date.now()}.tmp`);
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), "utf-8");
  fs.renameSync(tmpPath, filePath);
}

/**
 * Выполняет функцию mutator(currentData) -> newData над файлом атомарно
 * и последовательно относительно других вызовов для этого же файла.
 */
function enqueueMutation(filePath, mutator, fallback = []) {
  const prev = queues.get(filePath) || Promise.resolve();
  const next = prev
    .catch(() => {}) // не даём одной ошибке сломать всю очередь
    .then(() => {
      const current = readJSON(filePath, fallback);
      const result = mutator(current);
      const newData = result && result.data !== undefined ? result.data : current;
      writeJSONAtomic(filePath, newData);
      return result && result.data !== undefined ? result.returnValue : undefined;
    });
  queues.set(filePath, next);
  return next;
}

module.exports = { readJSON, writeJSONAtomic, enqueueMutation };
