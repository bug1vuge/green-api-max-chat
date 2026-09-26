import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { DEFAULT_API_URL, getStateInstance } from "../api/greenApi";
import { clearCredentials, loadCredentials, saveCredentials } from "../utils/storage";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [credentials, setCredentials] = useState(() => loadCredentials());

  const login = useCallback(async ({ idInstance, apiTokenInstance, apiUrl }) => {
    const nextCredentials = {
      idInstance: idInstance.trim(),
      apiTokenInstance: apiTokenInstance.trim(),
      apiUrl: (apiUrl || DEFAULT_API_URL).trim(),
    };

    // Проверяем, что данные верные, до того как пускать пользователя в чат
    const state = await getStateInstance(nextCredentials);
    if (!state || !state.stateInstance) {
      throw new Error("GREEN-API не вернул статус инстанса. Проверьте idInstance и apiTokenInstance.");
    }

    saveCredentials(nextCredentials);
    setCredentials(nextCredentials);
    return state.stateInstance;
  }, []);

  const logout = useCallback(() => {
    clearCredentials();
    setCredentials(null);
  }, []);

  const value = useMemo(
    () => ({ credentials, isAuthenticated: Boolean(credentials), login, logout }),
    [credentials, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth должен использоваться внутри <AuthProvider>");
  return ctx;
}
