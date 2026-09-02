/**
 * FICHIER : modules/gderpi/backend/services/commande-client/maybeRemapAchatsToPrestation.js
 * RÔLE : Recase une commande « achats en cours » sans achat réel vers le suivi prestation.
 *
 * ENTRÉES : db, entrepriseId, commandeClientId, commande?
 * SORTIES : CommandeClient
 *
 * DÉPEND DE : commandeNeedsAchats.js, commandeClientKind.js, setCommandeClientStatut.js
 * NE PAS : génération de commandes fournisseur
 *
 * APPELÉ PAR : getCommandeClientById.js, listCommandesClient.js
 */

const fetchCommandeClientEntry = require('./fetchCommandeClientEntry');
const setCommandeClientStatut = require('./setCommandeClientStatut');
const commandeNeedsAchats = require('../workflow/commandeNeedsAchats');
const { commandeClientKind } = require('../workflow/commandeClientKind');
const remainingPrestationQty = require('../workflow/remainingPrestationQty');
const isPrestationLine = require('../workflow/isPrestationLine');

const COLLECTION = 'gderpi_commandes_client';
const COLLECTION_CF = 'gderpi_commandes_fournisseur';

async function maybeRemapAchatsToPrestation(db, entrepriseId, commandeClientId, commande = null) {
  const cmd = commande || await fetchCommandeClientEntry(db, entrepriseId, commandeClientId);
  if (!cmd) return null;
  if (String(cmd.statut) !== 'achats_en_cours') return cmd;
  if (commandeNeedsAchats(cmd)) return cmd;

  const kind = commandeClientKind(cmd);
  if (kind !== 'dev' && kind !== 'mixte') return cmd;

  const hasFacture = Array.isArray(cmd.factures) ? cmd.factures.length > 0 : Boolean(cmd.factureNumero);
  const lignes = (Array.isArray(cmd.lignes) ? cmd.lignes : []).map((line) => {
    if (!isPrestationLine(line)) return line;
    if (hasFacture) return line;
    if (line.recetteValideeAt && remainingPrestationQty({ ...line, recetteValideeAt: null }) > 0
      && !(Number(line.quantiteLivree) > 0)) {
      return { ...line, recetteValideeAt: null };
    }
    return line;
  });

  const now = new Date();
  const id = String(commandeClientId).trim();
  await db.collection(COLLECTION).updateOne(
    { entrepriseId: String(entrepriseId), commandeClientId: id },
    { $set: { lignes, updatedAt: now } }
  );

  if (kind === 'dev') {
    await db.collection(COLLECTION_CF).updateMany(
      {
        entrepriseId: String(entrepriseId),
        commandeClientId: id,
        statut: 'brouillon'
      },
      {
        $set: { statut: 'annulee', updatedAt: now },
        $push: { historique: { statut: 'annulee', date: now, action: 'remap_prestation' } }
      }
    );
  }

  const next = kind === 'dev' ? 'prestation_en_cours' : 'a_livrer';
  return setCommandeClientStatut(db, entrepriseId, commandeClientId, next, {
    historique: { action: 'remap_prestation' }
  });
}

module.exports = maybeRemapAchatsToPrestation;
