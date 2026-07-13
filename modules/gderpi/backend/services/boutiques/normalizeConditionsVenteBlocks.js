/**
 * FICHIER : modules/gderpi/backend/services/boutiques/normalizeConditionsVenteBlocks.js
 * RÔLE : Normalise les blocs conditions de vente d'une boutique.
 */

const BLOCK_KEYS = [
  'communes',
  'paiementProModes',
  'paiementProDelais',
  'livraisonPro',
  'garantiesPro',
  'litigesPro',
  'paiementParticulier',
  'retourParticulier',
  'livraisonParticulier',
  'garantiesParticulier',
  'litigesParticulier'
];

function migrateLegacyBlocks(nested, blocks) {
  const legacyLivraison = String(nested.livraison || '').trim();
  const legacyGaranties = String(nested.garanties || '').trim();
  const legacyLitiges = String(nested.litiges || '').trim();
  const legacyPaiementPro = String(nested.paiementPro || '').trim();

  if (!blocks.livraisonPro && legacyLivraison) blocks.livraisonPro = legacyLivraison;
  if (!blocks.livraisonParticulier && legacyLivraison) blocks.livraisonParticulier = legacyLivraison;
  if (!blocks.garantiesPro && legacyGaranties) blocks.garantiesPro = legacyGaranties;
  if (!blocks.garantiesParticulier && legacyGaranties) blocks.garantiesParticulier = legacyGaranties;
  if (!blocks.litigesPro && legacyLitiges) blocks.litigesPro = legacyLitiges;
  if (!blocks.litigesParticulier && legacyLitiges) blocks.litigesParticulier = legacyLitiges;

  if (legacyPaiementPro && !blocks.paiementProModes && !blocks.paiementProDelais) {
    blocks.paiementProDelais = legacyPaiementPro;
  }
}

function normalizeConditionsVenteBlocks(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const nested = src.conditionsVenteBlocks && typeof src.conditionsVenteBlocks === 'object'
    ? src.conditionsVenteBlocks
    : src;

  const blocks = {};
  BLOCK_KEYS.forEach((key) => {
    blocks[key] = String(nested[key] || '').trim();
  });
  migrateLegacyBlocks(nested, blocks);

  const legacy = String(src.conditionsVente || '').trim();
  const hasBlocks = BLOCK_KEYS.some((key) => blocks[key]);
  if (!hasBlocks && legacy) {
    blocks.communes = legacy;
  }

  return blocks;
}

function hasConditionsVenteBlocks(blocks) {
  if (!blocks || typeof blocks !== 'object') return false;
  return BLOCK_KEYS.some((key) => String(blocks[key] || '').trim());
}

module.exports = normalizeConditionsVenteBlocks;
module.exports.BLOCK_KEYS = BLOCK_KEYS;
module.exports.hasConditionsVenteBlocks = hasConditionsVenteBlocks;
