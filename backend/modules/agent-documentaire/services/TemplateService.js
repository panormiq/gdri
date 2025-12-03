/**
 * Service Template - Gestion des templates (unifiés)
 * Fichier : backend/modules/agent-documentaire/services/TemplateService.js
 * 
 * Fonction : Service unifié pour la gestion des templates
 * - Pas de distinction document/section dans la structure
 * - La distinction se fait par l'usage : 
 *   * Appelé en premier = template "document" (a un canvas)
 *   * Appelé par un autre = template "section"
 */

const { ObjectId } = require('mongodb');
const CanvasService = require('./CanvasService');

class TemplateService {
  constructor(database) {
    this.database = database;
    this.collection = null;
  }

  /**
   * Initialise le service
   */
  async init() {
    this.collection = this.database.getCollection('templates');
    
    // Créer les index
    try {
      await this.collection.createIndex({ namespace: 1 }, { unique: true });
      await this.collection.createIndex({ 'metadata.createdAt': -1 });
      console.log('  ✅ Index MongoDB créé pour collection templates');
    } catch (error) {
      // Index existe déjà, pas d'erreur
    }
  }

  /**
   * ===================================
   * TEMPLATES (UNIFIÉS)
   * ===================================
   */

  /**
   * Crée un template
   * @param {string} namespace - Namespace unique (ex: "dossier_technique" ou "dossier_technique:motor")
   * @param {Object} data - Données du template
   * @param {Object} options - Options additionnelles
   * @returns {Promise<Object>} Template créé
   */
  async createTemplate(namespace, data, options = {}) {
    // Vérifier si le namespace existe déjà
    const existing = await this.collection.findOne({ namespace });
    if (existing) {
      const error = new Error(`Template avec namespace "${namespace}" existe déjà`);
      error.statusCode = 409; // Conflict
      throw error;
    }

    // Extraire le nom depuis le namespace (après le dernier :)
    const nameParts = namespace.split(':');
    const name = nameParts[nameParts.length - 1];

    // Créer le template
    const template = {
      namespace: namespace,
      name: name,
      
      // Structure de section
      title: data.title || '',
      content: data.content ? [...data.content] : [],
      level: data.level || 1,
      titleStyles: data.titleStyles || null,

      // Propriétés de structure
      isOptional: options.isOptional !== undefined ? options.isOptional : false,
      hasMultipleChoice: options.hasMultipleChoice !== undefined ? options.hasMultipleChoice : false,
      allowMultiple: options.allowMultiple !== undefined ? options.allowMultiple : false,
      maxInstances: options.maxInstances || 1,

      // Mode standalone par défaut
      isStandalone: options.isStandalone !== undefined ? options.isStandalone : true,

      // Canvas (styles globaux - seulement si template document)
      canvas: data.canvas || null,

      // Champs/Models
      fields: options.fields || [],

      // Modèle rattaché (namespace du modèle de produits)
      modelNamespace: options.modelNamespace || null,

      // Variantes (pour choix multiple)
      variants: options.variants || {},

      metadata: {
        createdAt: new Date(),
        updatedAt: new Date()
      }
    };

    await this.collection.insertOne(template);
    return template;
  }

  /**
   * Récupère un template par son namespace
   * @param {string} namespace - Namespace du template
   * @returns {Promise<Object|null>} Template ou null
   */
  async getTemplate(namespace) {
    return await this.collection.findOne({ namespace });
  }

  /**
   * Récupère tous les templates (filtrés optionnellement)
   * @param {Object} filters - Filtres optionnels
   * @returns {Promise<Array>} Liste des templates
   */
  async getAllTemplates(filters = {}) {
    return await this.collection.find(filters).sort({ 'metadata.createdAt': -1 }).toArray();
  }

  /**
   * Met à jour un template
   * @param {string} namespace - Namespace du template
   * @param {Object} updates - Champs à mettre à jour
   * @returns {Promise<Object>} Template mis à jour
   */
  async updateTemplate(namespace, updates) {
    const updateDoc = {
      ...updates,
      'metadata.updatedAt': new Date()
    };

    // Si canvas est mis à jour, mettre à jour ses métadonnées
    if (updateDoc.canvas && updateDoc.canvas.metadata) {
      updateDoc.canvas.metadata.updatedAt = new Date().toISOString();
      updateDoc.canvas.metadata.version = (updateDoc.canvas.metadata.version || 0) + 1;
    }

    await this.collection.updateOne(
      { namespace },
      { $set: updateDoc }
    );

    return await this.getTemplate(namespace);
  }

  /**
   * Supprime un template
   * @param {string} namespace - Namespace du template
   * @returns {Promise<boolean>} true si supprimé
   */
  async deleteTemplate(namespace) {
    const result = await this.collection.deleteOne({ namespace });
    return result.deletedCount > 0;
  }

  /**
   * ===================================
   * UTILITAIRES
   * ===================================
   */

  /**
   * Génère un namespace pour une section
   * @param {string} templateName - Nom du template document parent
   * @param {string} sectionName - Nom de la section
   * @returns {string} Namespace généré
   */
  generateNamespace(templateName, sectionName) {
    // Fonction pour normaliser les accents (é → e, à → a, etc.)
    const normalizeAccents = (str) => {
      return str
        .toLowerCase()
        .normalize('NFD') // Décompose les caractères accentués (é → e + accent)
        .replace(/[\u0300-\u036f]/g, '') // Supprime les diacritiques (accents), garde la lettre de base
        .replace(/\s+/g, '_') // Remplacer espaces par underscores
        .replace(/[^a-z0-9_]/g, ''); // Garder seulement lettres, chiffres, underscores
    };
    
    // Normaliser les noms (minuscules, accents convertis, espaces → underscores)
    const normalizedTemplate = normalizeAccents(templateName);
    const normalizedSection = normalizeAccents(sectionName);
    return `${normalizedTemplate}:${normalizedSection}`;
  }

  /**
   * Crée un template document avec canvas depuis un document
   * @param {string} namespace - Namespace du template (ex: "dossier_technique")
   * @param {Object} jsonContent - Contenu JSON du document (pour analyser les styles)
   * @param {string} sourceDocumentId - ID du document source (optionnel, pour copier les images plus tard)
   * @returns {Promise<Object>} Template créé ou mis à jour
   */
  async createDocumentTemplate(namespace, jsonContent = null, sourceDocumentId = null) {
    // Vérifier si le template existe déjà
    const existingTemplate = await this.collection.findOne({ namespace });
    
    // Sauvegarder les sections initiales du document (si présentes)
    const initialSections = jsonContent && jsonContent.sections 
      ? JSON.parse(JSON.stringify(jsonContent.sections)) // Copie profonde
      : [];
    
    const initialToc = jsonContent && jsonContent.toc
      ? JSON.parse(JSON.stringify(jsonContent.toc)) // Copie profonde
      : [];
    
    // Sauvegarder les formats de numérotation et autres métadonnées Word importantes
    const numberingFormats = jsonContent && jsonContent.numberingFormats
      ? JSON.parse(JSON.stringify(jsonContent.numberingFormats)) // Copie profonde
      : null;
    
    const styles = jsonContent && jsonContent.styles
      ? JSON.parse(JSON.stringify(jsonContent.styles)) // Copie profonde
      : null;
    
    const styleHierarchy = jsonContent && jsonContent.styleHierarchy
      ? JSON.parse(JSON.stringify(jsonContent.styleHierarchy)) // Copie profonde
      : null;

    // Si le template existe déjà
    if (existingTemplate) {
      // Mettre à jour les sections et le TOC si elles sont manquantes ou si on a de nouvelles données
      const needsUpdate = (!existingTemplate.initialSections || existingTemplate.initialSections.length === 0) 
        && initialSections.length > 0;
      
      if (needsUpdate || (initialSections.length > 0 && initialToc.length > 0)) {
        const updateData = {
          initialSections: initialSections.length > 0 ? initialSections : (existingTemplate.initialSections || []),
          initialToc: initialToc.length > 0 ? initialToc : (existingTemplate.initialToc || []),
          'metadata.updatedAt': new Date()
        };
        
        // Préserver les formats de numérotation et styles si présents
        if (numberingFormats) {
          updateData.numberingFormats = numberingFormats;
        }
        if (styles) {
          updateData.styles = styles;
        }
        if (styleHierarchy) {
          updateData.styleHierarchy = styleHierarchy;
        }
        
        // Si sourceDocumentId est fourni et n'existe pas encore, l'ajouter
        if (sourceDocumentId && !existingTemplate.sourceDocumentId) {
          updateData.sourceDocumentId = sourceDocumentId;
        }
        
        await this.collection.updateOne(
          { namespace: namespace },
          { $set: updateData }
        );
        
        // Récupérer le template mis à jour
        const updatedTemplate = await this.collection.findOne({ namespace });
        return updatedTemplate;
      }
      
      // Retourner le template existant sans modification
      return existingTemplate;
    }

    // Créer le canvas (analyse des styles Word ou preset)
    let canvas;
    if (jsonContent && jsonContent.canvas) {
      canvas = jsonContent.canvas;
    } else if (jsonContent) {
      canvas = CanvasService.createDefaultCanvas(jsonContent);
    } else {
      canvas = CanvasService.getPreset('standard');
    }

    // Ajouter le nom dans les métadonnées du canvas
    if (!canvas.metadata) {
      canvas.metadata = {};
    }
    canvas.metadata.name = namespace;

    const template = await this.createTemplate(namespace, {
      title: namespace,
      content: [],
      canvas: canvas
    }, {
      isStandalone: true // Template document est toujours standalone
    });

    // Ajouter les sections initiales, le TOC, les formats de numérotation et l'ID du document source au template (mise à jour)
    await this.collection.updateOne(
      { namespace: namespace },
      { 
        $set: { 
          initialSections: initialSections,
          initialToc: initialToc,
          sourceDocumentId: sourceDocumentId || null,
          numberingFormats: numberingFormats,
          styles: styles,
          styleHierarchy: styleHierarchy
        }
      }
    );

    // Retourner le template mis à jour
    template.initialSections = initialSections;
    template.initialToc = initialToc;
    template.sourceDocumentId = sourceDocumentId || null;
    template.numberingFormats = numberingFormats;
    template.styles = styles;
    template.styleHierarchy = styleHierarchy;
    
    return template;
  }
}

module.exports = TemplateService;
