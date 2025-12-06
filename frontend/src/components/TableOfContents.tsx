import { useState, useMemo, useEffect, useRef } from "react";
import type { BlockNoteEditor } from "@blocknote/core";
import { useTableOfContents, type HeadingNode } from "../hooks/useTableOfContents";
import { useActiveHeading } from "../hooks/useActiveHeading";
import { TableOfContentsItem } from "./TableOfContentsItem";

interface TableOfContentsProps {
  editor: BlockNoteEditor<any, any, any> | null;
}

export function TableOfContents({ editor }: TableOfContentsProps) {
  const { headings, hasHeadings, toggleCollapse } = useTableOfContents(editor);
  const [userHidden, setUserHidden] = useState(false);
  const [isResponsiveHidden, setIsResponsiveHidden] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const hoverTimeoutRef = useRef<number | null>(null);

  const handleMouseEnter = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    hoverTimeoutRef.current = setTimeout(() => {
      setIsHovered(false);
    }, 200);
  };

  // Get all heading IDs for active detection (flatten hierarchy)
  const headingIds = useMemo(() => {
    const ids: string[] = [];
    const flatten = (nodes: HeadingNode[]) => {
      nodes.forEach((node) => {
        ids.push(node.id);
        flatten(node.children);
      });
    };
    flatten(headings);
    return ids;
  }, [headings]);

  const activeHeadingId = useActiveHeading(
    headingIds,
    hasHeadings && !userHidden && !isResponsiveHidden
  );

  // Scroll to heading
  const handleNavigate = (id: string) => {
    const element = document.querySelector(`[data-id="${id}"]`);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  // Responsive behavior: hide TOC on narrow screens
  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 1400px)");

    const handler = (e: MediaQueryListEvent | MediaQueryList) => {
      setIsResponsiveHidden(e.matches);
    };

    handler(mediaQuery);
    mediaQuery.addEventListener("change", handler);

    return () => mediaQuery.removeEventListener("change", handler);
  }, []);

  // Auto-show logic
  const shouldShow = hasHeadings && !userHidden && !isResponsiveHidden;

  // Debug logging
  useEffect(() => {
    console.log('TOC State:', {
      hasHeadings,
      userHidden,
      isResponsiveHidden,
      shouldShow,
      isHovered,
      headingsCount: headings.length
    });
  }, [hasHeadings, userHidden, isResponsiveHidden, shouldShow, isHovered, headings.length]);

  if (!shouldShow) {
    // Show minimal toggle if headings exist but user hid it or screen is narrow
    if (hasHeadings && userHidden && !isResponsiveHidden) {
      return (
        <button
          onClick={() => setUserHidden(false)}
          style={{
            position: "fixed",
            right: "24px",
            top: "120px",
            background: "var(--chat-btn-bg)",
            border: "1px solid var(--header-border)",
            borderRadius: "6px",
            padding: "8px 12px",
            fontSize: "12px",
            color: "var(--page-text)",
            cursor: "pointer",
            transition: "all 0.2s ease",
            zIndex: 100,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "var(--chat-btn-hover)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "var(--chat-btn-bg)";
          }}
          aria-label="Show table of contents"
        >
          Show TOC
        </button>
      );
    }
    return null;
  }

  // Minimized icon style (when not hovered)
  const tocMinimizedStyle: React.CSSProperties = {
    position: "fixed",
    right: "20px",
    top: "50%",
    transform: "translateY(-50%)",
    width: "44px",
    height: "44px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "var(--header-bg)",
    border: "2px solid var(--header-border)",
    borderRadius: "50%",
    boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)",
    cursor: "pointer",
    transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
    zIndex: 1000,
    fontSize: "20px",
    pointerEvents: "auto",
  };

  // Expanded container style (when hovered)
  const tocContainerStyle: React.CSSProperties = {
    position: "fixed",
    right: "20px",
    top: "50%",
    transform: "translateY(-50%)",
    width: "240px",
    maxHeight: "70vh",
    overflowY: "auto",
    backgroundColor: "var(--header-bg)",
    border: "1px solid var(--header-border)",
    borderRadius: "8px",
    padding: "12px",
    boxShadow: "0 8px 32px rgba(0, 0, 0, 0.15)",
    transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
    zIndex: 1000,
    pointerEvents: "auto",
  };

  const tocHeaderStyle: React.CSSProperties = {
    fontSize: "10px",
    fontWeight: 700,
    color: "var(--chat-text-secondary)",
    textTransform: "uppercase",
    letterSpacing: "0.8px",
    marginBottom: "10px",
    paddingBottom: "8px",
    borderBottom: "1px solid var(--header-border)",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  };

  const closeButtonStyle: React.CSSProperties = {
    background: "transparent",
    border: "none",
    cursor: "pointer",
    fontSize: "16px",
    color: "var(--chat-text-secondary)",
    padding: "0",
    width: "18px",
    height: "18px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "3px",
    transition: "all 0.15s ease",
  };

  // Show minimized icon or expanded TOC based on hover
  if (!isHovered) {
    return (
      <div
        className="toc-minimized"
        style={tocMinimizedStyle}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={() => setIsHovered(true)}
        aria-label="Table of contents"
        title="Table of Contents (Hover or click to expand)"
      >
        <svg 
          width="18" 
          height="18" 
          viewBox="0 0 20 20" 
          fill="none" 
          style={{ 
            color: "var(--page-text)",
            pointerEvents: "none"
          }}
        >
          <line x1="4" y1="5" x2="16" y2="5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
          <line x1="6" y1="10" x2="16" y2="10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
          <line x1="8" y1="15" x2="16" y2="15" stroke="#646cff" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </div>
    );
  }

  return (
    <div
      className="toc-container"
      style={tocContainerStyle}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div style={tocHeaderStyle}>
        <span>Table of Contents</span>
        <button
          onClick={() => {
            setUserHidden(true);
            setIsHovered(false);
          }}
          style={closeButtonStyle}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "var(--chat-btn-hover)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
          }}
          aria-label="Hide table of contents"
        >
          ×
        </button>
      </div>

      <div>
        {headings.map((node) => (
          <TableOfContentsItem
            key={node.id}
            node={node}
            activeHeadingId={activeHeadingId}
            onNavigate={handleNavigate}
            onToggleCollapse={toggleCollapse}
            depth={0}
          />
        ))}
      </div>
    </div>
  );
}
