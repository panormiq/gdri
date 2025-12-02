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

const ALLOWED_IMAGE_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/gif'
];

class DocumentService {
  constructor(database) {
    this.database = database;
    this.collection = null;
    this.storagePath = path.resolve(__dirname, '../', config.storagePath);
    this.documentsPath = path.resolve(__dirname, '../', config.documentsPath);
    this.imagesPath = path.resolve(__dirname, '../', config.imagesPath);
    this.defaultTestFile = path.resolve(__dirname, '../', config.defaultTestFile);
    this.tempImagesPath = path.resolve(this.storagePath, 'temp-images');
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
    await this.ensureDirectoryExists(this.tempImagesPath);
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

    // Migration automatique des sections si nécessaire
    // Vérifier si des sections ont besoin de migration (structure undefined, null, ou invalide)
    if (document.json_content && Array.isArray(document.json_content.sections)) {
      const needsMigration = document.json_content.sections.some(section => {
        const structure = section.structure;
        return structure === undefined || structure === null || structure === '' || 
               (structure !== 'structural' && structure !== 'optional');
      });
      if (needsMigration) {
        console.log('🔄 Migration automatique des sections...');
        // Passer le document pour éviter la récursion
        document = await this.migrateSectionsToStructure(documentId, document);
      }
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
   * Migre les sections existantes pour ajouter les champs structure/actif/parent
   * @param {string} documentId - ID du document
   * @param {Object} document - Document à migrer (optionnel, pour éviter la récursion)
   * @returns {Promise<Object>} Document mis à jour
   */
  async migrateSectionsToStructure(documentId, document = null) {
    const objectId = ObjectId.isValid(documentId) ? new ObjectId(documentId) : documentId;
    
    // Si le document n'est pas fourni, le récupérer directement depuis MongoDB
    // pour éviter la récursion avec getDocument()
    if (!document) {
      document = await this.collection.findOne({ _id: objectId });
      if (!document) {
        throw new Error('Document non trouvé');
      }
    }
    
    if (!document.json_content || !Array.isArray(document.json_content.sections)) {
      return document;
    }

    let hasChanges = false;
    const visited = new WeakSet(); // Pour éviter les références circulaires

    // Fonction récursive pour migrer toutes les sections
    const migrateSection = (section) => {
      if (!section || typeof section !== 'object') return;
      
      // Vérifier si on a déjà visité cette section (éviter les références circulaires)
      if (visited.has(section)) return;
      visited.add(section);

      // Ajouter les champs par défaut si absents ou invalides
      // Par défaut, toutes les sections sont structurelles sauf si explicitement optionnelles
      if (section.structure === undefined || section.structure === null || section.structure === '') {
        section.structure = 'structural';
        hasChanges = true;
      } else if (section.structure !== 'structural' && section.structure !== 'optional') {
        // Si la valeur est invalide (ni 'structural' ni 'optional'), forcer à 'structural'
        console.warn(`⚠️ Section "${section.title}" a une structure invalide: "${section.structure}", forcée à 'structural'`);
        section.structure = 'structural';
        hasChanges = true;
      }
      if (section.actif === undefined) {
        section.actif = section.structure === 'structural' ? true : false;
        hasChanges = true;
      }
      if (section.parent === undefined) {
        section.parent = null;
        hasChanges = true;
      }
      if (section.category === undefined) {
        section.category = null;
        hasChanges = true;
      }
      // Migration : convertir les catégories string en tableau
      if (section.category !== null && typeof section.category === 'string') {
        section.category = [section.category];
        hasChanges = true;
      }
      // S'assurer que category est soit null soit un tableau
      if (section.category !== null && !Array.isArray(section.category)) {
        section.category = [section.category];
        hasChanges = true;
      }
      if (section.isDocument === undefined) {
        section.isDocument = false;
        hasChanges = true;
      }
      if (section.documentId === undefined) {
        section.documentId = null;
        hasChanges = true;
      }
      if (section.canvas === undefined) {
        section.canvas = null;
        hasChanges = true;
      }
      if (section.inheritedVariables === undefined) {
        section.inheritedVariables = [];
        hasChanges = true;
      }
      if (section.customVariables === undefined) {
        section.customVariables = {};
        hasChanges = true;
      }

      // Migrer les enfants récursivement
      if (Array.isArray(section.children)) {
        section.children.forEach(child => migrateSection(child));
      }
    };

    document.json_content.sections.forEach(section => migrateSection(section));

    if (hasChanges) {
      document.metadata.updatedAt = new Date();
      document.metadata.version = (document.metadata.version || 0) + 1;
      
      await this.collection.updateOne(
        { _id: objectId },
        { $set: document }
      );
    }

    return document;
  }

  /**
   * Trouve une section par son ID dans l'arbre
   * @param {string} sectionId - ID de la section
   * @param {Array} sections - Arbre de sections
   * @returns {Object|null} Section trouvée avec son parent
   */
  findSectionById(sectionId, sections, parent = null) {
    if (!Array.isArray(sections)) return null;

    for (const section of sections) {
      if (section.id === sectionId) {
        return { section, parent };
      }
      if (Array.isArray(section.children)) {
        const found = this.findSectionById(sectionId, section.children, section);
        if (found) return found;
      }
    }
    return null;
  }

  /**
   * Retire une section de son parent (children[])
   * @param {string} sectionId - ID de la section à retirer
   * @param {Array} sections - Arbre de sections
   * @returns {boolean} true si retirée avec succès
   */
  removeSectionFromParent(sectionId, sections) {
    if (!Array.isArray(sections)) return false;

    for (let i = 0; i < sections.length; i++) {
      if (sections[i].id === sectionId) {
        sections.splice(i, 1);
        return true;
      }
      if (Array.isArray(sections[i].children)) {
        if (this.removeSectionFromParent(sectionId, sections[i].children)) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Ajoute une section comme enfant d'un parent
   * @param {Object} section - Section à ajouter
   * @param {string} parentId - ID du parent
   * @param {Array} sections - Arbre de sections
   * @param {number} position - Position dans children[] (optionnel)
   * @returns {boolean} true si ajoutée avec succès
   */
  addSectionToParent(section, parentId, sections, position = null) {
    if (!Array.isArray(sections)) return false;

    // Si parentId est null, ajouter à la racine
    if (!parentId) {
      if (position !== null && position >= 0 && position <= sections.length) {
        sections.splice(position, 0, section);
      } else {
        sections.push(section);
      }
      return true;
    }

    // Chercher le parent
    for (const parentSection of sections) {
      if (parentSection.id === parentId) {
        if (!Array.isArray(parentSection.children)) {
          parentSection.children = [];
        }
        if (position !== null && position >= 0 && position <= parentSection.children.length) {
          parentSection.children.splice(position, 0, section);
        } else {
          parentSection.children.push(section);
        }
        return true;
      }
      if (Array.isArray(parentSection.children)) {
        if (this.addSectionToParent(section, parentId, parentSection.children, position)) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Change le type structure/optionnel d'une section
   * @param {string} documentId - ID du document
   * @param {string} sectionId - ID de la section
   * @param {string} newStructure - 'structural' ou 'optional'
   * @param {string|null} parentId - ID du parent (requis si optional)
   * @param {string|Array<string>|null} category - Catégorie(s) (requis si optional, peut être un tableau)
   * @returns {Promise<Object>} Document mis à jour
   */
  async changeSectionStructure(documentId, sectionId, newStructure, parentId = null, category = null) {
    const objectId = ObjectId.isValid(documentId) ? new ObjectId(documentId) : documentId;
    const document = await this.getDocument(documentId);
    
    if (!document.json_content || !Array.isArray(document.json_content.sections)) {
      throw new Error('Document sans sections');
    }

    // Valider newStructure
    if (newStructure !== 'structural' && newStructure !== 'optional') {
      throw new Error('newStructure doit être "structural" ou "optional"');
    }

    // Si optional, valider category et normaliser en tableau
    let normalizedCategory = null;
    if (newStructure === 'optional') {
      if (!category) {
        throw new Error('category est requis pour une section optionnelle');
      }
      // Normaliser : convertir string en tableau, ou garder le tableau
      normalizedCategory = Array.isArray(category) ? category : [category];
      // Filtrer les valeurs vides
      normalizedCategory = normalizedCategory.filter(c => c && c.trim());
      if (normalizedCategory.length === 0) {
        throw new Error('category doit contenir au moins une catégorie valide');
      }
    }

    // Trouver la section
    const found = this.findSectionById(sectionId, document.json_content.sections);
    if (!found) {
      throw new Error('Section non trouvée');
    }

    const { section } = found;

    // Si on passe de structural à optional
    if (section.structure === 'structural' && newStructure === 'optional') {
      // Retirer de son parent actuel
      this.removeSectionFromParent(sectionId, document.json_content.sections);
      
      // Mettre à jour les champs
      section.structure = 'optional';
      section.actif = false; // Par défaut désactivé
      section.parent = parentId;
      section.category = normalizedCategory;
      
      // IMPORTANT : Garder la section optionnelle dans sections (à la racine) pour qu'elle reste accessible
      // Vérifier qu'elle n'est pas déjà à la racine
      const isAtRoot = document.json_content.sections.some(s => s.id === sectionId);
      if (!isAtRoot) {
        document.json_content.sections.push(section);
      }
    }
    // Si on passe de optional à structural
    else if (section.structure === 'optional' && newStructure === 'structural') {
      // Réintégrer dans le parent (ou à la racine si parentId est null)
      const oldParentId = section.parent;
      this.removeSectionFromParent(sectionId, document.json_content.sections);
      
      // Réintégrer
      if (parentId !== null) {
        this.addSectionToParent(section, parentId, document.json_content.sections);
      } else if (oldParentId) {
        this.addSectionToParent(section, oldParentId, document.json_content.sections);
      } else {
        document.json_content.sections.push(section);
      }
      
      // Mettre à jour les champs
      section.structure = 'structural';
      section.actif = true; // Forcé à true pour structural
      section.parent = null;
      section.category = null;
    }
    // Si on change juste le parent ou la catégorie d'une option
    else if (section.structure === 'optional' && newStructure === 'optional') {
      section.parent = parentId;
      if (normalizedCategory !== null) {
        section.category = normalizedCategory;
      }
    }

    // Renuméroter et régénérer le TOC
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
   * Récupère les sections optionnelles perdues et les réintègre dans la structure
   * @param {string} documentId - ID du document
   * @returns {Promise<Object>} Document mis à jour avec les sections récupérées
   */
  async recoverLostOptionalSections(documentId) {
    const objectId = ObjectId.isValid(documentId) ? new ObjectId(documentId) : documentId;
    const document = await this.getDocument(documentId);
    
    if (!document.json_content || !Array.isArray(document.json_content.sections)) {
      throw new Error('Document sans sections');
    }

    // Collecter toutes les sections optionnelles dans l'arbre
    const allOptionalSections = [];
    const collectOptionalSections = (sections) => {
      if (!Array.isArray(sections)) return;
      sections.forEach(section => {
        if (section.structure === 'optional') {
          allOptionalSections.push(section);
        }
        if (Array.isArray(section.children)) {
          collectOptionalSections(section.children);
        }
      });
    };
    collectOptionalSections(document.json_content.sections);

    // Vérifier quelles sections optionnelles sont à la racine
    const optionalAtRoot = document.json_content.sections.filter(s => 
      s.structure === 'optional'
    );

    // Les sections optionnelles qui ne sont ni à la racine ni dans l'arbre sont perdues
    // On va chercher dans toutes les sections (y compris celles qui pourraient être orphelines)
    const allSections = [];
    const collectAllSections = (sections) => {
      if (!Array.isArray(sections)) return;
      sections.forEach(section => {
        allSections.push(section);
        if (Array.isArray(section.children)) {
          collectAllSections(section.children);
        }
      });
    };
    collectAllSections(document.json_content.sections);

    // Trouver les sections optionnelles qui ne sont pas à la racine
    const lostOptionalSections = allSections.filter(section => {
      if (section.structure !== 'optional') return false;
      // Vérifier si elle est à la racine
      const isAtRoot = document.json_content.sections.some(rootSection => rootSection.id === section.id);
      return !isAtRoot;
    });

    // Réintégrer les sections perdues à la racine
    let recoveredCount = 0;
    lostOptionalSections.forEach(section => {
      // Vérifier qu'elle n'est pas déjà à la racine
      const alreadyAtRoot = document.json_content.sections.some(s => s.id === section.id);
      if (!alreadyAtRoot) {
        document.json_content.sections.push(section);
        recoveredCount++;
      }
    });

    if (recoveredCount > 0) {
      // Renuméroter et régénérer le TOC
      this.renumberSections(document.json_content.sections);
      document.json_content.toc = this.generateTocFromSections(document.json_content.sections);
      
      document.metadata.updatedAt = new Date();
      document.metadata.version = (document.metadata.version || 0) + 1;
      
      await this.collection.updateOne(
        { _id: objectId },
        { $set: document }
      );
    }

    return {
      document,
      recoveredCount,
      totalOptional: allOptionalSections.length + lostOptionalSections.length
    };
  }

  /**
   * Met à jour la catégorie d'une section optionnelle
   * @param {string} documentId - ID du document
   * @param {string} sectionId - ID de la section
   * @param {string|Array<string>} categories - Catégorie(s) (peut être un tableau)
   * @returns {Promise<Object>} Document mis à jour
   */
  async updateSectionCategory(documentId, sectionId, categories) {
    const objectId = ObjectId.isValid(documentId) ? new ObjectId(documentId) : documentId;
    const document = await this.getDocument(documentId);
    
    if (!document.json_content || !Array.isArray(document.json_content.sections)) {
      throw new Error('Document sans sections');
    }

    // Trouver la section
    const found = this.findSectionById(sectionId, document.json_content.sections);
    if (!found) {
      throw new Error('Section non trouvée');
    }

    const { section } = found;

    // Vérifier que c'est une section optionnelle
    if (section.structure !== 'optional') {
      throw new Error('Seules les sections optionnelles peuvent avoir une catégorie');
    }

    // Normaliser : convertir string en tableau, ou garder le tableau
    let normalizedCategories = Array.isArray(categories) ? categories : [categories];
    // Filtrer les valeurs vides
    normalizedCategories = normalizedCategories.filter(c => c && c.trim());
    if (normalizedCategories.length === 0) {
      throw new Error('category doit contenir au moins une catégorie valide');
    }

    // Mettre à jour la catégorie
    section.category = normalizedCategories;
    
    document.metadata.updatedAt = new Date();
    document.metadata.version = (document.metadata.version || 0) + 1;
    
    await this.collection.updateOne(
      { _id: objectId },
      { $set: document }
    );
    
    return document;
  }

  /**
   * Active ou désactive une section optionnelle
   * @param {string} documentId - ID du document
   * @param {string} sectionId - ID de la section
   * @param {boolean} active - true pour activer, false pour désactiver
   * @returns {Promise<Object>} Document mis à jour
   */
  async toggleSectionActive(documentId, sectionId, active) {
    const objectId = ObjectId.isValid(documentId) ? new ObjectId(documentId) : documentId;
    const document = await this.getDocument(documentId);
    
    if (!document.json_content || !Array.isArray(document.json_content.sections)) {
      throw new Error('Document sans sections');
    }

    // Trouver la section
    const found = this.findSectionById(sectionId, document.json_content.sections);
    if (!found) {
      throw new Error('Section non trouvée');
    }

    const { section } = found;

    // Vérifier que c'est une section optionnelle
    if (section.structure !== 'optional') {
      throw new Error('Seules les sections optionnelles peuvent être activées/désactivées');
    }

    // Mettre à jour actif
    section.actif = active === true;
    
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
   * Génère un PDF depuis le HTML du document
   * @param {string} documentId - ID du document
   * @param {Object} options - Options de génération PDF (format, marges, etc.)
   * @returns {Promise<Buffer>} Buffer du PDF généré
   */
  async generatePdfFromHtml(documentId, options = {}) {
    const puppeteer = require('puppeteer');
    const fs = require('fs').promises;
    const document = await this.getDocument(documentId);
    
    // Générer le HTML avec les images en base64 pour le PDF
    const html = await this.generateHtmlForPdf(documentId, document.json_content);

    // Lancer Puppeteer avec options optimisées
    const browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu'
      ]
    });
    
    try {
      const page = await browser.newPage();
      
      // Augmenter le timeout de navigation (60 secondes au lieu de 30)
      page.setDefaultNavigationTimeout(60000);
      page.setDefaultTimeout(60000);
      
      // Définir un viewport pour un rendu cohérent (A4 en pixels à 96 DPI)
      await page.setViewport({
        width: 794,  // A4 width en pixels (210mm à 96 DPI)
        height: 1123, // A4 height en pixels (297mm à 96 DPI)
        deviceScaleFactor: 2 // Pour un rendu plus net
      });

      // Définir le contenu HTML - utiliser 'load' au lieu de 'networkidle0' 
      // car les images sont déjà en base64 (pas de requêtes réseau à attendre)
      // 'load' attend que toutes les ressources (images, CSS) soient chargées
      await page.setContent(html, {
        waitUntil: 'load', // 'load' est plus rapide que 'networkidle0' pour du contenu inline
        timeout: 60000 // 60 secondes de timeout
      });

      // Attendre un peu que le rendu se stabilise (CSS, layout, etc.)
      // Utiliser une Promise avec setTimeout au lieu de waitForTimeout (déprécié)
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Vérifier que les images base64 sont bien chargées (devrait être instantané)
      const imagesStatus = await page.evaluate(() => {
        const images = Array.from(document.images);
        const loaded = images.filter(img => img.complete && img.naturalWidth > 0);
        return {
          total: images.length,
          loaded: loaded.length,
          allLoaded: images.length === 0 || loaded.length === images.length
        };
      });

      if (!imagesStatus.allLoaded && imagesStatus.total > 0) {
        console.warn(`⚠️ ${imagesStatus.loaded}/${imagesStatus.total} images chargées`);
      }

      // Utiliser les marges du document Word si disponibles
      const pageMargins = document.json_content.pageMargins || {
        top: 70.85,   // 2.5cm en points
        right: 70.85,
        bottom: 70.85,
        left: 70.85
      };

      // Convertir les marges de points en mm pour Puppeteer
      const marginTop = options.margin?.top || `${pageMargins.top * 0.352778}mm`;
      const marginRight = options.margin?.right || `${pageMargins.right * 0.352778}mm`;
      const marginBottom = options.margin?.bottom || `${pageMargins.bottom * 0.352778}mm`;
      const marginLeft = options.margin?.left || `${pageMargins.left * 0.352778}mm`;

      // Générer le PDF avec options optimisées pour pixel perfect
      const pdfOptions = {
        format: options.format || 'A4',
        margin: {
          top: marginTop,
          right: marginRight,
          bottom: marginBottom,
          left: marginLeft
        },
        printBackground: true, // Inclure les couleurs de fond
        preferCSSPageSize: false,
        displayHeaderFooter: false,
        // Options pour un rendu de qualité
        scale: options.scale || 1.0,
        // Qualité d'impression optimale
        quality: 100
      };

      const pdfBuffer = await page.pdf(pdfOptions);
      
      return pdfBuffer;
    } finally {
      await browser.close();
    }
  }

  /**
   * Génère un PDF depuis un HTML fourni directement (depuis le frontend)
   * Le HTML contient tous les styles, les images seront converties en base64 côté backend
   * @param {string} html - HTML complet avec styles (images en URLs)
   * @param {string} documentId - ID du document (pour récupérer les marges et images)
   * @param {Object} options - Options de génération PDF
   * @returns {Promise<Buffer>} Buffer du PDF généré
   */
  async generatePdfFromHtmlString(html, documentId, options = {}) {
    const puppeteer = require('puppeteer');
    const fs = require('fs').promises;
    const path = require('path');
    const document = await this.getDocument(documentId);
    
    // Convertir les images en base64 avant de générer le PDF
    html = await this.convertImageUrlsToBase64(html, documentId);
    
    // Lancer Puppeteer avec options optimisées
    const browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu'
      ]
    });
    
    try {
      const page = await browser.newPage();
      
      // Augmenter le timeout de navigation (60 secondes)
      page.setDefaultNavigationTimeout(60000);
      page.setDefaultTimeout(60000);
      
      // Définir un viewport pour un rendu cohérent (A4 en pixels à 96 DPI)
      await page.setViewport({
        width: 794,  // A4 width en pixels (210mm à 96 DPI)
        height: 1123, // A4 height en pixels (297mm à 96 DPI)
        deviceScaleFactor: 2 // Pour un rendu plus net
      });

      // Définir le contenu HTML - 'load' attend que toutes les ressources soient chargées
      await page.setContent(html, {
        waitUntil: 'load',
        timeout: 60000
      });

      // Attendre un peu que le rendu se stabilise
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Utiliser les marges du document Word si disponibles
      const pageMargins = document.json_content.pageMargins || {
        top: 70.85,
        right: 70.85,
        bottom: 70.85,
        left: 70.85
      };

      // Convertir les marges de points en mm pour Puppeteer
      const marginTop = options.margin?.top || `${pageMargins.top * 0.352778}mm`;
      const marginRight = options.margin?.right || `${pageMargins.right * 0.352778}mm`;
      const marginBottom = options.margin?.bottom || `${pageMargins.bottom * 0.352778}mm`;
      const marginLeft = options.margin?.left || `${pageMargins.left * 0.352778}mm`;

      // Générer le PDF avec options optimisées
      const pdfOptions = {
        format: options.format || 'A4',
        margin: {
          top: marginTop,
          right: marginRight,
          bottom: marginBottom,
          left: marginLeft
        },
        printBackground: true,
        preferCSSPageSize: false,
        displayHeaderFooter: false,
        scale: options.scale || 1.0
      };

      const pdfBuffer = await page.pdf(pdfOptions);
      
      return pdfBuffer;
    } finally {
      await browser.close();
    }
  }

  /**
   * Convertit les URLs d'images dans le HTML en base64
   * @param {string} html - HTML avec images en URLs
   * @param {string} documentId - ID du document
   * @returns {Promise<string>} HTML avec images en base64
   */
  async convertImageUrlsToBase64(html, documentId) {
    const fs = require('fs').promises;
    const path = require('path');
    
    const imagesDir = path.join(this.imagesPath, documentId);
    
    // Fonction pour convertir une image en base64
    const imageToBase64 = async (imageName) => {
      try {
        const imagePath = path.join(imagesDir, imageName);
        await fs.access(imagePath);
        const imageBuffer = await fs.readFile(imagePath);
        const ext = path.extname(imageName).toLowerCase();
        const mimeType = ext === '.png' ? 'image/png' : 
                        ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' :
                        ext === '.gif' ? 'image/gif' : 'image/png';
        return `data:${mimeType};base64,${imageBuffer.toString('base64')}`;
      } catch (error) {
        console.warn(`⚠️ Image non trouvée: ${imageName}`, error.message);
        return null;
      }
    };

    // Trouver toutes les références d'images dans le HTML
    const imageRegex = /src=["']([^"']+)["']/g;
    const imageMatches = [...html.matchAll(imageRegex)];
    
    console.log(`📄 Conversion de ${imageMatches.length} image(s) en base64 pour le PDF...`);
    
    // Remplacer chaque image par sa version base64
    let convertedCount = 0;
    for (const match of imageMatches) {
      const imageUrl = match[1];
      
      // Ignorer les images déjà en base64
      if (imageUrl.startsWith('data:')) {
        continue;
      }
      
      let imageName = null;
      
      // Vérifier si c'est une URL d'API (format: /api/agent-documentaire/document/.../image/...)
      if (imageUrl.includes('/image/')) {
        imageName = imageUrl.split('/image/').pop();
      } else {
        // Si c'est juste un nom de fichier
        imageName = imageUrl.split('/').pop();
      }
      
      if (imageName) {
        const base64Image = await imageToBase64(imageName);
        if (base64Image) {
          // Remplacer uniquement la première occurrence pour éviter les doublons
          html = html.replace(match[0], `src="${base64Image}"`);
          convertedCount++;
        } else {
          console.warn(`⚠️ Image non convertie: ${imageName}`);
        }
      }
    }
    
    console.log(`✅ ${convertedCount} image(s) convertie(s) en base64`);
    return html;
  }

  /**
   * Génère le HTML optimisé pour le PDF (avec images en base64)
   * @param {string} documentId - ID du document
   * @param {Object} jsonContent - Contenu JSON du document
   * @returns {Promise<string>} HTML optimisé pour PDF
   */
  async generateHtmlForPdf(documentId, jsonContent) {
    // Générer le HTML de base
    let html = await HtmlGenerationService.generate(jsonContent, {
      includeStyles: true,
      includeToc: true
    });

    // Convertir les images en base64
    html = await this.convertImageUrlsToBase64(html, documentId);

    // Ajouter des styles CSS supplémentaires pour le PDF
    const pdfStyles = `
      <style>
        @page {
          size: A4;
          margin: 0;
        }
        body {
          margin: 0;
          padding: 0;
        }
        /* Assurer que les images ne se cassent pas sur plusieurs pages */
        img {
          max-width: 100%;
          height: auto;
          page-break-inside: avoid;
        }
        /* Éviter les coupures de page dans les sections */
        .section {
          page-break-inside: avoid;
        }
        .section-title {
          page-break-after: avoid;
        }
        /* Assurer que les tableaux ne se cassent pas */
        table {
          page-break-inside: avoid;
        }
      </style>
    `;

    // Insérer les styles PDF avant la fermeture de </head>
    html = html.replace('</head>', pdfStyles + '</head>');

    return html;
  }

  /**
   * Sauvegarde les images extraites sur le disque
   * @param {string} documentId - ID du document
   * @param {Array} images - Tableau des images extraites (avec name et data)
   * @returns {Promise<void>}
   */
  async saveImages(documentId, images) {
    if (!images || images.length === 0) {
      console.log('📷 Aucune image à sauvegarder');
      return;
    }

    const documentImagesPath = path.join(this.imagesPath, documentId);
    await this.ensureDirectoryExists(documentImagesPath);

    console.log(`📷 Sauvegarde de ${images.length} image(s)...`);

    for (const image of images) {
      const imagePath = path.join(documentImagesPath, image.name);
      await fs.writeFile(imagePath, image.data);
      console.log(`  ✅ ${image.name}`);
    }

    console.log('✅ Images sauvegardées avec succès');
  }

  /**
   * Sauvegarde une image envoyée depuis le frontend (drag & drop)
   * @param {string} documentId - ID du document
   * @param {Object} file - Fichier multer (buffer, mimetype, originalname)
   * @param {Object} options - Options complémentaires
   * @returns {Promise<Object>} Informations sur l'image sauvegardée
   */
  async saveUploadedImage(documentId, file, options = {}) {
    if (!file) {
      throw new Error('Aucun fichier n\'a été fourni.');
    }

    // Vérifier que le document existe
    await this.getDocument(documentId);

    if (!ALLOWED_IMAGE_MIME_TYPES.includes(file.mimetype)) {
      throw new Error('Format d\'image non supporté.');
    }

    const documentImagesPath = path.join(this.imagesPath, documentId);
    await this.ensureDirectoryExists(documentImagesPath);

    let finalName;
    if (options.replaceImageName) {
      finalName = path.basename(options.replaceImageName);
    } else {
      const extension = this.getExtensionFromMimeType(file.mimetype, file.originalname);
      const safeBaseName = this.sanitizeFilename(file.originalname || 'image');
      const uniqueSuffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
      finalName = `${safeBaseName}-${uniqueSuffix}${extension}`;
    }
    const destinationPath = path.join(documentImagesPath, finalName);

    await fs.writeFile(destinationPath, file.buffer);

    return {
      imageName: finalName,
      mimeType: file.mimetype,
      size: file.size
    };
  }

  /**
   * Sauvegarde une image temporaire en attente de validation
   * @param {string} documentId
   * @param {string} sessionId
   * @param {Object} file
   * @returns {Promise<Object>}
   */
  async saveTempImage(documentId, sessionId, file) {
    if (!file) {
      throw new Error('Aucun fichier n\'a été fourni.');
    }
    if (!sessionId) {
      throw new Error('Session d\'upload manquante.');
    }
    await this.getDocument(documentId);

    if (!ALLOWED_IMAGE_MIME_TYPES.includes(file.mimetype)) {
      throw new Error('Format d\'image non supporté.');
    }

    const sessionPath = await this.ensureTempSessionDirectory(sessionId);
    const extension = this.getExtensionFromMimeType(file.mimetype, file.originalname);
    const safeBaseName = this.sanitizeFilename(file.originalname || 'image');
    const tempImageId = `${safeBaseName}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}${extension}`;
    const destinationPath = path.join(sessionPath, tempImageId);

    await fs.writeFile(destinationPath, file.buffer);

    return {
      tempImageId,
      originalName: file.originalname || 'image',
      mimeType: file.mimetype,
      size: file.size
    };
  }

  /**
   * Retourne le chemin d'une image temporaire
   */
  async getTempImagePath(sessionId, tempImageId) {
    if (!sessionId || !tempImageId) {
      throw new Error('Session ou image temporaire manquante.');
    }
    const sessionPath = this.getTempSessionPath(sessionId);
    const imagePath = path.join(sessionPath, tempImageId);
    await fs.access(imagePath);
    return imagePath;
  }

  /**
   * Promeut une liste d'images temporaires vers le stockage définitif
   * @param {string} documentId
   * @param {string} sessionId
   * @param {Array} images
   * @returns {Promise<Array>}
   */
  async promoteTempImages(documentId, sessionId, images = []) {
    if (!Array.isArray(images) || images.length === 0) {
      return [];
    }
    const sessionPath = this.getTempSessionPath(sessionId);
    const targetDir = path.join(this.imagesPath, documentId);
    await this.ensureDirectoryExists(targetDir);

    const results = [];

    for (const image of images) {
      const { tempImageId, targetImageId, originalName, replaceImageName } = image;
      if (!tempImageId || !targetImageId) {
        continue;
      }

      const sourcePath = path.join(sessionPath, tempImageId);
      try {
        await fs.access(sourcePath);
      } catch (error) {
        console.warn(`⚠️ Image temporaire introuvable: ${tempImageId}`);
        continue;
      }

      const sanitizedReplaceName = replaceImageName ? path.basename(replaceImageName) : null;
      let finalName = sanitizedReplaceName || this.generateFinalImageName(originalName);
      const destinationPath = path.join(targetDir, finalName);

      await fs.copyFile(sourcePath, destinationPath);
      await fs.unlink(sourcePath);

      results.push({
        targetImageId,
        finalName
      });
    }

    // Nettoyer le dossier session si vide
    await this.cleanupTempSessionIfEmpty(sessionPath);

    return results;
  }

  generateFinalImageName(originalName = 'image') {
    const extensionFromName = path.extname(originalName) || '.png';
    const base = this.sanitizeFilename(originalName);
    return `${base}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}${extensionFromName}`;
  }

  async ensureTempSessionDirectory(sessionId) {
    const sessionPath = this.getTempSessionPath(sessionId);
    await this.ensureDirectoryExists(sessionPath);
    return sessionPath;
  }

  getTempSessionPath(sessionId) {
    const safeSession = this.sanitizeSessionId(sessionId);
    return path.join(this.tempImagesPath, safeSession);
  }

  sanitizeSessionId(sessionId = '') {
    return sessionId.toString().replace(/[^a-zA-Z0-9-_]/g, '');
  }

  async cleanupTempSessionIfEmpty(sessionPath) {
    try {
      const files = await fs.readdir(sessionPath);
      if (files.length === 0) {
        await fs.rmdir(sessionPath);
      }
    } catch (error) {
      // pas grave
    }
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
   * Initialise le canevas pour un document (si absent)
   * @param {string} documentId - ID du document
   * @param {string} presetName - Nom du preset optionnel ("standard", "compact", "large")
   * @returns {Promise<Object>} Document avec canevas initialisé
   */
  async initializeCanvas(documentId, presetName = null) {
    const document = await this.getDocument(documentId);
    const jsonContent = document.json_content;

    // Si le canevas existe déjà, ne rien faire
    if (jsonContent.canvas) {
      return document;
    }

    const CanvasService = require('./CanvasService');

    // Créer le canevas (preset ou analyse des styles Word)
    let canvas;
    if (presetName) {
      canvas = CanvasService.getPreset(presetName);
    } else {
      canvas = CanvasService.createDefaultCanvas(jsonContent);
    }

    // Ajouter le canevas au JSON (sans modifier les autres données)
    jsonContent.canvas = canvas;

    // Sauvegarder
    return await this.updateDocument(documentId, jsonContent);
  }

  /**
   * Met à jour le canevas d'un document
   * @param {string} documentId - ID du document
   * @param {Object} canvas - Nouveau canevas
   * @returns {Promise<Object>} Document mis à jour
   */
  async updateCanvas(documentId, canvas) {
    const document = await this.getDocument(documentId);
    const jsonContent = document.json_content;

    // Mettre à jour les métadonnées du canevas
    canvas.metadata = {
      ...canvas.metadata,
      updatedAt: new Date().toISOString(),
      version: (canvas.metadata?.version || 0) + 1
    };

    // Mettre à jour le canevas dans le JSON
    jsonContent.canvas = canvas;

    // Sauvegarder
    return await this.updateDocument(documentId, jsonContent);
  }

  /**
   * Récupère le canevas d'un document
   * @param {string} documentId - ID du document
   * @returns {Promise<Object|null>} Canevas ou null
   */
  async getCanvas(documentId) {
    const document = await this.getDocument(documentId);
    const canvas = document.json_content.canvas;
    
    if (!canvas) {
      return null;
    }

    // Nettoyer les valeurs obsolètes de marginBottom (migration)
    // Si marginBottom est exactement 6 dans les paragraphes, c'est probablement une valeur par défaut obsolète
    let needsUpdate = false;
    
    if (canvas.paragraphs?.default?.marginBottom === 6) {
      canvas.paragraphs.default.marginBottom = null;
      needsUpdate = true;
    }
    
    if (canvas.annexes?.default?.marginBottom === 6) {
      canvas.annexes.default.marginBottom = null;
      needsUpdate = true;
    }
    
    // Si on a nettoyé, sauvegarder
    if (needsUpdate) {
      await this.updateCanvas(documentId, canvas);
    }
    
    return canvas;
  }

  /**
   * Crée (ou remplace) un document de test par défaut
   * @returns {Promise<Object>} Document créé
   */
  async createDefaultDocument() {
    const wordFilePath = await this.loadWordDocument();
    const jsonContent = await WordExtractionService.extract(wordFilePath);
    
    // Note: Les images sont déjà sauvegardées par WordExtractionService.extract()

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

  sanitizeFilename(filename = '') {
    return filename
      .toLowerCase()
      .replace(/\.[^/.]+$/, '')
      .replace(/[^a-z0-9-_]/g, '-')
      .replace(/-+/g, '-')
      .trim()
      || 'image';
  }

  getExtensionFromMimeType(mimeType, originalName = '') {
    const fromName = path.extname(originalName);
    if (fromName) {
      return fromName.toLowerCase();
    }
    switch (mimeType) {
      case 'image/png':
        return '.png';
      case 'image/jpeg':
      case 'image/jpg':
        return '.jpg';
      case 'image/webp':
        return '.webp';
      case 'image/gif':
        return '.gif';
      default:
        return '.png';
    }
  }
}

module.exports = DocumentService;

