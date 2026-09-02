/**
 * Contrat connecteur = collections de champs (réglages + payload).
 * Le métier (poll, emit, secrets) reste dans le package connecteur.
 * Fichier : backend/core/connectors/connectorContract.js
 */

const {
  catalog,
  normalizeFields,
  fieldsFromJsonSchema,
  jsonSchemaFromFields,
  defaultsFromFields
} = require('../collection-contract/collectionFields');
const { getConnectorContract } = require('../agent-flow/dataContracts');
const { providerFromConnectorId } = require('../agent-flow/channelFromConnector');

function getSettingsFields(manifest) {
  if (!manifest) return [];
  if (Array.isArray(manifest.settingsFields) && manifest.settingsFields.length) {
    return normalizeFields(manifest.settingsFields);
  }
  return fieldsFromJsonSchema(manifest.configSchema);
}

function kindToContract(kind) {
  if (!kind || typeof kind !== 'object') return null;
  return {
    id: String(kind.id || ''),
    label: String(kind.label || kind.id || ''),
    ingest: Array.isArray(kind.ingest) ? kind.ingest : [],
    fields: normalizeFields(kind.fields || [])
  };
}

function getPayloadContract(manifest) {
  if (!manifest) {
    return { kinds: [], fields: [] };
  }
  if (Array.isArray(manifest.payloadFields) && manifest.payloadFields.length) {
    const fields = normalizeFields(manifest.payloadFields);
    return {
      kinds: [{ id: 'payload', label: 'Payload', ingest: [], fields }],
      fields
    };
  }
  if (Array.isArray(manifest.payloadKinds) && manifest.payloadKinds.length) {
    const kinds = manifest.payloadKinds.map(kindToContract).filter((k) => k && k.id);
    const fields = [];
    const seen = {};
    kinds.forEach((kind) => {
      (kind.fields || []).forEach((f) => {
        if (!f.key || seen[f.key]) return;
        seen[f.key] = true;
        fields.push(f);
      });
    });
    return { kinds, fields };
  }

  const provider = providerFromConnectorId(manifest.id);
  const dataContract = getConnectorContract(manifest.id) || getConnectorContract(provider);
  const kinds = ((dataContract && dataContract.kinds) || []).map(kindToContract).filter((k) => k && k.id);
  const fields = [];
  const seen = {};
  kinds.forEach((kind) => {
    (kind.fields || []).forEach((f) => {
      if (!f.key || seen[f.key]) return;
      seen[f.key] = true;
      fields.push(f);
    });
  });
  return { kinds, fields };
}

function enrichManifest(manifest) {
  if (!manifest) return null;
  const settingsFields = getSettingsFields(manifest);
  const payload = getPayloadContract(manifest);
  return {
    ...manifest,
    settingsFields,
    payloadKinds: payload.kinds,
    payloadFields: payload.fields,
    configSchema: manifest.configSchema || jsonSchemaFromFields(settingsFields)
  };
}

function fieldCatalog() {
  return catalog();
}

module.exports = {
  getSettingsFields,
  getPayloadContract,
  enrichManifest,
  fieldCatalog,
  defaultsFromFields
};
