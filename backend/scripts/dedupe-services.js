/**
 * Nettoie les doublons dans la collection services (GDRI).
 * Usage : node backend/scripts/dedupe-services.js [--apply]
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const database = require('../config/database');
const { dedupeServicesInDatabase } = require('../core/services-catalog-dedupe');

const apply = process.argv.includes('--apply');

(async () => {
  const db = await database.connect();
  const report = await dedupeServicesInDatabase({ dryRun: !apply, database: db });

  console.log(JSON.stringify(report, null, 2));

  if (!apply) {
    console.log('\nMode simulation. Relancez avec --apply pour appliquer le nettoyage.');
  } else {
    console.log('\nNettoyage appliqué.');
  }

  process.exit(0);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
