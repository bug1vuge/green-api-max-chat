import { useCallback, useEffect, useState } from "react";
import { checkAccount, GreenApiError, sendMessage as apiSendMessage } from "./api/greenApi";
import ChatWindow from "./components/ChatWindow";
import LoginForm from "./components/LoginForm";
import NewChatModal from "./components/NewChatModal";
import Sidebar from "./components/Sidebar";
import { useAuth } from "./context/AuthContext";
import { useIncomingMessages } from "./hooks/useIncomingMessages";
import type { ChatMessage, ChatRecord, ChatsById, GreenApiCredentials, IncomingMessageEvent } from "./types";
import { loadChats, saveChats } from "./utils/storage";

export default function App() {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <ChatApp /> : <LoginForm />;
}

function ChatApp() {
  const { credentials, instanceState, logout } = useAuth();
  // credentials гарантированно не null здесь: ChatApp рендерится только когда isAuthenticated === true.
  const activeCredentials = credentials as GreenApiCredentials;

  const [chats, setChats] = useState<ChatsById>(() => loadChats(activeCredentials.idInstance));
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [isModalOpen, setModalOpen] = useState(false);
  const [isCheckingAccount, setCheckingAccount] = useState(false);
  const [checkError, setCheckError] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const [isConnectionUnstable, setConnectionUnstable] = useState(false);

  useEffect(() => {
    saveChats(activeCredentials.idInstance, chats);
  }, [chats, activeCredentials.idInstance]);

  const handleIncomingMessage = useCallback((event: IncomingMessageEvent) => {
    setChats((prev) => {
      const existing = prev[event.chatId] ?? createEmptyChat(event.chatId, formatPhone(event.senderPhoneNumber), event.senderName);
      if (existing.messages.some((m) => m.idMessage === event.idMessage)) return prev; // защита от дублей

      const updated: ChatRecord = {
        ...existing,
        title: existing.title || event.senderName || "",
        phone: existing.phone || formatPhone(event.senderPhoneNumber),
        lastMessageAt: event.timestamp,
        messages: [
          ...existing.messages,
          { idMessage: event.idMessage, text: event.text, direction: "in", timestamp: event.timestamp, status: "received" },
        ],
      };
      return { ...prev, [event.chatId]: updated };
    });
  }, []);

  useIncomingMessages(activeCredentials, handleIncomingMessage, {
    onConnectionIssue: setConnectionUnstable,
  });

  async function handleCreateChat(phoneDigits: string): Promise<void> {
    setCheckError("");
    setCheckingAccount(true);
    try {
      const result = await checkAccount(activeCredentials, phoneDigits);
      if (!result?.exist || !result.chatId) {
        setCheckError("У этого номера нет аккаунта в MAX. Проверьте номер и попробуйте снова.");
        return;
      }

      const chatId = String(result.chatId);
      setChats((prev) => ({
        ...prev,
        [chatId]: prev[chatId] ?? createEmptyChat(chatId, formatPhone(result.phoneNumber) || phoneDigits),
      }));
      setActiveChatId(chatId);
      setModalOpen(false);
    } catch (err) {
      setCheckError(
        err instanceof GreenApiError ? err.message : "Не удалось проверить номер. Попробуйте ещё раз.",
      );
    } finally {
      setCheckingAccount(false);
    }
  }

  async function sendText(chatId: string, text: string, existingLocalId?: string): Promise<void> {
    const localId = existingLocalId ?? `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    setSendError("");
    setChats((prev) =>
      existingLocalId
        ? updateMessage(prev, chatId, localId, { status: "sending" })
        : appendMessage(prev, chatId, {
            idMessage: localId,
            text,
            direction: "out",
            timestamp: Date.now(),
            status: "sending",
          }),
    );
    setIsSending(true);

    try {
      const result = await apiSendMessage(activeCredentials, chatId, text);
      setChats((prev) => updateMessage(prev, chatId, localId, { idMessage: result?.idMessage || localId, status: "sent" }));
    } catch (err) {
      setChats((prev) => updateMessage(prev, chatId, localId, { status: "error" }));
      setSendError(
        err instanceof GreenApiError ? err.message : "Не удалось отправить сообщение. Попробуйте ещё раз.",
      );
    } finally {
      setIsSending(false);
    }
  }

  function handleSend(text: string): void {
    if (!activeChatId) return;
    void sendText(activeChatId, text);
  }

  function handleRetryMessage(message: ChatMessage): void {
    if (!activeChatId || isSending) return;
    void sendText(activeChatId, message.text, message.idMessage);
  }

  const activeChat = activeChatId ? (chats[activeChatId] ?? null) : null;

  return (
    <div className="app-shell">
      <Sidebar
        chats={chats}
        activeChatId={activeChatId}
        onSelectChat={(chatId) => {
          setActiveChatId(chatId);
          setSendError("");
        }}
        onOpenNewChat={() => setModalOpen(true)}
        onLogout={logout}
        idInstance={activeCredentials.idInstance}
        instanceState={instanceState}
        isConnectionUnstable={isConnectionUnstable}
      />
      <ChatWindow
        chat={activeChat}
        onSend={handleSend}
        onRetryMessage={handleRetryMessage}
        isSending={isSending}
        sendError={sendError}
      />
      {isModalOpen && (
        <NewChatModal
          onCreate={handleCreateChat}
          onClose={() => {
            setModalOpen(false);
            setCheckError("");
          }}
          isChecking={isCheckingAccount}
          error={checkError}
        />
      )}
    </div>
  );
}

function formatPhone(phoneNumber: number | undefined): string {
  return phoneNumber ? String(phoneNumber) : "";
}

function createEmptyChat(chatId: string, phone?: string, title?: string): ChatRecord {
  return { chatId, phone: phone || "", title: title || "", messages: [], lastMessageAt: Date.now() };
}

function appendMessage(chats: ChatsById, chatId: string, message: ChatMessage): ChatsById {
  const existing = chats[chatId] ?? createEmptyChat(chatId);
  return {
    ...chats,
    [chatId]: {
      ...existing,
      lastMessageAt: message.timestamp,
      messages: [...existing.messages, message],
    },
  };
}

function updateMessage(
  chats: ChatsById,
  chatId: string,
  idMessage: string,
  patch: Partial<ChatMessage>,
): ChatsById {
  const existing = chats[chatId];
  if (!existing) return chats;
  return {
    ...chats,
    [chatId]: {
      ...existing,
      messages: existing.messages.map((m) => (m.idMessage === idMessage ? { ...m, ...patch } : m)),
    },
  };
}
