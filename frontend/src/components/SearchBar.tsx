/**
 * Advanced Block Search Component
 * Allows searching through document content with highlighting and navigation
 */
import { useState, useEffect, useCallback } from "react";
import type { BlockNoteEditor, Block } from "@blocknote/core";
import { useTheme } from "../contexts/ThemeContext";

interface SearchBarProps {
  editor: BlockNoteEditor<any, any, any> | null;
}

interface SearchResult {
  blockId: string;
  blockIndex: number;
  matchText: string;
  blockType: string;
}

export function SearchBar({ editor }: SearchBarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [currentResultIndex, setCurrentResultIndex] = useState(0);
  const [highlightedBlocks, setHighlightedBlocks] = useState<Set<string>>(new Set());
  const { mode } = useTheme();

  // Extract text content from a block recursively
  const extractBlockText = (block: Block<any, any, any>): string => {
    let text = "";

    // Handle block content
    if (block.content) {
      if (Array.isArray(block.content)) {
        text += block.content
          .map((item) => {
            if (typeof item === "string") return item;
            if (item && typeof item === "object" && "text" in item) {
              return item.text;
            }
            return "";
          })
          .join(" ");
      }
    }

    // Handle block props (like table cells, titles, etc.)
    if (block.props) {
      Object.values(block.props).forEach((value) => {
        if (typeof value === "string") {
          text += " " + value;
        }
      });
    }

    return text.toLowerCase().trim();
  };

  // Search through document blocks
  const performSearch = useCallback(
    (query: string) => {
      if (!editor || !query.trim()) {
        setResults([]);
        setHighlightedBlocks(new Set());
        setCurrentResultIndex(0);
        return;
      }

      const searchLower = query.toLowerCase().trim();
      const document = editor.document;
      const foundResults: SearchResult[] = [];
      const matchedBlockIds = new Set<string>();

      document.forEach((block, index) => {
        const blockText = extractBlockText(block);

        if (blockText.includes(searchLower)) {
          foundResults.push({
            blockId: block.id,
            blockIndex: index,
            matchText: blockText.substring(0, 100) + (blockText.length > 100 ? "..." : ""),
            blockType: block.type,
          });
          matchedBlockIds.add(block.id);
        }
      });

      setResults(foundResults);
      setHighlightedBlocks(matchedBlockIds);
      setCurrentResultIndex(foundResults.length > 0 ? 0 : -1);

      // Scroll to first result
      if (foundResults.length > 0) {
        scrollToBlock(foundResults[0].blockId);
      }
    },
    [editor]
  );

  // Scroll to a specific block
  const scrollToBlock = (blockId: string) => {
    const blockElement = document.querySelector(`[data-id="${blockId}"]`);
    if (blockElement) {
      blockElement.scrollIntoView({ behavior: "smooth", block: "center" });

      // Flash animation
      blockElement.classList.add("search-highlight-flash");
      setTimeout(() => {
        blockElement.classList.remove("search-highlight-flash");
      }, 1000);
    }
  };

  // Navigate to next result
  const nextResult = () => {
    if (results.length === 0) return;
    const nextIndex = (currentResultIndex + 1) % results.length;
    setCurrentResultIndex(nextIndex);
    scrollToBlock(results[nextIndex].blockId);
  };

  // Navigate to previous result
  const previousResult = () => {
    if (results.length === 0) return;
    const prevIndex = currentResultIndex - 1 < 0 ? results.length - 1 : currentResultIndex - 1;
    setCurrentResultIndex(prevIndex);
    scrollToBlock(results[prevIndex].blockId);
  };

  // Handle keyboard shortcuts for search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + F: Open search
      if ((e.metaKey || e.ctrlKey) && e.key === "f") {
        e.preventDefault();
        setIsOpen(true);
      }

      // Only handle other shortcuts when search is open
      if (!isOpen) return;

      // Escape: Close search
      if (e.key === "Escape") {
        setIsOpen(false);
        setSearchQuery("");
        setResults([]);
        setHighlightedBlocks(new Set());
        return;
      }

      // Don't handle navigation if no results
      if (results.length === 0) return;

      // Arrow Down or Enter: Next result
      if (e.key === "ArrowDown" || (e.key === "Enter" && !e.shiftKey)) {
        e.preventDefault();
        nextResult();
      }

      // Arrow Up or Shift + Enter: Previous result
      if (e.key === "ArrowUp" || (e.key === "Enter" && e.shiftKey)) {
        e.preventDefault();
        previousResult();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, results.length, nextResult, previousResult]);

  // Apply highlighting to matched blocks
  useEffect(() => {
    if (!editor) return;

    // Remove all existing highlights
    document.querySelectorAll(".search-highlight").forEach((el) => {
      el.classList.remove("search-highlight");
    });

    // Add highlights to matched blocks
    highlightedBlocks.forEach((blockId) => {
      const blockElement = document.querySelector(`[data-id="${blockId}"]`);
      if (blockElement) {
        blockElement.classList.add("search-highlight");
      }
    });

    return () => {
      document.querySelectorAll(".search-highlight").forEach((el) => {
        el.classList.remove("search-highlight");
      });
    };
  }, [highlightedBlocks, editor]);

  if (!isOpen) {
    return null;
  }

  // Helper to highlight search term in text
  const highlightText = (text: string, query: string) => {
    if (!query) return text;
    const parts = text.split(new RegExp(`(${query})`, "gi"));
    return parts.map((part, i) =>
      part.toLowerCase() === query.toLowerCase() ? (
        <mark
          key={i}
          style={{
            background: "#ffd54f",
            color: "#000",
            padding: "2px 4px",
            borderRadius: "2px",
            fontWeight: 600,
          }}
        >
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  return (
    <>
      {/* Main search bar */}
      <div
        className="mobile-search-bar"
        style={{
          position: "fixed",
          top: "80px",
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 1000,
          background: mode === "dark" ? "#161b22" : "#ffffff",
          border: `2px solid ${mode === "dark" ? "#30363d" : "#e0e0e0"}`,
          borderRadius: "8px",
          boxShadow: "0 8px 24px rgba(0, 0, 0, 0.2)",
          width: "90%",
          maxWidth: "700px",
          animation: "slideDown 0.2s ease-out",
        }}
      >
        {/* Search input row */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "12px 16px",
            borderBottom:
              results.length > 0 && searchQuery
                ? `1px solid ${mode === "dark" ? "#30363d" : "#e0e0e0"}`
                : "none",
          }}
        >
          <span style={{ fontSize: "16px" }}>🔍</span>

          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              performSearch(e.target.value);
            }}
            placeholder="Search in document..."
            autoFocus
            style={{
              flex: 1,
              border: "none",
              outline: "none",
              background: "transparent",
              color: "var(--page-text)",
              fontSize: "14px",
              padding: "4px",
            }}
          />

          {results.length > 0 && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                fontSize: "12px",
                color: mode === "dark" ? "#8b949e" : "#666",
              }}
            >
              <span>
                {currentResultIndex + 1} / {results.length}
              </span>

              <button
                onClick={previousResult}
                style={{
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  padding: "4px 8px",
                  borderRadius: "4px",
                  color: "var(--page-text)",
                  fontSize: "16px",
                }}
                title="Previous (↑ or Shift + Enter)"
              >
                ↑
              </button>

              <button
                onClick={nextResult}
                style={{
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  padding: "4px 8px",
                  borderRadius: "4px",
                  color: "var(--page-text)",
                  fontSize: "16px",
                }}
                title="Next (↓ or Enter)"
              >
                ↓
              </button>
            </div>
          )}

          <button
            onClick={() => {
              setIsOpen(false);
              setSearchQuery("");
              setResults([]);
              setHighlightedBlocks(new Set());
            }}
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              padding: "4px 8px",
              borderRadius: "4px",
              color: mode === "dark" ? "#8b949e" : "#666",
              fontSize: "18px",
            }}
            title="Close (Esc)"
          >
            ×
          </button>
        </div>

        {/* Results list */}
        {results.length > 0 && searchQuery && (
          <div
            className="mobile-search-results"
            style={{
              maxHeight: "400px",
              overflowY: "auto",
              padding: "8px 0",
            }}
          >
            {results.map((result, index) => (
              <div
                key={result.blockId}
                onClick={() => {
                  setCurrentResultIndex(index);
                  scrollToBlock(result.blockId);
                }}
                style={{
                  padding: "10px 16px",
                  cursor: "pointer",
                  background:
                    index === currentResultIndex
                      ? mode === "dark"
                        ? "#1c3d5a"
                        : "#e3f2fd"
                      : "transparent",
                  borderLeft:
                    index === currentResultIndex
                      ? "3px solid #646cff"
                      : "3px solid transparent",
                  transition: "all 0.15s ease",
                }}
                onMouseEnter={(e) => {
                  if (index !== currentResultIndex) {
                    e.currentTarget.style.background =
                      mode === "dark" ? "#21262d" : "#f5f5f5";
                  }
                }}
                onMouseLeave={(e) => {
                  if (index !== currentResultIndex) {
                    e.currentTarget.style.background = "transparent";
                  }
                }}
              >
                <div
                  style={{
                    fontSize: "11px",
                    color: mode === "dark" ? "#8b949e" : "#666",
                    marginBottom: "4px",
                    textTransform: "uppercase",
                    fontWeight: 600,
                  }}
                >
                  {result.blockType} • Block {index + 1}
                </div>
                <div
                  style={{
                    fontSize: "13px",
                    color: "var(--page-text)",
                    lineHeight: "1.5",
                    wordBreak: "break-word",
                  }}
                >
                  {highlightText(result.matchText, searchQuery)}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* No results message */}
        {searchQuery && results.length === 0 && (
          <div
            style={{
              padding: "16px",
              textAlign: "center",
              color: mode === "dark" ? "#8b949e" : "#666",
              fontSize: "13px",
            }}
          >
            No results found for "{searchQuery}"
          </div>
        )}
      </div>
    </>
  );
}
