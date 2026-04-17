const fs = require('fs');
const path = require('path');

/**
 * 🔹 Crée un dossier s'il n'existe pas
 * @param {string} dirPath - Chemin du dossier
 */
function ensureDirExists(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * 🔹 Supprime les fichiers d'une photo (original, preview, etc.)
 * @param {Object|string} photoData - Données de la photo (objet avec path, filename, etc. ou string)
 */
function deletePhotoFiles(photoData) {
  if (!photoData) return;

  try {
    // Si c'est un objet avec des chemins
    if (typeof photoData === 'object') {
      // Supprimer le fichier principal si path existe
      if (photoData.path && fs.existsSync(photoData.path)) {
        fs.unlinkSync(photoData.path);
      }
      
      // Supprimer si filename existe et qu'on peut construire le chemin
      if (photoData.filename || photoData.fileName) {
        const filename = photoData.filename || photoData.fileName;
        // Essayer de trouver le fichier dans le dossier previews
        // On ne peut pas le supprimer sans connaître le chemin complet
        // Cette fonction sera améliorée si nécessaire
      }
    }
    // Si c'est un string (chemin de fichier)
    else if (typeof photoData === 'string' && fs.existsSync(photoData)) {
      fs.unlinkSync(photoData);
    }
  } catch (error) {
    console.warn('⚠️ Erreur lors de la suppression des fichiers photo:', error.message);
  }
}

module.exports = {
  ensureDirExists,
  deletePhotoFiles
};
