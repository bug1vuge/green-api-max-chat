import { useEffect, useRef, useState, type FormEvent } from "react";
import type { ChatMessage, ChatRecord } from "../types";
import MessageBubble from "./MessageBubble";
import "./ChatWindow.css";

interface ChatWindowProps {
  chat: ChatRecord | null;
  onSend: (text: string) => void;
  onRetryMessage: (message: ChatMessage) => void;
  isSending: boolean;
  sendError: string;
}

/** Ограничение GREEN-API на длину текстового сообщения. */
const MAX_MESSAGE_LENGTH = 4096;

export default function ChatWindow({ chat, onSend, onRetryMessage, isSending, sendError }: ChatWindowProps) {
  const [draft, setDraft] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [chat?.messages.length, chat?.chatId]);

  if (!chat) {
    return (
      <div className="chat-window empty-state">
        <div>
          <div className="empty-emoji">💬</div>
          <p>Выберите чат слева или создайте новый, чтобы начать переписку.</p>
        </div>
      </div>
    );
  }

  const label = chat.title || chat.phone || chat.chatId;
  const isTooLong = draft.length > MAX_MESSAGE_LENGTH;

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const text = draft.trim();
    if (!text || isTooLong) return;
    onSend(text);
    setDraft("");
  }

  return (
    <div className="chat-window">
      <header className="chat-window-header">
        <div className="chat-avatar">{String(label).replace(/\D/g, "").slice(-2) || "??"}</div>
        <div>
          <div className="chat-window-title">{label}</div>
          <div className="chat-window-subtitle">
            {chat.phone ? `+${chat.phone}` : `chatId: ${chat.chatId}`} · MAX
          </div>
        </div>
      </header>

      <div className="messages-list" ref={listRef}>
        {chat.messages.length === 0 && (
          <p className="messages-empty">Сообщений пока нет. Напишите первое сообщение ниже.</p>
        )}
        {chat.messages.map((message) => (
          <MessageBubble key={message.idMessage} message={message} onRetry={onRetryMessage} />
        ))}
      </div>

      {sendError && (
        <div className="send-error" role="alert">
          {sendError}
        </div>
      )}

      <form className="composer" onSubmit={handleSubmit}>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Напишите сообщение..."
          disabled={isSending}
          maxLength={MAX_MESSAGE_LENGTH + 200 /* даём немного запаса, чтобы показать ошибку, а не молча обрезать */}
        />
        <button type="submit" disabled={isSending || !draft.trim() || isTooLong}>
          Отправить
        </button>
      </form>
      {isTooLong && (
        <div className="send-error" role="alert">
          Сообщение слишком длинное (максимум {MAX_MESSAGE_LENGTH} символов).
        </div>
      )}
    </div>
  );
}
