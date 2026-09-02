/**
 * Résolution des templates d'instance (instanceDefaults + presets).
 * Fichier : backend/core/connectors/instance-defaults.js
 */

function isPlainObject(value) {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function deepMerge(base = {}, override = {}) {
  const out = { ...base };
  for (const [key, value] of Object.entries(override || {})) {
    if (value === undefined) continue;
    if (isPlainObject(value) && isPlainObject(out[key])) {
      out[key] = deepMerge(out[key], value);
    } else {
      out[key] = value;
    }
  }
  return out;
}

/**
 * Extrait les valeurs par défaut du configSchema JSON Schema.
 * @param {Object|null} configSchema
 * @returns {Object}
 */
function getSchemaDefaults(configSchema) {
  const settings = {};
  const props = configSchema?.properties;
  if (!props || typeof props !== 'object') return settings;

  for (const [key, schema] of Object.entries(props)) {
    if (schema && schema.default !== undefined) {
      settings[key] = schema.default;
    }
  }
  return settings;
}

function getManifestSettingDefaults(manifest) {
  try {
    const { getSettingsFields, defaultsFromFields } = require('./connectorContract');
    const fromFields = defaultsFromFields(getSettingsFields(manifest));
    return { ...getSchemaDefaults(manifest?.configSchema), ...fromFields };
  } catch (_) {
    return getSchemaDefaults(manifest?.configSchema);
  }
}

/**
 * @param {Object|null} manifest
 * @param {string|null} presetId
 * @returns {Object|null}
 */
function resolvePreset(manifest, presetId = null) {
  if (!manifest) return null;

  const presets = Array.isArray(manifest.presets) ? manifest.presets : [];
  if (presetId) {
    const found = presets.find((p) => String(p.id) === String(presetId));
    if (found) return found;
  }

  if (manifest.instanceDefaults && typeof manifest.instanceDefaults === 'object') {
    return manifest.instanceDefaults;
  }

  return presets[0] || null;
}

/**
 * Liste les presets exposables à l'UI (sans secrets).
 * @param {Object|null} manifest
 * @returns {Object[]}
 */
function listPresets(manifest) {
  if (!manifest) return [];

  const presets = Array.isArray(manifest.presets) ? manifest.presets : [];
  if (presets.length) {
    return presets.map((preset) => ({
      id: preset.id,
      name: preset.name || preset.id,
      description: preset.description || '',
      ingestModes: preset.ingestModes || [],
      hasMapping: !!(preset.mapping && Object.keys(preset.mapping).length),
      hasEmitBody: !!(preset.emitBody || preset.settings?.emitBody)
    }));
  }

  if (manifest.instanceDefaults) {
    return [{
      id: 'default',
      name: manifest.name || manifest.id || 'Par défaut',
      description: 'Configuration par défaut du connecteur',
      ingestModes: manifest.instanceDefaults.ingestModes || [],
      hasMapping: !!(manifest.instanceDefaults.mapping && Object.keys(manifest.instanceDefaults.mapping).length),
      hasEmitBody: !!(manifest.instanceDefaults.emitBody || manifest.instanceDefaults.settings?.emitBody)
    }];
  }

  return [];
}

/**
 * Fusionne defaults manifeste + preset + payload utilisateur.
 * @param {Object|null} manifest
 * @param {Object} userPayload
 * @returns {Object}
 */
function buildInstancePayload(manifest, userPayload = {}) {
  const presetId = userPayload.presetId != null ? String(userPayload.presetId) : null;
  const preset = resolvePreset(manifest, presetId);
  const schemaDefaults = getManifestSettingDefaults(manifest);
  const instanceDefaults = manifest?.instanceDefaults || {};

  const mergedSettings = deepMerge(
    schemaDefaults,
    deepMerge(
      instanceDefaults.settings || {},
      deepMerge(
        preset?.settings || {},
        userPayload.settings || {}
      )
    )
  );

  if (preset?.emitBody && mergedSettings.emitBody == null) {
    mergedSettings.emitBody = preset.emitBody;
  }
  if (instanceDefaults.emitBody && mergedSettings.emitBody == null) {
    mergedSettings.emitBody = instanceDefaults.emitBody;
  }

  const mergedMapping = deepMerge(
    instanceDefaults.mapping || {},
    deepMerge(preset?.mapping || {}, userPayload.mapping || {})
  );

  const mergedCredentials = deepMerge(
    instanceDefaults.credentials || {},
    deepMerge(preset?.credentials || {}, userPayload.credentials || {})
  );

  let ingestModes = userPayload.ingestModes;
  if (!Array.isArray(ingestModes) || !ingestModes.length) {
    ingestModes = preset?.ingestModes || instanceDefaults.ingestModes;
  }
  if (!Array.isArray(ingestModes) || !ingestModes.length) {
    const caps = Array.isArray(manifest?.capabilities) ? manifest.capabilities : [];
    if (caps.includes('ingest.poll') && !caps.includes('ingest.push')) {
      ingestModes = ['poll'];
    } else if (caps.includes('ingest.push')) {
      ingestModes = ['push'];
    } else {
      ingestModes = [];
    }
  }

  const resolvedPresetId = preset?.id || (presetId && presetId !== 'default' ? presetId : null);

  return {
    connectorId: userPayload.connectorId,
    name: String(userPayload.name || preset?.name || manifest?.name || 'Connecteur').trim(),
    enabled: userPayload.enabled !== false,
    settings: mergedSettings,
    mapping: mergedMapping,
    ingestModes,
    credentials: mergedCredentials,
    cursor: userPayload.cursor && typeof userPayload.cursor === 'object' ? userPayload.cursor : null,
    presetId: resolvedPresetId
  };
}

/**
 * Template résolu pour préremplissage UI (GET template).
 * @param {Object|null} manifest
 * @param {string|null} presetId
 * @returns {Object}
 */
function resolveInstanceTemplate(manifest, presetId = null) {
  const payload = buildInstancePayload(manifest, {
    connectorId: manifest?.id,
    presetId: presetId || (listPresets(manifest)[0]?.id ?? null),
    name: ''
  });

  return {
    presetId: payload.presetId,
    ingestModes: payload.ingestModes,
    settings: payload.settings,
    mapping: payload.mapping,
    credentials: Object.keys(payload.credentials || {}).length ? payload.credentials : undefined
  };
}

module.exports = {
  deepMerge,
  getSchemaDefaults,
  resolvePreset,
  listPresets,
  buildInstancePayload,
  resolveInstanceTemplate
};
