/**
 * Registre des briques flow — familles génériques.
 * Fichier : backend/core/agent-flow/FlowBrickRegistry.js
 *
 * Découvre uniquement :
 * - backend/core/agent-flow/bricks/<family>/flow-node.json
 */

const fs = require('fs');
const path = require('path');

const CORE_BRICKS_ROOT = path.join(__dirname, 'bricks');

const FAMILY_ORDER = ['trigger', 'data', 'condition', 'loop', 'action', 'ia', 'validation', 'output'];

class FlowBrickRegistry {
  constructor() {
    this.bricks = new Map();
  }

  discover() {
    this.bricks.clear();
    this.discoverCoreBricks();
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

  registerFromFile(manifestPath, basePath) {
    try {
      const raw = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      if (!raw.id) return;
      const brick = {
        ...raw,
        family: raw.family || raw.id,
        origin: 'core',
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
   * @param {{ kind?: string, category?: string, family?: string }} filters
   */
  list(filters = {}) {
    let items = Array.from(this.bricks.values());
    if (filters.kind) {
      items = items.filter((b) => b.kind === filters.kind);
    }
    if (filters.category) {
      items = items.filter((b) => b.category === filters.category);
    }
    if (filters.family) {
      items = items.filter((b) => b.family === filters.family);
    }
    if (filters.orchestratorOnly !== false) {
      items = items.filter((b) => b.visibility !== 'hidden');
    }
    items.sort((a, b) => {
      const ia = FAMILY_ORDER.indexOf(a.family || a.id);
      const ib = FAMILY_ORDER.indexOf(b.family || b.id);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    });
    return items.map((b) => this.serialize(b));
  }

  listTriggers() {
    return this.list({ kind: 'trigger' });
  }

  listActions() {
    return this.list({ kind: 'action' });
  }

  listFamilies() {
    return FAMILY_ORDER.filter((id) => this.bricks.has(id)).map((id) => this.serialize(this.bricks.get(id)));
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
