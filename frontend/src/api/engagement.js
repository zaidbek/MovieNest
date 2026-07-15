import { apiRequest } from "./client.js";

// ── Просмотр (реальный прогресс, проверяется на сервере) ────────────────
export async function startView(movieId) {
  return apiRequest(`/views/${movieId}/start`, { method: "POST" });
}

export async function sendHeartbeat(movieId, { sessionId, visible, focused }) {
  return apiRequest(`/views/${movieId}/heartbeat`, {
    method: "POST",
    body: { sessionId, visible, focused },
  });
}

export async function fetchViewProgress(movieId) {
  return apiRequest(`/views/${movieId}`);
}

export async function fetchMyViewCount() {
  return apiRequest("/views/me");
}

// ── Достижения / челленджи / лидерборд ───────────────────────────────────
export async function fetchLeaderboard() {
  return apiRequest("/leaderboard");
}

export async function fetchMyChallenges() {
  return apiRequest("/challenges/me");
}

export async function toggleFavorite(movieId) {
  return apiRequest(`/users/favorites/${movieId}`, { method: "POST" });
}

// ── Комментарии ───────────────────────────────────────────────────────────
export async function fetchComments(movieId) {
  return apiRequest(`/comments/${movieId}`);
}

export async function postComment(movieId, text) {
  return apiRequest(`/comments/${movieId}`, { method: "POST", body: { text } });
}
