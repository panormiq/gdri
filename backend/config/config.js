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
    origin: function (origin, callback) {
      // Autoriser les origines locales pour le développement
      const allowedOrigins = [
        'http://localhost',
        'http://localhost:80',
        'http://localhost/gdri',
        'http://localhost/gdri-dev',
        'http://localhost/gdri/frontend',
        'http://127.0.0.1',
        'http://127.0.0.1:80',
        'http://127.0.0.1/gdri',
        'http://127.0.0.1/gdri-dev',
        'http://127.0.0.1/gdri/frontend',
        // Production
        'https://www.gdr-innovation.fr',
        'https://www.gdri.fr',
        'https://gdr-innovation.fr',
        'https://gdri.fr'
      ];
      
      // En développement, autoriser toutes les origines locales
      if (process.env.NODE_ENV === 'development' || !process.env.NODE_ENV) {
        // Autoriser les requêtes sans origine (Postman, curl, etc.)
        if (!origin) {
          return callback(null, true);
        }
        
        // Vérifier si l'origine est locale (localhost ou 127.0.0.1)
        if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
          return callback(null, true);
        }
      }
      
      // En production, vérifier strictement les origines autorisées
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
  },
  
  // Environnement
  environment: process.env.NODE_ENV || 'development'
};

