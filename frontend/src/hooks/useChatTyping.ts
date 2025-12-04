/**
 * useChatTyping Hook
 *
 * Tracks typing indicators for chat blocks via Phoenix channel broadcasts.
 * Separate from persistence to avoid spamming Y.js updates.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { Channel } from "phoenix";

interface TypingInfo {
  user_id: string;
  user_name: string;
  chat_id: string;
  is_typing: boolean;
}

export interface UseChatTypingResult {
  typingUsers: Set<string>;
  startTyping: () => void;
  stopTyping: () => void;
}

export function useChatTyping(
  channel: Channel | null,
  chatId: string,
  userId: string
): UseChatTypingResult {
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cleanupTimeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    if (!channel) return;

    const handleTyping = (data: TypingInfo) => {
      // Only handle typing for this chat
      if (data.chat_id !== chatId) return;
      // Ignore our own typing events
      if (data.user_id === userId) return;

      setTypingUsers((prev) => {
        const next = new Set(prev);
        if (data.is_typing) {
          next.add(data.user_name);

          // Auto-remove typing indicator after 5 seconds
          const existingTimeout = cleanupTimeoutsRef.current.get(data.user_name);
          if (existingTimeout) {
            clearTimeout(existingTimeout);
          }

          const timeout = setTimeout(() => {
            setTypingUsers((current) => {
              const updated = new Set(current);
              updated.delete(data.user_name);
              return updated;
            });
            cleanupTimeoutsRef.current.delete(data.user_name);
          }, 5000);

          cleanupTimeoutsRef.current.set(data.user_name, timeout);
        } else {
          next.delete(data.user_name);
          // Clear cleanup timeout if exists
          const timeout = cleanupTimeoutsRef.current.get(data.user_name);
          if (timeout) {
            clearTimeout(timeout);
            cleanupTimeoutsRef.current.delete(data.user_name);
          }
        }
        return next;
      });
    };

    channel.on("chat_typing", handleTyping);

    return () => {
      channel.off("chat_typing", handleTyping);
      // Clean up all timeouts
      cleanupTimeoutsRef.current.forEach((timeout) => clearTimeout(timeout));
      cleanupTimeoutsRef.current.clear();
    };
  }, [channel, chatId, userId]);

  const startTyping = useCallback(() => {
    if (!channel) return;

    channel.push("chat_typing", {
      chat_id: chatId,
      is_typing: true,
    });

    // Auto-stop after 3 seconds if no more typing
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      stopTyping();
    }, 3000);
  }, [channel, chatId]);

  const stopTyping = useCallback(() => {
    if (!channel) return;

    channel.push("chat_typing", {
      chat_id: chatId,
      is_typing: false,
    });

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
  }, [channel, chatId]);

  return {
    typingUsers,
    startTyping,
    stopTyping,
  };
}
