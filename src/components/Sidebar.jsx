import { chatIdToPhone } from "../api/greenApi";
import "./Sidebar.css";

export default function Sidebar({
  chats,
  activeChatId,
  onSelectChat,
  onOpenNewChat,
  onLogout,
  idInstance,
}) {
  const chatList = Object.values(chats).sort(
    (a, b) => (b.lastMessageAt || 0) - (a.lastMessageAt || 0),
  );

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div>
          <div className="sidebar-title">MAX Chat</div>
          <div className="sidebar-instance">Инстанс {idInstance}</div>
        </div>
        <button className="icon-button" title="Выйти" onClick={onLogout}>
          ⎋
        </button>
      </div>

      <button className="new-chat-button" onClick={onOpenNewChat}>
        + Новый чат
      </button>

      <div className="chat-list">
        {chatList.length === 0 && (
          <p className="chat-list-empty">
            Чатов пока нет. Нажмите «Новый чат» и укажите номер телефона получателя.
          </p>
        )}

        {chatList.map((chat) => {
          const lastMessage = chat.messages[chat.messages.length - 1];
          return (
            <button
              key={chat.chatId}
              className={`chat-item ${chat.chatId === activeChatId ? "active" : ""}`}
              onClick={() => onSelectChat(chat.chatId)}
            >
              <div className="chat-avatar">{initials(chat.title)}</div>
              <div className="chat-item-body">
                <div className="chat-item-top">
                  <span className="chat-item-title">
                    {chat.title || chatIdToPhone(chat.chatId)}
                  </span>
                </div>
                <div className="chat-item-preview">
                  {lastMessage ? previewText(lastMessage) : "Нет сообщений"}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </aside>
  );
}

function initials(title) {
  const digits = (title || "").replace(/\D/g, "");
  return digits ? digits.slice(-2) : "??";
}

function previewText(message) {
  const prefix = message.direction === "out" ? "Вы: " : "";
  return prefix + message.text;
}
