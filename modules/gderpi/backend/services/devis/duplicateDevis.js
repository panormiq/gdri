/**
 * FICHIER : modules/gderpi/backend/services/devis/duplicateDevis.js
 * RÔLE : Duplique un devis en nouveau brouillon (nouveau numéro, sans commande ni carte PM).
 *
 * ENTRÉES : db, entrepriseId, devisId source
 * SORTIES : Devis créé
 *
 * DÉPEND DE : getDevisById.js, createDevis.js, normalizeDevisLine.js
 * NE PAS : lien commande, carte PM source, historique, liens publics
 *
 * APPELÉ PAR : devisController
 */

const crypto = require('crypto');
const getDevisById = require('./getDevisById');
const createDevis = require('./createDevis');
const normalizeDevisLine = require('./normalizeDevisLine');

function cloneLignes(lignes) {
  const list = Array.isArray(lignes) ? lignes : [];
  return list.map((line, index) => {
    const n = normalizeDevisLine(line, index);
    return {
      ...n,
      id: crypto.randomUUID(),
      sourceDevisLineId: null,
      quantiteLivree: 0,
      quantiteRecueFrs: 0,
      quantiteRecue: 0,
      quantiteFacturee: 0,
      recetteValideeAt: null
    };
  });
}

async function duplicateDevis(db, entrepriseId, devisId) {
  const source = await getDevisById(db, entrepriseId, devisId);
  if (!source) throw new Error('Devis introuvable');
  if (!source.boutiqueId) throw new Error('Boutique requise');

  return createDevis(db, entrepriseId, {
    boutiqueId: source.boutiqueId,
    clientId: source.clientId,
    objet: source.objet,
    notes: source.notes,
    documentClient: source.documentClient,
    referenceClient: source.referenceClient,
    contactClientId: source.contactClientId,
    contactNom: source.contactNom,
    contactService: source.contactService,
    contactFonction: source.contactFonction,
    contactEmail: source.contactEmail,
    contactTelephone: source.contactTelephone,
    emetteurContactId: source.emetteurContactId,
    emetteurContactNom: source.emetteurContactNom,
    emetteurContactFonction: source.emetteurContactFonction,
    emetteurContactEmail: source.emetteurContactEmail,
    emetteurContactTelephone: source.emetteurContactTelephone,
    conditionsPaiementMoyen: source.conditionsPaiementMoyen,
    conditionsPaiementEcheance: source.conditionsPaiementEcheance,
    conditionsPaiementComplement: source.conditionsPaiementComplement,
    joindreCgvAnnexe: source.joindreCgvAnnexe,
    cgvProfil: source.cgvProfil,
    afficherBonPourAccord: source.afficherBonPourAccord,
    fraisPortHt: source.fraisPortHt,
    fraisPortTauxTva: source.fraisPortTauxTva,
    lignes: cloneLignes(source.lignes)
  });
}

module.exports = duplicateDevis;
