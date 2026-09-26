import "./MessageBubble.css";

export default function MessageBubble({ message }) {
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
      </div>
    </div>
  );
}
