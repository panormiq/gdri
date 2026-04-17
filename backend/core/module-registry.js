/**
 * Registre des modules - Gestion et découverte automatique
 * Fichier : backend/core/module-registry.js
 *
 * Découvre les modules à deux endroits :
 * 1. backend/modules/<nom> (core) — modules intégrés au backend GDRI
 * 2. modules/<nom>/backend (externe) — partie backend à la racine du projet
 *
 * Les chemins sont toujours résolus en absolus pour que le chargement fonctionne
 * quel que soit le répertoire de travail au démarrage du serveur.
 */

const fs = require('fs');
const path = require('path');

// Racines absolues : backend = dossier backend GDRI, projectRoot = racine du dépôt
const BACKEND_ROOT = path.resolve(__dirname, '..');
const PROJECT_ROOT = path.resolve(BACKEND_ROOT, '..');

class ModuleRegistry {
  constructor() {
    this.modules = new Map();
    this.coreModulesPath = path.join(BACKEND_ROOT, 'modules');
    this.externalModulesRoot = path.join(PROJECT_ROOT, 'modules');
  }

  /**
   * Découvre et enregistre tous les modules disponibles
   * @returns {Promise<void>}
   */
  async discoverModules() {
    this.discoverCoreModules();
    this.discoverExternalModules();
  }

  /**
   * Re-scanne les dossiers modules et enregistre les nouveaux modules (sans toucher aux déjà chargés).
   * À appeler après installation d'un module pour le rendre visible sans redémarrer le serveur.
   */
  rediscover() {
    this.discoverCoreModules();
    this.discoverExternalModules();
  }

  discoverCoreModules() {
    if (!fs.existsSync(this.coreModulesPath)) {
      console.log('⚠️  Aucun dossier backend/modules trouvé');
      return;
    }

    const modules = fs.readdirSync(this.coreModulesPath);

    for (const moduleName of modules) {
      const modulePath = path.join(this.coreModulesPath, moduleName);
      const packagePath = path.join(modulePath, 'package.json');
      this.registerModule(moduleName, modulePath, packagePath, 'backend/modules');
    }
  }

  discoverExternalModules() {
    if (!fs.existsSync(this.externalModulesRoot)) {
      return;
    }

    const modules = fs.readdirSync(this.externalModulesRoot);
    for (const moduleName of modules) {
      const moduleRoot = path.join(this.externalModulesRoot, moduleName);
      const modulePath = path.join(moduleRoot, 'backend');
      const packagePath = path.join(modulePath, 'package.json');
      this.registerModule(moduleName, modulePath, packagePath, 'modules/<nom>/backend');
    }
  }

  registerModule(moduleName, modulePath, packagePath, sourceLabel) {
    try {
      if (!fs.existsSync(modulePath) || !fs.statSync(modulePath).isDirectory()) {
        return;
      }

      if (!fs.existsSync(packagePath)) {
        return;
      }

      if (this.modules.has(moduleName)) {
        console.warn(`⚠️  Module ${moduleName} déjà enregistré, ignore ${sourceLabel}`);
        return;
      }

      const config = require(packagePath);

      // IMPORTANT: on garde `name` comme identifiant stable (nom de dossier).
      // Certains package.json contiennent un champ "name" (ex: "gdri-module-mail")
      // qui ne doit pas écraser l'identifiant interne, sinon setModuleLoaded() ne matche plus.
      this.modules.set(moduleName, {
        ...config,
        name: moduleName,
        path: modulePath,
        enabled: config.enabled !== false,
        loaded: false
      });

      console.log(`📦 Module découvert : ${config.displayName || moduleName}`);
    } catch (error) {
      console.error(`❌ Erreur lors du chargement du module ${moduleName} :`, error.message);
      console.error(`   Chemin du package.json : ${packagePath}`);
    }
  }

  /**
   * Retourne tous les modules enregistrés
   * @returns {Array} Liste des modules
   */
  getModules() {
    return Array.from(this.modules.values());
  }

  /**
   * Retourne un module spécifique
   * @param {string} name - Nom du module
   * @returns {Object|null} Le module ou null
   */
  getModule(name) {
    return this.modules.get(name) || null;
  }

  /**
   * Active ou désactive un module
   * @param {string} name - Nom du module
   * @param {boolean} enabled - État souhaité
   */
  setModuleEnabled(name, enabled) {
    const module = this.modules.get(name);
    if (module) {
      module.enabled = enabled;
      console.log(`${enabled ? '✅' : '❌'} Module ${name} ${enabled ? 'activé' : 'désactivé'}`);
    }
  }

  /**
   * Marque un module comme chargé
   * @param {string} name - Nom du module
   */
  setModuleLoaded(name) {
    const module = this.modules.get(name);
    if (module) {
      module.loaded = true;
    }
  }
}

const registry = new ModuleRegistry();
/** Racine du projet (répertoire parent de backend/) — pour modules dans modules/<nom>/backend */
registry.PROJECT_ROOT = PROJECT_ROOT;
/** Racine du backend GDRI */
registry.BACKEND_ROOT = BACKEND_ROOT;

module.exports = registry;

