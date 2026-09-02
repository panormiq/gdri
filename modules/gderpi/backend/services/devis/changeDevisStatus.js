/**
 * FICHIER : modules/gderpi/backend/services/devis/changeDevisStatus.js
 * RÔLE : Transition de statut devis avec historique.
 *
 * ENTRÉES : db, entrepriseId, devisId, nouveauStatut, extra { referenceClient, documentClient }
 * SORTIES : Devis mis à jour
 *
 * DÉPEND DE : getDevisById.js, toDevisEntry.js, bonCommandeClient.js
 * NE PAS : création commande
 *
 * APPELÉ PAR : devisController
 */

const getDevisById = require('./getDevisById');
const toDevisEntry = require('./toDevisEntry');
const { requireBonCommandeClient, parseSansBonCommandeClient } = require('../workflow/bonCommandeClient');

const COLLECTION = 'gderpi_devis';

const STATUTS = new Set(['brouillon', 'envoye', 'accepte', 'refuse', 'expire']);

async function changeDevisStatus(db, entrepriseId, devisId, newStatus, extra = {}) {
  const existing = await getDevisById(db, entrepriseId, devisId);
  if (!existing) throw new Error('Devis introuvable');

  const statut = String(newStatus || '').trim().toLowerCase();
  if (!STATUTS.has(statut)) {
    throw new Error('Statut invalide : ' + statut);
  }
  if (statut === existing.statut) {
    return existing;
  }
  if (statut === 'envoye' && !existing.clientId) {
    throw new Error('Client requis avant envoi du devis');
  }
  if (statut === 'envoye' && (!existing.lignes || !existing.lignes.length)) {
    throw new Error('Au moins une ligne requise avant envoi');
  }

  const now = new Date();
  const set = { statut, updatedAt: now };
  if (statut === 'accepte') {
    const extraPatch = extra && typeof extra === 'object' ? extra : {};
    extraPatch.sansBonCommandeClient = parseSansBonCommandeClient(extraPatch.sansBonCommandeClient);
    const bonCommande = requireBonCommandeClient(extraPatch, existing);
    set.referenceClient = bonCommande;
    set.sansBonCommandeClient = !bonCommande;
    if (bonCommande && !existing.documentClient) set.documentClient = bonCommande;
  }

  const col = db.collection(COLLECTION);
  await col.updateOne(
    { entrepriseId: String(entrepriseId), devisId: String(devisId).trim() },
    {
      $set: set,
      $push: { historique: { statut, date: now } }
    }
  );

  const doc = await col.findOne({ entrepriseId: String(entrepriseId), devisId: String(devisId).trim() });
  const entry = toDevisEntry(doc);

  try {
    const notifyPmFromDevis = require('../../integrations/pm-bridge/notifyPmFromDevis');
    await notifyPmFromDevis(db, entrepriseId, entry);
  } catch (_) {}

  return entry;
}

module.exports = changeDevisStatus;
