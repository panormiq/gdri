/**

 * FICHIER : modules/gderpi/backend/services/devis/normalizeDevisContact.js

 * RÔLE : Normalise la référence client et le contact affichés sur un devis.

 *

 * ENTRÉES : raw objet devis ou patch

 * SORTIES : { documentClient, referenceClient, contactNom, contactFonction, contactEmail, contactTelephone }

 *

 * DÉPEND DE : —

 * NE PAS : persistance, lignes

 *

 * APPELÉ PAR : normalizeDevis.js, updateDevis.js

 */



function normalizeDevisContact(raw) {

  const d = raw && typeof raw === 'object' ? raw : {};

  const documentClient = String(
    d.documentClient || d.referenceClient || d.refClient || ''
  ).trim();

  return {
    documentClient,
    referenceClient: documentClient,
    contactClientId: String(d.contactClientId || d.clientContactId || '').trim(),
    contactNom: String(d.contactNom || '').trim(),
    contactService: String(d.contactService || '').trim(),
    contactFonction: String(d.contactFonction || '').trim(),

    contactEmail: String(d.contactEmail || '').trim(),

    contactTelephone: String(d.contactTelephone || d.contactTel || '').trim()

  };

}



module.exports = normalizeDevisContact;


