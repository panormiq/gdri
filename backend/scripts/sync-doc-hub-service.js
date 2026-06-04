/**
 * One-shot : sync catalogue + ajoute doc-hub aux entités (si absent)
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const database = require('../config/database');
const moduleRegistry = require('../core/module-registry');
const { syncServicesCatalogFromModules } = require('../core/services-catalog-sync');

(async () => {
  await database.connect();
  await moduleRegistry.discoverModules();
  const catalog = await syncServicesCatalogFromModules();
  console.log('Catalogue:', catalog);

  const svc = await database.getCollection('services').findOne({ slug: 'doc-hub' });
  if (!svc) {
    console.error('Service doc-hub introuvable');
    process.exit(1);
  }

  const result = await database.getCollection('entities').updateMany(
    { services_authorized: { $ne: svc._id } },
    { $addToSet: { services_authorized: svc._id }, $set: { updated_at: new Date() } }
  );
  console.log('Entités mises à jour:', result.modifiedCount);
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
