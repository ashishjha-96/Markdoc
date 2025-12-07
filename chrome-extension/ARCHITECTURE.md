# Chrome Extension Architecture

## Overview

The "Import to Markdown" extension extracts webpage content and imports it into your Markdoc collaborative editor.

## Components

```
┌─────────────────────────────────────────────────────────────┐
│                     Chrome Extension                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │  manifest.   │  │   popup.     │  │  background. │     │
│  │    json      │  │   html/js    │  │      js      │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│        │                  │                   │             │
│        │                  │                   │             │
│  ┌──────────────┐  ┌──────────────────────────────┐       │
│  │  content.js  │  │   Chrome Storage API          │       │
│  └──────────────┘  └──────────────────────────────┘       │
│                                                              │
└─────────────────────────────────────────────────────────────┘
                           │
                           │ Store markdown + open tab
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                     Markdoc App                              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  App.tsx (initImportBridge)                          │  │
│  └──────────────────────────────────────────────────────┘  │
│                           │                                  │
│                           ▼                                  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  importBridge.ts                                     │  │
│  │  - Listen for messages                               │  │
│  │  - Fetch from Chrome storage                         │  │
│  │  - Post markdown back to window                      │  │
│  └──────────────────────────────────────────────────────┘  │
│                           │                                  │
│                           ▼                                  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Editor.tsx                                          │  │
│  │  - Check URL param (?import=true)                    │  │
│  │  - Request import via requestImport()                │  │
│  │  - Receive markdown via onImportMarkdown()           │  │
│  │  - Convert markdown → BlockNote blocks               │  │
│  │  - Insert into editor                                │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Flow Diagram

### Import Flow

```
User clicks extension → Extract content → Convert to markdown
                                             │
                                             ▼
                              Store in Chrome storage (key: import_${docId})
                                             │
                                             ▼
                              Open new tab: markdoc.com/${docId}?import=true
                                             │
                                             ▼
┌────────────────────────────────────────────────────────────────────┐
│                     Markdoc App Loads                              │
├────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  1. App.tsx initializes import bridge                             │
│  2. Editor.tsx detects ?import=true parameter                     │
│  3. Editor calls requestImport(docId)                             │
│  4. importBridge posts message to window                          │
│  5. importBridge checks Chrome storage for import_${docId}        │
│  6. importBridge posts markdown back via message                  │
│  7. Editor receives markdown via onImportMarkdown()               │
│  8. Editor converts markdown → BlockNote blocks                   │
│  9. Editor inserts blocks into document                           │
│ 10. Clean up storage & URL parameter                              │
│                                                                     │
└────────────────────────────────────────────────────────────────────┘
```

### Copy Flow

```
User clicks "Copy" → Extract content → Convert to markdown → Copy to clipboard
```

## File Responsibilities

### Extension Files

| File | Purpose |
|------|---------|
| `manifest.json` | Extension metadata, permissions, and configuration |
| `popup.html` | User interface for the extension popup |
| `popup.js` | Handles user interactions, content extraction, and Chrome API calls |
| `background.js` | Service worker for cleanup tasks |
| `content.js` | Runs on web pages (currently minimal, extraction done via executeScript) |

### Markdoc Files

| File | Purpose |
|------|---------|
| `frontend/src/lib/importBridge.ts` | Communication bridge between extension and app |
| `frontend/src/App.tsx` | Initializes import bridge on mount |
| `frontend/src/components/Editor.tsx` | Handles import flow and markdown insertion |

## Key Functions

### Extension (popup.js)

```javascript
extractContent(options)
  ├─ Find main content (article, main, etc.)
  ├─ Remove unwanted elements (nav, ads, etc.)
  ├─ Convert HTML → Markdown
  │   ├─ Headings: # ## ###
  │   ├─ Lists: - or 1.
  │   ├─ Links: [text](url)
  │   ├─ Images: ![alt](src)
  │   ├─ Code: ``` or `
  │   └─ Formatting: **bold** *italic*
  └─ Add metadata if requested

generateDocId()
  └─ Generate random 21-character ID

Import Button Click:
  ├─ Extract content
  ├─ Generate doc ID
  ├─ Store in chrome.storage.local
  └─ Open new tab with ?import=true
```

### Markdoc App (importBridge.ts)

```typescript
initImportBridge()
  └─ Listen for 'REQUEST_IMPORT' messages
      ├─ Check Chrome storage for import data
      └─ Post 'IMPORT_MARKDOWN' message back

requestImport(docId)
  └─ Post 'REQUEST_IMPORT' message to window

onImportMarkdown(docId, callback)
  ├─ Listen for 'IMPORT_MARKDOWN' messages
  └─ Call callback with markdown
```

### Editor (Editor.tsx)

```typescript
useEffect for import:
  ├─ Check if ?import=true in URL
  ├─ Call requestImport(docId)
  ├─ Listen via onImportMarkdown()
  ├─ Convert markdown → BlockNote blocks
  ├─ Insert blocks into editor
  └─ Clean up URL parameter
```

## Security Considerations

1. **Content Script Permissions**: Minimal - only runs extraction in executeScript
2. **Storage**: Data stored temporarily (max 1 hour, cleaned up)
3. **Cross-Origin**: Uses Chrome storage API which is cross-origin safe
4. **Message Validation**: Checks message types and source

## Data Storage

### Chrome Storage Schema

```typescript
{
  // User settings (chrome.storage.sync)
  "markdocUrl": "http://localhost:4000",
  "includeImages": true,
  "includeLinks": true,
  "includeMetadata": true,
  
  // Temporary import data (chrome.storage.local)
  "import_${docId}": {
    markdown: string,
    timestamp: number,
    sourceUrl: string,
    sourceTitle: string
  }
}
```

## Performance

- **Content Extraction**: Runs once per import (~100-500ms)
- **Markdown Conversion**: Client-side, instant
- **Storage**: Chrome storage API (~10ms read/write)
- **Import**: BlockNote parsing + insertion (~200-500ms)

## Browser Compatibility

| Browser | Status | Notes |
|---------|--------|-------|
| Chrome | ✅ Full | Manifest V3 |
| Edge | ✅ Full | Chromium-based |
| Brave | ✅ Full | Chromium-based |
| Opera | ✅ Full | Chromium-based |
| Firefox | ⚠️ Partial | Needs Manifest V2 modifications |

## Future Enhancements

- [ ] Custom extraction rules per domain
- [ ] Selection-based extraction (import selected text only)
- [ ] Offline queue for when Markdoc is down
- [ ] Direct Y.js update (skip BlockNote conversion)
- [ ] Image upload to S3/CDN (currently just references)
- [ ] PDF export before import
- [ ] Browser action context menu
- [ ] Keyboard shortcut for quick import

