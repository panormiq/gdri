/**
 * FICHIER : modules/gderpi/backend/services/commande-fournisseur/createFromCommandeClient.js
 * RÔLE : Génère commande(s) fournisseur depuis besoins d'achat ou lignes produit (legacy).
 */

const crypto = require('crypto');
const getCommandeClientById = require('../commande-client/getCommandeClientById');
const splitLinesByFournisseur = require('./splitLinesByFournisseur');
const besoinsToLignesFournisseur = require('../besoins/besoinsToLignesFournisseur');
const besoinIdsForLignes = require('../besoins/besoinIdsForLignes');
const markBesoinsCommandes = require('../besoins/markBesoinsCommandes');
const calculateDevisTotals = require('../devis/calculateDevisTotals');
const nextSequenceNumber = require('../sequences/nextSequenceNumber');
const ensureCommandeFournisseurIndexes = require('./ensureCommandeFournisseurIndexes');
const parseSupplierGroupKey = require('./parseSupplierGroupKey');
const toCommandeFournisseurEntry = require('./toCommandeFournisseurEntry');
const applyPrixAchatHtToLignesFournisseur = require('./applyPrixAchatHtToLignesFournisseur');

const COLLECTION_CMD = 'gderpi_commandes_client';
const COLLECTION = 'gderpi_commandes_fournisseur';

function legacyProductLines(commande) {
  const lines = Array.isArray(commande?.lignes) ? commande.lignes : [];
  const filtered = lines.filter((l) => {
    const t = String(l.articleType || '').toLowerCase();
    return t === 'produit' || (t !== 'developpement' && t !== 'service');
  });
  return filtered.length ? filtered : lines;
}

async function createFromCommandeClient(db, entrepriseId, commandeClientId, options = {}) {
  const markBesoins = options.markBesoins === true;
  const commande = await getCommandeClientById(db, entrepriseId, commandeClientId, { skipPipelineRepair: true });
  if (!commande) throw new Error('Commande client introuvable');

  if (['annulee', 'facturee', 'validee_client', 'a_valider_gdri'].includes(commande.statut)) {
    throw new Error('Commande client non éligible aux achats');
  }

  const existing = await db.collection(COLLECTION).countDocuments({
    entrepriseId: String(entrepriseId),
    commandeClientId: String(commandeClientId).trim(),
    statut: { $ne: 'annulee' }
  });
  if (existing > 0) {
    throw new Error('Des commandes fournisseur existent déjà pour cette commande client');
  }

  const openBesoins = (commande.besoins || []).filter((b) => String(b.statut) === 'ouvert');
  const useBesoins = openBesoins.length > 0;
  const lignesRaw = useBesoins
    ? besoinsToLignesFournisseur(commande.besoins)
    : legacyProductLines(commande);

  if (!lignesRaw.length) {
    throw new Error(useBesoins
      ? 'Aucun besoin d\'achat ouvert pour cette commande'
      : 'Aucune ligne produit à commander');
  }

  await ensureCommandeFournisseurIndexes(db);
  const groups = await splitLinesByFournisseur(db, entrepriseId, lignesRaw);
  const created = [];
  const now = new Date();
  let besoins = Array.isArray(commande.besoins) ? [...commande.besoins] : [];

  for (const [key, lignesGroup] of groups.entries()) {
    if (!lignesGroup.length) continue;

    const { fournisseurId, fournisseurBoutiqueId } = parseSupplierGroupKey(key);
    // Tarif d'achat du fournisseur de la CF (jamais le prix de vente client/catalogue).
    const lignes = await applyPrixAchatHtToLignesFournisseur(db, entrepriseId, lignesGroup, {
      fournisseurId,
      fournisseurBoutiqueId
    });
    const commandeFournisseurId = crypto.randomUUID();
    const numero = await nextSequenceNumber(db, entrepriseId, commande.boutiqueId, 'commande_fournisseur');
    const totaux = calculateDevisTotals(lignes);

    const doc = {
      entrepriseId: String(entrepriseId),
      commandeFournisseurId,
      boutiqueId: commande.boutiqueId,
      fournisseurId,
      fournisseurBoutiqueId,
      commandeClientId: commande.id,
      numero,
      statut: 'brouillon',
      objet: commande.numero
        ? 'Achats — ' + commande.numero
        : 'Achats fournisseur',
      notes: commande.notes,
      fraisPortHt: 0,
      fraisPortTauxTva: 0,
      lignes,
      totaux,
      historique: [{ statut: 'brouillon', date: now }],
      createdAt: now,
      updatedAt: now
    };

    await db.collection(COLLECTION).insertOne(doc);
    created.push(toCommandeFournisseurEntry(doc));

    if (useBesoins && markBesoins) {
      const ids = besoinIdsForLignes(besoins, lignes);
      besoins = markBesoinsCommandes(besoins, ids, commandeFournisseurId);
    }
  }

  if (!created.length) throw new Error('Aucune ligne à commander');

  if (useBesoins && markBesoins) {
    await db.collection(COLLECTION_CMD).updateOne(
      { entrepriseId: String(entrepriseId), commandeClientId: String(commandeClientId).trim() },
      { $set: { besoins, updatedAt: now } }
    );
  }

  return created;
}

module.exports = createFromCommandeClient;
