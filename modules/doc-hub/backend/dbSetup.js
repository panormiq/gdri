/**
 * Index et initialisation DB — Doc-Hub
 */

const SlotService = require('./services/SlotService');
const TagService = require('./services/TagService');

async function ensureIndexes(entrepriseDb) {
  await entrepriseDb.collection('doc_hub_projects').createIndex({ status: 1, updatedAt: -1 });
  await entrepriseDb.collection('doc_hub_projects').createIndex({ reference: 1 });
  await entrepriseDb.collection('doc_hub_slot_templates').createIndex({ code: 1 }, { unique: true });
  await entrepriseDb.collection('doc_hub_documents').createIndex({ projectId: 1, slotCode: 1 });
  await entrepriseDb.collection('doc_hub_documents').createIndex({ tags: 1 });
  await entrepriseDb.collection('doc_hub_diffusions').createIndex({ projectId: 1, createdAt: -1 });
  await entrepriseDb.collection('doc_hub_download_links').createIndex({ tokenHash: 1 }, { unique: true });
  await entrepriseDb.collection('doc_hub_tags').createIndex({ code: 1 }, { unique: true });
}

async function prepareEntrepriseDb(entrepriseDb) {
  await ensureIndexes(entrepriseDb);
  await SlotService.ensureDefaultSlots(entrepriseDb);
  await TagService.ensureDefaultTags(entrepriseDb);
}

module.exports = { ensureIndexes, prepareEntrepriseDb };
