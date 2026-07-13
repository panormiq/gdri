/**
 * FICHIER : modules/ugap/backend/services/devis/resolveDevisLabels.js
 * RÔLE : Résout les libellés et références affichés dans le tableau devis.
 *
 * ENTRÉES : option catalogue normalisée
 * SORTIES : libellé UGAP, libellé app, réf. UGAP
 *
 * DÉPEND DE : aucun
 * NE PAS : rendu HTML, pricing
 *
 * APPELÉ PAR : renderDevisTableHtml.js
 *
 * Règle métier :
 * - Libellé UGAP = libellé Excel source (importExcelLabel), y compris si modifié au paramétrage.
 * - Si absent : repli sur le nom de l'option (name).
 * - Libellé app = libellé affiché dans l'app (importOptionLabel ou name).
 * - Réf. UGAP = refUgap catalogue (valeur Excel, y compris MINO pour les minorations).
 */

const {
  isTechnicalCatalogRef,
  sanitizeUgapRefForDisplay,
} = require('../ugap-ref-display');

/** Retire le préfixe classificateur « MINO » des libellés affichés (pas de la réf. UGAP). */
function stripMinoPrefix(value) {
  return String(value || '')
    .replace(/^MINO[\s\-_.]*/i, '')
    .replace(/^(moins-value|moins\s+value)[\s\-_.]*/i, '')
    .trim();
}

function sanitizeDevisUgapLabelDisplay(label) {
  const raw = String(label || '').trim();
  if (!raw) return '';
  return stripMinoPrefix(raw) || raw;
}

function resolveDevisRefUgap(opt) {
  const o = opt && typeof opt === 'object' ? opt : {};
  const ref = sanitizeUgapRefForDisplay(String(o.refUgap || o.baseRefUgap || '').trim());
  return ref;
}

function resolveDevisUgapLabel(opt) {
  const o = opt && typeof opt === 'object' ? opt : {};
  const raw = String(o.importExcelLabel || o.details || o.name || o.libelle || '').trim();
  return sanitizeDevisUgapLabelDisplay(raw);
}

function resolveDevisAppLabel(opt) {
  const o = opt && typeof opt === 'object' ? opt : {};
  const custom = String(o.importOptionLabel || '').trim();
  if (custom) return sanitizeDevisUgapLabelDisplay(custom);
  return sanitizeDevisUgapLabelDisplay(o.name || o.libelleApp || '');
}

module.exports = {
  resolveDevisRefUgap,
  resolveDevisUgapLabel,
  resolveDevisAppLabel,
  isTechnicalCatalogRef,
  stripMinoPrefix,
  sanitizeDevisUgapLabelDisplay
};
