const crypto = require("crypto");
const { getCollection } = require("./db");

const MAX_LENGTH = 1000;

async function commentsCol() {
  return getCollection("comments");
}

async function listForMovie(movieId) {
  const col = await commentsCol();
  const comments = await col.find({ movieId }).toArray();
  return comments.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

async function addComment({ movieId, userId, username, text }) {
  const trimmed = String(text || "").trim().slice(0, MAX_LENGTH);
  if (!trimmed) throw new Error("EMPTY_COMMENT");

  const comment = {
    id: crypto.randomUUID(),
    movieId,
    userId,
    username,
    text: trimmed,
    createdAt: new Date().toISOString(),
  };

  const col = await commentsCol();
  await col.insertOne(comment);
  return comment;
}

module.exports = { listForMovie, addComment, MAX_LENGTH };
