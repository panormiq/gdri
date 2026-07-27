/**
 * FICHIER : backend/core/agent-flow/flowTemplates.js
 * RÔLE : Templates de flows Agent Mail / Agent Facebook (seed à la demande).
 *
 * Agent Facebook : sans envoi mail pour l'instant (analyse + routage seulement).
 * Legacy Facebook reste actif en parallèle jusqu'au cutover.
 */

function mailAgentTemplate(entrepriseId) {
  const triggerId = 'node-mail-in';
  const analyseId = 'node-analyse';
  const routeId = 'node-route';
  const mailOutId = 'node-mail-out';
  return {
    name: 'Agent Mail',
    description: 'Mail entrant → analyse d\'intention → routage → envoi',
    enabled: true,
    templateId: 'agent-mail',
    trigger: { brickId: 'mail-in', config: { accountRef: '' } },
    steps: [
      { id: analyseId, brickId: 'analyse-intention', operation: 'analyse.run', config: { messageField: 'text' } },
      { id: routeId, brickId: 'route-intention', operation: 'route.resolve', config: {} },
      {
        id: mailOutId,
        brickId: 'mail-out',
        operation: 'emit.mail',
        config: {
          accountRef: '',
          to: '',
          subject: '{{subject}}',
          body: '{{body}}',
          attachPrevious: false,
          usePreviousRoute: true
        }
      }
    ],
    canvas: {
      nodes: [
        { id: triggerId, brickId: 'mail-in', kind: 'trigger', name: 'Mail entrant', config: { accountRef: '' }, x: 80, y: 80, nextId: analyseId },
        { id: analyseId, brickId: 'analyse-intention', kind: 'action', operation: 'analyse.run', name: 'Analyse d\'intention', config: { messageField: 'text' }, x: 80, y: 200, nextId: routeId },
        { id: routeId, brickId: 'route-intention', kind: 'action', operation: 'route.resolve', name: 'Routage', config: {}, x: 80, y: 320, nextId: mailOutId },
        { id: mailOutId, brickId: 'mail-out', kind: 'action', operation: 'emit.mail', name: 'Envoi mail', config: { accountRef: '', to: '', subject: '{{subject}}', body: '{{body}}', attachPrevious: false, usePreviousRoute: true }, x: 80, y: 440, nextId: null }
      ]
    },
    entrepriseId
  };
}

/**
 * Flux Facebook parallèle au legacy : analyse + routage uniquement (pas d'envoi).
 * L'envoi mail-out sera ajouté après validation sur un compte pilote.
 */
function facebookAgentTemplate(entrepriseId) {
  const triggerId = 'node-facebook';
  const analyseId = 'node-analyse';
  const routeId = 'node-route';
  return {
    name: 'Agent Facebook (pilot)',
    description:
      'Poll Facebook (posts) → analyse → routage (sans envoi). Lancer manuel = dernier post. Legacy FB reste actif.',
    enabled: true,
    templateId: 'agent-facebook',
    trigger: {
      brickId: 'facebook',
      config: {
        pageId: '',
        ingestModes: ['poll'],
        resources: ['posts'],
        webhookEvents: ['comments', 'messages'],
        limit: 25,
        lookbackHours: 168,
        commentCatchupLimit: 20
      }
    },
    steps: [
      { id: analyseId, brickId: 'analyse-intention', operation: 'analyse.run', config: { messageField: 'text' } },
      { id: routeId, brickId: 'route-intention', operation: 'route.resolve', config: {} }
    ],
    canvas: {
      nodes: [
        {
          id: triggerId,
          brickId: 'facebook',
          kind: 'trigger',
          name: 'Facebook',
          config: {
            pageId: '',
            ingestModes: ['poll'],
            resources: ['posts'],
            webhookEvents: ['comments', 'messages'],
            limit: 25,
            lookbackHours: 168,
            commentCatchupLimit: 20
          },
          x: 80,
          y: 80,
          nextId: analyseId
        },
        { id: analyseId, brickId: 'analyse-intention', kind: 'action', operation: 'analyse.run', name: 'Analyse d\'intention', config: { messageField: 'text' }, x: 80, y: 200, nextId: routeId },
        { id: routeId, brickId: 'route-intention', kind: 'action', operation: 'route.resolve', name: 'Routage (sans envoi)', config: {}, x: 80, y: 320, nextId: null }
      ]
    },
    entrepriseId
  };
}

/**
 * Agent assisté : analyse → revue documentaire (HITL) → routage.
 */
function assistedDocAgentTemplate(entrepriseId) {
  const triggerId = 'node-manual';
  const analyseId = 'node-analyse';
  const reviewId = 'node-review';
  const routeId = 'node-route';
  return {
    name: 'Agent assisté (document)',
    description:
      'Manuel → analyse → revue WYSIWYG (validation humaine) → routage. Mode assisté.',
    enabled: true,
    templateId: 'agent-assisted-doc',
    imageUrl: null,
    interactionMode: 'auto',
    trigger: { brickId: 'manual-trigger', config: {} },
    steps: [
      { id: analyseId, brickId: 'analyse-intention', operation: 'analyse.run', config: { messageField: 'text' } },
      {
        id: reviewId,
        brickId: 'human-doc-review',
        operation: 'review.pause',
        config: {
          title: 'Revue avant routage',
          instructions: 'Vérifiez le message analysé, modifiez le contenu si besoin, puis validez.',
          templateNamespace: ''
        }
      },
      { id: routeId, brickId: 'route-intention', operation: 'route.resolve', config: {} }
    ],
    canvas: {
      nodes: [
        { id: triggerId, brickId: 'manual-trigger', kind: 'trigger', name: 'Manuel', config: {}, x: 80, y: 80, nextId: analyseId },
        { id: analyseId, brickId: 'analyse-intention', kind: 'action', operation: 'analyse.run', name: 'Analyse d\'intention', config: { messageField: 'text' }, x: 80, y: 200, nextId: reviewId },
        { id: reviewId, brickId: 'human-doc-review', kind: 'action', operation: 'review.pause', name: 'Revue documentaire', config: { title: 'Revue avant routage', instructions: 'Vérifiez puis validez.', templateNamespace: '' }, x: 80, y: 320, nextId: routeId },
        { id: routeId, brickId: 'route-intention', kind: 'action', operation: 'route.resolve', name: 'Routage', config: {}, x: 80, y: 440, nextId: null }
      ]
    },
    entrepriseId
  };
}

/**
 * Factures mail : filtre expéditeur/sujet → revue PJ → suppression IMAP si validé.
 * Configurer aussi fromContains / subjectContains sur l'instance mail-in si boîte dédiée.
 */
function invoiceMailAgentTemplate(entrepriseId) {
  const triggerId = 'node-mail-in';
  const ifFromId = 'node-if-from';
  const ifSubjectId = 'node-if-subject';
  const saveId = 'node-save-atts';
  const reviewId = 'node-review';
  const deleteId = 'node-mail-delete';
  return {
    name: 'Agent factures mail',
    description:
      'Mail-in → filtres → télécharger PJ → revue → suppression IMAP si validé.',
    enabled: true,
    templateId: 'agent-mail-invoices',
    interactionMode: 'assisted',
    agentContext:
      'Récupérer les invoices Games Workshop dans la boîte mail (expéditeur Games Workshop, sujet contenant invoice), télécharger les pièces jointes, puis supprimer le mail après validation humaine.',
    trigger: { brickId: 'mail-in', config: { accountRef: '' } },
    steps: [
      {
        id: ifFromId,
        brickId: 'logic-if',
        operation: 'logic.if',
        config: { field: 'from', op: 'contains', value: 'games workshop' }
      },
      {
        id: ifSubjectId,
        brickId: 'logic-if',
        operation: 'logic.if',
        config: { field: 'subject', op: 'contains', value: 'invoice' }
      },
      {
        id: saveId,
        brickId: 'mail-save-attachments',
        operation: 'mail.saveAttachments',
        config: { subfolder: 'factures', requireAttachments: false }
      },
      {
        id: reviewId,
        brickId: 'human-doc-review',
        operation: 'review.pause',
        config: {
          title: 'Valider la facture',
          instructions:
            'Téléchargez les PDF, vérifiez, puis validez (= supprimer le mail) ou rejetez.',
          reviewContext:
            'Détail d\'UN mail invoice Games Workshop à contrôler : expéditeur, sujet, corps, PDF à télécharger. Décision Valider (= supprimer ce mail) ou Rejeter (= garder). La liste des mails en attente est dans la file à gauche de la page revue.',
          templateNamespace: 'agent:review:invoice'
        }
      },
      {
        id: deleteId,
        brickId: 'mail-delete',
        operation: 'mail.delete',
        config: { accountRef: '', mailbox: 'INBOX', onlyOnApprove: true }
      }
    ],
    canvas: {
      nodes: [
        {
          id: triggerId,
          brickId: 'mail-in',
          kind: 'trigger',
          name: 'Mail entrant',
          config: { accountRef: '' },
          x: 80,
          y: 80,
          nextId: ifFromId
        },
        {
          id: ifFromId,
          brickId: 'logic-if',
          kind: 'action',
          operation: 'logic.if',
          name: 'Si : Expéditeur contient « games workshop »',
          config: { field: 'from', op: 'contains', value: 'games workshop' },
          x: 80,
          y: 200,
          nextId: ifSubjectId,
          nextFalseId: null
        },
        {
          id: ifSubjectId,
          brickId: 'logic-if',
          kind: 'action',
          operation: 'logic.if',
          name: 'Si : Sujet contient « invoice »',
          config: { field: 'subject', op: 'contains', value: 'invoice' },
          x: 80,
          y: 320,
          nextId: saveId,
          nextFalseId: null
        },
        {
          id: saveId,
          brickId: 'mail-save-attachments',
          kind: 'action',
          operation: 'mail.saveAttachments',
          name: 'Télécharger PJ',
          config: { subfolder: 'factures', requireAttachments: false },
          x: 80,
          y: 440,
          nextId: reviewId
        },
        {
          id: reviewId,
          brickId: 'human-doc-review',
          kind: 'action',
          operation: 'review.pause',
          name: 'Revue facture',
          config: {
            title: 'Valider la facture',
            instructions:
              'Téléchargez les PDF, vérifiez, puis validez (= supprimer le mail) ou rejetez.',
            reviewContext:
              'Page de validation manuelle d\'un mail invoice Games Workshop : montrer expéditeur, sujet, corps et liste des PDF à télécharger. L\'humain décide Valider (supprimer le mail) ou Rejeter (garder).',
            templateNamespace: 'agent:review:invoice'
          },
          x: 80,
          y: 560,
          nextId: deleteId
        },
        {
          id: deleteId,
          brickId: 'mail-delete',
          kind: 'action',
          operation: 'mail.delete',
          name: 'Supprimer le mail',
          config: { accountRef: '', mailbox: 'INBOX', onlyOnApprove: true },
          x: 80,
          y: 680,
          nextId: null
        }
      ]
    },
    entrepriseId
  };
}

module.exports = {
  mailAgentTemplate,
  facebookAgentTemplate,
  assistedDocAgentTemplate,
  invoiceMailAgentTemplate,
  TEMPLATES: {
    'agent-mail': mailAgentTemplate,
    'agent-facebook': facebookAgentTemplate,
    'agent-assisted-doc': assistedDocAgentTemplate,
    'agent-mail-invoices': invoiceMailAgentTemplate
  }
};
