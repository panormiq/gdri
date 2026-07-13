/**
 * FICHIER : modules/gderpi/backend/services/clients/normalizeClientAdresse.js
 * RÔLE : Normalise une adresse rattachée à un client (type + coordonnées).
 *
 * ENTRÉES : raw objet adresse
 * SORTIES : adresse client normalisée
 *
 * DÉPEND DE : crypto, normalizeClientAddress.js
 * NE PAS : persistance Mongo
 *
 * APPELÉ PAR : normalizeClient.js
 */

const crypto = require('crypto');
const normalizeClientAddress = require('./normalizeClientAddress');

const ADDRESS_TYPES = new Set(['generique', 'facturation', 'livraison', 'siege', 'autre']);

function normalizeClientAdresseType(value) {
  const raw = String(value || 'autre').trim().toLowerCase();
  return ADDRESS_TYPES.has(raw) ? raw : 'autre';
}

function normalizeClientAdresse(raw) {
  const a = raw && typeof raw === 'object' ? raw : {};
  const type = normalizeClientAdresseType(a.type);
  const coords = normalizeClientAddress(a);
  return {
    id: String(a.id || a.adresseId || '').trim() || crypto.randomUUID(),
    type,
    libelle: coords.libelle,
    adresse: coords.adresse,
    complement: coords.complement,
    codePostal: coords.codePostal,
    ville: coords.ville,
    pays: coords.pays
  };
}

module.exports = normalizeClientAdresse;
