import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Перехватывает непойманные ошибки рендера в дереве ниже. Без этого любая
 * неожиданная ошибка (например, из-за неучтённой формы ответа сервера) кладёт
 * всё приложение белым экраном без единого объяснения пользователю.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("ErrorBoundary: непойманная ошибка рендера", error, info.componentStack);
  }

  private handleReset = (): void => {
    this.setState({ error: null });
  };

  render(): ReactNode {
    if (this.state.error) {
      return (
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
            padding: 24,
            textAlign: "center",
            fontFamily: "system-ui, sans-serif",
            color: "#14181f",
          }}
        >
          <div style={{ fontSize: 32 }}>⚠️</div>
          <h1 style={{ fontSize: 18, margin: 0 }}>Что-то пошло не так</h1>
          <p style={{ color: "#6b7686", maxWidth: 420, margin: 0 }}>
            Произошла непредвиденная ошибка интерфейса. Попробуйте перезагрузить страницу — данные
            чатов в браузере не пострадали.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              background: "#1279e0",
              color: "#fff",
              border: "none",
              borderRadius: 10,
              padding: "10px 18px",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Перезагрузить страницу
          </button>
          <button
            onClick={this.handleReset}
            style={{
              background: "none",
              border: "none",
              color: "#6b7686",
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            Попробовать без перезагрузки
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
