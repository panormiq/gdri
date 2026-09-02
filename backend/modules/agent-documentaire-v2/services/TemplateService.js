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
      profile: String(t.profile || '').trim() || undefined,
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
        version: Number(t.metadata?.version) || 1,
        agentPageContext: t.metadata && t.metadata.agentPageContext
          ? t.metadata.agentPageContext
          : null
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
    if (!doc && ns.startsWith('v3:')) {
      doc = await this.ensureBlankCanvasTemplate(ns);
    }
    return doc;
  }

  /**
   * Canvas A4 vide pour un template Documents (namespace v3:…).
   */
  async ensureBlankCanvasTemplate(namespace, options = {}) {
    const ns = String(namespace || '').trim();
    if (!ns.startsWith('v3:')) {
      throw new Error('Namespace v3: requis');
    }
    const existing = await this.collection.findOne({ namespace: ns });
    if (existing && !options.force) {
      return existing;
    }
    const title = String(options.name || options.title || 'Mise en page A4').trim() || 'Mise en page A4';
    return this.save(ns, this.buildBlankCanvasTemplate(ns, title));
  }

  buildBlankCanvasTemplate(namespace, title) {
    return {
      namespace,
      name: title,
      documentMode: 'canvas',
      scope: 'v3',
      page: {
        format: 'A4',
        widthMm: 210,
        heightMm: 297,
        margins: { top: 15, right: 15, bottom: 15, left: 15 }
      },
      guides: { vertical: [], horizontal: [] },
      nodes: [
        {
          id: 'zone_body',
          type: 'zone',
          zoneType: 'body',
          parentId: null,
          layout: { x: 15, y: 15, width: 180, height: 40, unit: 'mm' },
          zIndex: 1,
          style: { border: '1px dashed #94a3b8', backgroundColor: '#ffffff' },
          children: ['tf_body']
        },
        {
          id: 'tf_body',
          type: 'text-frame',
          parentId: 'zone_body',
          layout: { x: 3, y: 3, width: 174, height: 34, unit: 'mm' },
          content: {
            mode: 'flow',
            html: `<p style="margin:0;color:#64748b;">${String(title || 'Mise en page A4').replace(/</g, '')}</p>`
          },
          style: { fontSize: 12 }
        }
      ]
    };
  }

  /**
   * Crée un template depuis un seed connu s'il n'existe pas encore.
   * @param {string} namespace
   * @param {{ force?: boolean }} [options]
   */
  async ensureSeedTemplate(namespace, options = {}) {
    const ns = String(namespace || '').trim();
    const seedByNs = {
      'agent:review:invoice': 'agent-review-invoice.json'
    };
    const seedFile = seedByNs[ns];
    if (!seedFile) {
      throw new Error(`Aucun modèle de départ pour « ${ns} »`);
    }
    const existing = await this.collection.findOne({ namespace: ns });
    if (existing && !options.force) {
      return existing;
    }
    const seed = this.normalizeTemplate(this.loadSeed(seedFile));
    seed.namespace = ns;
    return this.save(ns, seed);
  }

  /**
   * Page App (profil page), dédiée à un namespace agent:app:…
   * Par défaut : mise en page « page-web » de production.
   */
  async ensureBlankPageTemplate(namespace, options = {}) {
    const ns = String(namespace || '').trim();
    if (!ns) throw new Error('Namespace requis');
    const existing = await this.collection.findOne({ namespace: ns });
    if (existing && !options.force) {
      if (options.agentPageContext) {
        existing.metadata = existing.metadata || {};
        existing.metadata.agentPageContext = options.agentPageContext;
        return this.save(ns, existing);
      }
      return existing;
    }
    const title = String(options.name || options.title || 'Page').trim() || 'Page';
    const slots = Array.isArray(options.slots) ? options.slots : [];
    const tpl = this.buildAppPageTemplate(ns, title, slots, {
      html: options.html,
      productionTemplateId: options.productionTemplateId
    });
    tpl.metadata = tpl.metadata || {};
    if (options.agentPageContext) {
      tpl.metadata.agentPageContext = options.agentPageContext;
    }
    tpl.metadata.productionTemplateId = options.productionTemplateId || 'page-web';
    return this.save(ns, tpl);
  }

  productionLayoutHtml(templateId, title) {
    try {
      const { getProductionTemplate } = require('../../../core/agent-flow/productionTemplates');
      const doc = getProductionTemplate(templateId || 'page-web') || getProductionTemplate('page-web');
      return doc && doc.html ? String(doc.html) : '';
    } catch (_) {
      return '';
    }
  }

  seedPageWebHtml(title) {
    return this.productionLayoutHtml('page-web', title);
  }

  buildAppPageTemplate(namespace, title, slots, options = {}) {
    const html = String(options.html || this.productionLayoutHtml(options.productionTemplateId, title) || '').trim();
    const nodes = html
      ? [
        {
          id: 'zone_page',
          type: 'zone',
          zoneType: 'body',
          parentId: null,
          layout: { x: 0, y: 0, width: 210, height: 180, unit: 'mm' },
          zIndex: 1,
          style: { border: 'none', backgroundColor: '#f1f5f9' },
          children: ['tf_page']
        },
        {
          id: 'tf_page',
          type: 'text-frame',
          parentId: 'zone_page',
          layout: { x: 0, y: 0, width: 210, height: 176, unit: 'mm' },
          content: { mode: 'flow', html },
          style: { fontSize: 12 }
        }
      ]
      : [
      {
        id: 'zone_title',
        type: 'zone',
        zoneType: 'header',
        parentId: null,
        layout: { x: 15, y: 15, width: 180, height: 18, unit: 'mm' },
        zIndex: 1,
        style: { border: 'none', backgroundColor: 'transparent' },
        children: ['tf_title']
      },
      {
        id: 'tf_title',
        type: 'text-frame',
        parentId: 'zone_title',
        layout: { x: 0, y: 0, width: 180, height: 18, unit: 'mm' },
        content: {
          mode: 'flow',
          html: `<h1 style="margin:0;font-size:18px;">${String(title || 'Page').replace(/</g, '')}</h1>`
        },
        style: { fontSize: 14 }
      }
    ];
    const slotStartY = html ? 186 : 40;
    (slots || []).forEach((slot, i) => {
      const sid = String((slot && slot.id) || `slot-${i + 1}`).replace(/[^a-zA-Z0-9_-]/g, '');
      const label = String((slot && slot.label) || slot.view || 'Vue bloc').replace(/</g, '');
      const view = String((slot && slot.view) || 'block');
      const nodeId = String((slot && slot.nodeId) || '');
      const y = slotStartY + i * 42;
      nodes.push({
        id: `zone_${sid}`,
        type: 'zone',
        zoneType: 'body',
        parentId: null,
        layout: { x: 15, y, width: 180, height: 38, unit: 'mm' },
        zIndex: 2 + i,
        style: { border: '1px dashed #94a3b8', backgroundColor: '#ffffff' },
        children: [`tf_${sid}`],
        widget: { type: 'block-view', view, nodeId, label }
      });
      nodes.push({
        id: `tf_${sid}`,
        type: 'text-frame',
        parentId: `zone_${sid}`,
        layout: { x: 3, y: 3, width: 174, height: 32, unit: 'mm' },
        content: {
          mode: 'flow',
          html: `<p style="margin:0;color:#64748b;"><strong>${label}</strong><br><span style="font-size:11px;">Vue de bloc — ${view}${nodeId ? ` · ${nodeId}` : ''}</span></p>`
        },
        style: { fontSize: 12 }
      });
    });
    return {
      namespace,
      name: title,
      profile: 'page',
      scope: 'agent-app',
      metadata: {
        productionTemplateId: options.productionTemplateId || 'page-web'
      },
      page: {
        format: 'A4',
        widthMm: 210,
        heightMm: 297,
        margins: { top: 15, right: 15, bottom: 15, left: 15 }
      },
      guides: { vertical: [], horizontal: [] },
      nodes
    };
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
    if (!normalized.metadata.agentPageContext && existing?.metadata?.agentPageContext) {
      normalized.metadata.agentPageContext = existing.metadata.agentPageContext;
    }
    if (!normalized.metadata.productionTemplateId && existing?.metadata?.productionTemplateId) {
      normalized.metadata.productionTemplateId = existing.metadata.productionTemplateId;
    }
    await this.collection.updateOne(
      { namespace: ns },
      { $set: normalized },
      { upsert: true }
    );
    return this.getByNamespace(ns);
  }
}

module.exports = TemplateService;
