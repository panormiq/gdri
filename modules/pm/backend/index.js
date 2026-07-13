/**
 * FICHIER : modules/pm/backend/index.js
 * RÔLE : Point d'entrée du module PM — init et routes Express.
 *
 * ENTRÉES : app Express
 * SORTIES : routes montées sur /api/pm
 *
 * DÉPEND DE : ./routes.js
 * NE PAS : logique métier ici
 *
 * APPELÉ PAR : backend/core/module-loader.js
 */

const routes = require('./routes');
const path = require('path');
const database = require(path.join(__dirname, '../../../backend/config/database'));

async function init(app) {
  console.log('  📋 Initialisation module PM...');
  try {
    await database.getCollection('mail_module_requirements').updateOne(
      { module_name: 'pm', depends_on: 'mail' },
      {
        $set: {
          module_name: 'pm',
          depends_on: 'mail',
          updated_at: new Date()
        },
        $setOnInsert: { created_at: new Date() }
      },
      { upsert: true }
    );
  } catch (error) {
    console.warn('  ⚠️ Impossible de déclarer la dépendance mail pour PM:', error.message);
  }
  if (app) {
    console.log('  📋 PM prêt — compatibilité GDERPI optionnelle');
  }
}

function getRoutes() {
  return routes;
}

module.exports = {
  init,
  routes: getRoutes
};
