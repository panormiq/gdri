/**
 * Pose un PNG transparent sur fond chroma uni (pour i2v + détourage vidéo).
 */

const path = require('path');

let PNG = null;

function loadPngClass() {
  return require(path.join(__dirname, '../../../../backend/node_modules/pngjs')).PNG;
}

function round32(n) {
  return Math.max(32, Math.round(n / 32) * 32);
}

function findAlphaBounds(data, width, height, alphaThreshold = 8) {
  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;
  let found = false;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (width * y + x) << 2;
      if (data[i + 3] > alphaThreshold) {
        found = true;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (!found) {
    return { minX: 0, minY: 0, maxX: width - 1, maxY: height - 1 };
  }
  return { minX, minY, maxX, maxY };
}

class ChromaCompositeService {
  constructor(config = {}) {
    this.maxDimension = config.maxDimension || 768;
    this.marginRatio = config.marginRatio || 0.12;
  }

  ensurePngjs() {
    if (!PNG) PNG = loadPngClass();
  }

  /**
   * @returns {{ buffer: Buffer, width: number, height: number, offsetX: number, offsetY: number, scale: number }}
   */
  compositeOnChroma(inputBuffer, keyRgb = [255, 0, 255], options = {}) {
    this.ensurePngjs();
    const src = PNG.sync.read(inputBuffer);
    const { width: sw, height: sh, data } = src;
    const bounds = findAlphaBounds(data, sw, sh);
    const bw = bounds.maxX - bounds.minX + 1;
    const bh = bounds.maxY - bounds.minY + 1;

    const maxDim = options.maxDimension || this.maxDimension;
    const margin = this.marginRatio;
    let targetW = round32(Math.min(maxDim, bw * (1 + margin * 2)));
    let targetH = round32(Math.min(maxDim, bh * (1 + margin * 2)));
    const fit = Math.min(
      (targetW * (1 - margin * 2)) / bw,
      (targetH * (1 - margin * 2)) / bh,
      1
    );
    const drawW = Math.max(1, Math.round(bw * fit));
    const drawH = Math.max(1, Math.round(bh * fit));
    const dx = Math.round((targetW - drawW) / 2);
    const dy = Math.round((targetH - drawH) / 2);

    const out = new PNG({ width: targetW, height: targetH });
    const [kr, kg, kb] = keyRgb;
    for (let y = 0; y < targetH; y += 1) {
      for (let x = 0; x < targetW; x += 1) {
        const i = (targetW * y + x) << 2;
        out.data[i] = kr;
        out.data[i + 1] = kg;
        out.data[i + 2] = kb;
        out.data[i + 3] = 255;
      }
    }

    for (let y = 0; y < drawH; y += 1) {
      for (let x = 0; x < drawW; x += 1) {
        const sx = bounds.minX + Math.floor((x / drawW) * bw);
        const sy = bounds.minY + Math.floor((y / drawH) * bh);
        const si = (sw * sy + sx) << 2;
        const alphaRaw = data[si + 3];
        const hardMatte = options.hardMatte !== false;
        const alphaCut = options.alphaThreshold ?? 200;
        if (hardMatte) {
          if (alphaRaw < alphaCut) continue;
        } else if (alphaRaw < 5) {
          continue;
        }
        const ox = dx + x;
        const oy = dy + y;
        if (ox < 0 || oy < 0 || ox >= targetW || oy >= targetH) continue;
        const oi = (targetW * oy + ox) << 2;
        if (hardMatte) {
          out.data[oi] = data[si];
          out.data[oi + 1] = data[si + 1];
          out.data[oi + 2] = data[si + 2];
        } else {
          const alpha = alphaRaw / 255;
          const inv = 1 - alpha;
          out.data[oi] = Math.round(data[si] * alpha + kr * inv);
          out.data[oi + 1] = Math.round(data[si + 1] * alpha + kg * inv);
          out.data[oi + 2] = Math.round(data[si + 2] * alpha + kb * inv);
        }
        out.data[oi + 3] = 255;
      }
    }

    return {
      buffer: PNG.sync.write(out),
      width: targetW,
      height: targetH,
      sourceBounds: bounds,
      drawW,
      drawH,
    };
  }
}

module.exports = ChromaCompositeService;
