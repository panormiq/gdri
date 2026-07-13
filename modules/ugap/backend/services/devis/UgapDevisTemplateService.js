/**
 * FICHIER : modules/ugap/backend/services/devis/UgapDevisTemplateService.js
 * RÔLE : Modèles de devis canvas V2 par entreprise (liste, création, duplication, nom).
 */

const { DEFAULT_TEMPLATE_NAMESPACE } = require('./UgapDevisSlotBindings');

const COLLECTION = 'ugap_devis_settings';

function slugifyName(name) {
  return String(name || 'modele')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 36) || 'modele';
}

function entrepriseTemplatePrefix(entrepriseId) {
  return `ugap:devis:${String(entrepriseId || '').trim()}:`;
}

function isEntrepriseTemplateNamespace(namespace, entrepriseId) {
  const ns = String(namespace || '');
  const id = String(entrepriseId || '').trim();
  if (ns.startsWith(entrepriseTemplatePrefix(id))) return true;
  return id && ns === `ugap:devis:${id}`;
}

function isVisibleTemplateNamespace(namespace, entrepriseId) {
  const ns = String(namespace || '');
  if (ns === DEFAULT_TEMPLATE_NAMESPACE) return true;
  return isEntrepriseTemplateNamespace(ns, entrepriseId);
}

function isProtectedNamespace(namespace) {
  return String(namespace || '').trim() === DEFAULT_TEMPLATE_NAMESPACE;
}

async function getActiveNamespace(db, entrepriseId) {
  const doc = await db.collection(COLLECTION).findOne({ entrepriseId: String(entrepriseId) });
  const active = String(doc?.activeDevisTemplateNamespace || '').trim();
  return active || DEFAULT_TEMPLATE_NAMESPACE;
}

async function setActiveNamespace(db, entrepriseId, namespace) {
  const ns = String(namespace || '').trim();
  if (!ns) throw new Error('Namespace requis');
  const now = new Date();
  await db.collection(COLLECTION).updateOne(
    { entrepriseId: String(entrepriseId) },
    {
      $set: { activeDevisTemplateNamespace: ns, updatedAt: now },
      $setOnInsert: { entrepriseId: String(entrepriseId), commerciaux: [], createdAt: now }
    },
    { upsert: true }
  );
  return ns;
}

async function resolveNamespaceForRender(templateService, db, entrepriseId, explicitNamespace) {
  const explicit = String(explicitNamespace || '').trim();
  if (explicit) {
    await assertCanUseTemplate(templateService, entrepriseId, explicit);
    const doc = await templateService.getByNamespace(explicit);
    if (doc) return explicit;
  }

  const preferred = await getDefaultPrintNamespace(db, entrepriseId);
  const preferredDoc = await templateService.getByNamespace(preferred);
  if (preferredDoc) return preferred;

  const active = await getActiveNamespace(db, entrepriseId);
  const activeDoc = await templateService.getByNamespace(active);
  if (activeDoc) return active;

  const legacyScoped = `ugap:devis:${String(entrepriseId || '').trim()}`;
  if (legacyScoped !== DEFAULT_TEMPLATE_NAMESPACE) {
    const legacy = await templateService.getByNamespace(legacyScoped);
    if (legacy) return legacyScoped;
  }

  await templateService.getByNamespace(DEFAULT_TEMPLATE_NAMESPACE);
  return DEFAULT_TEMPLATE_NAMESPACE;
}

async function getSettingsDoc(db, entrepriseId) {
  return db.collection(COLLECTION).findOne({ entrepriseId: String(entrepriseId) });
}

function readTemplatePrefs(doc) {
  const raw = doc?.devisTemplatePrefs;
  return raw && typeof raw === 'object' ? raw : {};
}

async function getDefaultPrintNamespace(db, entrepriseId) {
  const doc = await getSettingsDoc(db, entrepriseId);
  const explicit = String(doc?.defaultPrintTemplateNamespace || '').trim();
  if (explicit) return explicit;
  return getActiveNamespace(db, entrepriseId);
}

function decorateTemplateRow(template, prefs, defaultPrintNamespace, activeNamespace) {
  const ns = String(template.namespace || '');
  const pref = prefs[ns] || {};
  return {
    namespace: ns,
    name: String(template.name || ns),
    shortName: String(pref.shortName || '').trim(),
    isDefault: ns === DEFAULT_TEMPLATE_NAMESPACE,
    isActive: ns === activeNamespace,
    quickPrint: pref.quickPrint === true,
    showIncludedLines: pref.showIncludedLines === true,
    isDefaultPrint: ns === defaultPrintNamespace,
    updatedAt: template.metadata?.updatedAt || null
  };
}

async function listTemplates(templateService, entrepriseId, db) {
  const all = await templateService.list({ scope: 'ugap' });
  const filtered = all.filter((t) => isVisibleTemplateNamespace(t.namespace, entrepriseId));

  const byNs = new Map();
  filtered.forEach((t) => byNs.set(t.namespace, t));

  if (!byNs.has(DEFAULT_TEMPLATE_NAMESPACE)) {
    const def = await templateService.getByNamespace(DEFAULT_TEMPLATE_NAMESPACE);
    if (def) byNs.set(DEFAULT_TEMPLATE_NAMESPACE, def);
  }

  const doc = await getSettingsDoc(db, entrepriseId);
  const prefs = readTemplatePrefs(doc);
  const activeNamespace = String(doc?.activeDevisTemplateNamespace || '').trim() || DEFAULT_TEMPLATE_NAMESPACE;
  const defaultPrintNamespace = String(doc?.defaultPrintTemplateNamespace || '').trim() || activeNamespace;

  return Array.from(byNs.values())
    .map((t) => decorateTemplateRow(t, prefs, defaultPrintNamespace, activeNamespace))
    .sort((a, b) => {
      if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
      if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
      return String(a.name).localeCompare(String(b.name), 'fr');
    });
}

async function updateTemplatePrefs(templateService, db, entrepriseId, namespace, prefsPatch = {}) {
  const ns = String(namespace || '').trim();
  await assertCanUseTemplate(templateService, entrepriseId, ns);

  const doc = await getSettingsDoc(db, entrepriseId);
  const currentPrefs = readTemplatePrefs(doc);
  const nextPrefs = { ...currentPrefs };
  const now = new Date();
  const update = { updatedAt: now };

  if (Object.prototype.hasOwnProperty.call(prefsPatch, 'quickPrint')) {
    nextPrefs[ns] = {
      ...(nextPrefs[ns] || {}),
      quickPrint: prefsPatch.quickPrint === true
    };
    update.devisTemplatePrefs = nextPrefs;
  }

  if (Object.prototype.hasOwnProperty.call(prefsPatch, 'shortName')) {
    nextPrefs[ns] = {
      ...(nextPrefs[ns] || {}),
      shortName: String(prefsPatch.shortName || '').trim().slice(0, 48)
    };
    update.devisTemplatePrefs = nextPrefs;
  }

  if (Object.prototype.hasOwnProperty.call(prefsPatch, 'showIncludedLines')) {
    nextPrefs[ns] = {
      ...(nextPrefs[ns] || {}),
      showIncludedLines: prefsPatch.showIncludedLines === true
    };
    update.devisTemplatePrefs = nextPrefs;
  }

  if (prefsPatch.isDefaultPrint === true) {
    update.defaultPrintTemplateNamespace = ns;
  } else if (prefsPatch.isDefaultPrint === false && doc?.defaultPrintTemplateNamespace === ns) {
    update.defaultPrintTemplateNamespace = '';
  }

  await db.collection(COLLECTION).updateOne(
    { entrepriseId: String(entrepriseId) },
    {
      $set: update,
      $setOnInsert: { entrepriseId: String(entrepriseId), commerciaux: [], createdAt: now }
    },
    { upsert: true }
  );

  const refreshed = await getSettingsDoc(db, entrepriseId);
  const prefs = readTemplatePrefs(refreshed);
  const activeNamespace = String(refreshed?.activeDevisTemplateNamespace || '').trim() || DEFAULT_TEMPLATE_NAMESPACE;
  const defaultPrintNamespace = String(refreshed?.defaultPrintTemplateNamespace || '').trim() || activeNamespace;
  const templateDoc = await templateService.getByNamespace(ns);
  return decorateTemplateRow(
    templateDoc || { namespace: ns, name: ns },
    prefs,
    defaultPrintNamespace,
    activeNamespace
  );
}

async function ensureUniqueNamespace(templateService, entrepriseId, baseSlug) {
  const prefix = entrepriseTemplatePrefix(entrepriseId);
  let slug = slugifyName(baseSlug);
  let candidate = `${prefix}${slug}`;
  let n = 2;
  while (await templateService.getByNamespace(candidate)) {
    candidate = `${prefix}${slug}-${n}`;
    n += 1;
  }
  return candidate;
}

async function createTemplate(templateService, entrepriseId, { name, sourceNamespace }) {
  const label = String(name || 'Nouveau modèle').trim() || 'Nouveau modèle';
  const source = String(sourceNamespace || DEFAULT_TEMPLATE_NAMESPACE).trim();
  const sourceDoc = await templateService.getByNamespace(source);
  if (!sourceDoc) throw new Error(`Modèle source introuvable (${source})`);

  const namespace = await ensureUniqueNamespace(templateService, entrepriseId, label);
  const copy = JSON.parse(JSON.stringify(sourceDoc));
  delete copy._id;
  copy.namespace = namespace;
  copy.name = label;
  copy.scope = 'ugap';
  copy.metadata = {
    ...(copy.metadata || {}),
    createdAt: new Date(),
    updatedAt: new Date(),
    version: 1,
    copiedFrom: source,
    entrepriseId: String(entrepriseId)
  };

  await templateService.save(namespace, copy);
  return {
    namespace,
    name: label,
    isDefault: false,
    isActive: false
  };
}

async function duplicateTemplate(templateService, entrepriseId, sourceNamespace, { name } = {}) {
  const source = String(sourceNamespace || '').trim();
  const sourceDoc = await templateService.getByNamespace(source);
  if (!sourceDoc) throw new Error('Modèle source introuvable');

  const baseName = String(name || `${sourceDoc.name || 'Modèle'} (copie)`).trim();
  const namespace = await ensureUniqueNamespace(templateService, entrepriseId, baseName);
  const copy = JSON.parse(JSON.stringify(sourceDoc));
  delete copy._id;
  copy.namespace = namespace;
  copy.name = baseName;
  copy.scope = 'ugap';
  copy.metadata = {
    createdAt: new Date(),
    updatedAt: new Date(),
    version: 1,
    copiedFrom: source,
    entrepriseId: String(entrepriseId)
  };

  await templateService.save(namespace, copy);
  return {
    namespace,
    name: baseName,
    isDefault: false,
    isActive: false
  };
}

async function renameTemplate(templateService, entrepriseId, namespace, name) {
  const ns = String(namespace || '').trim();
  const label = String(name || '').trim();
  if (!label) throw new Error('Nom requis');
  if (isProtectedNamespace(ns)) {
    const doc = await templateService.getByNamespace(ns);
    if (!doc) throw new Error('Modèle introuvable');
    doc.name = label;
    await templateService.save(ns, doc);
    return { namespace: ns, name: label, isDefault: true };
  }
  if (!isEntrepriseTemplateNamespace(ns, entrepriseId)) {
    throw new Error('Modèle non modifiable');
  }
  const doc = await templateService.getByNamespace(ns);
  if (!doc) throw new Error('Modèle introuvable');
  doc.name = label;
  await templateService.save(ns, doc);
  return { namespace: ns, name: label, isDefault: false };
}

async function assertCanUseTemplate(templateService, entrepriseId, namespace) {
  const ns = String(namespace || '').trim();
  const doc = await templateService.getByNamespace(ns);
  if (!doc) throw new Error('Modèle introuvable');
  if (isProtectedNamespace(ns) || isEntrepriseTemplateNamespace(ns, entrepriseId)) {
    return doc;
  }
  throw new Error('Modèle non autorisé');
}

module.exports = {
  DEFAULT_TEMPLATE_NAMESPACE,
  listTemplates,
  createTemplate,
  duplicateTemplate,
  renameTemplate,
  updateTemplatePrefs,
  getActiveNamespace,
  getDefaultPrintNamespace,
  setActiveNamespace,
  resolveNamespaceForRender,
  assertCanUseTemplate,
  isEntrepriseTemplateNamespace,
  isProtectedNamespace
};
