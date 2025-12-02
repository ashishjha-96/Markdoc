/**
 * ConnectionStatus Component
 *
 * Displays the current WebSocket connection status.
 */

import { useState, useEffect } from "react";
import { Socket } from "phoenix";

interface ConnectionStatusProps {
  socket: Socket | null;
}

type ConnectionState = "connecting" | "open" | "closed";

export function ConnectionStatus({ socket }: ConnectionStatusProps) {
  const [status, setStatus] = useState<ConnectionState>("connecting");

  useEffect(() => {
    if (!socket) {
      setStatus("closed");
      return;
    }

    // Set up connection state handlers
    const handleOpen = () => setStatus("open");
    const handleClose = () => setStatus("closed");
    const handleError = () => setStatus("closed");

    socket.onOpen(handleOpen);
    socket.onClose(handleClose);
    socket.onError(handleError);

    // Check current state
    if (socket.isConnected()) {
      setStatus("open");
    }

    // Cleanup - Phoenix sockets handle this internally
  }, [socket]);

  const statusConfig = {
    connecting: {
      bgColor: "#FFF4E5",
      textColor: "#E65100",
      borderColor: "#FFE0B2",
      text: "Connecting...",
      dot: "○",
    },
    open: {
      bgColor: "#E8F5E9",
      textColor: "#2E7D32",
      borderColor: "#C8E6C9",
      text: "Connected",
      dot: "●",
    },
    closed: {
      bgColor: "#FFEBEE",
      textColor: "#C62828",
      borderColor: "#FFCDD2",
      text: "Disconnected",
      dot: "●",
    },
  };

  const config = statusConfig[status];

  return (
    <div
      style={{
        position: "fixed",
        bottom: 20,
        right: 20,
        padding: "8px 14px",
        borderRadius: "6px",
        backgroundColor: config.bgColor,
        border: `1px solid ${config.borderColor}`,
        color: config.textColor,
        fontSize: "12px",
        fontWeight: 500,
        boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        gap: "6px",
      }}
    >
      <span style={{ fontSize: "10px", lineHeight: 1 }}>{config.dot}</span>
      {config.text}
    </div>
  );
}
