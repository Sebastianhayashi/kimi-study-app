'use strict';

const zlib = require('node:zlib');

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBytes = Buffer.from(type, 'ascii');
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])), 0);
  return Buffer.concat([length, typeBytes, data, crc]);
}

function paintPixel(raw, rowBytes, x, y, rgba) {
  const offset = y * (rowBytes + 1) + 1 + x * 4;
  raw[offset] = rgba[0];
  raw[offset + 1] = rgba[1];
  raw[offset + 2] = rgba[2];
  raw[offset + 3] = rgba[3];
}

function fillRect(raw, rowBytes, width, height, x, y, rectWidth, rectHeight, rgba) {
  const left = Math.max(0, x);
  const top = Math.max(0, y);
  const right = Math.min(width, x + rectWidth);
  const bottom = Math.min(height, y + rectHeight);
  for (let py = top; py < bottom; py += 1) {
    for (let px = left; px < right; px += 1) paintPixel(raw, rowBytes, px, py, rgba);
  }
}

function createDeterministicBrowserPng({ width = 480, height = 270 } = {}) {
  const rowBytes = width * 4;
  const raw = Buffer.alloc((rowBytes + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (rowBytes + 1)] = 0;
    fillRect(raw, rowBytes, width, height, 0, y, width, 1, [246, 247, 251, 255]);
  }

  fillRect(raw, rowBytes, width, height, 0, 0, width, 34, [251, 252, 255, 255]);
  fillRect(raw, rowBytes, width, height, 18, 10, 16, 16, [0, 47, 167, 255]);
  fillRect(raw, rowBytes, width, height, 58, 58, 190, 12, [18, 23, 34, 255]);
  fillRect(raw, rowBytes, width, height, 58, 82, 292, 7, [102, 113, 132, 255]);
  fillRect(raw, rowBytes, width, height, 58, 112, 364, 76, [255, 255, 255, 255]);
  fillRect(raw, rowBytes, width, height, 58, 112, 3, 76, [0, 47, 167, 255]);
  fillRect(raw, rowBytes, width, height, 78, 130, 128, 8, [50, 59, 74, 255]);
  fillRect(raw, rowBytes, width, height, 78, 151, 252, 6, [203, 211, 225, 255]);
  fillRect(raw, rowBytes, width, height, 78, 166, 186, 6, [225, 230, 239, 255]);
  fillRect(raw, rowBytes, width, height, 58, 209, 364, 38, [255, 255, 255, 255]);
  fillRect(raw, rowBytes, width, height, 75, 224, 226, 7, [203, 211, 225, 255]);
  fillRect(raw, rowBytes, width, height, 334, 218, 70, 20, [0, 47, 167, 255]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

module.exports = { createDeterministicBrowserPng };
