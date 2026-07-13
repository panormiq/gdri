const getCommandeClientById = require('../commande-client/getCommandeClientById');
const { commandeClientKind, filterLinesByKind } = require('../workflow/commandeClientKind');
const isCommandeFullyRecetted = require('../workflow/isCommandeFullyRecetted');
const maybeMarkCommandeLivree = require('../workflow/maybeMarkCommandeLivree');
const { applyRecetteLignes, remainingDevLineIds } = require('../commande-client/applyRecetteLignes');
const { canRecordAvancement } = require('../workflow/canRecordAvancement');

const COLLECTION = 'gderpi_commandes_client';

async function validateRecetteCommande(db, entrepriseId, commandeClientId, payload = {}) {
  const commande = await getCommandeClientById(db, entrepriseId, commandeClientId);
  if (!commande) throw new Error('Commande client introuvable');

  if (commande.statut === 'a_valider_gdri') {
    throw new Error('Validez d\'abord la commande côté GDRI avant d\'enregistrer la livraison prestation');
  }
  if (!canRecordAvancement(commande)) {
    const kind = commandeClientKind(commande);
    if (kind === 'produit') {
      throw new Error('Cette commande ne contient que des produits — utilisez un bon de livraison');
    }
    if (['annulee', 'facturee', 'validee_client'].includes(commande.statut)) {
      throw new Error('Commande non éligible à une livraison prestation à ce stade');
    }
    throw new Error('Aucune prestation / développement restant à livrer');
  }

  const p = payload && typeof payload === 'object' ? payload : {};
  const mode = String(p.mode || '').trim().toLowerCase();
  const now = new Date();
  const notes = String(p.notes || '').trim();
  const libelle = String(p.libelle || p.label || 'Livraison prestation').trim();

  let ligneIds = Array.isArray(p.ligneIds) ? p.ligneIds.map((id) => String(id).trim()).filter(Boolean) : [];
  if (mode === 'complet' || !ligneIds.length) {
    ligneIds = remainingDevLineIds(commande.lignes);
  }
  if (!ligneIds.length) {
    throw new Error('Aucune prestation / développement restant à livrer');
  }

  const updatedLignes = applyRecetteLignes(commande.lignes, ligneIds, now);
  const beforeDone = filterLinesByKind(commande.lignes, 'dev').filter((l) => l.recetteValideeAt).length;
  const afterDone = filterLinesByKind(updatedLignes, 'dev').filter((l) => l.recetteValideeAt).length;
  if (afterDone <= beforeDone) {
    throw new Error('Aucune ligne prestation / développement n\'a pu être mise à jour — rechargez la commande et réessayez');
  }
  const fullyRecetted = isCommandeFullyRecetted({ ...commande, lignes: updatedLignes });
  const totalDev = filterLinesByKind(commande.lignes, 'dev').length;
  const doneDev = filterLinesByKind(updatedLignes, 'dev').filter((l) => l.recetteValideeAt).length;

  const $set = {
    lignes: updatedLignes,
    updatedAt: now
  };
  if (fullyRecetted) {
    $set.recetteValideeAt = now;
    $set.recetteNotes = notes;
    $set.recetteLibelle = libelle;
  }

  const avancement = {
    type: 'recette',
    libelle,
    notes,
    percent: totalDev ? Math.round((doneDev / totalDev) * 100) : 100,
    ligneIds,
    date: now
  };

  await db.collection(COLLECTION).updateOne(
    { entrepriseId: String(entrepriseId), commandeClientId: String(commandeClientId).trim() },
    {
      $set,
      $push: {
        avancements: avancement,
        historique: {
          statut: fullyRecetted ? 'recette_ok' : 'recette_partielle',
          date: now,
          libelle,
          notes,
          ligneIds
        }
      }
    }
  );

  await maybeMarkCommandeLivree(db, entrepriseId, commandeClientId);
  return getCommandeClientById(db, entrepriseId, commandeClientId);
}

module.exports = validateRecetteCommande;
