/**
 * FICHIER : modules/gderpi/backend/services/workflow/bonCommandeClient.js
 * RÔLE : Résout le n° de bon de commande client, ou l'absence déclarée.
 *
 * ENTRÉES : un ou plusieurs objets { referenceClient, documentClient, sansBonCommandeClient }
 * SORTIES : chaîne, éventuellement vide si absence déclarée ; throw sinon
 *
 * DÉPEND DE : —
 * NE PAS : persistance
 *
 * APPELÉ PAR : changeDevisStatus, createFromDevis, createCommandeClient, validateCommandeGdri, facturerCommandeClient
 */

function resolveBonCommandeClient(...sources) {
  for (const src of sources) {
    if (src == null) continue;
    if (typeof src === 'string' || typeof src === 'number') {
      const value = String(src).trim();
      if (value) return value;
      continue;
    }
    if (typeof src === 'object') {
      const value = String(src.referenceClient || src.documentClient || src.refClient || '').trim();
      if (value) return value;
    }
  }
  return '';
}

function isSansBonCommandeClient(...sources) {
  if (resolveBonCommandeClient(...sources)) return false;
  for (const src of sources) {
    if (src && typeof src === 'object' && src.sansBonCommandeClient === true) return true;
  }
  return false;
}

function parseSansBonCommandeClient(value) {
  if (value === true || value === 1) return true;
  const raw = String(value || '').trim().toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'on' || raw === 'yes';
}

function requireBonCommandeClient(...sources) {
  const value = resolveBonCommandeClient(...sources);
  if (value) return value;
  if (isSansBonCommandeClient(...sources)) return '';
  throw new Error('N° de bon de commande client requis, ou indiquez que le client n\'en a pas');
}

module.exports = {
  resolveBonCommandeClient,
  isSansBonCommandeClient,
  parseSansBonCommandeClient,
  requireBonCommandeClient
};
