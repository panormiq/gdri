/**
 * FICHIER : modules/gderpi/backend/services/clients/normalizeClientAddress.js
 * RÔLE : Normalise un bloc adresse client (facturation, livraison).
 *
 * ENTRÉES : raw objet adresse, defaults optionnels
 * SORTIES : adresse normalisée
 *
 * DÉPEND DE : —
 * NE PAS : persistance Mongo
 *
 * APPELÉ PAR : normalizeClient.js
 */

function normalizeClientAddress(raw, defaults = {}) {
  const a = raw && typeof raw === 'object' ? raw : {};
  const d = defaults && typeof defaults === 'object' ? defaults : {};
  return {
    libelle: String(a.libelle || d.libelle || '').trim(),
    adresse: String(a.adresse || d.adresse || '').trim(),
    complement: String(a.complement || a.adresseComplement || d.complement || '').trim(),
    codePostal: String(a.codePostal || d.codePostal || '').trim(),
    ville: String(a.ville || d.ville || '').trim(),
    pays: String(a.pays || d.pays || 'France').trim()
  };
}

module.exports = normalizeClientAddress;
