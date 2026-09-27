import type { ChatsById, InstanceState } from "../types";
import "./Sidebar.css";

interface SidebarProps {
  chats: ChatsById;
  activeChatId: string | null;
  onSelectChat: (chatId: string) => void;
  onOpenNewChat: () => void;
  onLogout: () => void;
  idInstance: string;
  instanceState: InstanceState | null;
  isConnectionUnstable: boolean;
}

export default function Sidebar({
  chats,
  activeChatId,
  onSelectChat,
  onOpenNewChat,
  onLogout,
  idInstance,
  instanceState,
  isConnectionUnstable,
}: SidebarProps) {
  const chatList = Object.values(chats).sort((a, b) => b.lastMessageAt - a.lastMessageAt);
  const isAuthorized = instanceState === "authorized" || instanceState === null;

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

      {!isAuthorized && (
        <div className="status-banner status-banner--warning" role="status">
          Статус инстанса: {instanceState}
        </div>
      )}
      {isConnectionUnstable && (
        <div className="status-banner status-banner--info" role="status">
          Проблемы со связью с GREEN-API, переподключаемся...
        </div>
      )}

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
          const label = chat.title || chat.phone || chat.chatId;
          return (
            <button
              key={chat.chatId}
              className={`chat-item ${chat.chatId === activeChatId ? "active" : ""}`}
              onClick={() => onSelectChat(chat.chatId)}
            >
              <div className="chat-avatar">{initials(label)}</div>
              <div className="chat-item-body">
                <div className="chat-item-top">
                  <span className="chat-item-title">{label}</span>
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

function initials(label: string): string {
  const digits = String(label || "").replace(/\D/g, "");
  return digits ? digits.slice(-2) : "??";
}

function previewText(message: { direction: "in" | "out"; text: string }): string {
  const prefix = message.direction === "out" ? "Вы: " : "";
  return prefix + message.text;
}
