/**
 * Registre des briques flow (orchestrateur type n8n).
 * Fichier : backend/core/agent-flow/FlowBrickRegistry.js
 *
 * Découvre :
 * - backend/core/agent-flow/bricks/<id>/flow-node.json  (briques core, ex. triggers)
 * - modules/<module>/flow-node.json                     (briques modules, ex. data-backup)
 * - connectors/<id>/flow-node.json                      (briques connecteurs sortants)
 */

const fs = require('fs');
const path = require('path');

const BACKEND_ROOT = path.resolve(__dirname, '../..');
const PROJECT_ROOT = path.resolve(BACKEND_ROOT, '..');
const CORE_BRICKS_ROOT = path.join(__dirname, 'bricks');
const MODULES_ROOT = path.join(PROJECT_ROOT, 'modules');
const CONNECTORS_ROOT = path.join(PROJECT_ROOT, 'connectors');

class FlowBrickRegistry {
  constructor() {
    this.bricks = new Map();
  }

  discover() {
    this.bricks.clear();
    this.discoverCoreBricks();
    this.discoverModuleBricks();
    this.discoverConnectorBricks();
    return this.list();
  }

  discoverCoreBricks() {
    if (!fs.existsSync(CORE_BRICKS_ROOT)) return;
    const dirs = fs.readdirSync(CORE_BRICKS_ROOT);
    for (const dir of dirs) {
      const manifestPath = path.join(CORE_BRICKS_ROOT, dir, 'flow-node.json');
      if (!fs.existsSync(manifestPath)) continue;
      this.registerFromFile(manifestPath, path.join(CORE_BRICKS_ROOT, dir));
    }
  }

  discoverModuleBricks() {
    if (!fs.existsSync(MODULES_ROOT)) return;
    const modules = fs.readdirSync(MODULES_ROOT);
    for (const moduleName of modules) {
      const manifestPath = path.join(MODULES_ROOT, moduleName, 'flow-node.json');
      if (!fs.existsSync(manifestPath)) continue;
      this.registerFromFile(manifestPath, path.join(MODULES_ROOT, moduleName));
    }
  }

  discoverConnectorBricks() {
    if (!fs.existsSync(CONNECTORS_ROOT)) return;
    const connectors = fs.readdirSync(CONNECTORS_ROOT);
    for (const connectorId of connectors) {
      if (connectorId.startsWith('_')) continue;
      const manifestPath = path.join(CONNECTORS_ROOT, connectorId, 'flow-node.json');
      if (!fs.existsSync(manifestPath)) continue;
      this.registerFromFile(manifestPath, path.join(CONNECTORS_ROOT, connectorId));
    }
  }

  resolveOrigin(basePath) {
    const normalized = path.resolve(basePath);
    if (normalized.startsWith(path.resolve(CONNECTORS_ROOT) + path.sep)
      || normalized === path.resolve(CONNECTORS_ROOT)) {
      return 'connector';
    }
    if (normalized.startsWith(path.resolve(MODULES_ROOT) + path.sep)
      || normalized === path.resolve(MODULES_ROOT)) {
      return 'module';
    }
    return 'core';
  }

  registerFromFile(manifestPath, basePath) {
    try {
      const raw = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      if (!raw.id) return;
      const brick = {
        ...raw,
        origin: raw.origin || this.resolveOrigin(basePath),
        _basePath: basePath,
        _manifestPath: manifestPath
      };
      if (brick.canvas && brick.canvas.icon && !brick.canvas.icon.startsWith('http')) {
        brick.canvas.iconUrl = `/api/agent-flows/bricks/${brick.id}/icon`;
      }
      this.bricks.set(brick.id, brick);
    } catch (error) {
      console.warn(`  ⚠️ Brique flow ignorée (${manifestPath}):`, error.message);
    }
  }

  get(id) {
    return this.bricks.get(id) || null;
  }

  /**
   * Briques visibles dans l'orchestrateur uniquement.
   * @param {{ kind?: string, category?: string }} filters
   */
  list(filters = {}) {
    let items = Array.from(this.bricks.values());
    if (filters.kind) {
      items = items.filter((b) => b.kind === filters.kind);
    }
    if (filters.category) {
      items = items.filter((b) => b.category === filters.category);
    }
    if (filters.orchestratorOnly !== false) {
      items = items.filter((b) => b.visibility !== 'hidden');
    }
    return items.map((b) => this.serialize(b));
  }

  listTriggers() {
    return this.list({ kind: 'trigger' });
  }

  listActions() {
    return this.list({ kind: 'action' });
  }

  serialize(brick) {
    const { _basePath, _manifestPath, ...publicBrick } = brick;
    return publicBrick;
  }

  resolveIconPath(brickId) {
    const brick = this.get(brickId);
    if (!brick) return null;
    const iconFile = brick.canvas && brick.canvas.icon ? brick.canvas.icon : 'flow-node.svg';
    const iconPath = path.join(brick._basePath, iconFile);
    if (!fs.existsSync(iconPath)) {
      const fallback = path.join(brick._basePath, 'assets', iconFile);
      return fs.existsSync(fallback) ? fallback : null;
    }
    return iconPath;
  }
}

module.exports = new FlowBrickRegistry();
