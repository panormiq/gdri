/**
 * FICHIER : modules/doc-hub/backend/services/tags/listTags.js
 * RÔLE : Liste le catalogue de tags de l'entité.
 */

async function listTags(entrepriseDb) {
  return entrepriseDb
    .collection('doc_hub_tags')
    .find({})
    .sort({ sortOrder: 1, label: 1 })
    .toArray();
}

module.exports = listTags;
