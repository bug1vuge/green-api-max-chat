import { useState } from "react";
import "./NewChatModal.css";

export default function NewChatModal({ onCreate, onClose }) {
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");

  function handleSubmit(event) {
    event.preventDefault();
    const digits = phone.replace(/\D/g, "");

    if (digits.length < 10) {
      setError("Введите номер телефона в международном формате, например 79991234567.");
      return;
    }

    onCreate(digits);
  }

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
        </p>
        <input
          autoFocus
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="79991234567"
          inputMode="tel"
        />
        {error && <div className="modal-error">{error}</div>}
        <div className="modal-actions">
          <button type="button" className="ghost-button" onClick={onClose}>
            Отмена
          </button>
          <button type="submit" className="primary-button">
            Создать чат
          </button>
        </div>
      </form>
    </div>
  );
}
