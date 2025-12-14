/**
 * Keyboard Shortcuts Menu
 * Shows all available keyboard shortcuts when Option+Space is pressed
 */
import { useState, useEffect } from "react";
import { useTheme } from "../contexts/ThemeContext";

export function KeyboardShortcutsMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const { mode } = useTheme();

  // Handle keyboard shortcut to open/close menu
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Option/Alt + Space: Toggle shortcuts menu
      if (e.altKey && e.code === "Space") {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }

      // Escape: Close menu
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  const shortcuts = [
    { keys: ["Cmd/Ctrl", "F"], desc: "Search" },
    { keys: ["↑/↓"], desc: "Navigate results" },
    { keys: ["Cmd/Ctrl", "D"], desc: "Duplicate block" },
    { keys: ["Cmd/Ctrl", "⇧", "↑"], desc: "Move block up" },
    { keys: ["Cmd/Ctrl", "⇧", "↓"], desc: "Move block down" },
    { keys: ["Cmd/Ctrl", "⇧", "C"], desc: "Copy block" },
    { keys: ["Cmd/Ctrl", "⌥", "0"], desc: "→ Paragraph" },
    { keys: ["Cmd/Ctrl", "⌥", "1-6"], desc: "→ Heading" },
    { keys: ["Cmd/Ctrl", "⇧", "L"], desc: "→ Bullet list" },
    { keys: ["Cmd/Ctrl", "⇧", "N"], desc: "→ Numbered list" },
    { keys: ["Cmd/Ctrl", "⇧", "K"], desc: "→ Checkbox" },
    { keys: ["Cmd/Ctrl", "B"], desc: "Bold" },
    { keys: ["Cmd/Ctrl", "I"], desc: "Italic" },
    { keys: ["Cmd/Ctrl", "U"], desc: "Underline" },
    { keys: ["Cmd/Ctrl", "K"], desc: "Link" },
    { keys: ["/"], desc: "Slash menu" },
    { keys: ["Tab"], desc: "Indent" },
    { keys: ["⇧", "Tab"], desc: "Outdent" },
    { keys: ["⌥", "Space"], desc: "Shortcuts menu" },
    { keys: ["Esc"], desc: "Close/Cancel" },
  ];

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={() => setIsOpen(false)}
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "rgba(0, 0, 0, 0.5)",
          zIndex: 9998,
          animation: "fadeIn 0.2s ease-out",
        }}
      />

      {/* Menu */}
      <div
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          zIndex: 9999,
          background: mode === "dark" ? "#161b22" : "#ffffff",
          border: `2px solid ${mode === "dark" ? "#30363d" : "#e0e0e0"}`,
          borderRadius: "10px",
          boxShadow: "0 16px 48px rgba(0, 0, 0, 0.3)",
          width: "90%",
          maxWidth: "850px",
          animation: "scaleIn 0.2s ease-out",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "16px 20px",
            borderBottom: `1px solid ${mode === "dark" ? "#30363d" : "#e0e0e0"}`,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: "18px",
              fontWeight: 600,
              color: "var(--page-text)",
            }}
          >
            ⌨️ Keyboard Shortcuts
          </h2>
          <button
            onClick={() => setIsOpen(false)}
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              padding: "4px 8px",
              borderRadius: "4px",
              color: mode === "dark" ? "#8b949e" : "#666",
              fontSize: "20px",
              lineHeight: 1,
            }}
            title="Close (Esc)"
          >
            ×
          </button>
        </div>

        {/* Content - Compact Grid */}
        <div
          className="mobile-shortcuts-grid"
          style={{
            padding: "20px",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: "8px",
            maxHeight: "70vh",
            overflowY: "auto",
          }}
        >
          {shortcuts.map((item, idx) => (
            <div
              key={idx}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "8px 12px",
                background: mode === "dark" ? "#0d1117" : "#f6f8fa",
                borderRadius: "6px",
                gap: "12px",
              }}
            >
              <span
                style={{
                  fontSize: "13px",
                  color: "var(--page-text)",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  flex: 1,
                }}
              >
                {item.desc}
              </span>
              <div
                style={{
                  display: "flex",
                  gap: "4px",
                  alignItems: "center",
                  flexShrink: 0,
                }}
              >
                {item.keys.map((key, keyIdx) => (
                  <div key={keyIdx} style={{ display: "flex", gap: "4px", alignItems: "center" }}>
                    <kbd
                      style={{
                        background: mode === "dark" ? "#21262d" : "#ffffff",
                        border: `1px solid ${mode === "dark" ? "#30363d" : "#d0d7de"}`,
                        borderRadius: "3px",
                        padding: "2px 6px",
                        fontSize: "11px",
                        fontFamily: "monospace",
                        color: "var(--page-text)",
                        boxShadow: mode === "dark"
                          ? "0 1px 0 rgba(255, 255, 255, 0.1)"
                          : "0 1px 0 rgba(0, 0, 0, 0.1)",
                        lineHeight: "1.4",
                      }}
                    >
                      {key}
                    </kbd>
                    {keyIdx < item.keys.length - 1 && (
                      <span
                        style={{
                          fontSize: "10px",
                          color: mode === "dark" ? "#6e7681" : "#999",
                        }}
                      >
                        +
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
