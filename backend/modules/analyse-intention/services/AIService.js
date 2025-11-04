/**
 * Service pour l'interaction avec le backendIA (Python/Ollama)
 * Fichier : backend/modules/analyse-intention/services/AIService.js
 */

const http = require('http');
const https = require('https');

class AIService {
  constructor(config = {}) {
    this.backendIAUrl = config.backendIAUrl || process.env.BACKENDIA_URL || 'http://localhost:8000';
    this.appToken = config.appToken || process.env.BACKENDIA_APP_TOKEN || 'dev-token-123456789-quick-access';
    this.timeout = config.timeout || 300000; // 5 minutes par défaut (augmenté pour l'analyse IA)
  }

  /**
   * Envoyer un prompt d'analyse au backendIA
   * @param {string} prompt - Le prompt à envoyer
   * @param {object} options - Options supplémentaires (model, temperature, etc.)
   * @returns {Promise<object>} Réponse du backendIA
   */
  async sendAnalysisPrompt(prompt, options = {}) {
    try {
      const requestBody = {
        prompt: prompt,
        model: options.model || null, // null = utilise le modèle par défaut du backendIA
        stream: false, // Pour l'analyse, on ne veut pas de streaming
        temperature: options.temperature || 0.7,
        max_tokens: options.max_tokens || null,
        top_p: options.top_p || null,
        top_k: options.top_k || null
      };

      // Supprimer les valeurs null
      Object.keys(requestBody).forEach(key => {
        if (requestBody[key] === null) {
          delete requestBody[key];
        }
      });

      // Faire l'appel HTTP au backendIA
      const response = await this.makeRequest('/api/prompt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.appToken}`
        },
        body: JSON.stringify(requestBody)
      });

      // Parser la réponse
      const responseData = JSON.parse(response);

      // Retourner au format attendu par IntentionService
      return {
        success: true,
        data: {
          response: responseData.response || responseData.data?.response || '',
          model: responseData.model || 'mistral:latest',
          processing_time: responseData.processing_time || null,
          created_at: responseData.created_at || new Date().toISOString()
        }
      };

    } catch (error) {
      console.error('Erreur AIService.sendAnalysisPrompt:', error);
      console.error('Détails:', error.details || error.response || error.message);
      
      return {
        success: false,
        error: {
          message: error.message || 'Erreur lors de l\'appel au backendIA',
          details: error.details || error.response || 'Aucun détail disponible',
          statusCode: error.statusCode || null
        }
      };
    }
  }

  /**
   * Tester la connexion au backendIA
   * @returns {Promise<object>} Résultat du test
   */
  async testConnection() {
    try {
      const response = await this.makeRequest('/health', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.appToken}`
        }
      });

      return {
        success: true,
        message: 'Connexion au backendIA réussie',
        data: JSON.parse(response)
      };
    } catch (error) {
      return {
        success: false,
        message: 'Impossible de se connecter au backendIA',
        error: {
          message: error.message,
          statusCode: error.statusCode || null,
          details: error.details || 'Vérifiez que le backendIA est démarré'
        }
      };
    }
  }

  /**
   * Faire une requête HTTP au backendIA
   * @param {string} path - Chemin de l'endpoint
   * @param {object} options - Options de la requête (method, headers, body)
   * @returns {Promise<string>} Réponse du serveur
   */
  makeRequest(path, options = {}) {
    return new Promise((resolve, reject) => {
      const url = new URL(path, this.backendIAUrl);
      const isHttps = url.protocol === 'https:';
      const httpModule = isHttps ? https : http;

      const requestOptions = {
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: url.pathname + (url.search || ''),
        method: options.method || 'GET',
        headers: options.headers || {},
        timeout: this.timeout
      };

      const req = httpModule.request(requestOptions, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(data);
          } else {
            const error = new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`);
            error.statusCode = res.statusCode;
            error.response = data;
            try {
              const parsed = JSON.parse(data);
              error.details = parsed.detail || parsed.message || data;
            } catch (e) {
              error.details = data;
            }
            reject(error);
          }
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error(`Request timeout après ${this.timeout}ms`));
      });

      if (options.body) {
        req.write(options.body);
      }

      req.end();
    });
  }
}

module.exports = AIService;

