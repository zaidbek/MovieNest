import { useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { startView, sendHeartbeat } from "../api/engagement.js";

const HEARTBEAT_INTERVAL_MS = 5000;

/**
 * Отслеживает реальный прогресс просмотра и передаёт его на сервер каждые
 * несколько секунд ("пульс"). Вся защита от накрутки — на сервере
 * (backend/store/watchProgressRepo.js):
 * - сервер начисляет только реально прошедшее СЕРВЕРНОЕ время между пульсами,
 *   а не то, что "утверждает" клиент — поэтому подделать быстрый прогресс
 *   через консоль браузера нельзя;
 * - пульс не даёт кредита, если вкладка неактивна/свёрнута — это соответствует
 *   "видео на паузе": прогресс не растёт, пока вы не смотрите;
 * - при открытии этого же фильма в другой вкладке сервер выдаёт новую сессию,
 *   и пульсы старой вкладки перестают засчитываться — без задвоения прогресса.
 *
 * ВАЖНО: плеер в MovieNest — это внешний iframe (сторонний видеохостинг), поэтому
 * у нас нет доступа к его внутреннему состоянию (play/pause/seek/скорость).
 * Мы намеренно измеряем не позицию плеера, а реально прошедшее время —
 * это делает перемотку вперёд бессмысленной для накрутки (нельзя "заработать"
 * секунды, которые физически не прошли на часах сервера), но не отличает паузу
 * внутри плеера при активной вкладке от активного просмотра. Если видео когда-нибудь
 * станет собственным <video>-плеером, эту эвристику можно заменить на его реальные
 * play/pause/timeupdate события.
 */
export function useViewTracking(movieId, { onResult } = {}) {
  const { user } = useAuth();
  const sessionRef = useRef(null);
  const intervalRef = useRef(null);

  useEffect(() => {
    sessionRef.current = null;
    if (!user || !movieId) return undefined;

    let cancelled = false;

    async function init() {
      try {
        const data = await startView(movieId);
        if (cancelled) return;
        if (data.completed) return; // уже засчитано раньше, пульсы не нужны
        sessionRef.current = data.sessionId;
      } catch {
        // не удалось начать сессию (например, сеть) — просто не отслеживаем в этот раз
      }
    }

    async function tick() {
      if (!sessionRef.current) return;
      const visible = document.visibilityState === "visible";
      const focused = document.hasFocus();
      try {
        const result = await sendHeartbeat(movieId, { sessionId: sessionRef.current, visible, focused });
        if (result.completed) {
          sessionRef.current = null; // больше не шлём пульсы после завершения
        }
        onResult?.(result);
      } catch (err) {
        if (err?.payload?.code === "SESSION_MISMATCH") {
          sessionRef.current = null; // фильм открыт в другой вкладке — прекращаем тут
        }
      }
    }

    init();
    const interval = setInterval(tick, HEARTBEAT_INTERVAL_MS);
    intervalRef.current = interval;

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [user, movieId, onResult]);
}
