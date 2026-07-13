/**
 * Extraction d'objet — crop + retrait fond damier (faux transparent IA) ou fond uni.
 */

const path = require('path');
const BackgroundRemoveService = require('./BackgroundRemoveService');

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

/** Damiers fréquents (Gemini, Photoshop, Midjourney…) */
const CHECKER_PRESETS = [
  { light: [255, 255, 255], dark: [204, 204, 204] },
  { light: [255, 255, 255], dark: [191, 191, 191] },
  { light: [240, 239, 237], dark: [212, 211, 209] },
  { light: [238, 237, 235], dark: [211, 210, 206] },
  { light: [255, 255, 255], dark: [128, 128, 128] },
  { light: [204, 204, 204], dark: [128, 128, 128] },
  { light: [192, 192, 192], dark: [128, 128, 128] },
];

function distRgb(r1, g1, b1, r2, g2, b2) {
  return Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2);
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
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
  if (!n) return [128, 128, 128];
  return [Math.round(r / n), Math.round(g / n), Math.round(b / n)];
}

function sampleBorderPixels(data, width, height, step = 4) {
  const samples = [];
  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const i = (width * y + x) << 2;
    samples.push({ x, y, rgb: [data[i], data[i + 1], data[i + 2]] });
  };
  for (let x = 0; x < width; x += step) {
    push(x, 0);
    push(x, height - 1);
  }
  for (let y = step; y < height - step; y += step) {
    push(0, y);
    push(width - 1, y);
  }
  return samples;
}

function sampleCornerPixels(data, width, height, ratio = 0.12) {
  const pw = Math.max(8, Math.round(width * ratio));
  const ph = Math.max(8, Math.round(height * ratio));
  const samples = [];
  const corners = [
    [0, 0],
    [Math.max(0, width - pw), 0],
    [0, Math.max(0, height - ph)],
    [Math.max(0, width - pw), Math.max(0, height - ph)],
  ];
  corners.forEach(([x0, y0]) => {
    for (let y = y0; y < Math.min(y0 + ph, height); y += 2) {
      for (let x = x0; x < Math.min(x0 + pw, width); x += 2) {
        const i = (width * y + x) << 2;
        samples.push({ x, y, rgb: [data[i], data[i + 1], data[i + 2]] });
      }
    }
  });
  return samples;
}

function clusterTwoColors(samples) {
  const rgbs = samples
    .map((s) => (Array.isArray(s) ? s : s.rgb))
    .filter((rgb) => Array.isArray(rgb) && rgb.length === 3);
  if (!rgbs.length) return null;
  const buckets = new Map();
  rgbs.forEach(([r, g, b]) => {
    const key = `${Math.round(r / 12) * 12},${Math.round(g / 12) * 12},${Math.round(b / 12) * 12}`;
    if (!buckets.has(key)) buckets.set(key, { sum: [0, 0, 0], count: 0 });
    const bkt = buckets.get(key);
    bkt.sum[0] += r;
    bkt.sum[1] += g;
    bkt.sum[2] += b;
    bkt.count += 1;
  });
  const sorted = [...buckets.values()]
    .map((b) => ({
      rgb: [
        Math.round(b.sum[0] / b.count),
        Math.round(b.sum[1] / b.count),
        Math.round(b.sum[2] / b.count),
      ],
      count: b.count,
    }))
    .sort((a, b) => b.count - a.count);

  if (sorted.length < 2) return null;
  const a = sorted[0].rgb;
  const b = sorted.find((c) => distRgb(a[0], a[1], a[2], c.rgb[0], c.rgb[1], c.rgb[2]) > 22)?.rgb;
  if (!b) return null;
  const light = (a[0] + a[1] + a[2]) >= (b[0] + b[1] + b[2]) ? a : b;
  const dark = light === a ? b : a;
  return { light, dark };
}

function scoreCheckerboardAt(data, width, height, light, dark, cellSize, tolerance, offsetX = 0, offsetY = 0) {
  let hits = 0;
  let total = 0;
  const samples = sampleBorderPixels(data, width, height, 3)
    .concat(sampleCornerPixels(data, width, height, 0.08));
  samples.forEach(({ x, y, rgb }) => {
    const [r, g, b] = rgb;
    const tx = Math.floor((x + offsetX) / cellSize);
    const ty = Math.floor((y + offsetY) / cellSize);
    const expect = (tx + ty) % 2 === 0 ? light : dark;
    total += 1;
    if (distRgb(r, g, b, expect[0], expect[1], expect[2]) <= tolerance) hits += 1;
  });
  return total ? hits / total : 0;
}

function detectCheckerboard(data, width, height, tolerance = 48) {
  const colorSamples = sampleCornerPixels(data, width, height, 0.1)
    .concat(sampleBorderPixels(data, width, height, 4));
  const clustered = clusterTwoColors(colorSamples);
  const colorCandidates = [];
  if (clustered) colorCandidates.push(clustered);
  CHECKER_PRESETS.forEach((p) => colorCandidates.push(p));

  const cellSizes = [8, 10, 12, 16, 20, 24, 32];
  let best = null;

  colorCandidates.forEach((colors) => {
    cellSizes.forEach((cellSize) => {
      const step = Math.max(1, Math.floor(cellSize / 2));
      const offsets = [
        [0, 0],
        [step, 0],
        [0, step],
        [step, step],
      ];
      offsets.forEach(([ox, oy]) => {
        const score = scoreCheckerboardAt(
          data, width, height, colors.light, colors.dark, cellSize, tolerance, ox, oy
        );
        if (!best || score > best.score) {
          best = {
            light: colors.light,
            dark: colors.dark,
            cellSize,
            offsetX: ox,
            offsetY: oy,
            tolerance,
            score,
          };
        }
      });
    });
  });

  if (!best || best.score < 0.42) return null;
  return best;
}

function detectUniformBackground(data, width, height) {
  const patchSize = Math.max(6, Math.min(14, Math.floor(Math.min(width, height) * 0.08)));
  const corners = [
    avgPatch(data, width, height, 0, 0, patchSize),
    avgPatch(data, width, height, Math.max(0, width - patchSize), 0, patchSize),
    avgPatch(data, width, height, 0, Math.max(0, height - patchSize), patchSize),
    avgPatch(data, width, height, Math.max(0, width - patchSize), Math.max(0, height - patchSize), patchSize),
  ];
  let maxDist = 0;
  for (let i = 0; i < corners.length; i += 1) {
    for (let j = i + 1; j < corners.length; j += 1) {
      maxDist = Math.max(maxDist, distRgb(
        corners[i][0], corners[i][1], corners[i][2],
        corners[j][0], corners[j][1], corners[j][2]
      ));
    }
  }
  if (maxDist > 55) return null;
  const rgb = [
    Math.round(corners.reduce((s, c) => s + c[0], 0) / 4),
    Math.round(corners.reduce((s, c) => s + c[1], 0) / 4),
    Math.round(corners.reduce((s, c) => s + c[2], 0) / 4),
  ];
  return { rgb, thresholdLow: 52, thresholdHigh: 145 };
}

function isCheckerboardBg(globalX, globalY, r, g, b, params) {
  const tx = Math.floor((globalX + params.offsetX) / params.cellSize);
  const ty = Math.floor((globalY + params.offsetY) / params.cellSize);
  const expect = (tx + ty) % 2 === 0 ? params.light : params.dark;
  return distRgb(r, g, b, expect[0], expect[1], expect[2]) <= params.tolerance;
}

function uniformAlpha(r, g, b, params) {
  const d = distRgb(r, g, b, params.rgb[0], params.rgb[1], params.rgb[2]);
  if (d <= params.thresholdLow) return 0;
  if (d >= params.thresholdHigh) return 255;
  const t = (d - params.thresholdLow) / (params.thresholdHigh - params.thresholdLow);
  return Math.round(255 * t);
}

function trimOpaqueBounds(data, width, height, alphaMin = 12) {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const a = data[((width * y + x) << 2) + 3];
      if (a >= alphaMin) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < minX || maxY < minY) return null;
  const pad = 2;
  return {
    x: clamp(minX - pad, 0, width - 1),
    y: clamp(minY - pad, 0, height - 1),
    width: clamp(maxX - minX + 1 + pad * 2, 1, width),
    height: clamp(maxY - minY + 1 + pad * 2, 1, height),
  };
}

function cropPng(png, crop) {
  const { width, height, data } = png;
  const x0 = clamp(Math.round(crop.x), 0, width - 1);
  const y0 = clamp(Math.round(crop.y), 0, height - 1);
  const w = clamp(Math.round(crop.width), 1, width - x0);
  const h = clamp(Math.round(crop.height), 1, height - y0);

  const out = new PNG({ width: w, height: h });
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const si = ((width * (y0 + y)) + (x0 + x)) << 2;
      const di = (w * y + x) << 2;
      out.data[di] = data[si];
      out.data[di + 1] = data[si + 1];
      out.data[di + 2] = data[si + 2];
      out.data[di + 3] = data[si + 3];
    }
  }
  out.__cropOrigin = { x: x0, y: y0 };
  return out;
}

function subImage(png, bounds) {
  return cropPng(png, bounds);
}

function countTransparentPixels(data, width, height) {
  let n = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (data[((width * y + x) << 2) + 3] < 12) n += 1;
    }
  }
  return n;
}

function finalizeResult(png, mode, backgroundRemoved, extra = {}) {
  let result = png;
  let trimmed = false;
  if (extra.trim !== false && backgroundRemoved) {
    const bounds = trimOpaqueBounds(result.data, result.width, result.height);
    if (bounds && (bounds.width < result.width || bounds.height < result.height)) {
      result = subImage(result, bounds);
      trimmed = true;
    }
  }
  const totalPixels = result.width * result.height;
  const transparentPixels = countTransparentPixels(result.data, result.width, result.height);
  const transparentRatio = totalPixels ? transparentPixels / totalPixels : 0;
  return {
    buffer: PNG.sync.write(result),
    width: result.width,
    height: result.height,
    mode,
    backgroundRemoved: backgroundRemoved && transparentRatio >= 0.02,
    trimmed,
    transparentRatio,
    message: extra.message || null,
    checkerboardScore: extra.meta && extra.meta.checkerboardScore != null
      ? extra.meta.checkerboardScore
      : null,
  };
}

class ObjectExtractService {
  constructor(config = {}) {
    this.engine = config.engine || 'rembg';
    this.fallbackEngine = config.fallbackEngine || 'checkerboard';
    this.rembg = new BackgroundRemoveService(config.rembg || {});
  }

  ensurePngjs() {
    if (!PNG) {
      try {
        PNG = loadPngClass();
      } catch {
        throw new Error('pngjs introuvable. Lancez npm install dans backend/.');
      }
    }
  }

  async getStatus() {
    const rembgOk = await this.rembg.checkAvailable();
    return {
      engine: this.engine,
      fallbackEngine: this.fallbackEngine,
      rembg: {
        available: rembgOk,
        model: this.rembg.model,
        python: this.rembg.python,
        installHint: rembgOk
          ? null
          : 'Exécutez modules/media-studio/scripts/Install-RemBG.ps1 puis redémarrez Node.',
      },
    };
  }

  extractCheckerboard(source, crop, options = {}) {
    this.ensurePngjs();
    const cropX = clamp(Math.round(crop.x), 0, source.width - 1);
    const cropY = clamp(Math.round(crop.y), 0, source.height - 1);
    const tolerance = options.tolerance ?? 48;

    const checker = detectCheckerboard(source.data, source.width, source.height, tolerance);
    const uniform = checker
      ? null
      : detectUniformBackground(source.data, source.width, source.height);

    const cropped = cropPng(source, crop);
    let mode = 'none';
    let backgroundRemoved = false;

    if (checker) {
      mode = 'checkerboard';
      checker.tolerance = tolerance;
      for (let y = 0; y < cropped.height; y += 1) {
        for (let x = 0; x < cropped.width; x += 1) {
          const i = (cropped.width * y + x) << 2;
          const r = cropped.data[i];
          const g = cropped.data[i + 1];
          const b = cropped.data[i + 2];
          if (isCheckerboardBg(cropX + x, cropY + y, r, g, b, checker)) {
            cropped.data[i + 3] = 0;
            backgroundRemoved = true;
          } else {
            cropped.data[i + 3] = 255;
          }
        }
      }
    } else if (uniform) {
      mode = 'uniform';
      for (let y = 0; y < cropped.height; y += 1) {
        for (let x = 0; x < cropped.width; x += 1) {
          const i = (cropped.width * y + x) << 2;
          cropped.data[i + 3] = uniformAlpha(
            cropped.data[i],
            cropped.data[i + 1],
            cropped.data[i + 2],
            uniform
          );
          if (cropped.data[i + 3] < 255) backgroundRemoved = true;
        }
      }
    }

    return finalizeResult(cropped, mode, backgroundRemoved, {
      trim: options.trim,
      meta: { checkerboardScore: checker ? checker.score : null },
    });
  }

  async extractRembg(source, crop, options = {}) {
    this.ensurePngjs();
    const cropped = cropPng(source, crop);
    const croppedBuffer = PNG.sync.write(cropped);
    const removedBuffer = await this.rembg.removeBackground(croppedBuffer);
    const removed = PNG.sync.read(removedBuffer);
    return finalizeResult(removed, 'rembg', true, { trim: options.trim });
  }

  /**
   * @param {Buffer} inputBuffer PNG
   * @param {{ x:number, y:number, width:number, height:number }} crop
   */
  async extractFromBuffer(inputBuffer, crop, options = {}) {
    this.ensurePngjs();
    const source = PNG.sync.read(inputBuffer);
    const engine = options.engine || this.engine;
    const fallback = options.fallbackEngine || this.fallbackEngine;

    if (engine === 'rembg') {
      const available = await this.rembg.checkAvailable();
      if (available) {
        try {
          return await this.extractRembg(source, crop, options);
        } catch (err) {
          console.error('[media-studio] rembg:', err.message);
          if (fallback === 'checkerboard') {
            const fb = this.extractCheckerboard(source, crop, options);
            if (fb.backgroundRemoved) {
              fb.mode = 'checkerboard-fallback';
              return fb;
            }
          }
          throw err;
        }
      }
      if (fallback === 'checkerboard') {
        const fb = this.extractCheckerboard(source, crop, options);
        if (fb.backgroundRemoved) {
          fb.mode = 'checkerboard-fallback';
          fb.message = 'rembg non installé — détourage damier utilisé.';
          return fb;
        }
      }
      return {
        buffer: PNG.sync.write(cropPng(source, crop)),
        width: clamp(Math.round(crop.width), 1, source.width),
        height: clamp(Math.round(crop.height), 1, source.height),
        mode: 'none',
        backgroundRemoved: false,
        trimmed: false,
        transparentRatio: 0,
        message: 'rembg non installé. Lancez modules/media-studio/scripts/Install-RemBG.ps1',
      };
    }

    return this.extractCheckerboard(source, crop, options);
  }
}

module.exports = ObjectExtractService;
