/**
 * Serveur Express - Point d'entrée du backend Node.js
 * Fichier : backend/server.js
 */

const express = require('express');
const cors = require('cors');
const config = require('./config/config');
const database = require('./config/database');
const moduleRegistry = require('./core/module-registry');
const { loadModules } = require('./core/module-loader');

// Créer l'application Express
const app = express();

// Middlewares
app.use(cors(config.cors));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
    app.listen(config.port, config.host, () => {
      console.log(`\n✅ Serveur backend démarré sur http://${config.host}:${config.port}`);
      console.log(`📊 Environnement : ${config.environment}`);
      console.log(`🎯 Modules chargés : ${moduleRegistry.getModules().filter(m => m.loaded).length}\n`);
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

