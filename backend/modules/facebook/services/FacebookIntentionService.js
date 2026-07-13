/**
 * Analyse d'intentions pour le module Facebook (prompt + normalisation).
 * Utilise PromptService (module prompt) pour l'appel LLM.
 * Fichier : backend/modules/facebook/services/FacebookIntentionService.js
 */

const path = require('path');
const PromptService = require(path.join(__dirname, '../../../../modules/prompt/backend/services/PromptService'));

const DEFAULT_INTENTIONS_PRESET = [
  { name: 'commercial', category: 'commercial', label: 'Commercial' },
  { name: 'sav', category: 'sav', label: 'SAV' },
  { name: 'technique', category: 'technique', label: 'Technique' },
  { name: 'critique', category: 'critique', label: 'Critique' },
  { name: 'positif', category: 'positif', label: 'Positif' },
  { name: 'spam', category: 'spam', label: 'Spam' },
  { name: 'generic', category: 'generic', label: 'Générique' }
];

class FacebookIntentionService {
  buildActiveIntentionsFromConfig(config) {
    if (!config) {
      return [...DEFAULT_INTENTIONS_PRESET];
    }

    const enabledDefaults = config.defaultIntentionsEnabled || {};
    const activeDefaults = DEFAULT_INTENTIONS_PRESET.filter((intention) => {
      if (Object.keys(enabledDefaults).length === 0) return true;
      return enabledDefaults[intention.name] !== false;
    });

    const custom = Array.isArray(config.customIntentions)
      ? config.customIntentions
      : (Array.isArray(config.intentions) ? config.intentions : []);

    const merged = [...activeDefaults];
    const known = new Set(activeDefaults.map((i) => String(i.name || i.category).toLowerCase()));

    for (const intention of custom) {
      const key = String(intention.name || intention.category || intention.label || '').toLowerCase();
      if (!key || known.has(key)) continue;
      known.add(key);
      merged.push(intention);
    }

    return merged.length > 0 ? merged : [...DEFAULT_INTENTIONS_PRESET];
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
      'REGLES INTENTIONS (OBLIGATOIRES):',
      '- Utilise UNIQUEMENT les categories listees dans "Intentions disponibles". N\'invente aucune categorie (pas "Information", pas "generic" sauf si present dans la liste).',
      '- Retourne au maximum 1 intention principale. Une intention secondaire UNIQUEMENT si elle represente une demande metier distincte du sujet principal (ex: candidature + question de facturation).',
      '- Ne retourne JAMAIS "generic" en plus d\'une intention deja identifiee sur le meme sujet.',
      '- Si aucune categorie ne correspond parfaitement, choisis la categorie la plus proche parmi la liste autorisee.',
      '',
      'Messages a analyser:',
      messages.map((msg, idx) => `${idx + 1}. ${msg.message || ''}`).join('\n')
    ].join('\n');
  }

  getAllowedCategories(customIntentions) {
    return (Array.isArray(customIntentions) ? customIntentions : [])
      .map((i) => String(i && (i.name || i.category || i.label || i)).trim().toLowerCase())
      .filter(Boolean);
  }

  normalizeCategoryToAllowed(rawCategory, allowed) {
    const src = String(rawCategory || '').trim().toLowerCase();
    if (!src) return allowed.includes('generic') ? 'generic' : null;
    if (allowed.includes(src)) return src;

    const mappings = [
      { keys: ['question', 'availability', 'checkavailability', 'info', 'information', 'general'], target: 'generic' },
      { keys: ['support', 'sav', 'service', 'after-sales', 'after_sales', 'bug', 'incident'], target: 'sav' },
      { keys: ['tech', 'technical', 'technique', 'configuration', 'install'], target: 'technique' },
      { keys: ['sale', 'sales', 'commercial', 'pricing', 'price', 'devis', 'quote'], target: 'commercial' },
      { keys: ['complaint', 'negative', 'critique', 'critical'], target: 'critique' },
      { keys: ['positive', 'thanks', 'gratitude', 'positif'], target: 'positif' },
      { keys: ['spam', 'junk', 'promo_spam'], target: 'spam' },
      { keys: ['candidature', 'recrutement', 'cv', 'emploi', 'poste'], target: 'candidature' },
      { keys: ['partenariat', 'partnership'], target: 'partenariat' },
      { keys: ['facturation', 'facture', 'billing', 'invoice'], target: 'facturation' },
      { keys: ['finance', 'budget'], target: 'finance' },
      { keys: ['achat', 'achats', 'procurement'], target: 'achats' }
    ];

    for (const row of mappings) {
      if (row.keys.some((k) => src.includes(k))) {
        if (allowed.includes(row.target)) return row.target;
      }
    }

    return allowed.includes(src) ? src : null;
  }

  filterDistinctIntentions(intentions, allowed) {
    if (!Array.isArray(intentions) || intentions.length === 0) return [];

    const byCategory = new Map();
    for (const item of intentions) {
      const category = this.normalizeCategoryToAllowed(item && (item.category || item.name || item.categorie), allowed);
      if (!category) continue;

      const certainty = Number(item.certainty ?? item.certitude ?? item.confidence ?? item.score ?? 0) || 0;
      const normalized = {
        ...item,
        category,
        name: category,
        certainty,
        certitude: certainty
      };

      const existing = byCategory.get(category);
      if (!existing || certainty > (existing.certainty ?? 0)) {
        byCategory.set(category, normalized);
      }
    }

    const sorted = [...byCategory.values()].sort((a, b) => (b.certainty ?? 0) - (a.certainty ?? 0));
    if (sorted.length === 0) return [];

    const withoutGenericIfSpecific = sorted.filter((item, index) => {
      if (item.category !== 'generic') return true;
      return !sorted.some((other, otherIndex) => otherIndex !== index && other.category !== 'generic');
    });

    const list = withoutGenericIfSpecific.length > 0 ? withoutGenericIfSpecific : sorted;
    const primary = list[0];
    const result = [primary];

    for (let i = 1; i < list.length; i++) {
      const secondary = list[i];
      if (secondary.category === primary.category) continue;
      if (secondary.category === 'generic') continue;
      result.push(secondary);
    }

    return result;
  }

  normalizeAnalysesToAllowedIntentions(data, customIntentions) {
    const allowed = this.getAllowedCategories(customIntentions);
    if (!Array.isArray(data?.analyses)) return null;

    const analyses = data.analyses.map((analysis) => {
      const intents = Array.isArray(analysis.intentions) ? analysis.intentions : [];
      const filtered = allowed.length > 0
        ? this.filterDistinctIntentions(intents, allowed)
        : intents;

      const fast = analysis && (
        analysis.reponse_rapide_requise === true ||
        analysis.quick_response_required === true ||
        analysis.rapid_response_required === true ||
        analysis.response_required_quickly === true
      );

      return {
        ...analysis,
        intentions: filtered,
        reponse_rapide_requise: Boolean(fast)
      };
    });

    const hasValidIntentions = analyses.some((a) => Array.isArray(a.intentions) && a.intentions.length > 0);
    if (!hasValidIntentions) return null;

    return { analyses };
  }

  /**
   * @param {Array} messages
   * @param {string|null} basePrompt
   * @param {Array} customIntentions
   * @param {object} [options]
   * @param {string} [options.entityId] - pour choisir le LLM de l'entité
   * @param {import('../../../../modules/ia/backend/services/PromptService')} [options.promptService]
   */
  async analyzeIntentions(messages, basePrompt, customIntentions, options = {}) {
    try {
      if (!Array.isArray(messages) || messages.length === 0) {
        return { success: true, data: { analyses: [] } };
      }

      const promptService = options.promptService
        || (options.entityId
          ? await PromptService.forEntity(options.entityId)
          : PromptService.global());

      const prompt = this.buildPrompt(messages, basePrompt, customIntentions);
      const iaOptions = options.iaOptions || {};

      const result = await promptService.generateJson(prompt, iaOptions, {
        retries: 1,
        validate: (parsed) => this.normalizeAnalysesToAllowedIntentions(parsed, customIntentions)
      });

      if (!result.success || !result.data) {
        return { success: false, error: result.error?.message || 'Analyse non réalisée' };
      }

      return { success: true, data: result.data };
    } catch (error) {
      console.error('FacebookIntentionService.analyzeIntentions:', error.message);
      return { success: false, error: error.message || 'Analyse non réalisée' };
    }
  }
}

module.exports = FacebookIntentionService;
