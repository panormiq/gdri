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
const Entity = require('./models/Entity');
const EntrepriseDatabaseService = require('./services/EntrepriseDatabaseService');
const { ObjectId } = require('mongodb');
const moduleRegistry = require('./core/module-registry');
const { loadModules } = require('./core/module-loader');
const { loadConnectors } = require('./core/connectors/connector-loader');
const { loadAgentFlows } = require('./core/agent-flow/agent-flow-loader');
const createConnectorsRouter = require('./routes/connectors');
const { syncServicesCatalogFromModules } = require('./core/services-catalog-sync');
const { globalLimiter, detectSuspiciousConnections } = require('./middleware/rate-limiter');

// Créer l'application Express
const app = express();

// ⚠️ LOGGING TRÈS TÔT pour capturer TOUTES les requêtes (même celles qui échouent)
app.use((req, res, next) => {
  // Logger TOUTES les requêtes vers /api/facebook/webhook
  if (req.path && (req.path.includes('/webhook') || req.url.includes('/webhook'))) {
    console.log('\n🟢🟢🟢 ===== REQUÊTE WEBHOOK DÉTECTÉE (TRÈS TÔT) =====');
    console.log(`  ⏰ ${new Date().toISOString()}`);
    console.log(`  📥 ${req.method} ${req.originalUrl || req.url}`);
    console.log(`  📥 Path: ${req.path}`);
    console.log(`  📥 IP: ${req.ip || req.connection?.remoteAddress || req.socket?.remoteAddress || req.headers['x-forwarded-for'] || 'N/A'}`);
    console.log(`  📥 User-Agent: ${req.headers['user-agent']?.substring(0, 80) || 'N/A'}`);
    console.log(`  📥 Content-Type: ${req.headers['content-type'] || 'N/A'}`);
    console.log(`  📥 Content-Length: ${req.headers['content-length'] || '0'}`);
    console.log(`  📥 X-Hub-Signature: ${req.headers['x-hub-signature'] || 'MANQUANT'}`);
    console.log(`  📥 Host: ${req.headers.host || 'N/A'}`);
    console.log(`========================================================\n`);
  }
  next();
});

// Middlewares de sécurité (AVANT les autres middlewares)
// Détection des connexions suspectes (SYN flood indicators)
app.use(detectSuspiciousConnections);

// Rate limiting global pour protection contre DDoS et SYN flood
app.use('/api', globalLimiter);

// Middlewares standards
app.use(cors(config.cors));
// Cookie parser pour HttpOnly cookies (compatibilité doc_template V3)
app.use(cookieParser());

// ⚠️ LOGGING AVANT LE PARSING DU BODY pour capturer toutes les requêtes
app.use((req, res, next) => {
  if (req.path && req.path.includes('/webhook')) {
    console.log('\n🔴🔴🔴 ===== REQUÊTE WEBHOOK AVANT PARSING =====');
    console.log(`  ⏰ ${new Date().toISOString()}`);
    console.log(`  📥 ${req.method} ${req.path}`);
    console.log(`  📥 IP: ${req.ip || req.connection?.remoteAddress || req.socket?.remoteAddress || 'N/A'}`);
    console.log(`  📥 Headers Content-Type: ${req.headers['content-type'] || 'N/A'}`);
    console.log(`  📥 Headers Content-Length: ${req.headers['content-length'] || '0'}`);
    console.log(`  📥 User-Agent: ${req.headers['user-agent']?.substring(0, 50) || 'N/A'}...`);
    console.log(`  📥 X-Hub-Signature: ${req.headers['x-hub-signature'] || 'MANQUANT'}`);
    console.log(`================================================\n`);
  }
  next();
});

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
  // Log spécial pour les webhooks Facebook
  if (req.path.includes('/webhook')) {
    console.log(`\n🌐🌐🌐 ===== REQUÊTE WEBHOOK DÉTECTÉE (MIDDLEWARE GLOBAL) =====`);
    console.log(`  ⏰ Timestamp: ${new Date().toISOString()}`);
    console.log(`  📥 ${req.method} ${req.path}`);
    console.log(`  📥 IP: ${req.ip || req.connection.remoteAddress || req.socket.remoteAddress || 'N/A'}`);
    console.log(`  📥 User-Agent: ${req.headers['user-agent'] || 'N/A'}`);
    console.log(`  📥 Content-Type: ${req.headers['content-type'] || 'N/A'}`);
    console.log(`  📥 Content-Length: ${req.headers['content-length'] || '0'}`);
    console.log(`  📥 X-Hub-Signature: ${req.headers['x-hub-signature'] || 'MANQUANT'}`);
    console.log(`  📥 X-Hub-Signature-256: ${req.headers['x-hub-signature-256'] || 'MANQUANT'}`);
    console.log(`  📥 Host: ${req.headers.host || 'N/A'}`);
    console.log(`  📥 Origin: ${req.headers.origin || 'N/A'}`);
    console.log(`  📥 Referer: ${req.headers.referer || 'N/A'}`);
    console.log(`========================================================\n`);
  } else {
    console.log(`📥 ${req.method} ${req.path} - Origin: ${req.headers.origin || 'N/A'}`);
  }
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
const entityRolesRoutes = require('./routes/entity-roles');
app.use('/api/entity-roles', entityRolesRoutes);
const entityUserConfigRoutes = require('./routes/entity-user-config');
app.use('/api/entity-user-config', entityUserConfigRoutes);

// Routes publiques pour le formulaire de contact
const contactRoutes = require('./routes/contact');
app.use('/api/contact', contactRoutes);

// Routes d'authentification (pour définir les cookies HttpOnly)
const authRoutes = require('./routes/auth');
app.use('/api/auth', authRoutes);
const activityLogsRoutes = require('./routes/activity-logs');
app.use('/api/activity-logs', activityLogsRoutes);

/**
 * Point d'entrée principal
 */
async function ensureGdriEntity() {
  const siretNormalized = '800944407';
  const siretVariants = [siretNormalized, '800944 407'];
  const entitiesCollection = database.getCollection('entities');
  const servicesCollection = database.getCollection('services');
  const usersCollection = database.getCollection('users');

  const services = await servicesCollection.find({}).toArray();
  const serviceIds = services.map(service => service._id).filter(Boolean);

  let entity = await entitiesCollection.findOne({ siret: { $in: siretVariants } });

  if (!entity) {
    const entityData = {
      name: 'GDR-Innovation',
      siret: siretNormalized,
      address: '921 impasse de la grange de rideaux, 72150 Le Grand-Lucé',
      services_authorized: serviceIds,
      status: 'active',
      created_at: new Date(),
      updated_at: new Date()
    };

    const insertResult = await entitiesCollection.insertOne(entityData);
    entity = await Entity.findById(insertResult.insertedId);

    console.log(`✅ Entité GDRI créée (${entity._id})`);

    try {
      await EntrepriseDatabaseService.createEntrepriseDatabase(entity._id.toString());
      console.log('✅ Base entreprise GDRI initialisée');
    } catch (error) {
      console.warn(`⚠️  Base entreprise GDRI non initialisée: ${error.message}`);
    }
  } else if (serviceIds.length > 0) {
    await entitiesCollection.updateOne(
      { _id: new ObjectId(entity._id) },
      {
        $addToSet: { services_authorized: { $each: serviceIds } },
        $set: { updated_at: new Date() }
      }
    );
  }

  if (!entity) {
    return;
  }

  const adminUsers = await usersCollection.find({ role: 'ADMIN_GDRI' }).toArray();
  for (const adminUser of adminUsers) {
    const entreprises = Array.isArray(adminUser.entreprises) ? adminUser.entreprises : [];
    const hasEntity = entreprises.some(item => {
      if (!item || !item.entrepriseId) {
        return false;
      }
      return item.entrepriseId.toString() === entity._id.toString();
    });

    if (!hasEntity) {
      entreprises.push({
        entrepriseId: entity._id,
        role: 'admin',
        joinedAt: new Date()
      });
    }

    const updateData = {
      entreprises,
      updated_at: new Date()
    };

    if (!adminUser.currentEntrepriseId) {
      updateData.currentEntrepriseId = entity._id;
    }

    await usersCollection.updateOne(
      { _id: new ObjectId(adminUser._id) },
      { $set: updateData }
    );
  }
}

async function start() {
  try {
    console.log('🚀 Démarrage du serveur backend GDRI...\n');

    // 1. Connexion à MongoDB
    console.log('📡 Connexion à MongoDB...');
    await database.connect();

    // 2. Découverte des modules
    console.log('🔍 Découverte des modules...');
    await moduleRegistry.discoverModules();

    // 2b. Synchroniser le catalogue services Mongo depuis les modules découverts
    await syncServicesCatalogFromModules();

    // 2c. S'assurer que l'entité GDRI existe et autoriser tous les services connus
    await ensureGdriEntity();

    // 3. Chargement des modules
    console.log('📦 Chargement des modules...\n');
    await loadModules(app, database);

    // 3a. Connecteurs (entrées/sorties agents)
    await loadConnectors(app, database);
    app.use('/api/connectors', createConnectorsRouter(database));

    // 3a2. Orchestrateur agent-flow (briques trigger + exécution flows)
    await loadAgentFlows(app, database);

    // Sync quotidienne Facebook (pull Graph + envoi des rapports différés)
    try {
      const DailyFacebookSyncService = require('./modules/facebook/services/DailyFacebookSyncService');
      const dailyFb = new DailyFacebookSyncService(database);
      await dailyFb.init();
      dailyFb.start();
    } catch (e) {
      console.warn('⚠️  Sync quotidienne Facebook non démarrée:', e.message);
    }

    // 3b. Repli /api/ia si le module ia n'a pas été chargé (dossier modules/ia absent ou non déployé)
    const iaModule = moduleRegistry.getModule('ia');
    if (!iaModule || !iaModule.loaded) {
      app.use('/api/ia', (req, res) => {
        res.status(503).json({
          success: false,
          message: 'Module IA non disponible. Déployez le dossier modules/ia et redémarrez le backend Node.js.',
          code: 'MODULE_IA_NOT_LOADED'
        });
      });
      console.log('⚠️  Module IA non chargé : route de repli /api/ia → 503');
    }

    // 3c. Routes admin : rechargement des modules à chaud, statut, redémarrage optionnel
    const createAdminRouter = require('./routes/admin');
    app.use('/api/admin', createAdminRouter(app, database));

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

