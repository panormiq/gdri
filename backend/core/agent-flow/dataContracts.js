/**
 * Contrats de données du bloc Entrées.
 * Fichier : backend/core/agent-flow/dataContracts.js
 */

const path = require('path');
const fs = require('fs');

const CONTRACTS_PATH = path.join(__dirname, 'data-contracts.json');

let cached = null;
let cachedMtime = 0;

function loadDataContracts() {
  const stat = fs.statSync(CONTRACTS_PATH);
  if (cached && stat.mtimeMs === cachedMtime) return cached;
  cached = JSON.parse(fs.readFileSync(CONTRACTS_PATH, 'utf8'));
  cachedMtime = stat.mtimeMs;
  return cached;
}

function getConnectorContract(providerOrConnectorId) {
  const contracts = loadDataContracts();
  const key = String(providerOrConnectorId || '').toLowerCase();
  const map = contracts.connectors || {};
  if (map[key]) return map[key];
  return Object.values(map).find((c) => {
    return String(c.connectorId || '').toLowerCase() === key
      || String(c.provider || '').toLowerCase() === key;
  }) || null;
}

function kindsForIngest(providerOrConnectorId, ingest) {
  const contract = getConnectorContract(providerOrConnectorId);
  if (!contract) return [];
  const want = String(ingest || '').toLowerCase();
  return (contract.kinds || []).filter((k) => {
    const modes = Array.isArray(k.ingest) ? k.ingest : [];
    return !want || modes.includes(want);
  });
}

function envelopeFieldMatchesProvider(field, providerOrConnectorId) {
  const allowed = field && Array.isArray(field.connectors) ? field.connectors : [];
  if (!allowed.length) return true;
  const key = String(providerOrConnectorId || '').toLowerCase();
  if (!key) return false;
  const contract = getConnectorContract(key);
  const aliases = [key];
  if (contract) {
    aliases.push(String(contract.provider || '').toLowerCase());
    aliases.push(String(contract.connectorId || '').toLowerCase());
  }
  return allowed.some((item) => aliases.includes(String(item).toLowerCase()));
}

function fieldsForKinds(providerOrConnectorId, kindIds) {
  const contracts = loadDataContracts();
  const byKey = {};
  const contract = getConnectorContract(providerOrConnectorId);
  const selected = new Set((kindIds || []).map(String));
  const kinds = ((contract && contract.kinds) || []).filter((kind) => {
    if (selected.size && !selected.has(kind.id)) return false;
    return true;
  });
  const exclusive = kinds.length > 0 && kinds.every((k) => k && k.schemaExclusive);
  if (!exclusive) {
    (contracts.envelope && contracts.envelope.fields ? contracts.envelope.fields : []).forEach((f) => {
      if (f && f.key && envelopeFieldMatchesProvider(f, providerOrConnectorId)) {
        byKey[f.key] = f;
      }
    });
  }
  kinds.forEach((kind) => {
    (kind.fields || []).forEach((f) => {
      if (f && f.key) byKey[f.key] = f;
    });
  });
  return Object.values(byKey);
}

function defaultKinds(providerOrConnectorId, ingest) {
  return kindsForIngest(providerOrConnectorId, ingest).map((k) => k.id);
}

function messageMatchesKinds(message, kindIds) {
  const kinds = Array.isArray(kindIds) ? kindIds.map(String) : [];
  if (!kinds.length) return true;
  if (kinds.includes('email') || kinds.includes('message') || kinds.includes('payload') || kinds.includes('intentions')) return true;

  const rawType = String(
    (message && message.type) ||
    (message && message.resourceType) ||
    (message && message.metadata && message.metadata.type) ||
    ''
  ).toLowerCase();
  const webhookEvent = String(
    (message && message.webhookEvent) ||
    (message && message.metadata && message.metadata.webhookEvent) ||
    ''
  ).toLowerCase();

  const token = webhookEvent || rawType;
  if (!token) return true;
  if (token === 'comment' || token === 'comments' || token === 'commentaire') return kinds.includes('comments');
  if (token === 'post' || token === 'posts') return kinds.includes('posts');
  if (token === 'mp' || token === 'messaging' || token === 'message' || token === 'messages') return kinds.includes('messages');
  if (token === 'notification' || token === 'notifications') return kinds.includes('notifications');
  return kinds.includes(token);
}

module.exports = {
  loadDataContracts,
  getConnectorContract,
  kindsForIngest,
  fieldsForKinds,
  defaultKinds,
  messageMatchesKinds,
  envelopeFieldMatchesProvider
};
