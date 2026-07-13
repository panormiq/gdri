/**
 * FICHIER : modules/pm/backend/services/integrations/gderpi/devisStatusTasks.js
 * RÔLE : Tâches PM auto-générées selon le statut devis GDERPI.
 */

function devisStatusTasks(statut) {
  const s = String(statut || '').toLowerCase();
  const base = [
    { id: 'qualify', label: 'Qualifier la demande', done: true, autoSource: 'gderpi', autoKey: 'qualify' },
    { id: 'create_quote', label: 'Créer le devis GDERPI', done: true, autoSource: 'gderpi', autoKey: 'create_quote' }
  ];

  const map = {
    brouillon: [
      ...base,
      { id: 'draft_quote', label: 'Finaliser le devis (brouillon)', done: false, autoSource: 'gderpi', autoKey: 'devis_brouillon' }
    ],
    envoye: [
      ...base,
      { id: 'draft_quote', label: 'Finaliser le devis (brouillon)', done: true, autoSource: 'gderpi', autoKey: 'devis_brouillon' },
      { id: 'sent_quote', label: 'Devis envoyé au client', done: true, autoSource: 'gderpi', autoKey: 'devis_envoye' },
      { id: 'follow_up', label: 'Relancer le client si besoin', done: false, autoSource: 'gderpi', autoKey: 'devis_relance' }
    ],
    accepte: [
      ...base,
      { id: 'draft_quote', label: 'Finaliser le devis (brouillon)', done: true, autoSource: 'gderpi', autoKey: 'devis_brouillon' },
      { id: 'sent_quote', label: 'Devis envoyé au client', done: true, autoSource: 'gderpi', autoKey: 'devis_envoye' },
      { id: 'accepted', label: 'Devis accepté — lancer la commande', done: true, autoSource: 'gderpi', autoKey: 'devis_accepte' }
    ],
    refuse: [
      ...base,
      { id: 'refused', label: 'Devis refusé', done: true, autoSource: 'gderpi', autoKey: 'devis_refuse' }
    ],
    expire: [
      ...base,
      { id: 'expired', label: 'Devis expiré', done: true, autoSource: 'gderpi', autoKey: 'devis_expire' }
    ]
  };
  return map[s] || base;
}

module.exports = devisStatusTasks;
