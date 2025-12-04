/**
 * Cursors Component
 *
 * Displays cursors for all connected users in real-time (Google Docs style).
 */

import { useState, useEffect } from "react";
import type { CursorInfo } from "../hooks/useCursors";

interface CursorsProps {
  cursors: Record<string, CursorInfo>;
}

export function Cursors({ cursors }: CursorsProps) {
  return (
    <>
      {Object.entries(cursors).map(([userId, cursor]) => (
        <RemoteCursor key={userId} cursor={cursor} />
      ))}
    </>
  );
}

function RemoteCursor({ cursor }: { cursor: CursorInfo }) {
  const [isHovered, setIsHovered] = useState(false);
  const [position, setPosition] = useState<{ x: number; y: number } | null>(
    null
  );

  // Calculate pixel position from block position
  useEffect(() => {
    const updatePosition = () => {
      try {
        // Find the block element by data-id
        const blockElement = document.querySelector(
          `[data-id="${cursor.position.blockId}"]`
        );
        if (!blockElement) {
          setPosition(null);
          return;
        }

        // Create a tree walker to traverse text nodes
        const walker = document.createTreeWalker(
          blockElement,
          NodeFilter.SHOW_TEXT,
          null
        );

        let currentOffset = 0;
        let targetNode: Node | null = null;
        let offsetInNode = 0;

        // Walk through text nodes to find the target position
        while (walker.nextNode()) {
          const node = walker.currentNode;
          const nodeLength = node.textContent?.length || 0;

          if (currentOffset + nodeLength >= cursor.position.offset) {
            targetNode = node;
            offsetInNode = cursor.position.offset - currentOffset;
            break;
          }
          currentOffset += nodeLength;
        }

        if (!targetNode) {
          // Cursor is at end or block is empty - use block's position
          const rect = blockElement.getBoundingClientRect();
          setPosition({ x: rect.left, y: rect.top });
          return;
        }

        // Create a range at the exact character position
        const range = document.createRange();
        range.setStart(targetNode, Math.min(offsetInNode, targetNode.textContent?.length || 0));
        range.setEnd(targetNode, Math.min(offsetInNode, targetNode.textContent?.length || 0));

        const rect = range.getBoundingClientRect();
        setPosition({ x: rect.left, y: rect.top });
      } catch (error) {
        console.error("[Cursor] Error calculating position:", error);
        setPosition(null);
      }
    };

    updatePosition();

    // Recalculate on window resize or scroll (since layout might change)
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true); // Use capture to catch all scroll events

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [cursor.position.blockId, cursor.position.offset, cursor.user_name]);

  // Don't render if we can't calculate position
  if (!position) return null;

  return (
    <div
      style={{
        position: "fixed",
        left: position.x,
        top: position.y,
        zIndex: 9999,
        transition: "left 0.15s ease-out, top 0.15s ease-out",
        willChange: "left, top",
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Vertical cursor line (caret) */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: "2px",
          height: "20px",
          backgroundColor: cursor.user_color,
          pointerEvents: "auto",
          cursor: "default",
        }}
      />

      {/* Top flag/header */}
      <div
        style={{
          position: "absolute",
          left: "2px",
          top: "-2px",
          width: "8px",
          height: "8px",
          backgroundColor: cursor.user_color,
          borderRadius: "2px 2px 0 0",
          pointerEvents: "auto",
          cursor: "default",
        }}
      />

      {/* User name label (shown on hover) */}
      {isHovered && (
        <div
          style={{
            position: "absolute",
            left: "10px",
            top: "-6px",
            backgroundColor: cursor.user_color,
            color: "white",
            padding: "4px 8px",
            borderRadius: "4px",
            fontSize: "12px",
            fontWeight: 500,
            whiteSpace: "nowrap",
            boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
            pointerEvents: "none",
          }}
        >
          {cursor.user_name}
        </div>
      )}
    </div>
  );
}
