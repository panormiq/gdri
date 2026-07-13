/**
 * FICHIER : modules/gderpi/backend/services/commande-client/updateCommandeClient.js
 * RÔLE : Met à jour une commande client (lignes, réf. client, objet).
 *
 * ENTRÉES : db, entrepriseId, commandeClientId, patch
 * SORTIES : CommandeClient mise à jour
 *
 * DÉPEND DE : getCommandeClientById.js, normalizeDevisLine.js, calculateDevisTotals.js, toCommandeClientEntry.js
 * NE PAS : changement de statut
 *
 * APPELÉ PAR : workflowController
 */

const getCommandeClientById = require('./getCommandeClientById');
const normalizeDevisLine = require('../devis/normalizeDevisLine');
const calculateDevisTotals = require('../devis/calculateDevisTotals');

const COLLECTION = 'gderpi_commandes_client';
const EDITABLE_STATUTS = new Set(['validee_client', 'a_valider_gdri', 'validee_gdri', 'confirmee', 'en_cours']);

async function updateCommandeClient(db, entrepriseId, commandeClientId, patch) {
  const existing = await getCommandeClientById(db, entrepriseId, commandeClientId);
  if (!existing) throw new Error('Commande client introuvable');
  if (!EDITABLE_STATUTS.has(existing.statut)) {
    throw new Error('Cette commande n\'est plus modifiable');
  }

  const p = patch && typeof patch === 'object' ? patch : {};
  const update = { updatedAt: new Date() };

  if (p.referenceClient !== undefined) {
    update.referenceClient = String(p.referenceClient || '').trim();
  }
  if (p.objet !== undefined) update.objet = String(p.objet || '').trim();
  if (p.notes !== undefined) update.notes = String(p.notes || '').trim();

  if (Array.isArray(p.lignes)) {
    const lignes = p.lignes.map((l, i) => normalizeDevisLine(l, i));
    if (!lignes.length) throw new Error('Au moins une ligne requise');
    update.lignes = lignes;
    update.totaux = calculateDevisTotals(lignes);
  }

  await db.collection(COLLECTION).updateOne(
    { entrepriseId: String(entrepriseId), commandeClientId: String(commandeClientId).trim() },
    { $set: update }
  );

  return getCommandeClientById(db, entrepriseId, commandeClientId);
}

module.exports = updateCommandeClient;
