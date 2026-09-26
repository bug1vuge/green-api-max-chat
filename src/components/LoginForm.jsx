import { useState } from "react";
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

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    if (!idInstance.trim() || !apiTokenInstance.trim()) {
      setError("Заполните idInstance и apiTokenInstance.");
      return;
    }

    setIsLoading(true);
    try {
      await login({ idInstance, apiTokenInstance, apiUrl });
    } catch (err) {
      setError(err.message || "Не получилось войти. Проверьте данные инстанса.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="login-screen">
      <form className="login-card" onSubmit={handleSubmit}>
        <div className="login-logo" aria-hidden="true">💬</div>
        <h1>Вход в MAX Chat</h1>
        <p className="login-subtitle">
          Введите данные вашего инстанса GREEN-API из личного кабинета
          {" "}
          <a href="https://console.green-api.com/" target="_blank" rel="noreferrer">
            console.green-api.com
          </a>
        </p>

        <label className="field">
          <span>idInstance</span>
          <input
            value={idInstance}
            onChange={(e) => setIdInstance(e.target.value)}
            placeholder="1101123456"
            inputMode="numeric"
            autoFocus
          />
        </label>

        <label className="field">
          <span>apiTokenInstance</span>
          <input
            type="password"
            value={apiTokenInstance}
            onChange={(e) => setApiTokenInstance(e.target.value)}
            placeholder="d0e5a...9f3"
          />
        </label>

        <button
          type="button"
          className="link-button"
          onClick={() => setShowAdvanced((v) => !v)}
        >
          {showAdvanced ? "Скрыть" : "Указать другой хост apiUrl"}
        </button>

        {showAdvanced && (
          <label className="field">
            <span>apiUrl</span>
            <input value={apiUrl} onChange={(e) => setApiUrl(e.target.value)} />
          </label>
        )}

        {error && <div className="login-error">{error}</div>}

        <button type="submit" className="primary-button" disabled={isLoading}>
          {isLoading ? "Проверяем..." : "Войти"}
        </button>
      </form>
    </div>
  );
}
