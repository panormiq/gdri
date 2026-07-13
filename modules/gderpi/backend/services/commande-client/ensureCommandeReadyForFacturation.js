/**
 * Prépare une commande pour facturation : passe en « livrée » si l'exécution est terminée.
 */

const fetchCommandeClientEntry = require('./fetchCommandeClientEntry');
const setCommandeClientStatut = require('./setCommandeClientStatut');
const isCommandeFulfillmentComplete = require('../workflow/isCommandeFulfillmentComplete');
const { commandeClientKind } = require('../workflow/commandeClientKind');
const { filterLinesByKind } = require('../workflow/commandeClientKind');

const FACTURABLE_STATUTS = new Set(['livree', 'a_facturer']);

async function ensureCommandeReadyForFacturation(db, entrepriseId, commandeClientId) {
  let commande = await fetchCommandeClientEntry(db, entrepriseId, commandeClientId);
  if (!commande) throw new Error('Commande client introuvable');

  if (FACTURABLE_STATUTS.has(commande.statut)) return commande;

  if (isCommandeFulfillmentComplete(commande)) {
    await setCommandeClientStatut(db, entrepriseId, commandeClientId, 'livree', {
      historique: { action: 'execution_terminee' }
    });
    return fetchCommandeClientEntry(db, entrepriseId, commandeClientId);
  }

  const kind = commandeClientKind(commande);
  const devLines = filterLinesByKind(commande.lignes, 'dev');
  const devDone = devLines.length > 0 && devLines.every((l) => Boolean(l.recetteValideeAt));
  if ((kind === 'dev' || kind === 'mixte') && devDone && kind === 'dev') {
    await setCommandeClientStatut(db, entrepriseId, commandeClientId, 'livree', {
      historique: { action: 'avancement_complet' }
    });
    return fetchCommandeClientEntry(db, entrepriseId, commandeClientId);
  }

  throw new Error(
    'La commande n\'est pas prête à facturer (statut : ' + commande.statut +
    ', type : ' + kind + '). Finalisez la livraison (produits et prestations).'
  );
}

module.exports = ensureCommandeReadyForFacturation;
