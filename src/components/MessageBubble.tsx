import type { ChatMessage } from "../types";
import "./MessageBubble.css";

interface MessageBubbleProps {
  message: ChatMessage;
  onRetry?: (message: ChatMessage) => void;
}

export default function MessageBubble({ message, onRetry }: MessageBubbleProps) {
  const isOut = message.direction === "out";
  const time = new Date(message.timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className={`bubble-row ${isOut ? "out" : "in"}`}>
      <div className={`bubble ${isOut ? "out" : "in"} ${message.status === "error" ? "error" : ""}`}>
        <span className="bubble-text">{message.text}</span>
        <span className="bubble-meta">
          {time}
          {isOut && message.status === "sending" && " · отправка…"}
          {isOut && message.status === "error" && " · ошибка"}
        </span>
        {isOut && message.status === "error" && onRetry && (
          <button type="button" className="bubble-retry" onClick={() => onRetry(message)}>
            Повторить отправку
          </button>
        )}
      </div>
    </div>
  );
}
