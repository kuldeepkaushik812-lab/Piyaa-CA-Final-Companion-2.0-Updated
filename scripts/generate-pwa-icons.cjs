const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let j = 0; j < 8; j++) {
      c = (c >>> 1) ^ (c & 1 ? 0xedb88320 : 0);
    }
  }
  return (c ^ 0xffffffff) >>> 0;
}

function makeChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const typeAndData = Buffer.concat([typeBuf, data]);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(typeAndData), 0);
  return Buffer.concat([len, typeAndData, crcBuf]);
}

function createPNG(width, height) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // bit depth
  ihdrData[9] = 6; // color type 6 (RGBA)
  ihdrData[10] = 0; // compression
  ihdrData[11] = 0; // filter
  ihdrData[12] = 0; // interlace
  const ihdrChunk = makeChunk('IHDR', ihdrData);

  const rawScanlines = [];
  const cx = width / 2;
  const cy = height / 2;
  const radius = width * 0.38;

  for (let y = 0; y < height; y++) {
    const line = [0];
    for (let x = 0; x < width; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      let r = 6 + Math.floor((1 - y / height) * 10);
      let g = 78 + Math.floor((1 - y / height) * 20);
      let b = 59 + Math.floor((1 - x / width) * 15);
      let a = 255;

      const cornerR = width * 0.22;
      const nx = Math.max(0, Math.abs(dx) - (cx - cornerR));
      const ny = Math.max(0, Math.abs(dy) - (cy - cornerR));
      const cornerDist = Math.sqrt(nx * nx + ny * ny);

      if (cornerDist > cornerR) {
        a = 0;
      } else {
        if (dist < radius && dist > radius * 0.88) {
          r = 245; g = 158; b = 11;
        } else if (dist <= radius * 0.88) {
          if (Math.abs(dx) < width * 0.15 && Math.abs(dy) < height * 0.15) {
            r = 251; g = 191; b = 36;
          }
        }
      }

      line.push(r, g, b, a);
    }
    rawScanlines.push(Buffer.from(line));
  }

  const uncompressed = Buffer.concat(rawScanlines);
  const compressed = zlib.deflateSync(uncompressed);
  const idatChunk = makeChunk('IDAT', compressed);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

const iconsDir = path.join(__dirname, '..', 'public', 'icons');
fs.mkdirSync(iconsDir, { recursive: true });

fs.writeFileSync(path.join(iconsDir, 'pwa-192x192.png'), createPNG(192, 192));
fs.writeFileSync(path.join(iconsDir, 'pwa-512x512.png'), createPNG(512, 512));
fs.writeFileSync(path.join(iconsDir, 'apple-touch-icon.png'), createPNG(180, 180));

const svgIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="100%" height="100%">
  <rect width="512" height="512" rx="110" fill="url(#emeraldGrad)"/>
  <defs>
    <linearGradient id="emeraldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#059669"/>
      <stop offset="50%" stop-color="#047857"/>
      <stop offset="100%" stop-color="#022c22"/>
    </linearGradient>
    <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#fde047"/>
      <stop offset="100%" stop-color="#f59e0b"/>
    </linearGradient>
  </defs>
  <circle cx="256" cy="256" r="180" fill="none" stroke="url(#goldGrad)" stroke-width="16" opacity="0.9"/>
  <path d="M 190 320 C 170 240, 240 180, 256 160 C 272 180, 342 240, 322 320 Z" fill="url(#goldGrad)"/>
  <text x="256" y="380" font-family="sans-serif" font-weight="900" font-size="52" fill="#ffffff" text-anchor="middle" letter-spacing="4">PIYAA CA</text>
</svg>`;

fs.writeFileSync(path.join(iconsDir, 'pwa-icon.svg'), svgIcon);
console.log('Successfully generated PWA icons in /public/icons!');
