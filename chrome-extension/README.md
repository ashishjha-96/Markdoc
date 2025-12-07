# Import to Markdown - Chrome Extension

A Chrome extension that extracts webpage content and imports it directly into your Markdoc collaborative editor.

## Features

- 🎯 **Smart Content Extraction**: Automatically identifies and extracts the main content from any webpage
- 📝 **HTML to Markdown**: Converts HTML content to clean, readable markdown
- 🔗 **Direct Import**: Opens extracted content directly in Markdoc editor
- 📋 **Copy to Clipboard**: Option to just copy the markdown without importing
- ⚙️ **Customizable**: Choose what to include (images, links, metadata)
- 🎨 **Beautiful UI**: Modern, gradient-based popup interface

## Installation

### Development Mode

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" in the top right
3. Click "Load unpacked"
4. Select the `chrome-extension` folder from your markdoc project
5. The extension icon should appear in your toolbar

### Production Build

1. Create icons for the extension (16x16, 48x48, 128x128 PNG files)
2. Place them in the `icons/` folder
3. Zip the extension folder
4. Upload to Chrome Web Store (optional)

## Usage

1. **Navigate** to any webpage you want to import
2. **Click** the extension icon in your toolbar
3. **Configure** options:
   - Set your Markdoc URL (default: `http://localhost:4000`)
   - Choose whether to include images, links, and metadata
4. **Choose** an action:
   - **Copy**: Copy markdown to clipboard
   - **Import**: Open directly in Markdoc

## How It Works

### Content Extraction

The extension uses smart selectors to find the main content:
1. Tries common article containers (`<article>`, `<main>`, etc.)
2. Removes navigation, ads, and other unwanted elements
3. Converts HTML to clean markdown

### Import Flow

1. Extract content from current page
2. Generate a unique document ID
3. Store markdown temporarily in Chrome storage
4. Open new tab with Markdoc URL + document ID
5. Markdoc app checks for pending import and loads content

## Configuration

### Options

- **Markdoc URL**: The base URL of your Markdoc instance
  - Default: `http://localhost:4000`
  - For production: `https://your-markdoc.com`

- **Include Images**: Extract and include image references
- **Include Links**: Preserve hyperlinks in markdown
- **Include Metadata**: Add page title, URL, and import date

### Storage

Settings are automatically saved using Chrome's sync storage, so they persist across sessions and sync across devices.

## Markdoc Integration

To enable the import feature in your Markdoc application, you need to add import handling to the editor component.

### 1. Add Import Handler to Editor

Add this code to `frontend/src/components/Editor.tsx`:

```typescript
// Add after the editor is created and provider is ready
useEffect(() => {
  if (!editor || !provider) return;
  
  // Check for import parameter in URL
  const urlParams = new URLSearchParams(window.location.search);
  const shouldImport = urlParams.get('import') === 'true';
  
  if (shouldImport) {
    // Request markdown from extension
    window.postMessage({ type: 'REQUEST_IMPORT', docId }, '*');
    
    // Listen for markdown response
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === 'IMPORT_MARKDOWN' && event.data.docId === docId) {
        const markdown = event.data.markdown;
        
        // Convert markdown to BlockNote blocks and insert
        editor.tryParseMarkdownToBlocks(markdown).then(blocks => {
          editor.replaceBlocks(editor.document, blocks);
        });
        
        // Clean up URL parameter
        window.history.replaceState({}, '', `/${docId}`);
      }
    };
    
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }
}, [editor, provider, docId]);
```

### 2. Add Import Bridge Script

Create `frontend/src/lib/importBridge.ts`:

```typescript
// Bridge between Chrome extension and Markdoc app
export function initImportBridge() {
  window.addEventListener('message', async (event) => {
    if (event.data.type === 'REQUEST_IMPORT') {
      const docId = event.data.docId;
      
      // Try to get markdown from Chrome extension storage
      try {
        if (typeof chrome !== 'undefined' && chrome.storage) {
          const key = `import_${docId}`;
          const result = await chrome.storage.local.get(key);
          
          if (result[key]) {
            const { markdown } = result[key];
            
            // Send markdown back to the page
            window.postMessage({
              type: 'IMPORT_MARKDOWN',
              docId,
              markdown,
            }, '*');
            
            // Clean up storage
            await chrome.storage.local.remove(key);
          }
        }
      } catch (error) {
        console.error('Failed to retrieve import data:', error);
      }
    }
  });
}
```

Then call `initImportBridge()` in your main App component.

## File Structure

```
chrome-extension/
├── manifest.json          # Extension configuration
├── popup.html            # Extension popup UI
├── popup.js              # Popup logic and handlers
├── background.js         # Background service worker
├── content.js            # Content script (runs on pages)
├── icons/                # Extension icons (16, 48, 128)
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── README.md            # This file
```

## Development

### Testing

1. Make changes to the extension files
2. Go to `chrome://extensions/`
3. Click the refresh icon on your extension
4. Test on a webpage

### Debugging

- **Popup**: Right-click extension icon → "Inspect popup"
- **Background**: chrome://extensions/ → Extension details → "Inspect views: service worker"
- **Content Script**: Open DevTools on any page and check console

## Permissions

The extension requires these permissions:

- `activeTab`: Access current tab content
- `scripting`: Inject content extraction script
- `storage`: Store settings and temporary import data

## Browser Compatibility

- Chrome: ✅ Full support (Manifest V3)
- Edge: ✅ Full support (Chromium-based)
- Brave: ✅ Full support
- Opera: ✅ Full support
- Firefox: ⚠️ Requires Manifest V2 modifications

## Troubleshooting

### Extension not appearing
- Check that developer mode is enabled
- Reload the extension
- Check for errors in chrome://extensions/

### Import not working
- Verify Markdoc URL is correct
- Check that Markdoc app is running
- Check browser console for errors
- Ensure import bridge is initialized in Markdoc

### Content extraction issues
- Some sites use complex layouts that may not extract well
- Try adjusting the content selectors in `popup.js`
- Report specific sites that don't work well

## Contributing

Contributions welcome! Please:

1. Test thoroughly across different websites
2. Maintain the existing code style
3. Update README with any new features
4. Consider edge cases (dynamic content, SPAs, etc.)

## License

MIT License - feel free to modify and distribute.

## Credits

Built for Markdoc collaborative editor.

