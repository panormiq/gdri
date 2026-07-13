/**
 * FICHIER : modules/gderpi/backend/services/commande-client/creerAvoirSurFacture.js
 * RÔLE : Émet un avoir total (ou partiel) sur une facture — imputation ou remboursement.
 */

const crypto = require('crypto');

const fetchCommandeClientEntry = require('./fetchCommandeClientEntry');
const nextSequenceNumber = require('../sequences/nextSequenceNumber');
const toCommandeClientEntry = require('./toCommandeClientEntry');
const resolveFactureById = require('../facturation/resolveFactureById');
const resolveCommandeFactures = require('../facturation/resolveCommandeFactures');
const listLignesAvoirables = require('../facturation/listLignesAvoirables');
const resolveAvoirSelections = require('../facturation/resolveAvoirSelections');
const buildFactureSnapshotLignes = require('../facturation/buildFactureSnapshotLignes');
const applyAvoirQuantites = require('../facturation/applyAvoirQuantites');
const calculateDevisTotals = require('../devis/calculateDevisTotals');
const resolveStatutAfterFacturation = require('../facturation/resolveStatutAfterFacturation');
const computeFactureSettlement = require('../facturation/computeFactureSettlement');

const COLLECTION = 'gderpi_commandes_client';

async function creerAvoirSurFacture(db, entrepriseId, commandeClientId, factureId, payload = {}) {
  const commande = await fetchCommandeClientEntry(db, entrepriseId, commandeClientId);
  if (!commande) throw new Error('Commande client introuvable');

  const facture = resolveFactureById(commande, factureId);
  if (!facture) throw new Error('Facture introuvable');

  if (facture.soldeeParAvoir === true) {
    throw new Error('Cette facture est déjà soldée par avoir');
  }

  const p = payload && typeof payload === 'object' ? payload : {};
  const effectivePayload = { ...p, mode: p.mode || 'complet' };

  const selections = resolveAvoirSelections(facture, commande.lignes, effectivePayload);
  if (!selections.length) {
    const avoirables = listLignesAvoirables(facture, commande.lignes);
    if (!avoirables.length) {
      throw new Error('Aucun montant disponible pour un avoir sur cette facture');
    }
    throw new Error('Sélectionnez au moins une ligne à créditer');
  }

  selections.forEach((sel) => {
    const bill = listLignesAvoirables(facture, commande.lignes).find((b) => b.id === sel.id);
    if (!bill) throw new Error('Ligne non créditable : ' + sel.id);
    if (sel.quantite > bill.quantiteMax + 0.0001) {
      throw new Error('Quantité à créditer trop élevée pour la ligne ' + (bill.line.reference || sel.id));
    }
  });

  const snapshotLignes = buildFactureSnapshotLignes(commande.lignes, selections);
  if (!snapshotLignes.length) throw new Error('Aucune ligne valide pour l\'avoir');

  const totaux = calculateDevisTotals(snapshotLignes);
  const avoirNumero = await nextSequenceNumber(
    db,
    entrepriseId,
    commande.boutiqueId,
    'avoir'
  );
  const now = new Date();
  const avoirId = crypto.randomUUID();
  const motif = String(payload.motif || '').trim();
  const facturePayee = facture.payee === true;
  const mode = facturePayee ? 'remboursement' : 'imputation';

  const avoir = {
    id: avoirId,
    numero: avoirNumero,
    date: now,
    factureOrigineId: facture.id,
    factureOrigineNumero: facture.numero,
    motif,
    mode,
    remboursementStatut: mode === 'remboursement' ? 'en_attente' : null,
    rembourseAt: null,
    lignes: selections,
    totaux
  };

  const updatedLignes = applyAvoirQuantites(commande.lignes, selections);
  const existingFactures = resolveCommandeFactures(commande);
  const targetFactureId = String(facture.id);

  const updatedFactures = existingFactures.map((f) => {
    if (String(f.id) !== targetFactureId) return f;
    const avoirs = Array.isArray(f.avoirs) ? [...f.avoirs, avoir] : [avoir];
    const withAvoir = { ...f, avoirs };
    const settlement = computeFactureSettlement(withAvoir);
    const patch = { ...f, avoirs };

    if (mode === 'imputation' && settlement.fullyCredited && !f.payee) {
      patch.soldeeParAvoir = true;
      patch.soldeeParAvoirAt = now;
    }

    return patch;
  });

  const nextCommande = {
    ...commande,
    lignes: updatedLignes,
    factures: updatedFactures
  };
  const newStatut = resolveStatutAfterFacturation(nextCommande);

  await db.collection(COLLECTION).updateOne(
    { entrepriseId: String(entrepriseId), commandeClientId: String(commandeClientId).trim() },
    {
      $set: {
        lignes: updatedLignes,
        factures: updatedFactures,
        statut: newStatut,
        updatedAt: now
      },
      $push: {
        historique: {
          statut: newStatut,
          date: now,
          avoirNumero,
          avoirId,
          factureNumero: facture.numero,
          factureId: facture.id,
          action: 'avoir_emis',
          mode,
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
  return { ...entry, lastAvoir: avoir, lastFacture: facture };
}

module.exports = creerAvoirSurFacture;
