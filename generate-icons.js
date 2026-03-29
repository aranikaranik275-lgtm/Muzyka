// Run once locally: node generate-icons.js
// Requires: npm install canvas
const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

if (!fs.existsSync('icons')) fs.mkdirSync('icons');

function drawIcon(size) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  const cx = size / 2, cy = size / 2;
  ctx.fillStyle = '#1a1a2e';
  ctx.beginPath();
  ctx.arc(cx, cy, cx, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#e94560';
  ctx.lineWidth = size * 0.04;
  ctx.beginPath();
  ctx.arc(cx, cy, cx * 0.88, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#e94560';
  const unit = size * 0.12;
  const noteX = cx - unit * 0.6, noteY = cy - unit * 0.5;
  ctx.fillRect(noteX, noteY, unit * 0.22, unit * 1.4);
  ctx.fillRect(noteX + unit * 0.8, noteY - unit * 0.3, unit * 0.22, unit * 1.4);
  ctx.fillRect(noteX, noteY, unit * 1.02, unit * 0.22);
  ctx.beginPath();
  ctx.ellipse(noteX + unit * 0.1, noteY + unit * 1.4, unit * 0.32, unit * 0.22, -0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(noteX + unit * 0.9, noteY + unit * 1.1, unit * 0.32, unit * 0.22, -0.4, 0, Math.PI * 2);
  ctx.fill();
  return canvas.toBuffer('image/png');
}

fs.writeFileSync(path.join('icons', 'icon-192.png'), drawIcon(192));
fs.writeFileSync(path.join('icons', 'icon-512.png'), drawIcon(512));
console.log('Icons generated: icons/icon-192.png, icons/icon-512.png');