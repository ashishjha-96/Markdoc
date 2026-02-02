# Markdoc Export - VSCode Extension

Export markdown and code files directly to [markdoc.live](https://markdoc.live) for collaborative editing.

## Features

- **Export File**: Send any file to markdoc.live with one click
- **Export Selection**: Send only the selected text to markdoc.live
- **Smart Formatting**:
  - Markdown files are exported as-is
  - Code files are wrapped in syntax-highlighted code blocks
- **Automatic Browser Launch**: Opens your browser to the new document

## Usage

### Export Entire File

1. **From File Explorer**: Right-click a file → "Export File to Markdoc.live"
2. **From Editor**: Right-click in editor (with no selection) → "Export File to Markdoc.live"
3. **From Command Palette**: `Ctrl+Shift+P` → "Export File to Markdoc.live"

### Export Selection

1. **From Editor**: Select text → Right-click → "Export Selection to Markdoc.live"
2. **From Command Palette**: Select text → `Ctrl+Shift+P` → "Export Selection to Markdoc.live"

## Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| `markdoc.serverUrl` | `https://markdoc.live` | The Markdoc server URL |

## Supported File Types

### Exported as Markdown
- `.md`, `.markdown`, `.mdx`

### Wrapped in Code Blocks (with syntax highlighting)
- **JavaScript/TypeScript**: `.js`, `.jsx`, `.ts`, `.tsx`
- **Web**: `.html`, `.css`, `.scss`, `.vue`, `.svelte`
- **Python**: `.py`
- **Systems**: `.c`, `.cpp`, `.rs`, `.go`
- **JVM**: `.java`, `.kt`, `.scala`
- **.NET**: `.cs`, `.fs`
- **Scripting**: `.rb`, `.php`, `.lua`
- **Shell**: `.sh`, `.bash`, `.zsh`, `.ps1`
- **Config**: `.json`, `.yaml`, `.toml`, `.xml`
- **Elixir**: `.ex`, `.exs`
- And many more...

## Development

### Prerequisites

- Node.js 18+
- npm or yarn

### Build

```bash
cd vscode-extension
npm install
npm run compile
```

### Package

```bash
npm run package
```

This creates a `.vsix` file that can be installed in VSCode.

### Install from VSIX

**Option 1: Using the GUI**

1. Open VSCode
2. Go to Extensions (`Ctrl+Shift+X`)
3. Click the "..." menu → "Install from VSIX..."
4. Select the `.vsix` file

**Option 2: Using CLI**

```bash
# VSCode
code --install-extension markdoc-export-0.1.0.vsix

# Cursor
cursor --install-extension markdoc-export-0.1.0.vsix

# VSCodium
codium --install-extension markdoc-export-0.1.0.vsix
```

## How It Works

1. Extension reads file content (or selection)
2. For non-markdown files, wraps content in a code fence with language hint
3. POSTs markdown to `https://markdoc.live/api/import`
4. Server returns a unique document URL
5. Extension opens the URL in your default browser
6. Markdoc.live loads the content for collaborative editing

## License

MIT
