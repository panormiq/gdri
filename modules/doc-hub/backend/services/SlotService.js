/**
 * Types de pièces (slot templates) — Doc-Hub
 */

const config = require('../config.json');

/**
 * Crée les slots par défaut si absents (idempotent, safe en requêtes parallèles).
 */
async function ensureDefaultSlots(entrepriseDb) {
  const col = entrepriseDb.collection('doc_hub_slot_templates');
  const templates = config.defaultSlotTemplates || [];
  const now = new Date();

  for (let index = 0; index < templates.length; index++) {
    const slot = templates[index];
    if (!slot?.code) continue;

    await col.updateOne(
      { code: slot.code },
      {
        $setOnInsert: {
          code: slot.code,
          label: slot.label,
          multiple: Boolean(slot.multiple),
          required: Boolean(slot.required),
          sortOrder: slot.sortOrder ?? index + 1,
          allowedMimeTypes: Array.isArray(slot.allowedMimeTypes) ? slot.allowedMimeTypes : [],
          metadataCollectionId: slot.metadataCollectionId || null,
          createdAt: now
        },
        $set: { updatedAt: now }
      },
      { upsert: true }
    );
  }
}

async function list(entrepriseDb) {
  return entrepriseDb
    .collection('doc_hub_slot_templates')
    .find({})
    .sort({ sortOrder: 1 })
    .toArray();
}

async function getByCode(entrepriseDb, code) {
  return entrepriseDb.collection('doc_hub_slot_templates').findOne({ code });
}

module.exports = { ensureDefaultSlots, list, getByCode };
