const fs = require('fs');
const path = require('path');
const { ensureDirExists } = require('../../utils/fileUtils');

/**
 * 🔹 Traite une image : crop, rotation, et sauvegarde dans le dossier de sortie
 * @param {string} filePath - Chemin du fichier image source
 * @param {Object|null} crop - Objet de crop { x, y, width, height } ou null
 * @param {number} rotation - Angle de rotation (0, 90, 180, 270)
 * @param {string} outputDir - Dossier de sortie pour l'image traitée
 * @returns {Promise<Object>} Objet avec les informations de l'image traitée
 */
async function processImage(filePath, crop = null, rotation = 0, outputDir) {
  try {
    // Vérifier que le fichier source existe
    if (!fs.existsSync(filePath)) {
      throw new Error(`Fichier source non trouvé: ${filePath}`);
    }

    // Créer le dossier de sortie s'il n'existe pas
    ensureDirExists(outputDir);

    // Lire les informations du fichier source
    const originalName = path.basename(filePath);
    const ext = path.extname(originalName).toLowerCase();
    const baseName = path.basename(originalName, ext);

    // Générer un nom de fichier unique
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    const fileName = `${baseName}-${timestamp}-${randomSuffix}${ext}`;
    const outputPath = path.join(outputDir, fileName);

    // Pour l'instant, on copie simplement le fichier
    // TODO: Ajouter le traitement d'image (crop, rotation) avec sharp ou jimp si nécessaire
    fs.copyFileSync(filePath, outputPath);

    // Obtenir les informations du fichier
    const stats = fs.statSync(outputPath);
    const fileSize = stats.size;

    // Retourner la structure attendue par le frontend
    // Le filename sera utilisé par buildCollectionImageUrl pour construire l'URL API complète
    return {
      filename: fileName,  // Nom du fichier (utilisé pour construire l'URL API via buildCollectionImageUrl)
      fileName: fileName,   // Alias pour compatibilité
      path: outputPath,     // Chemin complet du fichier (pour suppression si nécessaire)
      size: fileSize,       // Taille en octets
      mimeType: getMimeType(ext), // Type MIME
      originalName: originalName, // Nom original
      // Métadonnées optionnelles
      crop: crop || null,
      rotation: rotation || 0,
      // Note: url et previewUrl seront construits côté frontend avec buildCollectionImageUrl
    };
  } catch (error) {
    console.error('❌ processImage error:', error);
    throw error;
  }
}

/**
 * 🔹 Détermine le type MIME à partir de l'extension
 * @param {string} ext - Extension du fichier (.jpg, .png, etc.)
 * @returns {string} Type MIME
 */
function getMimeType(ext) {
  const mimeTypes = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.bmp': 'image/bmp',
    '.svg': 'image/svg+xml'
  };
  return mimeTypes[ext.toLowerCase()] || 'image/jpeg';
}

module.exports = {
  processImage
};
