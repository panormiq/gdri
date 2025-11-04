/**
 * Service d'analyse d'intention
 * Fichier : backend/modules/analyse-intention/services/IntentionService.js
 * 
 * Analyse les messages pour détecter les intentions (commercial, SAV, technique, etc.)
 * Utilise le backendIA pour l'analyse via IA
 */

class IntentionService {
  constructor(database) {
    this.database = database;
    this.aiService = null;
  }

  /**
   * Configurer le service IA
   * @param {AIService} aiService - Instance du service IA
   */
  setAIService(aiService) {
    this.aiService = aiService;
  }

  /**
   * Générer le prompt pour l'analyse multi-intentions
   * @param {Array} messages - Liste des messages à analyser
   * @param {Array} customRules - Règles personnalisées à ajouter
   * @returns {string} Prompt formaté
   */
  generateMultiIntentionPrompt(messages, customRules = null) {
    const customRulesSection = customRules && customRules.length > 0 ?
      `RÈGLES PERSONNALISÉES :\n${customRules.join('\n')}\n\n` :
      '[Aucune règle personnalisée configurée]\n\n';

    const messagesSection = messages.map((message, index) => {
      const author = message.author?.name || message.from?.name || 'Utilisateur';
      const date = message.created_time || message.timestamp || new Date().toISOString();
      const text = message.message || message.text || '';

      return `${index + 1}. "${text}" (Auteur: ${author}, Date: ${date})`;
    }).join('\n');

    return `Tu es un expert en analyse de messages et commentaires. Tu dois analyser les messages en 2 étapes :

ÉTAPE 1 - RÈGLE GÉNÉRIQUE :
D'abord, détermine si chaque message nécessite une réponse en utilisant la règle générique.

ÉTAPE 2 - ANALYSE MULTI-INTENTIONS :
Si une réponse est nécessaire, analyse TOUTES les intentions présentes dans le message.
Un message peut avoir PLUSIEURS intentions simultanées (ex: SAV + Commercial, Technique + Information).
Pour chaque intention détectée, indique la catégorie et le pourcentage de certitude.

CATÉGORIES AUTORISÉES UNIQUEMENT :
- commercial (demandes de produits, prix, devis, informations commerciales)
- sav (problèmes techniques, bugs, dysfonctionnements)
- technique (questions d'utilisation, configuration, installation)
- critique (signalements d'erreurs, corrections d'informations)
- positif (commentaires positifs, remerciements)
- spam (messages publicitaires, indésirables)
- generic (si aucune autre catégorie ne s'applique)

IMPORTANT: Utilise UNIQUEMENT ces 7 catégories. Si aucune règle spécifique ne s'applique, utilise "generic". N'invente pas de nouvelles catégories.

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
          },
          {
            "categorie": "commercial",
            "certitude": 70,
            "raison": "explication de cette intention spécifique",
            "priorite": "medium",
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

  /**
   * Analyser les intentions d'un ou plusieurs messages
   * @param {Array|Object} messages - Message(s) à analyser
   * @param {Array} customRules - Règles personnalisées
   * @returns {Promise<object>} Résultat de l'analyse
   */
  async analyzeIntentions(messages, customRules = null) {
    try {
      // Normaliser les messages en tableau
      const messagesArray = Array.isArray(messages) ? messages : [messages];

      // Vérifier que le service IA est configuré
      if (!this.aiService) {
        throw new Error('AIService non configuré. Utilisez setAIService() avant d\'analyser.');
      }

      // Générer le prompt
      const prompt = this.generateMultiIntentionPrompt(messagesArray, customRules);

      // Envoyer au backendIA
      const aiResponse = await this.aiService.sendAnalysisPrompt(prompt, {
        temperature: 0.7,
        max_tokens: 4000
      });

      if (!aiResponse.success) {
        throw new Error(aiResponse.error?.message || 'Erreur lors de l\'analyse IA');
      }

      // Parser la réponse JSON
      const responseText = aiResponse.data.response;
      const parsedResponse = this.parseAIResponse(responseText);

      // Valider la réponse
      const validation = this.validateMultiIntentionResponse(parsedResponse);
      if (!validation.valid) {
        console.warn('⚠️  Réponse IA invalide:', validation.errors);
        // Continuer quand même avec ce qu'on a
      }

      // Sauvegarder dans la base de données
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
        // Ne pas bloquer si la sauvegarde échoue
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

  /**
   * Parser la réponse JSON de l'IA
   * @param {string} responseText - Texte de la réponse
   * @returns {object} Réponse parsée
   */
  parseAIResponse(responseText) {
    try {
      // Essayer de parser directement
      return JSON.parse(responseText);
    } catch (e) {
      // Essayer d'extraire le JSON du texte
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      throw new Error('Impossible de parser la réponse JSON de l\'IA');
    }
  }

  /**
   * Valider la structure de la réponse multi-intentions
   * @param {object} response - Réponse à valider
   * @returns {object} {valid: boolean, errors: Array}
   */
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

    // Valider chaque analyse
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

  /**
   * Obtenir le mapping des priorités par défaut
   * @returns {object} Mapping catégorie -> priorité
   */
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

