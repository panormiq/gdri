/**

 * FICHIER : modules/gderpi/backend/services/pdf/formatPostalAddress.js

 * RÔLE : Formate une adresse postale en lignes texte.

 *

 * ENTRÉES : objet adresse (adresse, complement, codePostal, ville, pays)

 * SORTIES : string[] lignes non vides

 *

 * DÉPEND DE : —

 * NE PAS : échappement HTML

 *

 * APPELÉ PAR : renderDevisHtml.js

 */



function formatPostalAddress(addr) {

  const a = addr && typeof addr === 'object' ? addr : {};

  const lines = [];

  const libelle = String(a.libelle || '').trim();
  const street = String(a.adresse || '').trim();

  const complement = String(a.complement || '').trim();

  const cpVille = [String(a.codePostal || '').trim(), String(a.ville || '').trim()].filter(Boolean).join(' ');

  const pays = String(a.pays || '').trim();



  if (libelle) lines.push(libelle);
  if (street) lines.push(street);

  if (complement) lines.push(complement);

  if (cpVille) lines.push(cpVille);

  if (pays && pays.toLowerCase() !== 'france') lines.push(pays);

  return lines;

}



module.exports = formatPostalAddress;


