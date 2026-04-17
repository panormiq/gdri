/**
 * Chargeur de modules - Charge et initialise les modules dynamiquement
 * Fichier : backend/core/module-loader.js
 *
 * Deux emplacements sont scannés (voir module-registry.js) :
 * 1. backend/modules/<nom>/  — modules « core » dans le backend GDRI
 * 2. modules/<nom>/backend/ — modules dont la partie backend est à la racine du projet
 *
 * Chaque module doit exposer init(app, db) et routes() et avoir un package.json avec "routes" (ex. ["/api/mail"]).
 * Les chemins sont résolus en absolu pour que le chargement fonctionne quel que soit le répertoire de travail.
 */

const path = require('path');
const moduleRegistry = require('./module-registry');

/**
 * Charge et initialise tous les modules dans Express
 * @param {Express} app - Instance Express
 * @param {Database} db - Instance MongoDB
 * @returns {Promise<void>}
 */
async function loadModules(app, db) {
  const modules = moduleRegistry.getModules();

  for (const moduleInfo of modules) {
    try {
      // Vérifier si le module est activé
      if (!moduleInfo.enabled) {
        console.log(`⏸️  Module ${moduleInfo.name} désactivé`);
        continue;
      }

      // Chemin absolu vers index.js (indépendant du répertoire de travail)
      const modulePath = path.resolve(moduleInfo.path, 'index.js');
      const module = require(modulePath);

      // Initialiser le module (si la fonction existe)
      if (typeof module.init === 'function') {
        await module.init(app, db);
      }

      // Charger les routes du module
      if (typeof module.routes === 'function') {
        try {
          const routes = module.routes();
          
          // Ajouter les routes au routeur selon la configuration
          if (moduleInfo.routes && Array.isArray(moduleInfo.routes)) {
            moduleInfo.routes.forEach(route => {
              app.use(route, routes);
              console.log(`🔗 Route chargée : ${route}`);
            });
          }
        } catch (error) {
          console.error(`❌ Erreur lors du chargement des routes du module ${moduleInfo.name} :`, error.message);
          throw error;
        }
      }

      // Marquer le module comme chargé
      moduleRegistry.setModuleLoaded(moduleInfo.name);
      
      console.log(`✅ Module ${moduleInfo.displayName || moduleInfo.name} chargé avec succès`);
      
    } catch (error) {
      console.error(`❌ Erreur lors du chargement du module ${moduleInfo.name} :`, error.message);
    }
  }

  console.log(`\n📊 ${moduleRegistry.getModules().filter(m => m.loaded).length} modules chargés\n`);
}

/**
 * Charge uniquement les modules déjà enregistrés mais pas encore chargés (loaded === false).
 * Utilisé après rediscover() pour charger les nouveaux modules sans redémarrer le serveur.
 * @param {Express} app - Instance Express
 * @param {Database} db - Instance MongoDB
 * @returns {Promise<string[]>} Liste des noms de modules nouvellement chargés
 */
async function loadNewModules(app, db) {
  const toLoad = moduleRegistry.getModules().filter(m => m.enabled && !m.loaded);
  const loaded = [];

  for (const moduleInfo of toLoad) {
    try {
      const modulePath = path.resolve(moduleInfo.path, 'index.js');
      const module = require(modulePath);

      if (typeof module.init === 'function') {
        await module.init(app, db);
      }

      if (typeof module.routes === 'function') {
        const routes = module.routes();
        if (moduleInfo.routes && Array.isArray(moduleInfo.routes)) {
          moduleInfo.routes.forEach(route => {
            app.use(route, routes);
            console.log(`🔗 Route chargée (à chaud) : ${route}`);
          });
        }
      }

      moduleRegistry.setModuleLoaded(moduleInfo.name);
      loaded.push(moduleInfo.name);
      console.log(`✅ Module chargé à chaud : ${moduleInfo.displayName || moduleInfo.name}`);
    } catch (error) {
      console.error(`❌ Erreur chargement à chaud ${moduleInfo.name} :`, error.message);
    }
  }

  if (loaded.length > 0) {
    console.log(`\n📊 ${loaded.length} nouveau(x) module(s) chargé(s) à chaud : ${loaded.join(', ')}\n`);
  }
  return loaded;
}

module.exports = { loadModules, loadNewModules };

