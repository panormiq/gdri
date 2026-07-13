/**
 * Marque une facture client comme payée ou non payée.
 */

const fetchCommandeClientEntry = require('./fetchCommandeClientEntry');
const resolveFactureById = require('../facturation/resolveFactureById');
const resolveCommandeFactures = require('../facturation/resolveCommandeFactures');

const COLLECTION = 'gderpi_commandes_client';

async function setFacturePayee(db, entrepriseId, commandeClientId, payee, factureId = null) {
  const commande = await fetchCommandeClientEntry(db, entrepriseId, commandeClientId);
  if (!commande) throw new Error('Commande client introuvable');

  const factures = resolveCommandeFactures(commande);
  if (!factures.length) throw new Error('Aucune facture émise pour cette commande');

  const target = resolveFactureById(commande, factureId);
  if (!target) throw new Error('Facture introuvable');

  const isPayee = payee === true || payee === 'true' || payee === 1 || payee === '1';
  const now = new Date();
  const targetId = String(target.id);

  const updatedFactures = factures.map((f) => {
    if (String(f.id) !== targetId) return f;
    return {
      ...f,
      payee: isPayee,
      payeeAt: isPayee ? now : null
    };
  });

  const last = updatedFactures[updatedFactures.length - 1];
  const allPaid = updatedFactures.every((f) => f.payee);

  await db.collection(COLLECTION).updateOne(
    { entrepriseId: String(entrepriseId), commandeClientId: String(commandeClientId).trim() },
    {
      $set: {
        factures: updatedFactures,
        facturePayee: String(last.id) === targetId ? isPayee : commande.facturePayee,
        facturePayeeAt: String(last.id) === targetId && isPayee ? now : commande.facturePayeeAt,
        updatedAt: now
      },
      $push: {
        historique: {
          action: isPayee ? 'facture_payee' : 'facture_non_payee',
          date: now,
          factureNumero: target.numero,
          factureId: targetId,
          allPaid
        }
      }
    }
  );

  return fetchCommandeClientEntry(db, entrepriseId, commandeClientId);
}

module.exports = setFacturePayee;
