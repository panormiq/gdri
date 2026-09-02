/**
 * Service prompt générique : envoi à l'IA + parsing JSON.
 * Utilisable par n'importe quel module (Facebook, analyse-intention, UGAP…).
 * Fichier : modules/prompt/backend/services/PromptService.js
 */

const path = require('path');

class PromptService {
  /**
   * @param {import('../../../ia/backend/services/IAClient')} iaClient
   */
  constructor(iaClient) {
    if (!iaClient) {
      throw new Error('PromptService requiert un IAClient');
    }
    this.iaClient = iaClient;
  }

  static global(config = {}) {
    const iaModule = require(path.join(__dirname, '../../../ia/backend'));
    return new PromptService(iaModule.getIAClient(config));
  }

  static async forEntity(entityId, llmId = null, fallbackConfig = {}) {
    const iaModule = require(path.join(__dirname, '../../../ia/backend'));
    let client = entityId ? await iaModule.getIAClientForEntity(entityId, llmId) : null;
    if (!client) {
      client = iaModule.getIAClient(fallbackConfig);
    }
    return new PromptService(client);
  }

  parseJsonFromResponse(raw) {
    if (!raw) return null;
    const text = String(raw).trim();
    try {
      return JSON.parse(text);
    } catch (_) {
      const start = text.indexOf('{');
      const end = text.lastIndexOf('}');
      if (start >= 0 && end > start) {
        try {
          return JSON.parse(text.slice(start, end + 1));
        } catch (_) {
          return null;
        }
      }
      return null;
    }
  }

  async generate(prompt, options = {}) {
    const result = await this.iaClient.generate(prompt, options);
    if (!result.success) {
      return { success: false, error: result.error || { message: 'Erreur IA' } };
    }
    const data = result.data || {};
    const raw = String(
      (data.response != null && String(data.response).trim() !== '' ? data.response : '')
      || (data.message && data.message.content)
      || data.thinking
      || ''
    );
    return {
      success: true,
      raw,
      meta: {
        model: result.data && result.data.model,
        processing_time: result.data && result.data.processing_time
      }
    };
  }

  async generateJson(prompt, options = {}, opts = {}) {
    const retries = Number.isFinite(opts.retries) ? opts.retries : 1;
    const validate = typeof opts.validate === 'function' ? opts.validate : null;
    let lastError = { message: 'Réponse IA invalide' };

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const gen = await this.generate(prompt, options);
        if (!gen.success) {
          lastError = gen.error || lastError;
          continue;
        }
        const parsed = this.parseJsonFromResponse(gen.raw);
        if (!parsed) {
          lastError = { message: 'JSON invalide dans la réponse IA' };
          continue;
        }
        if (validate) {
          const validated = validate(parsed);
          if (!validated) {
            lastError = { message: 'Validation JSON échouée' };
            continue;
          }
          return { success: true, data: validated, raw: gen.raw, meta: gen.meta };
        }
        return { success: true, data: parsed, raw: gen.raw, meta: gen.meta };
      } catch (error) {
        lastError = { message: error.message || 'Erreur prompt' };
      }
    }

    return { success: false, error: lastError };
  }

  async testConnection() {
    if (typeof this.iaClient.testConnection === 'function') {
      return this.iaClient.testConnection();
    }
    const result = await this.generate('Réponds uniquement par le mot OK.', { max_tokens: 10 });
    return result.success
      ? { success: true, message: 'Connexion IA OK' }
      : { success: false, message: result.error?.message || 'Connexion IA échouée' };
  }
}

module.exports = PromptService;
