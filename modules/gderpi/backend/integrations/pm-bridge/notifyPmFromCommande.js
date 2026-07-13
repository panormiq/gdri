/**
 * FICHIER : modules/gderpi/backend/integrations/pm-bridge/notifyPmFromCommande.js
 * RÔLE : Notifie le module PM après changement commande client (compatibilité optionnelle).
 */

async function notifyPmFromCommande(db, entrepriseId, commande) {
  if (!commande) return null;
  try {
    const syncCardFromCommande = require('../../../../pm/backend/services/integrations/gderpi/syncCardFromCommande');
    return syncCardFromCommande(db, entrepriseId, commande, commande.pmCardId || null);
  } catch (_) {
    return null;
  }
}

module.exports = notifyPmFromCommande;
