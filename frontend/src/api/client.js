// Общий клиент для запросов к API.
// - credentials: "include" — чтобы браузер отправлял HttpOnly cookie с JWT.
// - Для изменяющих запросов (POST/PUT/PATCH/DELETE) автоматически подставляется
//   CSRF-токен из читаемой cookie XSRF-TOKEN в заголовок X-XSRF-TOKEN
//   (double-submit cookie защита, см. backend/middleware/csrf.js).

const API_ROOT = "https://movienest-5gu8.onrender.com/api" || "/api";
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function getCookie(name) {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export class ApiError extends Error {
  constructor(message, status, payload) {
    super(message);
    this.status = status;
    this.payload = payload;
  }
}

export async function apiRequest(path, { method = "GET", body, headers = {} } = {}) {
  const finalHeaders = { ...headers };
  let finalBody = body;

  if (body !== undefined) {
    finalHeaders["Content-Type"] = "application/json";
    finalBody = JSON.stringify(body);
  }

  if (!SAFE_METHODS.has(method)) {
    const csrfToken = getCookie("XSRF-TOKEN");
    if (csrfToken) finalHeaders["X-XSRF-TOKEN"] = csrfToken;
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
    throw new ApiError(data?.message || "Ошибка запроса к серверу", response.status, data);
  }
  return data;
}
