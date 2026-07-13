/**
 * FICHIER : modules/gderpi/backend/services/pdf/resolveDevisContact.js
 * RÔLE : Résout le contact affiché sur le devis (saisie devis ou fiche client).
 *
 * ENTRÉES : devis, client
 * SORTIES : { nom, fonction, email, telephone } ou null si vide
 *
 * DÉPEND DE : —
 * NE PAS : HTML, Mongo
 *
 * APPELÉ PAR : renderDevisHtml.js
 */

function hasContactValue(contact) {
  if (!contact) return false;
  return Boolean(
    String(contact.nom || '').trim()
    || String(contact.fonction || '').trim()
    || String(contact.email || '').trim()
    || String(contact.telephone || '').trim()
  );
}

function contactToFields(contact) {
  if (!contact) return null;
  if (contact.prenom !== undefined || contact.nom !== undefined) {
    return {
      nom: [contact.prenom, contact.nom].filter(Boolean).join(' ').trim(),
      fonction: String(contact.fonction || '').trim(),
      email: String(contact.email || '').trim(),
      telephone: String(contact.telephone || '').trim()
    };
  }
  return {
    nom: String(contact.nom || '').trim(),
    fonction: String(contact.fonction || '').trim(),
    email: String(contact.email || '').trim(),
    telephone: String(contact.telephone || '').trim()
  };
}

function findClientContactById(client, contactId) {
  const id = String(contactId || '').trim();
  if (!client || !id) return null;
  if (id === '__particulier__' || client.type === 'particulier') {
    return contactToFields({
      prenom: client.prenom,
      nom: client.nom,
      email: client.email,
      telephone: client.telephone
    });
  }
  const list = Array.isArray(client.contacts) ? client.contacts : [];
  const match = list.find((ct) => String(ct.id || ct.contactId || '') === id);
  return match ? contactToFields(match) : null;
}

function contactFromClient(client) {
  if (!client) return null;
  const principal = Array.isArray(client.contacts)
    ? (client.contacts.find((ct) => ct.principal) || client.contacts[0])
    : null;
  if (principal) return contactToFields(principal);
  return contactToFields({
    nom: client.contactNom,
    fonction: client.contactFonction,
    email: client.email,
    telephone: client.telephone
  });
}

function resolveDevisContact(devis, client) {
  const d = devis && typeof devis === 'object' ? devis : {};
  const fromDevis = {
    nom: String(d.contactNom || '').trim(),
    fonction: String(d.contactFonction || '').trim(),
    email: String(d.contactEmail || '').trim(),
    telephone: String(d.contactTelephone || '').trim()
  };
  if (hasContactValue(fromDevis)) return fromDevis;

  const linked = findClientContactById(client, d.contactClientId);
  if (hasContactValue(linked)) return linked;

  const fromClient = contactFromClient(client);
  return hasContactValue(fromClient) ? fromClient : null;
}

module.exports = resolveDevisContact;
