import { useEffect, useRef } from "react";
import { deleteNotification, receiveNotification } from "../api/greenApi";

/**
 * Пока хук смонтирован, в фоне крутит long polling ReceiveNotification/DeleteNotification
 * (см. https://green-api.com/v3/docs/api/receiving/technology-http-api/).
 * При входящем текстовом сообщении вызывает onMessage({ chatId, phone, text, idMessage, timestamp }).
 */
export function useIncomingMessages(credentials, onMessage) {
  const onMessageRef = useRef(onMessage);

  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  useEffect(() => {
    if (!credentials?.idInstance || !credentials?.apiTokenInstance) return;

    let stopped = false;

    async function pollLoop() {
      while (!stopped) {
        try {
          const notification = await receiveNotification(credentials, 20);

          if (!notification) continue; // таймаут ожидания истёк, уведомлений не было

          const { receiptId, body } = notification;
          handleNotification(body);

          // Уведомление обязательно нужно удалить, иначе очередь будет отдавать его снова
          if (receiptId != null) {
            await deleteNotification(credentials, receiptId);
          }
        } catch {
          // Сеть/сервис недоступны — не молотим бесконечный цикл ошибок, ждём немного и пробуем снова
          await sleep(4000);
        }
      }
    }

    function handleNotification(body) {
      if (!body || body.typeWebhook !== "incomingMessageReceived") return;

      const textMessage =
        body.messageData?.textMessageData?.textMessage ??
        body.messageData?.extendedTextMessageData?.text;
      if (!textMessage) return; // интересуют только текстовые сообщения (по заданию)

      const chatId = body.senderData?.chatId;
      if (!chatId) return;

      onMessageRef.current?.({
        chatId,
        senderName: body.senderData?.senderName || body.senderData?.chatName,
        senderPhoneNumber: body.senderData?.senderPhoneNumber,
        text: textMessage,
        idMessage: body.idMessage,
        timestamp: body.timestamp ? body.timestamp * 1000 : Date.now(),
      });
    }

    pollLoop();
    return () => {
      stopped = true;
    };
  }, [credentials?.idInstance, credentials?.apiTokenInstance, credentials?.apiUrl]);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
