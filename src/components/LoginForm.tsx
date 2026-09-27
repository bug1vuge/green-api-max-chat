import { useId, useState, type FormEvent } from "react";
import { DEFAULT_API_URL } from "../api/greenApi";
import { useAuth } from "../context/AuthContext";
import "./LoginForm.css";

export default function LoginForm() {
  const { login } = useAuth();
  const [idInstance, setIdInstance] = useState("");
  const [apiTokenInstance, setApiTokenInstance] = useState("");
  const [apiUrl, setApiUrl] = useState(DEFAULT_API_URL);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const idInputId = useId();
  const tokenInputId = useId();
  const apiUrlInputId = useId();

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError("");
    setIsLoading(true);
    try {
      await login({ idInstance, apiTokenInstance, apiUrl });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не получилось войти. Проверьте данные инстанса.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="login-screen">
      <form className="login-card" onSubmit={handleSubmit}>
        <div className="login-logo" aria-hidden="true">
          💬
        </div>
        <h1>Вход в MAX Chat</h1>
        <p className="login-subtitle">
          Введите данные вашего инстанса GREEN-API из личного кабинета{" "}
          <a href="https://console.green-api.com/" target="_blank" rel="noreferrer">
            console.green-api.com
          </a>
          . Инстанс должен быть авторизован в MAX по QR-коду.
        </p>

        <label className="field" htmlFor={idInputId}>
          <span>idInstance</span>
          <input
            id={idInputId}
            value={idInstance}
            onChange={(e) => setIdInstance(e.target.value)}
            placeholder="1101123456"
            inputMode="numeric"
            autoFocus
          />
        </label>

        <label className="field" htmlFor={tokenInputId}>
          <span>apiTokenInstance</span>
          <input
            id={tokenInputId}
            type="password"
            value={apiTokenInstance}
            onChange={(e) => setApiTokenInstance(e.target.value)}
            placeholder="d0e5a...9f3"
          />
        </label>

        <button type="button" className="link-button" onClick={() => setShowAdvanced((v) => !v)}>
          {showAdvanced ? "Скрыть" : "Указать другой хост apiUrl"}
        </button>

        {showAdvanced && (
          <label className="field" htmlFor={apiUrlInputId}>
            <span>apiUrl</span>
            <input id={apiUrlInputId} value={apiUrl} onChange={(e) => setApiUrl(e.target.value)} />
          </label>
        )}

        {error && (
          <div className="login-error" role="alert">
            {error}
          </div>
        )}

        <button type="submit" className="primary-button" disabled={isLoading}>
          {isLoading ? "Проверяем..." : "Войти"}
        </button>
      </form>
    </div>
  );
}
