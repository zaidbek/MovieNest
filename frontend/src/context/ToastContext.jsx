import React, { createContext, useCallback, useContext, useRef, useState } from "react";

const ToastContext = createContext(null);
let idCounter = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef(new Map());

  const remove = useCallback((id) => {
    setToasts((list) => list.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) { clearTimeout(timer); timers.current.delete(id); }
  }, []);

  const showToast = useCallback((message, { type = "info", duration = 4000 } = {}) => {
    const id = ++idCounter;
    setToasts((list) => [...list, { id, message, type }]);
    const timer = setTimeout(() => remove(id), duration);
    timers.current.set(id, timer);
    return id;
  }, [remove]);

  return (
    <ToastContext.Provider value={{ showToast, remove }}>
      {children}
      <div className="toast-stack" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast--${t.type}`} onClick={() => remove(t.id)}>
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast должен использоваться внутри <ToastProvider>");
  return ctx;
}
