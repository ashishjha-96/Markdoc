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
import {
  loadFloatingState,
  saveFloatingState,
  clearFloatingState,
  getDefaultFloatingPosition,
} from "../../lib/floatingChats";

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

  // Floating state
  const [isFloating, setIsFloating] = useState(false);
  const [floatingPosition, setFloatingPosition] = useState({ x: 0, y: 0 });
  const [floatingZIndex, setFloatingZIndex] = useState(2000);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartPos = useRef({ x: 0, y: 0 });
  const dragStartWindowPos = useRef({ x: 0, y: 0 });

  if (!context) {
    return (
      <div
        style={{
          padding: "16px",
          border: "1px solid var(--chat-border)",
          borderRadius: "8px",
          backgroundColor: "var(--chat-header-bg)",
          color: "var(--chat-text-secondary)",
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

  // Load floating state from localStorage on mount
  useEffect(() => {
    const savedState = loadFloatingState(chatId);
    if (savedState?.isFloating) {
      setIsFloating(true);
      setFloatingPosition({ x: savedState.x, y: savedState.y });
      setWidth(savedState.width);
      setHeight(savedState.height);
      setFloatingZIndex(savedState.zIndex || 2000);
    }
  }, [chatId]);

  // Toggle floating handler
  const handleToggleFloating = useCallback(() => {
    if (isFloating) {
      // Dock: Clear floating state
      setIsFloating(false);
      clearFloatingState(chatId);

      // Restore to Y.js dimensions
      setWidth(block.props.width || 600);
      setHeight(block.props.height || 400);
    } else {
      // Float: Save current state to localStorage
      const defaultPos = getDefaultFloatingPosition(width, height);
      setIsFloating(true);
      setFloatingPosition(defaultPos);

      saveFloatingState(chatId, {
        isFloating: true,
        x: defaultPos.x,
        y: defaultPos.y,
        width,
        height,
        zIndex: 2000,
      });
    }
  }, [isFloating, chatId, width, height, block.props.width, block.props.height]);

  // Drag handlers for floating windows
  const handleDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    dragStartPos.current = { x: e.clientX, y: e.clientY };
    dragStartWindowPos.current = { ...floatingPosition };
  }, [floatingPosition]);

  const handleDragMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return;

    const deltaX = e.clientX - dragStartPos.current.x;
    const deltaY = e.clientY - dragStartPos.current.y;

    const newX = dragStartWindowPos.current.x + deltaX;
    const newY = Math.max(0, dragStartWindowPos.current.y + deltaY); // Prevent dragging above viewport

    setFloatingPosition({ x: newX, y: newY });
  }, [isDragging]);

  const handleDragEnd = useCallback(() => {
    if (!isDragging) return;
    setIsDragging(false);

    // Save position to localStorage
    saveFloatingState(chatId, {
      isFloating: true,
      x: floatingPosition.x,
      y: floatingPosition.y,
      width,
      height,
      zIndex: floatingZIndex,
    });
  }, [isDragging, chatId, floatingPosition, width, height, floatingZIndex]);

  // Add/remove drag event listeners
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleDragMove);
      document.addEventListener('mouseup', handleDragEnd);
      document.body.style.cursor = 'move';
      document.body.style.userSelect = 'none';

      return () => {
        document.removeEventListener('mousemove', handleDragMove);
        document.removeEventListener('mouseup', handleDragEnd);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };
    }
  }, [isDragging, handleDragMove, handleDragEnd]);

  // Focus handler (bring to front)
  const handleFocusFloating = useCallback(() => {
    if (!isFloating) return;

    const newZIndex = 2000 + (Date.now() % 1000); // Simple increment
    setFloatingZIndex(newZIndex);

    saveFloatingState(chatId, {
      isFloating: true,
      x: floatingPosition.x,
      y: floatingPosition.y,
      width,
      height,
      zIndex: newZIndex,
    });
  }, [isFloating, chatId, floatingPosition, width, height]);

  // Adjust floating position on viewport resize
  useEffect(() => {
    if (!isFloating) return;

    const handleViewportResize = () => {
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      // Check if window is now off-screen
      if (floatingPosition.x + width > viewportWidth ||
          floatingPosition.y + height > viewportHeight) {
        const newPos = getDefaultFloatingPosition(width, height);
        setFloatingPosition(newPos);

        saveFloatingState(chatId, {
          isFloating: true,
          x: newPos.x,
          y: newPos.y,
          width,
          height,
          zIndex: floatingZIndex,
        });
      }
    };

    window.addEventListener('resize', handleViewportResize);
    return () => window.removeEventListener('resize', handleViewportResize);
  }, [isFloating, floatingPosition, width, height, chatId, floatingZIndex]);

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

    if (isFloating) {
      // Save to localStorage instead of Y.js when floating
      saveFloatingState(chatId, {
        isFloating: true,
        x: floatingPosition.x,
        y: floatingPosition.y,
        width,
        height,
        zIndex: floatingZIndex,
      });
    } else {
      // Update block props to persist both dimensions
      if (editor) {
        editor.updateBlock(block.id, {
          props: { ...block.props, height, width },
        });
      }
    }
  }, [isResizing, isFloating, chatId, floatingPosition, width, height, floatingZIndex, editor, block.id, block.props]);

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
          border: "1px solid var(--chat-border)",
          borderRadius: "8px",
          backgroundColor: "var(--chat-header-bg)",
          color: "var(--chat-text-secondary)",
        }}
      >
        Initializing chat...
      </div>
    );
  }

  // Container styles based on floating state
  const containerStyle: React.CSSProperties = isFloating
    ? {
        position: "fixed",
        left: `${floatingPosition.x}px`,
        top: `${floatingPosition.y}px`,
        zIndex: floatingZIndex,
        border: "1px solid var(--chat-border)",
        borderRadius: "8px",
        backgroundColor: "var(--chat-bg)",
        overflow: "hidden",
        width: `${width}px`,
        boxShadow: "0 8px 32px rgba(0, 0, 0, 0.2)",
        transition: "background-color 0.2s ease, border-color 0.2s ease",
      }
    : {
        border: "1px solid var(--chat-border)",
        borderRadius: "8px",
        backgroundColor: "var(--chat-bg)",
        marginTop: "8px",
        marginBottom: "8px",
        overflow: "hidden",
        width: `${width}px`,
        position: "relative",
        transition: "background-color 0.2s ease, border-color 0.2s ease",
      };

  return (
    <>
      <div
        style={containerStyle}
        contentEditable={false}
        onClick={isFloating ? handleFocusFloating : undefined}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "12px 16px",
            borderBottom: "1px solid var(--chat-border)",
            backgroundColor: "var(--chat-header-bg)",
            cursor: isFloating && !isEditingTitle ? "move" : "default",
            transition: "background-color 0.2s ease, border-color 0.2s ease",
          }}
          onMouseDown={isFloating && !isEditingTitle ? handleDragStart : undefined}
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
                color: "var(--chat-text)",
                backgroundColor: "var(--chat-btn-bg)",
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
                color: "var(--chat-text)",
                cursor: "pointer",
                padding: "2px 6px",
                borderRadius: "4px",
                transition: "background-color 0.2s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "var(--chat-btn-hover)";
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
              color: "var(--chat-text-tertiary)",
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
            onClick={(e) => {
              e.stopPropagation(); // Prevent drag when clicking button
              setIsMinimized(!isMinimized);
            }}
            style={{
              width: "24px",
              height: "24px",
              border: "1px solid var(--chat-border)",
              borderRadius: "4px",
              backgroundColor: "var(--chat-btn-bg)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "14px",
              color: "var(--chat-text-secondary)",
              transition: "background-color 0.2s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "var(--chat-btn-hover)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "var(--chat-btn-bg)";
            }}
            title={isMinimized ? "Expand" : "Minimize"}
          >
            {isMinimized ? "□" : "_"}
          </button>

          {/* Float/Dock button */}
          <button
            onClick={(e) => {
              e.stopPropagation(); // Prevent drag when clicking button
              handleToggleFloating();
            }}
            style={{
              width: "24px",
              height: "24px",
              border: "1px solid var(--chat-border)",
              borderRadius: "4px",
              backgroundColor: "var(--chat-btn-bg)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "14px",
              color: "#646cff",
              fontWeight: 800,
              transition: "background-color 0.2s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "var(--chat-btn-hover)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "var(--chat-btn-bg)";
            }}
            title={isFloating ? "Dock to document" : "Open in floating window"}
          >
            {isFloating ? "↙" : <span>&#8599;</span>}
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
              cursor: "nwse-resize",
              borderBottomRightRadius: "8px",
              transition: "background-color 0.2s",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                width: "8px",
                height: "8px",
                borderRight: "2px solid #999",
                borderBottom: "2px solid #999",
                
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
              color: "var(--chat-text-tertiary)",
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

      {/* Placeholder in document when floating */}
      {isFloating && (
        <div
          style={{
            border: "1px dashed var(--chat-border)",
            borderRadius: "8px",
            backgroundColor: "var(--chat-header-bg)",
            marginTop: "8px",
            marginBottom: "8px",
            padding: "16px",
            color: "var(--chat-text-tertiary)",
            fontSize: "13px",
            fontStyle: "italic",
            textAlign: "center",
            transition: "background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease",
          }}
          contentEditable={false}
        >
          💬 {block.props.title || "Chat Discussion"} • Opened in floating window
        </div>
      )}
    </>
  );
}
