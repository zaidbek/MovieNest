import { apiRequest } from "./client.js";

export async function fetchMovies(params = {}) {
  const query = new URLSearchParams(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== "")
  ).toString();
  return apiRequest(`/movies${query ? `?${query}` : ""}`);
}

export async function fetchMovieBySlug(slug) {
  return apiRequest(`/movies/${slug}`);
}

export async function fetchGenres(type) {
  const query = type ? `?type=${type}` : "";
  return apiRequest(`/movies/genres${query}`);
}
