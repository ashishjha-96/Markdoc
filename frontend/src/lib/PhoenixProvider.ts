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

export interface DocumentInfo {
  isOwner: boolean;
  sharingMode: string | null;
  isPrivateDomain: boolean;
}

/**
 * Detects if the current domain is the private domain.
 */
export function isPrivateDomain(): boolean {
  const hostname = window.location.hostname;
  // Check if hostname starts with 'private.' or matches the private domain pattern
  return hostname.startsWith("private.") || hostname === "private.markdoc.live";
}

/**
 * Gets the public domain URL for sharing.
 */
export function getPublicDomain(): string {
  if (isPrivateDomain()) {
    // Convert private.markdoc.live to markdoc.live
    return window.location.hostname.replace(/^private\./, "");
  }
  return window.location.hostname;
}

export class PhoenixProvider {
  public doc: Y.Doc;
  public socket: Socket;
  public channel: Channel;
  public documentInfo: DocumentInfo | null = null;
  private synced: boolean = false;
  private updateHandler: ((update: Uint8Array, origin: any) => void) | null =
    null;
  private documentInfoCallbacks: ((info: DocumentInfo) => void)[] = [];
  private purgeCallbacks: (() => void)[] = [];
  private errorCallbacks: ((error: { reason: string }) => void)[] = [];
  private accessRevokedCallbacks: ((reason: string) => void)[] = [];

  constructor(
    docId: string,
    doc: Y.Doc,
    userInfo: UserInfo
  ) {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/socket`;

    this.doc = doc;

    // Extract CF_Authorization cookie if present
    const cfToken = this.getCookie("CF_Authorization");

    console.log(
      `📡 Connecting to Phoenix at ${wsUrl} for document "${docId}" as "${userInfo.name}"`,
      cfToken ? "(authenticated)" : "(public)"
    );

    // 1. Connect to Phoenix WebSocket with stable reconnection settings
    // Only include cf_token param if we have a valid token
    const socketParams: Record<string, string> = {};
    if (cfToken) {
      socketParams.cf_token = cfToken;
    }

    this.socket = new Socket(wsUrl, {
      params: socketParams,
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
      .receive("ok", (resp: { history: number[][]; is_owner?: boolean; sharing_mode?: string | null; is_private_domain?: boolean }) =>
        this.handleInitialSync(resp)
      )
      .receive("error", (resp: any) => {
        console.error("❌ Failed to join document channel:", resp);
        // Notify error callbacks
        this.errorCallbacks.forEach(cb => cb(resp));
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

    // Listen for document purge notification
    this.channel.on("document_purged", () => {
      console.log("🗑️ Document was purged");
      this.purgeCallbacks.forEach(cb => cb());
    });

    // Listen for access revocation (when sharing settings change)
    this.channel.on("access_revoked", (payload: { reason: string }) => {
      console.log("🚫 Access revoked:", payload.reason);
      this.accessRevokedCallbacks.forEach(cb => cb(payload.reason));
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

  private getCookie(name: string): string | null {
    const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
    return match ? match[2] : null;
  }

  private handleInitialSync(resp: { history: number[][]; is_owner?: boolean; sharing_mode?: string | null; is_private_domain?: boolean }) {
    // Store document info
    this.documentInfo = {
      isOwner: resp.is_owner ?? false,
      sharingMode: resp.sharing_mode ?? null,
      isPrivateDomain: resp.is_private_domain ?? false,
    };

    // Notify callbacks
    this.documentInfoCallbacks.forEach(cb => cb(this.documentInfo!));

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
   * Register a callback for when document info is available
   */
  public onDocumentInfo(callback: (info: DocumentInfo) => void) {
    if (this.documentInfo) {
      callback(this.documentInfo);
    }
    this.documentInfoCallbacks.push(callback);
  }

  /**
   * Update cursor position
   */
  public updateCursor(position: { blockId: string; offset: number }) {
    this.channel.push("cursor_move", { position });
  }

  /**
   * Purge (delete) the document from storage and memory
   * Returns a promise that resolves on success or rejects on failure
   */
  public purgeDocument(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.channel
        .push("purge", {})
        .receive("ok", () => {
          console.log("🗑️ Document purged successfully");
          resolve();
        })
        .receive("error", (resp: { reason: string }) => {
          console.error("❌ Failed to purge document:", resp.reason);
          reject(new Error(resp.reason));
        })
        .receive("timeout", () => {
          console.error("⏱️ Purge request timeout");
          reject(new Error("timeout"));
        });
    });
  }

  /**
   * Register a callback for when the document is purged
   */
  public onDocumentPurged(callback: () => void) {
    this.purgeCallbacks.push(callback);
  }

  /**
   * Register a callback for channel errors (e.g., unauthorized access)
   */
  public onError(callback: (error: { reason: string }) => void) {
    this.errorCallbacks.push(callback);
  }

  /**
   * Register a callback for when access is revoked (sharing settings changed)
   */
  public onAccessRevoked(callback: (reason: string) => void) {
    this.accessRevokedCallbacks.push(callback);
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