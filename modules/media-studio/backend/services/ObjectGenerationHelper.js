/**
 * Génération objets — prompt Flux + couleur chroma adaptée au sujet.
 */

const { pickChromaColor, buildChromaFluxInstruction, stripChromaPromptNoise } = require('./ChromaColorService');

const KIND_HINTS = {
  'french-flag': 'French tricolor flag, three equal vertical stripes blue white red, full flag visible, fabric',
};

function detectObjectKind(meta = {}) {
  const prompt = String(meta.prompt || '').trim().toLowerCase();
  if (prompt) {
    if (/drapeau|french flag|tricolore|tricolor|français|france flag/.test(prompt)) {
      return 'french-flag';
    }
    return 'generic';
  }
  const context = `${meta.id || ''} ${meta.title || ''} ${meta.description || ''}`.toLowerCase();
  if (/drapeau|french flag|tricolore|tricolor|français|france flag|flag-fr/.test(context)) {
    return 'french-flag';
  }
  return 'generic';
}

function getIntrinsicAspect(kind) {
  if (kind === 'french-flag') return 3 / 2;
  return 1;
}

function snapFluxDim(n, min = 64, max = 768) {
  let v = Math.round(n);
  v = Math.max(min, Math.min(max, v));
  v = Math.round(v / 8) * 8;
  return Math.max(min, v);
}

function fitAspectRatio(aspectW, aspectH, maxPx = 768, minPx = 64) {
  let w;
  let h;
  if (aspectW >= aspectH) {
    w = maxPx;
    h = maxPx * (aspectH / aspectW);
  } else {
    h = maxPx;
    w = maxPx * (aspectW / aspectH);
  }
  return {
    width: snapFluxDim(w, minPx, maxPx),
    height: snapFluxDim(h, minPx, maxPx),
  };
}

function getObjectGenerationSize(meta = {}) {
  const kind = detectObjectKind(meta);
  const aspect = getIntrinsicAspect(kind);
  return fitAspectRatio(aspect, 1, 768, 64);
}

function resolveChroma(meta = {}) {
  if (meta.chromaColor) {
    return pickChromaColor(meta.prompt || '', meta.chromaColor);
  }
  return pickChromaColor(meta.prompt || '');
}

function wrapObjectPrompt(prompt, meta = {}) {
  const base = stripChromaPromptNoise(String(prompt || '').trim()) || 'isolated object';
  const kind = detectObjectKind({ prompt: base });
  const chroma = resolveChroma({ ...meta, prompt: base });
  const hint = KIND_HINTS[kind] || '';
  const parts = [base];
  if (hint && kind === 'french-flag' && !base.toLowerCase().includes('tricolor') && !base.toLowerCase().includes('three')) {
    parts.push(hint);
  }
  parts.push('single object centered in frame, entire object visible, not cropped');
  parts.push(buildChromaFluxInstruction(chroma));
  return { prompt: parts.join(', '), chroma };
}

module.exports = {
  detectObjectKind,
  getObjectGenerationSize,
  wrapObjectPrompt,
  resolveChroma,
};
