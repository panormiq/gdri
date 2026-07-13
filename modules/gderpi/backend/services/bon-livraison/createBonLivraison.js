const crypto = require('crypto');
const getCommandeClientById = require('../commande-client/getCommandeClientById');
const normalizeDevisLine = require('../devis/normalizeDevisLine');
const calculateDevisTotals = require('../devis/calculateDevisTotals');
const nextSequenceNumber = require('../sequences/nextSequenceNumber');
const { commandeClientKind } = require('../workflow/commandeClientKind');
const remainingLineQty = require('../workflow/remainingLineQty');
const resolveQuantiteLivrable = require('../workflow/resolveQuantiteLivrable');
const maybeMarkCommandeLivree = require('../workflow/maybeMarkCommandeLivree');
const applyQuantiteLivree = require('../commande-client/applyQuantiteLivree');
const isCommandeEligibleBonLivraison = require('../workflow/isCommandeEligibleBonLivraison');
const getClientById = require('../clients/getClientById');
const resolveClientAdresseLivraison = require('../clients/resolveClientAdresseLivraison');
const { buildClientAdressesList } = require('../clients/pickDefaultClientAdresse');
const formatPostalAddress = require('../pdf/formatPostalAddress');
const resolveBlContact = require('./resolveBlContact');
const toBonLivraisonEntry = require('./toBonLivraisonEntry');
const { COLLECTION, ensureIndexes } = require('./bonLivraisonCollection');

function productLinesForBl(commande) {
  const lignes = Array.isArray(commande?.lignes) ? commande.lignes : [];
  const kind = commandeClientKind(commande);

  function isProductLine(line) {
    return String(line?.articleType || '').toLowerCase() === 'produit';
  }

  let candidates = [];
  if (kind === 'produit' || kind === 'mixte') {
    const filtered = lignes.filter(isProductLine);
    if (filtered.length) candidates = filtered;
  }
  if (!candidates.length) {
    candidates = lignes.filter((l) => {
      const t = String(l.articleType || '').toLowerCase();
      return t !== 'developpement' && t !== 'service';
    });
  }
  if (!candidates.length) candidates = lignes;

  return candidates.filter((l) => remainingLineQty(l) > 0);
}

function buildLineLookup(remaining) {
  const byId = new Map();
  remaining.forEach((line, index) => {
    const keys = [
      line.id,
      line.lineId,
      line.sourceDevisLineId,
      line.devisLineId,
      line._id != null ? String(line._id) : ''
    ].map((key) => String(key || '').trim()).filter(Boolean);
    keys.forEach((key) => {
      if (!byId.has(key)) byId.set(key, line);
    });
    const ordreKey = String(Number.isFinite(Number(line.ordre)) ? Number(line.ordre) : index);
    if (!byId.has(`ordre:${ordreKey}`)) byId.set(`ordre:${ordreKey}`, line);
    if (!byId.has(`index:${index}`)) byId.set(`index:${index}`, line);
  });
  return byId;
}

function findSourceLine(remaining, raw, byId, payloadIndex) {
  const lineId = String(raw.id || raw.lineId || '').trim();
  if (lineId && byId.has(lineId)) return byId.get(lineId);

  const sourceDevisLineId = String(raw.sourceDevisLineId || raw.devisLineId || '').trim();
  if (sourceDevisLineId && byId.has(sourceDevisLineId)) return byId.get(sourceDevisLineId);

  const blIndex = Number(raw.blIndex);
  if (Number.isFinite(blIndex) && byId.has(`index:${blIndex}`)) return byId.get(`index:${blIndex}`);

  const ref = String(raw.reference || '').trim();
  const lib = String(raw.libelle || '').trim();
  if (ref && lib) {
    const byRef = remaining.find((l) => l.reference === ref && l.libelle === lib);
    if (byRef) return byRef;
  }
  if (ref) {
    const matches = remaining.filter((l) => l.reference === ref);
    if (matches.length === 1) return matches[0];
  }
  if (lib) {
    const matches = remaining.filter((l) => l.libelle === lib);
    if (matches.length === 1) return matches[0];
  }

  const articleId = String(raw.articleId || '').trim();
  if (articleId) {
    const matches = remaining.filter((l) => String(l.articleId || '').trim() === articleId);
    if (matches.length === 1) return matches[0];
    if (matches.length > 1 && (ref || lib)) {
      return matches.find((l) => l.reference === ref || l.libelle === lib) || matches[0];
    }
  }

  const ordre = Number(raw.ordre);
  if (Number.isFinite(ordre) && byId.has(`ordre:${ordre}`)) return byId.get(`ordre:${ordre}`);

  if (Number.isFinite(payloadIndex) && byId.has(`index:${payloadIndex}`)) {
    return byId.get(`index:${payloadIndex}`);
  }

  return null;
}

function buildBlLignes(commande, payloadLignes, mode, options = {}) {
  const remaining = productLinesForBl(commande);
  const forceDepassement = options.forceDepassement === true;
  const hasPayloadLines = Array.isArray(payloadLignes) && payloadLignes.some((raw) => Number(raw?.quantite) > 0);

  if (!remaining.length && !hasPayloadLines) {
    throw new Error('Aucune ligne produit restante à livrer');
  }

  if (mode === 'complet' || !hasPayloadLines) {
    if (!remaining.length) {
      throw new Error('Aucune quantité disponible à livrer — vérifiez la réception fournisseur');
    }
    return remaining.map((l) => normalizeDevisLine({
      ...l,
      quantite: resolveQuantiteLivrable(l, commande)
    }, l.ordre)).filter((l) => Number(l.quantite) > 0);
  }

  const byId = buildLineLookup(remaining);
  const lignes = [];
  payloadLignes.forEach((raw, i) => {
    const qty = Number(raw.quantite) || 0;
    if (qty <= 0) return;
    const lineId = String(raw.id || raw.lineId || '').trim();
    const source = findSourceLine(remaining, raw, byId, i);
    if (!source) {
      throw new Error('Ligne produit introuvable : ' + (raw.libelle || raw.reference || lineId || (i + 1)));
    }
    const resteMax = remainingLineQty(source);
    if (qty > resteMax + 0.0001) {
      throw new Error('Quantité livrée supérieure au reste commandé pour « ' + (source.libelle || source.reference) + ' »');
    }
    const dispoMax = resolveQuantiteLivrable(source, commande);
    if (!forceDepassement && qty > dispoMax + 0.0001) {
      throw new Error('Quantité supérieure au disponible (reçu fournisseur) pour « ' + (source.libelle || source.reference) + ' » — max ' + dispoMax);
    }
    lignes.push({
      ...normalizeDevisLine({ ...source, quantite: qty }, source.ordre ?? i),
      blIndex: i
    });
  });
  if (!lignes.length) throw new Error('Indiquez au moins une quantité à livrer');
  return lignes;
}

async function createBonLivraison(db, entrepriseId, commandeClientId, payload = {}) {
  const commande = await getCommandeClientById(db, entrepriseId, commandeClientId, { skipPipelineRepair: true });
  if (!commande) throw new Error('Commande client introuvable');
  if (!isCommandeEligibleBonLivraison(commande)) {
    throw new Error('Le bon de livraison n\'est disponible qu\'une fois la commande prête à livrer');
  }

  const kind = commandeClientKind(commande);
  if (kind === 'dev') {
    throw new Error('Cette commande ne contient que du développement — utilisez la livraison prestation');
  }

  const p = payload && typeof payload === 'object' ? payload : {};
  const mode = String(p.mode || '').trim().toLowerCase();
  const forceDepassement = p.forceDepassement === true || String(p.forceDepassement).toLowerCase() === 'true';
  const lignes = buildBlLignes(commande, p.lignes, mode, { forceDepassement });
  if (!lignes.length) {
    throw new Error('Aucune quantité disponible à livrer — vérifiez la réception fournisseur');
  }

  let adresseLivraison = String(p.adresseLivraison || '').trim();
  let client = null;
  if (commande.clientId) {
    client = await getClientById(db, entrepriseId, commande.clientId);
  }
  if (!adresseLivraison && client) {
    const adresseId = String(p.adresseClientId || '').trim();
    if (adresseId) {
      const adresses = buildClientAdressesList(client);
      const match = adresses.find((a, i) => String(a.id || a.adresseId || ('idx-' + i)) === adresseId);
      if (match) adresseLivraison = formatPostalAddress(match).join('\n');
    }
    if (!adresseLivraison) {
      adresseLivraison = resolveClientAdresseLivraison(client);
    }
  }

  const contact = await resolveBlContact(db, entrepriseId, p, commande, client);

  await ensureIndexes(db);
  const bonLivraisonId = crypto.randomUUID();
  const numero = await nextSequenceNumber(db, entrepriseId, commande.boutiqueId, 'bon_livraison');
  const now = new Date();
  const totaux = calculateDevisTotals(lignes);

  const doc = {
    entrepriseId: String(entrepriseId),
    bonLivraisonId,
    commandeClientId: commande.id,
    commandeClientNumero: commande.numero,
    boutiqueId: commande.boutiqueId,
    clientId: commande.clientId,
    devisId: commande.devisId,
    devisNumero: commande.devisNumero,
    numero,
    objet: p.objet !== undefined ? String(p.objet || '').trim() : commande.objet,
    notes: p.notes !== undefined ? String(p.notes || '').trim() : '',
    referenceClient: commande.referenceClient,
    documentClient: commande.documentClient || '',
    adresseLivraison,
    contactClientId: contact.contactClientId || null,
    contactNom: contact.contactNom,
    contactFonction: contact.contactFonction,
    contactEmail: contact.contactEmail,
    contactTelephone: contact.contactTelephone,
    lignes,
    totaux,
    dateLivraison: now,
    createdAt: now,
    updatedAt: now
  };

  const updatedLignes = applyQuantiteLivree(commande.lignes, lignes);

  await db.collection(COLLECTION).insertOne(doc);
  await db.collection('gderpi_commandes_client').updateOne(
    { entrepriseId: String(entrepriseId), commandeClientId: String(commandeClientId).trim() },
    {
      $set: {
        bonLivraisonId,
        bonLivraisonNumero: numero,
        lignes: updatedLignes,
        updatedAt: now
      }
    }
  );
  await maybeMarkCommandeLivree(db, entrepriseId, commandeClientId);
  return toBonLivraisonEntry(doc);
}

module.exports = createBonLivraison;
