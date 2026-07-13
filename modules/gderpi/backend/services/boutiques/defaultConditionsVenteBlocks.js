/**
 * FICHIER : modules/gderpi/backend/services/boutiques/defaultConditionsVenteBlocks.js
 * RÔLE : Modèle par défaut des blocs conditions de vente (France, B2B/B2C).
 */

function defaultConditionsVenteBlocks() {
  return {
    communes: [
      'Les prix sont exprimés en euros hors taxes (HT), sauf mention contraire. La TVA applicable est celle en vigueur au jour de la commande.',
      'Le présent devis est valable pour la durée indiquée en en-tête. Il ne vaut engagement qu\'après acceptation écrite (bon pour accord) ou commande ferme du client.',
      'Sauf stipulation contraire, les produits restent notre propriété jusqu\'au paiement intégral du prix (clause de réserve de propriété).'
    ].join('\n\n'),

    paiementProModes: [
      'Les moyens de paiement suivants peuvent être acceptés, selon accord préalable ou mention sur le devis :',
      '• Virement bancaire',
      '• Chèque (à l\'ordre de l\'entreprise)',
      '• Carte bancaire (sur site sécurisé ou lien de paiement)',
      '• Prélèvement SEPA (après signature du mandat)',
      '',
      'Le moyen retenu pour chaque commande est indiqué sur le devis ou le bon de commande.'
    ].join('\n'),

    paiementProDelais: [
      'Sauf mention contraire sur le devis, les échéances de paiement suivantes peuvent s\'appliquer :',
      '• Paiement à 30 jours date de facture',
      '• Paiement à réception de la facture',
      '• Paiement comptant à la commande',
      '• Paiement à la livraison (contre-remise ou selon conditions convenues)',
      '• Acompte à la commande, solde à l\'expédition ou à la livraison',
      '',
      'En cas de retard de paiement (hors échéance comptant ou à la livraison convenue), des pénalités de retard au taux légal en vigueur seront exigibles, ainsi qu\'une indemnité forfaitaire de 40 € pour frais de recouvrement (article L441-10 du Code de commerce).',
      'Aucun escompte en cas de paiement anticipé.'
    ].join('\n\n'),

    livraisonPro: [
      'Les délais de livraison sont indicatifs. Un retard raisonnable ne peut donner lieu à annulation de la commande, résiliation du contrat ou dommages et intérêts, sauf engagement écrit contraire.',
      'Le transfert des risques s\'effectue à la remise au transporteur ou au client, selon le mode de livraison retenu.'
    ].join('\n\n'),

    garantiesPro: [
      'Nos produits sont garantis contre les vices cachés dans les conditions prévues aux articles 1641 et suivants du Code civil.',
      'Toute réclamation sur un vice apparent doit être formulée par écrit dans les meilleurs délais à réception.'
    ].join('\n\n'),

    litigesPro: [
      'En cas de litige, les parties s\'efforceront de trouver une solution amiable.',
      'À défaut, compétence exclusive est attribuée aux tribunaux du ressort du siège social du vendeur.'
    ].join('\n\n'),

    paiementParticulier: [
      'Paiement comptant à la commande ou à la livraison, selon accord préalable (virement bancaire, chèque ou carte bancaire).',
      'En cas de paiement échelonné, les sommes restant dues deviendront immédiatement exigibles en cas de défaut d\'une échéance.'
    ].join('\n\n'),

    retourParticulier: [
      'Conformément aux articles L221-18 et suivants du Code de la consommation, le consommateur dispose d\'un délai de 14 jours à compter de la réception du bien pour exercer son droit de rétractation, sans avoir à justifier de motifs ni à payer de pénalités.',
      'Pour exercer ce droit, le client doit notifier sa décision par écrit (courrier ou email). Les produits retournés doivent être complets, en parfait état de revente et dans leur emballage d\'origine. Les frais de retour sont à la charge du client, sauf produit non conforme ou erreur de notre part.',
      'Sont exclus du droit de rétractation : produits personnalisés, produits descellés ne pouvant être renvoyés pour des raisons d\'hygiène ou de protection de la santé, et prestations de services pleinement exécutées avant la fin du délai avec accord préalable du consommateur.'
    ].join('\n\n'),

    livraisonParticulier: [
      'Les délais de livraison sont indicatifs. Un retard raisonnable ne peut donner lieu à annulation de la commande ou dommages et intérêts, sauf engagement écrit contraire.',
      'Le transfert des risques s\'effectue à la remise au transporteur ou au client, selon le mode de livraison retenu.'
    ].join('\n\n'),

    garantiesParticulier: [
      'Nos produits bénéficient des garanties légales de conformité (articles L217-4 et suivants du Code de la consommation) et des vices cachés (articles 1641 et suivants du Code civil).',
      'Toute réclamation sur la conformité ou un vice apparent doit être formulée par écrit dans les meilleurs délais à réception.'
    ].join('\n\n'),

    litigesParticulier: [
      'En cas de litige, le client consommateur peut recourir gratuitement à un médiateur de la consommation conformément aux articles L612-1 et suivants du Code de la consommation.',
      'Les parties s\'efforceront de trouver une solution amiable avant toute action judiciaire.'
    ].join('\n\n')
  };
}

module.exports = defaultConditionsVenteBlocks;
