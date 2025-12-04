/**
 * ReadReceipts Component
 *
 * Displays which users have read a message.
 * Shows "✓✓ Read by Alice, Bob" below messages.
 */

import type { ChatMessage } from "../../hooks/useChat";
import type { UserPresence } from "../../hooks/usePresence";

interface ReadReceiptsProps {
  message: ChatMessage;
  messages: ChatMessage[];
  readReceipts: Map<string, string>; // userId -> lastReadMessageId
  presenceUsers: Record<string, UserPresence>;
  currentUserId: string;
}

export function ReadReceipts({
  message,
  messages,
  readReceipts,
  presenceUsers,
  currentUserId,
}: ReadReceiptsProps) {
  // Find all users who have read this message or later messages
  const readByUsers: string[] = [];

  readReceipts.forEach((lastReadMessageId, userId) => {
    // Skip current user (we know we've read our own messages)
    if (userId === currentUserId) return;

    // Find the index of this message and the user's last read message
    const messageIndex = messages.findIndex((m) => m.id === message.id);
    const lastReadIndex = messages.findIndex(
      (m) => m.id === lastReadMessageId
    );

    // If user has read this message or a later one, they've read this
    if (lastReadIndex >= messageIndex) {
      const userName = presenceUsers[userId]?.name || `User ${userId}`;
      readByUsers.push(userName);
    }
  });

  if (readByUsers.length === 0) {
    return null;
  }

  let displayText = "";
  if (readByUsers.length === 1) {
    displayText = `Read by ${readByUsers[0]}`;
  } else if (readByUsers.length === 2) {
    displayText = `Read by ${readByUsers[0]} and ${readByUsers[1]}`;
  } else {
    displayText = `Read by ${readByUsers[0]}, ${readByUsers[1]} and ${
      readByUsers.length - 2
    } ${readByUsers.length - 2 === 1 ? "other" : "others"}`;
  }

  return (
    <div
      style={{
        fontSize: "11px",
        color: "#999",
        marginTop: "2px",
        display: "flex",
        alignItems: "center",
        gap: "4px",
      }}
    >
      <span>✓✓</span>
      <span>{displayText}</span>
    </div>
  );
}
