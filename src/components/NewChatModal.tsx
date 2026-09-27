import { useId, useState, type FormEvent } from "react";
import "./NewChatModal.css";

interface NewChatModalProps {
  onCreate: (phoneDigits: string) => void;
  onClose: () => void;
  isChecking: boolean;
  error: string;
}

const MIN_PHONE_DIGITS = 10;
const MAX_PHONE_DIGITS = 15;

export default function NewChatModal({ onCreate, onClose, isChecking, error }: NewChatModalProps) {
  const [phone, setPhone] = useState("");
  const [localError, setLocalError] = useState("");
  const inputId = useId();

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const digits = phone.replace(/\D/g, "");

    if (digits.length < MIN_PHONE_DIGITS || digits.length > MAX_PHONE_DIGITS) {
      setLocalError("Введите номер телефона в международном формате, например 79991234567.");
      return;
    }

    setLocalError("");
    onCreate(digits);
  }

  const shownError = localError || error;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form className="modal-card" onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
        <h2>Новый чат</h2>
        <p className="modal-subtitle">
          Номер телефона получателя в MAX, в международном формате, без «+». Мы проверим, есть ли у
          него аккаунт, методом CheckAccount.
        </p>
        <input
          id={inputId}
          autoFocus
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="79991234567"
          inputMode="tel"
          disabled={isChecking}
        />
        {shownError && (
          <div className="modal-error" role="alert">
            {shownError}
          </div>
        )}
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
