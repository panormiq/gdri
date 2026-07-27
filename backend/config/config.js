/**
 * Configuration générale du backend Node.js
 * Fichier : backend/config/config.js
 */

module.exports = {
  // Configuration serveur
  port: process.env.PORT || 3000,
  host: process.env.HOST || '0.0.0.0', // 0.0.0.0 pour être accessible depuis Apache
  
  // Configuration MongoDB (surchargeable via MONGODB_* / MONGODB_URI)
  mongo: (() => {
    const { resolveMongoConfig } = require('./mongo-env');
    const m = resolveMongoConfig();
    return {
      host: m.host,
      port: Number(m.port) || 27017,
      database: m.database,
      user: m.user,
      password: m.password,
      uri: m.uri
    };
  })(),
  
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
        'https://gdri.fr',
        // Environnement test
        'https://test.gdri.fr',
        'http://test.gdri.fr',
        'https://test.gdr-innovation.fr',
        'http://test.gdr-innovation.fr'
      ];

      const isTestOrigin = origin && (
        origin.includes('://test.gdri.fr') ||
        origin.includes('://test.gdr-innovation.fr')
      );
      
      // En développement / test, autoriser les origines locales et test.*
      if (
        process.env.NODE_ENV === 'development' ||
        process.env.ENVIRONMENT === 'test' ||
        process.env.ENVIRONMENT === 'development' ||
        !process.env.NODE_ENV
      ) {
        if (!origin) {
          return callback(null, true);
        }
        
        if (origin.includes('localhost') || origin.includes('127.0.0.1') || isTestOrigin) {
          return callback(null, true);
        }
      }
      
      if (allowedOrigins.includes(origin) || isTestOrigin) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
  },
  
  // Environnement (ENVIRONMENT=test|development|production prioritaire)
  environment: process.env.ENVIRONMENT || process.env.NODE_ENV || 'development'
};

