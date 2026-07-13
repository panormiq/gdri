/**
 * FICHIER : modules/gderpi/backend/integrations/pm-bridge/getPmCompatStatus.js
 * RÔLE : État de compatibilité PM pour le frontend GDERPI.
 */

const isPmAvailable = require('./isPmAvailable');

async function getPmCompatStatus() {
  return {
    pmInstalled: isPmAvailable(),
    canLinkCard: isPmAvailable(),
    hint: isPmAvailable()
      ? null
      : 'Installez et activez le module PM pour lier des cartes de suivi.'
  };
}

module.exports = getPmCompatStatus;
