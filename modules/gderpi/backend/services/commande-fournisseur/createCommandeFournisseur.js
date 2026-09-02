/**
 * FICHIER : modules/gderpi/backend/services/commande-fournisseur/createCommandeFournisseur.js
 * RÔLE : Crée une commande fournisseur autonome (réappro stock ou achat manuel).
 *
 * ENTRÉES : db, entrepriseId, payload { boutiqueId, fournisseurId|fournisseurBoutiqueId, lignes, objet, notes, origine }
 * SORTIES : CommandeFournisseur créée
 *
 * DÉPEND DE : ensureCommandeFournisseurIndexes.js, normalizeDevisLine.js, calculateDevisTotals.js, nextSequenceNumber.js, toCommandeFournisseurEntry.js, getArticleById.js
 * NE PAS : génération depuis commande client
 *
 * APPELÉ PAR : workflowController
 */

const crypto = require('crypto');
const ensureCommandeFournisseurIndexes = require('./ensureCommandeFournisseurIndexes');
const normalizeDevisLine = require('../devis/normalizeDevisLine');
const calculateDevisTotals = require('../devis/calculateDevisTotals');
const nextSequenceNumber = require('../sequences/nextSequenceNumber');
const toCommandeFournisseurEntry = require('./toCommandeFournisseurEntry');
const getArticleById = require('../articles/getArticleById');

const COLLECTION = 'gderpi_commandes_fournisseur';

async function createCommandeFournisseur(db, entrepriseId, data) {
  const p = data && typeof data === 'object' ? data : {};
  const boutiqueId = String(p.boutiqueId || '').trim();
  if (!boutiqueId) throw new Error('Boutique émettrice requise');

  const fournisseurId = p.fournisseurId != null ? String(p.fournisseurId).trim() || null : null;
  const fournisseurBoutiqueId = p.fournisseurBoutiqueId != null
    ? String(p.fournisseurBoutiqueId).trim() || null
    : null;
  if (!fournisseurId && !fournisseurBoutiqueId) {
    throw new Error('Fournisseur requis');
  }

  const lignesRaw = Array.isArray(p.lignes) ? p.lignes : [];
  if (!lignesRaw.length) throw new Error('Au moins une ligne requise');

  const origine = String(p.origine || 'manuel').trim().toLowerCase();
  const lignes = [];

  for (let i = 0; i < lignesRaw.length; i += 1) {
    const line = normalizeDevisLine(lignesRaw[i], i);
    line.fournisseurId = fournisseurId;
    line.boutiqueFournisseurId = fournisseurBoutiqueId;

    if (origine === 'stock') {
      const articleId = line.articleId ? String(line.articleId).trim() : '';
      if (!articleId) throw new Error('Les commandes stock exigent des articles du catalogue');
      const article = await getArticleById(db, entrepriseId, articleId);
      if (!article) throw new Error('Article introuvable : ' + (line.reference || line.libelle || articleId));
      if (article.type !== 'produit' || article.gestionStock !== true) {
        throw new Error('Seuls les articles « gérés en stock » sont autorisés : ' + (article.reference || article.libelle));
      }
    }

    lignes.push(line);
  }

  const fraisRaw = Number(p.fraisPortHt) || 0;
  const fraisPortHt = fraisRaw > 0 ? Math.round(fraisRaw * 100) / 100 : 0;
  const fraisTvaRaw = Number(p.fraisPortTauxTva);
  const fraisPortTauxTva = fraisPortHt > 0
    ? (Number.isFinite(fraisTvaRaw) ? fraisTvaRaw : 20)
    : 0;

  await ensureCommandeFournisseurIndexes(db);
  const commandeFournisseurId = crypto.randomUUID();
  const numero = await nextSequenceNumber(db, entrepriseId, boutiqueId, 'commande_fournisseur');
  const totaux = calculateDevisTotals(lignes, { fraisPortHt, fraisPortTauxTva });
  const now = new Date();

  const objetDefault = origine === 'stock' ? 'Réapprovisionnement stock' : 'Commande fournisseur';
  const objet = String(p.objet || '').trim() || objetDefault;

  const doc = {
    entrepriseId: String(entrepriseId),
    commandeFournisseurId,
    boutiqueId,
    fournisseurId,
    fournisseurBoutiqueId,
    commandeClientId: null,
    origine: origine === 'stock' ? 'stock' : 'manuel',
    numero,
    statut: 'brouillon',
    objet,
    notes: String(p.notes || '').trim(),
    fraisPortHt,
    fraisPortTauxTva,
    lignes,
    totaux,
    historique: [{ statut: 'brouillon', date: now }],
    reglee: false,
    regleeAt: null,
    createdAt: now,
    updatedAt: now
  };

  await db.collection(COLLECTION).insertOne(doc);
  return toCommandeFournisseurEntry(doc);
}

module.exports = createCommandeFournisseur;
