import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { fetchCurrentUser, loginRequest, logoutRequest, registerRequest } from "../api/auth.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [initializing, setInitializing] = useState(true);

  // При первой загрузке приложения (в т.ч. после F5 / перезапуска браузера)
  // проверяем HttpOnly cookie на сервере — если она валидна, пользователь
  // остаётся авторизован без повторного ввода пароля.
  useEffect(() => {
    let mounted = true;
    fetchCurrentUser()
      .then((data) => { if (mounted) setUser(data.user); })
      .catch(() => { if (mounted) setUser(null); })
      .finally(() => { if (mounted) setInitializing(false); });
    return () => { mounted = false; };
  }, []);

  const login = useCallback(async (email, password) => {
    const data = await loginRequest(email, password);
    setUser(data.user);
    return data.user;
  }, []);

  const register = useCallback(async (email, password, ref) => {
    const data = await registerRequest(email, password, ref);
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await logoutRequest();
    } finally {
      setUser(null);
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, initializing, login, register, logout, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth должен использоваться внутри <AuthProvider>");
  return ctx;
}
