import React, { useEffect, useState } from "react";

// Показывает красивую анимацию + модалку при получении нового достижения.
// Принимает очередь достижений и показывает их по одному.
export default function AchievementModal({ queue, onDone }) {
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!queue || queue.length === 0) return;
    setIndex(0);
    setVisible(true);
  }, [queue]);

  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(() => {
      if (index < queue.length - 1) {
        setIndex((i) => i + 1);
      } else {
        setVisible(false);
        onDone?.();
      }
    }, 3200);
    return () => clearTimeout(t);
  }, [visible, index, queue, onDone]);

  if (!visible || !queue || !queue[index]) return null;
  const achievement = queue[index];

  return (
    <div className="achievement-overlay" onClick={() => { setVisible(false); onDone?.(); }}>
      <div className="achievement-modal" onClick={(e) => e.stopPropagation()}>
        <div className="achievement-modal__burst" aria-hidden="true" />
        <div className="achievement-modal__icon">{achievement.icon}</div>
        <p className="achievement-modal__eyebrow">Новое достижение!</p>
        <h3 className="achievement-modal__title">{achievement.title}</h3>
        <p className="achievement-modal__desc">{achievement.description}</p>
      </div>
    </div>
  );
}
