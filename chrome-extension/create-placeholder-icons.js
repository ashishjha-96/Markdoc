#!/usr/bin/env node

/**
 * Create placeholder icon files for Chrome extension
 * These are minimal SVG-based icons that will work until proper icons are created
 */

const fs = require('fs');
const path = require('path');

// Ensure icons directory exists
const iconsDir = path.join(__dirname, 'icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// Simple SVG icon template
function createSVGIcon(size) {
  return `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#667eea;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#764ba2;stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${size * 0.15}" fill="url(#grad)"/>
  <text x="50%" y="50%" font-family="Arial, sans-serif" font-size="${size * 0.5}" 
        font-weight="bold" fill="white" text-anchor="middle" dominant-baseline="middle">M</text>
  <text x="50%" y="${size * 0.75}" font-family="Arial, sans-serif" font-size="${size * 0.3}" 
        fill="white" text-anchor="middle" dominant-baseline="middle">↓</text>
</svg>`;
}

// For Chrome extensions, we need PNG files, but we'll create placeholder text files
// that instruct the user to generate proper icons
const sizes = [16, 48, 128];

sizes.forEach(size => {
  const svg = createSVGIcon(size);
  const svgPath = path.join(iconsDir, `icon${size}.svg`);
  fs.writeFileSync(svgPath, svg);
  console.log(`✓ Created ${svgPath}`);
});

// Create a README in the icons directory
const readme = `# Extension Icons

## Quick Setup

You need PNG icons for the Chrome extension to work. Choose one of these methods:

### Method 1: Use the Icon Generator (Recommended)

1. Open \`generate-icons.html\` in your browser:
   \`\`\`bash
   open ../generate-icons.html
   \`\`\`

2. Click "Download All Icons"

3. Move the downloaded PNG files to this folder

### Method 2: Convert SVG to PNG Manually

Use an online tool like:
- https://cloudconvert.com/svg-to-png
- https://convertio.co/svg-png/

Or use ImageMagick (if installed):
\`\`\`bash
for size in 16 48 128; do
  convert icon$size.svg icon$size.png
done
\`\`\`

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
${fs.existsSync(path.join(iconsDir, 'icon16.png')) ? '✓' : '✗'} icon16.png
${fs.existsSync(path.join(iconsDir, 'icon48.png')) ? '✓' : '✗'} icon48.png
${fs.existsSync(path.join(iconsDir, 'icon128.png')) ? '✓' : '✗'} icon128.png
`;

fs.writeFileSync(path.join(iconsDir, 'README.md'), readme);
console.log(`✓ Created icons/README.md`);

console.log('\n📝 Next steps:');
console.log('1. Open generate-icons.html in your browser');
console.log('2. Download the PNG icons');
console.log('3. Move them to the icons/ folder');
console.log('\nSee icons/README.md for more options.');

