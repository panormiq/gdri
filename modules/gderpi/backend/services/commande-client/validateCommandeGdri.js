/**
 * FICHIER : modules/gderpi/backend/services/commande-client/validateCommandeGdri.js
 * RÔLE : Validation interne GDRI après acceptation client.
 */

const getCommandeClientById = require('./getCommandeClientById');
const buildBesoinsFromLignes = require('../besoins/buildBesoinsFromLignes');
const resolvePipelineStatutAfterGdri = require('./resolvePipelineStatutAfterGdri');
const ensureCommandesFournisseurFromClient = require('../commande-fournisseur/ensureCommandesFournisseurFromClient');
const setCommandeClientStatut = require('./setCommandeClientStatut');
const commandeNeedsAchats = require('../workflow/commandeNeedsAchats');
const { requireBonCommandeClient } = require('../workflow/bonCommandeClient');

const COLLECTION = 'gderpi_commandes_client';

async function validateCommandeGdri(db, entrepriseId, commandeClientId) {
  const commande = await getCommandeClientById(db, entrepriseId, commandeClientId, { skipPipelineRepair: true });
  if (!commande) throw new Error('Commande client introuvable');
  if (!['validee_client', 'a_valider_gdri'].includes(commande.statut)) {
    throw new Error('Cette commande n\'est pas en attente de validation GDRI');
  }
  requireBonCommandeClient(commande);

  const now = new Date();
  let besoins = Array.isArray(commande.besoins) ? commande.besoins : [];
  if (!besoins.length) {
    besoins = await buildBesoinsFromLignes(db, entrepriseId, commande.lignes);
  }

  let nextStatut = resolvePipelineStatutAfterGdri({ ...commande, besoins });

  await db.collection(COLLECTION).updateOne(
    { entrepriseId: String(entrepriseId), commandeClientId: String(commandeClientId).trim() },
    {
      $set: {
        statut: nextStatut,
        besoins,
        validationGdriRequise: false,
        validationGdriAt: now,
        updatedAt: now
      },
      $push: { historique: { statut: nextStatut, date: now, action: 'validation_gdri' } }
    }
  );

  if (commandeNeedsAchats({ ...commande, besoins })) {
    try {
      const created = await ensureCommandesFournisseurFromClient(db, entrepriseId, commandeClientId);
      if (created.length) {
        await setCommandeClientStatut(db, entrepriseId, commandeClientId, 'achats_en_cours', {
          historique: { action: 'preparer_achats', count: created.length }
        });
      }
    } catch (error) {
      console.error('GDERPI validateCommandeGdri ensure CF:', error.message || error);
    }
  }

  const entry = await getCommandeClientById(db, entrepriseId, commandeClientId);

  try {
    const notifyPmFromCommande = require('../../integrations/pm-bridge/notifyPmFromCommande');
    await notifyPmFromCommande(db, entrepriseId, entry);
  } catch (_) {}

  return entry;
}

module.exports = validateCommandeGdri;
