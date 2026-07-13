/**



 * FICHIER : modules/gderpi/backend/services/commande-client/createFromDevis.js



 * RÔLE : Crée une commande client à partir d'un devis accepté (statut validée client).



 */







const getDevisById = require('../devis/getDevisById');



const validateDevisToCommande = require('../workflow/validateDevisToCommande');



const copyDevisLinesToCommande = require('../workflow/copyDevisLinesToCommande');



const detectCommandeModifiedFromDevis = require('../workflow/detectCommandeModifiedFromDevis');



const buildBesoinsFromLignes = require('../besoins/buildBesoinsFromLignes');



const resolvePipelineStatutAfterGdri = require('./resolvePipelineStatutAfterGdri');



const calculateDevisTotals = require('../devis/calculateDevisTotals');



const nextSequenceNumber = require('../sequences/nextSequenceNumber');



const ensureCommandeClientIndexes = require('./ensureCommandeClientIndexes');



const toCommandeClientEntry = require('./toCommandeClientEntry');

const ensureCommandesFournisseurFromClient = require('../commande-fournisseur/ensureCommandesFournisseurFromClient');

const setCommandeClientStatut = require('./setCommandeClientStatut');

const commandeNeedsAchats = require('../workflow/commandeNeedsAchats');

const getCommandeClientById = require('./getCommandeClientById');



const crypto = require('crypto');







const COLLECTION_DEVIS = 'gderpi_devis';



const COLLECTION = 'gderpi_commandes_client';







async function createFromDevis(db, entrepriseId, devisId, payload = {}) {



  const devis = await getDevisById(db, entrepriseId, devisId);



  const p = payload && typeof payload === 'object' ? payload : {};



  validateDevisToCommande(devis, { allowExpired: p.allowExpired === true });







  await ensureCommandeClientIndexes(db);



  const commandeClientId = crypto.randomUUID();



  const numero = await nextSequenceNumber(db, entrepriseId, devis.boutiqueId, 'commande_client');



  const lignesSource = Array.isArray(p.lignes) && p.lignes.length ? p.lignes : devis.lignes;



  const lignes = copyDevisLinesToCommande(lignesSource);



  const modifieeParClient = detectCommandeModifiedFromDevis(devis.lignes, lignesSource);



  const conformeAuDevis = !modifieeParClient;



  let statut = modifieeParClient ? 'a_valider_gdri' : 'validee_gdri';



  let besoins = [];



  if (conformeAuDevis) {



    besoins = await buildBesoinsFromLignes(db, entrepriseId, lignes);



    statut = resolvePipelineStatutAfterGdri({ lignes, besoins });



  }



  const totaux = calculateDevisTotals(lignes);



  const now = new Date();



  const documentClient = String(devis.documentClient || devis.referenceClient || '').trim();



  const doc = {



    entrepriseId: String(entrepriseId),



    commandeClientId,



    boutiqueId: devis.boutiqueId,



    clientId: devis.clientId,



    devisId: devis.id,



    devisNumero: devis.numero,



    pmCardId: devis.pmCardId || null,



    documentClient,



    numero,



    statut,



    conformeAuDevis,



    modifieeParClient,



    validationGdriRequise: modifieeParClient,



    validationGdriAt: conformeAuDevis ? now : null,



    referenceClient: p.referenceClient !== undefined



      ? String(p.referenceClient || '').trim()



      : '',



    objet: p.objet !== undefined ? String(p.objet || '').trim() : devis.objet,



    notes: p.notes !== undefined ? String(p.notes || '').trim() : devis.notes,



    lignes,



    totaux,



    besoins,



    factureNumero: null,



    factureDate: null,



    historique: [{ statut, date: now, sourceDevisId: devis.id, conformeAuDevis }],



    createdAt: now,



    updatedAt: now



  };







  await db.collection(COLLECTION).insertOne(doc);



  await db.collection(COLLECTION_DEVIS).updateOne(



    { entrepriseId: String(entrepriseId), devisId: String(devisId).trim() },



    { $set: { commandeClientId, commandeClientNumero: numero, updatedAt: now } }



  );







  const entry = toCommandeClientEntry(doc);

  if (conformeAuDevis && commandeNeedsAchats({ ...entry, besoins })) {
    try {
      const created = await ensureCommandesFournisseurFromClient(db, entrepriseId, commandeClientId);
      if (created.length) {
        await setCommandeClientStatut(db, entrepriseId, commandeClientId, 'achats_en_cours', {
          historique: { action: 'preparer_achats', count: created.length }
        });
      }
    } catch (error) {
      console.error('GDERPI createFromDevis ensure CF:', error.message || error);
    }
  }

  try {
    const notifyPmFromCommande = require('../../integrations/pm-bridge/notifyPmFromCommande');
    await notifyPmFromCommande(db, entrepriseId, entry);
  } catch (_) {}

  return getCommandeClientById(db, entrepriseId, commandeClientId);



}







module.exports = createFromDevis;


