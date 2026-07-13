/**
 * Identifiant public avoir : commandeClientId#factureId#avoirId
 */

function parseAvoirDocId(docId) {
  const raw = String(docId || '').trim();
  const parts = raw.split('#');
  if (parts.length >= 3) {
    return {
      commandeClientId: parts[0],
      factureId: parts[1],
      avoirId: parts.slice(2).join('#')
    };
  }
  return { commandeClientId: raw, factureId: null, avoirId: null };
}

function buildAvoirDocId(commandeClientId, factureId, avoirId) {
  const cmdId = String(commandeClientId || '').trim();
  const fId = String(factureId || '').trim();
  const aId = String(avoirId || '').trim();
  if (!fId || !aId) return cmdId;
  return cmdId + '#' + fId + '#' + aId;
}

module.exports = { parseAvoirDocId, buildAvoirDocId };
