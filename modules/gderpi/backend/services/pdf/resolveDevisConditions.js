/**
 * FICHIER : modules/gderpi/backend/services/pdf/resolveDevisConditions.js
 * RÔLE : Assemble les conditions de vente affichées sur un devis selon le type client.
 */

const normalizeConditionsVenteBlocks = require('../boutiques/normalizeConditionsVenteBlocks');
const { hasConditionsVenteBlocks } = require('../boutiques/normalizeConditionsVenteBlocks');
const defaultConditionsVenteBlocks = require('../boutiques/defaultConditionsVenteBlocks');

const resolveCgvProfil = require('./resolveCgvProfil');

function isClientParticulier(client) {
  return resolveCgvProfil.isClientParticulier(client);
}

function pushSection(sections, title, text) {
  const body = String(text || '').trim();
  if (!body) return;
  sections.push({ title: title || '', text: body });
}

function joinPaymentProBlocks(blocks) {
  return [blocks.paiementProModes, blocks.paiementProDelais].filter(Boolean).join('\n\n');
}

function resolveConditionsVenteBlocks(boutique) {
  const blocks = normalizeConditionsVenteBlocks(boutique || {});
  if (!hasConditionsVenteBlocks(blocks)) {
    return defaultConditionsVenteBlocks();
  }
  return blocks;
}

function resolveDevisConditions(boutique, client, options) {
  const opts = options && typeof options === 'object' ? options : {};
  const profil = opts.cgvProfil || resolveCgvProfil(opts.devis, client);
  const particulier = profil === 'b2c';
  const blocks = resolveConditionsVenteBlocks(boutique || {});
  const sections = [];

  pushSection(sections, '', blocks.communes);

  if (particulier) {
    pushSection(sections, 'Paiement', blocks.paiementParticulier);
    pushSection(sections, 'Retours et rétractation', blocks.retourParticulier);
    pushSection(sections, 'Livraison', blocks.livraisonParticulier);
    pushSection(sections, 'Garanties', blocks.garantiesParticulier);
    pushSection(sections, 'Litiges', blocks.litigesParticulier);
  } else {
    pushSection(sections, 'Paiement', joinPaymentProBlocks(blocks));
    pushSection(sections, 'Livraison', blocks.livraisonPro);
    pushSection(sections, 'Garanties', blocks.garantiesPro);
    pushSection(sections, 'Litiges', blocks.litigesPro);
  }

  const plainParts = sections.map((s) => {
    if (!s.title) return s.text;
    return s.title + '\n' + s.text;
  });

  return {
    sections,
    plainText: plainParts.filter(Boolean).join('\n\n'),
    cgvProfil: profil
  };
}

module.exports = resolveDevisConditions;
