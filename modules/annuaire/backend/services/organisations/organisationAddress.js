/**
 * FICHIER : modules/annuaire/backend/services/organisations/organisationAddress.js
 * RÔLE : Formatage adresse entre organisation Annuaire et fiche entité GDRI.
 */

function spreadAddressFromEntity(address) {
  const addr = String(address || '').trim();
  return {
    adresse: addr,
    adresseComplement: '',
    codePostal: '',
    ville: '',
    pays: 'France'
  };
}

function formatAddressForEntity(org) {
  const o = org && typeof org === 'object' ? org : {};
  const parts = [
    String(o.adresse || '').trim(),
    String(o.adresseComplement || '').trim(),
    [String(o.codePostal || '').trim(), String(o.ville || '').trim()].filter(Boolean).join(' '),
    String(o.pays || '').trim() && String(o.pays).trim() !== 'France' ? String(o.pays).trim() : ''
  ].filter(Boolean);
  if (parts.length) return parts.join(', ');
  const notes = String(o.notes || '');
  const match = notes.match(/Adresse\s*:\s*(.+)/i);
  return match ? String(match[1]).trim() : '';
}

module.exports = {
  spreadAddressFromEntity,
  formatAddressForEntity
};
