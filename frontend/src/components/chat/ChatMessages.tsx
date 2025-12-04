/**
 * ChatMessages Component
 *
 * Container for displaying all chat messages with auto-scroll and read receipt tracking.
 */

import { useEffect, useRef } from "react";
import type { ChatMessage as ChatMessageType } from "../../hooks/useChat";
import type { UserPresence } from "../../hooks/usePresence";
import { ChatMessage } from "./ChatMessage";
import { TypingIndicator } from "./TypingIndicator";

interface ChatMessagesProps {
  messages: ChatMessageType[];
  currentUserId: string;
  presenceUsers: Record<string, UserPresence>;
  typingUsers: Set<string>;
  readReceipts: Map<string, string>;
  onAddReaction: (messageId: string, emoji: string) => void;
  onMarkAsRead: (messageId: string) => void;
  myLastReadMessageId: string | null;
  height: number;
}

export function ChatMessages({
  messages,
  currentUserId,
  presenceUsers,
  typingUsers,
  readReceipts,
  onAddReaction,
  onMarkAsRead,
  myLastReadMessageId,
  height,
}: ChatMessagesProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const lastMessageIdRef = useRef<string | null>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (!containerRef.current || messages.length === 0) return;

    const lastMessage = messages[messages.length - 1];
    if (lastMessage.id !== lastMessageIdRef.current) {
      lastMessageIdRef.current = lastMessage.id;
      containerRef.current.scrollTop = containerRef.current.scrollHeight;

      // Mark last message as read after scrolling
      setTimeout(() => {
        onMarkAsRead(lastMessage.id);
      }, 100);
    }
  }, [messages, onMarkAsRead]);

  // Set up intersection observer for read receipts
  useEffect(() => {
    if (!containerRef.current || messages.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const messageId = entry.target.getAttribute("data-message-id");
            if (messageId) {
              // Only mark as read if this message comes AFTER the current last read message
              // This prevents scrolling up from making newer messages appear unread
              if (!myLastReadMessageId) {
                // No messages read yet, mark this one
                onMarkAsRead(messageId);
              } else {
                // Check if this message is newer than the last read message
                const currentLastReadIndex = messages.findIndex(m => m.id === myLastReadMessageId);
                const thisMessageIndex = messages.findIndex(m => m.id === messageId);

                if (thisMessageIndex > currentLastReadIndex) {
                  // This message is newer, safe to mark as read
                  onMarkAsRead(messageId);
                }
                // If thisMessageIndex <= currentLastReadIndex, ignore it (don't move read marker backwards)
              }
            }
          }
        });
      },
      {
        root: containerRef.current,
        threshold: 0.5,
      }
    );

    // Observe all message elements
    const messageElements =
      containerRef.current.querySelectorAll("[data-message-id]");
    messageElements.forEach((el) => observer.observe(el));

    return () => {
      observer.disconnect();
    };
  }, [messages, myLastReadMessageId, onMarkAsRead]);

  if (messages.length === 0) {
    return (
      <div
        ref={containerRef}
        style={{
          height: `${height}px`,
          overflowY: "auto",
          padding: "16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--chat-text-tertiary)",
          fontSize: "14px",
          fontStyle: "italic",
        }}
      >
        No messages yet. Start the conversation!
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      style={{
        height: `${height}px`,
        overflowY: "auto",
        padding: "16px",
      }}
    >
      {messages.map((message) => (
        <div key={message.id} data-message-id={message.id}>
          <ChatMessage
            message={message}
            messages={messages}
            currentUserId={currentUserId}
            presenceUsers={presenceUsers}
            readReceipts={readReceipts}
            onAddReaction={onAddReaction}
          />
        </div>
      ))}

      {/* Typing indicator */}
      <TypingIndicator typingUsers={typingUsers} />
    </div>
  );
}
