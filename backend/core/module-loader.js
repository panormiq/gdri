/**
 * Chargeur de modules - Charge et initialise les modules dynamiquement
 * Fichier : backend/core/module-loader.js
 * 
 * Fonction : loadModules - Charge tous les modules découverts dans Express
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

      // Charger le point d'entrée du module
      const modulePath = path.join(moduleInfo.path, 'index.js');
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

module.exports = { loadModules };

