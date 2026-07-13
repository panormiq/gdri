/**
 * FICHIER : modules/gderpi/backend/services/commande-client/toCommandeClientEntry.js
 * RÔLE : Formate un document Mongo commande client pour l'API.
 */

const normalizeCommandeClient = require('./normalizeCommandeClient');
const enrichLignesWithQuantiteLivrable = require('./enrichLignesWithQuantiteLivrable');
const enrichLignesWithQuantiteFacturable = require('./enrichLignesWithQuantiteFacturable');
const computeBloquantGdri = require('../workflow/computeBloquantGdri');
const listLignesFacturables = require('../facturation/listLignesFacturables');

function isoDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  return value;
}

function toCommandeClientEntry(doc, opts = {}) {
  if (!doc) return null;
  const normalized = normalizeCommandeClient(doc);
  const lignesLivrable = enrichLignesWithQuantiteLivrable(normalized);
  const lignes = enrichLignesWithQuantiteFacturable(normalized, lignesLivrable);
  const enriched = { ...normalized, lignes };
  const bloquantGdri = computeBloquantGdri(enriched, opts);
  const lignesFacturables = listLignesFacturables(enriched);
  return {
    ...enriched,
    commandeClientId: enriched.id,
    bloquantGdri,
    lignesFacturablesCount: lignesFacturables.length,
    createdAt: isoDate(doc.createdAt) || enriched.createdAt,
    updatedAt: isoDate(doc.updatedAt) || enriched.updatedAt,
    factureDate: isoDate(doc.factureDate) || enriched.factureDate,
    facturePayeeAt: isoDate(doc.facturePayeeAt) || enriched.facturePayeeAt,
    recetteValideeAt: isoDate(doc.recetteValideeAt) || enriched.recetteValideeAt,
    validationGdriAt: isoDate(doc.validationGdriAt) || enriched.validationGdriAt
  };
}

module.exports = toCommandeClientEntry;
