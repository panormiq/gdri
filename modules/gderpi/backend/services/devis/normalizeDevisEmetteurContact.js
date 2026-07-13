/**
 * FICHIER : modules/gderpi/backend/services/devis/normalizeDevisEmetteurContact.js
 * RÔLE : Normalise le contact émetteur (boutique) affiché sur un devis.
 *
 * ENTRÉES : raw objet devis ou patch
 * SORTIES : champs emetteurContact*
 *
 * APPELÉ PAR : normalizeDevis.js, updateDevis.js
 */

function normalizeDevisEmetteurContact(raw) {
  const d = raw && typeof raw === 'object' ? raw : {};
  return {
    emetteurContactId: String(d.emetteurContactId || d.boutiqueContactId || '').trim(),
    emetteurContactNom: String(d.emetteurContactNom || '').trim(),
    emetteurContactFonction: String(d.emetteurContactFonction || '').trim(),
    emetteurContactEmail: String(d.emetteurContactEmail || '').trim(),
    emetteurContactTelephone: String(d.emetteurContactTelephone || d.emetteurContactTel || '').trim()
  };
}

module.exports = normalizeDevisEmetteurContact;
