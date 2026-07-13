/**
 * FICHIER : modules/pm/backend/services/inbox/detectEmailIntent.js
 * RÔLE : Détecte le type de demande à partir du contenu d'un e-mail.
 */

const DEVIS_KEYWORDS = [
  'devis', 'quote', 'quotation', 'tarif', 'prix', 'estimation',
  'demande de prix', 'request for quote', 'rfq', 'cotation'
];

function detectEmailIntent({ subject = '', body = '' } = {}) {
  const text = `${subject} ${body}`.toLowerCase();
  const isDevis = DEVIS_KEYWORDS.some((kw) => text.includes(kw));
  return {
    type: isDevis ? 'devis' : 'demande',
    columnId: isDevis ? 'qualification' : 'inbox',
    suggestedTasks: isDevis
      ? [
          { id: 'qualify', label: 'Qualifier la demande de devis', done: false, autoSource: 'pm', autoKey: 'qualify' },
          { id: 'create_quote', label: 'Créer le devis GDERPI', done: false, autoSource: 'pm', autoKey: 'create_quote' }
        ]
      : [
          { id: 'triage', label: 'Analyser la demande', done: false, autoSource: 'pm', autoKey: 'triage' }
        ]
  };
}

module.exports = detectEmailIntent;
