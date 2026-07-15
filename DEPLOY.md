# Деплой MovieNest: пошаговая инструкция

Сайт состоит из двух частей, и им нужны два разных хостинга:
- **Frontend** (React/Vite) → GitHub Pages — только статика, бесплатно, уже настроено через `.github/workflows/deploy-pages.yml`.
- **Backend** (Express API) → GitHub Pages его не запустит (это не Node-сервер). Разворачиваем на Render (есть бесплатный план).

Что уже исправлено в коде под такой деплой:
- Cookie авторизации и CSRF-cookie теперь используют `sameSite: "none"` в проде — без этого браузер не сохранял бы куки между доменом фронтенда и доменом бэкенда (`backend/utils/auth.js`, `backend/middleware/csrf.js`).
- `vite.config.js` собирает фронтенд с префиксом `/MovieNest-/`, как требует GitHub Pages для проектных сайтов.
- Добавлен `frontend/public/404.html` + скрипт в `index.html` — без этого при обновлении страницы (F5) на любом адресе кроме главной GitHub Pages отдавал бы 404 (React Router работает только на клиенте).

## Шаг 1. Разверните backend на Render

1. Зарегистрируйтесь на [render.com](https://render.com) и подключите свой GitHub-аккаунт.
2. New → Blueprint → выберите репозиторий `MovieNest-`. Render найдёт `render.yaml` в корне и сам предложит создать сервис `movienest-backend`.
3. Перед деплоем задайте переменную окружения **CLIENT_ORIGIN**:
   ```
   https://<ваш-username>.github.io
   ```
   (без пути `/MovieNest-/` и без слэша на конце — CORS сверяет именно домен).
   `JWT_SECRET` Render сгенерирует сам, ничего вводить не нужно.
4. Дождитесь деплоя и скопируйте адрес сервиса — что-то вроде:
   ```
   https://movienest-backend.onrender.com
   ```

> Бесплатный план Render "засыпает" после 15 минут без запросов и просыпается ~30–60 секунд при первом запросе — это нормально для бесплатного тарифа, не баг.

## Шаг 2. Подключите фронтенд к этому backend

1. В репозитории на GitHub: **Settings → Secrets and variables → Actions → Variables → New repository variable**.
2. Имя: `VITE_API_ROOT`, значение:
   ```
   https://movienest-backend.onrender.com/api
   ```
   (используйте свой реальный адрес с Render, обязательно с `/api` на конце).

## Шаг 3. Включите GitHub Pages через Actions

1. **Settings → Pages → Build and deployment → Source** → выберите **GitHub Actions** (не "Deploy from a branch").
2. Сделайте любой пуш в ветку `main` (или зайдите во вкладку **Actions** → выберите workflow "Deploy frontend to GitHub Pages" → **Run workflow** вручную).
3. Через 1–2 минуты сайт будет доступен по адресу вида `https://<ваш-username>.github.io/MovieNest-/` — уже с рабочим фронтендом и бэкендом.

## Проверка

- Откройте сайт, попробуйте зарегистрироваться/войти — если куки настроены правильно, после входа страница профиля должна открываться без повторного логина.
- Если видите ошибку CORS в консоли браузера — проверьте, что `CLIENT_ORIGIN` на Render совпадает с адресом GitHub Pages *точно* (без слэша на конце).
- Если после входа профиль "слетает" — проверьте, что backend задеплоен с `NODE_ENV=production` (в `render.yaml` это уже указано).

## Локальная разработка не изменилась

`npm run dev` в корне проекта по-прежнему поднимает фронтенд и бэкенд локально на одном origin через Vite-прокси — все правки выше применяются только к продакшену (`NODE_ENV=production` / `vite build`).
