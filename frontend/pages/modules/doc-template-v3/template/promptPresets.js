/**
 * Template lié à un contrat de bloc versionné.
 * Page principale = champs du contrat (IA : prompt / context / rag).
 * Sortie = format optionnel. Données d’entrée = champs {{}} intégrés (informatif).
 */

export const IA_CONTRACT_FALLBACK = {
  brickId: 'ia',
  version: '1.1.0',
  fields: [
    { key: 'prompt', label: 'Prompt', required: true, type: 'textarea', overlay: true },
    { key: 'context', label: 'Contexte', required: false, type: 'textarea', overlay: true },
    { key: 'rag', label: 'RAG', required: false, type: 'textarea', overlay: true },
    { key: 'llmId', label: 'Modèle', required: false, type: 'select', overlay: false },
    { key: 'temperature', label: 'Température', required: false, type: 'number', overlay: false, advanced: true },
    { key: 'maxTokens', label: 'Max tokens', required: false, type: 'number', overlay: false, advanced: true }
  ]
};

export const PROMPT_VARIABLES = [
  { key: 'subject', label: 'Sujet', type: 'textarea' },
  { key: 'text', label: 'Texte / corps', type: 'textarea' },
  { key: 'from', label: 'Expéditeur', type: 'text' },
  { key: 'attachments', label: 'Pièces jointes', type: 'array' },
  { key: 'intentions', label: 'Liste d’intentions', type: 'textarea' },
  { key: 'date', label: 'Date', type: 'text' },
  { key: 'brief', label: 'Demande / brief', type: 'textarea' },
  { key: 'agentContext', label: 'Contexte agent', type: 'textarea' },
  { key: 'fields', label: 'Contrat de champs', type: 'textarea' },
  { key: 'reviewContext', label: 'Contexte de page', type: 'textarea' }
];

export const ITEM_ENVELOPE_KEYS = ['items', 'item', 'itemsCount', 'itemIndex'];

export const FIELD_INSERT_ALIAS = {
  from: 'expediteur',
  subject: 'sujet',
  text: 'texte',
  body: 'texte',
  to: 'destinataire'
};

export const IA_RESERVED_KEYS = ['prompt', 'context', 'rag', 'llmId', 'llm', 'model', 'temperature', 'maxTokens', 'max_tokens'];

function dataLines(keys) {
  return (keys || []).map((key) => {
    const meta = PROMPT_VARIABLES.find((v) => v.key === key);
    return `${meta ? meta.label : key} : {{${key}}}`;
  }).join('\n');
}

function presetPrompt(instruction, keys) {
  const body = String(instruction || '').trim();
  const data = dataLines(keys);
  if (!data) return body;
  return body + (body ? '\n\n' : '') + 'Données :\n' + data;
}

export const PROMPT_PRESETS = [
  {
    id: 'intention',
    label: 'Détection d’intention',
    values: {
      context: 'Tu es l’assistant de tri des messages de l’entreprise. Réponds en français, de façon factuelle.',
      prompt: 'Classe chaque message dans la liste d’intentions. Le champ "intention" doit être EXACTEMENT un identifiant de la liste (ex. commercial, sav, generic). Le champ "confiance" est un nombre entre 0 et 1 (ne recopie pas la valeur d’exemple). Le champ "resume" est un résumé libre.\n'
        + 'S’il y a N messages, le JSON contient N objets, dans le même ordre.\n\n'
        + '{{#donnees[i]}}\n--- Message {{itemNumber}} ---\nSujet : {{sujet}}\nTexte : {{texte}}\nExpéditeur : {{expediteur}}\n{{/donnees}}\n\n'
        + 'Liste d’intentions :\n{{intentions}}',
      rag: ''
    },
    outputFormat: 'json',
    outputHint: '[\n  { "intention": "commercial", "confiance": 0.8, "resume": "…" }\n]',
    variables: ['subject', 'text', 'from', 'intentions']
  },
  {
    id: 'extract',
    label: 'Extraction de champs',
    values: {
      context: 'Tu extrais des informations structurées à partir d’un message. N’invente rien : si une info manque, laisse la valeur vide.',
      prompt: presetPrompt('Extrais les informations demandées. Ne reformule pas le message, remplis uniquement les champs.', ['subject', 'text', 'from']),
      rag: ''
    },
    outputFormat: 'json',
    outputHint: '{ "nom": "", "email": "", "telephone": "", "objet": "", "montant": "" }',
    variables: ['subject', 'text', 'from']
  },
  {
    id: 'reply',
    label: 'Réponse au destinataire',
    values: {
      context: 'Tu rédiges des e-mails professionnels, clairs et courtois, en français.',
      prompt: presetPrompt('Rédige une réponse adaptée au message. Ton : professionnel, concis. N’invente pas d’engagement commercial.', ['subject', 'text', 'from', 'rag']),
      rag: ''
    },
    outputFormat: 'text',
    outputHint: 'Uniquement le corps du mail, sans objet ni signature.',
    variables: ['subject', 'text', 'from', 'rag']
  },
  {
    id: 'summary',
    label: 'Résumé',
    values: {
      context: 'Tu résumes des messages pour un opérateur humain.',
      prompt: presetPrompt('Résume le message en 3 à 5 phrases. Mentionne l’expéditeur, la demande, et s’il y a une urgence.', ['subject', 'text', 'from']),
      rag: ''
    },
    outputFormat: 'text',
    outputHint: 'Texte court, pas de puces.',
    variables: ['subject', 'text', 'from']
  },
  {
    id: 'viz-base',
    label: 'Concevoir une page de base',
    values: {
      context: 'Tu choisis UNIQUEMENT les textes du chrome d’une page d’interaction.\n'
        + 'La mise en page (nav, hero, cartes, CSS) est déjà fournie par le moteur documents. Tu n’écris pas de HTML.',
      prompt: 'À partir de la demande, remplis le JSON de libellés. Pas de HTML.\n'
        + '- name : nom court du gabarit.\n'
        + '- page_title : titre affiché (6 à 12 mots).\n'
        + '- kicker : label au-dessus du titre (2 à 4 mots).\n'
        + '- lead : chapô, 1 à 2 phrases, ce que l’humain doit faire.\n'
        + '- cta : libellé du bouton principal (Valider, Continuer…).\n'
        + '- aside : aide courte à droite.\n'
        + '\n'
        + 'Demande :\n'
        + '{{brief}}\n'
        + '\n'
        + 'Contexte de l’agent :\n'
        + '{{agentContext}}\n'
        + '\n'
        + 'Contrat (ton seulement) :\n'
        + '{{fields}}\n'
        + '{{rag}}',
      rag: ''
    },
    outputFormat: 'json',
    outputHint: '{\n'
      + '  "name": "Revue mail",\n'
      + '  "page_title": "Validation du courrier",\n'
      + '  "kicker": "À traiter",\n'
      + '  "lead": "Vérifiez l’expéditeur, le sujet et les pièces avant de valider.",\n'
      + '  "cta": "Valider",\n'
      + '  "aside": "Corrigez si besoin, puis validez ou rejetez."\n'
      + '}',
    variables: ['brief', 'agentContext', 'fields', 'rag']
  },
  {
    id: 'viz-zone',
    label: 'Concevoir une zone données',
    values: {
      context: 'Tu choisis les CARTES d’une zone de données. Le moteur documents dessine (cartes, hero, CSS). Tu n’écris pas de HTML ni de CSS.',
      prompt: 'Décris la zone en JSON. Chaque carte pointe un champ du contrat (identifiant exact).\n'
        + '- name : libellé de la zone.\n'
        + '- hero : titre du bandeau.\n'
        + '- lead : consigne courte.\n'
        + '- cards : 2 à 6 cartes. key = identifiant du contrat. kind = value (fiche), body (texte long) ou html (liste / PJ déjà en HTML). wide = true pour une carte pleine largeur.\n'
        + '- Un champ du contrat au plus une fois. N’invente aucune key.\n'
        + '\n'
        + 'Demande :\n'
        + '{{brief}}\n'
        + '\n'
        + 'Contexte de l’agent :\n'
        + '{{agentContext}}\n'
        + '\n'
        + 'Contrat — champs autorisés :\n'
        + '{{fields}}\n'
        + '{{rag}}',
      rag: ''
    },
    outputFormat: 'json',
    outputHint: '{\n'
      + '  "name": "Revue mail",\n'
      + '  "hero": "Validation du courrier",\n'
      + '  "lead": "Vérifiez l’expéditeur, le sujet et les pièces.",\n'
      + '  "cards": [\n'
      + '    { "title": "De", "key": "from", "kind": "value" },\n'
      + '    { "title": "Sujet", "key": "subject", "kind": "value" },\n'
      + '    { "title": "Message", "key": "text", "kind": "body", "wide": true },\n'
      + '    { "title": "Pièces jointes", "key": "attachments_html", "kind": "html", "wide": true }\n'
      + '  ]\n'
      + '}',
    variables: ['brief', 'agentContext', 'fields', 'rag']
  },
  {
    id: 'custom',
    label: 'Libre',
    values: { context: '', prompt: '', rag: '' },
    outputFormat: 'text',
    outputHint: '',
    variables: []
  }
];

export function slugFieldKey(raw, fallback) {
  const s = String(raw || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
  return s || fallback || '';
}

export function fieldFromPresetKey(key) {
  const meta = PROMPT_VARIABLES.find((v) => v.key === key);
  const name = String(key || '').trim();
  return {
    name,
    label: meta ? meta.label : name,
    type: meta && meta.type ? meta.type : 'textarea',
    premap: name
  };
}

export function fieldsFromKeys(keys) {
  const seen = {};
  return (Array.isArray(keys) ? keys : []).map((k) => fieldFromPresetKey(k)).filter((f) => {
    if (!f.name || seen[f.name] || IA_RESERVED_KEYS.indexOf(f.name) >= 0) return false;
    seen[f.name] = true;
    return true;
  });
}

export function normalizeCollectionField(raw, index) {
  if (!raw || typeof raw !== 'object') return null;
  const name = slugFieldKey(raw.name || raw.key || raw.id, `champ_${(index || 0) + 1}`);
  if (!name || IA_RESERVED_KEYS.indexOf(name) >= 0) return null;
  const type = String(raw.type || raw.uiType || 'textarea').toLowerCase();
  return {
    name,
    label: String(raw.label || raw.title || name),
    type: type === 'text' || type === 'number' || type === 'textarea' ? type : 'textarea',
    premap: String(raw.premap || raw.premapKey || name),
    custom: !!raw.custom
  };
}

export function normalizeCollectionFields(list) {
  const seen = {};
  const out = [];
  (Array.isArray(list) ? list : []).forEach((raw, i) => {
    const f = normalizeCollectionField(raw, i);
    if (!f || seen[f.name]) return;
    seen[f.name] = true;
    out.push(f);
  });
  return out;
}

export function emptyPromptCollection(name) {
  return {
    alias: slugFieldKey(name, 'prompt') || 'prompt',
    fields: []
  };
}

export function ensurePromptCollection(template, config) {
  const doc = template && typeof template === 'object' ? template : {};
  if (!doc.defaultCollection || typeof doc.defaultCollection !== 'object') {
    doc.defaultCollection = emptyPromptCollection(doc.name);
  }
  const col = doc.defaultCollection;
  if (!col.alias) col.alias = slugFieldKey(doc.name, 'prompt') || 'prompt';
  col.fields = normalizeCollectionFields(col.fields);
  if (!Array.isArray(doc.additionalCollections)) doc.additionalCollections = [];
  return col;
}

export function extractPlaceholders(text) {
  const found = [];
  const seen = {};
  String(text || '').replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, (_, key) => {
    const k = String(key || '').trim();
    if (!k || seen[k]) return '';
    seen[k] = true;
    found.push(k);
    return '';
  });
  return found;
}

export function extractLoopKeys(text) {
  const found = [];
  const seen = {};
  const push = (key) => {
    const k = String(key || '').trim();
    if (!k || seen[k]) return;
    seen[k] = true;
    found.push(k);
  };
  String(text || '').replace(/\{\{\s*#(?:each\s+)?([a-zA-Z0-9_]+)(?:\[[^\]]+\])?\s*\}\}/g, (_, key) => {
    push(key);
    return '';
  });
  String(text || '').replace(/\{\{\s*\/\s*([a-zA-Z0-9_]+)(?:\[[^\]]+\])?\s*\}\}/g, (_, key) => {
    push(key);
    return '';
  });
  return found;
}

export function isEnvelopeMetaKey(key) {
  const local = String(key || '').split('.').pop();
  return local === 'itemsCount' || local === 'itemIndex';
}

export function isEnvelopeKey(key) {
  const local = String(key || '').split('.').pop();
  return ITEM_ENVELOPE_KEYS.indexOf(local) >= 0;
}

export function insertAlias(local) {
  const key = String(local || '').trim();
  return FIELD_INSERT_ALIAS[key] || key;
}

export function sourceSlugOf(src, fallback) {
  if (src && src.slug) return slugFieldKey(src.slug, fallback) || fallback || 'items';
  if (src && src.provider) return slugFieldKey(src.provider, fallback) || fallback || 'items';
  if (src && src.label) return slugFieldKey(src.label, fallback) || fallback || 'items';
  if (src && src.id && String(src.id).indexOf('col:') !== 0) {
    return slugFieldKey(src.id, fallback) || fallback || 'items';
  }
  return slugFieldKey(fallback, 'items') || 'items';
}

export function rowFieldsOfSource(src) {
  const raw = (src && Array.isArray(src.fields) ? src.fields : []) || [];
  const seen = {};
  const out = [];
  raw.forEach((f) => {
    const key = String((f && (f.key || f.name)) || '').trim();
    if (!key || isEnvelopeKey(key) || seen[key]) return;
    seen[key] = true;
    const insertKey = String(f.insertKey || insertAlias(key.split('.').pop()) || key).trim();
    out.push({
      key,
      insertKey,
      label: (f && (f.label || f.key || f.name)) || key,
      type: (f && f.type) || 'text',
      premap: String((f && (f.premap || f.premapKey)) || key.split('.').pop())
    });
  });
  return out;
}

function configText(config) {
  const cfg = normalizePromptConfig(config);
  return `${cfg.values.prompt}\n${cfg.values.context}\n${cfg.values.rag}\n${cfg.outputHint}`;
}

export function usedItemGroupsFromConfig(config, sources) {
  const text = configText(config);
  const placeholders = extractPlaceholders(text);
  const loops = extractLoopKeys(text);
  const list = Array.isArray(sources) ? sources : [];
  const claimed = {};
  const groups = [];

  list.forEach((src, index) => {
    const slug = sourceSlugOf(src, src && src.id);
    const fields = rowFieldsOfSource(src);
    const prefix = slug + '.';
    const usedFields = [];
    const usedComplete = placeholders.indexOf(slug) >= 0
      || (index === 0 && placeholders.indexOf('donnees') >= 0)
      || (list.length === 1 && (placeholders.indexOf('items') >= 0 || placeholders.indexOf('item') >= 0));
    const usedLoop = loops.indexOf(slug) >= 0
      || (index === 0 && loops.indexOf('donnees') >= 0)
      || (list.length === 1 && (loops.indexOf('items') >= 0 || loops.indexOf('item') >= 0));
    placeholders.forEach((key) => {
      if (key === slug || key === 'items' || key === 'item' || key === 'donnees') return;
      const fromDonnees = index === 0 && key.indexOf('donnees.') === 0;
      if (key.indexOf(prefix) === 0 || fromDonnees) {
        const local = fromDonnees ? key.slice('donnees.'.length) : key.slice(prefix.length);
        if (local === 'length' || local === 'name') return;
        const match = fields.find((f) => f.insertKey === local || f.key === local || f.key.split('.').pop() === local);
        usedFields.push({
          key,
          local,
          label: match ? match.label : local,
          premap: match ? match.premap : local
        });
        claimed[key] = true;
        return;
      }
    });
    if (!usedComplete && !usedLoop && !usedFields.length) return;
    groups.push({
      id: (src && src.id) || slug,
      slug,
      label: (src && src.label) || slug,
      source: src,
      index,
      usedComplete,
      usedLoop,
      usedFields,
      mapFields: !!(src && src.mapFields),
      fields
    });
    claimed[slug] = true;
    if (index === 0) claimed.donnees = true;
    if (list.length === 1) {
      claimed.items = true;
      claimed.item = true;
    }
  });

  const extra = placeholders.filter((key) => {
    if (claimed[key] || isEnvelopeMetaKey(key)) return false;
    if (key === 'today' || key === 'date') return false;
    if (/\.length$/.test(key) || /\.name$/.test(key)) return false;
    return IA_RESERVED_KEYS.indexOf(key) < 0;
  }).map((key) => {
    const meta = PROMPT_VARIABLES.find((v) => v.key === key || v.key === key.split('.').pop());
    return {
      key,
      label: meta ? meta.label : key.split('.').pop(),
      source: key.indexOf('.') >= 0 ? key.split('.')[0] : 'Champ'
    };
  });

  return { groups, extra };
}

export function fillsFromValues(values) {
  const v = values && typeof values === 'object' ? values : {};
  return {
    prompt: !!String(v.prompt || '').trim(),
    context: !!String(v.context || '').trim(),
    rag: !!String(v.rag || '').trim()
  };
}

export function emptyPromptConfig() {
  return configFromPreset('custom');
}

export function configFromPreset(presetId) {
  const preset = PROMPT_PRESETS.find((p) => p.id === presetId) || PROMPT_PRESETS[0];
  const values = {
    prompt: String((preset.values && preset.values.prompt) || ''),
    context: String((preset.values && preset.values.context) || ''),
    rag: String((preset.values && preset.values.rag) || '')
  };
  return {
    preset: preset.id,
    contract: { brickId: 'ia', version: IA_CONTRACT_FALLBACK.version },
    values,
    outputFormat: preset.outputFormat || 'text',
    outputHint: preset.outputHint || '',
    variables: (preset.variables || []).slice(),
    fills: fillsFromValues(values),
    role: values.context,
    instruction: values.prompt
  };
}

export function normalizePromptConfig(raw, fallbackContent) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const fromPreset = configFromPreset(src.preset || 'custom');
  const valuesSrc = src.values && typeof src.values === 'object' ? src.values : {};
  const prompt = valuesSrc.prompt != null
    ? String(valuesSrc.prompt)
    : (src.instruction != null ? String(src.instruction) : fromPreset.values.prompt);
  const context = valuesSrc.context != null
    ? String(valuesSrc.context)
    : (src.role != null ? String(src.role) : fromPreset.values.context);
  const rag = valuesSrc.rag != null ? String(valuesSrc.rag) : fromPreset.values.rag;
  const values = {
    prompt: prompt || (fallbackContent && !context ? String(fallbackContent) : ''),
    context,
    rag
  };
  const variables = Array.isArray(src.variables)
    ? src.variables.map((k) => String(k || '').trim()).filter(Boolean)
    : extractPlaceholders(`${values.prompt}\n${values.context}\n${values.rag}`);
  return {
    preset: String(src.preset || fromPreset.preset),
    contract: {
      brickId: String((src.contract && src.contract.brickId) || 'ia'),
      version: String((src.contract && src.contract.version) || IA_CONTRACT_FALLBACK.version)
    },
    values,
    outputFormat: src.outputFormat === 'json' ? 'json' : 'text',
    outputHint: src.outputHint != null ? String(src.outputHint) : '',
    variables,
    fills: fillsFromValues(values),
    role: values.context,
    instruction: values.prompt
  };
}

export function assemblePromptContent(config) {
  const cfg = normalizePromptConfig(config);
  const parts = [];
  if (cfg.values.context.trim()) parts.push(cfg.values.context.trim());
  if (cfg.values.prompt.trim()) parts.push(cfg.values.prompt.trim());
  if (cfg.values.rag.trim()) parts.push(cfg.values.rag.trim());
  if (cfg.outputHint.trim()) {
    const title = cfg.outputFormat === 'json' ? 'Réponds uniquement en JSON :' : 'Format de sortie :';
    parts.push(`${title}\n${cfg.outputHint.trim()}`);
  }
  return parts.join('\n\n');
}

export function integratedFieldsFromConfig(config, sources) {
  const grouped = usedItemGroupsFromConfig(config, sources);
  const out = [];
  grouped.groups.forEach((g) => {
    if (g.mapFields) {
      (g.usedFields.length ? g.usedFields : g.fields.map((f) => ({
        key: g.slug + '.' + (f.insertKey || f.key),
        label: f.label,
        premap: f.premap
      }))).forEach((f) => {
        out.push({ key: f.key, label: f.label, source: g.label, item: g.slug });
      });
    } else {
      out.push({
        key: g.slug,
        label: g.label + ' (item complet)',
        source: g.label,
        item: g.slug,
        completeItem: true
      });
    }
  });
  grouped.extra.forEach((f) => {
    const local = String(f.key || '').split('.').pop();
    if (local === 'item' || local === 'items') {
      out.push({
        key: f.key,
        label: local === 'item' ? 'Item (ligne courante)' : 'Tableau (toutes les lignes)',
        source: f.source,
        completeItem: true,
        premap: local
      });
      return;
    }
    out.push(f);
  });
  return out;
}

export function contractFillsFromPrompt(config) {
  return fillsFromValues(normalizePromptConfig(config).values);
}
