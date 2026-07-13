/**
 * Service de sauvegarde des bases MongoDB par entité.
 * Fichier : modules/data-backup/backend/services/BackupService.js
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { promisify } = require('util');
const { ObjectId } = require('mongodb');
const databaseAdmin = require('../../../../backend/config/database-admin');

const gzip = promisify(zlib.gzip);

const PLATFORM_CONFIG_ID = 'global';
const COL_PLATFORM = 'backup_platform_config';
const COL_ENTITY = 'backup_entity_config';
const COL_RUNS = 'backup_runs';

const DEFAULT_PLATFORM_CONFIG = {
  enabled: true,
  storagePath: null,
  defaultRetentionDays: 30,
  defaultSchedule: 'disabled',
  encryptBackups: false
};

const DEFAULT_ENTITY_CONFIG = {
  enabled: true,
  schedule: null,
  scope: 'full',
  collections: [],
  retentionDays: null
};

class BackupService {
  constructor(database) {
    this.database = database;
  }

  async init() {
    const db = await this.database.connect();
    await db.collection(COL_PLATFORM).createIndex({ _id: 1 });
    await db.collection(COL_ENTITY).createIndex({ entrepriseId: 1 }, { unique: true });
    await db.collection(COL_RUNS).createIndex({ entrepriseId: 1, startedAt: -1 });
    await db.collection(COL_RUNS).createIndex({ status: 1 });
    await this.ensureStorageRoot();
  }

  getProjectRoot() {
    return path.resolve(__dirname, '../../../..');
  }

  getDefaultStorageRoot() {
    const fromEnv = process.env.BACKUP_STORAGE_PATH;
    if (fromEnv && String(fromEnv).trim()) {
      return path.isAbsolute(fromEnv) ? fromEnv : path.join(this.getProjectRoot(), fromEnv);
    }
    return path.join(this.getProjectRoot(), 'backend', 'storage', 'backups');
  }

  async getPlatformConfig() {
    const col = this.database.getCollection(COL_PLATFORM);
    const doc = await col.findOne({ _id: PLATFORM_CONFIG_ID });
    if (!doc) {
      return { ...DEFAULT_PLATFORM_CONFIG, storagePath: this.getDefaultStorageRoot() };
    }
    return {
      ...DEFAULT_PLATFORM_CONFIG,
      ...doc,
      storagePath: doc.storagePath || this.getDefaultStorageRoot()
    };
  }

  async savePlatformConfig(patch = {}) {
    const col = this.database.getCollection(COL_PLATFORM);
    const current = await this.getPlatformConfig();
    const next = {
      ...current,
      ...patch,
      _id: PLATFORM_CONFIG_ID,
      updatedAt: new Date()
    };
    if (!next.createdAt) next.createdAt = new Date();
    await col.updateOne({ _id: PLATFORM_CONFIG_ID }, { $set: next }, { upsert: true });
    await this.ensureStorageRoot(next.storagePath);
    return this.getPlatformConfig();
  }

  async getEntityConfig(entrepriseId) {
    const col = this.database.getCollection(COL_ENTITY);
    const doc = await col.findOne({ entrepriseId: String(entrepriseId) });
    const platform = await this.getPlatformConfig();
    if (!doc) {
      return {
        entrepriseId: String(entrepriseId),
        ...DEFAULT_ENTITY_CONFIG,
        retentionDays: platform.defaultRetentionDays,
        schedule: platform.defaultSchedule
      };
    }
    return {
      entrepriseId: String(entrepriseId),
      ...DEFAULT_ENTITY_CONFIG,
      retentionDays: doc.retentionDays ?? platform.defaultRetentionDays,
      schedule: doc.schedule ?? platform.defaultSchedule,
      ...doc
    };
  }

  async saveEntityConfig(entrepriseId, patch = {}) {
    const col = this.database.getCollection(COL_ENTITY);
    const current = await this.getEntityConfig(entrepriseId);
    const next = {
      ...current,
      ...patch,
      entrepriseId: String(entrepriseId),
      updatedAt: new Date()
    };
    if (!next.createdAt) next.createdAt = new Date();
    await col.updateOne(
      { entrepriseId: String(entrepriseId) },
      { $set: next },
      { upsert: true }
    );
    return this.getEntityConfig(entrepriseId);
  }

  async ensureStorageRoot(customPath) {
    const platform = await this.getPlatformConfig();
    const root = customPath || platform.storagePath || this.getDefaultStorageRoot();
    await fs.promises.mkdir(root, { recursive: true });
    return root;
  }

  getDbName(entrepriseId) {
    return `GDR-ENTREPRISE-${entrepriseId}`;
  }

  async listEntityCollections(entrepriseId) {
    const adminClient = await databaseAdmin.getAdminClient();
    const db = adminClient.db(this.getDbName(entrepriseId));
    const collections = await db.listCollections().toArray();
    return collections.map((c) => c.name).sort();
  }

  resolveCollectionsToExport(allCollections, entityConfig) {
    if (entityConfig.scope === 'collections' && Array.isArray(entityConfig.collections) && entityConfig.collections.length > 0) {
      const wanted = new Set(entityConfig.collections.map(String));
      return allCollections.filter((name) => wanted.has(name));
    }
    return allCollections;
  }

  async runBackup(entrepriseId, options = {}) {
    const platform = await this.getPlatformConfig();
    if (!platform.enabled) {
      throw new Error('Le service de sauvegarde est désactivé au niveau plateforme');
    }

    const entityConfig = await this.getEntityConfig(entrepriseId);
    if (!entityConfig.enabled) {
      throw new Error('La sauvegarde est désactivée pour cette entité');
    }

    const storageRoot = await this.ensureStorageRoot();
    const runId = new ObjectId();
    const startedAt = new Date();
    const fileName = `backup-${entrepriseId}-${startedAt.toISOString().replace(/[:.]/g, '-')}.json.gz`;
    const relativeDir = path.join(String(entrepriseId), String(runId));
    const targetDir = path.join(storageRoot, relativeDir);
    const filePath = path.join(targetDir, fileName);

    const runsCol = this.database.getCollection(COL_RUNS);
    await runsCol.insertOne({
      _id: runId,
      entrepriseId: String(entrepriseId),
      status: 'running',
      trigger: options.trigger || 'manual',
      requestedBy: options.requestedBy || null,
      fileName,
      filePath,
      relativeDir,
      scope: entityConfig.scope,
      collections: entityConfig.collections || [],
      startedAt,
      completedAt: null,
      sizeBytes: 0,
      collectionCount: 0,
      documentCount: 0,
      error: null
    });

    try {
      await fs.promises.mkdir(targetDir, { recursive: true });

      const adminClient = await databaseAdmin.getAdminClient();
      const db = adminClient.db(this.getDbName(entrepriseId));
      const allCollections = await this.listEntityCollections(entrepriseId);
      const selected = this.resolveCollectionsToExport(allCollections, entityConfig);

      const payload = {
        version: 1,
        format: 'gdri-backup-json-v1',
        entrepriseId: String(entrepriseId),
        dbName: this.getDbName(entrepriseId),
        createdAt: startedAt.toISOString(),
        scope: entityConfig.scope,
        collections: {}
      };

      let documentCount = 0;
      for (const collectionName of selected) {
        const docs = await db.collection(collectionName).find({}).toArray();
        payload.collections[collectionName] = docs;
        documentCount += docs.length;
      }

      const compressed = await gzip(JSON.stringify(payload));
      await fs.promises.writeFile(filePath, compressed);

      const stat = await fs.promises.stat(filePath);
      const completedAt = new Date();

      await runsCol.updateOne(
        { _id: runId },
        {
          $set: {
            status: 'completed',
            completedAt,
            sizeBytes: stat.size,
            collectionCount: selected.length,
            documentCount
          }
        }
      );

      await this.applyRetention(entrepriseId);

      const run = await runsCol.findOne({ _id: runId });
      return run;
    } catch (error) {
      await runsCol.updateOne(
        { _id: runId },
        {
          $set: {
            status: 'failed',
            completedAt: new Date(),
            error: error.message
          }
        }
      );
      throw error;
    }
  }

  async listRuns({ entrepriseId = null, limit = 50 } = {}) {
    const col = this.database.getCollection(COL_RUNS);
    const filter = {};
    if (entrepriseId) filter.entrepriseId = String(entrepriseId);
    const runs = await col
      .find(filter)
      .sort({ startedAt: -1 })
      .limit(Math.min(Math.max(Number(limit) || 50, 1), 200))
      .toArray();
    return runs;
  }

  async getRunById(runId) {
    const col = this.database.getCollection(COL_RUNS);
    return col.findOne({ _id: new ObjectId(String(runId)) });
  }

  async deleteRun(runId) {
    const run = await this.getRunById(runId);
    if (!run) return false;

    if (run.filePath && fs.existsSync(run.filePath)) {
      await fs.promises.unlink(run.filePath).catch(() => {});
      const dir = path.dirname(run.filePath);
      const entries = await fs.promises.readdir(dir).catch(() => []);
      if (entries.length === 0) {
        await fs.promises.rmdir(dir).catch(() => {});
      }
    }

    const col = this.database.getCollection(COL_RUNS);
    await col.deleteOne({ _id: run._id });
    return true;
  }

  async applyRetention(entrepriseId) {
    const entityConfig = await this.getEntityConfig(entrepriseId);
    const retentionDays = Number(entityConfig.retentionDays) || 30;
    if (!Number.isFinite(retentionDays) || retentionDays < 1) return;

    const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
    const runs = await this.listRuns({ entrepriseId, limit: 500 });
    const oldRuns = runs.filter((r) => r.startedAt && new Date(r.startedAt) < cutoff);
    for (const run of oldRuns) {
      await this.deleteRun(run._id);
    }
  }

  async getPlatformOverview() {
    const db = await this.database.connect();
    const entities = await db.collection('entities').find({}).project({ _id: 1, name: 1 }).toArray();
    const runs = await this.listRuns({ limit: 500 });

    const lastByEntity = new Map();
    for (const run of runs) {
      const id = String(run.entrepriseId);
      if (!lastByEntity.has(id)) lastByEntity.set(id, run);
    }

    return entities.map((entity) => {
      const id = String(entity._id);
      const lastRun = lastByEntity.get(id) || null;
      return {
        entrepriseId: id,
        name: entity.name || id,
        lastRun: lastRun
          ? {
              id: String(lastRun._id),
              status: lastRun.status,
              startedAt: lastRun.startedAt,
              completedAt: lastRun.completedAt,
              sizeBytes: lastRun.sizeBytes || 0,
              documentCount: lastRun.documentCount || 0,
              error: lastRun.error || null
            }
          : null
      };
    });
  }

  formatBytes(bytes) {
    const n = Number(bytes) || 0;
    if (n < 1024) return `${n} o`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} Ko`;
    if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} Mo`;
    return `${(n / (1024 * 1024 * 1024)).toFixed(2)} Go`;
  }
}

module.exports = BackupService;
