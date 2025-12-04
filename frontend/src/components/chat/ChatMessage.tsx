/**
 * ChatMessage Component
 *
 * Displays an individual chat message with author, content, timestamp,
 * reactions, and read receipts.
 */

import type { ChatMessage as ChatMessageType } from "../../hooks/useChat";
import type { UserPresence } from "../../hooks/usePresence";
import { MessageReactions } from "./MessageReactions";
import { ReadReceipts } from "./ReadReceipts";

interface ChatMessageProps {
  message: ChatMessageType;
  messages: ChatMessageType[];
  currentUserId: string;
  presenceUsers: Record<string, UserPresence>;
  readReceipts: Map<string, string>;
  onAddReaction: (messageId: string, emoji: string) => void;
}

function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffInMs = now.getTime() - date.getTime();
  const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
  const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
  const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

  if (diffInMinutes < 1) {
    return "Just now";
  } else if (diffInMinutes < 60) {
    return `${diffInMinutes}m ago`;
  } else if (diffInHours < 24) {
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  } else if (diffInDays < 7) {
    return date.toLocaleDateString("en-US", { weekday: "short", hour: "numeric", minute: "2-digit" });
  } else {
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }
}

function getInitials(name: string): string {
  const words = name.trim().split(/\s+/);
  if (words.length === 1) {
    return words[0].substring(0, 2).toUpperCase();
  }
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

export function ChatMessage({
  message,
  messages,
  currentUserId,
  presenceUsers,
  readReceipts,
  onAddReaction,
}: ChatMessageProps) {
  const isOwnMessage = message.userId === currentUserId;

  return (
    <div
      style={{
        display: "flex",
        gap: "12px",
        marginBottom: "16px",
      }}
    >
      {/* Avatar */}
      <div
        style={{
          width: "32px",
          height: "32px",
          borderRadius: "50%",
          backgroundColor: message.userColor,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "12px",
          fontWeight: 600,
          color: "white",
          flexShrink: 0,
        }}
      >
        {getInitials(message.userName)}
      </div>

      {/* Message content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Header: Name and timestamp */}
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: "8px",
            marginBottom: "4px",
          }}
        >
          <span
            style={{
              fontWeight: 600,
              fontSize: "14px",
              color: "var(--chat-text)",
            }}
          >
            {message.userName}
            {isOwnMessage && (
              <span style={{ fontWeight: 400, color: "var(--chat-text-tertiary)" }}> (You)</span>
            )}
          </span>
          <span
            style={{
              fontSize: "12px",
              color: "var(--chat-text-tertiary)",
            }}
          >
            {formatTimestamp(message.timestamp)}
          </span>
        </div>

        {/* Message text */}
        <div
          style={{
            fontSize: "14px",
            color: "var(--chat-text)",
            lineHeight: "1.5",
            wordBreak: "break-word",
            whiteSpace: "pre-wrap",
          }}
        >
          {message.content}
        </div>

        {/* Reactions */}
        <MessageReactions
          message={message}
          currentUserId={currentUserId}
          onAddReaction={onAddReaction}
        />

        {/* Read receipts */}
        <ReadReceipts
          message={message}
          messages={messages}
          readReceipts={readReceipts}
          presenceUsers={presenceUsers}
          currentUserId={currentUserId}
        />
      </div>
    </div>
  );
}
