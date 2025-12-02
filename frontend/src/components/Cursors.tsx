/**
 * Cursors Component
 *
 * Displays cursors for all connected users in real-time.
 */

import type { CursorInfo } from "../hooks/useCursors";

interface CursorsProps {
  cursors: Record<string, CursorInfo>;
}

export function Cursors({ cursors }: CursorsProps) {
  return (
    <>
      {Object.entries(cursors).map(([userId, cursor]) => {
        return (
          <div
            key={userId}
            style={{
              position: "fixed",
              left: cursor.position.x,
              top: cursor.position.y,
              pointerEvents: "none",
              zIndex: 9999,
              transition: "left 0.15s ease-out, top 0.15s ease-out",
              willChange: "left, top",
            }}
          >
            {/* Cursor SVG */}
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              style={{
                filter: `drop-shadow(0 0 2px rgba(0,0,0,0.3))`,
              }}
            >
              <path
                d="M5.65376 12.3673L10.6477 17.3612L8.77546 19.2335L3.78149 14.2395L5.65376 12.3673Z"
                fill={cursor.user_color}
              />
              <path
                d="M4.46164 14.2323L12.6866 6.00731L18.3264 11.647L10.1014 19.872L4.46164 14.2323Z"
                fill={cursor.user_color}
              />
            </svg>

            {/* User name label */}
            <div
              style={{
                position: "absolute",
                left: "20px",
                top: "0px",
                backgroundColor: cursor.user_color,
                color: "white",
                padding: "4px 8px",
                borderRadius: "4px",
                fontSize: "12px",
                fontWeight: 500,
                whiteSpace: "nowrap",
                boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
              }}
            >
              {cursor.user_name}
            </div>
          </div>
        );
      })}
    </>
  );
}
