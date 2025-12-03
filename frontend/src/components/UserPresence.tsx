/**
 * UserPresence Component
 *
 * Displays circular avatars of currently connected users (Google Docs style).
 * Shows up to 5 avatars, with overflow count (+N) for additional users.
 */

import { useState } from "react";
import { Channel } from "phoenix";
import { usePresence } from "../hooks/usePresence";

interface UserPresenceProps {
  channel: Channel | null;
}

const MAX_VISIBLE_AVATARS = 5;

export function UserPresence({ channel }: UserPresenceProps) {
  const users = usePresence(channel);
  const [showOverflow, setShowOverflow] = useState(false);
  const userEntries = Object.entries(users);
  const userCount = userEntries.length;

  if (!channel || userCount === 0) {
    return null;
  }

  const visibleUsers = userEntries.slice(0, MAX_VISIBLE_AVATARS);
  const overflowUsers = userEntries.slice(MAX_VISIBLE_AVATARS);
  const overflowCount = overflowUsers.length;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
      }}
    >
      {/* Visible user avatars */}
      {visibleUsers.map(([id, user], index) => (
        <UserAvatar
          key={id}
          name={user.name}
          color={user.color}
          index={index}
        />
      ))}

      {/* Overflow button (+N) */}
      {overflowCount > 0 && (
        <div style={{ position: "relative", marginLeft: "4px" }}>
          <div
            onClick={() => setShowOverflow(!showOverflow)}
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "50%",
              backgroundColor: "#f5f5f5",
              border: "2px solid white",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "12px",
              fontWeight: 600,
              color: "#666",
              cursor: "pointer",
              boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
              transition: "all 0.2s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "#e8e8e8";
              e.currentTarget.style.transform = "scale(1.05)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "#f5f5f5";
              e.currentTarget.style.transform = "scale(1)";
            }}
          >
            +{overflowCount}
          </div>

          {/* Overflow dropdown */}
          {showOverflow && (
            <>
              {/* Backdrop to close dropdown */}
              <div
                onClick={() => setShowOverflow(false)}
                style={{
                  position: "fixed",
                  inset: 0,
                  zIndex: 1001,
                }}
              />

              {/* Dropdown content */}
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
                  minWidth: "180px",
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
                  Other users
                </div>
                {overflowUsers.map(([id, user]) => (
                  <div
                    key={id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      padding: "8px 12px",
                      borderRadius: "4px",
                      cursor: "default",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = "#f5f5f5";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = "transparent";
                    }}
                  >
                    <div
                      style={{
                        width: "28px",
                        height: "28px",
                        borderRadius: "50%",
                        backgroundColor: user.color,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "12px",
                        fontWeight: 600,
                        color: "white",
                        flexShrink: 0,
                      }}
                    >
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                    <span
                      style={{
                        fontSize: "13px",
                        color: "#333",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {user.name}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// Individual user avatar component with tooltip on hover
function UserAvatar({
  name,
  color,
  index,
}: {
  name: string;
  color: string;
  index: number;
}) {
  const [showTooltip, setShowTooltip] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      style={{
        position: "relative",
        marginLeft: index > 0 ? "-8px" : "0",
        zIndex: isHovered ? 100 : 10 - index,
      }}
      onMouseEnter={() => {
        setShowTooltip(true);
        setIsHovered(true);
      }}
      onMouseLeave={() => {
        setShowTooltip(false);
        setIsHovered(false);
      }}
    >
      <div
        style={{
          width: "36px",
          height: "36px",
          borderRadius: "50%",
          backgroundColor: color,
          border: "2px solid white",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "14px",
          fontWeight: 600,
          color: "white",
          cursor: "pointer",
          boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
          transition: "transform 0.2s",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = "scale(1.1)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = "scale(1)";
        }}
      >
        {name.charAt(0).toUpperCase()}
      </div>

      {/* Tooltip */}
      {showTooltip && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            left: "50%",
            transform: "translateX(-50%)",
            backgroundColor: "#1a1a1a",
            color: "white",
            padding: "6px 12px",
            borderRadius: "6px",
            fontSize: "12px",
            fontWeight: 500,
            whiteSpace: "nowrap",
            boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
            zIndex: 1003,
            pointerEvents: "none",
          }}
        >
          {name}
          {/* Tooltip arrow */}
          <div
            style={{
              position: "absolute",
              top: "-4px",
              left: "50%",
              transform: "translateX(-50%)",
              width: 0,
              height: 0,
              borderLeft: "4px solid transparent",
              borderRight: "4px solid transparent",
              borderBottom: "4px solid #1a1a1a",
            }}
          />
        </div>
      )}
    </div>
  );
}
