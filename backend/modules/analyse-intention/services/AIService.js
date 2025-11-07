/**
 * Service pour l'interaction directe avec Ollama (sans backendIA)
 * Fichier : backend/modules/analyse-intention/services/AIService.js
 */

const http = require('http');
const https = require('https');

class AIService {
  constructor(config = {}) {
    // Appel direct à Ollama (plus de backendIA)
    this.ollamaUrl = config.ollamaUrl || process.env.OLLAMA_URL || 'http://localhost:11434';
    this.model = config.model || process.env.OLLAMA_MODEL || 'mistral:latest';
    this.timeout = config.timeout || 300000; // 5 minutes par défaut
  }

  /**
   * Envoyer un prompt d'analyse directement à Ollama avec streaming
   * @param {string} prompt - Le prompt à envoyer
   * @param {object} options - Options supplémentaires (model, temperature, etc.)
   * @returns {Promise<object>} Réponse d'Ollama
   */
  async sendAnalysisPrompt(prompt, options = {}) {
    try {
      const model = options.model || this.model;
      console.log(`  🔗 Connexion directe à Ollama: ${this.ollamaUrl}/api/generate`);
      console.log(`  🤖 Modèle: ${model}`);
      console.log(`  📝 Longueur du prompt: ${prompt.length} caractères`);
      console.log(`  📡 Mode: Streaming activé`);
      
      const requestBody = {
        model: model,
        prompt: prompt,
        stream: true, // Streaming activé pour voir la progression
        options: {}
      };

      // Ajouter les options Ollama
      if (options.temperature !== undefined) {
        requestBody.options.temperature = options.temperature;
      }
      if (options.max_tokens !== undefined) {
        requestBody.options.num_predict = options.max_tokens;
      }
      if (options.top_p !== undefined) {
        requestBody.options.top_p = options.top_p;
      }
      if (options.top_k !== undefined) {
        requestBody.options.top_k = options.top_k;
      }

      const startTime = Date.now();
      console.log(`  ⏳ Envoi de la requête à Ollama... (timeout: ${this.timeout}ms)`);
      console.log('');
      
      // Faire l'appel HTTP direct à Ollama avec streaming
      const response = await this.makeStreamingRequest('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      }, (chunk) => {
        // Callback pour afficher la progression
        if (chunk.response) {
          process.stdout.write(chunk.response);
        }
      });
      
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log('');
      console.log(`  ⏱️  Réponse complète reçue d'Ollama en ${duration}s`);

      // Retourner au format attendu par IntentionService
      return {
        success: true,
        data: {
          response: response.fullResponse,
          model: response.model || model,
          processing_time: duration,
          created_at: new Date().toISOString()
        }
      };

    } catch (error) {
      console.error('  ❌ Erreur AIService.sendAnalysisPrompt:', error);
      console.error('  Détails:', error.details || error.response || error.message);
      
      return {
        success: false,
        error: {
          message: error.message || 'Erreur lors de l\'appel à Ollama',
          details: error.details || error.response || 'Aucun détail disponible',
          statusCode: error.statusCode || null
        }
      };
    }
  }

  /**
   * Tester la connexion à Ollama
   * @returns {Promise<object>} Résultat du test
   */
  async testConnection() {
    try {
      // Tester avec un prompt simple
      const testResponse = await this.makeStreamingRequest('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: this.model,
          prompt: 'Test',
          stream: false
        })
      });

      return {
        success: true,
        message: 'Connexion à Ollama réussie',
        data: {
          model: this.model,
          ollama_url: this.ollamaUrl
        }
      };
    } catch (error) {
      return {
        success: false,
        message: 'Impossible de se connecter à Ollama',
        error: {
          message: error.message,
          statusCode: error.statusCode || null,
          details: error.details || 'Vérifiez qu\'Ollama est démarré (ollama serve)'
        }
      };
    }
  }

  /**
   * Faire une requête HTTP avec streaming à Ollama
   * @param {string} path - Chemin de l'endpoint
   * @param {object} options - Options de la requête (method, headers, body)
   * @param {function} onChunk - Callback appelé pour chaque chunk reçu
   * @returns {Promise<object>} Réponse complète avec fullResponse et model
   */
  makeStreamingRequest(path, options = {}, onChunk = null) {
    return new Promise((resolve, reject) => {
      const url = new URL(path, this.ollamaUrl);
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

      let fullResponse = '';
      let model = null;
      let buffer = '';

      const req = httpModule.request(requestOptions, (res) => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          let errorData = '';
          res.on('data', (chunk) => { errorData += chunk; });
          res.on('end', () => {
            const error = new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`);
            error.statusCode = res.statusCode;
            error.response = errorData;
            try {
              const parsed = JSON.parse(errorData);
              error.details = parsed.detail || parsed.message || errorData;
            } catch (e) {
              error.details = errorData;
            }
            reject(error);
          });
          return;
        }

        res.on('data', (chunk) => {
          buffer += chunk.toString();
          
          // Parser les lignes JSON (Ollama envoie une ligne JSON par chunk)
          const lines = buffer.split('\n');
          buffer = lines.pop() || ''; // Garder la dernière ligne incomplète dans le buffer
          
          for (const line of lines) {
            if (line.trim()) {
              try {
                const data = JSON.parse(line);
                
                // Accumuler la réponse
                if (data.response) {
                  fullResponse += data.response;
                  
                  // Appeler le callback si fourni
                  if (onChunk && typeof onChunk === 'function') {
                    onChunk(data);
                  }
                }
                
                // Récupérer le modèle
                if (data.model) {
                  model = data.model;
                }
                
                // Si done=true, on a fini
                if (data.done) {
                  break;
                }
              } catch (e) {
                // Ignorer les lignes non-JSON valides
                continue;
              }
            }
          }
        });

        res.on('end', () => {
          // Traiter le dernier buffer s'il reste quelque chose
          if (buffer.trim()) {
            try {
              const data = JSON.parse(buffer);
              if (data.response) {
                fullResponse += data.response;
                if (onChunk && typeof onChunk === 'function') {
                  onChunk(data);
                }
              }
              if (data.model) {
                model = data.model;
              }
            } catch (e) {
              // Ignorer si ce n'est pas du JSON valide
            }
          }
          
          resolve({
            fullResponse: fullResponse,
            model: model || this.model
          });
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

