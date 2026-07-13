/**
 * Registre des connecteurs — découverte automatique des packages.
 * Fichier : backend/core/connectors/ConnectorRegistry.js
 */

const fs = require('fs');
const path = require('path');

const BACKEND_ROOT = path.resolve(__dirname, '../..');
const PROJECT_ROOT = path.resolve(BACKEND_ROOT, '..');

class ConnectorRegistry {
  constructor() {
    this.connectors = new Map();
    this.corePath = path.join(BACKEND_ROOT, 'connectors');
    this.externalPath = path.join(PROJECT_ROOT, 'connectors');
  }

  async discover() {
    this.scanPath(this.corePath, 'backend/connectors');
    this.scanPath(this.externalPath, 'connectors');
  }

  rediscover() {
    return this.discover();
  }

  scanPath(rootPath, sourceLabel) {
    if (!fs.existsSync(rootPath)) return;

    const entries = fs.readdirSync(rootPath);
    for (const entry of entries) {
      if (entry.startsWith('_')) continue;

      const connectorPath = path.join(rootPath, entry);
      if (!fs.statSync(connectorPath).isDirectory()) continue;

      const manifestPath = path.join(connectorPath, 'connector.json');
      const indexPath = path.join(connectorPath, 'index.js');
      if (!fs.existsSync(manifestPath) || !fs.existsSync(indexPath)) continue;

      try {
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
        const id = String(manifest.id || entry).trim();
        if (!id) continue;

        delete require.cache[require.resolve(indexPath)];
        const ConnectorClass = require(indexPath);
        const instance = typeof ConnectorClass === 'function'
          ? new ConnectorClass(manifest)
          : ConnectorClass;

        this.connectors.set(id, {
          id,
          path: connectorPath,
          manifest,
          instance,
          source: sourceLabel
        });

        console.log(`  🔌 Connecteur découvert : ${id} (${sourceLabel})`);
      } catch (error) {
        console.warn(`  ⚠️  Connecteur ${entry} ignoré : ${error.message}`);
      }
    }
  }

  /**
   * @returns {Object[]}
   */
  list() {
    return Array.from(this.connectors.values()).map((c) => ({
      id: c.id,
      name: c.manifest.name || c.id,
      version: c.manifest.version || '0.0.0',
      direction: c.manifest.direction || 'input',
      capabilities: c.manifest.capabilities || [],
      description: c.manifest.description || '',
      source: c.source
    }));
  }

  /**
   * @param {string} id
   * @returns {Object|null}
   */
  get(id) {
    return this.connectors.get(String(id)) || null;
  }

  getManifest(id) {
    const c = this.get(id);
    return c ? c.manifest : null;
  }

  getInstance(id) {
    const c = this.get(id);
    return c ? c.instance : null;
  }
}

module.exports = new ConnectorRegistry();
