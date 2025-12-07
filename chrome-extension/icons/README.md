# Extension Icons

## Quick Setup

You need PNG icons for the Chrome extension to work. Choose one of these methods:

### Method 1: Use the Icon Generator (Recommended)

1. Open `generate-icons.html` in your browser:
   ```bash
   open ../generate-icons.html
   ```

2. Click "Download All Icons"

3. Move the downloaded PNG files to this folder

### Method 2: Convert SVG to PNG Manually

Use an online tool like:
- https://cloudconvert.com/svg-to-png
- https://convertio.co/svg-png/

Or use ImageMagick (if installed):
```bash
for size in 16 48 128; do
  convert icon$size.svg icon$size.png
done
```

### Method 3: Use Your Own Icons

Replace these files with your own PNG icons:
- icon16.png (16x16 pixels)
- icon48.png (48x48 pixels)  
- icon128.png (128x128 pixels)

## Icon Requirements

- **Format**: PNG with transparency
- **Sizes**: Exactly 16x16, 48x48, and 128x128 pixels
- **Design**: Should be recognizable at small sizes
- **Background**: Transparent or solid color

## Current Status

✓ SVG templates created (icon16.svg, icon48.svg, icon128.svg)
✗ icon16.png
✗ icon48.png
✗ icon128.png
