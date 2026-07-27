/**
 * FICHIER : modules/doc-hub/backend/services/projects/listProjects.js
 * RÔLE : Liste paginée des projets (filtre statut + recherche titre/référence).
 */

async function listProjects(entrepriseDb, { limit = 50, skip = 0, search = '', status = null } = {}) {
  const filter = {};
  if (status) filter.status = status;
  if (search) {
    const re = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ title: re }, { reference: re }];
  }

  const col = entrepriseDb.collection('doc_hub_projects');
  const [items, total] = await Promise.all([
    col.find(filter).sort({ updatedAt: -1 }).skip(skip).limit(limit).toArray(),
    col.countDocuments(filter)
  ]);

  return { items, total };
}

module.exports = listProjects;
