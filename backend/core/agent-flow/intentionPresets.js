/**
 * Listes d'intentions préconstruites pour les agents (analyse-intention).
 * Analyse = labels + définitions uniquement (pas de destinataires).
 * Routage = règles séparées (route-intention).
 */

function intention(id, name, definition, priority = 'medium') {
  return { id, name, definition, priority };
}

const PRESETS = {
  mail: {
    id: 'mail',
    label: 'Mail',
    description: 'Boîte mail / demandes clients (commercial, SAV, technique…)',
    intentions: [
      intention('commercial', 'commercial', 'Demande commerciale : produits, prix, devis, disponibilité, information commerciale'),
      intention('sav', 'sav', 'Réclamation, SAV, problème après-vente, retour, litige client', 'urgent'),
      intention('technique', 'technique', 'Question technique : utilisation, configuration, installation, bug produit'),
      intention('administratif', 'administratif', 'Facture, contrat, document administratif, comptabilité'),
      intention('generic', 'generic', 'Autre demande ne correspondant à aucune catégorie ci-dessus')
    ]
  },
  'reseaux-sociaux': {
    id: 'reseaux-sociaux',
    label: 'Réseaux sociaux',
    description: 'Commentaires / messages Facebook, Instagram, etc.',
    intentions: [
      intention('commercial', 'commercial', 'Intérêt commercial : prix, devis, produit, commande'),
      intention('sav', 'sav', 'Problème client, réclamation, demande d\'aide après achat', 'urgent'),
      intention('critique', 'critique', 'Commentaire négatif, signalement d\'erreur, mécontentement', 'urgent'),
      intention('positif', 'positif', 'Commentaire positif, remerciement, compliment'),
      intention('spam', 'spam', 'Publicité, message indésirable, hors sujet'),
      intention('generic', 'generic', 'Autre message ne correspondant à aucune catégorie ci-dessus')
    ]
  },
  contact: {
    id: 'contact',
    label: 'Contact / formulaire',
    description: 'Formulaire de contact web, prise de rendez-vous, candidatures',
    intentions: [
      intention('devis', 'devis', 'Demande de devis, chiffrage ou proposition tarifaire'),
      intention('information', 'information', 'Demande d\'information générale (horaires, services, localisation)'),
      intention('rdv', 'rdv', 'Prise de rendez-vous ou demande de rappel'),
      intention('recrutement', 'recrutement', 'Candidature, stage, emploi'),
      intention('partenariat', 'partenariat', 'Proposition de partenariat ou collaboration'),
      intention('support', 'support', 'Aide, assistance ou support technique', 'urgent'),
      intention('generic', 'generic', 'Autre demande ne correspondant à aucune catégorie ci-dessus')
    ]
  }
};

/** Types de cible supportés par route-intention */
const ROUTE_TARGET_TYPES = [
  { id: 'emails', label: 'Emails', description: 'Destinataires mail (liste)' },
  { id: 'annuaire-service', label: 'Service Annuaire', description: 'Emails des contacts du service' },
  { id: 'flow-branch', label: 'Branche du flow', description: 'Sauter vers un nœud (ex. créer devis)' },
  { id: 'continue', label: 'Suite du flow', description: 'Suivre le lien canvas suivant' },
  { id: 'stop', label: 'Arrêter', description: 'Fin du run après le routage' }
];

function listPresets() {
  return Object.values(PRESETS).map((p) => ({
    id: p.id,
    label: p.label,
    description: p.description,
    intentionCount: p.intentions.length
  }));
}

function getPreset(presetId) {
  const key = String(presetId || '').trim();
  if (!key || !PRESETS[key]) return null;
  const p = PRESETS[key];
  return {
    id: p.id,
    label: p.label,
    description: p.description,
    intentions: p.intentions.map((it) => ({ ...it }))
  };
}

function sanitizeAnalyseIntention(it) {
  if (!it || typeof it !== 'object') return null;
  const name = String(it.name || it.id || '').trim();
  if (!name) return null;
  return {
    id: String(it.id || name),
    name,
    definition: String(it.definition || it.description || ''),
    priority: it.priority || 'medium'
  };
}

/** Retire emails / defaultEmails (legacy) de la config analyse. */
function sanitizeAnalyseConfig(cfg = {}) {
  const intentions = Array.isArray(cfg.intentions)
    ? cfg.intentions.map(sanitizeAnalyseIntention).filter(Boolean)
    : [];
  const out = {
    basePrompt: String(cfg.basePrompt || ''),
    intentions,
    intentionPresetId: cfg.intentionPresetId || null,
    intentionMode: cfg.intentionMode || 'fixed'
  };
  if (cfg.intentionSetBySource && typeof cfg.intentionSetBySource === 'object') {
    out.intentionSetBySource = { ...cfg.intentionSetBySource };
  }
  return out;
}

function buildAnalyseConfigFromPreset(presetId) {
  const preset = getPreset(presetId) || getPreset('mail');
  return sanitizeAnalyseConfig({
    basePrompt: '',
    intentions: preset.intentions,
    intentionPresetId: preset.id,
    intentionMode: 'fixed'
  });
}

function normalizeRouteTarget(target) {
  const t = target && typeof target === 'object' ? target : {};
  const type = String(t.type || 'emails').toLowerCase();
  if (type === 'annuaire-service') {
    return { type: 'annuaire-service', serviceId: String(t.serviceId || '').trim() };
  }
  if (type === 'flow-branch') {
    return {
      type: 'flow-branch',
      nextStepId: String(t.nextStepId || t.nextId || '').trim()
    };
  }
  if (type === 'stop') return { type: 'stop' };
  if (type === 'continue') return { type: 'continue' };
  const to = Array.isArray(t.to)
    ? t.to.map((e) => String(e || '').trim()).filter(Boolean)
    : (t.to ? [String(t.to).trim()].filter(Boolean) : []);
  return { type: 'emails', to };
}

function sanitizeRouteConfig(cfg = {}) {
  const rules = Array.isArray(cfg.rules)
    ? cfg.rules.map((r) => ({
        when: { intention: String((r && r.when && r.when.intention) || '').trim() },
        target: normalizeRouteTarget(r && r.target)
      }))
    : [];
  return {
    rules,
    defaultTarget: normalizeRouteTarget(cfg.defaultTarget || { type: 'emails', to: [] }),
    subjectTemplate: cfg.subjectTemplate != null
      ? String(cfg.subjectTemplate)
      : '[{{intention}}] {{subject}}',
    bodyTemplate: cfg.bodyTemplate != null
      ? String(cfg.bodyTemplate)
      : 'Intention: {{intention}}\n\nMessage:\n{{body}}'
  };
}

function intentionNames(intentions) {
  const seen = new Set();
  const names = [];
  (Array.isArray(intentions) ? intentions : []).forEach((i) => {
    const name = String(i.name || i.id || '').trim();
    if (!name) return;
    const key = name.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    names.push(name);
  });
  return names;
}

function buildRouteConfigFromIntentions(intentions) {
  return mergeRouteConfigWithIntentions(null, intentions);
}

/**
 * Aligne les règles de routage sur la liste d'intentions.
 * Conserve les cibles déjà configurées pour les intentions qui restent ;
 * crée des cibles emails vides pour les nouvelles ; retire les orphelines.
 */
function mergeRouteConfigWithIntentions(existingRouteCfg, intentions) {
  const base = sanitizeRouteConfig(existingRouteCfg || {});
  const names = intentionNames(intentions);
  const byKey = {};
  (base.rules || []).forEach((r) => {
    const key = String((r.when && r.when.intention) || '').trim().toLowerCase();
    if (!key || byKey[key]) return;
    byKey[key] = r;
  });

  const rules = names.map((name) => {
    const prev = byKey[name.toLowerCase()];
    return {
      when: { intention: name },
      target: normalizeRouteTarget((prev && prev.target) || { type: 'emails', to: [] })
    };
  });

  return sanitizeRouteConfig({
    rules,
    defaultTarget: base.defaultTarget || { type: 'emails', to: [] },
    subjectTemplate: base.subjectTemplate,
    bodyTemplate: base.bodyTemplate
  });
}

module.exports = {
  PRESETS,
  ROUTE_TARGET_TYPES,
  listPresets,
  getPreset,
  sanitizeAnalyseConfig,
  sanitizeRouteConfig,
  normalizeRouteTarget,
  buildAnalyseConfigFromPreset,
  buildRouteConfigFromIntentions,
  mergeRouteConfigWithIntentions,
  intentionNames
};
