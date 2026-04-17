/**
 * Service de gestion des configurations de services
 * Fichier : backend/services/ServiceConfigService.js
 *
 * Gère la détection et la sauvegarde des configurations par défaut pour les services
 */

const { ObjectId } = require('mongodb');

class ServiceConfigService {
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
   * Trouve les services non configurés pour une entreprise
   * @param {string} entrepriseId - ID de l'entreprise
   * @returns {Promise<Array>} Liste des services nécessitant une configuration
   */
  async getUnconfiguredServices(entrepriseId) {
    try {
      const servicesCollection = this.database.getCollection('services');
      const serviceConfigsCollection = this.database.getCollection('service_configs');
      const entitiesCollection = this.database.getCollection('entities');

      // Récupérer l'entreprise et ses services autorisés
      const entity = await entitiesCollection.findOne({ _id: new ObjectId(entrepriseId) });
      if (!entity || !entity.services_authorized || entity.services_authorized.length === 0) {
        return [];
      }

      // Récupérer tous les services autorisés
      const authorizedServiceIds = entity.services_authorized.map(id =>
        new ObjectId(id)
      );
      const services = await servicesCollection.find({
        _id: { $in: authorizedServiceIds }
      }).toArray();

      // Récupérer les configurations existantes
      const existingConfigs = await serviceConfigsCollection.find({
        entrepriseId: entrepriseId
      }).toArray();

      const configuredServiceIds = new Set(
        existingConfigs
          .filter(config => config.configured === true)
          .map(config => config.service_id.toString())
      );

      // Filtrer les services nécessitant une configuration
      // Un service nécessite une configuration si :
      // 1. Il a le champ requires_config: true
      // 2. Il n'a pas encore de configuration marquée comme configured: true
      const unconfiguredServices = services.filter(service => {
        const serviceId = service._id.toString();
        const requiresConfig = service.requires_config === true;
        const isConfigured = configuredServiceIds.has(serviceId);
        return requiresConfig && !isConfigured;
      });

      // Enrichir avec les informations de configuration existante
      return unconfiguredServices.map(service => {
        const existingConfig = existingConfigs.find(
          config => config.service_id === service._id.toString()
        );
        return {
          _id: service._id,
          name: service.name,
          description: service.description,
          icon: service.icon,
          service_name: this.getServiceName(service.name),
          has_partial_config: !!existingConfig,
          config: existingConfig?.config || null
        };
      });

    } catch (error) {
      console.error('Erreur getUnconfiguredServices:', error);
      return [];
    }
  }

  /**
   * Détermine le nom technique du service à partir de son nom d'affichage
   * @param {string} displayName - Nom d'affichage du service
   * @returns {string} Nom technique (mail, facebook, etc.)
   */
  getServiceName(displayName) {
    const name = displayName.toLowerCase();
    if (name.includes('mail')) return 'mail';
    if (name.includes('facebook')) return 'facebook';
    // Ajouter d'autres services au fur et à mesure
    return name.replace(/\s+/g, '-').toLowerCase();
  }

  /**
   * Sauvegarde la configuration par défaut d'un service
   * @param {string} entrepriseId - ID de l'entreprise
   * @param {string} serviceId - ID du service
   * @param {Object} config - Configuration à sauvegarder
   * @returns {Promise<Object>} Résultat de la sauvegarde
   */
  async saveServiceConfig(entrepriseId, serviceId, config) {
    try {
      const serviceConfigsCollection = this.database.getCollection('service_configs');
      const servicesCollection = this.database.getCollection('services');

      // Récupérer le service pour obtenir son nom technique
      const service = await servicesCollection.findOne({
        _id: new ObjectId(serviceId)
      });
      if (!service) {
        return { success: false, error: 'Service non trouvé' };
      }

      const serviceName = this.getServiceName(service.name);

      // Vérifier si une configuration existe déjà
      const existingConfig = await serviceConfigsCollection.findOne({
        entrepriseId: entrepriseId,
        service_id: serviceId
      });

      const configDoc = {
        entrepriseId: entrepriseId,
        service_id: serviceId,
        service_name: serviceName,
        configured: true,
        config: config,
        configured_at: new Date(),
        updated_at: new Date()
      };

      if (existingConfig) {
        // Mettre à jour
        await serviceConfigsCollection.updateOne(
          { _id: existingConfig._id },
          { $set: configDoc }
        );
      } else {
        // Créer
        configDoc.created_at = new Date();
        await serviceConfigsCollection.insertOne(configDoc);
      }

      return {
        success: true,
        message: 'Configuration sauvegardée avec succès'
      };

    } catch (error) {
      console.error('Erreur saveServiceConfig:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Marque un service comme "configuré plus tard" (sans sauvegarder de config)
   * @param {string} entrepriseId - ID de l'entreprise
   * @param {string} serviceId - ID du service
   * @returns {Promise<Object>} Résultat
   */
  async markAsConfiguredLater(entrepriseId, serviceId) {
    try {
      const serviceConfigsCollection = this.database.getCollection('service_configs');

      // Créer un document minimal pour marquer qu'on a "vu" cette configuration
      const existingConfig = await serviceConfigsCollection.findOne({
        entrepriseId: entrepriseId,
        service_id: serviceId
      });

      const configDoc = {
        entrepriseId: entrepriseId,
        service_id: serviceId,
        configured: false, // Toujours false car pas configuré
        config: null,
        configured_later: true, // Marqueur pour indiquer qu'on a choisi de configurer plus tard
        updated_at: new Date()
      };

      if (existingConfig) {
        await serviceConfigsCollection.updateOne(
          { _id: existingConfig._id },
          { $set: configDoc }
        );
      } else {
        configDoc.created_at = new Date();
        await serviceConfigsCollection.insertOne(configDoc);
      }

      return {
        success: true,
        message: 'Service marqué pour configuration ultérieure'
      };

    } catch (error) {
      console.error('Erreur markAsConfiguredLater:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = ServiceConfigService;

