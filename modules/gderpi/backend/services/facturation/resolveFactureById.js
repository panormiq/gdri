const resolveCommandeFactures = require('./resolveCommandeFactures');
const normalizeFacture = require('./normalizeFacture');
const { parseFactureDocId } = require('./parseFactureDocId');

function matchFactureId(factures, id) {
  if (!id) return null;
  const direct = factures.find((f) => String(f.id) === id);
  if (direct) return direct;

  const { factureId: parsedSub } = parseFactureDocId(id);
  if (parsedSub) {
    const bySub = factures.find((f) => String(f.id) === parsedSub);
    if (bySub) return bySub;
    const byNumero = factures.find((f) => String(f.numero) === parsedSub);
    if (byNumero) return byNumero;
  }

  const byNumero = factures.find((f) => String(f.numero) === id);
  if (byNumero) return byNumero;

  return null;
}

function resolveFactureById(commande, factureId) {
  const id = String(factureId || '').trim();
  const commandeClientId = String(commande?.id || commande?.commandeClientId || '').trim();
  const factures = resolveCommandeFactures(commande);

  if (!id) return factures[factures.length - 1] || null;

  const hit = matchFactureId(factures, id);
  if (hit) return hit;

  if (id === commandeClientId && factures.length === 1) {
    return factures[0];
  }

  return null;
}

async function resolveFactureForSend(db, entrepriseId, commandeClientId, commande, factureId) {
  const id = String(factureId || '').trim();
  const cmdId = String(commandeClientId || commande?.id || commande?.commandeClientId || '').trim();

  let hit = resolveFactureById(commande, id);
  if (hit) return hit;

  if (!db || !cmdId) return null;

  const raw = await db.collection('gderpi_commandes_client').findOne({
    entrepriseId: String(entrepriseId),
    commandeClientId: cmdId
  });
  if (!raw) return null;

  const rawFactures = Array.isArray(raw.factures) ? raw.factures : [];
  if (rawFactures.length) {
    const normalized = rawFactures
      .map((f) => normalizeFacture(f, cmdId))
      .filter((f) => f.numero);
    hit = matchFactureId(normalized, id);
    if (hit) return hit;
    if (!id) return normalized[normalized.length - 1] || null;
    if (normalized.length === 1) return normalized[0];
  }

  if (!rawFactures.length && raw.factureNumero) {
    return resolveFactureById({ ...raw, id: cmdId, commandeClientId: cmdId }, id);
  }

  return null;
}

module.exports = resolveFactureById;
module.exports.resolveFactureForSend = resolveFactureForSend;
