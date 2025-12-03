/**
 * Cursors Component
 *
 * Displays cursors for all connected users in real-time (Google Docs style).
 */

import { useState } from "react";
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

  return (
    <div
      style={{
        position: "fixed",
        left: cursor.position.x,
        top: cursor.position.y,
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
