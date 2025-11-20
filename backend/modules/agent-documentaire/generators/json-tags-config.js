/**
 * Configuration centralisée pour la génération JSON → HTML
 * Fichier : backend/modules/agent-documentaire/generators/json-tags-config.js
 * 
 * Fonction : Définit les types d'éléments JSON et leurs méthodes de génération HTML
 */

// Lazy loading pour éviter les dépendances circulaires
let generateSection = null;
let generateParagraph = null;
let generateImage = null;
let generateTable = null;

function getGenerateSection() {
  if (!generateSection) {
    generateSection = require('./methodes/generate-section');
  }
  return generateSection;
}

function getGenerateParagraph() {
  if (!generateParagraph) {
    generateParagraph = require('./methodes/generate-paragraph');
  }
  return generateParagraph;
}

function getGenerateImage() {
  if (!generateImage) {
    generateImage = require('./methodes/generate-image');
  }
  return generateImage;
}

function getGenerateTable() {
  if (!generateTable) {
    generateTable = require('./methodes/generate-table');
  }
  return generateTable;
}

/**
 * Configuration des types d'éléments JSON et leurs méthodes de génération
 */
const jsonTagsConfig = {
  section: {
    type: 'section',
    getMethod: () => getGenerateSection().generate,
    properties: ['title', 'level', 'numbering', 'content', 'children'],
    required: true
  },
  paragraph: {
    type: 'paragraph',
    getMethod: () => getGenerateParagraph().generate,
    properties: ['text', 'styles'],
    required: false
  },
  image: {
    type: 'image',
    getMethod: () => getGenerateImage().generate,
    properties: ['src', 'width', 'height', 'alt', 'position', 'crop'],
    required: false
  },
  table: {
    type: 'table',
    getMethod: () => getGenerateTable().generate,
    properties: ['rows', 'headerRow', 'styles'],
    required: false
  },
  introduction: {
    type: 'introduction',
    getMethod: () => getGenerateSection().generate, // Utilise la même méthode que section
    properties: ['title', 'content'],
    required: false
  }
};

/**
 * Récupère la configuration pour un type d'élément
 * @param {string} type - Type d'élément (section, paragraph, image, table, etc.)
 * @returns {Object|null} Configuration ou null si non trouvé
 */
function getTagConfig(type) {
  return jsonTagsConfig[type] || null;
}

/**
 * Récupère toutes les configurations
 * @returns {Object} Toutes les configurations
 */
function getAllConfigs() {
  return jsonTagsConfig;
}

/**
 * Récupère les types supportés
 * @returns {Array<string>} Liste des types supportés
 */
function getSupportedTypes() {
  return Object.keys(jsonTagsConfig);
}

module.exports = {
  getTagConfig,
  getAllConfigs,
  getSupportedTypes
};

