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
}

module.exports = DocumentService;

