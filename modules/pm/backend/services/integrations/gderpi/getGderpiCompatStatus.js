/**
 * FICHIER : modules/pm/backend/services/integrations/gderpi/getGderpiCompatStatus.js
 * RÔLE : Retourne l'état de compatibilité GDERPI pour le frontend PM.
 */

const isGderpiAvailable = require('../isGderpiAvailable');

async function getGderpiCompatStatus(db, entrepriseId) {
  const available = isGderpiAvailable();
  let defaultBoutiqueId = null;
  if (available) {
    const settings = await db.collection('pm_settings').findOne({ entrepriseId: String(entrepriseId) });
    defaultBoutiqueId = settings?.defaultBoutiqueId || null;
  }
  return {
    gderpiInstalled: available,
    canLinkDevis: available,
    canCreateDevis: available && Boolean(defaultBoutiqueId),
    defaultBoutiqueId,
    hint: !available
      ? 'Installez et activez GDERPI pour lier des devis.'
      : (!defaultBoutiqueId
        ? 'Définissez une boutique par défaut dans les paramètres PM pour créer des devis en un clic.'
        : null)
  };
}

module.exports = getGderpiCompatStatus;
