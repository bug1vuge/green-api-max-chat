// ReceiveNotification — это ОБЩАЯ очередь на инстанс: если открыть приложение
// в двух вкладках одновременно, они будут «отбирать» уведомления друг у друга
// и оба будут получать сообщения не полностью. Web Locks API позволяет решить
// это без бэкенда: только одна вкладка держит эксклюзивную блокировку и реально
// опрашивает очередь, остальные ждут своей очереди (и получат её, если первая
// вкладка закроется).
//
// Поддержка Web Locks API широкая (Chrome/Edge/Firefox/Safari 15.4+), но не
// стопроцентная — поэтому при отсутствии API просто отключаем блокировку и
// работаем как раньше (единственная деградация: конкуренция при нескольких
// вкладках), а не роняем приложение.

export function isWebLocksSupported(): boolean {
  return typeof navigator !== "undefined" && "locks" in navigator;
}

/**
 * Выполняет `task` только когда удалось получить эксклюзивную блокировку `lockName`.
 * Блокировка автоматически освобождается, когда промис из `task` завершится
 * или когда сработает `signal` (через AbortController, который вызывающий код
 * должен сам прервать при размонтировании).
 */
export async function withSingleTabLock(
  lockName: string,
  signal: AbortSignal,
  task: () => Promise<void>,
): Promise<void> {
  if (!isWebLocksSupported()) {
    // Нет поддержки — выполняем без блокировки (деградация, а не отказ).
    await task();
    return;
  }

  try {
    await navigator.locks.request(lockName, { signal }, async () => {
      await task();
    });
  } catch (err) {
    // AbortError — штатное завершение при размонтировании компонента, не ошибка.
    if ((err as Error)?.name !== "AbortError") {
      throw err;
    }
  }
}
