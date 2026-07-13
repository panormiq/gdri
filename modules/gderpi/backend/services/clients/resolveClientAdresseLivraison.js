/**

 * FICHIER : modules/gderpi/backend/services/clients/resolveClientAdresseLivraison.js

 * RÔLE : Résout l'adresse de livraison texte d'un client normalisé.

 */



const formatPostalAddress = require('../pdf/formatPostalAddress');

const pickDefaultClientAdresse = require('./pickDefaultClientAdresse');



function resolveClientAdresseLivraison(client) {

  const addr = pickDefaultClientAdresse(client);

  return addr ? formatPostalAddress(addr).join('\n') : '';

}



module.exports = resolveClientAdresseLivraison;

