/**
 * Общие типы приложения. Здесь же держим типы ответов GREEN-API, которые нам
 * реально нужны (без претензии на полное покрытие всего API).
 */

export interface GreenApiCredentials {
  idInstance: string;
  apiTokenInstance: string;
  apiUrl: string;
}

/**
 * Возможные значения stateInstance по документации GREEN-API.
 * https://green-api.com/v3/docs/api/account/GetStateInstance/
 */
export type InstanceState =
  | "authorized"
  | "notAuthorized"
  | "blocked"
  | "sleepMode"
  | "starting"
  | "yellowCard"
  | (string & {}); // сервер может вернуть значение, которого нет в документации — не хотим падать на этом

export interface GetStateInstanceResponse {
  stateInstance: InstanceState;
}

export interface GetSettingsResponse {
  webhookUrl?: string;
  incomingWebhook?: "yes" | "no";
  outgoingWebhook?: "yes" | "no";
  stateWebhook?: "yes" | "no";
  [key: string]: unknown;
}

export interface CheckAccountResponse {
  exist: boolean;
  chatId?: string;
  phoneNumber?: number;
  fromCache?: boolean;
}

export interface SendMessageResponse {
  idMessage: string;
}

/** Тело уведомления, отдаваемое ReceiveNotification (после разбора JSON). */
export interface ReceivedNotification {
  receiptId: number;
  body: WebhookBody;
}

export interface WebhookBody {
  typeWebhook: string;
  instanceData?: {
    idInstance: number;
    wid?: string;
    typeInstance?: string;
  };
  timestamp?: number;
  idMessage?: string;
  senderData?: {
    chatId?: string;
    chatName?: string;
    chatType?: string;
    sender?: string;
    senderName?: string;
    senderType?: string;
    senderContactName?: string;
    senderPhoneNumber?: number;
  };
  messageData?: {
    typeMessage?: string;
    textMessageData?: { textMessage?: string; isTemplateMessage?: boolean };
    extendedTextMessageData?: { text?: string };
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export type MessageDirection = "in" | "out";
export type MessageStatus = "sending" | "sent" | "received" | "error";

export interface ChatMessage {
  idMessage: string;
  text: string;
  direction: MessageDirection;
  timestamp: number;
  status: MessageStatus;
}

export interface ChatRecord {
  chatId: string;
  /** Номер телефона получателя, если известен (не всегда выводим из chatId — в MAX chatId непрозрачен). */
  phone: string;
  title: string;
  messages: ChatMessage[];
  lastMessageAt: number;
}

export type ChatsById = Record<string, ChatRecord>;

/** Классификация ошибок GREEN-API, чтобы решать — повторять запрос или нет. */
export type GreenApiErrorKind =
  | "network"
  | "timeout"
  | "auth"
  | "rate_limit"
  | "not_found"
  | "server"
  | "unknown";

export interface IncomingMessageEvent {
  chatId: string;
  senderName?: string;
  senderPhoneNumber?: number;
  text: string;
  idMessage: string;
  timestamp: number;
}
