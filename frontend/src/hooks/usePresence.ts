/**
 * usePresence Hook
 *
 * Tracks user presence in a Phoenix channel using Phoenix Presence.
 * Returns a map of currently connected users with their metadata.
 */

import { useState, useEffect } from "react";
import { Channel } from "phoenix";

export interface UserPresence {
  name: string;
  color: string;
  online_at: number;
}

interface PresenceMeta {
  name: string;
  color: string;
  online_at: number;
  phx_ref: string;
}

interface PresenceState {
  [userId: string]: {
    metas: PresenceMeta[];
  };
}

export function usePresence(channel: Channel | null) {
  const [users, setUsers] = useState<Record<string, UserPresence>>({});

  useEffect(() => {
    if (!channel) return;

    let presenceState: PresenceState = {};

    const syncUsers = (state: PresenceState) => {
      const userList: Record<string, UserPresence> = {};

      Object.entries(state).forEach(([userId, { metas }]) => {
        if (metas && metas.length > 0) {
          const meta = metas[0];
          userList[userId] = {
            name: meta.name,
            color: meta.color,
            online_at: meta.online_at,
          };
        }
      });

      setUsers(userList);
    };

    // Handle initial presence state
    const handlePresenceState = (state: PresenceState) => {
      const userCount = Object.keys(state).length;
      console.log(`👥 Presence: ${userCount} user${userCount !== 1 ? 's' : ''} online`);
      presenceState = state;
      syncUsers(presenceState);
    };

    // Handle presence diff (joins/leaves)
    const handlePresenceDiff = (diff: {
      joins: PresenceState;
      leaves: PresenceState;
    }) => {
      const joinedUsers = Object.values(diff.joins)
        .filter(p => p.metas && p.metas.length > 0)
        .map(p => p.metas[0].name);

      const leftUserIds = Object.keys(diff.leaves);

      // Add new joins
      Object.entries(diff.joins).forEach(([userId, presence]) => {
        presenceState[userId] = presence;
      });

      // Remove leaves
      leftUserIds.forEach((userId) => {
        delete presenceState[userId];
      });

      syncUsers(presenceState);

      // Only log actual user joins/leaves (not cursor updates)
      if (joinedUsers.length > 0 || leftUserIds.length > 0) {
        const total = Object.keys(presenceState).length;
        if (joinedUsers.length > 0) {
          console.log(`👋 ${joinedUsers.join(", ")} joined (${total} online)`);
        }
        if (leftUserIds.length > 0) {
          console.log(`👋 User left (${total} online)`);
        }
      }
    };

    // Listen for presence events from the channel
    channel.on("presence_state", handlePresenceState);
    channel.on("presence_diff", handlePresenceDiff);

    // Cleanup
    return () => {
      // Remove event listeners
      channel.off("presence_state", handlePresenceState);
      channel.off("presence_diff", handlePresenceDiff);
    };
  }, [channel]);

  return users;
}
