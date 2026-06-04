/**
 * Synchronise la collection Mongo `services` depuis les modules découverts.
 * Fichier : backend/core/services-catalog-sync.js
 */

const database = require('../config/database');
const moduleRegistry = require('./module-registry');

/**
 * @returns {Promise<{ synced: number, slugs: string[] }>}
 */
async function syncServicesCatalogFromModules() {
  const servicesCollection = database.getCollection('services');
  const discoveredModules = moduleRegistry.getModules();
  const slugs = [];

  for (const moduleInfo of discoveredModules) {
    const slug = String(moduleInfo.name || '').trim().toLowerCase();
    if (!slug) continue;

    slugs.push(slug);

    const serviceDoc = {
      name: moduleInfo.displayName || moduleInfo.name,
      slug,
      description: moduleInfo.description || `Module ${moduleInfo.displayName || moduleInfo.name}`,
      icon: moduleInfo.icon || '🧩',
      status: moduleInfo.enabled === false ? 'inactive' : 'active',
      updated_at: new Date()
    };

    const existing = await servicesCollection.findOne({ slug });
    if (existing) {
      await servicesCollection.updateOne({ _id: existing._id }, { $set: serviceDoc });
    } else {
      await servicesCollection.insertOne({
        ...serviceDoc,
        created_at: new Date()
      });
    }
  }

  return { synced: slugs.length, slugs };
}

module.exports = { syncServicesCatalogFromModules };
