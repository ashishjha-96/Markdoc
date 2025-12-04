/**
 * Editor Component
 *
 * Main collaborative editor using BlockNote with Y.js sync through Phoenix.
 */

import { useEffect, useState, useMemo } from "react";
import { BlockNoteView } from "@blocknote/mantine";
import {
  SuggestionMenuController,
  getDefaultReactSlashMenuItems,
  useCreateBlockNote,
} from "@blocknote/react";
import type { BlockNoteEditor } from "@blocknote/core";
import * as Y from "yjs";
import { nanoid } from "nanoid";
import { schema } from "../lib/editorSchema";
import { PhoenixProvider } from "../lib/PhoenixProvider";
import type { UserInfo } from "../lib/PhoenixProvider";
import { UserPresence } from "./UserPresence";
import { ConnectionStatus } from "./ConnectionStatus";
import { NamePrompt } from "./NamePrompt";
import { Cursors } from "./Cursors";
import { ExportMenu } from "./ExportMenu";
import { useCursors } from "../hooks/useCursors";
import { usePresence } from "../hooks/usePresence";
import { generateDocId } from "../lib/generateDocId";
import { EditorContext } from "./chat/ChatBlock";
import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";

interface EditorProps {
  docId: string;
}

// Helper to generate a random color
const generateColor = () =>
  "#" +
  Array.from({ length: 3 })
    .map(() =>
      Math.floor(Math.random() * 256)
        .toString(16)
        .padStart(2, "0")
    )
    .join("");

// Custom slash menu item for chat block
const insertChatBlockItem = (editor: BlockNoteEditor<any, any, any>) => ({
  title: "Chat",
  onItemClick: () => {
    const currentBlock = editor.getTextCursorPosition().block;
    editor.insertBlocks(
      [{
        type: "chat" as any,
        props: {
          chatId: nanoid(),
          title: "Chat Discussion",
          minimized: false,
          height: 400,
          width: 600,
        }
      }],
      currentBlock.id,
      "after"
    );
  },
  aliases: ["chat", "message", "discussion", "conversation"],
  group: "Other",
  icon: "💬" as any,
  subtext: "Start a collaborative chat discussion",
});

// Get all slash menu items including chat block
const getCustomSlashMenuItems = (editor: BlockNoteEditor<any, any, any>) => [
  ...getDefaultReactSlashMenuItems(editor),
  insertChatBlockItem(editor),
];

// Filter slash menu items based on query
const filterSlashMenuItems = (
  items: ReturnType<typeof getCustomSlashMenuItems>,
  query: string
) => {
  const lowerQuery = query.toLowerCase();
  return items.filter((item) => {
    const matchesTitle = item.title.toLowerCase().includes(lowerQuery);
    const matchesAliases = item.aliases?.some((alias) =>
      alias.toLowerCase().includes(lowerQuery)
    );
    return matchesTitle || matchesAliases;
  });
};

export function Editor({ docId }: EditorProps) {
  const [provider, setProvider] = useState<PhoenixProvider | null>(null);
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [showNamePrompt, setShowNamePrompt] = useState(false);

  // Create Y.js document (persists across re-renders)
  const doc = useMemo(() => new Y.Doc(), []);

  // Generate a random user color (persists across re-renders)
  const userColor = useMemo(() => generateColor(), []);

  // Track cursors separately (to avoid presence spam)
  const cursors = useCursors(provider?.channel || null);

  // Track user presence
  const presenceUsers = usePresence(provider?.channel || null);

  // Handler for creating a new document
  const handleNewDocument = () => {
    const newDocId = generateDocId();
    window.location.pathname = `/${newDocId}`;
  };

  // Check for existing username in localStorage on mount
  useEffect(() => {
    const storedName = localStorage.getItem("markdoc-username");
    if (storedName) {
      setUserInfo({
        name: storedName,
        color: userColor,
      });
    } else {
      setShowNamePrompt(true);
    }
  }, [userColor]);

  // Handle name submission
  const handleNameSubmit = (name: string) => {
    localStorage.setItem("markdoc-username", name);
    setUserInfo({
      name,
      color: userColor,
    });
    setShowNamePrompt(false);
  };

  // Create BlockNote editor with Y.js collaboration
  // IMPORTANT: Only create editor after provider is ready to ensure collaboration works
  const editor = useCreateBlockNote(
    {
      schema, // Custom schema with syntax highlighting
      collaboration: provider
        ? {
            fragment: doc.getXmlFragment("document"),
            user: {
              name: userInfo?.name || "Anonymous",
              color: userColor,
            },
            provider,
          }
        : undefined,
    },
    [provider] // Recreate editor when provider changes
  );

  // Initialize Phoenix provider only after we have user info
  useEffect(() => {
    if (!userInfo) return;

    console.log(`🚀 Initializing editor for document: ${docId}`);

    const phoenixProvider = new PhoenixProvider(docId, doc, userInfo);
    setProvider(phoenixProvider);

    return () => {
      console.log(`🛑 Cleaning up editor for document: ${docId}`);
      phoenixProvider.destroy();
    };
  }, [docId, doc, userInfo]);

  // Track text editor cursor position (not mouse position)
  useEffect(() => {
    if (!provider || !editor) return;

    // Track selection changes in the editor
    let lastPosition: { blockId: string; offset: number } | null = null;

    const updateCursorPosition = () => {
      try {
        // Get BlockNote's text cursor position
        const textCursorPos = editor.getTextCursorPosition();

        // Get the current block
        const currentBlock = textCursorPos.block;
        if (!currentBlock) {
          // No block selected, clear cursor
          if (lastPosition) {
            provider.updateCursor({ blockId: "", offset: 0 });
            lastPosition = null;
          }
          return;
        }

        // Simple approach: Use DOM selection to get offset within block
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) return;

        // Find the block element in the DOM
        const blockElement = document.querySelector(`[data-id="${currentBlock.id}"]`);
        if (!blockElement) return;

        // Get the range and calculate offset from block start
        const range = selection.getRangeAt(0);
        const blockRange = document.createRange();
        blockRange.selectNodeContents(blockElement);
        blockRange.setEnd(range.startContainer, range.startOffset);

        const offset = blockRange.toString().length;

        const newPosition = {
          blockId: currentBlock.id,
          offset: offset,
        };

        // Only update if position actually changed
        if (
          !lastPosition ||
          lastPosition.blockId !== newPosition.blockId ||
          lastPosition.offset !== newPosition.offset
        ) {
          lastPosition = newPosition;
          provider.updateCursor(newPosition);
        }
      } catch (error) {
        console.error("Error tracking cursor:", error);
      }
    };

    // Listen to editor selection changes
    const handleSelectionChange = () => {
      updateCursorPosition();
    };

    document.addEventListener("selectionchange", handleSelectionChange);

    return () => {
      document.removeEventListener("selectionchange", handleSelectionChange);
      // Clear cursor when unmounting
      provider.updateCursor({ blockId: "", offset: 0 });
    };
  }, [provider, editor]);

  // Clean up orphaned chats (deleted blocks)
  useEffect(() => {
    if (!provider || !editor) return;

    const interval = setInterval(() => {
      try {
        const blocks = editor.document;
        const activeChatIds = new Set(
          blocks
            .filter((b) => b.type === "chat")
            .map((b) => (b.props as any).chatId)
            .filter((id) => id) // Filter out empty IDs
        );

        const chatsMap = doc.getMap("chats");
        chatsMap.forEach((_, chatId) => {
          if (!activeChatIds.has(chatId as string)) {
            chatsMap.delete(chatId as string); // Remove orphaned chat
            console.log(`🗑️ Cleaned up orphaned chat: ${chatId}`);
          }
        });
      } catch (error) {
        console.error("Error cleaning up chats:", error);
      }
    }, 30000); // Check every 30 seconds

    return () => clearInterval(interval);
  }, [provider, editor, doc]);

  // Generate stable user ID (persists across re-renders)
  const userId = useMemo(() => {
    return `user_${Math.floor(Math.random() * 1000000)}`;
  }, []);

  // Prepare context data for chat blocks
  const editorContextValue = useMemo(() => {
    if (!provider || !userInfo) return null;

    return {
      doc,
      channel: provider.channel,
      userId,
      userName: userInfo.name,
      userColor,
      presenceUsers,
    };
  }, [provider, userInfo, doc, userId, userColor, presenceUsers]);

  return (
    <>
      {/* Show name prompt if needed */}
      {showNamePrompt && (
        <NamePrompt onSubmit={handleNameSubmit} docId={docId} />
      )}

      <div
        style={{
          width: "100%",
          minHeight: "100vh",
          backgroundColor: "#fafafa",
        }}
      >
        {/* Header */}
        <div
          style={{
            backgroundColor: "white",
            borderBottom: "1px solid #e0e0e0",
            padding: "16px 24px",
          }}
        >
          <div
            style={{
              maxWidth: "1200px",
              margin: "0 auto",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div>
              <h1
                style={{
                  display: "flex",
                  alignItems: "center",
                  margin: 0,
                  fontSize: "20px",
                  fontWeight: 600,
                  color: "#1a1a1a",
                }}
              >
                <span style={{ fontWeight: 800, fontSize:"28px", color: "#646cff"}}>[</span>
                <span>MarkDoc </span>
                <span style={{ fontWeight: 800, fontSize:"28px", color: "#646cff"}}>]</span>
              </h1>
              <p
                style={{ margin: "4px 0 0 0", color: "#666", fontSize: "13px" }}
              >
                Document:{" "}
                <code
                  style={{
                    background: "#f5f5f5",
                    padding: "2px 6px",
                    borderRadius: "3px",
                    fontSize: "12px",
                  }}
                >
                  {docId}
                </code>
                {userInfo && (
                  <>
                    {" · "}
                    Logged in as:{" "}
                    <span style={{ fontWeight: 500 }}>{userInfo.name}</span>
                  </>
                )}
              </p>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
              }}
            >
              {/* User Presence Avatars */}
              <UserPresence channel={provider?.channel || null} />

              {/* Add Chat Button */}
              {editor && (
                <button
                  onClick={() => {
                    const currentBlock = editor.getTextCursorPosition().block;
                    editor.insertBlocks(
                      [{
                        type: "chat" as any,
                        props: {
                          chatId: nanoid(),
                          title: "Chat Discussion",
                          minimized: false,
                          height: 400,
                          width: 600,
                        }
                      }],
                      currentBlock.id,
                      "after"
                    );
                  }}
                  style={{
                    padding: "8px 12px",
                    backgroundColor: "#646cff",
                    color: "white",
                    border: "none",
                    borderRadius: "6px",
                    fontSize: "13px",
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    transition: "background-color 0.2s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = "#535bf2";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "#646cff";
                  }}
                  title="Insert Chat Block"
                >
                  <span style={{ fontSize: "16px" }}>💬</span>
                  <span>Add Chat</span>
                </button>
              )}

              {/* Combined Menu (New Document + Export) */}
              {editor && (
                <ExportMenu
                  editor={editor}
                  docId={docId}
                  onNewDocument={handleNewDocument}
                />
              )}
            </div>
          </div>
        </div>

        {/* Editor Container */}
        <div
          style={{
            maxWidth: "1200px",
            margin: "0 auto",
            padding: "24px",
          }}
        >
          <div
            style={{
              backgroundColor: "white",
              border: "1px solid #e0e0e0",
              borderRadius: "8px",
              overflow: "hidden",
              minHeight: "calc(100vh - 200px)",
            }}
          >
            {editorContextValue ? (
              <EditorContext.Provider value={editorContextValue}>
                <BlockNoteView editor={editor} theme="light" slashMenu={false}>
                  <SuggestionMenuController
                    triggerCharacter={"/"}
                    getItems={async (query) =>
                      filterSlashMenuItems(
                        getCustomSlashMenuItems(editor),
                        query
                      )
                    }
                  />
                </BlockNoteView>
              </EditorContext.Provider>
            ) : (
              <BlockNoteView editor={editor} theme="light" slashMenu={false}>
                <SuggestionMenuController
                  triggerCharacter={"/"}
                  getItems={async (query) =>
                    filterSlashMenuItems(
                      getCustomSlashMenuItems(editor),
                      query
                    )
                  }
                />
              </BlockNoteView>
            )}
          </div>
        </div>

        {/* Connection Status Indicator */}
        <ConnectionStatus socket={provider?.socket || null} />

        {/* Collaborative Cursors */}
        <Cursors cursors={cursors} />
      </div>
    </>
  );
}
