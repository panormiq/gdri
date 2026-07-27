/**
 * Résout messages + liste d'intentions + prompt pour le bloc IA analyse-intention.
 * La source (mail / facebook…) influence la liste en amont, pas dans le LLM.
 */

const { getPreset } = require('./intentionPresets');

const CHANNEL_PRESET = {
  facebook: 'reseaux-sociaux',
  'reseaux-sociaux': 'reseaux-sociaux',
  social: 'reseaux-sociaux',
  mail: 'mail',
  email: 'mail',
  contact: 'contact',
  formulaire: 'contact',
  web: 'contact'
};

function detectChannel(context = {}) {
  const msg = context.message || {};
  const opts = context.options || {};
  const trigger = context.trigger || {};
  const raw =
    opts.channel ||
    msg.channel ||
    trigger.payload?.channel ||
    trigger.brickId ||
    trigger.mode ||
    '';
  return String(raw).toLowerCase().replace(/^facebook\..*/, 'facebook');
}

function normalizeIntentions(list) {
  if (!Array.isArray(list)) return [];
  return list
    .map((it) => {
      if (typeof it === 'string') {
        return { id: it, name: it, definition: '', priority: 'medium' };
      }
      const name = String(it.name || it.id || '').trim();
      if (!name) return null;
      return {
        id: String(it.id || name),
        name,
        definition: String(it.definition || it.description || ''),
        priority: it.priority || 'medium'
      };
    })
    .filter(Boolean);
}

/**
 * @param {Object} analyseCfg - brick-config analyse-intention
 * @param {Object} context - run context
 * @param {Object} [nodeConfig] - config du nœud canvas
 */
function resolveIntentionList(analyseCfg = {}, context = {}, nodeConfig = {}) {
  const opts = context.options || {};

  if (Array.isArray(nodeConfig.intentions) && nodeConfig.intentions.length) {
    return {
      intentions: normalizeIntentions(nodeConfig.intentions),
      source: 'node',
      presetId: null
    };
  }

  if (Array.isArray(opts.intentions) && opts.intentions.length) {
    return {
      intentions: normalizeIntentions(opts.intentions),
      source: 'options.intentions',
      presetId: null
    };
  }

  const presetFromOpts = opts.intentionSet || opts.intentionPresetId || null;
  if (presetFromOpts && typeof presetFromOpts === 'string') {
    const preset = getPreset(presetFromOpts);
    if (preset) {
      return {
        intentions: normalizeIntentions(preset.intentions),
        source: 'options.intentionSet',
        presetId: preset.id
      };
    }
  }

  const mode = String(analyseCfg.intentionMode || 'fixed').toLowerCase();
  const channel = detectChannel(context);

  if (mode === 'by-source' || mode === 'selon-source') {
    const map = analyseCfg.intentionSetBySource || {};
    const presetId = map[channel] || CHANNEL_PRESET[channel] || analyseCfg.intentionPresetId || 'mail';
    const preset = getPreset(presetId);
    if (preset) {
      return {
        intentions: normalizeIntentions(preset.intentions),
        source: 'by-source',
        presetId: preset.id,
        channel
      };
    }
  }

  if (analyseCfg.intentionPresetId) {
    const preset = getPreset(analyseCfg.intentionPresetId);
    if (preset) {
      return {
        intentions: normalizeIntentions(preset.intentions),
        source: 'preset',
        presetId: preset.id
      };
    }
  }

  if (Array.isArray(analyseCfg.intentions) && analyseCfg.intentions.length) {
    return {
      intentions: normalizeIntentions(analyseCfg.intentions),
      source: 'config',
      presetId: analyseCfg.intentionPresetId || null
    };
  }

  const fallback = getPreset(CHANNEL_PRESET[channel] || 'mail');
  return {
    intentions: normalizeIntentions(fallback ? fallback.intentions : []),
    source: 'default',
    presetId: fallback ? fallback.id : 'mail',
    channel
  };
}

function resolvePrompt(analyseCfg = {}, nodeConfig = {}, context = {}) {
  return (
    (nodeConfig && nodeConfig.prompt) ||
    (context.options && context.options.prompt) ||
    analyseCfg.basePrompt ||
    null
  );
}

/**
 * Extraire 1..n messages depuis le contexte.
 */
function resolveMessages(context = {}, nodeConfig = {}) {
  const field = String(nodeConfig.messageField || 'text').trim() || 'text';
  const src = context.message || context.previous || {};

  if (Array.isArray(context.messages) && context.messages.length) {
    return context.messages.map((m) => {
      if (typeof m === 'string') return { text: m, message: m, author: { name: 'user' } };
      const text = m.text || m.message || m.body || m[field] || '';
      return {
        text: String(text),
        message: String(text),
        author: { name: m.from || m.author?.name || 'user' },
        created_time: m.created_time || m.timestamp
      };
    });
  }

  if (Array.isArray(src.messages) && src.messages.length) {
    return resolveMessages({ messages: src.messages }, nodeConfig);
  }

  const text =
    src[field] || src.text || src.body || src.message || src.subject || '';
  return [
    {
      text: String(text),
      message: String(text),
      author: { name: src.from || 'user' },
      created_time: src.created_time || src.timestamp
    }
  ];
}

module.exports = {
  CHANNEL_PRESET,
  detectChannel,
  normalizeIntentions,
  resolveIntentionList,
  resolvePrompt,
  resolveMessages
};
