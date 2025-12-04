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
  position: { blockId: string; offset: number };
}

export function useCursors(channel: Channel | null) {
  const [cursors, setCursors] = useState<Record<string, CursorInfo>>({});

  useEffect(() => {
    if (!channel) return;

    const handleCursorUpdate = (data: CursorInfo) => {
      setCursors((prev) => {
        // Remove cursor if position is invalid (empty blockId means cursor is inactive)
        if (!data.position.blockId) {
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
