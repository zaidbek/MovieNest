// Общий клиент для запросов к API.
// - credentials: "include" — чтобы браузер отправлял HttpOnly cookie с JWT.
// - Для изменяющих запросов (POST/PUT/PATCH/DELETE) подставляется CSRF-токен
//   в заголовок X-XSRF-TOKEN (double-submit защита, см. backend/middleware/csrf.js).
//
//   Токен мы получаем через GET /api/csrf-token (JSON-ответ), а НЕ через
//   чтение cookie XSRF-TOKEN из document.cookie. Дело в том, что frontend
//   (github.io) и backend (onrender.com) — РАЗНЫЕ домены: cookie, которую
//   установил сервер на onrender.com, физически не видна document.cookie
//   на странице, загруженной с github.io (браузер отдаёт JS только cookie
//   собственного домена страницы — это не CORS, а изоляция cookie по
//   домену, и её нельзя обойти настройками CORS/SameSite). Поэтому раньше
//   getCookie() всегда возвращал null, заголовок X-XSRF-TOKEN не
//   отправлялся, и любой POST/PUT/DELETE получал 403. Сама же cookie при
//   этом продолжает исправно долетать до сервера с каждым запросом —
//   браузер прикрепляет её по домену НАЗНАЧЕНИЯ запроса, а не по домену
//   страницы, — так что сверка на сервере (middleware/csrf.js) не менялась.

// Берём адрес backend'а из переменной окружения VITE_API_ROOT (задаётся в
// GitHub → Settings → Secrets and variables → Actions → Variables, см.
// .github/workflows/deploy-pages.yml). Если переменная не задана (например,
// её забыли настроить), в проде используется резервный адрес — чтобы сайт
// не переставал работать из-за забытой настройки. В dev-режиме (`npm run
// dev`) используется относительный "/api", который Vite проксирует на
// локальный backend (см. vite.config.js).
const FALLBACK_PROD_API_ROOT = "https://movienest-5gu8.onrender.com/api";
const API_ROOT =
  import.meta.env.VITE_API_ROOT || (import.meta.env.PROD ? FALLBACK_PROD_API_ROOT : "/api");
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export class ApiError extends Error {
  constructor(message, status, payload) {
    super(message);
    this.status = status;
    this.payload = payload;
  }
}

// Кешируем токен в памяти на время жизни вкладки — не нужно запрашивать
// его перед каждым изменяющим запросом. Promise (а не просто значение)
// используется, чтобы параллельные запросы не породили несколько gонок за
// токеном одновременно.
let csrfTokenPromise = null;

async function fetchCsrfToken() {
  const response = await fetch(`${API_ROOT}/csrf-token`, { credentials: "include" });
  if (!response.ok) throw new Error("Не удалось получить CSRF-токен");
  const data = await response.json();
  return data.csrfToken;
}

function getCsrfToken({ forceRefresh = false } = {}) {
  if (forceRefresh || !csrfTokenPromise) {
    csrfTokenPromise = fetchCsrfToken().catch((err) => {
      csrfTokenPromise = null; // не кешируем неудачную попытку
      throw err;
    });
  }
  return csrfTokenPromise;
}

export async function apiRequest(path, { method = "GET", body, headers = {} } = {}, _isRetry = false) {
  const finalHeaders = { ...headers };
  let finalBody = body;

  if (body !== undefined) {
    finalHeaders["Content-Type"] = "application/json";
    finalBody = JSON.stringify(body);
  }

  if (!SAFE_METHODS.has(method)) {
    finalHeaders["X-XSRF-TOKEN"] = await getCsrfToken();
  }

  const response = await fetch(`${API_ROOT}${path}`, {
    method,
    headers: finalHeaders,
    body: finalBody,
    credentials: "include",
  });

  let data = null;
  const text = await response.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }

  if (!response.ok) {
    // Токен мог устареть (например, сервер на Render "проснулся" заново
    // и очистил старый) — один раз тихо обновляем его и повторяем запрос,
    // прежде чем показывать ошибку пользователю.
    const isCsrfError = response.status === 403 && data?.message?.includes("CSRF");
    if (isCsrfError && !_isRetry) {
      await getCsrfToken({ forceRefresh: true });
      return apiRequest(path, { method, body, headers }, true);
    }
    throw new ApiError(data?.message || "Ошибка запроса к серверу", response.status, data);
  }
  return data;
}
