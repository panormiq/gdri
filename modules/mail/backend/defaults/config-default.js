/**
 * Configuration par défaut pour le mode standalone
 * Fichier : backend/modules/mail/defaults/config-default.js
 * 
 * Cette config permet au module Mail de fonctionner en standalone
 * sans configuration spécifique. Les modules peuvent ensuite
 * surcharger avec leurs propres configurations.
 */

module.exports = {
  // Pas de configuration par défaut pour SMTP en mode standalone
  // Les modules doivent configurer leurs propres profils SMTP
  // ou utiliser initModule() pour enregistrer des profils
  
  // Collection par défaut
  defaultCollection: 'emails',
  
  // Pas de routing par défaut
  // Les modules configurent leurs propres règles
};

