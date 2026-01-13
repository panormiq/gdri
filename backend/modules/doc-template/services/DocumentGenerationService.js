// backend/services/DocumentGenerationService.js
const { ObjectId } = require('mongodb');
const Document = require('../models/document_model');
const Template = require('../models/template_model');
const Collection = require('../models/collection_model');
const database = require('../../../config/database');

/**
 * 🔹 Service de génération automatique de documents pour les champs "Document généré"
 */
class DocumentGenerationService {
  /**
   * Génère automatiquement un document pour un champ "Document généré"
   * @param {string} entrepriseId - ID de l'entreprise
   * @param {Object} field - Définition du champ (avec templateId et mode)
   * @param {Object} elementData - Données de l'élément de collection
   * @param {string} elementId - ID de l'élément de collection
   * @param {string} collectionId - ID de la collection
   * @returns {Promise<Object>} { documentId, url } ou null si mode dynamique
   */
  static async generateDocumentForField(entrepriseId, field, elementData, elementId, collectionId) {
    const entrepriseDb = await database.getEntrepriseDb(entrepriseId);
    
    // Vérifier que le champ est bien de type "DocumentGeneré"
    if (field.typeRef !== 'DocumentGeneré') {
      return null;
    }

    // Récupérer le templateId depuis la configuration du champ
    const templateId = field.templateId || field.validation?.templateId;
    if (!templateId) {
      console.warn(`⚠️ Champ "${field.name}" de type DocumentGeneré sans templateId`);
      return null;
    }

    // Récupérer le mode (dynamique par défaut)
    const mode = field.mode || field.validation?.mode?.defaultValue || 'dynamique';

    // Récupérer le template
    const template = await Template.findById(entrepriseId, templateId);
    if (!template) {
      console.warn(`⚠️ Template ${templateId} non trouvé pour le champ "${field.name}"`);
      return null;
    }

    // Préparer les variables pour le template
    const variables = {
      simple: {},
      collections: {
        [field.name]: {
          collectionId: collectionId,
          elementId: elementId,
          values: elementData
        }
      }
    };

    // Mode dynamique : pas de stockage, retourner null (génération à la volée)
    if (mode === 'dynamique') {
      return {
        documentId: null,
        url: null,
        mode: 'dynamique',
        templateId: templateId,
        generatedAt: null
      };
    }

    // Mode statique : créer et sauvegarder le document
    // Générer un nom pour le document (utiliser le premier champ texte ou l'ID)
    const firstTextField = Object.keys(elementData).find(key => 
      typeof elementData[key] === 'string' && key !== '_id'
    );
    const documentName = `${template.name} - ${elementData[firstTextField] || elementId || 'Nouveau'}`;
    
    // Générer le contenu HTML avec remplacement des variables
    const content = this.generateContent(template, variables);
    
    const document = new Document({
      templateId: templateId,
      name: documentName,
      content: content,
      variables: variables,
      utilisé: true, // Document généré automatiquement = utilisé
      entrepriseId: entrepriseId
    });

    await document.save(entrepriseDb);

    // Capturer les versions
    const versions = await this.captureVersions(entrepriseId, templateId, variables);
    document.versions = versions;
    await document.save(entrepriseDb);

    // URL relative pour accéder au document
    const url = `/api/documents/${document._id.toString()}/pdf`;

    return {
      documentId: document._id.toString(),
      url: url,
      mode: 'statique',
      templateId: templateId,
      generatedAt: new Date()
    };
  }

  /**
   * Capture les versions utilisées (helper pour documentController)
   */
  static async captureVersions(entrepriseId, templateId, variables) {
    const versions = {
      template: null,
      collections: {},
      childTemplates: {}
    };

    // Version du template principal
    const template = await Template.findById(entrepriseId, templateId);
    if (template) {
      versions.template = {
        templateId: template._id.toString(),
        version: template.version
      };
    }

    // Versions des collections utilisées
    if (variables && variables.collections) {
      for (const [alias, collectionData] of Object.entries(variables.collections)) {
        if (collectionData.collectionId) {
          const collection = await Collection.findById(entrepriseId, collectionData.collectionId);
          if (collection) {
            versions.collections[alias] = {
              collectionId: collection._id.toString(),
              version: collection.version,
              elementId: collectionData.elementId ? collectionData.elementId.toString() : null,
              values: collectionData.values || {}
            };
          }
        }
      }
    }

    return versions;
  }

  /**
   * Génère le contenu HTML d'un document à partir d'un template et de variables
   * @param {Object} template - Template avec content HTML
   * @param {Object} variables - Variables à remplacer
   * @returns {string} HTML avec variables remplacées
   */
  static generateContent(template, variables) {
    let content = template.content || '';

    // Remplacer les variables simples
    if (variables.simple) {
      for (const [key, value] of Object.entries(variables.simple)) {
        const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
        content = content.replace(regex, String(value || ''));
      }
    }

    // Remplacer les variables de collections
    if (variables.collections) {
      for (const [alias, collectionData] of Object.entries(variables.collections)) {
        if (collectionData.values) {
          for (const [fieldName, value] of Object.entries(collectionData.values)) {
            const regex = new RegExp(`\\{\\{${alias}\\.${fieldName}\\}\\}`, 'g');
            content = content.replace(regex, String(value || ''));
          }
        }
      }
    }

    return content;
  }

  /**
   * Génère un document à la volée (mode dynamique) sans stockage
   * @param {string} entrepriseId - ID de l'entreprise
   * @param {string} templateId - ID du template
   * @param {Object} variables - Variables pour le template
   * @returns {Promise<{content: string, name: string}>} Contenu HTML généré
   */
  static async generateOnTheFly(entrepriseId, templateId, variables) {
    const template = await Template.findById(entrepriseId, templateId);
    if (!template) {
      throw new Error(`Template ${templateId} non trouvé`);
    }

    const content = this.generateContent(template, variables);
    const name = template.name;

    return {
      content,
      name
    };
  }
}

module.exports = DocumentGenerationService;

