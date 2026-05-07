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
    const defaultPrompt = 'Analyse chaque message et retourne les intentions, la priorite, si une reponse est requise et si une reponse rapide est requise.';
    const systemPrompt = (basePrompt && String(basePrompt).trim()) || defaultPrompt;
    const intentions = Array.isArray(customIntentions) ? customIntentions : [];

    return [
      systemPrompt,
      '',
      'IMPORTANT LANGUE: Tu dois toujours repondre EXCLUSIVEMENT en francais.',
      'IMPORTANT LANGUE: Tous les champs textuels (reason, resume, summary, explications) doivent etre rediges en francais.',
      '',
      'Intentions disponibles:',
      intentions.length > 0 ? intentions.map((i, idx) => `${idx + 1}. ${i.name || i.category || i}`).join('\n') : '- Aucune liste specifique',
      '',
      'Retourne STRICTEMENT un JSON valide au format:',
      '{"analyses":[{"message":"","intentions":[{"category":"","certainty":0,"urgent":false,"priority":"daily","reason":""}],"reponse_requise":false,"reponse_rapide_requise":false,"resume":""}]}',
      'IMPORTANT: "reponse_rapide_requise" doit etre true si le message doit etre traite tres vite (ex. besoin aujourd\'hui/maintenant).',
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
        reponse_rapide_requise: false,
        resume: 'Analyse indisponible, resultat de secours'
      }))
    };
  }

  normalizeCategoryToAllowed(rawCategory, allowed) {
    const src = String(rawCategory || '').trim().toLowerCase();
    if (!src) return allowed.includes('generic') ? 'generic' : (allowed[0] || 'generic');
    if (allowed.includes(src)) return src;

    const mappings = [
      { keys: ['question', 'availability', 'checkavailability', 'info', 'information', 'general', 'generic'], target: 'generic' },
      { keys: ['support', 'sav', 'service', 'after-sales', 'after_sales', 'bug', 'incident'], target: 'sav' },
      { keys: ['tech', 'technical', 'technique', 'configuration', 'install'], target: 'technique' },
      { keys: ['sale', 'sales', 'commercial', 'pricing', 'price', 'devis', 'quote'], target: 'commercial' },
      { keys: ['complaint', 'negative', 'critique', 'critical'], target: 'critique' },
      { keys: ['positive', 'thanks', 'gratitude', 'positif'], target: 'positif' },
      { keys: ['spam', 'junk', 'promo_spam'], target: 'spam' }
    ];

    for (const row of mappings) {
      if (row.keys.some((k) => src.includes(k))) {
        if (allowed.includes(row.target)) return row.target;
      }
    }
    return allowed.includes('generic') ? 'generic' : (allowed[0] || src);
  }

  normalizeAnalysesToAllowedIntentions(data, customIntentions) {
    const allowed = (Array.isArray(customIntentions) ? customIntentions : [])
      .map((i) => String(i && (i.name || i.category || i.label || i)).trim().toLowerCase())
      .filter(Boolean);
    if (!Array.isArray(data?.analyses) || allowed.length === 0) return data;

    data.analyses = data.analyses.map((analysis) => {
      const intents = Array.isArray(analysis.intentions) ? analysis.intentions : [];
      const normalized = intents.map((it) => {
        const category = this.normalizeCategoryToAllowed(it && (it.category || it.name), allowed);
        return { ...it, category, name: category };
      });
      const fast = analysis && (
        analysis.reponse_rapide_requise === true ||
        analysis.quick_response_required === true ||
        analysis.rapid_response_required === true ||
        analysis.response_required_quickly === true
      );
      return {
        ...analysis,
        intentions: normalized,
        reponse_rapide_requise: Boolean(fast)
      };
    });
    return data;
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

      const normalized = this.normalizeAnalysesToAllowedIntentions(parsed, customIntentions);
      return { success: true, data: normalized };
    } catch (error) {
      return { success: false, error: error.message || String(error) };
    }
  }
}

module.exports = IntentionService;
