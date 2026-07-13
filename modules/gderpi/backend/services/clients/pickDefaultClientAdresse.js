/**
 * FICHIER : modules/gderpi/backend/services/clients/pickDefaultClientAdresse.js
 * RÔLE : Choisit l'adresse client par défaut pour une livraison.
 */

function hasAddressContent(addr) {
  const a = addr && typeof addr === 'object' ? addr : {};
  return Boolean(a.adresse || a.complement || a.codePostal || a.ville || a.libelle);
}

function buildClientAdressesList(client) {
  if (!client) return [];
  const out = [];
  const seen = new Set();

  function push(addr, fallbackType) {
    const a = {
      type: fallbackType || 'autre',
      ...(addr && typeof addr === 'object' ? addr : {})
    };
    if (!hasAddressContent(a)) return;
    const key = [
      a.type,
      a.id || a.adresseId || '',
      a.libelle,
      a.adresse,
      a.complement,
      a.codePostal,
      a.ville
    ].join('|');
    if (seen.has(key)) return;
    seen.add(key);
    out.push(a);
  }

  if (Array.isArray(client.adresses) && client.adresses.length) {
    client.adresses.forEach((a) => push(a));
    return out;
  }

  push(client.adresseFacturation, 'facturation');
  if (client.livraisonIdentiqueFacturation === false) {
    push(client.adresseLivraison, 'livraison');
  }
  if (!out.length) {
    push({
      adresse: client.adresse,
      complement: client.adresseComplement,
      codePostal: client.codePostal,
      ville: client.ville,
      pays: client.pays
    }, 'generique');
  }
  return out;
}

function pickDefaultClientAdresse(client) {
  const adresses = buildClientAdressesList(client);
  const pick = (type) => adresses.find((a) => a.type === type);
  return pick('livraison') || pick('generique') || pick('facturation') || adresses[0] || null;
}

module.exports = pickDefaultClientAdresse;
module.exports.buildClientAdressesList = buildClientAdressesList;
module.exports.hasAddressContent = hasAddressContent;
