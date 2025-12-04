/**
 * ChatInput Component
 *
 * Message input field with send button.
 * Triggers typing indicators and handles message submission.
 */

import { useState, type KeyboardEvent, type ChangeEvent } from "react";

interface ChatInputProps {
  onSendMessage: (content: string) => void;
  onTyping: () => void;
  onStopTyping: () => void;
}

export function ChatInput({
  onSendMessage,
  onTyping,
  onStopTyping,
}: ChatInputProps) {
  const [message, setMessage] = useState("");

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    setMessage(e.target.value);
    if (e.target.value.trim()) {
      onTyping();
    } else {
      onStopTyping();
    }
  };

  const handleSend = () => {
    const trimmed = message.trim();
    if (!trimmed) return;

    onSendMessage(trimmed);
    setMessage("");
    onStopTyping();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div
      style={{
        borderTop: "1px solid var(--chat-border)",
        padding: "12px 16px",
        backgroundColor: "var(--chat-bg)",
        transition: "background-color 0.2s ease, border-color 0.2s ease",
      }}
    >
      <div style={{ position: "relative" }}>
        <input
          type="text"
          value={message}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onBlur={onStopTyping}
          placeholder="Type a message..."
          style={{
            width: "100%",
            padding: "8px 40px 8px 12px",
            border: "1px solid var(--chat-border)",
            borderRadius: "6px",
            fontSize: "14px",
            outline: "none",
            backgroundColor: "var(--chat-btn-bg)",
            color: "var(--chat-text)",
            transition: "border-color 0.2s, background-color 0.2s ease, color 0.2s ease",
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = "#646cff";
          }}
        />

        <button
          onClick={handleSend}
          disabled={!message.trim()}
          style={{
            position: "absolute",
            right: "8px",
            top: "50%",
            transform: "translateY(-50%)",
            padding: "6px",
            backgroundColor: "transparent",
            color: message.trim() ? "#646cff" : "#999",
            border: "none",
            borderRadius: "4px",
            cursor: message.trim() ? "pointer" : "not-allowed",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "color 0.2s",
          }}
          onMouseEnter={(e) => {
            if (message.trim()) {
              e.currentTarget.style.color = "#535bf2";
            }
          }}
          onMouseLeave={(e) => {
            if (message.trim()) {
              e.currentTarget.style.color = "#646cff";
            }
          }}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            fill="currentColor"
            viewBox="0 0 16 16"
          >
            <path d="M15.854.146a.5.5 0 0 1 .11.54l-5.819 14.547a.75.75 0 0 1-1.329.124l-3.178-4.995L.643 7.184a.75.75 0 0 1 .124-1.33L15.314.037a.5.5 0 0 1 .54.11ZM6.636 10.07l2.761 4.338L14.13 2.576zm6.787-8.201L1.591 6.602l4.339 2.76z" />
          </svg>
        </button>
      </div>
    </div>
  );
}
