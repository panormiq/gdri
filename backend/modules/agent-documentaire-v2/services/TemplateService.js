/**
 * FICHIER : backend/modules/agent-documentaire-v2/services/TemplateService.js
 * RÔLE : CRUD templates canvas (arbre de nœuds, guides, page A4).
 */

const fs = require('fs');
const path = require('path');

const DEFAULT_NAMESPACE = 'ugap:devis:default';

class TemplateService {
  constructor(database) {
    this.database = database;
    this.collection = null;
  }

  async init() {
    this.collection = this.database.getCollection('adv2_templates');
    await this.collection.createIndex({ namespace: 1 }, { unique: true });
    await this.ensureDefaultTemplate();
  }

  loadSeed(filename) {
    const filePath = path.join(__dirname, '../seeds', filename);
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  }

  normalizeTemplate(raw) {
    const t = raw && typeof raw === 'object' ? raw : {};
    return {
      namespace: String(t.namespace || DEFAULT_NAMESPACE).trim(),
      name: String(t.name || t.namespace || 'Template').trim(),
      documentMode: 'canvas',
      scope: String(t.scope || 'ugap').trim(),
      page: t.page || {
        format: 'A4',
        widthMm: 210,
        heightMm: 297,
        margins: { top: 15, right: 15, bottom: 15, left: 15 }
      },
      guides: {
        vertical: Array.isArray(t.guides?.vertical) ? t.guides.vertical : [],
        horizontal: Array.isArray(t.guides?.horizontal) ? t.guides.horizontal : [],
        verticalFrom: Array.isArray(t.guides?.verticalFrom) ? t.guides.verticalFrom : [],
        horizontalFrom: Array.isArray(t.guides?.horizontalFrom) ? t.guides.horizontalFrom : []
      },
      snap: t.snap || {
        enabled: true,
        thresholdMm: 1.5,
        snapToPage: true,
        snapToGuides: true,
        snapToNodes: true
      },
      nodes: Array.isArray(t.nodes) ? t.nodes : [],
      metadata: {
        createdAt: t.metadata?.createdAt || new Date(),
        updatedAt: new Date(),
        version: Number(t.metadata?.version) || 1
      }
    };
  }

  async ensureDefaultTemplate() {
    const existing = await this.collection.findOne({ namespace: DEFAULT_NAMESPACE });
    const seed = this.normalizeTemplate(this.loadSeed('ugap-devis-default.json'));
    if (!existing) {
      await this.collection.insertOne(seed);
      return seed;
    }

    const nodes = Array.isArray(existing.nodes) ? [...existing.nodes] : [];
    const hasLogo = nodes.some((n) => n.id === 'img_logo');
    const hasTotalZone = nodes.some((n) => n.id === 'zone_total_devis' || n.zoneType === 'total-devis');
    let dirty = false;

    if (!hasLogo) {
      const seedNodes = seed.nodes || [];
      const logoNode = seedNodes.find((n) => n.id === 'img_logo');
      const seedTf = seedNodes.find((n) => n.id === 'tf_entreprise');
      const zone = nodes.find((n) => n.id === 'zone_entreprise');
      if (logoNode && seedTf && zone) {
        nodes.push(logoNode);
        zone.children = Array.isArray(zone.children) ? zone.children : [];
        if (!zone.children.includes('img_logo')) zone.children.unshift('img_logo');
        const tf = nodes.find((n) => n.id === 'tf_entreprise');
        if (tf) tf.layout = { ...seedTf.layout };
        dirty = true;
      }
    }

    if (!hasTotalZone) {
      const seedNodes = seed.nodes || [];
      const totalZone = seedNodes.find((n) => n.id === 'zone_total_devis');
      const budgetTf = seedNodes.find((n) => n.id === 'tf_budget5_disponible');
      const totalTf = seedNodes.find((n) => n.id === 'tf_total_devis');
      if (totalZone && totalTf) {
        nodes.push({ ...totalZone }, ...(budgetTf ? [{ ...budgetTf }] : []), { ...totalTf });
        ['zone_transport', 'zone_bon_accord', 'zone_pied_page'].forEach((zoneId) => {
          const seedZone = seedNodes.find((n) => n.id === zoneId);
          const existingZone = nodes.find((n) => n.id === zoneId);
          if (seedZone && existingZone) {
            existingZone.layout = { ...seedZone.layout };
            existingZone.zIndex = seedZone.zIndex;
          }
        });
        dirty = true;
      }
    } else {
      const totalZone = nodes.find((n) => n.id === 'zone_total_devis' || n.zoneType === 'total-devis');
      const totalTf = nodes.find((n) => n.id === 'tf_total_devis');
      const seedNodes = seed.nodes || [];
      const seedBudgetTf = seedNodes.find((n) => n.id === 'tf_budget5_disponible');
      const seedTf = seedNodes.find((n) => n.id === 'tf_total_devis');
      const seedZone = seedNodes.find((n) => n.id === 'zone_total_devis');
      if (totalZone && !totalZone.label) {
        totalZone.label = 'Total devis';
        dirty = true;
      }
      if (totalZone && seedZone) {
        totalZone.children = Array.isArray(seedZone.children) ? [...seedZone.children] : totalZone.children;
        totalZone.layout = {
          ...totalZone.layout,
          height: Math.max(totalZone.layout?.height || 0, seedZone.layout?.height || 0)
        };
        dirty = true;
      }
      if (!nodes.some((n) => n.id === 'tf_budget5_disponible') && seedBudgetTf) {
        nodes.push({ ...seedBudgetTf });
        dirty = true;
      }
      if (totalTf && seedTf) {
        const html = String(totalTf.content?.html || '');
        const needsUpgrade = !html.includes('ugap:devis.montantTva')
          || !html.includes('Options 5 % consommées HT');
        if (needsUpgrade) {
          totalTf.content = { ...(totalTf.content || {}), ...seedTf.content };
          totalTf.layout = { ...seedTf.layout };
          dirty = true;
        }
      }
      const budgetTf = nodes.find((n) => n.id === 'tf_budget5_disponible');
      if (budgetTf && seedBudgetTf) {
        const html = String(budgetTf.content?.html || '');
        if (!html.includes('ugap:devis.budget5Disponible')) {
          budgetTf.content = { ...(budgetTf.content || {}), ...seedBudgetTf.content };
          budgetTf.layout = { ...seedBudgetTf.layout };
          dirty = true;
        }
      }
      if (totalZone && seedZone) {
        ['zone_transport', 'zone_bon_accord'].forEach((zoneId) => {
          const seedZ = seedNodes.find((n) => n.id === zoneId);
          const existingZone = nodes.find((n) => n.id === zoneId);
          if (seedZ && existingZone && (existingZone.layout?.y || 0) < (totalZone.layout?.y || 0) + (totalZone.layout?.height || 0) + 2) {
            existingZone.layout = { ...existingZone.layout, ...seedZ.layout };
            existingZone.zIndex = seedZ.zIndex;
            dirty = true;
          }
        });
      }
    }

    if (dirty) {
      await this.collection.updateOne(
        { namespace: DEFAULT_NAMESPACE },
        { $set: { nodes, 'metadata.updatedAt': new Date() } }
      );
    }

    return this.getByNamespace(DEFAULT_NAMESPACE);
  }

  async getByNamespace(namespace) {
    const ns = String(namespace || DEFAULT_NAMESPACE).trim();
    let doc = await this.collection.findOne({ namespace: ns });
    if (!doc && ns === DEFAULT_NAMESPACE) {
      doc = await this.ensureDefaultTemplate();
    }
    return doc;
  }

  async list(filters = {}) {
    return this.collection.find(filters).sort({ 'metadata.updatedAt': -1 }).toArray();
  }

  async save(namespace, payload) {
    const ns = String(namespace || DEFAULT_NAMESPACE).trim();
    const existing = await this.collection.findOne({ namespace: ns });
    const normalized = this.normalizeTemplate({ ...payload, namespace: ns });
    const now = new Date();
    if (existing?.metadata?.createdAt) {
      normalized.metadata.createdAt = existing.metadata.createdAt;
    } else {
      normalized.metadata.createdAt = now;
    }
    normalized.metadata.updatedAt = now;
    await this.collection.updateOne(
      { namespace: ns },
      { $set: normalized },
      { upsert: true }
    );
    return this.getByNamespace(ns);
  }
}

module.exports = TemplateService;
