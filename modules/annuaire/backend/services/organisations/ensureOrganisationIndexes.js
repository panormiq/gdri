/**
 * FICHIER : modules/annuaire/backend/services/organisations/ensureOrganisationIndexes.js
 */

async function safeCreateIndex(col, keys, options = {}) {
  try {
    await col.createIndex(keys, options);
  } catch (err) {
    const code = Number(err?.code);
    const msg = String(err?.message || '');
    // 85 = IndexOptionsConflict, 86 = IndexKeySpecsConflict
    if (code === 85 || code === 86 || msg.includes('existing index has the same name')) {
      return;
    }
    throw err;
  }
}

async function ensureOrganisationIndexes(db) {
  const col = db.collection('annuaire_organisations');
  await safeCreateIndex(col, { entrepriseId: 1, organisationId: 1 }, { unique: true });
  await safeCreateIndex(col, { entrepriseId: 1, scope: 1 });
  await safeCreateIndex(col, { entrepriseId: 1, roles: 1 });
  await safeCreateIndex(col, { entrepriseId: 1, gderpiClientId: 1 }, { sparse: true });
  await safeCreateIndex(col, { entrepriseId: 1, gderpiFournisseurId: 1 }, { sparse: true });
  await safeCreateIndex(col, { entrepriseId: 1, gderpiBoutiqueId: 1 }, { sparse: true });
  await safeCreateIndex(col, { entrepriseId: 1, isOwnEntity: 1 });
  await safeCreateIndex(col, { entrepriseId: 1, isPrimaryCompany: 1 });
}

module.exports = ensureOrganisationIndexes;
