import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ command }) => ({
  plugins: [react()],
  // На GitHub Pages сайт живёт не в корне домена, а в подпапке с именем
  // репозитория: https://<username>.github.io/<repo>/
  // Поэтому в проде все ассеты (JS/CSS/шрифты) должны собираться с этим
  // префиксом, иначе браузер будет искать их в корне и получит 404.
  // Значение подставляет GitHub Actions (шаг configure-pages) через
  // переменную окружения VITE_BASE_PATH — так путь не зависит от того,
  // как именно называется репозиторий, и не ломается при переименовании.
  // Локально (`npm run dev`) префикс не нужен — используем "/".
  base: command === "build" ? process.env.VITE_BASE_PATH || "/" : "/",
  server: {
    port: 5173,
    proxy: {
      // Все запросы вида /api/... будут перенаправлены на backend-сервер
      "/api": {
        target: "http://localhost:5000",
        changeOrigin: true,
      },
    },
  },
}));
