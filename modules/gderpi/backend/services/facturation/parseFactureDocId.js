/**
 * Identifiant public facture : commandeClientId ou commandeClientId#factureId
 */

function parseFactureDocId(docId) {
  const raw = String(docId || '').trim();
  const idx = raw.indexOf('#');
  if (idx <= 0) return { commandeClientId: raw, factureId: null };
  return {
    commandeClientId: raw.slice(0, idx),
    factureId: raw.slice(idx + 1)
  };
}

function buildFactureDocId(commandeClientId, factureId) {
  const cmdId = String(commandeClientId || '').trim();
  const fId = String(factureId || '').trim();
  if (!fId) return cmdId;
  return cmdId + '#' + fId;
}

module.exports = { parseFactureDocId, buildFactureDocId };
