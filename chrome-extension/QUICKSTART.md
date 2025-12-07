# Quick Start Guide

Get the "Import to Markdown" Chrome extension up and running in 5 minutes!

## Prerequisites

- Google Chrome or Chromium-based browser (Edge, Brave, Opera)
- Markdoc app running locally or deployed

## Installation Steps

### Step 1: Generate Icons ⏱️ 2 minutes

**Option A: Use the HTML Generator (Easiest)**

```bash
# From the chrome-extension directory
open generate-icons.html
```

Click "Download All Icons" and the three PNG files will be downloaded. Move them to the `icons/` folder.

**Option B: Use the SVG Templates**

SVG templates are already created in `icons/`. Convert them to PNG using:
- Online tool: https://cloudconvert.com/svg-to-png
- ImageMagick: `convert icon48.svg icon48.png`

### Step 2: Load Extension in Chrome ⏱️ 1 minute

1. Open Chrome and go to `chrome://extensions/`
2. Toggle "Developer mode" ON (top right)
3. Click "Load unpacked" button
4. Navigate to and select the `chrome-extension` folder
5. ✅ Extension loaded! Icon should appear in toolbar

### Step 3: Configure Markdoc URL ⏱️ 30 seconds

1. Click the extension icon (📝)
2. Set your Markdoc URL:
   - **Local dev**: `http://localhost:4000`
   - **Production**: `https://your-domain.com`
3. Settings auto-save ✨

### Step 4: Test It! ⏱️ 1 minute

1. Navigate to any article or blog post (try Wikipedia!)
2. Click the extension icon
3. Click "Import" button
4. Watch as it opens in Markdoc with content imported! 🎉

## Usage Examples

### Example 1: Import a Blog Post

```
1. Visit: https://example.com/blog/great-article
2. Click extension icon
3. Enable options: ✓ Images ✓ Links ✓ Metadata
4. Click "Import"
5. Result: New Markdoc document with full article content
```

### Example 2: Copy Markdown Only

```
1. Visit any webpage
2. Click extension icon  
3. Click "Copy"
4. Paste anywhere (Slack, Discord, GitHub, etc.)
```

### Example 3: Import Selected Content

```
Coming soon! For now, imports the main content area.
```

## Keyboard Shortcuts

Currently, you need to click the extension icon. Future versions may add:
- `Ctrl+Shift+M` - Quick import
- `Ctrl+Shift+C` - Copy markdown

## Troubleshooting

### ❌ Extension won't load

**Problem**: Chrome shows error when loading extension

**Solutions**:
- Ensure icons exist: `ls icons/*.png` should show 3 files
- Check manifest.json is valid (no syntax errors)
- Reload: chrome://extensions/ → click reload icon

### ❌ Import button does nothing

**Problem**: Clicking "Import" doesn't open Markdoc

**Solutions**:
- Verify Markdoc URL is correct and app is running
- Check browser console (F12) for errors
- Ensure popup blocker isn't blocking the new tab

### ❌ Content not appearing in Markdoc

**Problem**: Markdoc opens but document is empty

**Solutions**:
- Check that import bridge is initialized (should see console log: "📥 Import bridge initialized")
- Verify URL contains `?import=true` parameter
- Check browser console for import errors
- Ensure Chrome storage permissions are granted

### ❌ Poor content extraction

**Problem**: Extracted content has too much junk or missing content

**Solutions**:
- Some sites are harder to parse than others
- Try adjusting selectors in `popup.js` (advanced)
- Report the problematic site as an issue

## Configuration Options

### Include Images
- ✅ ON: Image references preserved as markdown `![alt](url)`
- ❌ OFF: Images stripped from content

### Include Links  
- ✅ ON: Links preserved as markdown `[text](url)`
- ❌ OFF: Link text preserved but URLs removed

### Include Metadata
- ✅ ON: Adds header with page title, source URL, import date
- ❌ OFF: Just the content

### Markdoc URL
- Must include protocol: `http://` or `https://`
- No trailing slash: ✅ `http://localhost:4000` ❌ `http://localhost:4000/`
- Default: `http://localhost:4000`

## Testing Checklist

Before using in production, test these scenarios:

- [ ] Import from Wikipedia article
- [ ] Import from Medium blog post  
- [ ] Import from GitHub README
- [ ] Import with images enabled/disabled
- [ ] Import with links enabled/disabled
- [ ] Import with metadata enabled/disabled
- [ ] Copy to clipboard functionality
- [ ] Multiple imports in quick succession
- [ ] Import while Markdoc already has content

## Best Practices

### ✅ Do's

- ✅ Test on a variety of websites
- ✅ Use descriptive document titles after import
- ✅ Verify content before saving important imports
- ✅ Keep extension updated
- ✅ Report bugs and suggest improvements

### ❌ Don'ts

- ❌ Don't rely on perfect extraction for all sites
- ❌ Don't import copyrighted content without permission
- ❌ Don't use on password-protected pages (won't work)
- ❌ Don't expect images to be uploaded (only referenced)

## Advanced Usage

### Custom Content Selectors

Edit `popup.js` and modify the selectors array:

```javascript
const selectors = [
  'article',           // Most article pages
  'main',              // Semantic main content
  '[role="main"]',     // ARIA main role
  '.post-content',     // Common blog class
  '.article-content',  // Another common class
  // Add your custom selectors here
];
```

### Domain-Specific Rules

Add custom handling for specific domains in `extractContent()`:

```javascript
function extractContent(options) {
  const domain = window.location.hostname;
  
  if (domain.includes('github.com')) {
    // Custom GitHub extraction
  } else if (domain.includes('stackoverflow.com')) {
    // Custom StackOverflow extraction
  }
  
  // Default extraction
  // ...
}
```

## What's Next?

Now that you have the extension working:

1. **Try it on different sites** - See what works well
2. **Customize options** - Find your preferred settings
3. **Share feedback** - Report issues or suggest features
4. **Explore the code** - Learn how it works
5. **Contribute** - Submit improvements!

## Getting Help

- 📖 Read: `README.md` for full documentation
- 🏗️ Read: `ARCHITECTURE.md` for technical details
- 🔧 Check: Browser console for error messages
- 💬 Ask: Open an issue on GitHub (if applicable)

## Next Steps

Want to go further?

- [ ] Customize the icon design
- [ ] Add support for Firefox (requires Manifest V2)
- [ ] Implement selection-based import
- [ ] Add image upload to S3/CDN
- [ ] Create browser action context menu
- [ ] Add keyboard shortcuts
- [ ] Publish to Chrome Web Store

Enjoy importing! 📝✨

