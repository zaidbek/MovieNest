// Единый источник правды для XP, уровней, достижений и челленджей —
// используется backend'ом (начисление/проверка) и отдаётся на фронтенд (отображение).

// ── XP ──────────────────────────────────────────────────────────────────
const XP_REWARDS = {
  movie: 100,
  cartoon: 80,
  dorama: 120,
  dailyLogin: 20,
  challenge: 300,
};

const XP_PER_LEVEL = 500; // фиксированный шаг — просто и предсказуемо для пользователя

function levelForXp(xp) {
  return Math.floor(Math.max(0, xp) / XP_PER_LEVEL) + 1;
}

function levelProgress(xp) {
  const level = levelForXp(xp);
  const xpIntoLevel = Math.max(0, xp) % XP_PER_LEVEL;
  return {
    level,
    xp,
    xpIntoLevel,
    xpForNextLevel: XP_PER_LEVEL,
    percent: Math.round((xpIntoLevel / XP_PER_LEVEL) * 100),
  };
}

function xpForMovieType(type) {
  if (type === "cartoon") return XP_REWARDS.cartoon;
  if (type === "dorama") return XP_REWARDS.dorama;
  return XP_REWARDS.movie;
}

// ── Достижения ──────────────────────────────────────────────────────────
// check(stats) получает агрегированную статистику пользователя (см. store/statsRepo.js)
const ACHIEVEMENTS = [
  {
    key: "newbie",
    icon: "🥉",
    title: "Новичок",
    description: "Посмотрите свой первый фильм, мультфильм или дораму",
    check: (s) => s.totalWatched >= 1,
  },
  {
    key: "cinephile",
    icon: "🥈",
    title: "Киноман",
    description: "Посмотрите 15 фильмов, мультфильмов или дорам",
    check: (s) => s.totalWatched >= 15,
  },
  {
    key: "legend",
    icon: "🥇",
    title: "Легенда MovieNest",
    description: "Посмотрите 50 фильмов, мультфильмов или дорам",
    check: (s) => s.totalWatched >= 50,
  },
  {
    key: "vip",
    icon: "👑",
    title: "VIP-зритель",
    description: "Достигните 10 уровня",
    check: (s) => s.level >= 10,
  },
  {
    key: "dorama_master",
    icon: "🎬",
    title: "Мастер дорам",
    description: "Посмотрите 10 дорам",
    check: (s) => s.doramasWatched >= 10,
  },
  {
    key: "cartoon_lover",
    icon: "🍿",
    title: "Любитель мультфильмов",
    description: "Посмотрите 10 мультфильмов",
    check: (s) => s.cartoonsWatched >= 10,
  },
];

function achievementsUnlockedBy(stats) {
  return ACHIEVEMENTS.filter((a) => a.check(stats));
}

// ── Челленджи ───────────────────────────────────────────────────────────
// metric — поле в объекте stats, по которому считается прогресс
const CHALLENGES = [
  {
    id: "watch_3_movies",
    icon: "🎥",
    title: "Посмотри 3 фильма",
    description: "Полностью просмотрите 3 фильма",
    metric: "moviesWatched",
    target: 3,
    rewardXp: XP_REWARDS.challenge,
  },
  {
    id: "watch_5_cartoons",
    icon: "🧸",
    title: "Посмотри 5 мультфильмов",
    description: "Полностью просмотрите 5 мультфильмов",
    metric: "cartoonsWatched",
    target: 5,
    rewardXp: XP_REWARDS.challenge,
  },
  {
    id: "watch_2_doramas",
    icon: "🎎",
    title: "Посмотри 2 дорамы",
    description: "Полностью просмотрите 2 дорамы",
    metric: "doramasWatched",
    target: 2,
    rewardXp: XP_REWARDS.challenge,
  },
  {
    id: "week_streak",
    icon: "🔥",
    title: "Смотри сайт 7 дней подряд",
    description: "Заходите на MovieNest 7 дней подряд",
    metric: "loginStreak",
    target: 7,
    rewardXp: XP_REWARDS.challenge,
  },
  {
    id: "full_watch_no_skip",
    icon: "🎯",
    title: "Посмотри фильм полностью без перемотки",
    description: "Досмотрите один фильм на 100% без перемотки вперёд",
    metric: "fullWatchesNoSkip",
    target: 1,
    rewardXp: XP_REWARDS.challenge,
  },
  {
    id: "genres_10",
    icon: "🎭",
    title: "Посмотри 10 разных жанров",
    description: "Просмотрите фильмы 10 разных жанров",
    metric: "distinctGenres",
    target: 10,
    rewardXp: XP_REWARDS.challenge,
  },
  {
    id: "invite_friend",
    icon: "🤝",
    title: "Пригласи друга",
    description: "Пригласите друга по вашей реферальной ссылке",
    metric: "referrals",
    target: 1,
    rewardXp: XP_REWARDS.challenge,
  },
  {
    id: "add_favorite",
    icon: "❤️",
    title: "Добавь фильм в избранное",
    description: "Добавьте хотя бы один фильм в избранное",
    metric: "favoritesCount",
    target: 1,
    rewardXp: XP_REWARDS.challenge,
  },
];

module.exports = {
  XP_REWARDS,
  XP_PER_LEVEL,
  levelForXp,
  levelProgress,
  xpForMovieType,
  ACHIEVEMENTS,
  achievementsUnlockedBy,
  CHALLENGES,
};
