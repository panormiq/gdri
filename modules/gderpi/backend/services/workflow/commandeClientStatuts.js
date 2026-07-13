/**
 * FICHIER : modules/gderpi/backend/services/workflow/commandeClientStatuts.js
 * RÔLE : Statuts pipeline commande client et normalisation legacy.
 */

const STATUTS = new Set([
  'validee_client',
  'a_valider_gdri',
  'validee_gdri',
  'achats_en_cours',
  'attente_livraison_frs',
  'a_livrer',
  'livree',
  'a_facturer',
  'facturee',
  'facturee_partiellement',
  'annulee'
]);

const LEGACY_STATUT_MAP = {
  confirmee: 'validee_gdri',
  en_cours: 'validee_gdri'
};

const MANUAL_TRANSITIONS = {
  validee_client: new Set(['annulee']),
  a_valider_gdri: new Set(['annulee']),
  validee_gdri: new Set(['annulee']),
  achats_en_cours: new Set(['annulee']),
  attente_livraison_frs: new Set(['annulee']),
  a_livrer: new Set(['annulee']),
  livree: new Set(['annulee']),
  a_facturer: new Set(['annulee']),
  facturee: new Set([]),
  facturee_partiellement: new Set(['annulee']),
  annulee: new Set([])
};

function normalizeCommandeStatut(raw) {
  const s = String(raw || 'validee_client').trim().toLowerCase();
  if (STATUTS.has(s)) return s;
  if (LEGACY_STATUT_MAP[s]) return LEGACY_STATUT_MAP[s];
  return 'validee_client';
}

module.exports = {
  STATUTS,
  LEGACY_STATUT_MAP,
  MANUAL_TRANSITIONS,
  normalizeCommandeStatut
};
