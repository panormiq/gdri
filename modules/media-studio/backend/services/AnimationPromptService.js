/**
 * Prompt → spec d'animation (zones + effets calque entier).
 * Règles FR/EN — complété par JSON LLM côté client si besoin.
 */

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function autoGlowZones() {
  return [
    { x: 0.08, y: 0.12, w: 0.22, h: 0.18 },
    { x: 0.38, y: 0.08, w: 0.24, h: 0.2 },
    { x: 0.68, y: 0.14, w: 0.2, h: 0.16 },
    { x: 0.25, y: 0.32, w: 0.5, h: 0.12 },
  ];
}

function autoButtonZones() {
  return [
    { x: 0.12, y: 0.62, w: 0.18, h: 0.14 },
    { x: 0.38, y: 0.68, w: 0.16, h: 0.12 },
    { x: 0.58, y: 0.64, w: 0.14, h: 0.13 },
    { x: 0.74, y: 0.7, w: 0.12, h: 0.11 },
  ];
}

/** Chargeur / magasin (partie basse-centre typique d'un pistolet). */
function autoMagazineZones() {
  return [
    { x: 0.32, y: 0.52, w: 0.24, h: 0.38 },
    { x: 0.36, y: 0.68, w: 0.18, h: 0.14 },
  ];
}

/** Boutons / curseurs sur le côté ou la culasse. */
function autoSideControlZones() {
  return [
    { x: 0.02, y: 0.28, w: 0.14, h: 0.09 },
    { x: 0.02, y: 0.42, w: 0.14, h: 0.09 },
    { x: 0.78, y: 0.22, w: 0.16, h: 0.12 },
  ];
}

function autoRuneLineZones() {
  return [
    { x: 0.15, y: 0.2, w: 0.7, h: 0.08 },
    { x: 0.2, y: 0.32, w: 0.6, h: 0.08 },
    { x: 0.25, y: 0.44, w: 0.5, h: 0.08 },
  ];
}

const SYSTEM_PROMPT = `Tu es l'assistant animation du Studio Média GDRI.
L'utilisateur décrit une animation pour UN calque PNG (objet isolé).
Réponds UNIQUEMENT avec un JSON valide (pas de markdown) :
{
  "effects": [
    { "type": "glow|button|pulse|float|shake|rotate", "target": "full|zones", "zones": [{"x":0.1,"y":0.2,"w":0.15,"h":0.1}], "speed": 1, "intensity": 0.8, "depth": 5, "amount": 0.04 }
  ],
  "summary": "courte description"
}
- x,y,w,h des zones = fractions 0–1 de l'image.
- glow = lueur runes/lumière · button = pression · pulse = pulsation · float = léger flottement · shake = secousse · rotate = rotation légère.
- Combine plusieurs effets si le prompt le demande.`;

function parseJsonFromText(text) {
  if (!text) return null;
  const raw = String(text).trim();
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1].trim() : raw;
  try {
    return JSON.parse(candidate);
  } catch {
    const start = candidate.indexOf('{');
    const end = candidate.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(candidate.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

function normalizeSpec(input, width, height) {
  const effects = Array.isArray(input?.effects) ? input.effects : [];
  const out = [];
  effects.forEach((eff) => {
    const type = String(eff.type || 'pulse').toLowerCase();
    const allowed = ['glow', 'button', 'pulse', 'float', 'shake', 'rotate'];
    if (!allowed.includes(type)) return;
    const target = eff.target === 'full' ? 'full' : 'zones';
    const item = {
      type,
      target,
      speed: clamp(Number(eff.speed) || 1, 0.2, 4),
      intensity: clamp(Number(eff.intensity) || 0.75, 0.1, 1),
      depth: clamp(Number(eff.depth) || 5, 1, 20),
      amount: clamp(Number(eff.amount) || 0.04, 0.01, 0.2),
      zones: [],
    };
    if (target === 'zones' || type === 'glow' || type === 'button') {
      const rawZones = Array.isArray(eff.zones) && eff.zones.length ? eff.zones : null;
      if (rawZones) {
        item.zones = rawZones.map((z) => ({
          x: clamp(Number(z.x) || 0, 0, 0.95),
          y: clamp(Number(z.y) || 0, 0, 0.95),
          w: clamp(Number(z.w ?? z.width) || 0.15, 0.03, 1),
          h: clamp(Number(z.h ?? z.height) || 0.12, 0.03, 1),
        }));
      } else if (type === 'glow') {
        item.zones = autoGlowZones();
      } else if (type === 'button') {
        item.zones = autoButtonZones();
      }
      item.target = 'zones';
    }
    out.push(item);
  });
  return {
    effects: out,
    summary: String(input?.summary || '').slice(0, 120),
    width,
    height,
  };
}

function parsePromptRules(prompt, width, height) {
  const p = String(prompt || '').toLowerCase();
  const effects = [];

  if (/rune|runes|glyphe|sigil|lumi[eè]re|illumin|glow|bright|shine|lumineux/.test(p)) {
    const zones = /ligne|bande|trait|line/.test(p) ? autoRuneLineZones() : autoGlowZones();
    effects.push({ type: 'glow', target: 'zones', zones, speed: /rapide|fast|vif/.test(p) ? 1.8 : 1, intensity: 0.85 });
  }
  if (/bouton|button|press|clic|switch|levier|trigger|g[aâ]chette/.test(p)) {
    effects.push({ type: 'button', target: 'zones', zones: autoButtonZones(), speed: /rapide|fast/.test(p) ? 1.5 : 1.1, depth: 6 });
  }
  if (/pisto|tir|feu|recul|shoot|arme|gun|firearm|cartouch/.test(p)) {
    effects.push({ type: 'shake', target: 'full', speed: 4, amount: 5 });
  }
  if (/chargeur|magazine|balle.*vid|vid.*balle|cartouche.*vid|se vide/.test(p)) {
    effects.push({
      type: 'button',
      target: 'zones',
      zones: autoMagazineZones(),
      speed: /rapide|fast|tir/.test(p) ? 1.6 : 1.2,
      depth: 8,
    });
  }
  if (/couliss|gliss|slide/.test(p) || (/bouton/.test(p) && /c[oô]t/.test(p))) {
    effects.push({
      type: 'button',
      target: 'zones',
      zones: autoSideControlZones(),
      speed: 1.3,
      depth: 5,
    });
  }
  if (/pulse|puls|beat|respir|throb/.test(p)) {
    effects.push({ type: 'pulse', target: 'full', speed: 1, amount: 0.045 });
  }
  if (/flott|float|levit|hover|suspend/.test(p)) {
    effects.push({ type: 'float', target: 'full', speed: 0.7, amount: 10 });
  }
  if (/secou|shake|vibr|trembl/.test(p)) {
    effects.push({ type: 'shake', target: 'full', speed: 2.5, amount: 4 });
  }
  if (/tourne|rotat|spin|pivot/.test(p)) {
    effects.push({ type: 'rotate', target: 'full', speed: 0.6, amount: 6 });
  }

  if (!effects.length) {
    effects.push({ type: 'pulse', target: 'full', speed: 1, amount: 0.035 });
  }

  return normalizeSpec({ effects, summary: prompt }, width, height);
}

function specToLayerData(spec, imageWidth, imageHeight) {
  const iw = imageWidth || 256;
  const ih = imageHeight || 256;
  const pixelZones = [];
  const fullEffects = [];

  (spec.effects || []).forEach((eff) => {
    if (eff.type === 'glow' || eff.type === 'button') {
      (eff.zones || []).forEach((z, i) => {
        pixelZones.push({
          type: eff.type,
          x: clamp(Math.round(z.x * iw), 0, iw - 4),
          y: clamp(Math.round(z.y * ih), 0, ih - 4),
          width: clamp(Math.round(z.w * iw), 4, iw),
          height: clamp(Math.round(z.h * ih), 4, ih),
          speed: eff.speed,
          depth: eff.depth,
          intensity: eff.intensity,
          phase: i * 0.9 + Math.random(),
        });
      });
    } else {
      fullEffects.push(eff);
    }
  });

  return { pixelZones, fullEffects, summary: spec.summary };
}

class AnimationPromptService {
  getSystemPrompt() {
    return SYSTEM_PROMPT;
  }

  parseFromRules(prompt, width, height) {
    return parsePromptRules(prompt, width, height);
  }

  parseFromLlmText(text, width, height) {
    const json = parseJsonFromText(text);
    if (!json) return null;
    return normalizeSpec(json, width, height);
  }

  mergeSpecs(rulesSpec, llmSpec) {
    if (!llmSpec || !llmSpec.effects?.length) return rulesSpec;
    return normalizeSpec({
      effects: [...(rulesSpec.effects || []), ...(llmSpec.effects || [])],
      summary: llmSpec.summary || rulesSpec.summary,
    }, rulesSpec.width, rulesSpec.height);
  }

  applySpecToLayer(layer, cadreId, spec, imageWidth, imageHeight) {
    const { pixelZones, fullEffects, summary } = specToLayerData(spec, imageWidth, imageHeight);
    if (!layer.zonesByCadre) layer.zonesByCadre = {};
    layer.zonesByCadre[cadreId] = pixelZones.map((z, i) => ({
      id: `z-${Date.now().toString(36)}-${i}`,
      ...z,
    }));
    if (!layer.fullEffectsByCadre) layer.fullEffectsByCadre = {};
    layer.fullEffectsByCadre[cadreId] = fullEffects;
    layer.animationPrompt = summary || layer.animationPrompt;
    layer.animationSummary = summary;
    return { zoneCount: pixelZones.length, fullEffectCount: fullEffects.length };
  }
}

module.exports = AnimationPromptService;
