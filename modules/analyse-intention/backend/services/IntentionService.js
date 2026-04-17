/**
 * Service d'analyse d'intention
 * Fichier : modules/analyse-intention/backend/services/IntentionService.js
 *
 * Analyse les messages pour détecter les intentions (commercial, SAV, technique, etc.)
 * Utilise Ollama (AIService) pour l'analyse via IA.
 */

class IntentionService {
  constructor(database) {
    this.database = database;
    this.aiService = null;
  }

  setAIService(aiService) {
    this.aiService = aiService;
  }

  generateMultiIntentionPrompt(messages, basePrompt = null, customIntentions = [], customRules = null) {
    let intentionsList = '';
    if (customIntentions && customIntentions.length > 0) {
      intentionsList = customIntentions.map((intention, index) => {
        const name = intention.name || intention;
        return `${index + 1}. ${name}`;
      }).join('\n');
    } else {
      const defaultIntentions = ['commercial', 'sav', 'technique', 'critique', 'positif', 'spam', 'generic'];
      intentionsList = defaultIntentions.map((intention, index) => {
        return `${index + 1}. ${intention}`;
      }).join('\n');
    }

    const messagesSection = messages.map((message, index) => {
      const author = message.author?.name || message.from?.name || 'Utilisateur';
      const date = message.created_time || message.timestamp || new Date().toISOString();
      const text = message.message || message.text || '';
      return `${index + 1}. "${text}" (Auteur: ${author}, Date: ${date})`;
    }).join('\n\n');

    if (basePrompt && basePrompt.trim()) {
      let finalPrompt = basePrompt;
      finalPrompt = finalPrompt.replace(/\{\{Liste des intentions\}\}/g, intentionsList);
      const reponseRequiseRules = `

RÈGLES OBLIGATOIRES POUR DÉTERMINER SI UNE RÉPONSE EST REQUISE :
- Une QUESTION (avec "?" ou formulation interrogative comme "est-ce que", "êtes-vous", "avez-vous", "pouvez-vous") → reponse_requise = TRUE
- Une DEMANDE D'INFORMATION (horaires, prix, disponibilité, stock, etc.) → reponse_requise = TRUE
- Une RÉCLAMATION ou PROBLÈME signalé → reponse_requise = TRUE
- Un simple "merci", "ok", "👍", emoji seul, ou confirmation sans question → reponse_requise = FALSE
- Un SPAM ou publicité → reponse_requise = FALSE

`;
      finalPrompt = reponseRequiseRules + finalPrompt;
      finalPrompt += `\n\n${messagesSection}`;
      return finalPrompt;
    }

    const customRulesSection = customRules && customRules.length > 0 ?
      `RÈGLES PERSONNALISÉES :\n${customRules.join('\n')}\n\n` :
      '[Aucune règle personnalisée configurée]\n\n';

    return `Tu es un expert en analyse de messages et commentaires. Tu dois analyser les messages en 2 étapes :

ÉTAPE 1 - RÉPONSE REQUISE :
Détermine si le message nécessite une réponse. RÈGLES OBLIGATOIRES :
- Une QUESTION (avec "?" ou formulation interrogative) → reponse_requise = TRUE
- Une DEMANDE D'INFORMATION (horaires, prix, disponibilité, etc.) → reponse_requise = TRUE
- Une RÉCLAMATION ou PROBLÈME → reponse_requise = TRUE
- Un simple "merci", "ok", "👍", emoji seul, ou confirmation → reponse_requise = FALSE
- Un SPAM ou publicité → reponse_requise = FALSE

ÉTAPE 2 - ANALYSE MULTI-INTENTIONS :
Si une réponse est nécessaire (reponse_requise = true), analyse TOUTES les intentions présentes dans le message.
Un message peut avoir PLUSIEURS intentions simultanées (ex: SAV + Commercial, Technique + Information).
Pour chaque intention détectée, indique la catégorie et le pourcentage de certitude.

CATÉGORIES AUTORISÉES :
${intentionsList}

IMPORTANT: Utilise UNIQUEMENT ces catégories. Si le message est une question ou demande d'information qui ne rentre pas dans les autres catégories, utilise "generic" MAIS avec reponse_requise = true car c'est une question.

RÈGLES DE CONTEXTE :
${customRulesSection}

MESSAGES À ANALYSER :
${messagesSection}

Réponds au format JSON pour chaque message :
{
  "analyses": [
    {
      "message": "texte du message",
      "etape1_generique": {
        "reponse_requise": true/false,
        "certitude": 85,
        "raison": "explication basée sur la règle générique"
      },
      "etape2_multi_intentions": {
        "intentions_detectees": [
          {
            "categorie": "sav",
            "certitude": 90,
            "raison": "explication de cette intention spécifique",
            "priorite": "urgent",
            "destinataires": []
          }
        ],
        "intention_principale": "sav",
        "certitude_totale": 85,
        "raison_globale": "explication de l'analyse globale"
      }
    }
  ]
}`;
  }

  async analyzeIntentions(messages, basePrompt = null, customIntentions = [], customRules = null) {
    try {
      const messagesArray = Array.isArray(messages) ? messages : [messages];

      if (!this.aiService) {
        throw new Error('AIService non configuré. Utilisez setAIService() avant d\'analyser.');
      }

      const prompt = this.generateMultiIntentionPrompt(messagesArray, basePrompt, customIntentions, customRules);
      const aiResponse = await this.aiService.sendAnalysisPrompt(prompt, {
        temperature: 0.7,
        max_tokens: 4000
      });

      if (!aiResponse.success) {
        throw new Error(aiResponse.error?.message || 'Erreur lors de l\'analyse IA');
      }

      const responseText = aiResponse.data.response;
      const parsedResponse = this.parseAIResponse(responseText);
      const validation = this.validateMultiIntentionResponse(parsedResponse);
      if (!validation.valid) {
        console.warn('⚠️  Réponse IA invalide:', validation.errors);
      }

      const analysisRecord = {
        messages: messagesArray,
        analysis: parsedResponse,
        customRules: customRules || [],
        createdAt: new Date(),
        processingTime: aiResponse.data.processing_time || null,
        model: aiResponse.data.model || 'unknown'
      };

      try {
        const collection = this.database.getCollection('intentions_analyses');
        await collection.insertOne(analysisRecord);
      } catch (dbError) {
        console.error('Erreur lors de la sauvegarde:', dbError);
      }

      return {
        success: true,
        data: parsedResponse,
        metadata: {
          processingTime: aiResponse.data.processing_time,
          model: aiResponse.data.model,
          messagesCount: messagesArray.length
        }
      };
    } catch (error) {
      console.error('Erreur IntentionService.analyzeIntentions:', error);
      return {
        success: false,
        error: {
          message: error.message,
          details: error.details || null
        }
      };
    }
  }

  parseAIResponse(responseText) {
    if (!responseText || typeof responseText !== 'string') {
      throw new Error('Réponse vide ou invalide');
    }
    let str = responseText.trim();
    const codeBlock = str.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/m);
    if (codeBlock) {
      str = codeBlock[1].trim();
    }
    try {
      return JSON.parse(str);
    } catch (e) {
      const jsonMatch = str.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      throw new Error('Impossible de parser la réponse JSON de l\'IA');
    }
  }

  validateMultiIntentionResponse(response) {
    const errors = [];
    if (!response || typeof response !== 'object') {
      errors.push('La réponse doit être un objet');
      return { valid: false, errors };
    }
    if (!response.analyses || !Array.isArray(response.analyses)) {
      errors.push('La réponse doit contenir un tableau "analyses"');
      return { valid: false, errors };
    }
    response.analyses.forEach((analysis, index) => {
      if (!analysis.etape1_generique) {
        errors.push(`Analyse ${index + 1}: manque "etape1_generique"`);
      }
      if (!analysis.etape2_multi_intentions) {
        errors.push(`Analyse ${index + 1}: manque "etape2_multi_intentions"`);
      }
    });
    return {
      valid: errors.length === 0,
      errors
    };
  }

  getDefaultPriorityMapping() {
    return {
      'sav': 'urgent',
      'critique': 'urgent',
      'commercial': 'medium',
      'technique': 'medium',
      'positif': 'low',
      'spam': 'low',
      'generic': 'medium'
    };
  }
}

module.exports = IntentionService;
