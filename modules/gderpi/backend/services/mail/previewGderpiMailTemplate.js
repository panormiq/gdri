/**
 * Aperçu HTML d'un e-mail document GDERPI (données fictives).
 */

const renderDevisEmailHtml = require('../devis/renderDevisEmailHtml');
const renderCommandeClientEmailHtml = require('../commande-client/renderCommandeClientEmailHtml');
const renderFactureEmailHtml = require('../commande-client/renderFactureEmailHtml');
const renderAvoirEmailHtml = require('../commande-client/renderAvoirEmailHtml');
const renderCommandeFournisseurEmailHtml = require('../commande-fournisseur/renderCommandeFournisseurEmailHtml');
const { MAIL_TEMPLATE_TYPES } = require('./gderpiMailTemplateDefaults');

const DEMO_LINKS = {
  viewUrl: 'https://exemple.fr/gderpi/public/document',
  downloadUrl: 'https://exemple.fr/gderpi/public/document.pdf',
  economyDownloadUrl: 'https://exemple.fr/gderpi/public/document-economy.pdf',
  acceptUrl: 'https://exemple.fr/gderpi/public/devis/confirmer',
  cgvViewUrl: 'https://exemple.fr/gderpi/public/cgv',
  cgvDownloadUrl: 'https://exemple.fr/gderpi/public/cgv.pdf'
};

const DEMO_BOUTIQUE = { nom: 'Boutique Démo', libelle: 'Boutique Démo' };
const DEMO_CLIENT = { nom: 'Dupont', raisonSociale: 'Société Dupont SAS' };
const DEMO_DEVIS = {
  numero: 'DEV-2026-0042',
  contactNom: 'Jean Dupont',
  objet: 'Équipement bureau — lot A',
  dateValidite: new Date('2026-07-31'),
  totaux: { totalTtc: 12500.5 }
};
const DEMO_COMMANDE = {
  numero: 'CMD-2026-0018',
  devisNumero: 'DEV-2026-0042',
  objet: 'Équipement bureau — lot A',
  totaux: { totalTtc: 12500.5, totalHt: 10417.08 },
  createdAt: new Date('2026-06-15'),
  factureNumero: 'FAC-2026-0007',
  factureDate: new Date('2026-06-30'),
  avoirNumero: 'AVO-2026-0002',
  avoirDate: new Date('2026-07-05'),
  factureOrigineNumero: 'FAC-2026-0007'
};
const DEMO_FOURNISSEUR = {
  raisonSociale: 'Fournisseur Pro SAS',
  displayName: 'Fournisseur Pro SAS',
  contactNom: 'Marie Martin'
};

function previewGderpiMailTemplate(payload) {
  const type = String(payload?.type || 'devis').trim();
  if (!MAIL_TEMPLATE_TYPES.includes(type)) {
    throw new Error('Type de modèle invalide');
  }

  const mailTemplate = {
    subjectTemplate: String(payload?.subjectTemplate || '').trim(),
    introHtml: String(payload?.introHtml || '').trim()
  };
  const customMessage = String(payload?.customMessage || '').trim();
  const settings = {
    enableAcceptLink: payload?.enableAcceptLink !== false
  };

  const common = { mailTemplate, customMessage, ...DEMO_LINKS };

  if (type === 'devis') {
    return renderDevisEmailHtml({
      devis: DEMO_DEVIS,
      boutique: DEMO_BOUTIQUE,
      client: DEMO_CLIENT,
      settings,
      ...common
    });
  }

  if (type === 'commande_client') {
    return renderCommandeClientEmailHtml({
      commande: DEMO_COMMANDE,
      boutique: DEMO_BOUTIQUE,
      client: DEMO_CLIENT,
      devis: DEMO_DEVIS,
      ...common
    });
  }

  if (type === 'facture') {
    return renderFactureEmailHtml({
      commande: DEMO_COMMANDE,
      boutique: DEMO_BOUTIQUE,
      client: DEMO_CLIENT,
      devis: DEMO_DEVIS,
      ...common
    });
  }

  if (type === 'avoir') {
    return renderAvoirEmailHtml({
      commande: DEMO_COMMANDE,
      boutique: DEMO_BOUTIQUE,
      client: DEMO_CLIENT,
      devis: DEMO_DEVIS,
      ...common
    });
  }

  return renderCommandeFournisseurEmailHtml({
    commande: DEMO_COMMANDE,
    boutique: DEMO_BOUTIQUE,
    fournisseur: DEMO_FOURNISSEUR,
    viewUrl: DEMO_LINKS.viewUrl,
    downloadUrl: DEMO_LINKS.downloadUrl,
    mailTemplate,
    customMessage
  });
}

module.exports = previewGderpiMailTemplate;
