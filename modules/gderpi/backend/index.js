/**
 * FICHIER : modules/gderpi/backend/index.js
 * RÔLE : Point d'entrée du module GDERPI — init et exposition des routes Express.
 *
 * ENTRÉES : app Express, db Mongo (optionnel à l'init)
 * SORTIES : routes montées sur /api/gderpi
 *
 * DÉPEND DE : ./routes.js
 * NE PAS : logique métier ici
 *
 * APPELÉ PAR : backend/core/module-loader.js
 */

const routes = require('./routes');
const path = require('path');
const fs = require('fs');
const express = require('express');
const database = require(path.join(__dirname, '../../../backend/config/database'));

async function init(app) {
  console.log('  📦 Initialisation module GDERPI...');
  try {
    await database.getCollection('mail_module_requirements').updateOne(
      { module_name: 'gderpi', depends_on: 'mail' },
      {
        $set: {
          module_name: 'gderpi',
          depends_on: 'mail',
          updated_at: new Date()
        },
        $setOnInsert: { created_at: new Date() }
      },
      { upsert: true }
    );
  } catch (error) {
    console.warn('  ⚠️ Impossible de déclarer la dépendance mail pour GDERPI:', error.message);
  }
  const uploadRoot = path.join(__dirname, 'uploads');
  fs.mkdirSync(uploadRoot, { recursive: true });
  if (app && typeof app.use === 'function') {
    app.use('/uploads/gderpi', express.static(uploadRoot));
    console.log('  📂 GDERPI uploads statiques : /uploads/gderpi');
  }
}

function getRoutes() {
  return routes;
}

module.exports = {
  init,
  routes: getRoutes
};
