const getCommandeClientById = require('../commande-client/getCommandeClientById');
const { commandeClientKind, filterLinesByKind } = require('../workflow/commandeClientKind');
const isCommandeFullyRecetted = require('../workflow/isCommandeFullyRecetted');
const maybeMarkCommandeLivree = require('../workflow/maybeMarkCommandeLivree');
const applyAvancementLignes = require('../commande-client/applyAvancementLignes');
const { remainingDevLines, canRecordAvancement } = require('../workflow/canRecordAvancement');
const remainingPrestationQty = require('../workflow/remainingPrestationQty');

const COLLECTION = 'gderpi_commandes_client';

function buildAvancementItems(commande, payload) {
  const p = payload && typeof payload === 'object' ? payload : {};
  const mode = String(p.mode || '').trim().toLowerCase();
  const remaining = remainingDevLines(commande);
  if (mode === 'complet' || !Array.isArray(p.lignes) || !p.lignes.length) {
    return remaining.map((line) => ({
      id: String(line.id),
      quantite: remainingPrestationQty(line)
    }));
  }
  return p.lignes.map((item) => ({
    id: String(item.id || item.ligneId || '').trim(),
    quantite: item.quantite,
    percent: item.percent
  })).filter((item) => item.id);
}

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
  const now = new Date();
  const notes = String(p.notes || '').trim();
  const libelle = String(p.libelle || p.label || 'Avancement prestation').trim();
  const items = buildAvancementItems(commande, p);
  if (!items.length) {
    throw new Error('Aucune prestation / développement restant à livrer');
  }

  const updatedLignes = applyAvancementLignes(commande.lignes, items, now);
  const beforeLeft = remainingDevLines(commande).length;
  const afterLeft = remainingDevLines({ ...commande, lignes: updatedLignes }).length;
  if (afterLeft >= beforeLeft && !updatedLignes.some((l, i) => {
    const prev = (commande.lignes || [])[i];
    return prev && Number(l.quantiteLivree || 0) > Number(prev.quantiteLivree || 0);
  })) {
    throw new Error('Aucun avancement n\'a pu être enregistré — indiquez des heures ou un %.');
  }

  const fullyRecetted = isCommandeFullyRecetted({ ...commande, lignes: updatedLignes });
  const totalDev = filterLinesByKind(commande.lignes, 'dev').length;
  const doneDev = totalDev - afterLeft;

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
    ligneIds: items.map((item) => item.id),
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
          ligneIds: avancement.ligneIds
        }
      }
    }
  );

  await maybeMarkCommandeLivree(db, entrepriseId, commandeClientId);
  return getCommandeClientById(db, entrepriseId, commandeClientId);
}

module.exports = validateRecetteCommande;
