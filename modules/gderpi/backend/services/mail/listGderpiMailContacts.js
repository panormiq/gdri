/**
 * Émetteurs GDERPI par boutique : mail générique + contacts.
 */

const listBoutiques = require('../boutiques/listBoutiques');

function contactDisplayName(contact) {
  return [contact.prenom, contact.nom].filter(Boolean).join(' ').trim() || String(contact.fonction || '').trim();
}

async function listGderpiMailContacts(db, entrepriseId) {
  const boutiques = await listBoutiques(db, entrepriseId, {});
  const out = [];
  const seenEmails = new Set();

  for (const boutique of boutiques || []) {
    const boutiqueName = boutique.nom || boutique.libelle || 'Boutique';
    const boutiqueId = String(boutique.id || boutique._id || boutiqueName).trim();
    const genericEmail = String(boutique.email || '').trim().toLowerCase();

    let linkedContactName = '';
    if (genericEmail) {
      const match = (boutique.contacts || []).find(
        (ct) => String(ct.email || '').trim().toLowerCase() === genericEmail
      );
      if (match) linkedContactName = contactDisplayName(match);
    }

    out.push({
      email: genericEmail,
      hasEmail: Boolean(genericEmail),
      label: boutiqueName,
      kind: 'generic',
      boutiqueId,
      boutiqueName,
      emitterLabel: boutiqueName,
      contactName: linkedContactName
    });
    if (genericEmail) seenEmails.add(genericEmail);

    for (const contact of boutique.contacts || []) {
      const name = contactDisplayName(contact) || 'Contact';
      const email = String(contact.email || '').trim().toLowerCase();
      if (!email || seenEmails.has(email)) continue;
      seenEmails.add(email);
      out.push({
        email,
        hasEmail: true,
        label: `${name} (${boutiqueName})`,
        kind: 'contact',
        boutiqueId,
        boutiqueName,
        emitterLabel: boutiqueName,
        contactName: name
      });
    }
  }

  return out;
}

module.exports = listGderpiMailContacts;
