// Пока хук смонтирован, в фоне крутит long polling ReceiveNotification/DeleteNotification
// (https://green-api.com/v3/docs/api/receiving/technology-http-api/).
//
// Устойчивость к сбоям, заложенная сюда:
//   - экспоненциальный backoff при повторяющихся ошибках сети/сервера, чтобы не
//     заваливать GREEN-API и не жечь батарею телефона бесконечным тесным циклом;
//   - AbortController, реально отменяющий текущий fetch при размонтировании
//     (а не просто флаг, из-за которого пришлось бы ждать до 20+ секунд);
//   - Web Locks API — если открыто несколько вкладок, реально опрашивает только
//     одна из них, остальные не воюют за общую очередь инстанса;
//   - onConnectionIssue сообщает наружу о затяжных проблемах со связью, чтобы
//     интерфейс мог показать ненавязчивый баннер вместо тихого зависания;
//   - defensive-парсинг тела вебхука: неожиданная форма ответа не роняет
//     приложение, просто игнорируется с предупреждением в консоль.

import { useEffect, useRef } from "react";
import { deleteNotification, GreenApiError, receiveNotification } from "../api/greenApi";
import type { GreenApiCredentials, IncomingMessageEvent, WebhookBody } from "../types";
import { withSingleTabLock } from "./useSingleTabLock";

const RECEIVE_TIMEOUT_SEC = 5;
const MAX_BACKOFF_MS = 30_000;
const BASE_BACKOFF_MS = 1_000;
/** После скольких подряд неудачных попыток показываем баннер о проблемах со связью. */
const CONNECTION_ISSUE_THRESHOLD = 3;

interface UseIncomingMessagesOptions {
  onConnectionIssue?: (isHavingIssues: boolean) => void;
}

export function useIncomingMessages(
  credentials: GreenApiCredentials | null,
  onMessage: (event: IncomingMessageEvent) => void,
  options: UseIncomingMessagesOptions = {},
): void {
  const onMessageRef = useRef(onMessage);
  const onConnectionIssueRef = useRef(options.onConnectionIssue);

  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  useEffect(() => {
    onConnectionIssueRef.current = options.onConnectionIssue;
  }, [options.onConnectionIssue]);

  useEffect(() => {
    if (!credentials?.idInstance || !credentials?.apiTokenInstance) return;

    const controller = new AbortController();
    const lockName = `green-api-poll-${credentials.idInstance}`;

    withSingleTabLock(lockName, controller.signal, () => pollLoop(credentials, controller.signal)).catch(
      (err) => {
        // Сюда попадём только если и сам цикл, и его обработка ошибок не справились —
        // логируем, но не бросаем дальше (это фоновая задача, а не пользовательское действие).
        console.error("useIncomingMessages: неожиданная остановка цикла опроса", err);
      },
    );

    return () => {
      controller.abort();
    };

    async function pollLoop(creds: GreenApiCredentials, signal: AbortSignal): Promise<void> {
      let consecutiveFailures = 0;

      while (!signal.aborted) {
        try {
          const notification = await receiveNotification(creds, RECEIVE_TIMEOUT_SEC, signal);

          if (consecutiveFailures > 0) {
            consecutiveFailures = 0;
            onConnectionIssueRef.current?.(false);
          }

          if (!notification) continue; // таймаут ожидания истёк, уведомлений не было

          const { receiptId, body } = notification;
          handleNotification(body);

          // Уведомление обязательно нужно удалить, иначе очередь будет отдавать его снова.
          // Если delete не удастся (сеть моргнула ровно в этот момент) — переживём получение
          // этого уведомления повторно на следующей итерации: обработка идемпотентна благодаря
          // дедупликации по idMessage на стороне вызывающего кода.
          if (receiptId != null) {
            try {
              await deleteNotification(creds, receiptId);
            } catch (err) {
              console.warn("useIncomingMessages: не удалось удалить уведомление", err);
            }
          }
        } catch (err) {
          if (signal.aborted) break;

          consecutiveFailures += 1;
          if (consecutiveFailures >= CONNECTION_ISSUE_THRESHOLD) {
            onConnectionIssueRef.current?.(true);
          }

          const kind = err instanceof GreenApiError ? err.kind : "unknown";
          // auth-ошибки (неверный токен) не исчезнут от повторных попыток — но мы всё
          // равно не останавливаем цикл насовсем: пользователь может обновить данные
          // через перелогин, а бесконечно быстрый цикл ошибок предотвращаем backoff'ом.
          console.warn(`useIncomingMessages: ошибка опроса (${kind})`, err);

          await sleepInterruptible(
            Math.min(BASE_BACKOFF_MS * 2 ** (consecutiveFailures - 1), MAX_BACKOFF_MS),
            signal,
          );
        }
      }
    }

    function handleNotification(body: WebhookBody): void {
      if (!body || typeof body !== "object") return;
      if (body.typeWebhook !== "incomingMessageReceived") return;

      const textMessage =
        body.messageData?.textMessageData?.textMessage ??
        body.messageData?.extendedTextMessageData?.text;
      if (!textMessage) return; // интересуют только текстовые сообщения (по ТЗ)

      const chatId = body.senderData?.chatId;
      const idMessage = body.idMessage;
      if (!chatId || !idMessage) {
        console.warn("useIncomingMessages: уведомление без chatId/idMessage, пропускаю", body);
        return;
      }

      onMessageRef.current({
        chatId,
        senderName: body.senderData?.senderName || body.senderData?.chatName,
        senderPhoneNumber: body.senderData?.senderPhoneNumber,
        text: textMessage,
        idMessage,
        timestamp: body.timestamp ? body.timestamp * 1000 : Date.now(),
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- сравниваем по значениям полей, а не по ссылке на объект
  }, [credentials?.idInstance, credentials?.apiTokenInstance, credentials?.apiUrl]);
}

/** Как sleep(ms), но просыпается раньше, если signal был прерван (например, размонтирование). */
function sleepInterruptible(ms: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) return Promise.resolve();

  return new Promise((resolve) => {
    const timeoutId = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);

    function onAbort() {
      clearTimeout(timeoutId);
      resolve();
    }

    signal.addEventListener("abort", onAbort, { once: true });
  });
}
