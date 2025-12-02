/**
 * useCursors Hook
 *
 * Tracks cursor positions for all users via direct channel broadcasts.
 * Separate from presence to avoid triggering join/leave events.
 */

import { useState, useEffect } from "react";
import { Channel } from "phoenix";

export interface CursorInfo {
  user_id: string;
  user_name: string;
  user_color: string;
  position: { x: number; y: number };
}

export function useCursors(channel: Channel | null) {
  const [cursors, setCursors] = useState<Record<string, CursorInfo>>({});

  useEffect(() => {
    if (!channel) return;

    const handleCursorUpdate = (data: CursorInfo) => {
      setCursors((prev) => {
        // Remove cursor if position is invalid
        if (data.position.x < 0 || data.position.y < 0) {
          const { [data.user_id]: _, ...rest } = prev;
          return rest;
        }

        // Update cursor position
        return {
          ...prev,
          [data.user_id]: data,
        };
      });
    };

    channel.on("cursor_update", handleCursorUpdate);

    return () => {
      channel.off("cursor_update", handleCursorUpdate);
    };
  }, [channel]);

  return cursors;
}
