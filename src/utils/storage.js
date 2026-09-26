// Небольшая обёртка над localStorage. Всё состояние держится в браузере
// пользователя и никуда, кроме серверов GREEN-API, не отправляется.

const CREDENTIALS_KEY = "maxchat:credentials";
const chatsKey = (idInstance) => `maxchat:chats:${idInstance}`;

export function loadCredentials() {
  try {
    const raw = localStorage.getItem(CREDENTIALS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveCredentials(credentials) {
  localStorage.setItem(CREDENTIALS_KEY, JSON.stringify(credentials));
}

export function clearCredentials() {
  localStorage.removeItem(CREDENTIALS_KEY);
}

/** Список чатов вида { [chatId]: { chatId, phone, title, messages: [] } }, привязан к idInstance. */
export function loadChats(idInstance) {
  try {
    const raw = localStorage.getItem(chatsKey(idInstance));
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveChats(idInstance, chats) {
  localStorage.setItem(chatsKey(idInstance), JSON.stringify(chats));
}
