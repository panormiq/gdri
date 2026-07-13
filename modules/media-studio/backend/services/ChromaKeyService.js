/**
 * Détourage fond chroma — couleur configurable + détection auto des coins.
 */

const path = require('path');

function loadPngClass() {
  try {
    return require('pngjs').PNG;
  } catch {
    const backendPng = path.join(__dirname, '../../../../backend/node_modules/pngjs');
    return require(backendPng).PNG;
  }
}

let PNG;
try {
  PNG = loadPngClass();
} catch {
  PNG = null;
}

function distRgb(r1, g1, b1, r2, g2, b2) {
  return Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2);
}

function avgPatch(data, width, height, x0, y0, size) {
  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  const maxX = Math.min(x0 + size, width);
  const maxY = Math.min(y0 + size, height);
  for (let y = y0; y < maxY; y += 1) {
    for (let x = x0; x < maxX; x += 1) {
      const i = (width * y + x) << 2;
      r += data[i];
      g += data[i + 1];
      b += data[i + 2];
      n += 1;
    }
  }
  if (!n) return [0, 0, 0];
  return [Math.round(r / n), Math.round(g / n), Math.round(b / n)];
}

function detectUniformCornerBackground(data, width, height, patchSize = 14) {
  const ps = Math.max(6, Math.min(patchSize, Math.floor(Math.min(width, height) * 0.08)));
  const corners = [
    avgPatch(data, width, height, 0, 0, ps),
    avgPatch(data, width, height, Math.max(0, width - ps), 0, ps),
    avgPatch(data, width, height, 0, Math.max(0, height - ps), ps),
    avgPatch(data, width, height, Math.max(0, width - ps), Math.max(0, height - ps), ps),
  ];
  let maxDist = 0;
  for (let i = 0; i < corners.length; i += 1) {
    for (let j = i + 1; j < corners.length; j += 1) {
      const d = distRgb(
        corners[i][0], corners[i][1], corners[i][2],
        corners[j][0], corners[j][1], corners[j][2]
      );
      if (d > maxDist) maxDist = d;
    }
  }
  if (maxDist > 55) return null;
  const avg = [0, 0, 0];
  corners.forEach((c) => {
    avg[0] += c[0];
    avg[1] += c[1];
    avg[2] += c[2];
  });
  return [
    Math.round(avg[0] / corners.length),
    Math.round(avg[1] / corners.length),
    Math.round(avg[2] / corners.length),
  ];
}

function detectBorderBackground(data, width, height, step = 8) {
  const samples = [];
  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const i = (width * y + x) << 2;
    samples.push([data[i], data[i + 1], data[i + 2]]);
  };

  for (let x = 0; x < width; x += step) {
    push(x, 0);
    push(x, height - 1);
  }
  for (let y = step; y < height - step; y += step) {
    push(0, y);
    push(width - 1, y);
  }
  if (samples.length < 8) return null;

  const buckets = new Map();
  samples.forEach(([r, g, b]) => {
    const key = `${Math.round(r / 12) * 12},${Math.round(g / 12) * 12},${Math.round(b / 12) * 12}`;
    if (!buckets.has(key)) buckets.set(key, { rgb: [r, g, b], count: 0, sum: [0, 0, 0] });
    const bucket = buckets.get(key);
    bucket.count += 1;
    bucket.sum[0] += r;
    bucket.sum[1] += g;
    bucket.sum[2] += b;
  });

  let best = null;
  buckets.forEach((bucket) => {
    if (!best || bucket.count > best.count) best = bucket;
  });
  if (!best || best.count < samples.length * 0.45) return null;

  return [
    Math.round(best.sum[0] / best.count),
    Math.round(best.sum[1] / best.count),
    Math.round(best.sum[2] / best.count),
  ];
}

function detectBackgroundColor(data, width, height, patchSize = 14) {
  return detectUniformCornerBackground(data, width, height, patchSize)
    || detectBorderBackground(data, width, height);
}

function resolveKeyRgb(hintRgb, detectedRgb) {
  const hint = Array.isArray(hintRgb) && hintRgb.length === 3 ? hintRgb : [255, 0, 255];
  if (!detectedRgb) return hint;
  const d = distRgb(hint[0], hint[1], hint[2], detectedRgb[0], detectedRgb[1], detectedRgb[2]);
  // Flux peut ignorer le hex demandé : si les bords sont uniformes mais loin du hint, on fait confiance à l'image.
  if (d > 25) return detectedRgb;
  // Sinon couleur proche du hint : utiliser la teinte réellement peinte par Flux.
  return detectedRgb;
}

function applyEdgeDespill(r, g, b, key, alpha) {
  if (alpha >= 255 || alpha <= 0) return [r, g, b];
  const t = 1 - alpha / 255;

  if (key[1] > key[0] && key[1] > key[2]) {
    const spill = Math.max(0, g - Math.max(r, b));
    if (spill > 5) return [r, Math.round(g - spill * 0.45 * t), b];
  }

  if (key[0] > 180 && key[2] > 180 && key[1] < 120) {
    const spill = Math.min(r, b) - g;
    if (spill > 5) {
      const cut = spill * 0.4 * t;
      return [Math.round(r - cut), g, Math.round(b - cut)];
    }
  }

  if (key[2] > key[0] && key[2] > key[1]) {
    const spill = Math.max(0, b - Math.max(r, g));
    if (spill > 5) return [r, g, Math.round(b - spill * 0.4 * t)];
  }

  return [r, g, b];
}

class ChromaKeyService {
  constructor(config = {}) {
    this.thresholdLow = config.thresholdLow ?? 52;
    this.thresholdHigh = config.thresholdHigh ?? 145;
    this.edgeDespill = config.edgeDespill !== false;
    this.cornerPatchSize = config.cornerPatchSize ?? 14;
  }

  ensurePngjs() {
    if (!PNG) {
      try {
        PNG = loadPngClass();
      } catch {
        throw new Error('pngjs introuvable. Lancez npm install dans backend/ puis redémarrez le serveur Node.');
      }
    }
  }

  chromaAlpha(r, g, b, keyRgb) {
    const d = distRgb(r, g, b, keyRgb[0], keyRgb[1], keyRgb[2]);
    if (d <= this.thresholdLow) return 0;
    if (d >= this.thresholdHigh) return 255;
    const t = (d - this.thresholdLow) / (this.thresholdHigh - this.thresholdLow);
    return Math.round(255 * t);
  }

  processPngBuffer(inputBuffer, keyRgb = [255, 0, 255]) {
    this.ensurePngjs();
    const png = PNG.sync.read(inputBuffer);
    const { width, height, data } = png;
    const hint = Array.isArray(keyRgb) && keyRgb.length === 3 ? keyRgb : [255, 0, 255];
    const detected = detectBackgroundColor(data, width, height, this.cornerPatchSize);
    const key = resolveKeyRgb(hint, detected);

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const i = (width * y + x) << 2;
        let r = data[i];
        let g = data[i + 1];
        let b = data[i + 2];
        let alpha = this.chromaAlpha(r, g, b, key);

        if (alpha < 255 && alpha > 0 && this.edgeDespill) {
          [r, g, b] = applyEdgeDespill(r, g, b, key, alpha);
          data[i] = r;
          data[i + 1] = g;
          data[i + 2] = b;
        }

        data[i + 3] = alpha;
      }
    }

    return {
      buffer: PNG.sync.write(png),
      keyUsed: key,
      keyHint: hint,
      keyDetected: detected,
    };
  }
}

module.exports = ChromaKeyService;
