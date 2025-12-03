# Configuration Guide

This document covers all configuration options available in Markdoc.

## Backend Configuration

### Snapshot Threshold

Controls how many updates trigger a client-side snapshot to compress memory.

**Location:** `lib/markdoc/doc_server.ex`

```elixir
@snapshot_threshold 50  # Trigger snapshot after 50 updates
```

**Impact:**
- Lower values = More frequent snapshots, better memory usage, more overhead
- Higher values = Fewer snapshots, more memory usage initially, less overhead

### Cleanup Timeout

Duration of inactivity before a document is automatically deleted.

**Location:** `lib/markdoc/doc_server.ex`

```elixir
@cleanup_timeout :timer.hours(1)  # 1 hour idle timeout
```

**Common Values:**
```elixir
:timer.minutes(15)  # 15 minutes
:timer.minutes(30)  # 30 minutes
:timer.hours(1)     # 1 hour (default)
:timer.hours(24)    # 24 hours
```

## Frontend Configuration

### WebSocket URL

Configure the backend WebSocket endpoint.

**Location:** `frontend/src/lib/PhoenixProvider.ts`

```typescript
constructor(docId: string, doc: Y.Doc, wsUrl: string = "ws://localhost:4000/socket")
```

**Production Example:**
```typescript
const wsUrl = import.meta.env.PROD
  ? "wss://markdoc.example.com/socket"
  : "ws://localhost:4000/socket";
```

### Development Server Port

**Location:** `frontend/vite.config.ts`

```typescript
export default defineConfig({
  server: {
    port: 5173  // Change frontend dev server port
  }
})
```

## Environment Variables

### Backend

Create a `.env` file or set system environment variables:

```bash
# Server Configuration
PHX_HOST="localhost"
PORT=4000

# Security
SECRET_KEY_BASE="your-secret-key-base"  # Generate with: mix phx.gen.secret

# Development
MIX_ENV="dev"
```

### Frontend

Create `frontend/.env`:

```bash
# API Configuration
VITE_WS_URL="ws://localhost:4000/socket"

# Feature Flags (if needed)
VITE_ENABLE_DEBUG=true
```

## Phoenix Configuration

### Endpoint Configuration

**Location:** `config/config.exs`

```elixir
config :markdoc, MarkdocWeb.Endpoint,
  url: [host: "localhost"],
  adapter: Phoenix.Endpoint.Cowboy2Adapter,
  render_errors: [
    formats: [json: MarkdocWeb.ErrorJSON],
    layout: false
  ],
  pubsub_server: Markdoc.PubSub,
  live_view: [signing_salt: "your-signing-salt"]
```

### CORS Configuration

If your frontend is on a different domain, configure CORS in `lib/markdoc_web/endpoint.ex`:

```elixir
plug Corsica,
  origins: ["http://localhost:5173", "https://yourdomain.com"],
  allow_headers: ["content-type"],
  allow_methods: ["GET", "POST"]
```

## Monitoring Configuration

### Logger Configuration

**Location:** `config/config.exs`

```elixir
config :logger, :console,
  format: "$time $metadata[$level] $message\n",
  metadata: [:request_id, :doc_id]
```

### Telemetry

Add custom metrics in `lib/markdoc/application.ex`:

```elixir
# Track active documents
:telemetry.attach(
  "document-count",
  [:markdoc, :documents, :active],
  &MyApp.Telemetry.handle_event/4,
  nil
)
```

## Performance Tuning

### BEAM VM Options

Start the application with custom VM flags:

```bash
# Increase max processes
elixir --erl "+P 1000000" -S mix phx.server

# Adjust memory allocation
elixir --erl "+MBas aobf +MBlmbcs 512 +MBsbct 75" -S mix phx.server
```

### Process Pool Limits

**Location:** `config/config.exs`

```elixir
config :markdoc, Markdoc.DocSupervisor,
  max_children: 10000,  # Maximum concurrent documents
  strategy: :one_for_one
```

## Development vs Production

### Development

**Location:** `config/dev.exs`

```elixir
config :markdoc, MarkdocWeb.Endpoint,
  http: [ip: {127, 0, 0, 1}, port: 4000],
  debug_errors: true,
  code_reloader: true,
  check_origin: false
```

### Production

**Location:** `config/runtime.exs`

```elixir
config :markdoc, MarkdocWeb.Endpoint,
  url: [host: System.get_env("PHX_HOST"), port: 443, scheme: "https"],
  http: [
    ip: {0, 0, 0, 0},
    port: String.to_integer(System.get_env("PORT") || "4000")
  ],
  secret_key_base: System.get_env("SECRET_KEY_BASE"),
  check_origin: ["https://yourdomain.com"]
```
