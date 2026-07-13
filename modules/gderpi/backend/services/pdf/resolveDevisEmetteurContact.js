/**
 * FICHIER : modules/gderpi/backend/services/pdf/resolveDevisEmetteurContact.js
 * RÔLE : Résout le contact émetteur affiché sur le devis (saisie devis ou fiche boutique).
 *
 * ENTRÉES : devis, boutique
 * SORTIES : { nom, fonction, email, telephone } ou null
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

function isPlaceholderContactName(nom) {
  const value = String(nom || '').trim().toLowerCase();
  return !value || value === 'contact';
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

function mergeContactFields(primary, fallback) {
  const a = primary || {};
  const b = fallback || {};
  return {
    nom: String(a.nom || b.nom || '').trim(),
    fonction: String(a.fonction || b.fonction || '').trim(),
    email: String(a.email || b.email || '').trim(),
    telephone: String(a.telephone || b.telephone || '').trim()
  };
}

function findBoutiqueContactById(boutique, contactId) {
  const id = String(contactId || '').trim();
  if (!boutique || !id) return null;
  const list = Array.isArray(boutique.contacts) ? boutique.contacts : [];
  const match = list.find((ct) => String(ct.id || ct.contactId || '') === id);
  return match ? contactToFields(match) : null;
}

function findBoutiqueContactByEmail(boutique, email) {
  const needle = String(email || '').trim().toLowerCase();
  if (!boutique || !needle) return null;
  const list = Array.isArray(boutique.contacts) ? boutique.contacts : [];
  const match = list.find((ct) => String(ct.email || '').trim().toLowerCase() === needle);
  return match ? contactToFields(match) : null;
}

function contactFromBoutique(boutique) {
  if (!boutique) return null;
  const list = Array.isArray(boutique.contacts) ? boutique.contacts : [];
  const principal = list.find((ct) => ct.principal) || list[0];
  if (principal) return contactToFields(principal);
  if (boutique.email || boutique.telephone) {
    return contactToFields({
      nom: '',
      email: boutique.email,
      telephone: boutique.telephone
    });
  }
  return null;
}

function resolveDevisEmetteurContact(devis, boutique) {
  const d = devis && typeof devis === 'object' ? devis : {};
  const fromDevis = {
    nom: String(d.emetteurContactNom || '').trim(),
    fonction: String(d.emetteurContactFonction || '').trim(),
    email: String(d.emetteurContactEmail || '').trim(),
    telephone: String(d.emetteurContactTelephone || '').trim()
  };

  const linked = findBoutiqueContactById(boutique, d.emetteurContactId)
    || findBoutiqueContactByEmail(boutique, fromDevis.email);
  const fromBoutique = contactFromBoutique(boutique);

  if (linked && hasContactValue(linked)) {
    return mergeContactFields(linked, fromDevis);
  }

  if (hasContactValue(fromDevis) && !isPlaceholderContactName(fromDevis.nom)) {
    return fromDevis;
  }

  if (fromBoutique && hasContactValue(fromBoutique)) {
    return mergeContactFields(fromBoutique, fromDevis);
  }

  return hasContactValue(fromDevis) ? fromDevis : null;
}

module.exports = resolveDevisEmetteurContact;
