/**
 * FICHIER : modules/gderpi/backend/services/clients/listClients.js
 * RÔLE : Liste les clients avec recherche texte.
 *
 * ENTRÉES : db, entrepriseId, { search }
 * SORTIES : Client[]
 *
 * DÉPEND DE : ensureClientIndexes.js, toClientEntry.js
 * NE PAS : mutation
 *
 * APPELÉ PAR : clientsController
 */

const ensureClientIndexes = require('./ensureClientIndexes');
const toClientEntry = require('./toClientEntry');
const toClientSummaryEntry = require('./toClientSummaryEntry');
const enrichClientWithAnnuaire = require('../../integrations/annuaire-bridge/enrichClientWithAnnuaire');
const isAnnuaireAvailable = require('../../integrations/annuaire-bridge/isAnnuaireAvailable');

const COLLECTION = 'gderpi_clients';

function clientHaystack(c) {
  return [
    c.displayName, c.raisonSociale, c.prenom, c.nom,
    c.email, c.telephone, c.ville, c.siret, c.tvaIntracommunautaire, c.siteWeb,
    c.contactNom, c.adresseFacturation?.ville, c.adresseLivraison?.ville,
    c.contactSearch,
    ...(Array.isArray(c.contacts) ? c.contacts.flatMap((ct) => [
      ct.prenom, ct.nom, ct.service, ct.fonction, ct.email, ct.telephone
    ]) : []),
    ...(Array.isArray(c.adresses) ? c.adresses.flatMap((a) => [
      a.libelle, a.adresse, a.complement, a.codePostal, a.ville, a.type
    ]) : [])
  ].join(' ').toLowerCase();
}

async function listClients(db, entrepriseId, { search = '', lite = false } = {}) {
  await ensureClientIndexes(db);
  const col = db.collection(COLLECTION);
  const docs = await col.find({ entrepriseId: String(entrepriseId) }).sort({ updatedAt: -1 }).toArray();
  const q = String(search || '').trim().toLowerCase();
  const mapEntry = lite ? toClientSummaryEntry : toClientEntry;
  let entries = docs.map((d) => mapEntry(d)).filter(Boolean);
  if (q) {
    entries = entries.filter((c) => clientHaystack(c).includes(q));
  }
  if (!lite && isAnnuaireAvailable()) {
    entries = await Promise.all(
      entries.map((c) => enrichClientWithAnnuaire(db, entrepriseId, c))
    );
  }
  return entries;
}

module.exports = listClients;
