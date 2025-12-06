/**
 * ExportMenu Component
 *
 * Combined dropdown menu for document actions and exporting in various formats.
 * Supports New Document creation, Markdown, HTML, and Plain Text exports.
 */

import { useState } from "react";
import type { BlockNoteEditor } from "@blocknote/core";
import type * as Y from "yjs";
import {
  exportToMarkdown,
  exportToHTML,
  exportToPlainText,
} from "../lib/exportDocument";

interface ExportMenuProps {
  editor: BlockNoteEditor<any, any, any>;
  docId: string;
  onNewDocument: () => void;
  yDoc?: Y.Doc;
}

export function ExportMenu({ editor, docId, onNewDocument, yDoc }: ExportMenuProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleNewDocument = () => {
    setIsOpen(false);
    onNewDocument();
  };

  const handleExport = async (format: "markdown" | "html" | "text") => {
    setIsOpen(false);

    switch (format) {
      case "markdown":
        await exportToMarkdown(editor, docId, yDoc);
        break;
      case "html":
        await exportToHTML(editor, docId);
        break;
      case "text":
        await exportToPlainText(editor, docId);
        break;
    }
  };

  return (
    <div style={{ position: "relative" }}>
      {/* Split Button Container */}
      <div
        style={{
          display: "flex",
          backgroundColor: "#646cff",
          borderRadius: "6px",
          overflow: "hidden",
          transition: "background-color 0.2s",
        }}
      >
        {/* Main Action - New Document */}
        <button
          onClick={handleNewDocument}
          style={{
            padding: "6px 8px",
            fontSize: "14px",
            fontWeight: 600,
            color: "white",
            backgroundColor: "transparent",
            border: "none",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "10px",
            transition: "background-color 0.2s",
            whiteSpace: "nowrap",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "rgba(0,0,0,0.1)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "transparent";
          }}
        >
          <span
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "20px",
              height: "20px",
              backgroundColor: "rgba(255,255,255,0.3)",
              borderRadius: "4px",
              fontSize: "18px",
            }}
          >
            +
          </span>
          New
        </button>

        {/* Divider */}
        <div
          style={{
            width: "1px",
            backgroundColor: "rgba(255,255,255,0.3)",
          }}
        />

        {/* Dropdown Toggle */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          style={{
            padding: "6px 12px",
            backgroundColor: "transparent",
            border: "none",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "background-color 0.2s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "rgba(0,0,0,0.1)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "transparent";
          }}
        >
          <span style={{ fontSize: "12px", color: "white" }}>▼</span>
        </button>
      </div>

      {/* Dropdown Menu */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            onClick={() => setIsOpen(false)}
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 1001,
            }}
          />

          {/* Menu Content */}
          <div
            style={{
              position: "absolute",
              top: "calc(100% + 8px)",
              right: 0,
              background: "white",
              borderRadius: "8px",
              boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
              border: "1px solid #e0e0e0",
              padding: "8px",
              minWidth: "200px",
              zIndex: 1002,
            }}
          >
            <div
              style={{
                fontSize: "11px",
                fontWeight: 600,
                color: "#999",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
                padding: "8px 12px 4px",
              }}
            >
              Export as
            </div>

            <MenuItem
              label="Markdown (.md)"
              onClick={() => handleExport("markdown")}
            />
            <MenuItem
              label="HTML (.html)"
              onClick={() => handleExport("html")}
            />
            <MenuItem
              label="Plain Text (.txt)"
              onClick={() => handleExport("text")}
            />
          </div>
        </>
      )}
    </div>
  );
}

// Menu item component for reusability
function MenuItem({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{
        padding: "12px 16px",
        borderRadius: "4px",
        cursor: "pointer",
        fontSize: "14px",
        color: "#1a1a1a",
        transition: "background-color 0.2s",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = "#f5f5f5";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = "transparent";
      }}
    >
      {label}
    </div>
  );
}
