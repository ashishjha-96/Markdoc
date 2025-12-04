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
        borderTop: "1px solid #e0e0e0",
        padding: "12px 16px",
        display: "flex",
        gap: "8px",
        alignItems: "center",
        backgroundColor: "white",
      }}
    >
      <input
        type="text"
        value={message}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onBlur={onStopTyping}
        placeholder="Type a message..."
        style={{
          flex: 1,
          padding: "8px 12px",
          border: "1px solid #e0e0e0",
          borderRadius: "6px",
          fontSize: "14px",
          outline: "none",
          transition: "border-color 0.2s",
        }}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = "#646cff";
        }}
      />

      <button
        onClick={handleSend}
        disabled={!message.trim()}
        style={{
          padding: "8px 16px",
          backgroundColor: message.trim() ? "#646cff" : "#e0e0e0",
          color: message.trim() ? "white" : "#999",
          border: "none",
          borderRadius: "6px",
          fontSize: "14px",
          fontWeight: 600,
          cursor: message.trim() ? "pointer" : "not-allowed",
          transition: "background-color 0.2s",
        }}
        onMouseEnter={(e) => {
          if (message.trim()) {
            e.currentTarget.style.backgroundColor = "#535bf2";
          }
        }}
        onMouseLeave={(e) => {
          if (message.trim()) {
            e.currentTarget.style.backgroundColor = "#646cff";
          }
        }}
      >
        Send
      </button>
    </div>
  );
}
