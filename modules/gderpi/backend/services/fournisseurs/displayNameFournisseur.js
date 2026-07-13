/**
 * FICHIER : modules/gderpi/backend/services/fournisseurs/displayNameFournisseur.js
 * RÔLE : Calcule le nom affiché d'un fournisseur.
 *
 * ENTRÉES : fournisseur brut ou normalisé
 * SORTIES : string
 *
 * DÉPEND DE : normalizeFournisseur.js
 * NE PAS : Mongo
 *
 * APPELÉ PAR : toFournisseurEntry.js
 */

const normalizeFournisseur = require('./normalizeFournisseur');

function displayNameFournisseur(fournisseur) {
  const f = normalizeFournisseur(fournisseur);
  return f.raisonSociale || f.contactNom || 'Fournisseur';
}

module.exports = displayNameFournisseur;
