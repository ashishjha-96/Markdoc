/**
 * ChatBlock Component
 *
 * Main chat block component for BlockNote.
 * Integrates Y.js storage, Phoenix channel broadcasts, and all chat features.
 */

import React, { useState, useContext, createContext, useRef, useCallback, useEffect } from "react";
import * as Y from "yjs";
import type { Channel } from "phoenix";
import type { UserPresence } from "../../hooks/usePresence";
import { useChat } from "../../hooks/useChat";
import { useChatTyping } from "../../hooks/useChatTyping";
import { useChatReadReceipts } from "../../hooks/useChatReadReceipts";
import { ChatMessages } from "./ChatMessages";
import { ChatInput } from "./ChatInput";
import { useBlockNoteEditor } from "@blocknote/react";

// Context for sharing editor-level data with chat blocks
export interface EditorContextData {
  doc: Y.Doc;
  channel: Channel;
  userId: string;
  userName: string;
  userColor: string;
  presenceUsers: Record<string, UserPresence>;
}

export const EditorContext = createContext<EditorContextData | null>(null);

interface ChatBlockProps {
  block: {
    id: string;
    type: string;
    props: {
      chatId: string;
      title: string;
      minimized: boolean;
      height: number;
      width: number;
    };
  };
}

export function ChatBlock({ block }: ChatBlockProps) {
  const context = useContext(EditorContext);
  const editor = useBlockNoteEditor();
  const [isMinimized, setIsMinimized] = useState(block.props.minimized);
  const [height, setHeight] = useState(block.props.height || 400);
  const [width, setWidth] = useState(block.props.width || 600);
  const [isResizing, setIsResizing] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState(block.props.title || "Chat Discussion");
  const titleInputRef = useRef<HTMLInputElement>(null);
  const resizeStartY = useRef(0);
  const resizeStartX = useRef(0);
  const resizeStartHeight = useRef(0);
  const resizeStartWidth = useRef(0);

  if (!context) {
    return (
      <div
        style={{
          padding: "16px",
          border: "1px solid #e0e0e0",
          borderRadius: "8px",
          backgroundColor: "#fff9e6",
          color: "#666",
        }}
      >
        Chat block error: Editor context not available
      </div>
    );
  }

  const { doc, channel, userId, userName, userColor, presenceUsers } = context;
  const chatId = block.props.chatId;

  // Use all chat hooks
  const { messages, sendMessage, addReaction } = useChat(
    doc,
    chatId,
    userId,
    userName,
    userColor
  );

  const { typingUsers, startTyping, stopTyping } = useChatTyping(
    channel,
    chatId,
    userId
  );

  const { readReceipts, markAsRead, myLastReadMessageId } = useChatReadReceipts(
    channel,
    chatId,
    userId
  );

  // Corner resize handlers (both height and width)
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    resizeStartY.current = e.clientY;
    resizeStartX.current = e.clientX;
    resizeStartHeight.current = height;
    resizeStartWidth.current = width;
  }, [height, width]);

  const handleResizeMove = useCallback((e: MouseEvent) => {
    if (!isResizing) return;

    const deltaY = e.clientY - resizeStartY.current;
    const deltaX = e.clientX - resizeStartX.current;

    const newHeight = Math.max(200, Math.min(800, resizeStartHeight.current + deltaY));
    const newWidth = Math.max(300, Math.min(1200, resizeStartWidth.current + deltaX));

    setHeight(newHeight);
    setWidth(newWidth);
  }, [isResizing]);

  const handleResizeEnd = useCallback(() => {
    if (!isResizing) return;
    setIsResizing(false);

    // Update block props to persist both dimensions
    if (editor) {
      editor.updateBlock(block.id, {
        props: { ...block.props, height, width },
      });
    }
  }, [isResizing, editor, block.id, block.props, height, width]);

  // Add/remove mouse event listeners for resizing
  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleResizeMove);
      document.addEventListener('mouseup', handleResizeEnd);
      document.body.style.cursor = 'nwse-resize';
      document.body.style.userSelect = 'none';

      return () => {
        document.removeEventListener('mousemove', handleResizeMove);
        document.removeEventListener('mouseup', handleResizeEnd);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };
    }
  }, [isResizing, handleResizeMove, handleResizeEnd]);

  // Focus title input when editing starts
  useEffect(() => {
    if (isEditingTitle && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [isEditingTitle]);

  // Handle title save
  const handleTitleSave = useCallback(() => {
    if (!editor) return;

    const trimmedTitle = editedTitle.trim();
    const finalTitle = trimmedTitle || "Chat Discussion";

    if (finalTitle !== block.props.title) {
      editor.updateBlock(block.id, {
        props: { ...block.props, title: finalTitle },
      });
    }

    setEditedTitle(finalTitle);
    setIsEditingTitle(false);
  }, [editor, block.id, block.props, editedTitle]);

  // Handle title edit key events
  const handleTitleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleTitleSave();
    } else if (e.key === 'Escape') {
      setEditedTitle(block.props.title || "Chat Discussion");
      setIsEditingTitle(false);
    }
  }, [handleTitleSave, block.props.title]);

  if (!chatId) {
    return (
      <div
        style={{
          padding: "16px",
          border: "1px solid #e0e0e0",
          borderRadius: "8px",
          backgroundColor: "#fff9e6",
          color: "#666",
        }}
      >
        Initializing chat...
      </div>
    );
  }

  return (
    <div
      style={{
        border: "1px solid #e0e0e0",
        borderRadius: "8px",
        backgroundColor: "white",
        marginTop: "8px",
        marginBottom: "8px",
        overflow: "hidden",
        width: `${width}px`,
        position: "relative",
      }}
      contentEditable={false}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "12px 16px",
          borderBottom: "1px solid #e0e0e0",
          backgroundColor: "#fafafa",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <span style={{ fontSize: "18px" }}>💬</span>
          {isEditingTitle ? (
            <input
              ref={titleInputRef}
              type="text"
              value={editedTitle}
              onChange={(e) => setEditedTitle(e.target.value)}
              onBlur={handleTitleSave}
              onKeyDown={handleTitleKeyDown}
              style={{
                fontWeight: 600,
                fontSize: "14px",
                color: "#1a1a1a",
                border: "1px solid #646cff",
                borderRadius: "4px",
                padding: "2px 6px",
                outline: "none",
                minWidth: "150px",
              }}
            />
          ) : (
            <span
              onClick={() => setIsEditingTitle(true)}
              style={{
                fontWeight: 600,
                fontSize: "14px",
                color: "#1a1a1a",
                cursor: "pointer",
                padding: "2px 6px",
                borderRadius: "4px",
                transition: "background-color 0.2s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "#f5f5f5";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "transparent";
              }}
              title="Click to edit title"
            >
              {block.props.title || "Chat Discussion"}
            </span>
          )}
          <span
            style={{
              fontSize: "12px",
              color: "#999",
            }}
          >
            • {messages.length} {messages.length === 1 ? "message" : "messages"}
          </span>
          {(() => {
            // Calculate unread count for header badge
            let unreadCount = 0;

            if (messages.length > 0) {
              if (!myLastReadMessageId) {
                unreadCount = messages.length;
              } else {
                const lastReadIndex = messages.findIndex(m => m.id === myLastReadMessageId);
                if (lastReadIndex !== -1) {
                  unreadCount = messages.length - lastReadIndex - 1;
                } else {
                  unreadCount = messages.length;
                }
              }
            }

            if (unreadCount > 0) {
              return (
                <span
                  style={{
                    backgroundColor: "#646cff",
                    color: "white",
                    padding: "2px 6px",
                    borderRadius: "10px",
                    fontSize: "11px",
                    fontWeight: 600,
                  }}
                >
                  {unreadCount}
                </span>
              );
            }
            return null;
          })()}
        </div>

        <div style={{ display: "flex", gap: "8px" }}>
          {/* Minimize button */}
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            style={{
              width: "24px",
              height: "24px",
              border: "1px solid #e0e0e0",
              borderRadius: "4px",
              backgroundColor: "white",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "14px",
              color: "#666",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "#f5f5f5";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "white";
            }}
            title={isMinimized ? "Expand" : "Minimize"}
          >
            {isMinimized ? "□" : "_"}
          </button>
        </div>
      </div>

      {/* Chat content (hidden when minimized) */}
      {!isMinimized && (
        <>
          <ChatMessages
            messages={messages}
            currentUserId={userId}
            presenceUsers={presenceUsers}
            typingUsers={typingUsers}
            readReceipts={readReceipts}
            onAddReaction={addReaction}
            onMarkAsRead={markAsRead}
            myLastReadMessageId={myLastReadMessageId}
            height={height}
          />

          <ChatInput
            onSendMessage={sendMessage}
            onTyping={startTyping}
            onStopTyping={stopTyping}
          />

          {/* Corner resize handle (bottom-right) */}
          <div
            onMouseDown={handleResizeStart}
            style={{
              position: "absolute",
              bottom: 0,
              right: 0,
              width: "16px",
              height: "16px",
              backgroundColor: isResizing ? "#646cff" : "#f5f5f5",
              cursor: "nwse-resize",
              borderLeft: "1px solid #e0e0e0",
              borderTop: "1px solid #e0e0e0",
              borderBottomRightRadius: "8px",
              transition: "background-color 0.2s",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            onMouseEnter={(e) => {
              if (!isResizing) {
                e.currentTarget.style.backgroundColor = "#e0e0e0";
              }
            }}
            onMouseLeave={(e) => {
              if (!isResizing) {
                e.currentTarget.style.backgroundColor = "#f5f5f5";
              }
            }}
          >
            <div
              style={{
                width: "8px",
                height: "8px",
                borderRight: "2px solid #999",
                borderBottom: "2px solid #999",
                transform: "rotate(-45deg) translateY(-2px)",
              }}
            />
          </div>
        </>
      )}

      {/* Minimized state */}
      {isMinimized && (() => {
        // Calculate unread count
        let unreadCount = 0;

        if (messages.length > 0) {
          if (!myLastReadMessageId) {
            // Haven't read any messages yet
            unreadCount = messages.length;
          } else {
            // Count messages after the last read message
            const lastReadIndex = messages.findIndex(m => m.id === myLastReadMessageId);
            if (lastReadIndex !== -1) {
              unreadCount = messages.length - lastReadIndex - 1;
            } else {
              // Last read message not found (maybe deleted), count all
              unreadCount = messages.length;
            }
          }
        }

        return (
          <div
            style={{
              padding: "12px 16px",
              color: "#999",
              fontSize: "13px",
              fontStyle: "italic",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <span>Chat minimized • Click to expand</span>
            {unreadCount > 0 && (
              <span
                style={{
                  backgroundColor: "#646cff",
                  color: "white",
                  padding: "2px 8px",
                  borderRadius: "12px",
                  fontSize: "11px",
                  fontWeight: 600,
                  fontStyle: "normal",
                }}
              >
                {unreadCount} unread
              </span>
            )}
          </div>
        );
      })()}
    </div>
  );
}
