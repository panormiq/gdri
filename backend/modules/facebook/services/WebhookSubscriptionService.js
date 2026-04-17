/**
 * Service pour gérer les abonnements aux webhooks Facebook
 * Fichier : backend/modules/facebook/services/WebhookSubscriptionService.js
 * 
 * Permet de s'abonner automatiquement aux événements Facebook (feed, mentions, etc.)
 */

const https = require('https');

class WebhookSubscriptionService {
  constructor() {
    this.graphApiVersion = 'v24.0';
    this.graphApiBase = 'graph.facebook.com';
  }

  /**
   * S'abonne aux événements webhook pour une page Facebook
   * @param {string} pageId - ID de la page Facebook
   * @param {string} pageAccessToken - Token d'accès de la page
   * @param {string} webhookUrl - URL du webhook (ex: https://www.gdr-innovation.fr/api/facebook/webhook)
   * @param {string[]} subscriptions - Liste des événements (ex: ['feed', 'mentions'])
   * @returns {Promise<Object>} Résultat de l'abonnement
   */
  async subscribeToWebhooks(pageId, pageAccessToken, webhookUrl, subscriptions = ['feed']) {
    try {
      console.log(`\n📡 Souscription aux webhooks pour la page ${pageId}...`);
      console.log(`   URL webhook: ${webhookUrl}`);
      console.log(`   Événements: ${subscriptions.join(', ')}`);

      // IMPORTANT: Facebook remplace les abonnements précédents si on fait plusieurs appels séparés
      // Il faut donc souscrire à TOUS les événements en UN SEUL appel
      try {
        const result = await this.subscribeToEvents(pageId, pageAccessToken, webhookUrl, subscriptions);
        
        // Construire les résultats individuels pour chaque événement
        const results = subscriptions.map(event => ({
          event: event,
          success: true,
          result: result
        }));
        
        console.log(`   ✅ Abonnés à tous les événements: ${subscriptions.join(', ')}`);
        
        return {
          success: true,
          results: results
        };
      } catch (error) {
        console.error(`   ❌ Erreur abonnement global:`, error.message);
        
        // En cas d'erreur, retourner un résultat d'échec pour tous les événements
        const results = subscriptions.map(event => ({
          event: event,
          success: false,
          error: error.message
        }));
        
        return {
          success: false,
          results: results
        };
      }
    } catch (error) {
      console.error('❌ Erreur souscription webhooks:', error);
      throw error;
    }
  }

  /**
   * S'abonne à plusieurs événements en une seule fois
   * @param {string} pageId - ID de la page
   * @param {string} pageAccessToken - Token d'accès
   * @param {string} webhookUrl - URL du webhook
   * @param {string[]} events - Liste des événements (feed, mention, messages, etc.)
   * @returns {Promise<Object>} Résultat
   */
  async subscribeToEvents(pageId, pageAccessToken, webhookUrl, events) {
    return new Promise((resolve, reject) => {
      console.log(`\n📡 Tentative d'abonnement à ${events.length} événement(s) pour la page ${pageId}...`);
      console.log(`   Événements: ${events.join(', ')}`);
      
      const path = `/${this.graphApiVersion}/${pageId}/subscribed_apps?access_token=${encodeURIComponent(pageAccessToken)}`;
      
      const postData = JSON.stringify({
        subscribed_fields: events
      });

      const options = {
        hostname: this.graphApiBase,
        path: path,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        }
      };

      const req = https.request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            const response = JSON.parse(data);
            
            console.log(`   Status: ${res.statusCode}`);
            console.log(`   Réponse:`, JSON.stringify(response, null, 2));
            
            if (res.statusCode === 200) {
              console.log(`   ✅ Abonnement à ${events.length} événement(s) réussi`);
              resolve(response);
            } else {
              const errorMsg = response.error?.message || data;
              const errorCode = response.error?.code;
              const errorType = response.error?.type;
              
              console.error(`   ❌ Erreur ${res.statusCode}:`, errorMsg);
              console.error(`   Code: ${errorCode}, Type: ${errorType}`);
              
              let detailedError = `Erreur ${res.statusCode}: ${errorMsg}`;
              if (errorCode) {
                detailedError += ` (Code: ${errorCode})`;
              }
              if (errorType) {
                detailedError += ` (Type: ${errorType})`;
              }
              
              reject(new Error(detailedError));
            }
          } catch (e) {
            console.error(`   ❌ Erreur parsing:`, e.message);
            console.error(`   Données reçues:`, data);
            reject(new Error(`Erreur parsing: ${e.message}. Réponse: ${data.substring(0, 200)}`));
          }
        });
      });

      req.on('error', (e) => {
        console.error(`   ❌ Erreur requête:`, e.message);
        reject(new Error(`Erreur requête: ${e.message}`));
      });

      req.write(postData);
      req.end();
    });
  }

  /**
   * S'abonne à un événement spécifique (méthode legacy - dépréciée)
   * @deprecated Utilisez subscribeToEvents() pour souscrire à plusieurs événements en une fois
   * @param {string} pageId - ID de la page
   * @param {string} pageAccessToken - Token d'accès
   * @param {string} webhookUrl - URL du webhook
   * @param {string} event - Nom de l'événement (feed, mentions, etc.)
   * @returns {Promise<Object>} Résultat
   */
  async subscribeToEvent(pageId, pageAccessToken, webhookUrl, event) {
    // Utiliser la nouvelle méthode qui gère plusieurs événements
    return this.subscribeToEvents(pageId, pageAccessToken, webhookUrl, [event]);
  }

  /**
   * Vérifie les abonnements actuels pour une page
   * @param {string} pageId - ID de la page
   * @param {string} pageAccessToken - Token d'accès
   * @returns {Promise<Object>} Liste des abonnements
   */
  async getSubscriptions(pageId, pageAccessToken) {
    return new Promise((resolve, reject) => {
      const url = `https://${this.graphApiBase}/${this.graphApiVersion}/${pageId}/subscribed_apps?` +
        `access_token=${pageAccessToken}`;

      https.get(url, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            const response = JSON.parse(data);
            
            if (res.statusCode === 200) {
              resolve(response);
            } else {
              reject(new Error(`Erreur ${res.statusCode}: ${response.error?.message || data}`));
            }
          } catch (e) {
            reject(new Error(`Erreur parsing: ${e.message}`));
          }
        });
      }).on('error', (e) => {
        reject(new Error(`Erreur requête: ${e.message}`));
      });
    });
  }
}

module.exports = WebhookSubscriptionService;
