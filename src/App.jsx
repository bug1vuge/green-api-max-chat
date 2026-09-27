import { useEffect, useState } from "react";
import { GreenApiError, checkAccount, sendMessage as apiSendMessage } from "./api/greenApi";
import ChatWindow from "./components/ChatWindow";
import LoginForm from "./components/LoginForm";
import NewChatModal from "./components/NewChatModal";
import Sidebar from "./components/Sidebar";
import { useAuth } from "./context/AuthContext";
import { useIncomingMessages } from "./hooks/useIncomingMessages";
import { loadChats, saveChats } from "./utils/storage";

export default function App() {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <ChatApp /> : <LoginForm />;
}

function ChatApp() {
  const { credentials, logout } = useAuth();
  const [chats, setChats] = useState(() => loadChats(credentials.idInstance));
  const [activeChatId, setActiveChatId] = useState(null);
  const [isModalOpen, setModalOpen] = useState(false);
  const [isCheckingAccount, setCheckingAccount] = useState(false);
  const [checkError, setCheckError] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState("");

  useEffect(() => {
    saveChats(credentials.idInstance, chats);
  }, [chats, credentials.idInstance]);

  // Фоновый long polling входящих сообщений (ReceiveNotification/DeleteNotification)
  useIncomingMessages(credentials, ({ chatId, senderName, senderPhoneNumber, text, idMessage, timestamp }) => {
    setChats((prev) => {
      const existing = prev[chatId] ?? createEmptyChat(chatId, senderPhoneNumber, senderName);
      if (existing.messages.some((m) => m.idMessage === idMessage)) return prev; // защита от дублей
      const updated = {
        ...existing,
        title: existing.title || senderName,
        phone: existing.phone || senderPhoneNumber,
        lastMessageAt: timestamp,
        messages: [
          ...existing.messages,
          { idMessage, text, direction: "in", timestamp, status: "received" },
        ],
      };
      return { ...prev, [chatId]: updated };
    });
  });

  async function handleCreateChat(phoneDigits) {
    setCheckError("");
    setCheckingAccount(true);
    try {
      const result = await checkAccount(credentials, phoneDigits);
      if (!result?.exist) {
        setCheckError("У этого номера нет аккаунта в мессенджере. Проверьте номер и попробуйте снова.");
        return;
      }

      const chatId = String(result.chatId);
      setChats((prev) => ({
        ...prev,
        [chatId]: prev[chatId] ?? createEmptyChat(chatId, result.phoneNumber || phoneDigits),
      }));
      setActiveChatId(chatId);
      setModalOpen(false);
    } catch (err) {
      setCheckError(
        err instanceof GreenApiError
          ? err.message
          : "Не удалось проверить номер. Попробуйте ещё раз.",
      );
    } finally {
      setCheckingAccount(false);
    }
  }

  async function handleSend(text) {
    const chatId = activeChatId;
    if (!chatId) return;

    const tempId = `local-${Date.now()}`;
    const optimisticMessage = {
      idMessage: tempId,
      text,
      direction: "out",
      timestamp: Date.now(),
      status: "sending",
    };

    setSendError("");
    setChats((prev) => appendMessage(prev, chatId, optimisticMessage));
    setIsSending(true);

    try {
      const result = await apiSendMessage(credentials, chatId, text);
      setChats((prev) =>
        updateMessage(prev, chatId, tempId, {
          idMessage: result?.idMessage || tempId,
          status: "sent",
        }),
      );
    } catch (err) {
      setChats((prev) => updateMessage(prev, chatId, tempId, { status: "error" }));
      setSendError(
        err instanceof GreenApiError
          ? err.message
          : "Не удалось отправить сообщение. Попробуйте ещё раз.",
      );
    } finally {
      setIsSending(false);
    }
  }

  const activeChat = activeChatId ? chats[activeChatId] : null;

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
        idInstance={credentials.idInstance}
      />
      <ChatWindow
        chat={activeChat}
        onSend={handleSend}
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

function createEmptyChat(chatId, phone, title) {
  return { chatId, phone: phone || "", title: title || "", messages: [], lastMessageAt: Date.now() };
}

function appendMessage(chats, chatId, message) {
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

function updateMessage(chats, chatId, idMessage, patch) {
  const existing = chats[chatId];
  if (!existing) return chats;
  return {
    ...chats,
    [chatId]: {
      ...existing,
      messages: existing.messages.map((m) =>
        m.idMessage === idMessage ? { ...m, ...patch } : m,
      ),
    },
  };
}
