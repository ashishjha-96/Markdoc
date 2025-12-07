# Installation Guide

## Quick Start

### 1. Generate Icons

Open `generate-icons.html` in your browser:

```bash
open chrome-extension/generate-icons.html
```

Click "Download All Icons" and move the downloaded PNG files to the `icons/` folder.

### 2. Load Extension in Chrome

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select the `chrome-extension` folder
5. The extension icon should appear in your toolbar

### 3. Configure Markdoc URL

1. Click the extension icon
2. Set your Markdoc URL:
   - Development: `http://localhost:4000`
   - Production: `https://your-markdoc-domain.com`
3. Settings are automatically saved

## Usage

### Import a Webpage

1. Navigate to any webpage you want to import
2. Click the extension icon
3. Choose options (images, links, metadata)
4. Click "Import" button
5. The page opens in Markdoc with the content imported

### Copy Markdown Only

1. Click the extension icon
2. Choose your options
3. Click "Copy" button
4. Markdown is copied to clipboard

## Verify Integration

Make sure your Markdoc app is running:

```bash
cd frontend
npm run dev
```

The import feature requires:
- Frontend running (React app)
- Backend running (Phoenix server)
- Import bridge initialized (already added to App.tsx)

## Troubleshooting

### Extension not loading
- Check that all files are present in chrome-extension folder
- Verify icons are in the icons/ subfolder
- Check Chrome console for errors

### Import not working
- Verify Markdoc URL is correct and app is running
- Open browser console (F12) and check for errors
- Make sure the URL parameter `?import=true` is present

### Content extraction issues
- Some websites may block content extraction
- Try adjusting content selectors in popup.js
- Check browser console for specific errors

## Development

### Testing Changes

1. Make changes to extension files
2. Go to `chrome://extensions/`
3. Click refresh icon on your extension
4. Test on a webpage

### Debugging

**Popup:**
- Right-click extension icon → "Inspect popup"

**Background Script:**
- Go to chrome://extensions/
- Click "Inspect views: service worker"

**Content Script:**
- Open DevTools on any page
- Check console for messages

## Next Steps

- Customize icon design in generate-icons.html
- Adjust content extraction selectors in popup.js
- Add custom parsing rules for specific websites
- Publish to Chrome Web Store (optional)

