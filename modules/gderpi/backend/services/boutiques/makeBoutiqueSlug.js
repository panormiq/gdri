/**
 * FICHIER : modules/gderpi/backend/services/boutiques/makeBoutiqueSlug.js
 * RÔLE : Génère un slug URL-safe à partir d'un libellé boutique.
 *
 * ENTRÉES : string nom
 * SORTIES : slug lowercase
 *
 * DÉPEND DE : aucun
 * NE PAS : persistance Mongo
 *
 * APPELÉ PAR : normalizeBoutique.js
 */

function makeBoutiqueSlug(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'boutique';
}

module.exports = makeBoutiqueSlug;
