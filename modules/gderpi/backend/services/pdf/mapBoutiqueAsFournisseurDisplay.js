/**
 * FICHIER : modules/gderpi/backend/services/pdf/mapBoutiqueAsFournisseurDisplay.js
 * RÔLE : Adapte une boutique au format affichage fournisseur (PDF commande achat).
 *
 * ENTRÉES : boutique normalisée
 * SORTIES : objet style fournisseur ou null
 *
 * DÉPEND DE : —
 * NE PAS : persistance
 *
 * APPELÉ PAR : buildCommandeFournisseurHtmlContext.js
 */

function mapBoutiqueAsFournisseurDisplay(boutique) {
  if (!boutique) return null;
  const principal = (boutique.contacts || []).find((c) => c.principal) || boutique.contacts?.[0];
  const contactNom = principal
    ? [principal.prenom, principal.nom].filter(Boolean).join(' ').trim()
    : '';
  return {
    raisonSociale: boutique.raisonSociale || boutique.nom || '',
    nom: boutique.nom || '',
    adresse: boutique.adresse || '',
    adresseComplement: '',
    codePostal: boutique.codePostal || '',
    ville: boutique.ville || '',
    pays: boutique.pays || '',
    email: boutique.email || principal?.email || '',
    telephone: boutique.telephone || principal?.telephone || '',
    contactNom,
    contactFonction: principal?.fonction || '',
    isBoutiqueFournisseur: true
  };
}

module.exports = mapBoutiqueAsFournisseurDisplay;
