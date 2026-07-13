/**
 * FICHIER : frontend/pages/modules/document-agent-v2/assets/js/fields-catalog.js
 * RÔLE : Catalogue des champs UGAP + données placeholder pour l'aperçu éditeur.
 */
(function initAdv2FieldsCatalog(global) {
  'use strict';

  const LOGO_PLACEHOLDER = 'data:image/svg+xml,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="48" viewBox="0 0 120 48">'
    + '<rect width="120" height="48" fill="#e2e8f0" rx="4"/>'
    + '<text x="60" y="28" text-anchor="middle" font-family="Arial,sans-serif" font-size="11" fill="#64748b">LOGO</text>'
    + '</svg>'
  );

  const PLACEHOLDER_DATA = {
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
    { refUgap: 'UG-MOD-01', libelle: 'Bateau école 8 m — configuration de base', libelleApp: 'Coque 8 m', prix: '28 900,00 €' },
    { refUgap: 'UG-MOT-40', libelle: 'Moteur Yamaha 40 CV', libelleApp: 'Moteur hors-bord 4 temps', prix: '4 250,00 €' },
    { refUgap: 'UG-COQ-01', libelle: 'Coque polyester 8 m', libelleApp: 'Coque 8 m polyester', prix: '28 900,00 €' },
    { refUgap: 'UG-EQU-12', libelle: 'Équipement sécurité pack UGAP', libelleApp: 'Pack sécurité réglementaire', prix: '1 850,00 €' },
    { refUgap: 'UG-NAV-03', libelle: 'Pack navigation VHF + GPS', libelleApp: 'Navigation côtière', prix: '2 150,00 €' },
    { refUgap: 'UG-ANC-02', libelle: 'Ancre et mouillage 12 kg', libelleApp: 'Ancre Bruce 12 kg', prix: '420,00 €' },
    { refUgap: 'UG-BAN-01', libelle: 'Banquette pilote ergonomique', libelleApp: 'Banquette réglable', prix: '890,00 €' },
    { refUgap: 'UG-TOP-04', libelle: 'Taud de soleil arceau alu', libelleApp: 'Protection solaire', prix: '1 120,00 €' },
    { refUgap: 'UG-REM-01', libelle: 'Remorque routière homologuée', libelleApp: 'Remorque 2 essieux', prix: '3 600,00 €' },
    { refUgap: 'UG-FOR-02', libelle: 'Formation équipage 2 jours', libelleApp: 'Stage sécurité mer', prix: '980,00 €' },
    { refUgap: 'UG-PEI-01', libelle: 'Peinture antifouling premium', libelleApp: 'Antifouling biocontrôle', prix: '760,00 €' },
    { refUgap: 'UG-ELE-05', libelle: 'Batterie service 110 Ah', libelleApp: 'Batterie AGM', prix: '310,00 €' },
    { refUgap: 'UG-GEN-01', libelle: 'Générateur de secours 2 kW', libelleApp: 'Groupe portable', prix: '1 450,00 €' },
    { refUgap: 'UG-RAD-02', libelle: 'Radar compact 18 pouces', libelleApp: 'Radar pulse compression', prix: '2 890,00 €' },
    { refUgap: 'UG-SON-01', libelle: 'Sondeur cartographie HD', libelleApp: 'Sondeur multibeam', prix: '1 680,00 €' }
  ];

  const FIELD_GROUPS = [
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

  const TABLE_LINE_FIELDS = [
    { key: 'refUgap', label: 'Réf. UGAP' },
    { key: 'libelle', label: 'Libellé UGAP' },
    { key: 'libelleApp', label: 'Libellé' },
    { key: 'categorie', label: 'Catégorie' },
    { key: 'prix', label: 'Prix UGAP HT' }
  ];

  global.Adv2FieldsCatalog = {
    FIELD_GROUPS,
    PLACEHOLDER_DATA,
    SAMPLE_TABLE_LINES,
    LOGO_PLACEHOLDER,
    TABLE_LINE_FIELDS
  };
}(window));
