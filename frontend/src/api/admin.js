import { apiRequest } from "./client.js";

export async function fetchAdminUsers({ search = "", page = 1, pageSize = 20 } = {}) {
  const params = new URLSearchParams();
  if (search) params.set("search", search);
  params.set("page", String(page));
  params.set("pageSize", String(pageSize));
  return apiRequest(`/admin/users?${params.toString()}`);
}

export async function fetchAdminUserDetail(id) {
  return apiRequest(`/admin/users/${id}`);
}

// ── Управление ролями (только Super Admin) ─────────────────────────────────
export async function fetchAdmins() {
  return apiRequest("/admin/admins");
}

export async function promoteUser(id) {
  return apiRequest(`/admin/users/${id}/promote`, { method: "POST" });
}

export async function demoteUser(id) {
  return apiRequest(`/admin/users/${id}/demote`, { method: "POST" });
}

export async function promoteUserByEmail(email) {
  return apiRequest("/admin/users/by-email/promote", { method: "POST", body: { email } });
}

// ── Управление контентом (дорамы) ──────────────────────────────────────────
export async function createMovie(payload) {
  return apiRequest("/movies", { method: "POST", body: payload });
}

export async function updateMovie(id, payload) {
  return apiRequest(`/movies/${id}`, { method: "PUT", body: payload });
}

export async function deleteMovie(id) {
  return apiRequest(`/movies/${id}`, { method: "DELETE" });
}
