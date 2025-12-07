#!/usr/bin/env node

/**
 * Generate PNG icons for Chrome extension using node-canvas
 * Run: node generate-png-icons.js
 */

const fs = require('fs');
const path = require('path');

// Try to use canvas, if not available, provide instructions
let Canvas;
try {
  Canvas = require('canvas');
} catch (e) {
  console.log('❌ canvas package not found.');
  console.log('\n📝 To generate PNG icons, choose one of these options:\n');
  console.log('Option 1 (Easiest): Open generate-icons.html in your browser');
  console.log('  open chrome-extension/generate-icons.html');
  console.log('  Click "Download All Icons" and move files to icons/ folder\n');
  console.log('Option 2: Install canvas and run this script');
  console.log('  npm install canvas');
  console.log('  node generate-png-icons.js\n');
  console.log('Option 3: Convert SVG to PNG online');
  console.log('  Visit: https://cloudconvert.com/svg-to-png');
  console.log('  Upload: icons/icon16.svg, icon48.svg, icon128.svg\n');
  process.exit(1);
}

const { createCanvas } = Canvas;

// Ensure icons directory exists
const iconsDir = path.join(__dirname, 'icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

function drawIcon(canvas, size) {
  const ctx = canvas.getContext('2d');
  
  // Gradient background
  const gradient = ctx.createLinearGradient(0, 0, size, size);
  gradient.addColorStop(0, '#667eea');
  gradient.addColorStop(1, '#764ba2');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  
  // Draw white 'M' symbol
  ctx.strokeStyle = 'white';
  ctx.fillStyle = 'white';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  
  if (size >= 48) {
    const lineWidth = Math.max(3, size / 16);
    ctx.lineWidth = lineWidth;
    
    // Draw M
    ctx.beginPath();
    ctx.moveTo(size * 0.25, size * 0.65);
    ctx.lineTo(size * 0.25, size * 0.35);
    ctx.lineTo(size * 0.37, size * 0.47);
    ctx.lineTo(size * 0.5, size * 0.35);
    ctx.lineTo(size * 0.63, size * 0.47);
    ctx.lineTo(size * 0.75, size * 0.35);
    ctx.lineTo(size * 0.75, size * 0.65);
    ctx.stroke();
    
    // Draw down arrow
    ctx.beginPath();
    ctx.moveTo(size * 0.5, size * 0.7);
    ctx.lineTo(size * 0.5, size * 0.85);
    ctx.moveTo(size * 0.42, size * 0.78);
    ctx.lineTo(size * 0.5, size * 0.85);
    ctx.lineTo(size * 0.58, size * 0.78);
    ctx.stroke();
  } else {
    // Simple design for 16x16
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(size * 0.25, size * 0.7);
    ctx.lineTo(size * 0.25, size * 0.3);
    ctx.lineTo(size * 0.5, size * 0.5);
    ctx.lineTo(size * 0.75, size * 0.3);
    ctx.lineTo(size * 0.75, size * 0.7);
    ctx.stroke();
  }
}

const sizes = [16, 48, 128];

sizes.forEach(size => {
  const canvas = createCanvas(size, size);
  drawIcon(canvas, size);
  
  const buffer = canvas.toBuffer('image/png');
  const filename = path.join(iconsDir, `icon${size}.png`);
  fs.writeFileSync(filename, buffer);
  console.log(`✓ Created ${filename}`);
});

console.log('\n✅ All PNG icons generated successfully!');
console.log('\n📝 Next steps:');
console.log('1. Go to chrome://extensions/');
console.log('2. Reload your extension');
console.log('3. Test the import feature');

