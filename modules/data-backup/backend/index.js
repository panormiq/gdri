/**
 * Module data-backup — export des bases client MongoDB.
 * Fichier : modules/data-backup/backend/index.js
 */

const path = require('path');
const BackupService = require('./services/BackupService');

let backupServiceInstance = null;

async function init(app, db) {
  console.log('  💾 Initialisation module data-backup...');
  if (!backupServiceInstance) {
    backupServiceInstance = new BackupService(db);
    await backupServiceInstance.init();
  }
  console.log('  ✅ Module data-backup prêt');
}

function getBackupService() {
  if (!backupServiceInstance) {
    const database = require(path.join(__dirname, '../../../backend/config/database'));
    backupServiceInstance = new BackupService(database);
  }
  return backupServiceInstance;
}

function getRoutes() {
  return require('./routes');
}

module.exports = {
  init,
  routes: getRoutes,
  getBackupService,
  service: getBackupService
};
