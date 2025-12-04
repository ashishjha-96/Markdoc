/**
 * MessageReactions Component
 *
 * Displays emoji reactions for a message and allows adding new reactions.
 */

import { useState } from "react";
import type { ChatMessage } from "../../hooks/useChat";

interface MessageReactionsProps {
  message: ChatMessage;
  currentUserId: string;
  onAddReaction: (messageId: string, emoji: string) => void;
}

const EMOJI_OPTIONS = ["👍", "❤️", "😂", "🎉", "🤔", "👀", "🔥", "✨"];

export function MessageReactions({
  message,
  currentUserId,
  onAddReaction,
}: MessageReactionsProps) {
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const reactions = message.reactions || {};

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "6px",
        marginTop: "6px",
        flexWrap: "wrap",
      }}
    >
      {/* Existing reactions */}
      {Object.entries(reactions).map(([emoji, userIds]) => {
        const count = userIds.length;
        const hasReacted = userIds.includes(currentUserId);

        return (
          <button
            key={emoji}
            onClick={() => onAddReaction(message.id, emoji)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "4px",
              padding: "2px 8px",
              border: `1px solid ${hasReacted ? "#646cff" : "var(--chat-border)"}`,
              borderRadius: "12px",
              backgroundColor: hasReacted ? "#f0f0ff" : "var(--chat-btn-bg)",
              fontSize: "13px",
              cursor: "pointer",
              transition: "all 0.2s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = hasReacted
                ? "#e6e6ff"
                : "var(--chat-btn-hover)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = hasReacted
                ? "#f0f0ff"
                : "var(--chat-btn-bg)";
            }}
          >
            <span>{emoji}</span>
            <span
              style={{
                fontSize: "11px",
                color: hasReacted ? "#646cff" : "var(--chat-text-secondary)",
                fontWeight: hasReacted ? 600 : 400,
              }}
            >
              {count}
            </span>
          </button>
        );
      })}

      {/* Add reaction button */}
      <div style={{ position: "relative" }}>
        <button
          onClick={() => setShowEmojiPicker(!showEmojiPicker)}
          style={{
            width: "24px",
            height: "24px",
            border: "1px solid var(--chat-border)",
            borderRadius: "12px",
            backgroundColor: "var(--chat-btn-bg)",
            color: "var(--chat-text-secondary)",
            fontSize: "13px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "all 0.2s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "var(--chat-btn-hover)";
            e.currentTarget.style.borderColor = "#646cff";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "var(--chat-btn-bg)";
            e.currentTarget.style.borderColor = "var(--chat-border)";
          }}
        >
          {showEmojiPicker ? "×" : "+"}
        </button>

        {/* Emoji picker dropdown */}
        {showEmojiPicker && (
          <>
            {/* Backdrop */}
            <div
              onClick={() => setShowEmojiPicker(false)}
              style={{
                position: "fixed",
                inset: 0,
                zIndex: 1001,
              }}
            />

            {/* Emoji grid */}
            <div
              style={{
                position: "absolute",
                top: "calc(100% + 4px)",
                left: 0,
                backgroundColor: "var(--chat-bg)",
                border: "1px solid var(--chat-border)",
                borderRadius: "8px",
                padding: "8px",
                boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                zIndex: 1002,
                display: "grid",
                gridTemplateColumns: "repeat(4, 1fr)",
                gap: "4px",
              }}
            >
              {EMOJI_OPTIONS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => {
                    onAddReaction(message.id, emoji);
                    setShowEmojiPicker(false);
                  }}
                  style={{
                    width: "32px",
                    height: "32px",
                    border: "none",
                    backgroundColor: "transparent",
                    fontSize: "18px",
                    cursor: "pointer",
                    borderRadius: "4px",
                    transition: "background-color 0.2s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = "var(--chat-btn-hover)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "transparent";
                  }}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
