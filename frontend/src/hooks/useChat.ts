/**
 * useChat Hook
 *
 * Manages chat messages stored in Y.js for real-time collaboration.
 * Each chat block has its own message history keyed by chatId.
 */

import { useState, useEffect, useCallback } from "react";
import * as Y from "yjs";
import { nanoid } from "nanoid";

export interface ChatMessage {
  id: string;
  chatId: string;
  userId: string;
  userName: string;
  userColor: string;
  content: string;
  timestamp: number;
  reactions: {
    [emoji: string]: string[]; // emoji -> array of user_ids
  };
}

export interface UseChatResult {
  messages: ChatMessage[];
  sendMessage: (content: string) => void;
  addReaction: (messageId: string, emoji: string) => void;
  removeReaction: (messageId: string, emoji: string) => void;
}

export function useChat(
  doc: Y.Doc | null,
  chatId: string,
  userId: string,
  userName: string,
  userColor: string
): UseChatResult {
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  useEffect(() => {
    if (!doc || !chatId) return;

    // Get or create the chats map
    const chatsMap = doc.getMap("chats");
    let chatMap = chatsMap.get(chatId) as Y.Map<any> | undefined;

    // Initialize chat structure if it doesn't exist
    if (!chatMap) {
      // Wrap initialization in transaction for proper Y.js sync
      doc.transact(() => {
        chatMap = new Y.Map();

        // Create messages array
        const messagesArray = new Y.Array();
        chatMap!.set("messages", messagesArray);

        // Create and populate metadata map
        const metadata = new Y.Map();
        metadata.set("createdAt", Date.now());
        metadata.set("createdBy", userId);
        chatMap!.set("metadata", metadata);

        chatsMap.set(chatId, chatMap!);
      });

      // Re-fetch after transaction
      chatMap = chatsMap.get(chatId) as Y.Map<any>;
    }

    const messagesArray = chatMap.get("messages") as Y.Array<ChatMessage>;

    // Initial sync
    setMessages(messagesArray.toArray());

    // Listen for changes
    const observer = () => {
      setMessages(messagesArray.toArray());
    };

    messagesArray.observe(observer);

    return () => {
      messagesArray.unobserve(observer);
    };
  }, [doc, chatId, userId]);

  const sendMessage = useCallback(
    (content: string) => {
      if (!doc || !chatId || !content.trim()) return;

      const chatsMap = doc.getMap("chats");
      const chatMap = chatsMap.get(chatId) as Y.Map<any>;
      if (!chatMap) return;

      const messagesArray = chatMap.get("messages") as Y.Array<ChatMessage>;

      const newMessage: ChatMessage = {
        id: nanoid(),
        chatId,
        userId,
        userName,
        userColor,
        content: content.trim(),
        timestamp: Date.now(),
        reactions: {},
      };

      // Wrap in transaction for proper Y.js sync
      doc.transact(() => {
        messagesArray.push([newMessage]);
      });
    },
    [doc, chatId, userId, userName, userColor]
  );

  const addReaction = useCallback(
    (messageId: string, emoji: string) => {
      if (!doc || !chatId) return;

      const chatsMap = doc.getMap("chats");
      const chatMap = chatsMap.get(chatId) as Y.Map<any>;
      if (!chatMap) return;

      const messagesArray = chatMap.get("messages") as Y.Array<ChatMessage>;
      const messageIndex = messagesArray
        .toArray()
        .findIndex((m) => m.id === messageId);

      if (messageIndex === -1) return;

      const message = messagesArray.get(messageIndex);
      const reactions = { ...message.reactions };

      if (!reactions[emoji]) {
        reactions[emoji] = [];
      }

      // Toggle: remove if already reacted, add if not
      if (reactions[emoji].includes(userId)) {
        reactions[emoji] = reactions[emoji].filter((id) => id !== userId);
        // Remove emoji key if no reactions left
        if (reactions[emoji].length === 0) {
          delete reactions[emoji];
        }
      } else {
        reactions[emoji].push(userId);
      }

      // Update the message - wrap in transaction for proper Y.js sync
      doc.transact(() => {
        messagesArray.delete(messageIndex, 1);
        messagesArray.insert(messageIndex, [{ ...message, reactions }]);
      });
    },
    [doc, chatId, userId]
  );

  const removeReaction = useCallback(
    (messageId: string, emoji: string) => {
      if (!doc || !chatId) return;

      const chatsMap = doc.getMap("chats");
      const chatMap = chatsMap.get(chatId) as Y.Map<any>;
      if (!chatMap) return;

      const messagesArray = chatMap.get("messages") as Y.Array<ChatMessage>;
      const messageIndex = messagesArray
        .toArray()
        .findIndex((m) => m.id === messageId);

      if (messageIndex === -1) return;

      const message = messagesArray.get(messageIndex);
      const reactions = { ...message.reactions };

      if (reactions[emoji]) {
        reactions[emoji] = reactions[emoji].filter((id) => id !== userId);
        if (reactions[emoji].length === 0) {
          delete reactions[emoji];
        }
      }

      // Update the message - wrap in transaction for proper Y.js sync
      doc.transact(() => {
        messagesArray.delete(messageIndex, 1);
        messagesArray.insert(messageIndex, [{ ...message, reactions }]);
      });
    },
    [doc, chatId, userId]
  );

  return {
    messages,
    sendMessage,
    addReaction,
    removeReaction,
  };
}
