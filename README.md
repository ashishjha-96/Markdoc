# Markdoc - Ephemeral Real-Time Collaboration Engine

A **database-free**, **in-memory**, **real-time collaborative document editor** built with Elixir/Phoenix and React. Documents exist only while users are actively collaborating and automatically self-destruct after inactivity.

## 🌟 Features

- **Real-Time Collaboration**: Multiple users can edit documents simultaneously with instant synchronization
- **Ephemeral Architecture**: No database - all state lives in memory and disappears when idle
- **CRDT-Based**: Conflict-free replicated data types (Y.js) ensure consistency
- **Memory Efficient**: Client-side snapshotting automatically compresses document history
- **User Awareness**: See who's online with colored indicators
- **Scalable**: Built on BEAM/OTP with Phoenix PubSub for horizontal scaling
- **Block-Based Editor**: Notion-like editing experience powered by BlockNote

## 🏗️ Architecture

### Backend (Elixir/Phoenix)
- **Phoenix Channels**: WebSocket transport for real-time sync
- **GenServer per Document**: Each active document is a lightweight process
- **DynamicSupervisor**: Spawns document processes on-demand
- **Phoenix Presence**: Tracks online users with CRDT-based state
- **Registry**: Process naming and discovery
- **Automatic Cleanup**: Documents terminate after 1 hour of inactivity

### Frontend (React/TypeScript)
- **BlockNote**: Rich block-based editor
- **Y.js**: CRDT engine for conflict-free merging
- **Phoenix Client**: WebSocket communication
- **Custom Provider**: Bridges Y.js and Phoenix Channels

### Data Flow
1. User joins document → Backend spawns GenServer if needed
2. User types → Y.js creates update → Sent to server via WebSocket
3. Server broadcasts update → Other clients apply via Y.js
4. After 50 updates → Server requests snapshot → Client compresses & sends back
5. Last user leaves → 1-hour timer starts → Process terminates

## 📋 Prerequisites

- **Elixir** 1.18+ and **Erlang/OTP** 27+
- **Node.js** 20+
- **npm** or **yarn**

## 🚀 Quick Start

### 1. Install Dependencies

**Backend:**
```bash
mix deps.get
mix compile
```

**Frontend:**
```bash
cd frontend
npm install
cd ..
```

### 2. Start Development Servers

**Terminal 1 - Backend:**
```bash
iex -S mix phx.server
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

### 3. Open in Browser

- Frontend: http://localhost:5173
- Backend: http://localhost:4000

To collaborate on the same document, open **multiple browser tabs** with the same URL.

## 📂 Project Structure

```
markdoc/
├── lib/
│   ├── markdoc/
│   │   ├── application.ex          # Supervision tree
│   │   ├── doc_registry.ex         # Process registry wrapper
│   │   ├── doc_supervisor.ex       # Dynamic supervisor
│   │   └── doc_server.ex           # Document GenServer ⭐
│   └── markdoc_web/
│       ├── channels/
│       │   ├── user_socket.ex      # WebSocket handler
│       │   ├── doc_channel.ex      # Document channel ⭐
│       │   └── presence.ex         # Presence tracking
│       ├── endpoint.ex             # Phoenix endpoint
│       └── router.ex               # HTTP routes
├── frontend/
│   └── src/
│       ├── lib/
│       │   └── PhoenixProvider.ts  # Y.js ↔ Phoenix bridge ⭐
│       ├── components/
│       │   ├── Editor.tsx          # Main editor component ⭐
│       │   ├── UserPresence.tsx    # Online users indicator
│       │   └── ConnectionStatus.tsx # WebSocket status
│       ├── hooks/
│       │   └── usePresence.ts      # Presence hook
│       └── App.tsx                 # Root component
└── docs/
    ├── arch_doc.md                 # Architecture documentation
    └── client-side-snapshotting.md # Snapshotting strategy
```

## 🔧 Configuration

### Change Snapshot Threshold

Edit `lib/markdoc/doc_server.ex`:
```elixir
@snapshot_threshold 50  # Trigger snapshot after 50 updates
```

### Change Cleanup Timeout

Edit `lib/markdoc/doc_server.ex`:
```elixir
@cleanup_timeout :timer.hours(1)  # 1 hour idle timeout
```

### Change WebSocket URL

Edit `frontend/src/lib/PhoenixProvider.ts`:
```typescript
constructor(docId: string, doc: Y.Doc, wsUrl: string = "ws://localhost:4000/socket")
```

## 🧪 Testing

### Manual Testing

1. **Basic Sync**: Open same doc in 2 tabs, type in one, see in other
2. **Persistence**: Refresh a tab, content persists (loaded from history)
3. **Snapshotting**: Type 50+ updates, check console for snapshot messages
4. **Presence**: Open 3 tabs, verify user count and colored indicators
5. **Cleanup**: Close all tabs, wait 1 hour, reopen → doc is gone

### Backend Unit Tests

```bash
mix test
```

### Backend Interactive Testing

```bash
iex -S mix phx.server

# In IEx console:
:observer.start()  # Watch processes and memory
Markdoc.DocSupervisor.count_documents()  # Count active docs
```

## 📊 Monitoring

### View Active Documents

```elixir
# In IEx
Markdoc.DocSupervisor.count_documents()
Markdoc.DocSupervisor.list_documents()
```

### Memory Usage

```elixir
:observer.start()  # GUI with process tree and memory stats
```

### Logs

All document lifecycle events are logged:
- Document spawned
- User joined/left
- Snapshot triggered
- Document terminated

## 🔍 How It Works

### Join Sequence
```
Client                          Server                          GenServer
  |                               |                                |
  |--join("doc:123")------------->|                                |
  |                               |--start_doc("doc:123")--------->|
  |                               |<--{:ok, pid}-------------------|
  |                               |--DocServer.join(pid, self())-->|
  |                               |--DocServer.get_history(pid)--->|
  |                               |<--[blob1, blob2]---------------|
  |<--{:ok, %{history: [...]}}----|                                |
  |                               |                                |
  | Y.mergeUpdates([blob1, blob2])                                 |
  | Y.applyUpdate(doc, merged)                                     |
```

### Update Loop
```
Client A         Server          Client B
  |                |                |
  | types "a"      |                |
  | Y.js update    |                |
  |--update------->|                |
  |                |--broadcast---->|
  |                |                | Y.applyUpdate()
  |                |                | sees "a"
```

### Snapshot Protocol
```
Server (after 50 updates)          Client
  |                                   |
  |--request_snapshot---------------->|
  |                                   | Y.encodeStateAsUpdate(doc)
  |<--snapshot (compressed)-----------|
  |                                   |
  | Replace [50 blobs] with [1 blob]  |
```

## 🚢 Production Deployment

### Environment Variables

```bash
export SECRET_KEY_BASE="..."  # Generate with: mix phx.gen.secret
export PHX_HOST="markdoc.example.com"
export PORT=4000
```

### Build Release

```bash
# Backend
MIX_ENV=prod mix release

# Frontend
cd frontend
npm run build
```

### Docker (Optional)

```dockerfile
FROM elixir:1.18-alpine AS builder
# ... build steps ...

FROM node:20-alpine AS frontend
# ... frontend build ...

FROM alpine:3.18
# ... runtime ...
```

## ⚠️ Limitations

- **Data is NOT persistent** - Documents disappear after inactivity
- **Memory-bound** - Large documents or many concurrent users consume RAM
- **Single-node state** - DocServer processes live on one node (can be distributed with `global` or `Horde`)
- **No authentication** - WebSocket connections are currently public
- **No permissions** - All users have full edit access

## 🛡️ Security Considerations

### Recommended for Production

1. **Token Authentication**: Add JWT validation in `UserSocket.connect/3`
2. **Rate Limiting**: Limit update frequency per connection
3. **Payload Validation**: Enforce max binary size in channels
4. **CORS Configuration**: Restrict allowed origins
5. **HTTPS/WSS**: Use TLS in production

## 📖 Documentation

- [Architecture Design Document](docs/arch_doc.md)
- [Client-Side Snapshotting Strategy](docs/client-side-snapshotting.md)

## 🤝 Contributing

This is a proof-of-concept implementation demonstrating:
- Ephemeral data architecture
- CRDT-based real-time sync
- Actor model for concurrency
- Client-side optimization strategies

## 📄 License

MIT License - Feel free to use and modify

## 🙏 Acknowledgments

- **Phoenix Framework**: Real-time capabilities and channels
- **Y.js**: CRDT implementation
- **BlockNote**: Block-based editor
- **BEAM/OTP**: Supervision trees and process isolation
