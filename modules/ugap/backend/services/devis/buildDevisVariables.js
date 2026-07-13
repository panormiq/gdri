/**
 * FICHIER : modules/ugap/backend/services/devis/buildDevisVariables.js
 * RÔLE : Assemble les variables {{ugap:…}} injectées dans le template agent documentaire.
 *
 * ENTRÉES : pricing, settings, client, commercial, modèle
 * SORTIES : objet variables string pour createDocumentFromTemplate
 *
 * DÉPEND DE : UgapDevisSlotBindings, renderDevisTableHtml
 * NE PAS : PDF, Mongo agent
 *
 * APPELÉ PAR : UgapDevisRenderService
 */

const { SLOT_BINDINGS, pickOptionsForSlot } = require('./UgapDevisSlotBindings');
const { optionToLine, formatMoney } = require('./renderDevisTableHtml');

function formatDateFr(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('fr-FR');
}

function buildClientName(clientInfo) {
  const c = clientInfo && typeof clientInfo === 'object' ? clientInfo : {};
  if (c.type === 'particulier') {
    return `${c.prenom || ''} ${c.nom || ''}`.trim() || 'Client';
  }
  return String(c.raisonSociale || '').trim() || 'Client';
}

function buildClientAddress(clientInfo) {
  const c = clientInfo && typeof clientInfo === 'object' ? clientInfo : {};
  const parts = [c.adresse, c.adresseComplement].map((x) => String(x || '').trim()).filter(Boolean);
  return parts.join(' — ');
}

function buildCommercialName(commercial) {
  const c = commercial && typeof commercial === 'object' ? commercial : {};
  return `${c.prenom || ''} ${c.nom || ''}`.trim();
}

function buildDevisNumber(entrepriseInfo, entrepriseId) {
  const prefix = String(entrepriseInfo?.numeroDevisPrefix || 'DEV-').trim() || 'DEV-';
  const year = new Date().getFullYear();
  const suffix = String(Date.now()).slice(-6);
  return `${prefix}${year}-${suffix}`;
}

function slotVariablesFromOption(option, slotKey) {
  const line = optionToLine(option, option?.category);
  const prefix = slotKey;
  return {
    [`${prefix}.refUgap`]: line.refUgap,
    [`${prefix}.libelle`]: line.libelle,
    [`${prefix}.libelleApp`]: line.libelleApp,
    [`${prefix}.prix`]: line.prix,
    [`${prefix}.ficheTechnique`]: String(option?.ficheTechnique || '').trim()
  };
}

function buildDevisVariables({
  entrepriseInfo,
  clientInfo,
  commercial,
  pricing,
  devisName,
  devisShortName,
  entrepriseId
}) {
  const info = entrepriseInfo && typeof entrepriseInfo === 'object' ? entrepriseInfo : {};
  const pricingData = pricing?.data || {};
  const model = pricingData.model || {};
  const selectedOptions = Array.isArray(pricingData.selectedOptions) ? pricingData.selectedOptions : [];

  const lines = selectedOptions.map((opt) => optionToLine(opt, opt.category));
  const variables = {
    'ugap:entreprise.raisonSociale': info.raisonSociale || '',
    'ugap:entreprise.adresse': info.adresse || '',
    'ugap:entreprise.codePostal': info.codePostal || '',
    'ugap:entreprise.ville': info.ville || '',
    'ugap:entreprise.siret': info.siret || '',
    'ugap:entreprise.tvaIntracommunautaire': info.tvaIntracommunautaire || '',
    'ugap:entreprise.telephone': info.telephone || '',
    'ugap:entreprise.email': info.email || '',
    'ugap:entreprise.conditionsPaiement': info.conditionsPaiement || '',
    'ugap:entreprise.mentionsLegales': info.mentionsLegales || '',
    'ugap:entreprise.logoUrl': info.logoUrl || '',

    'ugap:client.nom': buildClientName(clientInfo),
    'ugap:client.adresse': buildClientAddress(clientInfo),
    'ugap:client.codePostal': String(clientInfo?.codePostal || '').trim(),
    'ugap:client.ville': String(clientInfo?.ville || '').trim(),
    'ugap:client.email': String(clientInfo?.email || '').trim(),
    'ugap:client.telephone': String(clientInfo?.telephone || '').trim(),

    'ugap:devis.numero': buildDevisNumber(info, entrepriseId),
    'ugap:devis.date': formatDateFr(),
    'ugap:devis.nomCourt': String(devisShortName || '').trim(),
    'ugap:devis.modele': String(model?.name || devisName || '').trim(),
    'ugap:devis.validite': String(info.validiteDevisJours || 30),
    'ugap:devis.subtotal': formatMoney(pricingData.subtotal),
    'ugap:devis.budget5Disponible': formatMoney(pricingData.budget5Percent),
    'ugap:devis.budget5': formatMoney(pricingData.budget5Consumed),
    'ugap:devis.budget5Restant': formatMoney(pricingData.budget5Restant),
    'ugap:devis.total': formatMoney(pricingData.total),
    'ugap:devis.tauxTva': String(pricingData.tauxTva ?? 20),
    'ugap:devis.montantTva': formatMoney(pricingData.montantTva),
    'ugap:devis.totalTtc': formatMoney(pricingData.totalTtc),

    'ugap:commercial.nom': buildCommercialName(commercial),
    'ugap:commercial.email': String(commercial?.email || '').trim(),
    'ugap:commercial.telephone': String(commercial?.telephone || '').trim(),

    'ugap:transport.delaiLivraison': String(info.delaiLivraison || '').trim(),

    'ugap:lignes.table': ''
  };

  Object.keys(SLOT_BINDINGS).forEach((slotKey) => {
    const picked = pickOptionsForSlot(slotKey, selectedOptions);
    const defaults = {
      [`${slotKey}.refUgap`]: '',
      [`${slotKey}.libelle`]: '',
      [`${slotKey}.libelleApp`]: '',
      [`${slotKey}.prix`]: '',
      [`${slotKey}.ficheTechnique`]: ''
    };
    if (!picked.length) {
      Object.assign(variables, defaults);
      return;
    }
    Object.assign(variables, slotVariablesFromOption(picked[0], slotKey));
  });

  return variables;
}

module.exports = {
  buildDevisVariables,
  buildDevisNumber
};
