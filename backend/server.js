/**
 * Serveur Express - Point d'entrée du backend Node.js
 * Fichier : backend/server.js
 */

// ⚠️ IMPORTANT : Charger dotenv EN PREMIER pour que les variables d'environnement soient disponibles
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const config = require('./config/config');
const database = require('./config/database');
const moduleRegistry = require('./core/module-registry');
const { loadModules } = require('./core/module-loader');
const { globalLimiter, detectSuspiciousConnections } = require('./middleware/rate-limiter');

// Créer l'application Express
const app = express();

// Middlewares de sécurité (AVANT les autres middlewares)
// Détection des connexions suspectes (SYN flood indicators)
app.use(detectSuspiciousConnections);

// Rate limiting global pour protection contre DDoS et SYN flood
app.use('/api', globalLimiter);

// Middlewares standards
app.use(cors(config.cors));
// Cookie parser pour HttpOnly cookies (compatibilité doc_template V3)
app.use(cookieParser());
// Augmenter la limite de taille du body pour les gros HTML (50MB)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Servir les fichiers statiques depuis le dossier uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Route de santé
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    modules: moduleRegistry.getModules().length,
    loadedModules: moduleRegistry.getModules().filter(m => m.loaded).map(m => m.name)
  });
});

// Middleware de logging pour toutes les requêtes API
app.use('/api', (req, res, next) => {
  console.log(`📥 ${req.method} ${req.path} - Origin: ${req.headers.origin || 'N/A'}`);
  next();
});

// Routes globales pour la gestion des configurations de services
const serviceConfigRoutes = require('./routes/service-config');
app.use('/api/services', serviceConfigRoutes);

// Routes globales pour la gestion des entités
const entitiesRoutes = require('./routes/entities');
app.use('/api/entities', entitiesRoutes);

// Routes pour la gestion des utilisateurs
const usersRoutes = require('./routes/users');
app.use('/api/users', usersRoutes);

// Routes publiques pour le formulaire de contact
const contactRoutes = require('./routes/contact');
app.use('/api/contact', contactRoutes);

// Routes d'authentification (pour définir les cookies HttpOnly)
const authRoutes = require('./routes/auth');
app.use('/api/auth', authRoutes);

/**
 * Point d'entrée principal
 */
async function start() {
  try {
    console.log('🚀 Démarrage du serveur backend GDRI...\n');

    // 1. Connexion à MongoDB
    console.log('📡 Connexion à MongoDB...');
    await database.connect();

    // 2. Découverte des modules
    console.log('🔍 Découverte des modules...');
    await moduleRegistry.discoverModules();

    // 3. Chargement des modules
    console.log('📦 Chargement des modules...\n');
    await loadModules(app, database);

    // 4. Démarrer le serveur
    const server = app.listen(config.port, config.host, () => {
      console.log(`\n✅ Serveur backend démarré sur http://${config.host}:${config.port}`);
      console.log(`📊 Environnement : ${config.environment}`);
      console.log(`🎯 Modules chargés : ${moduleRegistry.getModules().filter(m => m.loaded).length}\n`);
    });
    
    // Gestion des erreurs du serveur
    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`❌ Erreur : Le port ${config.port} est déjà utilisé !`);
        console.error(`💡 Arrêtez le processus qui utilise le port ${config.port} ou changez le port dans la config.`);
      } else if (error.code === 'EACCES') {
        console.error(`❌ Erreur : Permission refusée pour écouter sur le port ${config.port} !`);
        console.error(`💡 Utilisez un port supérieur à 1024 ou lancez avec les permissions admin.`);
      } else {
        console.error(`❌ Erreur lors du démarrage du serveur :`, error);
      }
      process.exit(1);
    });

  } catch (error) {
    console.error('❌ Erreur lors du démarrage :', error);
    process.exit(1);
  }
}

// Gestion de l'arrêt propre
process.on('SIGTERM', async () => {
  console.log('\n⏹️  Arrêt du serveur...');
  await database.close();
  process.exit(0);
});

// Démarrer le serveur
start();

