import { useState } from "react";
import "./NewChatModal.css";

export default function NewChatModal({ onCreate, onClose, isChecking, error }) {
  const [phone, setPhone] = useState("");
  const [localError, setLocalError] = useState("");

  function handleSubmit(event) {
    event.preventDefault();
    const digits = phone.replace(/\D/g, "");

    if (digits.length < 10) {
      setLocalError("Введите номер телефона в международном формате, например 79991234567.");
      return;
    }

    setLocalError("");
    onCreate(digits);
  }

  const shownError = localError || error;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form
        className="modal-card"
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <h2>Новый чат</h2>
        <p className="modal-subtitle">
          Номер телефона получателя в MAX, в международном формате, без «+».
          Мы проверим, есть ли у него аккаунт, методом CheckAccount.
        </p>
        <input
          autoFocus
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="79991234567"
          inputMode="tel"
          disabled={isChecking}
        />
        {shownError && <div className="modal-error">{shownError}</div>}
        <div className="modal-actions">
          <button type="button" className="ghost-button" onClick={onClose} disabled={isChecking}>
            Отмена
          </button>
          <button type="submit" className="primary-button" disabled={isChecking}>
            {isChecking ? "Проверяем номер..." : "Создать чат"}
          </button>
        </div>
      </form>
    </div>
  );
}
