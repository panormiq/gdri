/**
 * Registre des modules - Gestion et découverte automatique
 * Fichier : backend/core/module-registry.js
 * 
 * Classe : ModuleRegistry - Gère l'enregistrement et la découverte des modules
 */

const fs = require('fs');
const path = require('path');

class ModuleRegistry {
  constructor() {
    this.modules = new Map();
    this.modulesPath = path.join(__dirname, '../modules');
  }

  /**
   * Découvre et enregistre tous les modules disponibles
   * @returns {Promise<void>}
   */
  async discoverModules() {
    if (!fs.existsSync(this.modulesPath)) {
      console.log('⚠️  Aucun dossier modules trouvé');
      return;
    }

    const modules = fs.readdirSync(this.modulesPath);

    for (const moduleName of modules) {
      const modulePath = path.join(this.modulesPath, moduleName);
      const packagePath = path.join(modulePath, 'package.json');

      // Vérifier que c'est un dossier et qu'il contient un package.json
      if (fs.statSync(modulePath).isDirectory() && fs.existsSync(packagePath)) {
        try {
          const config = require(packagePath);
          
          this.modules.set(moduleName, {
            name: moduleName,
            ...config,
            path: modulePath,
            enabled: true, // Par défaut activé
            loaded: false
          });
          
          console.log(`📦 Module découvert : ${config.displayName || moduleName}`);
        } catch (error) {
          console.error(`❌ Erreur lors du chargement du module ${moduleName} :`, error.message);
        }
      }
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

module.exports = new ModuleRegistry();

