/**
 * Modèles par défaut des e-mails GDERPI (sujet + introduction).
 */

const MAIL_TEMPLATE_TYPES = [
  'devis',
  'commande_client',
  'facture',
  'avoir',
  'commande_fournisseur'
];

const TEMPLATE_META = {
  devis: {
    label: 'Devis',
    variables: '{{numero}}, {{contactNom}}, {{objet}}, {{boutique}}, {{montantTtc}}, {{dateValidite}}'
  },
  commande_client: {
    label: 'Commande client',
    variables: '{{numero}}, {{devisNumero}}, {{contactNom}}, {{objet}}, {{boutique}}, {{montantTtc}}, {{dateCommande}}'
  },
  facture: {
    label: 'Facture',
    variables: '{{numero}}, {{commandeNumero}}, {{devisNumero}}, {{contactNom}}, {{objet}}, {{boutique}}, {{montantTtc}}, {{dateFacture}}'
  },
  avoir: {
    label: 'Avoir',
    variables: '{{numero}}, {{factureOrigine}}, {{commandeNumero}}, {{devisNumero}}, {{contactNom}}, {{objet}}, {{boutique}}, {{montantTtc}}, {{dateAvoir}}'
  },
  commande_fournisseur: {
    label: 'Commande fournisseur',
    variables: '{{numero}}, {{contactNom}}, {{objet}}, {{fournisseur}}, {{boutique}}, {{montantHt}}, {{dateCommande}}'
  }
};

const DEFAULTS = {
  devis: {
    subjectTemplate: 'Votre devis {{numero}} — {{boutique}}',
    introHtml: '<p>Bonjour {{contactNom}},</p><p>Nous avons le plaisir de vous transmettre votre devis <strong>{{numero}}</strong>.</p><p>Vous pouvez le consulter et le télécharger via les liens ci-dessous.</p>'
  },
  commande_client: {
    subjectTemplate: 'Accusé de réception commande {{numero}} — {{boutique}}',
    introHtml: '<p>Bonjour {{contactNom}},</p><p>Nous accusons réception de votre commande <strong>{{numero}}</strong>.</p><p>Vous pouvez la consulter et la télécharger via les liens ci-dessous.</p>'
  },
  facture: {
    subjectTemplate: 'Facture {{numero}} — {{boutique}}',
    introHtml: '<p>Bonjour {{contactNom}},</p><p>Veuillez trouver ci-dessous notre facture <strong>{{numero}}</strong> relative à votre commande {{commandeNumero}}.</p>'
  },
  avoir: {
    subjectTemplate: 'Avoir {{numero}} — {{boutique}}',
    introHtml: '<p>Bonjour {{contactNom}},</p><p>Veuillez trouver ci-dessous notre avoir <strong>{{numero}}</strong> relatif à la facture {{factureOrigine}} (commande {{commandeNumero}}).</p>'
  },
  commande_fournisseur: {
    subjectTemplate: 'Commande fournisseur {{numero}} — {{boutique}}',
    introHtml: '<p style="margin:0 0 12px;color:#334155;">Bonjour {{contactNom}},</p><p style="margin:0 0 12px;color:#334155;">Veuillez trouver ci-dessous notre commande fournisseur <strong style="color:#0f172a;">{{numero}}</strong>.</p><p style="margin:0;color:#334155;">Merci de nous confirmer la prise en charge de cette commande.</p>'
  }
};

module.exports = {
  MAIL_TEMPLATE_TYPES,
  TEMPLATE_META,
  DEFAULTS
};
