/**
 * FICHIER : modules/gderpi/backend/services/unites/updateUnite.js
 */

const normalizeUnite = require('./normalizeUnite');
const getUniteById = require('./getUniteById');

const COLLECTION = 'gderpi_unites';

async function updateUnite(db, entrepriseId, uniteId, data) {
  const id = String(uniteId || '').trim();
  if (!id) throw new Error('Identifiant unité requis');
  const col = db.collection(COLLECTION);
  const eid = String(entrepriseId);
  const existing = await col.findOne({ entrepriseId: eid, uniteId: id });
  if (!existing) throw new Error('Unité introuvable');
  const normalized = normalizeUnite({ ...existing, ...data, id });
  if (!normalized.libelle) throw new Error('Libellé unité requis');
  const conflict = await col.findOne({
    entrepriseId: eid,
    code: normalized.code,
    uniteId: { $ne: id }
  });
  if (conflict) throw new Error('Ce code unité existe déjà');
  const now = new Date();
  await col.updateOne(
    { entrepriseId: eid, uniteId: id },
    { $set: { ...normalized, updatedAt: now } }
  );
  return getUniteById(db, eid, id);
}

module.exports = updateUnite;
