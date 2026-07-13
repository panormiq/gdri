/**
 * Accepte un devis via lien public sécurisé.
 */

const getDevisById = require('./getDevisById');
const changeDevisStatus = require('./changeDevisStatus');
const { resolveDevisPublicLink } = require('./resolveDevisPublicLink');

const COLLECTION = 'gderpi_devis_public_links';

async function acceptDevisByPublicLink(db, entrepriseId, token, meta = {}) {
  const resolved = await resolveDevisPublicLink(db, entrepriseId, token);
  if (!resolved.ok) return resolved;

  const { link, tokenHash } = resolved;
  if (link.acceptUsedAt) {
    return { ok: false, status: 409, message: 'Ce devis a déjà été validé via ce lien', code: 'already_accepted' };
  }

  const devis = await getDevisById(db, entrepriseId, link.devisId);
  if (!devis) return { ok: false, status: 404, message: 'Devis introuvable' };

  if (devis.statut === 'accepte') {
    return { ok: true, devis, alreadyAccepted: true };
  }

  if (devis.statut !== 'envoye') {
    return { ok: false, status: 400, message: 'Ce devis ne peut plus être validé (statut : ' + devis.statut + ')' };
  }

  const now = new Date();
  await db.collection(COLLECTION).updateOne(
    { tokenHash },
    {
      $set: {
        acceptUsedAt: now,
        acceptMeta: {
          ip: String(meta.ip || '').trim(),
          userAgent: String(meta.userAgent || '').trim().slice(0, 500)
        }
      }
    }
  );

  const updated = await changeDevisStatus(db, entrepriseId, link.devisId, 'accepte');

  await db.collection('gderpi_devis').updateOne(
    { entrepriseId: String(entrepriseId), devisId: String(link.devisId) },
    {
      $push: {
        historique: {
          statut: 'accepte_client',
          date: now,
          source: 'lien_public',
          ip: String(meta.ip || '').trim()
        }
      }
    }
  );

  return { ok: true, devis: updated };
}

module.exports = acceptDevisByPublicLink;
