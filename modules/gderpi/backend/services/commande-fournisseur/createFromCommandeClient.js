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

  const lignesSource = useBesoins

    ? besoinsToLignesFournisseur(commande.besoins)

    : legacyProductLines(commande);



  if (!lignesSource.length) {

    throw new Error(useBesoins

      ? 'Aucun besoin d\'achat ouvert pour cette commande'

      : 'Aucune ligne produit à commander');

  }



  await ensureCommandeFournisseurIndexes(db);

  const groups = await splitLinesByFournisseur(db, entrepriseId, lignesSource);

  const created = [];

  const now = new Date();

  let besoins = Array.isArray(commande.besoins) ? [...commande.besoins] : [];



  for (const [key, lignes] of groups.entries()) {

    if (!lignes.length) continue;

    const { fournisseurId, fournisseurBoutiqueId } = parseSupplierGroupKey(key);

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

      objet: 'Achats — ' + (commande.objet || commande.numero),

      notes: commande.notes,

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

