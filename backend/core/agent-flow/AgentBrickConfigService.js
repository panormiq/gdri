/**
 * FICHIER : backend/core/agent-flow/AgentBrickConfigService.js
 * RÔLE : Config métier liée à un agent (flow) et à une brique (intentions, routage).
 *        Collection : agent_flow_brick_configs
 */

const {
  buildAnalyseConfigFromPreset,
  buildRouteConfigFromIntentions,
  mergeRouteConfigWithIntentions,
  getPreset,
  listPresets,
  sanitizeAnalyseConfig,
  sanitizeRouteConfig,
  ROUTE_TARGET_TYPES
} = require('./intentionPresets');

const COL = 'agent_flow_brick_configs';

class AgentBrickConfigService {
  constructor(database) {
    this.database = database;
  }

  col() {
    return this.database.getCollection(COL);
  }

  async ensureIndexes() {
    await this.col().createIndex(
      { flowId: 1, brickId: 1 },
      { unique: true }
    );
    await this.col().createIndex({ entrepriseId: 1 });
  }

  async getConfig(flowId, brickId) {
    const doc = await this.col().findOne({
      flowId: String(flowId),
      brickId: String(brickId)
    });
    if (!doc || !doc.config) return doc || null;
    const bid = String(brickId);
    if (bid === 'analyse-intention') {
      doc.config = sanitizeAnalyseConfig(doc.config);
    } else if (bid === 'route-intention') {
      doc.config = sanitizeRouteConfig(doc.config);
    }
    return doc;
  }

  async upsertConfig(flowId, brickId, entrepriseId, payload = {}) {
    const now = new Date();
    let config = payload.config && typeof payload.config === 'object' ? payload.config : payload;
    if (String(brickId) === 'analyse-intention') {
      config = sanitizeAnalyseConfig(config);
    } else if (String(brickId) === 'route-intention') {
      config = sanitizeRouteConfig(config);
    }
    const update = {
      flowId: String(flowId),
      brickId: String(brickId),
      entrepriseId: String(entrepriseId),
      config,
      updatedAt: now
    };
    await this.col().updateOne(
      { flowId: String(flowId), brickId: String(brickId) },
      { $set: update, $setOnInsert: { createdAt: now } },
      { upsert: true }
    );
    return this.getConfig(flowId, brickId);
  }

  async listForFlow(flowId) {
    return this.col().find({ flowId: String(flowId) }).toArray();
  }

  /**
   * Config analyse-intention pour un flow (defaults si absente).
   * @param {string} [presetId='mail']
   */
  getDefaultAnalyseConfig(presetId = 'mail') {
    return buildAnalyseConfigFromPreset(presetId);
  }

  /**
   * Config route-intention alignée sur une liste d'intentions / un preset.
   * @param {string|Array} [presetIdOrIntentions='mail']
   */
  getDefaultRouteConfig(presetIdOrIntentions = 'mail') {
    if (Array.isArray(presetIdOrIntentions)) {
      return buildRouteConfigFromIntentions(presetIdOrIntentions);
    }
    const analyse = this.getDefaultAnalyseConfig(presetIdOrIntentions);
    return buildRouteConfigFromIntentions(analyse.intentions);
  }

  listIntentionPresets() {
    return listPresets();
  }

  getIntentionPreset(presetId) {
    return getPreset(presetId);
  }

  listRouteTargetTypes() {
    return ROUTE_TARGET_TYPES;
  }

  /**
   * Resynchronise route-intention sur la liste d'intentions (conserve les cibles).
   */
  async syncRouteWithIntentions(flowId, entrepriseId, intentions) {
    const existing = await this.getConfig(flowId, 'route-intention');
    const merged = mergeRouteConfigWithIntentions(
      (existing && existing.config) || null,
      intentions
    );
    return this.upsertConfig(flowId, 'route-intention', entrepriseId, { config: merged });
  }
}

module.exports = { AgentBrickConfigService, COL };
