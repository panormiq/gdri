/**
 * Configuration générale du backend Node.js
 * Fichier : backend/config/config.js
 */

module.exports = {
  // Configuration serveur
  port: process.env.PORT || 3000,
  host: process.env.HOST || 'localhost',
  
  // Configuration MongoDB
  mongo: {
    host: 'localhost',
    port: 27017,
    database: 'GDR-INNOVATION',
    user: 'gdri_admin',
    password: 'gdri2024'
  },
  
  // Configuration des modules
  modules: {
    path: './backend/modules',
    autoLoad: true
  },
  
  // Configuration CORS
  cors: {
    origin: 'http://localhost/gdri-dev',
    credentials: true
  },
  
  // Environnement
  environment: process.env.NODE_ENV || 'development'
};

