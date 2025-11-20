/**
 * Extracteur Word → JSON
 * Fichier : backend/modules/agent-documentaire/extractors/wordtojson.js
 * 
 * Fonction : Point d'entrée pour l'extraction Word → JSON
 * Orchestre l'extraction de tous les éléments du document Word
 */

const path = require('path');
const fs = require('fs').promises;
const AdmZip = require('adm-zip');
const xml2js = require('xml2js');

// Configuration des balises Word
const { getTagConfig, getSupportedTags } = require('./word-tags-config');

// Extracteur de styles
const StyleExtractor = require('./style-extractor');
const StyleHierarchy = require('./style-hierarchy');

// Méthode d'extraction principale
const extractSection = require('./methodes/extract-section');

class WordToJson {
  /**
   * Extrait un document Word en JSON
   * @param {string} wordFilePath - Chemin vers le fichier .docx
   * @returns {Promise<Object>} JSON du document
   */
  static async extract(wordFilePath) {
    // Afficher les balises supportées (pour debug)
    const supportedTags = getSupportedTags();
    console.log(`📋 Balises Word supportées : ${supportedTags.join(', ')}`);
    // Un fichier .docx est un ZIP
    const zip = new AdmZip(wordFilePath);
    const zipEntries = zip.getEntries();
    
    // Extraire les fichiers XML nécessaires
    let documentXml = null;
    let relationshipsXml = null;
    let stylesXml = null;
    const images = [];
    
    for (const entry of zipEntries) {
      if (entry.entryName === 'word/document.xml') {
        documentXml = entry.getData().toString('utf8');
      } else if (entry.entryName === 'word/_rels/document.xml.rels') {
        relationshipsXml = entry.getData().toString('utf8');
      } else if (entry.entryName === 'word/styles.xml') {
        // IMPORTANT : Extraire les styles généraux AVANT de parser le contenu
        stylesXml = entry.getData().toString('utf8');
      } else if (entry.entryName.startsWith('word/media/')) {
        // Extraire les images
        const imageData = entry.getData();
        const imageName = path.basename(entry.entryName);
        images.push({
          name: imageName,
          data: imageData,
          path: entry.entryName
        });
      }
    }
    
    if (!documentXml) {
      throw new Error('Fichier Word invalide : document.xml non trouvé');
    }
    
    // ÉTAPE 1 : Extraire les styles généraux AVANT de parser le contenu
    console.log('📋 Extraction des styles généraux...');
    const documentStyles = await StyleExtractor.extract(stylesXml);
    
    // ÉTAPE 1.5 : Analyser la hiérarchie des styles personnalisés
    console.log('📊 Analyse de la hiérarchie des styles...');
    const styleHierarchy = StyleHierarchy.analyze(documentStyles);
    
    // Parser le XML avec gestion UTF-8
    const parser = new xml2js.Parser({
      explicitArray: true,  // Toujours créer des tableaux
      mergeAttrs: false,    // Ne pas merger les attributs
      explicitRoot: false,  // Ne pas wrapper dans un objet root
      trim: true,           // Supprimer les espaces en début/fin
      normalize: true,      // Normaliser les espaces
      explicitCharkey: false, // Utiliser '_' pour le texte (par défaut)
      charkey: '_',         // Clé pour le texte dans les éléments mixtes
      attrkey: '$',         // Clé pour les attributs
      // Gestion UTF-8 : xml2js gère automatiquement l'UTF-8 si le XML est en UTF-8
    });
    const documentObj = await parser.parseStringPromise(documentXml);
    const relationshipsObj = relationshipsXml 
      ? await parser.parseStringPromise(relationshipsXml)
      : null;
    
    // Extraire le contenu
    const result = {
      documentId: null, // Sera défini lors de la sauvegarde
      metadata: {
        title: this.extractTitle(documentObj),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      styles: documentStyles, // Styles généraux du document
      styleHierarchy: styleHierarchy, // Hiérarchie des styles de titres
      sections: [],
      toc: [],
      images: [],
      // Informations sur l'extraction
      extractionInfo: {
        supportedTags: getSupportedTags(),
        extractedAt: new Date().toISOString()
      }
    };
    
    // ÉTAPE 2 : Extraire le TOC (sommaire) EN PREMIER pour identifier le premier titre
    console.log('📑 Extraction du sommaire...');
    const ExtractToc = require('./methodes/extract-toc');
    const tocResult = await ExtractToc.extract(documentObj, []);
    result.toc = tocResult.toc;
    result.tocInfo = {
      found: tocResult.tocFound,
      method: tocResult.method,
      entriesCount: tocResult.toc.length,
      expectedTitlesCount: tocResult.expectedTitlesCount || tocResult.toc.length,
      tocStyles: tocResult.tocStyles || [], // Styles TMX (nombre de niveaux dans le TOC)
      tocInstruction: tocResult.tocInstruction || null // Instruction TOC depuis w:instrText
    };

    // Vérifier la cohérence entre l'instruction TOC et notre hiérarchie de styles
    if (tocResult.tocInstruction && tocResult.tocInstruction.levels) {
      console.log('🔍 Vérification cohérence instruction TOC / hiérarchie de styles...');
      for (const levelInfo of tocResult.tocInstruction.levels) {
        const styleName = levelInfo.styleName;
        const expectedLevel = levelInfo.level;
        
        // Chercher le style dans notre hiérarchie
        const styleId = Object.keys(documentStyles).find(id => {
          const style = documentStyles[id];
          return style && (style.name === styleName || style.id === styleName || id === styleName);
        });
        
        if (styleId && styleHierarchy.styleToLevel[styleId]) {
          const detectedLevel = styleHierarchy.styleToLevel[styleId];
          if (detectedLevel === expectedLevel) {
            console.log(`   ✅ ${styleName} : niveau ${expectedLevel} (cohérent)`);
          } else {
            console.log(`   ⚠️  ${styleName} : niveau attendu ${expectedLevel}, détecté ${detectedLevel}`);
          }
        } else {
          console.log(`   ⚠️  ${styleName} : style non trouvé dans la hiérarchie`);
        }
      }
    }
    
    // ÉTAPE 3 : Extraire les sections (en utilisant le TOC pour créer la section introduction)
    // extractSection.extract utilisera word-tags-config ET les styles généraux ET le TOC
    const { sections } = await extractSection.extract(
      documentObj, 
      images, 
      relationshipsObj,
      documentStyles,  // Passer les styles généraux
      result.toc,  // Passer le TOC pour identifier le premier titre
      styleHierarchy  // Passer la hiérarchie des styles (maintenant avec styles TOC)
    );
    result.sections = sections;
    
    // Extraire et sauvegarder les images
    result.images = await this.extractAndSaveImages(images, wordFilePath);
    
    return result;
  }
  
  /**
   * Extrait le titre du document
   */
  static extractTitle(documentObj) {
    // TODO: Extraire le titre depuis les propriétés du document
    return 'Document sans titre';
  }
  
  /**
   * Extrait et sauvegarde les images
   */
  static async extractAndSaveImages(images, wordFilePath) {
    const documentId = path.basename(wordFilePath, '.docx');
    const imagesDir = path.join(__dirname, '../storage/images', documentId);
    
    await fs.mkdir(imagesDir, { recursive: true });
    
    const savedImages = [];
    for (let i = 0; i < images.length; i++) {
      const image = images[i];
      const imagePath = path.join(imagesDir, image.name);
      await fs.writeFile(imagePath, image.data);
      
      savedImages.push({
        id: `img_${i}`,
        name: image.name,
        path: `storage/images/${documentId}/${image.name}`,
        originalPath: image.path
      });
    }
    
    return savedImages;
  }
}

// Export de la méthode extract comme fonction principale
module.exports = {
  extract: WordToJson.extract.bind(WordToJson)
};

