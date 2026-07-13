/**
 * Marque un avoir en remboursement comme remboursé.
 */

const fetchCommandeClientEntry = require('./fetchCommandeClientEntry');
const resolveFactureById = require('../facturation/resolveFactureById');
const resolveAvoirById = require('../facturation/resolveAvoirById');
const resolveCommandeFactures = require('../facturation/resolveCommandeFactures');

const COLLECTION = 'gderpi_commandes_client';

async function setAvoirRembourse(db, entrepriseId, commandeClientId, factureId, avoirId, rembourse = true) {
  const commande = await fetchCommandeClientEntry(db, entrepriseId, commandeClientId);
  if (!commande) throw new Error('Commande client introuvable');

  const facture = resolveFactureById(commande, factureId);
  if (!facture) throw new Error('Facture introuvable');

  const avoir = resolveAvoirById(facture, avoirId);
  if (!avoir) throw new Error('Avoir introuvable');
  if (avoir.mode !== 'remboursement') {
    throw new Error('Cet avoir n\'est pas en mode remboursement');
  }

  const isRembourse = rembourse === true || rembourse === 'true' || rembourse === 1 || rembourse === '1';
  const now = new Date();
  const targetFactureId = String(facture.id);
  const targetAvoirId = String(avoir.id);

  const factures = resolveCommandeFactures(commande);
  const updatedFactures = factures.map((f) => {
    if (String(f.id) !== targetFactureId) return f;
    const avoirs = (Array.isArray(f.avoirs) ? f.avoirs : []).map((a) => {
      const id = String(a.id || '').trim();
      if (id !== targetAvoirId) return a;
      return {
        ...a,
        remboursementStatut: isRembourse ? 'rembourse' : 'en_attente',
        rembourseAt: isRembourse ? now : null
      };
    });
    return { ...f, avoirs };
  });

  await db.collection(COLLECTION).updateOne(
    { entrepriseId: String(entrepriseId), commandeClientId: String(commandeClientId).trim() },
    {
      $set: {
        factures: updatedFactures,
        updatedAt: now
      },
      $push: {
        historique: {
          action: isRembourse ? 'avoir_rembourse' : 'avoir_remboursement_annule',
          date: now,
          factureNumero: facture.numero,
          factureId: targetFactureId,
          avoirNumero: avoir.numero,
          avoirId: targetAvoirId
        }
      }
    }
  );

  return fetchCommandeClientEntry(db, entrepriseId, commandeClientId);
}

module.exports = setAvoirRembourse;
