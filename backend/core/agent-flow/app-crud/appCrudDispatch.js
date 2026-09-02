/**
 * Dispatch CRUD d’app. Tant que wired=false, refuse l’exécution.
 * Les blocs (Entrées / Sortie / Action) appelleront ceci plus tard.
 * Fichier : backend/core/agent-flow/app-crud/appCrudDispatch.js
 */

const path = require('path');
const { getCollection, getByRef, parseRef } = require('./appCrudRegistry');

const PROJECT_ROOT = path.resolve(__dirname, '../../../..');

function resolveTarget(refOrParts) {
  if (!refOrParts) return null;
  if (typeof refOrParts === 'string') return getByRef(refOrParts);
  const appId = refOrParts.appId || parseRef(refOrParts.ref).appId;
  const collectionId = refOrParts.collectionId || parseRef(refOrParts.ref).collectionId;
  return getCollection(appId, collectionId);
}

function assertOp(col, op) {
  const want = String(op || '').toLowerCase();
  if (!col) throw new Error('Collection d’app introuvable');
  if (col.ops.indexOf(want) < 0) {
    throw new Error(`L’app ${col.appId} n’expose pas ${want} sur ${col.id}`);
  }
  if (!col.wired) {
    throw new Error(
      `CRUD ${col.ref} pas encore branché (wired=false). Voir AGENT-APP-CRUD.md.`
    );
  }
}

function loadService(col) {
  const rel = String(col.serviceRef || '').trim();
  if (!rel) {
    throw new Error(`CRUD ${col.ref} : serviceRef manquant`);
  }
  const abs = path.isAbsolute(rel) ? rel : path.resolve(PROJECT_ROOT, rel);
  return require(abs);
}

/**
 * @param {'read'|'create'|'update'} op
 * @param {string|{appId:string,collectionId:string,ref?:string}} target
 * @param {object} payload
 * @param {object} ctx { entrepriseId, context, executor, flow }
 */
async function runAppCrud(op, target, payload, ctx) {
  const col = resolveTarget(target);
  assertOp(col, op);
  const svc = loadService(col);
  const fn = typeof svc === 'function'
    ? svc
    : (svc[op] || svc.run || svc.default);
  if (typeof fn !== 'function') {
    throw new Error(`CRUD ${col.ref} : le service n’exporte pas ${op}`);
  }
  return fn(payload || {}, { ...ctx, collection: col, op: String(op).toLowerCase() });
}

module.exports = {
  runAppCrud,
  resolveTarget,
  assertOp
};
