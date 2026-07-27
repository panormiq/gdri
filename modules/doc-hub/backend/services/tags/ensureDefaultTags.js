/**
 * FICHIER : modules/doc-hub/backend/services/tags/ensureDefaultTags.js
 * RÔLE : Crée les tags par défaut si absents (idempotent).
 */

const config = require('../../config.json');

async function ensureDefaultTags(entrepriseDb) {
  const col = entrepriseDb.collection('doc_hub_tags');
  const templates = config.defaultTags || [];
  const now = new Date();

  for (let i = 0; i < templates.length; i++) {
    const tag = templates[i];
    if (!tag?.code) continue;
    await col.updateOne(
      { code: tag.code },
      {
        $setOnInsert: {
          code: tag.code,
          label: tag.label || tag.code,
          color: tag.color || '#6c757d',
          sortOrder: tag.sortOrder ?? i + 1,
          createdAt: now
        },
        $set: { updatedAt: now }
      },
      { upsert: true }
    );
  }
}

module.exports = ensureDefaultTags;
