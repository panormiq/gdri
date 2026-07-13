/**
 * FICHIER : modules/gderpi/backend/services/besoins/markBesoinsEnvoyesForClient.js
 * RÔLE : Lie les besoins ouverts aux commandes fournisseur validées (envoyées).
 */

const markBesoinsCommandes = require('./markBesoinsCommandes');
const besoinIdsForLignes = require('./besoinIdsForLignes');

const COLLECTION = 'gderpi_commandes_client';

async function markBesoinsEnvoyesForClient(db, entrepriseId, commandeClientId, commandesFournisseur) {
  const cmdId = String(commandeClientId || '').trim();
  if (!cmdId) return;

  const doc = await db.collection(COLLECTION).findOne({
    entrepriseId: String(entrepriseId),
    commandeClientId: cmdId
  });
  if (!doc) return;

  let besoins = Array.isArray(doc.besoins) ? [...doc.besoins] : [];
  if (!besoins.length) return;

  const list = Array.isArray(commandesFournisseur) ? commandesFournisseur : [];
  list.forEach((cf) => {
    const cfId = cf.commandeFournisseurId || cf.id;
    const lignes = Array.isArray(cf.lignes) ? cf.lignes : [];
    const ids = besoinIdsForLignes(besoins, lignes);
    besoins = markBesoinsCommandes(besoins, ids, cfId);
  });

  await db.collection(COLLECTION).updateOne(
    { entrepriseId: String(entrepriseId), commandeClientId: cmdId },
    { $set: { besoins, updatedAt: new Date() } }
  );
}

module.exports = markBesoinsEnvoyesForClient;
