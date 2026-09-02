/**
 * Mapping d’entrée d’un bloc : slot du contrat ← champ namespacé amont (ou valeur libre).
 * Fichier : backend/core/agent-flow/inputMapping.js
 */

const { normalizeNsPath } = require('./nodeNamespace');
const { formatScalar, looksLikeIntentionCatalogPath, looksLikeIntentionList, looksLikeMessageList } = require('./dataTable');
const { copyFromPath, readCopySource, valueFromCopySource } = require('./copyFrom');

function getMapping(config) {
  return config && config.mapping && typeof config.mapping === 'object' ? config.mapping : {};
}

function getLiterals(config) {
  return config && config.literals && typeof config.literals === 'object' ? config.literals : {};
}

function asString(value) {
  return formatScalar(value);
}

function isBlank(value) {
  if (value == null) return true;
  if (Array.isArray(value)) return !value.length;
  return String(value).trim() === '';
}

/**
 * @returns {{ mapped: boolean, value: * }}
 */
function resolveSlot(executor, config, slot, context) {
  const mapping = getMapping(config);
  const literals = getLiterals(config);
  const from = String(mapping[slot] || '').trim();
  const lit = literals[slot];

  if (from && from !== '__literal__') {
    const path = normalizeNsPath(from) || from;
    let val = executor.readContextField(context, path);
    if (isBlank(val) && executor.readComposeStoredValue) {
      val = executor.readComposeStoredValue(context, path);
    }
    if (looksLikeIntentionCatalogPath(slot) && !looksLikeIntentionList(val) && executor.readIntentionCatalog) {
      const catalog = executor.readIntentionCatalog(context);
      if (catalog && catalog.length && (isBlank(val) || looksLikeMessageList(val))) {
        val = catalog;
      }
    }
    return { mapped: true, value: val == null ? '' : val };
  }
  if (from === '__literal__' || (lit != null && String(lit).trim() !== '')) {
    const text = lit == null ? '' : String(lit);
    const rendered = executor.interpolateCompose
      ? executor.interpolateCompose(text, context)
      : executor.interpolateTemplate(text, context);
    return { mapped: true, value: rendered };
  }
  const copied = valueFromCopySource(readCopySource(executor, context, copyFromPath(config)), slot);
  if (copied !== undefined) return { mapped: true, value: copied };
  return { mapped: false, value: undefined };
}

function resolveSlotString(executor, config, slot, context) {
  const resolved = resolveSlot(executor, config, slot, context);
  if (!resolved.mapped) return undefined;
  return asString(resolved.value);
}

/** Mapping vide = pas mappé, pour laisser la place à config / routage / autre slot. */
function resolveSlotNonEmpty(executor, config, slot, context) {
  const resolved = resolveSlot(executor, config, slot, context);
  if (!resolved.mapped || isBlank(resolved.value)) return undefined;
  return asString(resolved.value).trim();
}

module.exports = {
  getMapping,
  getLiterals,
  asString,
  isBlank,
  resolveSlot,
  resolveSlotString,
  resolveSlotNonEmpty
};
