/**
 * Couleur de fond chroma — absente du sujet, pour Flux + détourage.
 */

const CHROMA_PALETTE = [
  { hex: '#FF00FF', name: 'magenta', label: 'magenta vif' },
  { hex: '#00FFFF', name: 'cyan', label: 'cyan vif' },
  { hex: '#FF6600', name: 'orange', label: 'orange vif' },
  { hex: '#00B140', name: 'green', label: 'vert chroma' },
  { hex: '#1E00FF', name: 'blue', label: 'bleu vif' },
  { hex: '#FFFF00', name: 'yellow', label: 'jaune vif' },
];

const COLOR_WORDS = [
  { re: /\bbleu|blue|navy|azure\b/i, avoid: ['#1E00FF', '#00FFFF', '#00B140'] },
  { re: /\brouge|red|crimson|scarlet\b/i, avoid: ['#FF00FF', '#FF6600'] },
  { re: /\bblanc|white|ivory|cream\b/i, avoid: ['#FFFF00', '#00FFFF'] },
  { re: /\bvert|green|emerald\b/i, avoid: ['#00B140', '#00FFFF'] },
  { re: /\bjaune|yellow|gold\b/i, avoid: ['#FFFF00', '#FF6600'] },
  { re: /\borange\b/i, avoid: ['#FF6600', '#FFFF00'] },
  { re: /\bmagenta|violet|purple|pink|rose\b/i, avoid: ['#FF00FF'] },
  { re: /\bcyan|turquoise|teal\b/i, avoid: ['#00FFFF', '#00B140'] },
  { re: /\bnoir|black|dark\b/i, avoid: [] },
];

function hexToRgb(hex) {
  const h = String(hex || '').replace('#', '').trim();
  if (h.length !== 6) return [0, 177, 64];
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

function normalizeHex(hex) {
  const h = String(hex || '').trim();
  if (!/^#[0-9A-Fa-f]{6}$/.test(h)) return null;
  return h.toUpperCase();
}

function distRgb(r1, g1, b1, r2, g2, b2) {
  return Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2);
}

function sampleObjectColors(data, width, height, step = 6) {
  const colors = [];
  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const i = (width * y + x) << 2;
      if (data[i + 3] < 200) continue;
      colors.push([data[i], data[i + 1], data[i + 2]]);
    }
  }
  return colors;
}

function minDistRgb(rgb, objectColors) {
  if (!objectColors.length) return 999;
  let min = Infinity;
  objectColors.forEach(([r, g, b]) => {
    const d = distRgb(rgb[0], rgb[1], rgb[2], r, g, b);
    if (d < min) min = d;
  });
  return min;
}

/**
 * Choisit une couleur chroma la plus éloignée des pixels visibles du PNG
 * (évite de manger rouge/orange/bleu du sujet au détourage vidéo).
 */
function pickChromaFromPngBuffer(buffer, explicitHex = null) {
  const explicit = normalizeHex(explicitHex);
  if (explicit) {
    return pickChromaColor('', explicit);
  }
  if (!buffer || !buffer.length) return pickChromaColor('', null);

  try {
    const path = require('path');
    const PNG = require(path.join(__dirname, '../../../../backend/node_modules/pngjs')).PNG;
    const src = PNG.sync.read(buffer);
    const objectColors = sampleObjectColors(src.data, src.width, src.height);
    if (!objectColors.length) return pickChromaColor('', null);

    let best = CHROMA_PALETTE[0];
    let bestScore = -1;
    CHROMA_PALETTE.forEach((c) => {
      const rgb = hexToRgb(c.hex);
      const score = minDistRgb(rgb, objectColors);
      if (score > bestScore) {
        bestScore = score;
        best = c;
      }
    });
    return { ...best, rgb: hexToRgb(best.hex), fromImage: true };
  } catch {
    return pickChromaColor('', null);
  }
}

function pickChromaColor(prompt = '', explicitHex = null) {
  const explicit = normalizeHex(explicitHex);
  if (explicit) {
    const found = CHROMA_PALETTE.find((c) => c.hex === explicit) || {
      hex: explicit,
      name: 'custom',
      label: explicit,
    };
    return { ...found, rgb: hexToRgb(explicit) };
  }

  const avoid = new Set();
  for (const rule of COLOR_WORDS) {
    if (rule.re.test(prompt)) {
      rule.avoid.forEach((c) => avoid.add(c));
    }
  }

  // Drapeau FR : bleu blanc rouge → magenta par défaut
  if (/drapeau|french flag|tricolore|tricolor|français|three equal vertical stripes blue white red/i.test(prompt)) {
    avoid.add('#00B140');
    avoid.add('#1E00FF');
    avoid.add('#00FFFF');
    const magenta = CHROMA_PALETTE.find((c) => c.hex === '#FF00FF');
    return { ...magenta, rgb: hexToRgb(magenta.hex) };
  }

  const chosen = CHROMA_PALETTE.find((c) => !avoid.has(c.hex)) || CHROMA_PALETTE[0];
  return { ...chosen, rgb: hexToRgb(chosen.hex) };
}

function buildChromaFluxInstruction(chroma) {
  const hex = chroma.hex || '#FF00FF';
  const name = chroma.name || 'chroma';
  return [
    `solid flat uniform ${name} background EXACTLY color ${hex}`,
    `entire background must be plain ${hex} only, no gradient, no texture, no shadow`,
    `the subject must NOT contain ${name} or color ${hex}`,
    'wide empty margin of this exact background color around the subject',
    'studio chroma key backdrop',
  ].join(', ');
}

/** Retire les consignes fond/chroma que l'IA ajoute parfois au prompt — le serveur les injecte seul. */
function stripChromaPromptNoise(prompt = '') {
  let text = String(prompt || '').trim();
  if (!text) return text;

  const patterns = [
    /\b(?:solid|flat|uniform|plain)\s+(?:\w+\s+){0,3}background[^,.]*[,.]?/gi,
    /\b(?:isolated|cut\s*out)\s+(?:on|with|against)\s+(?:a\s+)?(?:transparent|white|black|chroma|green|magenta|cyan|#[0-9A-Fa-f]{6})[^,.]*[,.]?/gi,
    /\b(?:transparent|chroma(?:\s*key)?|green\s*screen|écran\s*vert)\s+background[^,.]*[,.]?/gi,
    /\bfond\s+(?:chroma|uni|transparent|pour\s+d[ée]tourage|de\s+d[ée]tourage)[^,.]*[,.]?/gi,
    /\b(?:studio\s+)?chroma\s+key\s+(?:backdrop|background)[^,.]*[,.]?/gi,
    /\bbackground\s+(?:must\s+be|color|exactly|EXACTLY)[^,.]*[,.]?/gi,
    /\bwide\s+empty\s+margin[^,.]*[,.]?/gi,
    /\bno\s+background\s+scene[^,.]*[,.]?/gi,
    /\b(?:subject|object)\s+must\s+NOT\s+contain[^,.]*[,.]?/gi,
    /\bEXACTLY\s+color\s+#[0-9A-Fa-f]{6}[^,.]*[,.]?/gi,
  ];

  patterns.forEach((re) => {
    text = text.replace(re, ' ');
  });

  return text.replace(/\s{2,}/g, ' ').replace(/^[\s,.-]+|[\s,.-]+$/g, '').trim();
}

function listChromaPalette() {
  return CHROMA_PALETTE.map((c) => ({ hex: c.hex, name: c.name, label: c.label }));
}

module.exports = {
  pickChromaColor,
  pickChromaFromPngBuffer,
  buildChromaFluxInstruction,
  stripChromaPromptNoise,
  hexToRgb,
  normalizeHex,
  listChromaPalette,
  CHROMA_PALETTE,
};
