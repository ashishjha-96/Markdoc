# Markdoc

A **database-free**, **in-memory**, **real-time collaborative document editor** where documents exist only while users are actively collaborating and automatically self-destruct after inactivity.

## What is Markdoc?

Markdoc is an ephemeral collaboration engine that demonstrates how to build real-time collaborative applications without traditional database persistence. Documents live entirely in memory using CRDTs (Conflict-free Replicated Data Types) for conflict-free synchronization across multiple users.

**Key Characteristics:**
- No database - all state exists in memory
- Real-time collaborative editing with instant synchronization
- Automatic cleanup - documents disappear after 1 hour of inactivity
- CRDT-based consistency using Y.js
- Built on the BEAM VM for fault tolerance and scalability

## Features

- **Block-based Rich Text Editor** - Notion-like editing with BlockNote
- **Real-time Collaboration** - Multiple users editing simultaneously with CRDT-based conflict resolution
- **Live Cursors** - See where other users are editing in real-time
- **User Presence** - See who's currently in the document
- **Chat Blocks** - Embedded chat discussions with typing indicators, reactions, read receipts, and resizable layout (use `/chat` command)
- **Syntax Highlighting** - Code blocks with language-specific syntax highlighting
- **Export Options** - Export documents as Markdown or HTML

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
