/**
 * Conception visualisation — étape 1 : design web (couleurs, logo, zones).
 * Étape 2 (contenu) viendra ensuite.
 */

const { ObjectId } = require('mongodb');
const database = require('../../config/database');
const { normalizeDesign, buildDesignHtml, DEFAULT_COLORS, DEFAULT_PROMPT } = require('./vizDesign');

const FLOW_TEMPLATE_ID = 'agent-viz-conception';

function vizConceptionFlow(entrepriseId) {
  return {
    name: 'Design visualisation',
    description: 'Étape 1 : page web partagée (couleurs, logo, zones).',
    enabled: true,
    templateId: FLOW_TEMPLATE_ID,
    entrepriseId
  };
}

function formatFields(dataContract) {
  const fields = (dataContract && Array.isArray(dataContract.fields)) ? dataContract.fields : [];
  if (!fields.length) {
    return ['from — Expéditeur', 'subject — Sujet', 'text — Texte'].join('\n');
  }
  return fields
    .filter((f) => f && f.key)
    .map((f) => `${f.key} — ${f.label || f.key}`)
    .join('\n');
}

async function saveDesignTemplate(entrepriseId, { id, name, html }) {
  const db = await database.getEntrepriseDb(entrepriseId);
  const now = new Date();
  const eid = ObjectId.isValid(String(entrepriseId)) && String(entrepriseId).length === 24
    ? new ObjectId(String(entrepriseId))
    : entrepriseId;
  const setDoc = {
    name,
    kind: 'html',
    documentMode: '',
    content: html,
    nodes: [],
    fills: { body: true },
    updatedAt: now
  };
  let tid = String(id || '').trim();
  if (tid && ObjectId.isValid(tid) && tid.length === 24) {
    const existing = await db.collection('templates').findOne({ _id: new ObjectId(tid) });
    if (existing) {
      await db.collection('templates').updateOne(
        { _id: new ObjectId(tid) },
        { $set: setDoc }
      );
      return tid;
    }
  }
  const result = await db.collection('templates').insertOne({
    ...setDoc,
    defaultCollection: null,
    additionalCollections: [],
    inputSources: [],
    entrepriseId: eid,
    createdAt: now
  });
  return String(result.insertedId);
}

async function applyVizDesign(opts = {}) {
  const entrepriseId = opts.entrepriseId;
  if (!entrepriseId) throw new Error('Entité requise');
  const design = normalizeDesign(opts.design);
  const html = buildDesignHtml(design);
  const name = String(opts.name || 'Design agent').trim() || 'Design agent';
  const id = await saveDesignTemplate(entrepriseId, {
    id: design.templateId || opts.templateId || '',
    name,
    html
  });
  return {
    design: { ...design, templateId: id },
    template: { id, name, kind: 'html' }
  };
}

function fallbackSuggest(brief) {
  const text = String(brief || '').toLowerCase();
  const colors = { ...DEFAULT_COLORS };
  if (/sombre|dark|nuit|noir/.test(text)) {
    colors.primary = '#1d4ed8';
    colors.background = '#0f172a';
    colors.surface = '#1e293b';
    colors.text = '#f8fafc';
    colors.muted = '#94a3b8';
  } else if (/vert|green/.test(text)) {
    colors.primary = '#059669';
  } else if (/rouge|red/.test(text)) {
    colors.primary = '#dc2626';
  } else if (/orange/.test(text)) {
    colors.primary = '#ea580c';
  }
  const zones = ['nav', 'data'];
  if (/onglet|tab|etape|étape|avancement/.test(text) && !zones.includes('tabs')) {
    /* nav suffit */
  }
  if (/aside|aide|contexte/.test(text)) zones.push('aside');
  return {
    colors,
    zones,
    logoUrl: '',
    prompt: String(brief || '').trim()
  };
}

async function suggestVizDesign(opts = {}) {
  const brief = String(opts.brief || opts.prompt || '').trim() || DEFAULT_PROMPT;
  let suggested = null;
  let source = 'fallback';
  let iaError = null;
  try {
    const path = require('path');
    const PromptService = require(path.resolve(
      __dirname,
      '../../../modules/prompt/backend/services/PromptService'
    ));
    const promptService = opts.entrepriseId
      ? await PromptService.forEntity(String(opts.entrepriseId))
      : PromptService.global();
    const gen = await promptService.generateJson(
      [
        'Tu proposes le DESIGN d’une page web d’agent (pas le contenu métier).',
        'JSON uniquement.',
        '{ "primary":"#hex", "background":"#hex", "surface":"#hex", "text":"#hex", "muted":"#hex", "zones":["nav","data"], "logoUrl":"" }',
        '- Couleurs hex #rrggbb.',
        '- zones : nav (onglets / étapes) et data obligatoires. Ajoute aside si utile.',
        '- logoUrl seulement si une URL est donnée dans la demande.',
        '',
        'Demande :',
        brief
      ].join('\n'),
      { max_tokens: 400, temperature: 0.3 },
      {
        retries: 1,
        validate: (data) => {
          if (!data || typeof data !== 'object') return null;
          return normalizeDesign({
            colors: {
              primary: data.primary,
              background: data.background,
              surface: data.surface,
              text: data.text,
              muted: data.muted
            },
            zones: data.zones,
            logoUrl: data.logoUrl,
            prompt: brief
          });
        }
      }
    );
    if (gen.success && gen.data) {
      suggested = gen.data;
      source = 'ia';
    } else {
      iaError = (gen.error && gen.error.message) || 'Réponse IA invalide';
    }
  } catch (err) {
    iaError = err.message || 'IA indisponible';
  }
  if (!suggested) suggested = normalizeDesign(fallbackSuggest(brief));
  return { design: suggested, source, iaError };
}

async function forkDesignTemplate(entrepriseId, templateId, name) {
  const db = await database.getEntrepriseDb(entrepriseId);
  const tid = String(templateId || '').trim();
  if (!tid || !ObjectId.isValid(tid) || tid.length !== 24) {
    throw new Error('Aucun design à séparer. Appliquez d’abord le design partagé.');
  }
  const src = await db.collection('templates').findOne({ _id: new ObjectId(tid) });
  if (!src) throw new Error('Design introuvable');
  const now = new Date();
  const copy = { ...src };
  delete copy._id;
  copy.name = String(name || (src.name + ' (dédié)')).trim() || 'Design dédié';
  copy.createdAt = now;
  copy.updatedAt = now;
  const result = await db.collection('templates').insertOne(copy);
  return {
    template: { id: String(result.insertedId), name: copy.name, kind: copy.kind || 'html' }
  };
}

/** Conservé pour l’API existante : étape 1 uniquement. */
async function runVizConception(executor, opts = {}) {
  return applyVizDesign({
    entrepriseId: opts.entrepriseId,
    templateId: opts.templateId || opts.baseTemplateId || '',
    design: opts.design || {},
    name: opts.name
  });
}

module.exports = {
  FLOW_TEMPLATE_ID,
  vizConceptionFlow,
  runVizConception,
  applyVizDesign,
  suggestVizDesign,
  forkDesignTemplate,
  formatFields
};
