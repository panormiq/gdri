/**
 * FICHIER : modules/annuaire/backend/services/integrations/gderpi/getGderpiCompatStatus.js
 */

const isGderpiAvailable = require('../isGderpiAvailable');

async function getGderpiCompatStatus(db, entrepriseId) {
  const available = isGderpiAvailable();
  let linkedClients = 0;
  let linkedFournisseurs = 0;
  let linkedBoutiques = 0;
  if (available) {
    const eid = String(entrepriseId);
    linkedClients = await db.collection('annuaire_organisations').countDocuments({
      entrepriseId: eid,
      gderpiClientId: { $ne: null }
    });
    linkedFournisseurs = await db.collection('annuaire_organisations').countDocuments({
      entrepriseId: eid,
      gderpiFournisseurId: { $ne: null }
    });
    linkedBoutiques = await db.collection('annuaire_organisations').countDocuments({
      entrepriseId: eid,
      gderpiBoutiqueId: { $ne: null }
    });
  }
  return {
    gderpiInstalled: available,
    canImport: available,
    canCreateClient: available,
    linkedClients,
    linkedFournisseurs,
    linkedBoutiques
  };
}

module.exports = getGderpiCompatStatus;
