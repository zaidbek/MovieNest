const path = require("path");
const crypto = require("crypto");
const { readJSON, enqueueMutation } = require("./jsonStore");

const FILE = path.join(__dirname, "..", "data", "comments.json");
const MAX_LENGTH = 1000;

function listForMovie(movieId) {
  const comments = readJSON(FILE, []);
  return comments
    .filter(c => c.movieId === movieId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

async function addComment({ movieId, userId, username, text }) {
  const trimmed = String(text || "").trim().slice(0, MAX_LENGTH);
  if (!trimmed) throw new Error("EMPTY_COMMENT");
  return enqueueMutation(FILE, (comments) => {
    const comment = {
      id: crypto.randomUUID(),
      movieId,
      userId,
      username,
      text: trimmed,
      createdAt: new Date().toISOString(),
    };
    return { data: [...comments, comment], returnValue: comment };
  });
}

module.exports = { listForMovie, addComment, MAX_LENGTH };
