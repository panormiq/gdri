/**
 * Recherche de contacts e-mail (clients, fournisseurs, boutiques) pour autocomplétion.
 */

const listClients = require('../clients/listClients');
const listFournisseurs = require('../fournisseurs/listFournisseurs');
const listBoutiques = require('../boutiques/listBoutiques');
const isAnnuaireAvailable = require('../../integrations/annuaire-bridge/isAnnuaireAvailable');

function contactDisplayName(contact) {
  if (!contact) return '';
  return [contact.prenom, contact.nom].filter(Boolean).join(' ').trim()
    || String(contact.nom || '').trim();
}

function pushContact(bucket, seen, { email, name, org, kind }) {
  const normalized = String(email || '').trim().toLowerCase();
  if (!normalized || !normalized.includes('@') || seen.has(normalized)) return;
  seen.add(normalized);
  bucket.push({
    email: normalized,
    name: String(name || '').trim(),
    org: String(org || '').trim(),
    kind: String(kind || '').trim()
  });
}

function collectEntityContacts(entity, orgLabel, kind, bucket, seen) {
  const org = orgLabel || entity.displayName || entity.raisonSociale || entity.nom || '';
  if (entity.email) {
    pushContact(bucket, seen, {
      email: entity.email,
      name: contactDisplayName({ prenom: entity.prenom, nom: entity.nom }) || entity.contactNom || org,
      org,
      kind
    });
  }
  const contacts = Array.isArray(entity.contacts) ? entity.contacts : [];
  contacts.forEach((ct) => {
    pushContact(bucket, seen, {
      email: ct.email,
      name: contactDisplayName(ct) || org,
      org,
      kind
    });
  });
}

function matchesQuery(entry, q) {
  if (!q) return true;
  const hay = [
    entry.email,
    entry.name,
    entry.org,
    entry.kind
  ].join(' ').toLowerCase();
  return q.split(/\s+/).filter(Boolean).every((token) => hay.includes(token));
}

const KIND_ORDER = { client: 0, fournisseur: 1, annuaire: 2, boutique: 3 };

async function searchMailContacts(db, entrepriseId, { q = '', limit = 15 } = {}) {
  const query = String(q || '').trim().toLowerCase();
  const max = Math.min(Math.max(Number(limit) || 15, 1), 50);

  const [clients, fournisseurs, boutiques] = await Promise.all([
    listClients(db, entrepriseId, {}),
    listFournisseurs(db, entrepriseId, {}),
    listBoutiques(db, entrepriseId, {})
  ]);

  const results = [];
  const seen = new Set();

  (clients || []).forEach((client) => {
    collectEntityContacts(client, client.displayName || client.raisonSociale, 'client', results, seen);
  });
  (fournisseurs || []).forEach((fournisseur) => {
    collectEntityContacts(fournisseur, fournisseur.displayName || fournisseur.raisonSociale, 'fournisseur', results, seen);
  });
  (boutiques || []).forEach((boutique) => {
    collectEntityContacts(boutique, boutique.nom || boutique.raisonSociale, 'boutique', results, seen);
  });

  if (isAnnuaireAvailable()) {
    const path = require('path');
    const listAnnuaireContacts = require(path.join(
      __dirname,
      '../../../../annuaire/backend/services/contacts/listContacts.js'
    ));
    const annuaireContacts = await listAnnuaireContacts(db, entrepriseId, { search: query });
    (annuaireContacts || []).forEach((ct) => {
      pushContact(results, seen, {
        email: ct.email,
        name: contactDisplayName(ct) || ct.displayName || '',
        org: ct.organisationName || '',
        kind: 'annuaire'
      });
    });
  }

  return results
    .filter((entry) => matchesQuery(entry, query))
    .sort((a, b) => {
      const kindDiff = (KIND_ORDER[a.kind] ?? 9) - (KIND_ORDER[b.kind] ?? 9);
      if (kindDiff !== 0) return kindDiff;
      return a.name.localeCompare(b.name, 'fr');
    })
    .slice(0, max);
}

module.exports = searchMailContacts;
