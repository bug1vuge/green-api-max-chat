// Обёртка над localStorage. Всё состояние держится в браузере пользователя и
// никуда, кроме серверов GREEN-API, не отправляется.
//
// Продакшен-нюансы, которые здесь учтены:
//   - версия схемы хранения — если формат данных изменится в будущей версии
//     приложения, старые записи не уронят парсинг, а будут просто проигнорированы;
//   - все операции обёрнуты в try/catch — localStorage может быть недоступен
//     (приватный режим Safari, отключённые cookies) или переполнен (квота);
//   - история сообщений одного чата обрезается, чтобы не раздувать localStorage
//     до предела квоты (обычно 5–10 МБ) при долгой переписке.

import type { ChatRecord, ChatsById, GreenApiCredentials } from "../types";

const SCHEMA_VERSION = 1;
const CREDENTIALS_KEY = "maxchat:credentials";
const chatsKey = (idInstance: string) => `maxchat:chats:v${SCHEMA_VERSION}:${idInstance}`;

/** Не храним больше стольких сообщений на чат — старые обрезаются с начала. */
const MAX_MESSAGES_PER_CHAT = 500;

function isStorageAvailable(): boolean {
  try {
    const testKey = "__maxchat_probe__";
    localStorage.setItem(testKey, "1");
    localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

export const storageAvailable = isStorageAvailable();

export function loadCredentials(): GreenApiCredentials | null {
  if (!storageAvailable) return null;
  try {
    const raw = localStorage.getItem(CREDENTIALS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<GreenApiCredentials>;
    if (!parsed.idInstance || !parsed.apiTokenInstance) return null;
    return {
      idInstance: parsed.idInstance,
      apiTokenInstance: parsed.apiTokenInstance,
      apiUrl: parsed.apiUrl || "",
    };
  } catch {
    return null;
  }
}

export function saveCredentials(credentials: GreenApiCredentials): void {
  if (!storageAvailable) return;
  try {
    localStorage.setItem(CREDENTIALS_KEY, JSON.stringify(credentials));
  } catch {
    // Приватный режим/квота — молча продолжаем работать без персистентности логина.
  }
}

export function clearCredentials(): void {
  if (!storageAvailable) return;
  try {
    localStorage.removeItem(CREDENTIALS_KEY);
  } catch {
    // ignore
  }
}

export function loadChats(idInstance: string): ChatsById {
  if (!storageAvailable) return {};
  try {
    const raw = localStorage.getItem(chatsKey(idInstance));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    return isValidChatsShape(parsed) ? parsed : {};
  } catch {
    // Битый JSON (например, после ручного редактирования localStorage) — не роняем приложение.
    return {};
  }
}

export function saveChats(idInstance: string, chats: ChatsById): void {
  if (!storageAvailable) return;
  const trimmed = trimChatsForStorage(chats);
  try {
    localStorage.setItem(chatsKey(idInstance), JSON.stringify(trimmed));
  } catch (err) {
    // QuotaExceededError и подобные — пробуем один раз агрессивно обрезать историю и повторить,
    // чтобы одна разросшаяся переписка не убивала персистентность остальных чатов.
    if (isQuotaError(err)) {
      try {
        const aggressivelyTrimmed = trimChatsForStorage(chats, 50);
        localStorage.setItem(chatsKey(idInstance), JSON.stringify(aggressivelyTrimmed));
      } catch {
        // Совсем не помещается — смиряемся с потерей персистентности этой сессии.
      }
    }
  }
}

function isQuotaError(err: unknown): boolean {
  return (
    err instanceof DOMException &&
    (err.name === "QuotaExceededError" || err.name === "NS_ERROR_DOM_QUOTA_REACHED")
  );
}

function trimChatsForStorage(chats: ChatsById, limit = MAX_MESSAGES_PER_CHAT): ChatsById {
  const result: ChatsById = {};
  for (const [chatId, chat] of Object.entries(chats)) {
    result[chatId] = {
      ...chat,
      messages: chat.messages.length > limit ? chat.messages.slice(-limit) : chat.messages,
    };
  }
  return result;
}

function isValidChatsShape(value: unknown): value is ChatsById {
  if (!value || typeof value !== "object") return false;
  return Object.values(value as Record<string, unknown>).every((chat) => {
    const c = chat as Partial<ChatRecord>;
    return typeof c?.chatId === "string" && Array.isArray(c?.messages);
  });
}
