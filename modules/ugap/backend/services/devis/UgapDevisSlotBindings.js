/**
 * FICHIER : modules/ugap/backend/services/devis/UgapDevisSlotBindings.js
 * RÔLE : Liaisons manuelles template ↔ collections UGAP (phase 1, mapping en dur).
 *
 * ENTRÉES : option catalogue normalisée
 * SORTIES : clé de slot, variables préfixées pour l'agent documentaire
 *
 * DÉPEND DE : aucun
 * NE PAS : logique de rendu PDF ou pricing
 *
 * APPELÉ PAR : buildDevisVariables.js
 */

/** @type {Record<string, { pick: 'single'|'all', match: (option: object) => boolean }>} */
const SLOT_BINDINGS = {
  'ugap:node:moteur': {
    pick: 'single',
    match(option) {
      const name = String(option?.name || '').toLowerCase();
      const family = String(option?.familyLabel || '').toLowerCase();
      const category = String(option?.category || '').toLowerCase();
      return /\bmoteur\b/.test(name) || /\bmoteur\b/.test(family) || /\bmoteur\b/.test(category);
    }
  }
};

const DEFAULT_TEMPLATE_NAMESPACE = 'ugap:devis:default';

function resolveTemplateNamespace(entrepriseId) {
  const id = String(entrepriseId || '').trim();
  if (id && id !== 'SYSTEM') {
    return `ugap:devis:${id}`;
  }
  return DEFAULT_TEMPLATE_NAMESPACE;
}

function pickOptionsForSlot(slotKey, selectedOptions) {
  const binding = SLOT_BINDINGS[slotKey];
  const list = Array.isArray(selectedOptions) ? selectedOptions : [];
  if (!binding) return [];
  const matched = list.filter((opt) => binding.match(opt));
  if (binding.pick === 'single') {
    return matched.length ? [matched[0]] : [];
  }
  return matched;
}

module.exports = {
  SLOT_BINDINGS,
  DEFAULT_TEMPLATE_NAMESPACE,
  resolveTemplateNamespace,
  pickOptionsForSlot
};
