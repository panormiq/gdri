/**
 * Service d'analyse d'intentions utilisé par le module Facebook.
 */
class IntentionService {
  constructor(database) {
    this.database = database;
    this.aiService = null;
  }

  setAIService(aiService) {
    this.aiService = aiService;
  }

  buildPrompt(messages, basePrompt, customIntentions) {
    const defaultPrompt = 'Analyse chaque message et retourne les intentions, la priorite et si une reponse est requise.';
    const systemPrompt = (basePrompt && String(basePrompt).trim()) || defaultPrompt;
    const intentions = Array.isArray(customIntentions) ? customIntentions : [];

    return [
      systemPrompt,
      '',
      'Intentions disponibles:',
      intentions.length > 0 ? intentions.map((i, idx) => `${idx + 1}. ${i.name || i.category || i}`).join('\n') : '- Aucune liste specifique',
      '',
      'Retourne STRICTEMENT un JSON valide au format:',
      '{"analyses":[{"message":"","intentions":[{"category":"","certainty":0,"urgent":false,"priority":"daily","reason":""}],"reponse_requise":false,"resume":""}]}',
      '',
      'Messages a analyser:',
      messages.map((msg, idx) => `${idx + 1}. ${msg.message || ''}`).join('\n')
    ].join('\n');
  }

  safeJsonParse(raw) {
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

  fallbackAnalyses(messages) {
    return {
      analyses: (messages || []).map((msg) => ({
        message: msg.message || '',
        intentions: [
          {
            category: 'Information',
            certainty: 50,
            urgent: false,
            priority: 'daily',
            reason: 'Classification de secours'
          }
        ],
        reponse_requise: false,
        resume: 'Analyse indisponible, resultat de secours'
      }))
    };
  }

  async analyzeIntentions(messages, basePrompt, customIntentions) {
    try {
      if (!Array.isArray(messages) || messages.length === 0) {
        return { success: true, data: { analyses: [] } };
      }

      if (!this.aiService) {
        return { success: false, error: 'AIService non initialise' };
      }

      const prompt = this.buildPrompt(messages, basePrompt, customIntentions);
      const raw = await this.aiService.chat(prompt);
      const parsed = this.safeJsonParse(raw);

      if (!parsed || !Array.isArray(parsed.analyses)) {
        return { success: true, data: this.fallbackAnalyses(messages) };
      }

      return { success: true, data: parsed };
    } catch (error) {
      return { success: false, error: error.message || String(error) };
    }
  }
}

module.exports = IntentionService;
