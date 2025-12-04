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
              border: `1px solid ${hasReacted ? "#646cff" : "#e0e0e0"}`,
              borderRadius: "12px",
              backgroundColor: hasReacted ? "#f0f0ff" : "white",
              fontSize: "13px",
              cursor: "pointer",
              transition: "all 0.2s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = hasReacted
                ? "#e6e6ff"
                : "#f5f5f5";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = hasReacted
                ? "#f0f0ff"
                : "white";
            }}
          >
            <span>{emoji}</span>
            <span
              style={{
                fontSize: "11px",
                color: hasReacted ? "#646cff" : "#666",
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
            border: "1px solid #e0e0e0",
            borderRadius: "12px",
            backgroundColor: "white",
            fontSize: "13px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "all 0.2s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "#f5f5f5";
            e.currentTarget.style.borderColor = "#646cff";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "white";
            e.currentTarget.style.borderColor = "#e0e0e0";
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
                backgroundColor: "white",
                border: "1px solid #e0e0e0",
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
                    e.currentTarget.style.backgroundColor = "#f5f5f5";
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
