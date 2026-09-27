import { useEffect, useRef, useState } from "react";
import MessageBubble from "./MessageBubble";
import "./ChatWindow.css";

export default function ChatWindow({ chat, onSend, isSending, sendError }) {
  const [draft, setDraft] = useState("");
  const listRef = useRef(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [chat?.messages?.length, chat?.chatId]);

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

  function handleSubmit(event) {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;
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
          <p className="messages-empty">
            Сообщений пока нет. Напишите первое сообщение ниже.
          </p>
        )}
        {chat.messages.map((message) => (
          <MessageBubble key={message.idMessage} message={message} />
        ))}
      </div>

      {sendError && <div className="send-error">{sendError}</div>}

      <form className="composer" onSubmit={handleSubmit}>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Напишите сообщение..."
          disabled={isSending}
        />
        <button type="submit" disabled={isSending || !draft.trim()}>
          Отправить
        </button>
      </form>
    </div>
  );
}
