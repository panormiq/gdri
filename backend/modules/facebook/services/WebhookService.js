/**
 * Service de traitement des webhooks Facebook
 * Fichier : backend/modules/facebook/services/WebhookService.js
 */

class WebhookService {
  constructor(database) {
    this.database = database;
    this.initialized = false;
  }

  /**
   * Initialise le service
   */
  async init() {
    if (this.initialized) return;
    this.initialized = true;
  }

  /**
   * Traite un webhook Facebook et sauvegarde les événements
   * @param {Object} webhookData - Données du webhook
   * @returns {Promise<Object>} Résultat du traitement
   */
  async processWebhook(webhookData) {
    try {
      // Structure webhook Facebook :
      // { object: 'page', entry: [{ id, time, messaging, changes, ... }] }

      if (!webhookData.entry || !Array.isArray(webhookData.entry)) {
        return { success: false, error: 'Format webhook invalide' };
      }

      let totalEvents = 0;

      // Traiter chaque entry
      for (const entry of webhookData.entry) {
        // Déterminer l'entité à partir du pageId
        const entityId = await this.getEntityIdFromPageId(entry.id);

        // Sauvegarder l'entry complète
        await this.saveWebhook(entry, entityId);

        // Compter les événements
        const eventCount = this.countEvents(entry);
        totalEvents += eventCount;

        // Traiter les événements si nécessaire
        if (eventCount > 0) {
          await this.processEntryEvents(entry, entityId);
        }
      }

      return {
        success: true,
        entryCount: webhookData.entry.length,
        eventsCount: totalEvents
      };

    } catch (error) {
      console.error('Erreur processWebhook:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Sauvegarde un webhook dans la base de données
   * @param {Object} entry - Entry du webhook
   * @param {string} entityId - ID de l'entité
   */
  async saveWebhook(entry, entityId) {
    try {
      // TEMPORAIRE : Utiliser la base principale
      const collection = this.database.getCollection('facebook_webhooks');

      const webhookDoc = {
        entry_id: entry.id,
        entity_id: entityId,
        time: new Date(entry.time * 1000), // Facebook envoie en timestamp Unix
        entry: entry, // Sauvegarder l'entry complète
        received_at: new Date()
      };

      await collection.insertOne(webhookDoc);

    } catch (error) {
      console.error('Erreur sauvegarde webhook:', error);
    }
  }

  /**
   * Détermine l'entité à partir du pageId Facebook
   * @param {string} pageId - ID de la page Facebook
   * @returns {Promise<string|null>} ID de l'entité ou null
   */
  async getEntityIdFromPageId(pageId) {
    try {
      // TEMPORAIRE : Utiliser la base principale
      const collection = this.database.getCollection('facebook_accounts');

      const account = await collection.findOne({ 
        pageId: pageId,
        isActive: true
      });

      return account ? account.entity_id : null;

    } catch (error) {
      console.error('Erreur getEntityIdFromPageId:', error);
      return null;
    }
  }

  /**
   * Compte le nombre d'événements dans une entry
   * @param {Object} entry - Entry du webhook
   * @returns {number} Nombre d'événements
   */
  countEvents(entry) {
    let count = 0;
    
    if (entry.messaging) count += entry.messaging.length;
    if (entry.changes) count += entry.changes.length;
    
    return count;
  }

  /**
   * Traite les événements d'une entry
   * @param {Object} entry - Entry du webhook
   * @param {string} entityId - ID de l'entité
   */
  async processEntryEvents(entry, entityId) {
    // TODO: Implémenter le traitement selon le type d'événement
    // - Commentaires
    // - Messages
    // - Mentions
    // - etc.
    
    if (entry.messaging) {
      console.log(`  📨 ${entry.messaging.length} message(s) reçu(s)`);
    }
    
    if (entry.changes) {
      console.log(`  🔄 ${entry.changes.length} changement(s) détecté(s)`);
      entry.changes.forEach((change, index) => {
        console.log(`    Change ${index + 1}: ${change.field || 'unknown'}`);
      });
    }
  }
}

module.exports = WebhookService;

