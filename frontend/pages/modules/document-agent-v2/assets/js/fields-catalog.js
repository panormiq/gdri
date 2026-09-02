/**
 * FICHIER : frontend/pages/modules/document-agent-v2/assets/js/fields-catalog.js
 * RÔLE : Catalogues de champs par type de template (devis UGAP, revue mail agent…).
 */
(function initAdv2FieldsCatalog(global) {
  'use strict';

  const LOGO_PLACEHOLDER = 'data:image/svg+xml,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="48" viewBox="0 0 120 48">'
    + '<rect width="120" height="48" fill="#e2e8f0" rx="4"/>'
    + '<text x="60" y="28" text-anchor="middle" font-family="Arial,sans-serif" font-size="11" fill="#64748b">LOGO</text>'
    + '</svg>'
  );

  const UGAP_PLACEHOLDER_DATA = {
    'ugap:entreprise.logoUrl': LOGO_PLACEHOLDER,
    'ugap:entreprise.raisonSociale': 'GDR-Innovation SAS',
    'ugap:entreprise.adresse': '12 rue de la Marine',
    'ugap:entreprise.codePostal': '56000',
    'ugap:entreprise.ville': 'Vannes',
    'ugap:entreprise.siret': '123 456 789 00012',
    'ugap:entreprise.tvaIntracommunautaire': 'FR12 345678901',
    'ugap:entreprise.telephone': '02 97 00 00 00',
    'ugap:entreprise.email': 'contact@gdr-innovation.fr',
    'ugap:entreprise.conditionsPaiement': 'Paiement à 30 jours fin de mois',
    'ugap:entreprise.mentionsLegales': 'SAS au capital de 50 000 € — RCS Vannes',

    'ugap:client.nom': 'Mairie de Lorient',
    'ugap:client.adresse': '1 place de la Mairie',
    'ugap:client.codePostal': '56100',
    'ugap:client.ville': 'Lorient',
    'ugap:client.email': 'marche.public@lorient.fr',
    'ugap:client.telephone': '02 97 00 00 01',

    'ugap:devis.numero': 'DEV-2026-004521',
    'ugap:devis.date': new Date().toLocaleDateString('fr-FR'),
    'ugap:devis.modele': 'Bateau école 8 m',
    'ugap:devis.validite': '30',
    'ugap:devis.subtotal': '48 500,00',
    'ugap:devis.budget5Disponible': '2 425,00',
    'ugap:devis.budget5': '1 850,00',
    'ugap:devis.budget5Restant': '575,00',
    'ugap:devis.total': '50 350,00',
    'ugap:devis.tauxTva': '20',
    'ugap:devis.montantTva': '10 070,00',
    'ugap:devis.totalTtc': '60 420,00',

    'ugap:commercial.nom': 'Jean Dupont',
    'ugap:commercial.email': 'j.dupont@gdr-innovation.fr',
    'ugap:commercial.telephone': '06 12 34 56 78',

    'ugap:transport.delaiLivraison': 'Livraison sous 12 semaines après accord',

    'ugap:node:moteur.refUgap': 'UG-MOT-40',
    'ugap:node:moteur.libelle': 'Moteur Yamaha 40 CV',
    'ugap:node:moteur.libelleApp': 'Moteur hors-bord 4 temps',
    'ugap:node:moteur.prix': '4 250,00',
    'ugap:node:moteur.ficheTechnique': 'Fiche technique moteur (PDF)'
  };

  const SAMPLE_TABLE_LINES = [
    { refUgap: 'UG-MOD-01', refFournisseur: 'GDRI-B8-001', libelle: 'Bateau école 8 m — configuration de base', libelleApp: 'Coque 8 m', prix: '28 900,00 €', prixPublic: '34 680,00 €' },
    { refUgap: 'UG-MOT-40', refFournisseur: 'YAM-F40-2024', libelle: 'Moteur Yamaha 40 CV', libelleApp: 'Moteur hors-bord 4 temps', prix: '4 250,00 €', prixPublic: '5 100,00 €' },
    { refUgap: 'UG-COQ-01', refFournisseur: 'GDRI-C8-POL', libelle: 'Coque polyester 8 m', libelleApp: 'Coque 8 m polyester', prix: '28 900,00 €', prixPublic: '34 680,00 €' },
    { refUgap: 'UG-EQU-12', libelle: 'Équipement sécurité pack UGAP', libelleApp: 'Pack sécurité réglementaire', prix: '1 850,00 €', prixPublic: '2 220,00 €' },
    { refUgap: 'UG-NAV-03', libelle: 'Pack navigation VHF + GPS', libelleApp: 'Navigation côtière', prix: '2 150,00 €', prixPublic: '2 580,00 €' },
    { refUgap: 'UG-ANC-02', libelle: 'Ancre et mouillage 12 kg', libelleApp: 'Ancre Bruce 12 kg', prix: '420,00 €', prixPublic: '504,00 €' },
    { refUgap: 'UG-BAN-01', libelle: 'Banquette pilote ergonomique', libelleApp: 'Banquette réglable', prix: '890,00 €', prixPublic: '1 068,00 €' },
    { refUgap: 'UG-TOP-04', libelle: 'Taud de soleil arceau alu', libelleApp: 'Protection solaire', prix: '1 120,00 €', prixPublic: '1 344,00 €' },
    { refUgap: 'UG-REM-01', libelle: 'Remorque routière homologuée', libelleApp: 'Remorque 2 essieux', prix: '3 600,00 €', prixPublic: '4 320,00 €' },
    { refUgap: 'UG-FOR-02', libelle: 'Formation équipage 2 jours', libelleApp: 'Stage sécurité mer', prix: '980,00 €', prixPublic: '1 176,00 €' },
    { refUgap: 'UG-PEI-01', libelle: 'Peinture antifouling premium', libelleApp: 'Antifouling biocontrôle', prix: '760,00 €', prixPublic: '912,00 €' },
    { refUgap: 'UG-ELE-05', libelle: 'Batterie service 110 Ah', libelleApp: 'Batterie AGM', prix: '310,00 €', prixPublic: '372,00 €' },
    { refUgap: 'UG-GEN-01', libelle: 'Générateur de secours 2 kW', libelleApp: 'Groupe portable', prix: '1 450,00 €', prixPublic: '1 740,00 €' },
    { refUgap: 'UG-RAD-02', libelle: 'Radar compact 18 pouces', libelleApp: 'Radar pulse compression', prix: '2 890,00 €', prixPublic: '3 468,00 €' },
    { refUgap: 'UG-SON-01', libelle: 'Sondeur cartographie HD', libelleApp: 'Sondeur multibeam', prix: '1 680,00 €', prixPublic: '2 016,00 €' }
  ];

  const UGAP_FIELD_GROUPS = [
    {
      id: 'entreprise',
      label: 'Entreprise',
      fields: [
        { key: 'ugap:entreprise.logoUrl', label: 'Logo entreprise' },
        { key: 'ugap:entreprise.raisonSociale', label: 'Raison sociale' },
        { key: 'ugap:entreprise.adresse', label: 'Adresse' },
        { key: 'ugap:entreprise.codePostal', label: 'Code postal' },
        { key: 'ugap:entreprise.ville', label: 'Ville' },
        { key: 'ugap:entreprise.siret', label: 'SIRET' },
        { key: 'ugap:entreprise.tvaIntracommunautaire', label: 'TVA intracommunautaire' },
        { key: 'ugap:entreprise.telephone', label: 'Téléphone' },
        { key: 'ugap:entreprise.email', label: 'E-mail' },
        { key: 'ugap:entreprise.conditionsPaiement', label: 'Conditions de paiement' },
        { key: 'ugap:entreprise.mentionsLegales', label: 'Mentions légales' }
      ]
    },
    {
      id: 'client',
      label: 'Client',
      fields: [
        { key: 'ugap:client.nom', label: 'Nom' },
        { key: 'ugap:client.adresse', label: 'Adresse' },
        { key: 'ugap:client.codePostal', label: 'Code postal' },
        { key: 'ugap:client.ville', label: 'Ville' },
        { key: 'ugap:client.email', label: 'E-mail' },
        { key: 'ugap:client.telephone', label: 'Téléphone' }
      ]
    },
    {
      id: 'devis',
      label: 'Devis',
      fields: [
        { key: 'ugap:devis.numero', label: 'Numéro' },
        { key: 'ugap:devis.date', label: 'Date' },
        { key: 'ugap:devis.modele', label: 'Modèle' },
        { key: 'ugap:devis.validite', label: 'Validité (jours)' }
      ]
    },
    {
      id: 'total-devis',
      label: 'Total devis',
      fields: [
        { key: 'ugap:devis.subtotal', label: 'Sous-total HT' },
        { key: 'ugap:devis.budget5Disponible', label: 'Budget 5 % HT disponible' },
        { key: 'ugap:devis.budget5', label: 'Options 5 % consommées HT' },
        { key: 'ugap:devis.budget5Restant', label: 'Budget 5 % HT restant' },
        { key: 'ugap:devis.total', label: 'Total HT' },
        { key: 'ugap:devis.tauxTva', label: 'Taux TVA (%)' },
        { key: 'ugap:devis.montantTva', label: 'Montant TVA' },
        { key: 'ugap:devis.totalTtc', label: 'Total TTC' }
      ]
    },
    {
      id: 'commercial',
      label: 'Commercial',
      fields: [
        { key: 'ugap:commercial.nom', label: 'Nom' },
        { key: 'ugap:commercial.email', label: 'E-mail' },
        { key: 'ugap:commercial.telephone', label: 'Téléphone' }
      ]
    },
    {
      id: 'transport',
      label: 'Transport',
      fields: [
        { key: 'ugap:transport.delaiLivraison', label: 'Délai de livraison' }
      ]
    },
    {
      id: 'slots',
      label: 'Slots options',
      fields: [
        { key: 'ugap:node:moteur.refUgap', label: 'Moteur — réf. UGAP' },
        { key: 'ugap:node:moteur.libelle', label: 'Moteur — libellé UGAP' },
        { key: 'ugap:node:moteur.libelleApp', label: 'Moteur — libellé' },
        { key: 'ugap:node:moteur.prix', label: 'Moteur — prix' },
        { key: 'ugap:node:moteur.ficheTechnique', label: 'Moteur — fiche technique' }
      ]
    },
    {
      id: 'lignes',
      label: 'Lignes',
      fields: [
        { key: 'ugap:lignes.table', label: 'Tableau complet (HTML généré)' }
      ]
    }
  ];

  /** Champs fournis par mail-in / revue agent (HITL). */
  const AGENT_REVIEW_FIELD_GROUPS = [
    {
      id: 'mail-meta',
      label: 'Mail reçu',
      fields: [
        { key: 'from', label: 'Expéditeur' },
        { key: 'subject', label: 'Sujet' },
        { key: 'text', label: 'Corps du mail' },
        { key: 'sourceRef', label: 'UID IMAP / référence' },
        { key: 'messageId', label: 'Message-ID' },
        { key: 'channel', label: 'Canal' }
      ]
    },
    {
      id: 'mail-author',
      label: 'Expéditeur (détail)',
      fields: [
        { key: 'author.email', label: 'Email expéditeur' },
        { key: 'author.name', label: 'Nom expéditeur' }
      ]
    },
    {
      id: 'mail-attachments',
      label: 'Pièces jointes',
      fields: [
        { key: 'attachments_html', label: 'Liste PJ (HTML avec liens)' },
        { key: 'attachmentCount', label: 'Nombre de PJ' }
      ]
    },
    {
      id: 'mail-account',
      label: 'Compte / dossier',
      fields: [
        { key: 'metadata.accountRef', label: 'Compte mail' },
        { key: 'metadata.mailbox', label: 'Dossier IMAP' }
      ]
    },
    {
      id: 'review-items',
      label: 'Données à valider',
      fields: [
        { key: 'items_html', label: 'Liste à cocher (HTML)' },
        { key: 'itemsCount', label: 'Nombre d’éléments' },
        { key: 'data_html', label: 'Données (HTML)' }
      ]
    }
  ];

  const AGENT_REVIEW_PLACEHOLDER_DATA = {
    from: 'expediteur@exemple.fr',
    subject: 'Données à valider',
    text: 'Exemple de contenu renvoyé par le bloc Données.',
    sourceRef: '42',
    messageId: '<msg-42@exemple.fr>',
    channel: 'mail',
    'author.email': 'expediteur@exemple.fr',
    'author.name': 'Expéditeur',
    attachments_html: '<ul><li><a href="#">document.pdf</a> (120 Ko)</li></ul>',
    attachmentCount: '1',
    'metadata.accountRef': 'compte@exemple.fr',
    'metadata.mailbox': 'INBOX',
    itemsCount: '3',
    items_html: '<ul class="review-check-list"><li><label><input type="checkbox" checked> Ligne A — valeur 1</label></li><li><label><input type="checkbox" checked> Ligne B — valeur 2</label></li><li><label><input type="checkbox"> Ligne C — valeur 3</label></li></ul>',
    data_html: '<p>Ligne A — valeur 1</p><p>Ligne B — valeur 2</p>'
  };

  const TABLE_LINE_FIELDS = [
    { key: 'refUgap', label: 'Réf. UGAP' },
    { key: 'refFournisseur', label: 'Réf. fournisseur' },
    { key: 'libelle', label: 'Libellé UGAP' },
    { key: 'libelleApp', label: 'Libellé' },
    { key: 'categorie', label: 'Catégorie' },
    { key: 'prix', label: 'Prix UGAP HT' },
    { key: 'prixPublic', label: 'Prix public HT' }
  ];

  function detectCatalogId(meta) {
    const namespace = String(meta?.namespace || '').toLowerCase();
    const scope = String(meta?.scope || '').toLowerCase();
    if (
      scope === 'agent-review'
      || scope === 'agent-app'
      || namespace.startsWith('agent:review')
      || namespace.startsWith('agent:app')
      || namespace.startsWith('agent-review')
      || namespace.includes(':review:')
    ) {
      return 'agent-review';
    }
    if (scope === 'v3' || namespace.startsWith('v3:')) {
      return 'v3';
    }
    return 'ugap';
  }

  const REVIEW_FIELD_GROUP = {
    id: 'review-items',
    label: 'Données à valider',
    fields: [
      { key: 'items_html', label: 'Liste à cocher (HTML)' },
      { key: 'itemsCount', label: 'Nombre d’éléments' },
      { key: 'data_html', label: 'Données (HTML)' }
    ]
  };

  const MAIL_RENDER_GROUP = {
    id: 'mail-render',
    label: 'Rendu mail',
    fields: [
      { key: 'attachments_html', label: 'Liste PJ (HTML avec liens)' },
      { key: 'attachmentCount', label: 'Nombre de PJ' }
    ]
  };

  function contractProviders(dataContract) {
    return ((dataContract && dataContract.providers) || []).map((p) => String(p).toLowerCase());
  }

  function isMailContract(dataContract) {
    const providers = contractProviders(dataContract);
    return providers.includes('mail') || providers.includes('mail-in');
  }

  const MAIL_ONLY_KEYS = {
    subject: true,
    attachments: true,
    'author.email': true,
    'metadata.accountRef': true,
    'metadata.mailbox': true,
    attachments_html: true,
    attachmentCount: true
  };

  function sanitizeContract(dataContract) {
    if (!dataContract || isMailContract(dataContract)) return dataContract;
    if (!contractProviders(dataContract).length) return dataContract;
    function keep(fields) {
      return (fields || []).filter((f) => f && f.key && !MAIL_ONLY_KEYS[f.key]);
    }
    return {
      providers: dataContract.providers,
      kinds: dataContract.kinds,
      label: dataContract.label,
      fields: keep(dataContract.fields),
      groups: (dataContract.groups || [])
        .map((g) => ({ id: g.id, label: g.label, fields: keep(g.fields) }))
        .filter((g) => g.fields.length)
    };
  }

  function placeholdersFromContract(dataContract) {
    const providers = contractProviders(dataContract);
    const isFb = providers.includes('facebook');
    const out = {
      itemsCount: '3',
      items_html: AGENT_REVIEW_PLACEHOLDER_DATA.items_html,
      data_html: AGENT_REVIEW_PLACEHOLDER_DATA.data_html
    };
    const fbSamples = {
      channel: 'facebook',
      text: 'Exemple de commentaire Facebook.',
      from: 'Marie Dupont',
      messageId: 'comment-42',
      sourceRef: 'comment-42',
      timestamp: '2026-08-17T10:00:00Z',
      'author.id': '123456',
      'author.name': 'Marie Dupont',
      instanceId: 'facebook-1',
      pageId: 'page-1',
      resourceType: 'comment',
      permalink_url: 'https://www.facebook.com/example',
      created_time: '2026-08-17T10:00:00Z',
      'metadata.postId': 'post-99'
    };
    (dataContract && Array.isArray(dataContract.fields) ? dataContract.fields : []).forEach((f) => {
      if (!f || !f.key || out[f.key] != null) return;
      if (isFb && fbSamples[f.key] != null) out[f.key] = fbSamples[f.key];
      else if (AGENT_REVIEW_PLACEHOLDER_DATA[f.key] != null) out[f.key] = AGENT_REVIEW_PLACEHOLDER_DATA[f.key];
      else out[f.key] = f.label || f.key;
    });
    return out;
  }

  function hasUsableFields(dataContract) {
    if (!dataContract) return false;
    if (Array.isArray(dataContract.fields) && dataContract.fields.length) return true;
    return (dataContract.groups || []).some((g) => g && Array.isArray(g.fields) && g.fields.length);
  }

  function findConnectorContract(contracts, provider) {
    const map = (contracts && contracts.connectors) || {};
    const key = String(provider || '').toLowerCase();
    if (map[key]) return map[key];
    return Object.keys(map).map((k) => map[k]).find((c) => {
      return String(c.provider || '').toLowerCase() === key
        || String(c.connectorId || '').toLowerCase() === key;
    }) || null;
  }

  function envelopeMatchesProvider(field, provider, contract) {
    const allowed = field && Array.isArray(field.connectors) ? field.connectors : [];
    if (!allowed.length) return true;
    const aliases = [String(provider || '').toLowerCase()];
    if (contract) {
      aliases.push(String(contract.provider || '').toLowerCase());
      aliases.push(String(contract.connectorId || '').toLowerCase());
    }
    return allowed.some((item) => aliases.includes(String(item).toLowerCase()));
  }

  function buildContractFromSpecs(contracts, providers, kinds) {
    const providerList = (providers || []).map((p) => String(p).toLowerCase()).filter(Boolean);
    const kindSet = {};
    (kinds || []).forEach((id) => { kindSet[String(id)] = true; });
    const fields = [];
    const seen = {};
    const groups = [];
    const labels = [];
    function pushField(list, f) {
      if (!f || !f.key || seen[f.key]) return;
      seen[f.key] = true;
      const item = { key: f.key, label: f.label || f.key };
      fields.push(item);
      list.push(item);
    }
    providerList.forEach((provider) => {
      const connector = findConnectorContract(contracts, provider);
      const label = (connector && connector.label) || provider;
      labels.push(label);
      const groupFields = [];
      ((contracts && contracts.envelope && contracts.envelope.fields) || []).forEach((f) => {
        if (envelopeMatchesProvider(f, provider, connector)) pushField(groupFields, f);
      });
      ((connector && connector.kinds) || []).forEach((kind) => {
        if (Object.keys(kindSet).length && !kindSet[kind.id]) return;
        (kind.fields || []).forEach((f) => pushField(groupFields, f));
      });
      if (groupFields.length) {
        groups.push({ id: provider, label: label, fields: groupFields });
      }
    });
    return {
      providers: providerList,
      kinds: kinds || [],
      fields: fields,
      groups: groups,
      label: labels.join(' + ') || providerList.join(' + ') || 'Données'
    };
  }

  function groupsFromContract(dataContract) {
    if (!hasUsableFields(dataContract)) return null;
    const groups = [];
    if (Array.isArray(dataContract.groups) && dataContract.groups.some((g) => g && g.fields && g.fields.length)) {
      dataContract.groups.forEach((g) => {
        if (!g || !Array.isArray(g.fields) || !g.fields.length) return;
        groups.push({
          id: g.id || g.label || 'data',
          label: g.label || dataContract.label || 'Données',
          fields: g.fields.map((f) => ({ key: f.key, label: f.label || f.key }))
        });
      });
    } else {
      groups.push({
        id: 'data-contract',
        label: dataContract.label || (dataContract.providers || []).join(', ') || 'Contrat données',
        fields: dataContract.fields.map((f) => ({ key: f.key, label: f.label || f.key }))
      });
    }
    if (isMailContract(dataContract)) groups.push(MAIL_RENDER_GROUP);
    groups.push(REVIEW_FIELD_GROUP);
    return groups;
  }

  function resolveCatalog(meta) {
    const id = detectCatalogId(meta || {});
    const ctx = (meta && meta.agentPageContext) || null;
    const hint = (meta && meta.contractHint) || {};
    let contract = sanitizeContract(
      ctx && ctx.dataContract ? ctx.dataContract : (meta && meta.dataContract) || null
    );
    const providers = (hint.providers && hint.providers.length)
      ? hint.providers
      : contractProviders(contract);
    const kinds = (hint.kinds && hint.kinds.length)
      ? hint.kinds
      : ((contract && contract.kinds) || []);
    if (!hasUsableFields(contract) && meta && meta.contracts && providers.length) {
      contract = buildContractFromSpecs(meta.contracts, providers, kinds);
    }
    if (id === 'v3') {
      return {
        id: 'v3',
        label: 'Documents',
        FIELD_GROUPS: [],
        PLACEHOLDER_DATA: {},
        SAMPLE_TABLE_LINES: [],
        LOGO_PLACEHOLDER,
        TABLE_LINE_FIELDS: []
      };
    }
    if (id === 'agent-review') {
      const groups = groupsFromContract(contract);
      if (groups) {
        return {
          id: 'agent-review',
          label: (contract && contract.label) || (isMailContract(contract) ? 'Mail' : 'Données'),
          FIELD_GROUPS: groups,
          PLACEHOLDER_DATA: placeholdersFromContract(contract),
          SAMPLE_TABLE_LINES: [],
          LOGO_PLACEHOLDER,
          TABLE_LINE_FIELDS: [],
          agentPageContext: ctx
        };
      }
      if (isMailContract(contract) || providers.includes('mail') || providers.includes('mail-in')) {
        return {
          id: 'agent-review',
          label: 'Mail',
          FIELD_GROUPS: AGENT_REVIEW_FIELD_GROUPS,
          PLACEHOLDER_DATA: AGENT_REVIEW_PLACEHOLDER_DATA,
          SAMPLE_TABLE_LINES: [],
          LOGO_PLACEHOLDER,
          TABLE_LINE_FIELDS: [],
          agentPageContext: ctx
        };
      }
      return {
        id: 'agent-review',
        label: providers.join(', ') || 'Agent',
        FIELD_GROUPS: [REVIEW_FIELD_GROUP],
        PLACEHOLDER_DATA: placeholdersFromContract(contract || { fields: [] }),
        SAMPLE_TABLE_LINES: [],
        LOGO_PLACEHOLDER,
        TABLE_LINE_FIELDS: [],
        agentPageContext: ctx
      };
    }
    return {
      id: 'ugap',
      label: 'Devis UGAP',
      FIELD_GROUPS: UGAP_FIELD_GROUPS,
      PLACEHOLDER_DATA: UGAP_PLACEHOLDER_DATA,
      SAMPLE_TABLE_LINES,
      LOGO_PLACEHOLDER,
      TABLE_LINE_FIELDS
    };
  }

  // Rétrocompat : export par défaut = devis UGAP
  global.Adv2FieldsCatalog = {
    FIELD_GROUPS: UGAP_FIELD_GROUPS,
    PLACEHOLDER_DATA: UGAP_PLACEHOLDER_DATA,
    SAMPLE_TABLE_LINES,
    LOGO_PLACEHOLDER,
    TABLE_LINE_FIELDS,
    CATALOGS: {
      ugap: {
        FIELD_GROUPS: UGAP_FIELD_GROUPS,
        PLACEHOLDER_DATA: UGAP_PLACEHOLDER_DATA
      },
      'agent-review': {
        FIELD_GROUPS: AGENT_REVIEW_FIELD_GROUPS,
        PLACEHOLDER_DATA: AGENT_REVIEW_PLACEHOLDER_DATA
      }
    },
    detectCatalogId,
    resolveCatalog,
    buildContractFromSpecs
  };
}(window));
