# Architecture Design Document: Ephemeral Real-Time Collaboration Engine

**Status:** Draft
**Stack:** Elixir (Phoenix) + React (BlockNote/Y.js)
**Core Concept:** Database-free, in-memory, real-time collaboration where document state exists only as long as the session remains active.

-----

## 1\. System Overview

### 1.1 High-Level Concept

The system provides a "Notion-like" block editor where multiple users can edit a document simultaneously. The architecture is **Local-First** but **Server-Relayed**.

  * **Local-First:** The editor (BlockNote/Y.js) runs in the browser and holds a local copy of the data.
  * **Server-Relayed:** An Elixir backend acts as the central message bus and temporary storage, holding the "source of truth" in RAM.
  * **Ephemeral:** When the last user disconnects and a timeout expires, the backend process terminates, and the data is permanently erased.

### 1.2 The Stack

| Component | Technology | Role |
| :--- | :--- | :--- |
| **Frontend UI** | **React + BlockNote** | Provides the rich-text, block-based UI (Notion clone). |
| **State Engine** | **Y.js** | Handles CRDT (Conflict-free Replicated Data Types) logic. |
| **Sync Protocol** | **Phoenix Channels** | WebSocket transport for binary sync updates. |
| **Backend Runtime** | **Elixir (BEAM)** | Manages concurrent document processes. |
| **Storage** | **GenServer (RAM)** | Holds document history in memory (No Database). |
| **Discovery** | **Phoenix PubSub** | Allows scaling across multiple nodes/servers. |

-----

## 2\. Backend Architecture (Elixir/Phoenix)

The backend avoids the traditional Request/Response cycle. Instead, it uses the **Actor Model**. Every active document is its own tiny "server" (Process).

### 2.1 The Supervisor Tree

We utilize a `DynamicSupervisor` to spawn a new process for every unique `doc_id`.

```mermaid
graph TD
    A[Application Supervisor] --> B[Phoenix Endpoint]
    A --> C[DocSupervisor (DynamicSupervisor)]
    A --> D[Registry (PubSub/Naming)]
    C --> E[DocProcess (ID: "meeting-notes")]
    C --> F[DocProcess (ID: "shopping-list")]
```

### 2.2 The Document Process (`GenServer`)

This is the heart of the ephemeral logic.

  * **Identity:** Registered via `Registry` using `{via, Registry, {MyApp.DocRegistry, doc_id}}`.
  * **State:**
    ```elixir
    %{
      history: [binary()],  # List of Y.js update blobs
      users: MapSet,        # Track connected PIDs
      timer: reference()    # Countdown to self-destruction
    }
    ```
  * **Lifecycle:**
    1.  **Spawn:** Created when the first user joins a channel `doc:123`.
    2.  **Active:** Appends incoming binary blobs to `history`.
    3.  **Idle:** If `users` is empty, starts a standard timeout (e.g., 15 minutes).
    4.  **Death:** If timeout triggers, the GenServer returns `{:stop, :normal, state}` and data is reclaimed by GC.

### 2.3 Presence (Awareness)

Instead of handling user cursors and names inside the Y.js binary stream, we use **Phoenix Presence**.

  * **Why:** Presence is CRDT-based under the hood but optimized for "heartbeat" metadata (online status, mouse position).
  * **Implementation:** The Channel tracks the socket. When `cursor_pos` changes, the client pushes a message, and the Channel updates the Presence metadata.

-----

## 3\. Frontend Architecture

### 3.1 The Custom Provider (`PhoenixProvider`)

Since Y.js does not have a native Phoenix adapter, we implement a bridge pattern.

  * **Responsibility:**
    1.  Buffer Y.js updates.
    2.  Convert `Uint8Array` $\leftrightarrow$ `Array<Int>` (for JSON transport) or `Base64`.
    3.  Handle the "Initial Sync" merging logic.

### 3.2 BlockNote Integration

BlockNote sits on top of ProseMirror.

  * **Structure:** We do not save HTML. We save the Y.js **XmlFragment**.
  * **Rendering:** BlockNote observes the Y.js fragments. When the backend pushes a binary update, Y.js applies it, and BlockNote re-renders only the changed block.

-----

## 4\. Synchronization Protocol

This defines the specific messages sent over the WebSocket (Phoenix Channel).

### 4.1 Join Sequence

1.  **Client** $\rightarrow$ **Server**: `join("doc:123")`
2.  **Server**:
      * Checks `Registry` for `doc:123`.
      * If missing $\rightarrow$ `DocSupervisor.start_child(...)`.
      * Fetches `history` from GenServer.
3.  **Server** $\rightarrow$ **Client**: `phx_reply: {:ok, %{history: [blob1, blob2...]}}`
4.  **Client**:
      * Runs `Y.mergeUpdates(history)`.
      * Applies single merged update to local Doc.

### 4.2 Update Loop (Typing)

1.  **Client A** types.
2.  **Client A** $\rightarrow$ **Server**: `push("client_update", %{bin: [1, 24, 255...]})`
3.  **Server (Channel)**:
      * Sends `bin` to GenServer (to append to history).
      * Broadcasts to `doc:123` topic.
4.  **Server** $\rightarrow$ **Client B**: `broadcast("server_update", %{bin: [1, 24, 255...]})`
5.  **Client B**: `Y.applyUpdate(doc, bin)`

-----

## 5\. Scaling & Limitations

### 5.1 Horizontal Scaling

Because we use **Phoenix PubSub**, this architecture scales across multiple nodes automatically.

  * *Scenario:* Client A connects to Server 1. Client B connects to Server 2.
  * *Flow:* Client A pushes update $\rightarrow$ Server 1 $\rightarrow$ PubSub $\rightarrow$ Server 2 $\rightarrow$ Client B.
  * *State Constraint:* The `GenServer` (Document Store) lives on *one* node (where it was first created). Other nodes route data to it. Ideally, you use a "hash ring" or simply rely on global registry lookup to ensure updates reach the holder of the truth.

### 5.2 Memory Considerations

Since this is an in-memory store:

  * **Bottleneck:** RAM.
  * **Mitigation:**
    1.  **Max History Size:** If a document history exceeds X MB, force a "Snapshot" (merge all updates into one blob) to release memory.
    2.  **Strict Timeouts:** Kill idle documents aggressively.

-----

## 6\. Implementation Roadmap

### Phase 1: The Foundation

1.  Setup Phoenix Project with no Ecto (database).
2.  Create the `DocServer` (GenServer) with basic list-based history.
3.  Implement `DocChannel` with Join/Broadcast logic.

### Phase 2: The Frontend Bridge

1.  Install `@blocknote/react` and `yjs`.
2.  Build `PhoenixProvider.ts` (as defined in previous chat).
3.  Verify that two tabs sync text.

### Phase 3: Polish & Awareness

1.  Add `Phoenix.Presence` to the channel.
2.  Map Presence state to BlockNote cursor UI (colors/names).
3.  Implement the "Cleanup" timer in the GenServer to handle ephemeral deletion.

-----

## 7\. Security Considerations

Even though data is ephemeral, security matters.

1.  **Socket Authentication:** Use Phoenix Tokens to verify user identity on WebSocket connect.
2.  **Payload Validation:** Ensure incoming `bin` payloads are strictly byte arrays to prevent injection attacks (though Y.js is generally resilient, the server should validate types).
3.  **Rate Limiting:** Prevent a malicious client from flooding the channel with updates, filling up the Server RAM.