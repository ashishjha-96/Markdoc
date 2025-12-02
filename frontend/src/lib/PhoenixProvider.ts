/**
 * PhoenixProvider: Bridge between Y.js and Phoenix Channels
 *
 * Handles the WebSocket connection to the backend and synchronizes
 * Y.js document state through binary update messages.
 */

import * as Y from "yjs";
import { Socket, Channel } from "phoenix";

export interface UserInfo {
  name: string;
  color: string;
}

export class PhoenixProvider {
  public doc: Y.Doc;
  public socket: Socket;
  public channel: Channel;
  private synced: boolean = false;
  private updateHandler: ((update: Uint8Array, origin: any) => void) | null =
    null;

  constructor(
    docId: string,
    doc: Y.Doc,
    userInfo: UserInfo,
    wsUrl: string = "ws://localhost:4000/socket"
  ) {
    this.doc = doc;

    console.log(
      `📡 Connecting to Phoenix at ${wsUrl} for document "${docId}" as "${userInfo.name}"`
    );

    // 1. Connect to Phoenix WebSocket with stable reconnection settings
    this.socket = new Socket(wsUrl, {
      params: {},
      heartbeatIntervalMs: 30000, // Send heartbeat every 30 seconds
      reconnectAfterMs: (tries: number) => {
        // Exponential backoff: 1s, 2s, 5s, 10s, then 10s
        return [1000, 2000, 5000, 10000][tries - 1] || 10000;
      },
      logger: (kind: any, msg: any, data: any) => {
        if (kind === "error") {
          console.error("Phoenix Socket Error:", msg, data);
        }
      },
    });

    // Add socket connection event handlers
    this.socket.onOpen(() => {
      console.log("✅ WebSocket connected");
    });

    this.socket.onClose(() => {
      console.log("❌ WebSocket disconnected");
    });

    this.socket.onError((error: any) => {
      console.error("⚠️ WebSocket error:", error);
    });

    this.socket.connect();

    // 2. Join the document channel with user info
    this.channel = this.socket.channel(`doc:${docId}`, {
      user: {
        name: userInfo.name,
        color: userInfo.color,
      },
    });

    // 3. Setup listeners BEFORE joining
    this.setupListeners();

    // 4. Join the channel and handle initial sync
    this.channel
      .join()
      .receive("ok", (resp: { history: number[][] }) =>
        this.handleInitialSync(resp)
      )
      .receive("error", (resp: any) => {
        console.error("❌ Failed to join document channel:", resp);
      })
      .receive("timeout", () => {
        console.error("⏱️ Channel join timeout");
      });
  }

  private setupListeners() {
    // Listen for updates from server
    this.channel.on("server_update", (payload: { bin: number[] }) => {
      console.log("📥 Received update from server, size:", payload.bin.length);

      // Convert array back to Uint8Array
      const binary = new Uint8Array(payload.bin);

      // Apply update to local doc
      // Use 'this' as origin to prevent echo
      Y.applyUpdate(this.doc, binary, this);
    });

    // Listen for snapshot requests from server
    this.channel.on("request_snapshot", () => {
      console.log("📸 Server requested snapshot. Compressing document...");

      // Encode entire document state into a single binary blob
      const snapshot = Y.encodeStateAsUpdate(this.doc);

      console.log(`📤 Sending snapshot, size: ${snapshot.length} bytes`);

      // Send back to server
      this.channel.push("snapshot", {
        body: Array.from(snapshot),
      });
    });

    // Listen for presence state and diff
    this.channel.on("presence_state", (state: any) => {
      console.log("👥 Initial presence state:", state);
    });

    this.channel.on("presence_diff", (diff: any) => {
      console.log("👥 Presence diff:", diff);
    });

    // Listen for local document changes
    this.updateHandler = (update: Uint8Array, origin: any) => {
      // Don't send updates that came from the server (they already have it)
      if (origin !== this) {
        console.log("📤 Sending update to server, size:", update.length);

        // Convert Uint8Array to array for JSON transport
        this.channel.push("client_update", {
          bin: Array.from(update),
        });
      }
    };

    this.doc.on("update", this.updateHandler);
  }

  private handleInitialSync(resp: { history: number[][] }) {
    if (resp.history && resp.history.length > 0) {
      console.log(`📦 Received ${resp.history.length} updates from server`);

      // Convert all history arrays to Uint8Arrays
      const updates = resp.history.map((arr) => new Uint8Array(arr));

      // Merge all updates into one
      const mergedUpdate = Y.mergeUpdates(updates);

      console.log(
        `🔗 Merged into single update, size: ${mergedUpdate.length} bytes`
      );

      // Apply to local doc (use 'this' as origin to prevent echo)
      Y.applyUpdate(this.doc, mergedUpdate, this);
    } else {
      console.log("📄 No history, starting with empty document");
    }

    this.synced = true;
    console.log("✅ Synced with server");
  }

  /**
   * Check if initial sync is complete
   */
  public isSynced(): boolean {
    return this.synced;
  }

  /**
   * Update cursor position
   */
  public updateCursor(position: { x: number; y: number }) {
    this.channel.push("cursor_move", { position });
  }

  /**
   * Clean up resources
   */
  public destroy() {
    console.log("🔌 Disconnecting PhoenixProvider");

    // Remove Y.js update listener
    if (this.updateHandler) {
      this.doc.off("update", this.updateHandler);
    }

    // Leave channel and disconnect socket
    this.channel.leave();
    this.socket.disconnect();
  }
}