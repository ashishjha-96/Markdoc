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
import type { UserInfo, DocumentInfo } from "../lib/PhoenixProvider";
import { UserPresence } from "./UserPresence";
import { ConnectionStatus } from "./ConnectionStatus";
import { NamePrompt } from "./NamePrompt";
import { Cursors } from "./Cursors";
import { ExportMenu } from "./ExportMenu";
import { ThemeToggle } from "./ThemeToggle";
import { SearchBar } from "./SearchBar";
import { KeyboardShortcutsMenu } from "./KeyboardShortcutsMenu";
import { TableOfContents } from "./TableOfContents";
import { SharingSettings } from "./SharingSettings";
import { useTheme } from "../contexts/ThemeContext";
import { useCursors } from "../hooks/useCursors";
import { usePresence } from "../hooks/usePresence";
import { useKeyboardShortcuts } from "../hooks/useKeyboardShortcuts";
import { useCodeBlockAutoDetect } from "../hooks/useCodeBlockAutoDetect";
import { useSharingSettings } from "../hooks/useSharingSettings";
import { generateDocId } from "../lib/generateDocId";
import { requestImport, onImportMarkdown, fetchPendingImport } from "../lib/importBridge";
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
  group: "Advanced",
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
  group: "Advanced",
  icon: "📊" as any,
  subtext: "Create a Mermaid flowchart or diagram",
});

// Custom slash menu item for embed block (YouTube, Vimeo, Spotify, etc.)
const insertEmbedBlockItem = (editor: BlockNoteEditor<any, any, any>) => ({
  title: "Embed",
  onItemClick: () => {
    const currentBlock = editor.getTextCursorPosition().block;
    editor.insertBlocks(
      [{
        type: "embed" as any,
        props: {
          url: "",
          width: 640,
          height: 360,
          caption: "",
        }
      }],
      currentBlock.id,
      "after"
    );
  },
  aliases: ["embed", "youtube", "video", "vimeo", "spotify", "twitch", "loom", "figma"],
  group: "Media",
  icon: "🔗" as any,
  subtext: "Embed YouTube, Vimeo, Spotify, and more",
});

// Get all slash menu items including custom blocks
const getCustomSlashMenuItems = (editor: BlockNoteEditor<any, any, any>) => {
  const defaultItems = getDefaultReactSlashMenuItems(editor);

  // Find index of Table (last item in Advanced group) to insert Chat and Mermaid after it
  const tableIndex = defaultItems.findIndex(item => item.title === "Table");
  if (tableIndex !== -1) {
    defaultItems.splice(tableIndex + 1, 0, insertChatBlockItem(editor), insertMermaidBlockItem(editor));
  }

  // Find index of File (last item in Media group) to insert Embed after it
  // Note: indices shifted after previous splice, so we search again
  const fileIndex = defaultItems.findIndex(item => item.title === "File");
  if (fileIndex !== -1) {
    defaultItems.splice(fileIndex + 1, 0, insertEmbedBlockItem(editor));
  }

  return defaultItems;
};

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
  const [documentInfo, setDocumentInfo] = useState<DocumentInfo | null>(null);
  const [showSharingModal, setShowSharingModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
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

  // Handle document purge
  const handlePurgeDocument = async () => {
    if (!provider) return;

    try {
      await provider.purgeDocument();
      // Redirect to home after successful purge
      window.location.pathname = "/";
    } catch (error) {
      console.error("Failed to purge document:", error);
      alert("Failed to delete document. You may not have permission.");
    }
    setShowDeleteConfirm(false);
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
      // Enable automatic markdown formatting on paste
      pasteHandler: ({ event, editor, defaultPasteHandler }) => {
        // Get clipboard data
        const clipboardData = event.clipboardData;
        if (!clipboardData) {
          return defaultPasteHandler();
        }

        // Check if there's plain text content that might be markdown
        const plainText = clipboardData.getData("text/plain");

        if (plainText) {
          // Check if the text looks like it contains markdown syntax
          // Use multiline flag to detect patterns at the start of any line
          const hasMarkdownSyntax = /^#{1,6}\s|^\s*[-*+]\s|^\s*\d+\.\s|\*\*|__|```|^>\s/m.test(plainText);

          if (hasMarkdownSyntax) {
            event.preventDefault();
            // Use the editor's markdown paste function
            editor.pasteMarkdown(plainText);
            return true;
          }
        }

        // For other cases, use default handler with markdown-friendly options
        return defaultPasteHandler({
          prioritizeMarkdownOverHTML: true,
          plainTextAsMarkdown: true,
        });
      },
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

  // Sharing settings hook
  const {
    settings: sharingSettings,
    updateSettings: updateSharingSettings,
  } = useSharingSettings({
    docId,
    isOwner: documentInfo?.isOwner ?? false,
    isPrivateDomain: documentInfo?.isPrivateDomain ?? false,
  });

  // Initialize Phoenix provider only after we have user info
  useEffect(() => {
    if (!userInfo) return;

    console.log(`Initializing editor for document: ${docId}`);

    const phoenixProvider = new PhoenixProvider(docId, doc, userInfo);
    setProvider(phoenixProvider);

    // Listen for document info from the channel
    phoenixProvider.onDocumentInfo((info) => {
      setDocumentInfo(info);
    });

    // Listen for document purge events (from other users)
    phoenixProvider.onDocumentPurged(() => {
      window.location.pathname = "/";
    });

    return () => {
      console.log(`Cleaning up editor for document: ${docId}`);
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

  // Handle import from external sources (VSCode extension via API, Chrome extension via postMessage)
  useEffect(() => {
    if (!editor || !provider) return;

    // Check if this is an import request
    const urlParams = new URLSearchParams(window.location.search);
    const shouldImport = urlParams.get('import') === 'true';

    if (!shouldImport) return;

    console.log('📥 Checking for import data...');

    // Helper to import markdown content
    const importMarkdown = async (markdown: string, source: string) => {
      console.log(`✓ Received markdown from ${source}:`, {
        length: markdown.length,
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
    };

    // First, try to fetch from API (VSCode extension flow)
    const tryApiImport = async () => {
      const markdown = await fetchPendingImport(docId);
      if (markdown) {
        await importMarkdown(markdown, 'API');
        return true;
      }
      return false;
    };

    // Try API first, then fall back to Chrome extension
    tryApiImport().then((imported) => {
      if (!imported) {
        // Fall back to Chrome extension flow
        requestImport(docId);
      }
    });

    // Listen for markdown from Chrome extension (fallback)
    const cleanup = onImportMarkdown(docId, async (markdown, sourceUrl, sourceTitle) => {
      console.log('✓ Received markdown from Chrome extension:', {
        length: markdown.length,
        sourceUrl,
        sourceTitle,
      });
      await importMarkdown(markdown, 'Chrome extension');
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
                <span className="mobile-logo-bracket" style={{ fontWeight: 800, fontSize: "28px", color: "#646cff" }}>[</span>
                <span>MarkDoc </span>
                <span className="mobile-logo-bracket" style={{ fontWeight: 800, fontSize: "28px", color: "#646cff" }}>]</span>
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

              {/* Share Button - only for owners on private domain */}
              {documentInfo?.isOwner && documentInfo?.isPrivateDomain && (
                <button
                  onClick={() => setShowSharingModal(true)}
                  style={{
                    padding: "0 12px",
                    height: "36px",
                    fontSize: "14px",
                    fontWeight: 500,
                    color: "white",
                    backgroundColor: "#2da44e",
                    border: "none",
                    borderRadius: "6px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    transition: "background-color 0.2s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = "#238636";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "#2da44e";
                  }}
                >
                  Share
                </button>
              )}

              {/* Delete Button - for owners or public documents */}
              {(documentInfo?.isOwner || (!documentInfo?.isPrivateDomain && !documentInfo?.isOwner)) && (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  title="Delete document"
                  style={{
                    padding: "0 10px",
                    height: "36px",
                    fontSize: "14px",
                    color: mode === "dark" ? "#f85149" : "#cf222e",
                    backgroundColor: "transparent",
                    border: `1px solid ${mode === "dark" ? "#f8514950" : "#cf222e50"}`,
                    borderRadius: "6px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    transition: "background-color 0.2s, border-color 0.2s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = mode === "dark" ? "#f8514920" : "#cf222e10";
                    e.currentTarget.style.borderColor = mode === "dark" ? "#f85149" : "#cf222e";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "transparent";
                    e.currentTarget.style.borderColor = mode === "dark" ? "#f8514950" : "#cf222e50";
                  }}
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    fill="currentColor"
                  >
                    <path d="M11 1.75V3h2.25a.75.75 0 0 1 0 1.5H2.75a.75.75 0 0 1 0-1.5H5V1.75C5 .784 5.784 0 6.75 0h2.5C10.216 0 11 .784 11 1.75ZM4.496 6.675l.66 6.6a.25.25 0 0 0 .249.225h5.19a.25.25 0 0 0 .249-.225l.66-6.6a.75.75 0 0 1 1.492.149l-.66 6.6A1.748 1.748 0 0 1 10.595 15h-5.19a1.75 1.75 0 0 1-1.741-1.575l-.66-6.6a.75.75 0 1 1 1.492-.15ZM6.5 1.75V3h3V1.75a.25.25 0 0 0-.25-.25h-2.5a.25.25 0 0 0-.25.25Z" />
                  </svg>
                </button>
              )}

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

        {/* Sharing Settings Modal */}
        {documentInfo?.isOwner && documentInfo?.isPrivateDomain && (
          <SharingSettings
            docId={docId}
            isOpen={showSharingModal}
            onClose={() => setShowSharingModal(false)}
            settings={sharingSettings}
            onSave={updateSharingSettings}
          />
        )}

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && (
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "rgba(0, 0, 0, 0.5)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 9999,
            }}
            onClick={() => setShowDeleteConfirm(false)}
          >
            <div
              style={{
                backgroundColor: mode === "dark" ? "#161b22" : "white",
                borderRadius: "12px",
                padding: "24px",
                maxWidth: "400px",
                width: "90%",
                boxShadow: "0 8px 32px rgba(0, 0, 0, 0.3)",
                border: `1px solid ${mode === "dark" ? "#30363d" : "#d0d7de"}`,
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <h2
                style={{
                  margin: "0 0 16px 0",
                  fontSize: "20px",
                  fontWeight: 600,
                  color: mode === "dark" ? "#f85149" : "#cf222e",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 16 16"
                  fill="currentColor"
                >
                  <path d="M11 1.75V3h2.25a.75.75 0 0 1 0 1.5H2.75a.75.75 0 0 1 0-1.5H5V1.75C5 .784 5.784 0 6.75 0h2.5C10.216 0 11 .784 11 1.75ZM4.496 6.675l.66 6.6a.25.25 0 0 0 .249.225h5.19a.25.25 0 0 0 .249-.225l.66-6.6a.75.75 0 0 1 1.492.149l-.66 6.6A1.748 1.748 0 0 1 10.595 15h-5.19a1.75 1.75 0 0 1-1.741-1.575l-.66-6.6a.75.75 0 1 1 1.492-.15ZM6.5 1.75V3h3V1.75a.25.25 0 0 0-.25-.25h-2.5a.25.25 0 0 0-.25.25Z" />
                </svg>
                Delete Document
              </h2>
              <p
                style={{
                  margin: "0 0 24px 0",
                  fontSize: "14px",
                  color: mode === "dark" ? "#8b949e" : "#57606a",
                  lineHeight: 1.5,
                }}
              >
                Are you sure you want to permanently delete this document? This action cannot be undone and all content will be lost.
              </p>
              <div
                style={{
                  display: "flex",
                  gap: "12px",
                  justifyContent: "flex-end",
                }}
              >
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  style={{
                    padding: "8px 16px",
                    fontSize: "14px",
                    fontWeight: 500,
                    color: mode === "dark" ? "#c9d1d9" : "#24292f",
                    backgroundColor: mode === "dark" ? "#21262d" : "#f6f8fa",
                    border: `1px solid ${mode === "dark" ? "#30363d" : "#d0d7de"}`,
                    borderRadius: "6px",
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handlePurgeDocument}
                  style={{
                    padding: "8px 16px",
                    fontSize: "14px",
                    fontWeight: 500,
                    color: "white",
                    backgroundColor: mode === "dark" ? "#da3633" : "#cf222e",
                    border: "none",
                    borderRadius: "6px",
                    cursor: "pointer",
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
