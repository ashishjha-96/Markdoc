/**
 * useChatReadReceipts Hook
 *
 * Tracks read receipts for chat messages via Phoenix channel broadcasts.
 * Shows which users have read up to which message.
 */

import { useState, useEffect, useCallback } from "react";
import { Channel } from "phoenix";

interface ReadReceiptInfo {
  user_id: string;
  chat_id: string;
  last_read_message_id: string;
  timestamp: number;
}

export interface UseChatReadReceiptsResult {
  readReceipts: Map<string, string>; // userId -> lastReadMessageId
  markAsRead: (messageId: string) => void;
  myLastReadMessageId: string | null; // Current user's last read message
}

export function useChatReadReceipts(
  channel: Channel | null,
  chatId: string,
  userId: string
): UseChatReadReceiptsResult {
  const [readReceipts, setReadReceipts] = useState<Map<string, string>>(
    new Map()
  );
  const [myLastReadMessageId, setMyLastReadMessageId] = useState<string | null>(null);

  useEffect(() => {
    if (!channel) return;

    const handleRead = (data: ReadReceiptInfo) => {
      // Only handle read receipts for this chat
      if (data.chat_id !== chatId) return;
      // Ignore our own read receipts (we know what we've read)
      if (data.user_id === userId) return;

      setReadReceipts((prev) => {
        const next = new Map(prev);
        next.set(data.user_id, data.last_read_message_id);
        return next;
      });
    };

    channel.on("chat_read", handleRead);

    return () => {
      channel.off("chat_read", handleRead);
    };
  }, [channel, chatId, userId]);

  const markAsRead = useCallback(
    (messageId: string) => {
      if (!channel) return;

      // Track locally for the current user
      setMyLastReadMessageId(messageId);

      // Broadcast to other users
      channel.push("chat_read", {
        chat_id: chatId,
        message_id: messageId,
      });
    },
    [channel, chatId]
  );

  return {
    readReceipts,
    markAsRead,
    myLastReadMessageId,
  };
}
