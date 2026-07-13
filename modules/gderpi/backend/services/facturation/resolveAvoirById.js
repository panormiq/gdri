const normalizeAvoir = require('./normalizeAvoir');

function resolveAvoirById(facture, avoirId) {
  const id = String(avoirId || '').trim();
  if (!id) return null;

  const avoirs = (Array.isArray(facture?.avoirs) ? facture.avoirs : [])
    .map((a) => normalizeAvoir(a))
    .filter((a) => a.numero);

  const direct = avoirs.find((a) => String(a.id) === id);
  if (direct) return direct;

  return avoirs.find((a) => String(a.numero) === id) || null;
}

module.exports = resolveAvoirById;
