/**
 * Contrats d’entrée versionnés des blocs agent.
 * Un template se lie à { brickId, version } et remplit les champs de ce contrat.
 */

function asFields(list) {
  return (Array.isArray(list) ? list : []).map((f) => ({
    key: String((f && (f.key || f.id)) || '').trim(),
    label: String((f && (f.label || f.key)) || ''),
    required: !!(f && f.required),
    description: String((f && f.description) || ''),
    type: String((f && f.type) || 'textarea'),
    advanced: !!(f && f.advanced),
    overlay: f && f.overlay === false ? false : true
  })).filter((f) => f.key);
}

function outputFieldsOf(brick) {
  if (!brick || typeof brick !== 'object') return [];
  const oc = brick.outputContract && typeof brick.outputContract === 'object'
    ? brick.outputContract
    : {};
  if (Array.isArray(oc.fields) && oc.fields.length) return asFields(oc.fields);
  const ops = brick.operations && typeof brick.operations === 'object' ? brick.operations : {};
  const first = Object.keys(ops).map((k) => ops[k]).find((op) => op && op.outputMessage && Array.isArray(op.outputMessage.fields));
  return asFields(first && first.outputMessage && first.outputMessage.fields);
}

function inputContractOf(brick) {
  if (!brick || typeof brick !== 'object') return null;
  const ic = brick.inputContract && typeof brick.inputContract === 'object'
    ? brick.inputContract
    : {};
  const oc = brick.outputContract && typeof brick.outputContract === 'object'
    ? brick.outputContract
    : {};
  return {
    brickId: String(brick.id || ''),
    name: String(brick.name || brick.id || ''),
    brickVersion: String(brick.version || '1.0.0'),
    version: String(ic.version || brick.version || '1.0.0'),
    fields: asFields(ic.fields),
    output: {
      version: String(oc.version || '1.0.0'),
      fields: outputFieldsOf(brick)
    }
  };
}

function listBlockInputContracts(registry) {
  const items = registry && typeof registry.list === 'function' ? registry.list() : [];
  return items.map(inputContractOf).filter((c) => c && c.brickId && c.fields.length);
}

function getBlockInputContract(registry, brickId) {
  const id = String(brickId || '').trim();
  if (!id || !registry || typeof registry.get !== 'function') return null;
  return inputContractOf(registry.get(id));
}

module.exports = {
  asFields,
  outputFieldsOf,
  inputContractOf,
  listBlockInputContracts,
  getBlockInputContract
};
