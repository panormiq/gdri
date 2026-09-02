/**
 * FICHIER : modules/gderpi/backend/services/bon-livraison/resolveBlContact.js
 * RÔLE : Résout le contact livraison d'un BL depuis le payload, le devis ou la fiche client.
 */

const getDevisById = require('../devis/getDevisById');
const resolveDevisContact = require('../pdf/resolveDevisContact');

function contactToFields(contact) {
  if (!contact) return null;
  return {
    contactClientId: String(contact.contactClientId || '').trim(),
    contactNom: String(contact.contactNom || '').trim(),
    contactFonction: String(contact.contactFonction || '').trim(),
    contactEmail: String(contact.contactEmail || '').trim(),
    contactTelephone: String(contact.contactTelephone || '').trim()
  };
}

function findClientContactById(client, contactId) {
  const id = String(contactId || '').trim();
  if (!client || !id) return null;
  if (id === '__particulier__' || client.type === 'particulier') {
    return {
      contactClientId: id,
      contactNom: [client.prenom, client.nom].filter(Boolean).join(' ').trim(),
      contactFonction: '',
      contactEmail: String(client.email || '').trim(),
      contactTelephone: String(client.telephone || '').trim()
    };
  }
  const contacts = Array.isArray(client.contacts) ? client.contacts : [];
  const match = contacts.find((ct) => String(ct.id || ct.contactId || '') === id);
  if (!match) return null;
  return {
    contactClientId: id,
    contactNom: [match.prenom, match.nom].filter(Boolean).join(' ').trim(),
    contactFonction: String(match.fonction || '').trim(),
    contactEmail: String(match.email || '').trim(),
    contactTelephone: String(match.telephone || '').trim()
  };
}

function hasBlContactValue(contact) {
  if (!contact) return false;
  return Boolean(
    contact.contactNom || contact.contactFonction || contact.contactEmail || contact.contactTelephone
  );
}

async function resolveBlContact(db, entrepriseId, payload, commande, client) {
  const p = payload && typeof payload === 'object' ? payload : {};
  const fromPayload = contactToFields(p);
  if (hasBlContactValue(fromPayload)) return fromPayload;

  const contactId = String(p.contactClientId || '').trim();
  if (contactId && client) {
    const linked = findClientContactById(client, contactId);
    if (hasBlContactValue(linked)) return linked;
  }

  let devis = null;
  if (commande?.devisId) {
    devis = await getDevisById(db, entrepriseId, commande.devisId);
  }
  const resolved = resolveDevisContact({ ...(devis || {}), ...(commande || {}) }, client);
  if (resolved) {
    return {
      contactClientId: String(commande?.contactClientId || devis?.contactClientId || contactId || '').trim(),
      contactNom: resolved.nom,
      contactFonction: resolved.fonction,
      contactEmail: resolved.email,
      contactTelephone: resolved.telephone
    };
  }

  return {
    contactClientId: contactId,
    contactNom: '',
    contactFonction: '',
    contactEmail: '',
    contactTelephone: ''
  };
}

module.exports = resolveBlContact;
