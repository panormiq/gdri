/**
 * FICHIER : modules/gderpi/backend/services/commande-client/createCommandeClient.js
 * RÔLE : Crée une commande client autonome (sans devis).
 *
 * ENTRÉES : db, entrepriseId, payload { boutiqueId, clientId, lignes, objet, notes, documentClient, referenceClient, contact*, emetteur* }
 * SORTIES : CommandeClient créée
 *
 * DÉPEND DE : getBoutiqueById.js, getClientById.js, normalizeDevisLine.js, buildBesoinsFromLignes.js
 * NE PAS : transformation depuis devis
 *
 * APPELÉ PAR : workflowController
 */

const crypto = require('crypto');
const getBoutiqueById = require('../boutiques/getBoutiqueById');
const getClientById = require('../clients/getClientById');
const normalizeDevisLine = require('../devis/normalizeDevisLine');
const calculateDevisTotals = require('../devis/calculateDevisTotals');
const nextSequenceNumber = require('../sequences/nextSequenceNumber');
const ensureCommandeClientIndexes = require('./ensureCommandeClientIndexes');
const toCommandeClientEntry = require('./toCommandeClientEntry');
const buildBesoinsFromLignes = require('../besoins/buildBesoinsFromLignes');
const resolvePipelineStatutAfterGdri = require('./resolvePipelineStatutAfterGdri');
const ensureCommandesFournisseurFromClient = require('../commande-fournisseur/ensureCommandesFournisseurFromClient');
const setCommandeClientStatut = require('./setCommandeClientStatut');
const commandeNeedsAchats = require('../workflow/commandeNeedsAchats');
const getCommandeClientById = require('./getCommandeClientById');
const lineRequiresRecette = require('../workflow/lineRequiresRecette');
const normalizeDevisContact = require('../devis/normalizeDevisContact');
const normalizeDevisEmetteurContact = require('../devis/normalizeDevisEmetteurContact');
const { requireBonCommandeClient } = require('../workflow/bonCommandeClient');

const COLLECTION = 'gderpi_commandes_client';

async function createCommandeClient(db, entrepriseId, data) {
  const p = data && typeof data === 'object' ? data : {};
  const boutiqueId = String(p.boutiqueId || '').trim();
  if (!boutiqueId) throw new Error('Boutique requise');
  const boutique = await getBoutiqueById(db, entrepriseId, boutiqueId);
  if (!boutique) throw new Error('Boutique introuvable');

  const clientId = String(p.clientId || '').trim();
  if (!clientId) throw new Error('Client requis');
  const client = await getClientById(db, entrepriseId, clientId);
  if (!client) throw new Error('Client introuvable');

  const lignesRaw = Array.isArray(p.lignes) ? p.lignes : [];
  if (!lignesRaw.length) throw new Error('Au moins une ligne requise');
  const now = new Date();
  const lignes = lignesRaw.map((line, i) => {
    const normalized = normalizeDevisLine(line, i);
    const stamped = lineRequiresRecette(normalized)
      ? normalized
      : { ...normalized, recetteValideeAt: normalized.recetteValideeAt || now };
    return { ...stamped, id: crypto.randomUUID(), sourceDevisLineId: null };
  });

  await ensureCommandeClientIndexes(db);
  const commandeClientId = crypto.randomUUID();
  const numero = await nextSequenceNumber(db, entrepriseId, boutiqueId, 'commande_client');
  const besoins = await buildBesoinsFromLignes(db, entrepriseId, lignes);
  const statut = resolvePipelineStatutAfterGdri({ lignes, besoins });
  const totaux = calculateDevisTotals(lignes);
  const contact = normalizeDevisContact(p);
  const emetteur = normalizeDevisEmetteurContact(p);
  const bonCommande = requireBonCommandeClient(p);

  const doc = {
    entrepriseId: String(entrepriseId),
    commandeClientId,
    boutiqueId,
    clientId,
    devisId: null,
    devisNumero: '',
    pmCardId: null,
    documentClient: String(p.documentClient || '').trim() || bonCommande,
    contactClientId: contact.contactClientId,
    contactNom: contact.contactNom,
    contactService: contact.contactService,
    contactFonction: contact.contactFonction,
    contactEmail: contact.contactEmail,
    contactTelephone: contact.contactTelephone,
    emetteurContactId: emetteur.emetteurContactId,
    emetteurContactNom: emetteur.emetteurContactNom,
    emetteurContactFonction: emetteur.emetteurContactFonction,
    emetteurContactEmail: emetteur.emetteurContactEmail,
    emetteurContactTelephone: emetteur.emetteurContactTelephone,
    numero,
    statut,
    conformeAuDevis: false,
    modifieeParClient: false,
    validationGdriRequise: false,
    validationGdriAt: now,
    referenceClient: bonCommande,
    sansBonCommandeClient: !bonCommande,
    objet: String(p.objet || '').trim(),
    notes: String(p.notes || '').trim(),
    lignes,
    totaux,
    besoins,
    factureNumero: null,
    factureDate: null,
    historique: [{ statut, date: now, origine: 'manuel' }],
    createdAt: now,
    updatedAt: now
  };

  await db.collection(COLLECTION).insertOne(doc);
  const entry = toCommandeClientEntry(doc);

  if (commandeNeedsAchats({ ...entry, besoins })) {
    try {
      const created = await ensureCommandesFournisseurFromClient(db, entrepriseId, commandeClientId);
      if (created.length) {
        await setCommandeClientStatut(db, entrepriseId, commandeClientId, 'achats_en_cours', {
          historique: { action: 'preparer_achats', count: created.length }
        });
      }
    } catch (error) {
      console.error('GDERPI createCommandeClient ensure CF:', error.message || error);
    }
  }

  try {
    const notifyPmFromCommande = require('../../integrations/pm-bridge/notifyPmFromCommande');
    await notifyPmFromCommande(db, entrepriseId, entry);
  } catch (_) {}

  return getCommandeClientById(db, entrepriseId, commandeClientId);
}

module.exports = createCommandeClient;
