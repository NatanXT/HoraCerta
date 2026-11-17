import zlib from 'zlib';
import fs from 'fs';
import path from 'path';

function crc32(buf) {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[n] = c >>> 0;
  }
  let crc = 0 ^ (-1);
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xFF];
  }
  return (crc ^ (-1)) >>> 0;
}

function makeChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  const crc = crc32(Buffer.concat([typeBuf, data]));
  crcBuf.writeUInt32BE(crc, 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function generatePng(width, height, pixelFn) {
  const sig = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  const ihdrChunk = makeChunk('IHDR', ihdr);

  const rawData = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    const rowOffset = y * (1 + width * 4);
    rawData[rowOffset] = 0; // filter None
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = pixelFn(x, y, width, height);
      const px = rowOffset + 1 + x * 4;
      rawData[px] = r;
      rawData[px + 1] = g;
      rawData[px + 2] = b;
      rawData[px + 3] = a;
    }
  }

  const compressed = zlib.deflateSync(rawData);
  const idatChunk = makeChunk('IDAT', compressed);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([sig, ihdrChunk, idatChunk, iendChunk]);
}

function distToSegment(px, py, x1, y1, x2, y2) {
  const l2 = (x2 - x1) ** 2 + (y2 - y1) ** 2;
  if (l2 === 0) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * (x2 - x1)), py - (y1 + t * (y2 - y1)));
}

function smoothstep(edge0, edge1, x) {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function blend(src, dst, alpha) {
  return [
    Math.round(src[0] * alpha + dst[0] * (1 - alpha)),
    Math.round(src[1] * alpha + dst[1] * (1 - alpha)),
    Math.round(src[2] * alpha + dst[2] * (1 - alpha)),
    Math.round(Math.max(src[3], dst[3])),
  ];
}

function createClockPixelRenderer(isMaskable) {
  return (x, y, w, h) => {
    const cx = w / 2;
    const cy = h / 2;
    const scale = isMaskable ? 0.35 : 0.42;
    const radius = w * scale;
    const strokeWidth = Math.max(2, w * 0.042);
    const cornerRadius = w * 0.22;

    // Background color: slate-950 / slate-900 subtle gradient
    const bgGrad = (y / h) * 0.15;
    const bgR = Math.round(15 + bgGrad * 10);
    const bgG = Math.round(23 + bgGrad * 15);
    const bgB = Math.round(42 + bgGrad * 20);

    let basePixel = [bgR, bgG, bgB, 255];

    if (!isMaskable) {
      // Rounded rectangle mask for standard app icons
      const dx = Math.max(0, Math.abs(x - cx) - (cx - cornerRadius));
      const dy = Math.max(0, Math.abs(y - cy) - (cy - cornerRadius));
      const distToCorner = Math.hypot(dx, dy);
      if (distToCorner > cornerRadius) {
        const edge = distToCorner - cornerRadius;
        if (edge > 1) return [0, 0, 0, 0];
        const alpha = 1 - edge;
        basePixel[3] = Math.round(255 * alpha);
      }
    }

    // Distance to outer clock ring
    const distFromCenter = Math.hypot(x - cx, y - cy);
    const ringDist = Math.abs(distFromCenter - radius);
    const halfStroke = strokeWidth / 2;
    const ringAlpha = 1 - smoothstep(halfStroke - 0.75, halfStroke + 0.75, ringDist);

    // Clock hands: center to 12:00, center to ~14 minutes
    const handHourEndX = cx;
    const handHourEndY = cy - radius * 0.60;
    const distHandHour = distToSegment(x, y, cx, cy, handHourEndX, handHourEndY);
    const hourAlpha = 1 - smoothstep(halfStroke - 0.75, halfStroke + 0.75, distHandHour);

    const angleMinute = (14 / 60) * 2 * Math.PI - Math.PI / 2;
    const handMinEndX = cx + Math.cos(angleMinute) * (radius * 0.45);
    const handMinEndY = cy + Math.sin(angleMinute) * (radius * 0.45);
    const distHandMin = distToSegment(x, y, cx, cy, handMinEndX, handMinEndY);
    const minAlpha = 1 - smoothstep(halfStroke - 0.75, halfStroke + 0.75, distHandMin);

    // Center pin circle
    const centerPinDist = Math.hypot(x - cx, y - cy);
    const pinAlpha = 1 - smoothstep(halfStroke * 1.1 - 0.75, halfStroke * 1.1 + 0.75, centerPinDist);

    const clockColor = [99, 102, 241, 255]; // Indigo-500 #6366f1
    const handColor = [129, 140, 248, 255];  // Indigo-400 #818cf8

    let result = basePixel;

    if (ringAlpha > 0) {
      result = blend(clockColor, result, ringAlpha);
    }
    if (hourAlpha > 0) {
      result = blend(handColor, result, hourAlpha);
    }
    if (minAlpha > 0) {
      result = blend(handColor, result, minAlpha);
    }
    if (pinAlpha > 0) {
      result = blend(clockColor, result, pinAlpha);
    }

    return result;
  };
}

const iconsDir = path.resolve('frontend/public/icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

const icons = [
  { name: 'pwa-192x192.png', size: 192, maskable: false },
  { name: 'pwa-512x512.png', size: 512, maskable: false },
  { name: 'maskable-icon-512x512.png', size: 512, maskable: true },
  { name: 'apple-touch-icon-180x180.png', size: 180, maskable: false },
  { name: 'favicon-32x32.png', size: 32, maskable: false },
];

for (const icon of icons) {
  const filePath = path.join(iconsDir, icon.name);
  const buf = generatePng(icon.size, icon.size, createClockPixelRenderer(icon.maskable));
  fs.writeFileSync(filePath, buf);
  console.log(`Generated ${icon.name} (${icon.size}x${icon.size}) - ${buf.length} bytes`);
}
