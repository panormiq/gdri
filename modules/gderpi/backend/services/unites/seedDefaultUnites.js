/**
 * FICHIER : modules/gderpi/backend/services/unites/seedDefaultUnites.js
 * RÔLE : Initialise les unités par défaut si aucune n'existe pour l'entreprise.
 */

const ensureUniteIndexes = require('./ensureUniteIndexes');
const normalizeUnite = require('./normalizeUnite');

const COLLECTION = 'gderpi_unites';

const DEFAULTS = [
  { code: 'piece', libelle: 'Pièce', sortOrder: 10 },
  { code: 'heure', libelle: 'Heure', sortOrder: 20 },
  { code: 'jour', libelle: 'Jour', sortOrder: 30 },
  { code: 'forfait', libelle: 'Forfait', sortOrder: 40 },
  { code: 'm', libelle: 'Mètre', sortOrder: 50 },
  { code: 'm2', libelle: 'm²', sortOrder: 60 },
  { code: 'kg', libelle: 'Kilogramme', sortOrder: 70 }
];

async function seedDefaultUnites(db, entrepriseId) {
  await ensureUniteIndexes(db);
  const col = db.collection(COLLECTION);
  const eid = String(entrepriseId);
  const count = await col.countDocuments({ entrepriseId: eid });
  if (count > 0) return false;
  const now = new Date();
  const docs = DEFAULTS.map((item) => {
    const normalized = normalizeUnite(item);
    return {
      entrepriseId: eid,
      uniteId: normalized.id,
      ...normalized,
      createdAt: now,
      updatedAt: now
    };
  });
  if (docs.length) await col.insertMany(docs);
  return true;
}

module.exports = seedDefaultUnites;
