import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { DEFAULT_API_URL, getStateInstance, GreenApiError } from "../api/greenApi";
import type { GreenApiCredentials, InstanceState } from "../types";
import { clearCredentials, loadCredentials, saveCredentials } from "../utils/storage";

/** Периодически перепроверяем состояние инстанса, пока пользователь залогинен —
 *  чтобы вовремя заметить блокировку/разлогин в MAX и явно сообщить об этом,
 *  а не оставлять пользователя молча писать в пустоту. */
const STATE_POLL_INTERVAL_MS = 60_000;

export function describeInstanceState(state: InstanceState): string {
  switch (state) {
    case "authorized":
      return "Инстанс авторизован и готов к работе.";
    case "notAuthorized":
      return "Инстанс не авторизован в MAX. Отсканируйте QR-код в личном кабинете GREEN-API.";
    case "blocked":
      return "Инстанс заблокирован. Обратитесь в поддержку GREEN-API.";
    case "sleepMode":
      return "Инстанс в спящем режиме — отправьте запрос через личный кабинет, чтобы разбудить его.";
    case "starting":
      return "Инстанс запускается, подождите немного и обновите статус.";
    case "yellowCard":
      return "Аккаунт MAX получил предупреждение (yellowCard). Сообщения могут отправляться с ограничениями.";
    default:
      return `Неизвестный статус инстанса: ${state}. Проверьте личный кабинет GREEN-API.`;
  }
}

interface LoginInput {
  idInstance: string;
  apiTokenInstance: string;
  apiUrl?: string;
}

interface AuthContextValue {
  credentials: GreenApiCredentials | null;
  isAuthenticated: boolean;
  instanceState: InstanceState | null;
  login: (input: LoginInput) => Promise<InstanceState>;
  logout: () => void;
  refreshInstanceState: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [credentials, setCredentials] = useState<GreenApiCredentials | null>(() =>
    loadCredentials(),
  );
  const [instanceState, setInstanceState] = useState<InstanceState | null>(null);
  const credentialsRef = useRef(credentials);
  useEffect(() => {
    credentialsRef.current = credentials;
  }, [credentials]);

  const refreshInstanceState = useCallback(async () => {
    const creds = credentialsRef.current;
    if (!creds) return;
    try {
      const state = await getStateInstance(creds);
      setInstanceState(state.stateInstance);
    } catch (err) {
      // Сетевой сбой при фоновой проверке не должен выкидывать пользователя из чата —
      // просто оставляем последний известный статус и попробуем снова на следующем тике.
      console.warn("refreshInstanceState: не удалось обновить статус инстанса", err);
    }
  }, []);

  const login = useCallback(async ({ idInstance, apiTokenInstance, apiUrl }: LoginInput) => {
    const trimmedId = idInstance.trim();
    const trimmedToken = apiTokenInstance.trim();

    if (!trimmedId || !trimmedToken) {
      throw new Error("Заполните idInstance и apiTokenInstance.");
    }
    if (!/^\d+$/.test(trimmedId)) {
      throw new Error("idInstance должен состоять только из цифр.");
    }

    const nextCredentials: GreenApiCredentials = {
      idInstance: trimmedId,
      apiTokenInstance: trimmedToken,
      apiUrl: (apiUrl || DEFAULT_API_URL).trim(),
    };

    let state: InstanceState;
    try {
      const response = await getStateInstance(nextCredentials);
      state = response.stateInstance;
    } catch (err) {
      if (err instanceof GreenApiError && err.kind === "auth") {
        throw new Error("Неверные idInstance или apiTokenInstance.");
      }
      throw err instanceof Error ? err : new Error("Не удалось проверить учётные данные.");
    }

    saveCredentials(nextCredentials);
    setCredentials(nextCredentials);
    setInstanceState(state);
    return state;
  }, []);

  const logout = useCallback(() => {
    clearCredentials();
    setCredentials(null);
    setInstanceState(null);
  }, []);

  // Периодически перепроверяем статус, пока пользователь залогинен.
  useEffect(() => {
    if (!credentials) return;
    const intervalId = setInterval(refreshInstanceState, STATE_POLL_INTERVAL_MS);
    return () => clearInterval(intervalId);
  }, [credentials, refreshInstanceState]);

  const value = useMemo<AuthContextValue>(
    () => ({
      credentials,
      isAuthenticated: Boolean(credentials),
      instanceState,
      login,
      logout,
      refreshInstanceState,
    }),
    [credentials, instanceState, login, logout, refreshInstanceState],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth должен использоваться внутри <AuthProvider>");
  return ctx;
}
