/**

 * FICHIER : modules/gderpi/backend/services/commande-client/facturerCommandeClient.js

 * RÔLE : Émet une facture client (partielle ou complète) sur lignes livrées.

 */



const crypto = require('crypto');

const fetchCommandeClientEntry = require('./fetchCommandeClientEntry');

const nextSequenceNumber = require('../sequences/nextSequenceNumber');

const toCommandeClientEntry = require('./toCommandeClientEntry');

const listLignesFacturables = require('../facturation/listLignesFacturables');

const resolveFactureSelections = require('../facturation/resolveFactureSelections');

const buildFactureSnapshotLignes = require('../facturation/buildFactureSnapshotLignes');

const applyFactureQuantites = require('../facturation/applyFactureQuantites');

const calculateDevisTotals = require('../devis/calculateDevisTotals');

const resolveStatutAfterFacturation = require('../facturation/resolveStatutAfterFacturation');

const resolveCommandeFactures = require('../facturation/resolveCommandeFactures');



const COLLECTION = 'gderpi_commandes_client';



const BLOCKED_STATUTS = new Set(['annulee', 'validee_client', 'a_valider_gdri', 'facturee']);



async function facturerCommandeClient(db, entrepriseId, commandeClientId, payload = {}) {

  const commande = await fetchCommandeClientEntry(db, entrepriseId, commandeClientId);

  if (!commande) throw new Error('Commande client introuvable');



  if (BLOCKED_STATUTS.has(String(commande.statut || ''))) {

    throw new Error('Commande non éligible à la facturation à ce stade');

  }



  const selections = resolveFactureSelections(commande, payload);

  if (!selections.length) {

    const billable = listLignesFacturables(commande);

    if (!billable.length) {

      throw new Error('Aucune ligne livrée disponible à facturer');

    }

    throw new Error('Sélectionnez au moins une ligne à facturer');

  }



  selections.forEach((sel) => {

    const bill = listLignesFacturables(commande).find((b) => b.id === sel.id);

    if (!bill) throw new Error('Ligne non facturable : ' + sel.id);

    if (sel.quantite > bill.quantiteMax + 0.0001) {

      throw new Error('Quantité à facturer trop élevée pour la ligne ' + (bill.line.reference || sel.id));

    }

  });



  const snapshotLignes = buildFactureSnapshotLignes(commande.lignes, selections);

  if (!snapshotLignes.length) throw new Error('Aucune ligne valide pour la facture');



  const totaux = calculateDevisTotals(snapshotLignes);

  const factureNumero = await nextSequenceNumber(

    db,

    entrepriseId,

    commande.boutiqueId,

    'facture'

  );

  const now = new Date();

  const factureId = crypto.randomUUID();

  const facture = {

    id: factureId,

    numero: factureNumero,

    date: now,

    payee: false,

    payeeAt: null,

    lignes: selections,

    totaux

  };



  const updatedLignes = applyFactureQuantites(commande.lignes, selections);

  const existingFactures = resolveCommandeFactures(commande);

  const nextCommande = {

    ...commande,

    lignes: updatedLignes,

    factures: [...existingFactures, facture]

  };

  const newStatut = resolveStatutAfterFacturation(nextCommande);



  await db.collection(COLLECTION).updateOne(

    { entrepriseId: String(entrepriseId), commandeClientId: String(commandeClientId).trim() },

    {

      $set: {

        lignes: updatedLignes,

        factures: [...existingFactures, facture],

        statut: newStatut,

        factureNumero,

        factureDate: now,

        facturePayee: false,

        facturePayeeAt: null,

        updatedAt: now

      },

      $push: {

        historique: {

          statut: newStatut,

          date: now,

          factureNumero,

          factureId,

          action: 'facture_emise',

          ligneIds: selections.map((s) => s.id)

        }

      }

    }

  );



  const doc = await db.collection(COLLECTION).findOne({

    entrepriseId: String(entrepriseId),

    commandeClientId: String(commandeClientId).trim()

  });

  const entry = toCommandeClientEntry(doc);

  try {
    const notifyPmFromCommande = require('../../integrations/pm-bridge/notifyPmFromCommande');
    await notifyPmFromCommande(db, entrepriseId, entry);
  } catch (_) {}

  return { ...entry, lastFacture: facture };

}



module.exports = facturerCommandeClient;

