// backend/services/DocumentGenerationService.js
const { ObjectId } = require('mongodb');
const Document = require('../models/document_model');
const Template = require('../models/template_model');
const Collection = require('../models/collection_model');
const database = require('../../../config/database');

/**
 * 🔹 Vérifie si une valeur correspond à une image (objet d'image attendu)
 * @param {*} value - Valeur à vérifier
 * @returns {boolean}
 */
const isImageValue = value => {
  if (!value || typeof value !== 'object') return false;
  return !!(value.previewUrl || value.url || value.filename || value.fileName);
};

/**
 * 🔹 Construit l'URL d'une image de collection (compatible backend)
 * @param {Object|string} imageData - Données image
 * @param {string} collectionId - ID de collection
 * @returns {string} URL de l'image ou chaîne vide si invalide
 */
const buildCollectionImageUrl = (imageData, collectionId) => {
  if (!imageData) return '';

  const apiBase = '/api';

  if (typeof imageData === 'string') {
    if (imageData.startsWith('blob:')) return '';
    if (imageData.startsWith('http://')
      || imageData.startsWith('https://')
      || imageData.startsWith('/')
      || imageData.startsWith('data:')) {
      return imageData;
    }
    if (!collectionId) return '';
    return `${apiBase}/doc-template/collections/${collectionId}/images/${encodeURIComponent(imageData)}`;
  }

  if (typeof imageData === 'object') {
    if (imageData.previewUrl && !imageData.previewUrl.startsWith('blob:')) {
      return imageData.previewUrl;
    }
    if (imageData.url && !imageData.url.startsWith('blob:')) {
      return imageData.url;
    }
    const filename = imageData.filename || imageData.fileName;
    if (filename && collectionId) {
      return `${apiBase}/doc-template/collections/${collectionId}/images/${encodeURIComponent(filename)}`;
    }
  }

  return '';
};

/**
 * 🔹 Résout une variable d'image depuis variables
 * @param {string} variablePath - Chemin de variable (alias.champ)
 * @param {Object} variables - Variables du document
 * @returns {{ value: *, isImage: boolean, collectionId: string|null }}
 */
const resolveVariableImage = (variablePath, variables) => {
  let value = '';
  let isImage = false;
  let collectionId = null;

  if (!variablePath) {
    return { value, isImage, collectionId };
  }

  if (variablePath.includes('.')) {
    const [alias, ...fieldParts] = variablePath.split('.');
    const fieldName = fieldParts.join('.');
    const collectionData = variables?.collections?.[alias];
    if (collectionData?.values) {
      value = collectionData.values[fieldName] ?? '';
      isImage = isImageValue(value);
      collectionId = collectionData.collectionId || null;
    }
  } else if (variables?.simple) {
    value = variables.simple[variablePath] ?? '';
    isImage = isImageValue(value);
  }

  return { value, isImage, collectionId };
};

/**
 * 🔹 Remplace les images variables (data-variable-path) par les vraies URLs
 * @param {string} html - HTML du template
 * @param {Object} variables - Variables du document
 * @returns {string} HTML mis à jour
 */
const replaceVariableImagesInHtml = (html, variables) => {
  if (!html) return '';

  const variableImageRegex = /<img\b[^>]*\bdata-variable-path=(["'])(.*?)\1[^>]*>/gi;

  return html.replace(variableImageRegex, (match, quote, variablePath) => {
    const { value, isImage, collectionId } = resolveVariableImage(variablePath, variables);
    if (!isImage || !collectionId) {
      return '';
    }

    const imageUrl = buildCollectionImageUrl(value, collectionId);
    if (!imageUrl) {
      return '';
    }

    let updated = match;

    // Remplacer ou ajouter src
    if (/\ssrc=/.test(updated)) {
      updated = updated.replace(/\ssrc=(["']).*?\1/i, ` src="${imageUrl}"`);
    } else {
      updated = updated.replace('<img', `<img src="${imageUrl}"`);
    }

    // Nettoyer les attributs de variable
    updated = updated
      .replace(/\sdata-variable-path=(["']).*?\1/i, '')
      .replace(/\sdata-image-type=(["']).*?\1/i, '');

    // Garantir la classe collection-image pour les marges PDF
    if (/\sclass=/.test(updated)) {
      updated = updated.replace(/\sclass=(["'])(.*?)\1/i, (full, clsQuote, clsValue) => {
        const classes = clsValue
          .split(/\s+/)
          .filter(Boolean)
          .filter(cls => cls !== 'template-image');
        if (!classes.includes('collection-image')) {
          classes.push('collection-image');
        }
        return ` class="${classes.join(' ')}"`;
      });
    } else {
      updated = updated.replace('<img', '<img class="collection-image"');
    }

    return updated;
  });
};

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
            if (isImageValue(value)) {
              const imageUrl = buildCollectionImageUrl(value, collectionData.collectionId);
              if (imageUrl) {
                const imgTag = `<img src="${imageUrl}" alt="${alias}.${fieldName}" class="collection-image" style="max-width: 100%; height: auto;" />`;
                content = content.replace(regex, imgTag);

                // Remplacer aussi dans les attributs src si {{alias.field}} est utilisé
                const srcPattern = new RegExp(`(src=["'])([^"']*\\{\\{${alias}\\.${fieldName}\\}\\}[^"']*)(["'])`, 'gi');
                content = content.replace(srcPattern, (match, prefix, srcContent, suffix) => {
                  const newSrc = srcContent.replace(regex, imageUrl);
                  return `${prefix}${newSrc}${suffix}`;
                });
              } else {
                content = content.replace(regex, '');
              }
            } else {
              content = content.replace(regex, String(value ?? ''));
            }
          }
        }
      }
    }

    // Remplacer les images variables via data-variable-path
    content = replaceVariableImagesInHtml(content, variables);

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

