/**
 * FICHIER : modules/doc-hub/backend/services/slots/ensureDefaultSlots.js
 * RÔLE : Crée les types de pièces par défaut si absents (idempotent, safe en parallèle).
 */

const config = require('../../config.json');

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

module.exports = ensureDefaultSlots;
