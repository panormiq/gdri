/**
 * FICHIER : modules/gderpi/backend/integrations/annuaire-bridge/getAnnuaireCompatStatus.js
 * RÔLE : Statut compatibilité Annuaire pour l'UI GDERPI.
 */

const isAnnuaireAvailable = require('./isAnnuaireAvailable');

async function getAnnuaireCompatStatus(db, entrepriseId) {
  const available = isAnnuaireAvailable();
  let linkedClients = 0;
  let linkedFournisseurs = 0;
  if (available && db) {
    const eid = String(entrepriseId);
    linkedClients = await db.collection('gderpi_clients').countDocuments({
      entrepriseId: eid,
      annuaireOrganisationId: { $nin: [null, ''] }
    });
    linkedFournisseurs = await db.collection('gderpi_fournisseurs').countDocuments({
      entrepriseId: eid,
      annuaireOrganisationId: { $nin: [null, ''] }
    });
  }
  return {
    annuaireInstalled: available,
    annuaireRequired: true,
    linkedClients,
    linkedFournisseurs
  };
}

module.exports = getAnnuaireCompatStatus;
