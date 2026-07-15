/**
 * Déduplication du catalogue services (Mongo + réponses API).
 * Fichier : backend/core/services-catalog-dedupe.js
 */

const { ObjectId } = require('mongodb');

const SLUG_ALIASES = {
  gderpi: 'gderp',
  serveria: 'ia',
  'data-backup': 'backup',
};

function normalizeSlug(slug) {
  const key = String(slug || '').trim().toLowerCase();
  if (!key) return '';
  return SLUG_ALIASES[key] || key;
}

function normalizeName(name) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function pickCanonicalService(services) {
  return [...services].sort((a, b) => {
    const aActive = a.status === 'active' ? 1 : 0;
    const bActive = b.status === 'active' ? 1 : 0;
    if (bActive !== aActive) return bActive - aActive;
    const aDate = a.created_at ? new Date(a.created_at).getTime() : 0;
    const bDate = b.created_at ? new Date(b.created_at).getTime() : 0;
    return bDate - aDate;
  })[0];
}

/**
 * Déduplique une liste de services (même logique que dedupeServicesCatalog PHP).
 * @param {Array<object>} services
 * @returns {Array<object>}
 */
function dedupeServicesList(services) {
  const uniqueServices = {};
  const seenBySlug = {};
  const seenByName = {};

  for (const service of services || []) {
    const slugKey = service.slug ? normalizeSlug(service.slug) : null;
    const nameKey = service.name ? normalizeName(service.name) : null;

    let existingKey = null;
    if (slugKey && seenBySlug[slugKey]) {
      existingKey = seenBySlug[slugKey];
    } else if (nameKey && seenByName[nameKey]) {
      existingKey = seenByName[nameKey];
    }

    if (existingKey !== null) {
      const existing = uniqueServices[existingKey];
      const currentStatus = existing?.status || '';
      const newStatus = service.status || '';
      if (existing && newStatus === 'active' && currentStatus !== 'active') {
        uniqueServices[existingKey] = service;
      }
      continue;
    }

    const key = slugKey || (nameKey ? nameKey.replace(/\s+/g, '-') : String(service._id || service.id || `svc_${Date.now()}`));
    uniqueServices[key] = service;
    if (slugKey) seenBySlug[slugKey] = key;
    if (nameKey) seenByName[nameKey] = key;
  }

  return Object.values(uniqueServices);
}

/**
 * Nettoie les doublons en base et remappe entities.services_authorized.
 * @param {{ dryRun?: boolean, database: import('mongodb').Db }} options
 */
async function dedupeServicesInDatabase({ dryRun = true, database }) {
  const servicesCol = database.collection('services');
  const entitiesCol = database.collection('entities');
  const all = await servicesCol.find({}).toArray();

  const groups = new Map();
  for (const svc of all) {
    const slugKey = normalizeSlug(svc.slug);
    const nameKey = normalizeName(svc.name);
    const groupKey = slugKey || nameKey || String(svc._id);
    if (!groups.has(groupKey)) groups.set(groupKey, []);
    groups.get(groupKey).push(svc);
  }

  const idRemap = new Map();
  const toDelete = [];

  for (const group of groups.values()) {
    if (group.length <= 1) continue;
    const canonical = pickCanonicalService(group);
    for (const svc of group) {
      if (String(svc._id) === String(canonical._id)) continue;
      idRemap.set(String(svc._id), String(canonical._id));
      toDelete.push(svc._id);
    }
  }

  let entitiesUpdated = 0;

  if (!dryRun && (toDelete.length > 0 || idRemap.size > 0)) {
    const entities = await entitiesCol.find({}).toArray();
    for (const entity of entities) {
      const raw = Array.isArray(entity.services_authorized) ? entity.services_authorized : [];
      const remapped = [];
      const seen = new Set();
      for (const id of raw) {
        const sid = String(id);
        const target = idRemap.get(sid) || sid;
        if (seen.has(target)) continue;
        seen.add(target);
        remapped.push(new ObjectId(target));
      }
      if (JSON.stringify(raw.map(String)) !== JSON.stringify(remapped.map(String))) {
        await entitiesCol.updateOne(
          { _id: entity._id },
          { $set: { services_authorized: remapped, updated_at: new Date() } }
        );
        entitiesUpdated += 1;
      }
    }

    if (toDelete.length > 0) {
      await servicesCol.deleteMany({ _id: { $in: toDelete } });
    }
  }

  return {
    totalServices: all.length,
    duplicateGroups: [...groups.values()].filter((g) => g.length > 1).length,
    duplicatesRemoved: toDelete.length,
    idsRemapped: idRemap.size,
    entitiesUpdated,
    dryRun,
    duplicateDetails: [...groups.entries()]
      .filter(([, g]) => g.length > 1)
      .map(([key, g]) => ({
        key,
        keep: String(pickCanonicalService(g)._id),
        remove: g.filter((s) => String(s._id) !== String(pickCanonicalService(g)._id)).map((s) => String(s._id)),
        names: g.map((s) => s.name),
        slugs: g.map((s) => s.slug),
      })),
  };
}

module.exports = {
  dedupeServicesList,
  dedupeServicesInDatabase,
  normalizeSlug,
};
