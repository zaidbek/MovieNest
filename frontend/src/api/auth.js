import { apiRequest } from "./client.js";

export async function registerRequest(email, password, ref) {
  return apiRequest("/auth/register", { method: "POST", body: { email, password, ref } });
}

export async function loginRequest(email, password) {
  return apiRequest("/auth/login", { method: "POST", body: { email, password } });
}

export async function logoutRequest() {
  return apiRequest("/auth/logout", { method: "POST" });
}

export async function fetchCurrentUser() {
  return apiRequest("/auth/me");
}

export async function fetchMyProfile() {
  return apiRequest("/users/me");
}
