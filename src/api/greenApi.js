// Тонкая обёртка над HTTP API GREEN-API (https://green-api.com/v3/docs/).
// Все запросы уходят напрямую из браузера — GREEN-API поддерживает CORS,
// поэтому отдельный бэкенд для этого задания не нужен.

export const DEFAULT_API_URL = "https://api.green-api.com";

/** Убирает пробелы и завершающий слэш у пользовательского хоста apiUrl. */
function normalizeApiUrl(apiUrl) {
  const trimmed = (apiUrl || DEFAULT_API_URL).trim();
  return trimmed.endsWith("/") ? trimmed.slice(0, -1) : trimmed;
}

/** Собирает базовый путь вида {apiUrl}/waInstance{idInstance}/{method}/{apiTokenInstance}. */
function buildUrl({ apiUrl, idInstance, apiTokenInstance }, method) {
  return `${normalizeApiUrl(apiUrl)}/waInstance${idInstance}/${method}/${apiTokenInstance}`;
}

class GreenApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "GreenApiError";
    this.status = status;
  }
}

async function request(url, options = {}) {
  let response;
  try {
    response = await fetch(url, options);
  } catch {
    throw new GreenApiError(
      "Не удалось связаться с GREEN-API. Проверьте интернет-соединение и адрес apiUrl.",
    );
  }

  // 204 — валидный пустой ответ (например, у ReceiveNotification при отсутствии уведомлений)
  if (response.status === 204) return null;

  const text = await response.text();
  const data = text ? safeJsonParse(text) : null;

  if (!response.ok) {
    const message =
      (data && (data.message || data.error)) ||
      `GREEN-API вернул ошибку (HTTP ${response.status}).`;
    throw new GreenApiError(message, response.status);
  }

  return data;
}

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/** Приводит введённый пользователем номер телефона к chatId вида 79991234567@c.us. */
export function phoneToChatId(rawPhone) {
  const digits = rawPhone.replace(/\D/g, "");
  if (!digits) return null;
  return `${digits}@c.us`;
}

export function chatIdToPhone(chatId) {
  return (chatId || "").replace("@c.us", "").replace("@g.us", "");
}

/**
 * Проверяет учётные данные и возвращает состояние инстанса.
 * Используется методом GetStateInstance — не требует авторизации WhatsApp/MAX,
 * достаточно правильных idInstance/apiTokenInstance/apiUrl.
 */
export async function getStateInstance(credentials) {
  const url = buildUrl(credentials, "getStateInstance");
  return request(url, { method: "GET" });
}

/** Отправка текстового сообщения. */
export async function sendMessage(credentials, chatId, message) {
  const url = buildUrl(credentials, "sendMessage");
  return request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chatId, message }),
  });
}

/**
 * Забирает одно входящее уведомление из очереди (long polling, ждёт до receiveTimeout секунд).
 * Возвращает null, если уведомлений нет.
 */
export async function receiveNotification(credentials, receiveTimeoutSec = 20) {
  const base = buildUrl(credentials, "receiveNotification");
  const url = `${base}?receiveTimeout=${receiveTimeoutSec}`;
  return request(url, { method: "GET" });
}

/** Удаляет обработанное уведомление из очереди по receiptId, чтобы не получать его повторно. */
export async function deleteNotification(credentials, receiptId) {
  const url = `${buildUrl(credentials, "deleteNotification")}/${receiptId}`;
  return request(url, { method: "DELETE" });
}

export { GreenApiError };
