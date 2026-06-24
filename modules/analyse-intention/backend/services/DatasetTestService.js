/**
 * Service de test batch sur le dataset de 1000 emails
 * Utilise le même IntentionService que le module Facebook.
 * Fichier : modules/analyse-intention/backend/services/DatasetTestService.js
 */

const fs = require('fs');
const path = require('path');

const DATASET_PATH = path.join(__dirname, '../../../../backend/source/dataset_1000_emails.json');

class DatasetTestService {
  constructor(intentionService, database) {
    this.intentionService = intentionService;
    this.database = database;
    this._datasetCache = null;
  }

  loadDataset() {
    if (this._datasetCache) {
      return this._datasetCache;
    }
    if (!fs.existsSync(DATASET_PATH)) {
      throw new Error(`Dataset introuvable : ${DATASET_PATH}`);
    }
    const raw = fs.readFileSync(DATASET_PATH, 'utf8');
    this._datasetCache = JSON.parse(raw);
    return this._datasetCache;
  }

  getDatasetInfo() {
    const dataset = this.loadDataset();
    return {
      total: dataset.total || (dataset.emails || []).length,
      generatedAt: dataset.generatedAt || null,
      path: DATASET_PATH,
      engine: 'facebook-intention-service'
    };
  }

  async loadAgentConfig(entrepriseId, pageId = null) {
    let basePrompt = null;
    let customIntentions = this.intentionService.buildActiveIntentionsFromConfig(null);

    if (!entrepriseId) {
      return { basePrompt, customIntentions };
    }

    const configCollection = this.database.getCollection('analyse_intention_configs');
    let config = null;

    if (pageId) {
      config = await configCollection.findOne({ entrepriseId, pageId: String(pageId) });
    }
    if (!config) {
      config = await configCollection.findOne({
        entrepriseId,
        $or: [{ pageId: null }, { pageId: '' }, { pageId: { $exists: false } }]
      });
    }

    if (config && config.config) {
      basePrompt = config.config.basePrompt || config.config.base_prompt || null;
      customIntentions = this.intentionService.buildActiveIntentionsFromConfig(config.config);
    }

    return { basePrompt, customIntentions };
  }

  buildMessageFromEmail(email) {
    const subject = String(email.subject || '').trim();
    const text = String(email.text || '').trim();
    if (subject && text) {
      return `Sujet : ${subject}\n\n${text}`;
    }
    return subject || text;
  }

  extractIntentionsFromAnalysis(analysis) {
    if (!analysis || typeof analysis !== 'object') {
      return [];
    }

    const rawList = analysis.intentions
      || analysis.intentions_detectees
      || analysis.etape2_multi_intentions?.intentions_detectees
      || [];

    if (!Array.isArray(rawList)) {
      return [];
    }

    return rawList.map((item) => {
      if (!item || typeof item !== 'object') {
        return { categorie: String(item), certitude: null };
      }
      return {
        categorie: item.category || item.categorie || item.name || 'generic',
        certitude: item.certainty ?? item.certitude ?? item.confidence ?? item.score ?? null,
        urgent: Boolean(item.urgent),
        priorite: item.priority || item.priorite || null,
        raison: item.reason || item.raison || null
      };
    });
  }

  formatFailedResult(email, error = 'Analyse non réalisée') {
    return {
      id: email.id,
      subject: email.subject || '',
      intentions: [],
      intention_principale: null,
      certitude_totale: null,
      reponse_requise: null,
      reponse_rapide_requise: null,
      resume: null,
      error
    };
  }

  formatAnalysisResult(email, analysisItem, error = null) {
    const intentions = this.extractIntentionsFromAnalysis(analysisItem);
    const mainIntention = intentions[0] || null;

    return {
      id: email.id,
      subject: email.subject || '',
      intentions,
      intention_principale: mainIntention?.categorie || null,
      certitude_totale: mainIntention?.certitude ?? null,
      reponse_requise: analysisItem?.reponse_requise ?? null,
      reponse_rapide_requise: analysisItem?.reponse_rapide_requise ?? null,
      resume: analysisItem?.resume || null,
      error: error || null
    };
  }

  async analyzeBatch({ offset = 0, limit = 1, entrepriseId = null, pageId = null }) {
    const dataset = this.loadDataset();
    const emails = dataset.emails || [];
    const total = emails.length;
    const safeOffset = Math.max(0, Number(offset) || 0);
    const safeLimit = Math.min(Math.max(1, Number(limit) || 1), 50);
    const batch = emails.slice(safeOffset, safeOffset + safeLimit);

    if (batch.length === 0) {
      return {
        success: true,
        total,
        offset: safeOffset,
        limit: safeLimit,
        processed: 0,
        results: [],
        done: safeOffset >= total
      };
    }

    const { basePrompt, customIntentions } = await this.loadAgentConfig(entrepriseId, pageId);
    const results = [];

    for (const email of batch) {
      const messageText = this.buildMessageFromEmail(email);
      const messages = [{ message: messageText }];

      try {
        const result = await this.intentionService.analyzeIntentions(
          messages,
          basePrompt,
          customIntentions
        );

        if (!result.success) {
          const errMsg = typeof result.error === 'string'
            ? result.error
            : (result.error?.message || 'Analyse non réalisée');
          results.push(this.formatFailedResult(email, errMsg));
          continue;
        }

        const analysisItem = (result.data?.analyses || [])[0] || null;
        if (!analysisItem || !Array.isArray(analysisItem.intentions) || analysisItem.intentions.length === 0) {
          results.push(this.formatFailedResult(email, 'Analyse non réalisée'));
          continue;
        }

        results.push(this.formatAnalysisResult(email, analysisItem));
      } catch (err) {
        results.push(this.formatFailedResult(email, 'Analyse non réalisée'));
      }
    }

    return {
      success: true,
      total,
      offset: safeOffset,
      limit: safeLimit,
      processed: results.length,
      results,
      done: safeOffset + batch.length >= total
    };
  }
}

module.exports = DatasetTestService;
