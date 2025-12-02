/**
 * UserPresence Component
 *
 * Displays a list of currently connected users with their colored indicators.
 */

import { Channel } from "phoenix";
import { usePresence } from "../hooks/usePresence";

interface UserPresenceProps {
  channel: Channel | null;
}

export function UserPresence({ channel }: UserPresenceProps) {
  const users = usePresence(channel);
  const userCount = Object.keys(users).length;

  if (!channel) {
    return null;
  }

  return (
    <div
      style={{
        position: "fixed",
        top: 20,
        right: 20,
        background: "white",
        padding: "14px 18px",
        borderRadius: "8px",
        boxShadow: "0 2px 16px rgba(0,0,0,0.12)",
        border: "1px solid #e0e0e0",
        minWidth: "200px",
        maxWidth: "250px",
        zIndex: 1000,
      }}
    >
      <h4
        style={{
          margin: "0 0 12px 0",
          fontSize: "13px",
          fontWeight: 600,
          color: "#1a1a1a",
          textTransform: "uppercase",
          letterSpacing: "0.5px",
        }}
      >
        Online ({userCount})
      </h4>

      {userCount === 0 ? (
        <div style={{ fontSize: "12px", color: "#999" }}>No users online</div>
      ) : (
        <div>
          {Object.entries(users).map(([id, user]) => (
            <div
              key={id}
              style={{
                display: "flex",
                alignItems: "center",
                margin: "8px 0",
                fontSize: "13px",
                color: "#333",
              }}
            >
              <div
                style={{
                  width: "8px",
                  height: "8px",
                  borderRadius: "50%",
                  backgroundColor: user.color,
                  marginRight: "10px",
                  flexShrink: 0,
                  boxShadow: `0 0 0 2px ${user.color}33`,
                }}
                title={`${user.name} (online since ${new Date(user.online_at * 1000).toLocaleTimeString()})`}
              />
              <span
                style={{
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
      )}
    </div>
  );
}
