# Markdoc

A **database-free**, **in-memory**, **real-time collaborative document editor** where documents exist only while users are actively collaborating and automatically self-destruct after inactivity.

## What is Markdoc?

Markdoc is an ephemeral collaboration engine that demonstrates how to build real-time collaborative applications without traditional database persistence. Documents live entirely in memory using CRDTs (Conflict-free Replicated Data Types) for conflict-free synchronization across multiple users.

**Key Characteristics:**
- No database - all state exists in memory
- Real-time collaborative editing with instant synchronization
- Automatic cleanup - documents disappear after configurable retention period
- CRDT-based consistency using Y.js
- Built on the BEAM VM for fault tolerance and scalability
- Optional persistence with encryption and compression

## Features

### Editor
- **Block-based Rich Text Editor** - Notion-like editing with BlockNote
- **Real-time Collaboration** - Multiple users editing simultaneously with CRDT-based conflict resolution
- **Live Cursors** - See where other users are editing in real-time
- **User Presence** - See who's currently in the document
- **Syntax Highlighting** - Code blocks with automatic language detection
- **Table of Contents** - Auto-generated navigation from document headings
- **Search** - Document-wide search with real-time results
- **Dark/Light Theme** - Theme toggle with system preference detection
- **Export Options** - Export documents as Markdown or HTML

### Block Types
- **Chat Blocks** - Embedded collaborative chat with typing indicators, reactions, read receipts, and resizable layout (`/chat` command)
- **Mermaid Diagrams** - Interactive flowcharts, sequence diagrams, and more with live preview (`/mermaid` command)
- **Embed Blocks** - Embed content from YouTube, Vimeo, Spotify, CodePen, Figma, Twitter/X, and more (`/embed` command)

### Sharing & Access Control
- **Private Documents** - Restrict access to document owner only
- **Specific People** - Share with up to 50 specific email addresses
- **Authenticated Users** - Allow any authenticated user (via Cloudflare Zero Trust)
- **Public Access** - Anyone with the link can access
- **Real-time Access Revocation** - Users are immediately kicked when access is revoked

### Storage & Security
- **Multiple Storage Backends** - In-memory only, local disk, or S3-compatible storage
- **AES-256-GCM Encryption** - Optional encryption for stored documents
- **Zlib Compression** - Automatic compression to reduce storage size
- **Document Purge** - Owners can permanently delete documents

### Extensions
- **VSCode Extension** - Export files directly from VSCode to markdoc.live
- **Chrome Extension** - Import markdown from browser

## Technologies Used

**Backend:**
- **Elixir 1.18+** / **Erlang/OTP 27+** - Concurrent process model
- **Phoenix Framework** - WebSocket channels and PubSub
- **GenServer** - Document state management
- **Phoenix Presence** - User awareness tracking

**Frontend:**
- **React** + **TypeScript** - UI framework
- **BlockNote** - Block-based rich text editor (Notion-like)
- **Y.js** - CRDT engine for conflict-free merging
- **Phoenix Client** - WebSocket communication

## Quick Setup

### Prerequisites

- Elixir 1.18+ and Erlang/OTP 27+
- Node.js 20+
- npm or yarn

### Installation

1. **Clone and install backend dependencies:**
```bash
git clone <repository-url>
cd markdoc
mix deps.get
mix compile
```

2. **Install frontend dependencies:**
```bash
cd frontend
npm install
cd ..
```

### Running the Application

Start both servers in separate terminals:

**Terminal 1 - Backend:**
```bash
iex -S mix phx.server
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

**Access the application:**
- Frontend: http://localhost:5173
- Backend: http://localhost:4000

Open multiple browser tabs with the same URL to test real-time collaboration.

## Documentation

For detailed information, see the docs directory:

- **[Architecture](docs/arch_doc.md)** - System design and component details
- **[Client-Side Snapshotting](docs/client-side-snapshotting.md)** - Memory optimization strategy
- **[Configuration](docs/configuration.md)** - Customization options
- **[Testing](docs/testing.md)** - Testing strategies and examples
- **[Deployment](docs/deployment.md)** - Production deployment guide
- **[Security](docs/security.md)** - Security considerations and best practices

## Project Structure

```
markdoc/
├── lib/
│   ├── markdoc/
│   │   ├── doc_server.ex       # Document GenServer
│   │   └── doc_supervisor.ex   # Dynamic supervisor
│   └── markdoc_web/
│       └── channels/
│           └── doc_channel.ex  # WebSocket channel
├── frontend/
│   └── src/
│       ├── lib/
│       │   └── PhoenixProvider.ts  # Y.js bridge
│       └── components/
│           └── Editor.tsx          # Main editor
└── docs/                           # Documentation
```

## License

MIT License - Feel free to use and modify

## Acknowledgments

Built with Phoenix Framework, Y.js, BlockNote, and the BEAM VM
