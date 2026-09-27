// Тонкая типизированная обёртка над HTTP API GREEN-API для MAX
// (https://green-api.com/v3/docs/). Все запросы уходят напрямую из браузера —
// GREEN-API поддерживает CORS, поэтому отдельный бэкенд не нужен.
//
// Помимо самих вызовов методов, клиент берёт на себя вещи, без которых
// продакшен-код быстро станет хрупким:
//   - таймаут на каждый запрос (fetch сам по себе никогда не отваливается);
//   - классификация ошибок (сеть/таймаут/авторизация/лимиты/сервер), чтобы
//     вызывающий код мог решить — показать ошибку сразу или повторить запрос;
//   - ретраи с экспоненциальным backoff только для транзиентных ошибок
//     (сеть, таймаут, 5xx, 429) — но не для 4xx-ошибок вроде неверного токена.

import type {
  CheckAccountResponse,
  GetSettingsResponse,
  GetStateInstanceResponse,
  GreenApiCredentials,
  GreenApiErrorKind,
  SendMessageResponse,
} from "../types";

export const DEFAULT_API_URL = "https://api.green-api.com";

const DEFAULT_TIMEOUT_MS = 15_000;
const MAX_RETRIES = 3;
const BASE_BACKOFF_MS = 600;

export class GreenApiError extends Error {
  readonly kind: GreenApiErrorKind;
  readonly status?: number;

  constructor(message: string, kind: GreenApiErrorKind, status?: number) {
    super(message);
    this.name = "GreenApiError";
    this.kind = kind;
    this.status = status;
  }
}

/** Убирает пробелы и завершающий слэш у пользовательского хоста apiUrl. */
function normalizeApiUrl(apiUrl: string): string {
  const trimmed = (apiUrl || DEFAULT_API_URL).trim();
  return trimmed.endsWith("/") ? trimmed.slice(0, -1) : trimmed;
}

/** Собирает базовый путь вида {apiUrl}/waInstance{idInstance}/{method}/{apiTokenInstance}. */
function buildUrl(credentials: GreenApiCredentials, method: string): string {
  const { apiUrl, idInstance, apiTokenInstance } = credentials;
  return `${normalizeApiUrl(apiUrl)}/waInstance${idInstance}/${method}/${apiTokenInstance}`;
}

function classifyHttpStatus(status: number): GreenApiErrorKind {
  if (status === 401 || status === 403) return "auth";
  if (status === 404) return "not_found";
  if (status === 408) return "timeout";
  if (status === 429) return "rate_limit";
  if (status >= 500) return "server";
  return "unknown";
}

function isRetriable(kind: GreenApiErrorKind): boolean {
  return kind === "network" || kind === "timeout" || kind === "server" || kind === "rate_limit";
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Добавляет случайный разброс к паузе между ретраями, чтобы клиенты не били сервер синхронными волнами. */
function backoffDelay(attempt: number): number {
  const exponential = BASE_BACKOFF_MS * 2 ** attempt;
  const jitter = Math.random() * BASE_BACKOFF_MS;
  return Math.min(exponential + jitter, 10_000);
}

interface RequestOptions extends RequestInit {
  /** Таймаут в мс. По умолчанию DEFAULT_TIMEOUT_MS. Для long polling передавайте больше receiveTimeout. */
  timeoutMs?: number;
  /** Разрешить ретраи транзиентных ошибок. По умолчанию true. Для long polling — false: там свой цикл ретраев. */
  allowRetries?: boolean;
  /** Внешний AbortSignal (например, от размонтирования компонента), помимо внутреннего таймаута. */
  externalSignal?: AbortSignal;
}

async function requestOnce(url: string, options: RequestOptions): Promise<unknown> {
  const controller = new AbortController();
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const onExternalAbort = () => controller.abort();
  options.externalSignal?.addEventListener("abort", onExternalAbort);

  let response: Response;
  try {
    response = await fetch(url, { ...options, signal: controller.signal });
  } catch (err) {
    if (options.externalSignal?.aborted) {
      throw new GreenApiError("Запрос отменён.", "unknown");
    }
    if ((err as Error)?.name === "AbortError") {
      throw new GreenApiError(
        "GREEN-API не ответил вовремя. Проверьте соединение и попробуйте снова.",
        "timeout",
      );
    }
    throw new GreenApiError(
      "Не удалось связаться с GREEN-API. Проверьте интернет-соединение и адрес apiUrl.",
      "network",
    );
  } finally {
    clearTimeout(timeoutId);
    options.externalSignal?.removeEventListener("abort", onExternalAbort);
  }

  // 204 — валидный пустой ответ (например, у ReceiveNotification при отсутствии уведомлений)
  if (response.status === 204) return null;

  const text = await response.text();
  const data = text ? safeJsonParse(text) : null;

  if (!response.ok) {
    const kind = classifyHttpStatus(response.status);
    const parsedMessage =
      data && typeof data === "object" && data !== null
        ? (data as { message?: string; error?: string }).message ??
          (data as { message?: string; error?: string }).error
        : undefined;
    throw new GreenApiError(
      parsedMessage || describeHttpError(kind, response.status),
      kind,
      response.status,
    );
  }

  return data;
}

function describeHttpError(kind: GreenApiErrorKind, status: number): string {
  switch (kind) {
    case "auth":
      return "Неверные idInstance/apiTokenInstance или инстанс не авторизован.";
    case "rate_limit":
      return "Слишком много запросов к GREEN-API. Подождите немного и повторите попытку.";
    case "server":
      return "GREEN-API временно недоступен (ошибка сервера). Попробуйте ещё раз позже.";
    case "not_found":
      return "Метод или инстанс не найден. Проверьте idInstance и apiUrl.";
    default:
      return `GREEN-API вернул ошибку (HTTP ${status}).`;
  }
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/** Запрос с ретраями для транзиентных ошибок (используется для обычных, «быстрых» методов). */
async function request(url: string, options: RequestOptions = {}): Promise<unknown> {
  const allowRetries = options.allowRetries ?? true;
  let lastError: GreenApiError | undefined;

  for (let attempt = 0; attempt <= (allowRetries ? MAX_RETRIES : 0); attempt++) {
    try {
      return await requestOnce(url, options);
    } catch (err) {
      const greenApiError =
        err instanceof GreenApiError
          ? err
          : new GreenApiError("Неизвестная ошибка GREEN-API.", "unknown");
      lastError = greenApiError;

      const isLastAttempt = attempt === (allowRetries ? MAX_RETRIES : 0);
      if (!allowRetries || !isRetriable(greenApiError.kind) || isLastAttempt) {
        throw greenApiError;
      }
      await sleep(backoffDelay(attempt));
    }
  }

  // Сюда не должны дойти, но чтобы TypeScript был спокоен насчёт возвращаемого значения:
  throw lastError ?? new GreenApiError("Неизвестная ошибка GREEN-API.", "unknown");
}

/**
 * Проверяет учётные данные и возвращает состояние инстанса.
 * Используется методом GetStateInstance — не требует авторизации в MAX,
 * достаточно правильных idInstance/apiTokenInstance/apiUrl.
 */
export async function getStateInstance(
  credentials: GreenApiCredentials,
): Promise<GetStateInstanceResponse> {
  const url = buildUrl(credentials, "getStateInstance");
  return (await request(url, { method: "GET" })) as GetStateInstanceResponse;
}

/** Текущие настройки инстанса — используется для диагностики (webhookUrl/incomingWebhook). */
export async function getSettings(
  credentials: GreenApiCredentials,
): Promise<GetSettingsResponse> {
  const url = buildUrl(credentials, "getSettings");
  return (await request(url, { method: "GET" })) as GetSettingsResponse;
}

/**
 * Резолвит настоящий chatId по номеру телефона. Обязательный шаг для MAX: там
 * chatId — непрозрачный числовой идентификатор, а не phoneNumber@c.us, как в
 * WhatsApp. См. https://green-api.com/v3/docs/api/chat-id/
 */
export async function checkAccount(
  credentials: GreenApiCredentials,
  phoneNumberDigits: string,
): Promise<CheckAccountResponse> {
  const url = buildUrl(credentials, "checkAccount");
  return (await request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phoneNumber: Number(phoneNumberDigits) }),
  })) as CheckAccountResponse;
}

/** Отправка текстового сообщения. */
export async function sendMessage(
  credentials: GreenApiCredentials,
  chatId: string,
  message: string,
): Promise<SendMessageResponse> {
  const url = buildUrl(credentials, "sendMessage");
  return (await request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chatId, message }),
  })) as SendMessageResponse;
}

/**
 * Забирает одно входящее уведомление из очереди (long polling, ждёт до receiveTimeout секунд).
 * Возвращает null, если уведомлений нет. Ретраи здесь намеренно отключены —
 * вызывающий код (см. useIncomingMessages) сам управляет циклом опроса и своим backoff,
 * иначе один "зависший" запрос удвоит время ожидания незаметно для вызывающей стороны.
 */
export async function receiveNotification(
  credentials: GreenApiCredentials,
  receiveTimeoutSec: number,
  externalSignal?: AbortSignal,
): Promise<{ receiptId: number; body: import("../types").WebhookBody } | null> {
  const base = buildUrl(credentials, "receiveNotification");
  const url = `${base}?receiveTimeout=${receiveTimeoutSec}`;
  const result = await request(url, {
    method: "GET",
    allowRetries: false,
    timeoutMs: (receiveTimeoutSec + 10) * 1000,
    externalSignal,
  });
  return result as { receiptId: number; body: import("../types").WebhookBody } | null;
}

/** Удаляет обработанное уведомление из очереди по receiptId, чтобы не получать его повторно. */
export async function deleteNotification(
  credentials: GreenApiCredentials,
  receiptId: number,
): Promise<unknown> {
  const url = `${buildUrl(credentials, "deleteNotification")}/${receiptId}`;
  return request(url, { method: "DELETE" });
}
