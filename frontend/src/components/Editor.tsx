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
import { setThemeMode } from "../lib/syntaxHighlighting";
import { PhoenixProvider } from "../lib/PhoenixProvider";
import type { UserInfo } from "../lib/PhoenixProvider";
import { UserPresence } from "./UserPresence";
import { ConnectionStatus } from "./ConnectionStatus";
import { NamePrompt } from "./NamePrompt";
import { Cursors } from "./Cursors";
import { ExportMenu } from "./ExportMenu";
import { ThemeToggle } from "./ThemeToggle";
import { SearchBar } from "./SearchBar";
import { KeyboardShortcutsMenu } from "./KeyboardShortcutsMenu";
import { TableOfContents } from "./TableOfContents";
import { useTheme } from "../contexts/ThemeContext";
import { useCursors } from "../hooks/useCursors";
import { usePresence } from "../hooks/usePresence";
import { useKeyboardShortcuts } from "../hooks/useKeyboardShortcuts";
import { useCodeBlockAutoDetect } from "../hooks/useCodeBlockAutoDetect";
import { generateDocId } from "../lib/generateDocId";
import { requestImport, onImportMarkdown } from "../lib/importBridge";
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

// Custom slash menu item for Mermaid block
const insertMermaidBlockItem = (editor: BlockNoteEditor<any, any, any>) => ({
  title: "Mermaid Diagram",
  onItemClick: () => {
    const currentBlock = editor.getTextCursorPosition().block;
    editor.insertBlocks(
      [{
        type: "mermaid" as any,
        props: {
          diagramId: nanoid(),
          title: "Mermaid Diagram",
          height: 400,
          width: 600,
        }
      }],
      currentBlock.id,
      "after"
    );
  },
  aliases: ["mermaid", "diagram", "flowchart", "chart", "graph"],
  group: "Other",
  icon: "📊" as any,
  subtext: "Create a Mermaid flowchart or diagram",
});

// Get all slash menu items including custom blocks
const getCustomSlashMenuItems = (editor: BlockNoteEditor<any, any, any>) => [
  ...getDefaultReactSlashMenuItems(editor),
  insertChatBlockItem(editor),
  insertMermaidBlockItem(editor),
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
  const { mode } = useTheme();

  // Update syntax highlighting theme before editor creation
  setThemeMode(mode);

  // Create Y.js document (persists across re-renders)
  const doc = useMemo(() => new Y.Doc(), []);

  // Generate a random user color (persists across re-renders)
  const userColor = useMemo(() => generateColor(), []);

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
    [provider, mode] // Recreate editor when provider or mode changes
  );

  // Track cursors separately (to avoid presence spam)
  const cursors = useCursors(provider?.channel || null);

  // Track user presence
  const presenceUsers = usePresence(provider?.channel || null);

  // Enable custom keyboard shortcuts
  useKeyboardShortcuts(editor);

  // Enable auto-detection of code block languages
  useCodeBlockAutoDetect(editor);

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

  // Handle import from Chrome extension
  useEffect(() => {
    if (!editor || !provider) return;

    // Check if this is an import request
    const urlParams = new URLSearchParams(window.location.search);
    const shouldImport = urlParams.get('import') === 'true';

    if (!shouldImport) return;

    console.log('📥 Checking for import data...');

    // Request import data from extension
    requestImport(docId);

    // Listen for markdown response
    const cleanup = onImportMarkdown(docId, async (markdown, sourceUrl, sourceTitle) => {
      console.log('✓ Received markdown from extension:', {
        length: markdown.length,
        sourceUrl,
        sourceTitle,
      });

      try {
        // Convert markdown to BlockNote blocks
        const blocks = await editor.tryParseMarkdownToBlocks(markdown);
        
        // Replace the default empty paragraph with imported content
        editor.replaceBlocks(editor.document, blocks);
        
        console.log('✓ Successfully imported content');
        
        // Clean up URL parameter
        window.history.replaceState({}, '', `/${docId}`);
      } catch (error) {
        console.error('Failed to import markdown:', error);
      }
    });

    return cleanup;
  }, [editor, provider, docId]);

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
        }}
      >
        {/* Header */}
        <div
          className="mobile-header"
          style={{
            backgroundColor: "var(--header-bg)",
            borderBottom: "1px solid var(--header-border)",
            padding: "16px 24px",
            transition: "background-color 0.2s ease, border-color 0.2s ease",
          }}
        >
          <div
            className="mobile-header-content"
            style={{
              maxWidth: "1200px",
              margin: "0 auto",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "12px",
            }}
          >
            <div>
              <h1
                className="mobile-logo"
                style={{
                  display: "flex",
                  alignItems: "center",
                  margin: 0,
                  fontSize: "20px",
                  fontWeight: 600,
                  color: "var(--page-text)",
                }}
              >
                <span className="mobile-logo-bracket" style={{ fontWeight: 800, fontSize:"28px", color: "#646cff"}}>[</span>
                <span>MarkDoc </span>
                <span className="mobile-logo-bracket" style={{ fontWeight: 800, fontSize:"28px", color: "#646cff"}}>]</span>
              </h1>
              <p
                style={{
                  margin: "4px 0 0 0",
                  color: mode === "dark" ? "#8b949e" : "#666",
                  fontSize: "13px"
                }}
              >
                <span className="mobile-hide">
                  Document:{" "}
                  <code
                    style={{
                      background: mode === "dark" ? "#21262d" : "#f5f5f5",
                      padding: "2px 6px",
                      borderRadius: "3px",
                      fontSize: "12px",
                      color: mode === "dark" ? "#e6edf3" : "#24292f",
                    }}
                  >
                    {docId}
                  </code>
                  {" · "}
                </span>
                {userInfo && (
                  <>
                    Logged in as:{" "}
                    <span style={{ fontWeight: 500 }}>{userInfo.name}</span>
                  </>
                )}
              </p>
            </div>

            <div
              className="mobile-header-actions"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
              }}
            >
              {/* User Presence Avatars */}
              <UserPresence channel={provider?.channel || null} />

              {/* Search Bar */}
              {editor && <SearchBar editor={editor} />}

              {/* Theme Toggle */}
              <ThemeToggle />

              {/* Combined Menu (New Document + Export) */}
              {editor && (
                <ExportMenu
                  editor={editor}
                  docId={docId}
                  onNewDocument={handleNewDocument}
                  yDoc={doc}
                />
              )}
            </div>
          </div>
        </div>

        {/* Editor Container */}
        <div
          className="mobile-editor-container editor-wrapper"
          style={{
            maxWidth: "1200px",
            margin: "0 auto",
            padding: "24px",
          }}
        >
          <div
            style={{
              backgroundColor: "var(--editor-bg)",
              border: "1px solid var(--editor-border)",
              borderRadius: "8px",
              overflow: "hidden",
              minHeight: "calc(100vh - 200px)",
              transition: "background-color 0.2s ease, border-color 0.2s ease",
            }}
          >
            {editorContextValue ? (
              <EditorContext.Provider value={editorContextValue}>
                <BlockNoteView editor={editor} theme={mode} slashMenu={false} sideMenu={true}>
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
              <BlockNoteView editor={editor} theme={mode} slashMenu={false} sideMenu={true}>
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

        {/* Keyboard Shortcuts Menu */}
        <KeyboardShortcutsMenu />

        {/* Table of Contents */}
        {editor && <TableOfContents editor={editor} />}
      </div>
    </>
  );
}
