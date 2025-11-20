/**
 * Service Document - Gestion des documents
 * Fichier : backend/modules/agent-documentaire/services/DocumentService.js
 * 
 * Fonction : Service principal pour la gestion des documents
 * - CRUD documents
 * - Orchestration extraction Word → JSON
 * - Orchestration génération JSON → HTML
 */

const path = require('path');
const fs = require('fs').promises;
const { ObjectId } = require('mongodb');
const WordExtractionService = require('../extractors/wordtojson');
const HtmlGenerationService = require('../generators/jsontohtml');
const config = require('../config.json');
const lockableProperties = require('../config/lockable-properties.json');

class DocumentService {
  constructor(database) {
    this.database = database;
    this.collection = null;
    this.storagePath = path.resolve(__dirname, '../', config.storagePath);
    this.documentsPath = path.resolve(__dirname, '../', config.documentsPath);
    this.imagesPath = path.resolve(__dirname, '../', config.imagesPath);
    this.defaultTestFile = path.resolve(__dirname, '../', config.defaultTestFile);
  }

  /**
   * Initialise le service
   */
  async init() {
    this.collection = this.database.getCollection('documents');
    
    // Créer les dossiers de stockage s'ils n'existent pas
    await this.ensureDirectoryExists(this.storagePath);
    await this.ensureDirectoryExists(this.documentsPath);
    await this.ensureDirectoryExists(this.imagesPath);
  }

  /**
   * S'assure qu'un dossier existe
   */
  async ensureDirectoryExists(dirPath) {
    try {
      await fs.access(dirPath);
    } catch {
      await fs.mkdir(dirPath, { recursive: true });
    }
  }

  /**
   * Upload d'un fichier Word
   * @param {Request} req - Requête Express avec fichier uploadé
   * @returns {Promise<Object>} Document créé
   */
  async uploadWordDocument(req) {
    // TODO: Implémenter l'upload de fichier
    // Pour l'instant, on peut utiliser le fichier par défaut
    throw new Error('Upload non implémenté pour le moment');
  }

  /**
   * Charge un fichier Word (fichier par défaut si filename non fourni)
   * @param {string|null} filename - Nom du fichier optionnel
   * @returns {Promise<string>} Chemin vers le fichier
   */
  async loadWordDocument(filename = null) {
    if (filename) {
      const filePath = path.resolve(filename);
      await fs.access(filePath);
      return filePath;
    }
    
    // Utiliser le fichier par défaut
    await fs.access(this.defaultTestFile);
    return this.defaultTestFile;
  }

  /**
   * Extrait Word → JSON
   * @param {string} documentId - ID du document (ou null pour nouveau)
   * @param {string|null} filename - Nom du fichier optionnel
   * @returns {Promise<Object>} Document avec JSON extrait
   */
  async extractWordToJson(documentId = null, filename = null) {
    // Charger le fichier Word
    const wordFilePath = await this.loadWordDocument(filename);
    
    // Extraire Word → JSON
    const jsonContent = await WordExtractionService.extract(wordFilePath);
    
    // Si documentId fourni, mettre à jour, sinon créer nouveau document
    if (documentId) {
      return await this.updateDocument(documentId, jsonContent);
    } else {
      // Créer un nouveau document
      const document = {
        title: jsonContent.metadata?.title || 'Document sans titre',
        original_filename: path.basename(wordFilePath),
        word_file_path: wordFilePath,
        json_content: jsonContent,
        metadata: {
          createdAt: new Date(),
          updatedAt: new Date(),
          version: 1
        },
        lockable_properties: lockableProperties.default
      };
      
      const result = await this.collection.insertOne(document);
      return { ...document, _id: result.insertedId };
    }
  }

  /**
   * Récupère un document par son ID
   * @param {string} documentId - ID du document
   * @returns {Promise<Object>} Document
   */
  async getDocument(documentId) {
    console.log('🔍 getDocument() appelé avec ID:', documentId);
    const objectId = ObjectId.isValid(documentId) ? new ObjectId(documentId) : documentId;
    let document = await this.collection.findOne({ _id: objectId });
    
    console.log('📄 Document trouvé dans MongoDB:', document ? 'OUI' : 'NON');
    if (document) {
      console.log('📊 Structure du document:');
      console.log('   - document.sections:', document.sections ? `${document.sections.length} sections` : 'undefined');
      console.log('   - document.json_content:', document.json_content ? 'existe' : 'undefined');
      console.log('   - document.json_content.sections:', document.json_content?.sections ? `${document.json_content.sections.length} sections` : 'NULL ou undefined');
      console.log('   - Clés du document:', Object.keys(document));
      if (document.json_content) {
        console.log('   - Clés de json_content:', Object.keys(document.json_content));
      }
    }

    if (!document && documentId === 'default-test') {
      console.log('⚠️  Document default-test non trouvé, création...');
      document = await this.createDefaultDocument();
    }

    if (!document) {
      throw new Error('Document non trouvé');
    }
    return document;
  }

  /**
   * Met à jour le JSON d'un document
   * @param {string} documentId - ID du document
   * @param {Object} jsonContent - Nouveau contenu JSON
   * @returns {Promise<Object>} Document mis à jour
   */
  async updateDocument(documentId, jsonContent) {
    const objectId = ObjectId.isValid(documentId) ? new ObjectId(documentId) : documentId;
    const document = await this.getDocument(documentId);
    
    document.json_content = jsonContent;
    document.metadata.updatedAt = new Date();
    document.metadata.version = (document.metadata.version || 0) + 1;
    
    await this.collection.updateOne(
      { _id: objectId },
      { $set: document }
    );
    
    return document;
  }

  /**
   * Réorganise les sections d'un document
   * @param {string} documentId - ID du document
   * @param {Array} sections - Nouvelle structure des sections
   * @returns {Promise<Object>} Document mis à jour
   */
  async reorganizeSections(documentId, options = {}) {
    const objectId = ObjectId.isValid(documentId) ? new ObjectId(documentId) : documentId;
    const document = await this.getDocument(documentId);
    const { sections } = options;

    if (!Array.isArray(sections) || sections.length === 0) {
      throw new Error('Le payload "sections" est requis pour la réorganisation');
    }

    document.json_content.sections = sections;
    this.renumberSections(document.json_content.sections);
    document.json_content.toc = this.generateTocFromSections(document.json_content.sections);
    document.metadata.updatedAt = new Date();
    document.metadata.version = (document.metadata.version || 0) + 1;
    
    await this.collection.updateOne(
      { _id: objectId },
      { $set: document }
    );
    
    return document;
  }

  /**
   * Renumérote récursivement les sections selon leur position dans l'arbre
   * @param {Array} sections - Sections hiérarchiques
   * @param {Array} parentPrefix - Segments de numérotation du parent
   */
  renumberSections(sections = [], parentPrefix = []) {
    if (!Array.isArray(sections)) {
      return;
    }

    let counter = 0;

    for (const section of sections) {
      if (!section || typeof section !== 'object') {
        continue;
      }

      if (!Array.isArray(section.children)) {
        section.children = [];
      }

      if (this.isTocSection(section)) {
        counter += 1;
        const prefix = parentPrefix.length === 0
          ? [this.numberToRoman(counter)]
          : [...parentPrefix, counter];

        section.level = prefix.length;
        section.numbering = this.formatNumbering(prefix);
        this.renumberSections(section.children, prefix);
      } else {
        section.level = parentPrefix.length;
        section.numbering = null;
        this.renumberSections(section.children, parentPrefix);
      }
    }
  }

  /**
   * Génère le TOC à partir des sections hiérarchiques
   * @param {Array} sections - Sections hiérarchiques
   * @returns {Array} TOC plat
   */
  generateTocFromSections(sections = []) {
    const toc = [];

    const traverse = (nodes) => {
      if (!Array.isArray(nodes)) {
        return;
      }

      for (const node of nodes) {
        if (!node || typeof node !== 'object') {
          continue;
        }

        if (this.isTocSection(node)) {
          toc.push({
            sectionId: node.id || null,
            title: node.title || '',
            numbering: node.numbering || null,
            level: node.level || 1,
            isAnnex: Boolean(node.isAnnex),
          });
        }

        if (Array.isArray(node.children) && node.children.length > 0) {
          traverse(node.children);
        }
      }
    };

    traverse(sections);
    return toc;
  }

  /**
   * Détermine si une section doit apparaître dans le TOC
   * @param {Object} section - Section à analyser
   * @returns {boolean} true si la section doit être incluse
   */
  isTocSection(section) {
    if (!section) {
      return false;
    }
    const allowedTypes = ['section', 'subsection', 'annex'];
    return !section.type || allowedTypes.includes(section.type);
  }

  /**
   * Convertit un entier en chiffre romain (I, II, III…)
   * @param {number} number - Valeur à convertir
   * @returns {string} chiffre romain
   */
  numberToRoman(number) {
    if (typeof number !== 'number' || number <= 0) {
      return '';
    }

    const numerals = [
      ['M', 1000],
      ['CM', 900],
      ['D', 500],
      ['CD', 400],
      ['C', 100],
      ['XC', 90],
      ['L', 50],
      ['XL', 40],
      ['X', 10],
      ['IX', 9],
      ['V', 5],
      ['IV', 4],
      ['I', 1],
    ];

    let result = '';
    let remaining = number;

    for (const [roman, value] of numerals) {
      while (remaining >= value) {
        result += roman;
        remaining -= value;
      }
    }

    return result;
  }

  /**
   * Formatte les segments de numérotation sous forme "III.2.1."
   * @param {Array} segments - Segments de numérotation
   * @returns {string|null} numérotation
   */
  formatNumbering(segments = []) {
    if (!Array.isArray(segments) || segments.length === 0) {
      return null;
    }

    return `${segments.join('.')}.`;
  }

  /**
   * Génère HTML depuis JSON
   * @param {string} documentId - ID du document
   * @returns {Promise<string>} HTML généré
   */
  async generateHtmlFromJson(documentId) {
    const document = await this.getDocument(documentId);
    return await HtmlGenerationService.generate(document.json_content);
  }

  /**
   * Récupère le chemin d'une image
   * @param {string} documentId - ID du document
   * @param {string} imageId - ID de l'image
   * @returns {Promise<string>} Chemin vers l'image
   */
  async getImagePath(documentId, imageId) {
    const imagePath = path.join(this.imagesPath, documentId, imageId);
    await fs.access(imagePath);
    return imagePath;
  }

  /**
   * Crée (ou remplace) un document de test par défaut
   * @returns {Promise<Object>} Document créé
   */
  async createDefaultDocument() {
    const wordFilePath = await this.loadWordDocument();
    const jsonContent = await WordExtractionService.extract(wordFilePath);

    const document = {
      _id: 'default-test',
      title: jsonContent.metadata?.title || 'Document test',
      original_filename: path.basename(wordFilePath),
      word_file_path: wordFilePath,
      json_content: jsonContent,
      metadata: {
        createdAt: new Date(),
        updatedAt: new Date(),
        version: 1,
        status: 'test',
      },
      lockable_properties: lockableProperties.default,
    };

    await this.collection.replaceOne({ _id: 'default-test' }, document, { upsert: true });
    return document;
  }
}

module.exports = DocumentService;

