/**
 * Tests batch dataset emails — module Facebook.
 * Fichier : backend/modules/facebook/services/FacebookDatasetTestService.js
 */

const fs = require('fs');
const path = require('path');

const DATASET_CANDIDATES = [
  path.join(__dirname, '../data/dataset_1000_emails.json'),
  path.join(__dirname, '../../../source/dataset_1000_emails.json')
];

function resolveDatasetPath() {
  for (const candidate of DATASET_CANDIDATES) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return DATASET_CANDIDATES[DATASET_CANDIDATES.length - 1];
}

const DATASET_PATH = resolveDatasetPath();
const { FacebookAgentConfigService } = require('./FacebookAgentConfigService');

class FacebookDatasetTestService {
  constructor(intentionService, database) {
    this.intentionService = intentionService;
    this.database = database;
    this.agentConfig = new FacebookAgentConfigService(database);
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

    const config = await this.agentConfig.loadConfig(entrepriseId, pageId);
    if (config) {
      basePrompt = config.basePrompt || config.base_prompt || null;
      customIntentions = this.intentionService.buildActiveIntentionsFromConfig(config);
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

  normalizeIntention(value) {
    return String(value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  }

  extractExpectedIntention(email) {
    if (email.categorie_attendue) {
      return String(email.categorie_attendue).trim();
    }
    const text = `${email.subject || ''}\n${email.text || ''}`;
    const match = text.match(/Sujet concernant ([^.]+)\./i);
    return match ? match[1].trim() : null;
  }

  intentionsAreEquivalent(expectedNorm, detectedNorm) {
    if (!expectedNorm || !detectedNorm) return false;
    if (expectedNorm === detectedNorm) return true;
    if (expectedNorm.endsWith('s') && expectedNorm.slice(0, -1) === detectedNorm) return true;
    if (detectedNorm.endsWith('s') && detectedNorm.slice(0, -1) === expectedNorm) return true;
    if (expectedNorm.includes(detectedNorm) || detectedNorm.includes(expectedNorm)) return true;
    return false;
  }

  isIntentionMatch(expected, detectedMain, detectedIntentions, multiIntention = false) {
    const expectedNorm = this.normalizeIntention(expected);
    if (!expectedNorm) return null;

    const mainNorm = this.normalizeIntention(detectedMain);
    if (this.intentionsAreEquivalent(expectedNorm, mainNorm)) return true;
    if (multiIntention) return false;

    const detectedNorms = (detectedIntentions || [])
      .map((item) => this.normalizeIntention(item?.categorie))
      .filter(Boolean);

    return detectedNorms.some((norm) => this.intentionsAreEquivalent(expectedNorm, norm));
  }

  extractIntentionsFromAnalysis(analysis) {
    if (!analysis || typeof analysis !== 'object') return [];

    const rawList = analysis.intentions
      || analysis.intentions_detectees
      || analysis.etape2_multi_intentions?.intentions_detectees
      || [];

    if (!Array.isArray(rawList)) return [];

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
    const message = this.buildMessageFromEmail(email);
    const intentionAttendue = this.extractExpectedIntention(email);

    return {
      id: email.id,
      subject: email.subject || '',
      message,
      intention_attendue: intentionAttendue,
      multi_intention: Boolean(email.multi_intention),
      intentions: [],
      intention_principale: null,
      certitude_totale: null,
      reponse_requise: null,
      reponse_rapide_requise: null,
      resume: null,
      correct: intentionAttendue ? false : null,
      error
    };
  }

  formatAnalysisResult(email, analysisItem, error = null) {
    const intentions = this.extractIntentionsFromAnalysis(analysisItem);
    const mainIntention = intentions[0] || null;
    const message = this.buildMessageFromEmail(email);
    const intentionAttendue = this.extractExpectedIntention(email);
    const detectedMain = mainIntention?.categorie || null;

    return {
      id: email.id,
      subject: email.subject || '',
      message,
      intention_attendue: intentionAttendue,
      multi_intention: Boolean(email.multi_intention),
      intentions,
      intention_principale: detectedMain,
      certitude_totale: mainIntention?.certitude ?? null,
      reponse_requise: analysisItem?.reponse_requise ?? null,
      reponse_rapide_requise: analysisItem?.reponse_rapide_requise ?? null,
      resume: analysisItem?.resume || null,
      correct: this.isIntentionMatch(
        intentionAttendue,
        detectedMain,
        intentions,
        Boolean(email.multi_intention)
      ),
      error: error || null
    };
  }

  computeAccuracyStats(results) {
    const evaluated = results.filter((item) => item.correct !== null && item.correct !== undefined);
    const correct = evaluated.filter((item) => item.correct === true);
    const incorrect = evaluated.filter((item) => item.correct === false);
    const withoutExpected = results.length - evaluated.length;
    const accuracyPct = evaluated.length > 0
      ? Math.round((correct.length / evaluated.length) * 1000) / 10
      : null;

    return {
      total: results.length,
      evaluated: evaluated.length,
      correct: correct.length,
      incorrect: incorrect.length,
      withoutExpected,
      accuracyPct
    };
  }

  pickRandomEmails(emails, count, excludeIds = []) {
    const excluded = new Set((excludeIds || []).map((id) => Number(id)));
    const pool = emails.filter((email) => !excluded.has(Number(email.id)));
    const shuffled = [...pool];

    for (let i = shuffled.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    return shuffled.slice(0, Math.min(count, shuffled.length));
  }

  async analyzeBatch({
    offset = 0,
    limit = 1,
    entrepriseId = null,
    pageId = null,
    random = false,
    excludeIds = []
  }) {
    const dataset = this.loadDataset();
    const emails = dataset.emails || [];
    const total = emails.length;
    const safeOffset = Math.max(0, Number(offset) || 0);
    const safeLimit = Math.min(Math.max(1, Number(limit) || 1), 50);
    const isRandom = Boolean(random);
    const batch = isRandom
      ? this.pickRandomEmails(emails, safeLimit, excludeIds)
      : emails.slice(safeOffset, safeOffset + safeLimit);

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
          customIntentions,
          { entityId: entrepriseId }
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
      } catch (_) {
        results.push(this.formatFailedResult(email, 'Analyse non réalisée'));
      }
    }

    return {
      success: true,
      total,
      offset: safeOffset,
      limit: safeLimit,
      random: isRandom,
      processed: results.length,
      results,
      stats: this.computeAccuracyStats(results),
      done: isRandom ? batch.length < safeLimit : safeOffset + batch.length >= total
    };
  }
}

module.exports = FacebookDatasetTestService;
