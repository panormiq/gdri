/**
 * FICHIER : modules/gderpi/backend/services/commande-client/updateCommandeClient.js
 * RÔLE : Met à jour une commande client (lignes, réf. client, objet) tant qu'elle n'est pas facturée.
 *
 * ENTRÉES : db, entrepriseId, commandeClientId, patch
 * SORTIES : CommandeClient mise à jour
 *
 * DÉPEND DE : getCommandeClientById.js, normalizeDevisLine.js, calculateDevisTotals.js
 * NE PAS : changement de statut, édition après facturation
 *
 * APPELÉ PAR : workflowController
 */

const getCommandeClientById = require('./getCommandeClientById');
const normalizeDevisLine = require('../devis/normalizeDevisLine');
const calculateDevisTotals = require('../devis/calculateDevisTotals');
const normalizeDevisContact = require('../devis/normalizeDevisContact');
const normalizeDevisEmetteurContact = require('../devis/normalizeDevisEmetteurContact');
const { parseSansBonCommandeClient } = require('../workflow/bonCommandeClient');

const COLLECTION = 'gderpi_commandes_client';
const LOCKED_STATUTS = new Set(['facturee', 'facturee_partiellement', 'annulee']);

const FULFILLMENT_KEYS = [
  'quantiteLivree',
  'quantiteRecueFrs',
  'quantiteRecue',
  'quantiteFacturee',
  'recetteValideeAt'
];

function mergeFulfillmentFromExisting(normalized, previous) {
  if (!previous) return normalized;
  const out = { ...normalized };
  FULFILLMENT_KEYS.forEach((key) => {
    if (out[key] == null || out[key] === 0 || out[key] === '') {
      if (previous[key] != null && previous[key] !== '') out[key] = previous[key];
    }
  });
  return out;
}

async function updateCommandeClient(db, entrepriseId, commandeClientId, patch) {
  const existing = await getCommandeClientById(db, entrepriseId, commandeClientId);
  if (!existing) throw new Error('Commande client introuvable');
  if (LOCKED_STATUTS.has(existing.statut)) {
    throw new Error('Cette commande n\'est plus modifiable (facturée ou annulée)');
  }

  const p = patch && typeof patch === 'object' ? patch : {};
  const update = { updatedAt: new Date() };

  if (p.referenceClient !== undefined || p.sansBonCommandeClient !== undefined) {
    const nextRef = p.referenceClient !== undefined
      ? String(p.referenceClient || '').trim()
      : String(existing.referenceClient || '').trim();
    update.referenceClient = nextRef;
    update.sansBonCommandeClient = nextRef
      ? false
      : parseSansBonCommandeClient(
        p.sansBonCommandeClient !== undefined ? p.sansBonCommandeClient : existing.sansBonCommandeClient
      );
  }
  if (p.documentClient !== undefined) {
    update.documentClient = String(p.documentClient || '').trim();
  }
  if (p.objet !== undefined) update.objet = String(p.objet || '').trim();
  if (p.notes !== undefined) update.notes = String(p.notes || '').trim();
  if (p.contactClientId !== undefined || p.contactNom !== undefined || p.contactService !== undefined
    || p.contactFonction !== undefined || p.contactEmail !== undefined || p.contactTelephone !== undefined) {
    const contact = normalizeDevisContact({ ...existing, ...p });
    update.contactClientId = contact.contactClientId;
    update.contactNom = contact.contactNom;
    update.contactService = contact.contactService;
    update.contactFonction = contact.contactFonction;
    update.contactEmail = contact.contactEmail;
    update.contactTelephone = contact.contactTelephone;
  }
  if (p.emetteurContactId !== undefined || p.emetteurContactNom !== undefined
    || p.emetteurContactFonction !== undefined || p.emetteurContactEmail !== undefined
    || p.emetteurContactTelephone !== undefined) {
    const emetteur = normalizeDevisEmetteurContact({ ...existing, ...p });
    update.emetteurContactId = emetteur.emetteurContactId;
    update.emetteurContactNom = emetteur.emetteurContactNom;
    update.emetteurContactFonction = emetteur.emetteurContactFonction;
    update.emetteurContactEmail = emetteur.emetteurContactEmail;
    update.emetteurContactTelephone = emetteur.emetteurContactTelephone;
  }

  if (Array.isArray(p.lignes)) {
    const existingById = new Map((existing.lignes || []).map((l) => [String(l.id || ''), l]));
    const lignes = p.lignes.map((l, i) => {
      const normalized = normalizeDevisLine(l, i);
      return mergeFulfillmentFromExisting(normalized, existingById.get(String(normalized.id || '')));
    });
    if (!lignes.length) throw new Error('Au moins une ligne requise');
    update.lignes = lignes;
    update.totaux = calculateDevisTotals(lignes);
  }

  await db.collection(COLLECTION).updateOne(
    { entrepriseId: String(entrepriseId), commandeClientId: String(commandeClientId).trim() },
    { $set: update }
  );

  return getCommandeClientById(db, entrepriseId, commandeClientId);
}

module.exports = updateCommandeClient;
