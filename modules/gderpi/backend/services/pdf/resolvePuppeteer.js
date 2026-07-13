/**
 * FICHIER : modules/gderpi/backend/services/pdf/resolvePuppeteer.js
 * RÔLE : Résout le module puppeteer (dépendance locale ou module GDRI existant).
 *
 * ENTRÉES : —
 * SORTIES : module puppeteer
 *
 * DÉPEND DE : puppeteer (optionnel, plusieurs emplacements)
 * NE PAS : lancer de navigateur ici
 *
 * APPELÉ PAR : htmlToPdfBuffer.js
 */

const path = require('path');

const CANDIDATE_PATHS = [
  'puppeteer',
  path.join(__dirname, '../../../../../backend/modules/doc-template/node_modules/puppeteer'),
  path.join(__dirname, '../../../../../backend/modules/agent-documentaire/node_modules/puppeteer')
];

function resolvePuppeteer() {
  let lastError = null;
  for (const candidate of CANDIDATE_PATHS) {
    try {
      return require(candidate);
    } catch (error) {
      lastError = error;
    }
  }
  const message = lastError?.message || 'module introuvable';
  throw new Error(
    'Puppeteer requis pour générer les PDF. Installez-le dans backend/modules/doc-template ou modules/gderpi/backend. (' + message + ')'
  );
}

module.exports = resolvePuppeteer;
