/**
 * FICHIER : backend/core/agent-flow/flowTemplates.js
 * RÔLE : Templates agents — Action écrit des champs ; IA exécute un prompt s’il y en a un.
 *        Les listes (intentions, etc.) sont des collections, pas une détection IA dédiée.
 */

const COMPOSE_PROMPT = 'À partir du message et de la liste fournie (RAG), choisis EXACTEMENT un identifiant de la liste pour le champ "intention". Le résumé va dans "resume", pas dans "intention". Si aucune entrée ne convient, utilise "generic".\n\nSujet : {{subject}}\nTexte :\n{{text}}\n\nListe :\n{{intentions}}';

function composePromptConfig() {
  return {
    actionId: 'ia.compose',
    operation: 'ia.compose',
    writeMode: 'merge',
    preset: 'ia',
    activeZone: 'prompt',
    variables: [
      { key: 'prompt', label: 'Prompt', type: 'textarea', required: true, description: 'Instruction envoyée au modèle' },
      { key: 'context', label: 'Contexte', type: 'textarea', description: 'Cadre métier, ton, règles' },
      { key: 'rag', label: 'RAG', type: 'textarea', description: 'Collection / extraits à injecter' }
    ],
    values: {
      prompt: COMPOSE_PROMPT,
      context: '',
      rag: ''
    },
    prompt: COMPOSE_PROMPT
  };
}

function listCollectionConfig(presetId, name) {
  return {
    provider: 'json',
    presetId: presetId || 'mail',
    collectionId: '',
    collectionNamespace: '',
    modelName: name || 'Liste',
    modelFields: [],
    modelRows: [],
    payload: ''
  };
}

function iaRunConfig(mapping) {
  return {
    source: 'mapped',
    writeMode: 'merge',
    prompt: '',
    mapping: mapping || {
      prompt: 'champs.prompt',
      context: 'champs.context',
      rag: 'liste_intentions.items'
    },
    literals: {}
  };
}

function mailAgentTemplate(entrepriseId) {
  const triggerId = 'node-trigger';
  const dataId = 'node-data';
  const listId = 'node-intentions';
  const analyseId = 'node-analyse';
  const iaId = 'node-ia';
  const routeId = 'node-route';
  const outId = 'node-output';
  return {
    name: 'Agent Mail',
    description: 'Mail → données → collection → prompt → IA → routage → envoi',
    enabled: true,
    templateId: 'agent-mail',
    trigger: { brickId: 'trigger', config: { mode: 'button' } },
    steps: [
      { id: dataId, brickId: 'data', operation: 'data.read', config: { provider: 'mail', instanceId: '', accountRef: '' } },
      {
        id: listId,
        brickId: 'data',
        operation: 'data.read',
        config: listCollectionConfig('mail', 'Intentions mail')
      },
      {
        id: analyseId,
        brickId: 'action',
        operation: 'action.run',
        config: composePromptConfig()
      },
      {
        id: iaId,
        brickId: 'ia',
        operation: 'ia.run',
        config: iaRunConfig()
      },
      {
        id: routeId,
        brickId: 'action',
        operation: 'action.run',
        config: { operation: 'route-intention' }
      },
      {
        id: outId,
        brickId: 'output',
        operation: 'output.emit',
        config: {
          provider: 'mail',
          connectorId: 'mail-out',
          instanceId: '',
          accountRef: '',
          to: '',
          subject: '{{subject}}',
          body: '{{body}}',
          usePreviousRoute: true
        }
      }
    ],
    canvas: {
      nodes: [
        {
          id: triggerId,
          brickId: 'trigger',
          kind: 'trigger',
          name: 'Déclencher',
          slug: 'declencher',
          config: { mode: 'button' },
          x: 80,
          y: 60,
          nextId: dataId,
          nextIds: [dataId, listId]
        },
        {
          id: dataId,
          brickId: 'data',
          kind: 'action',
          operation: 'data.read',
          name: 'Entrées mail',
          slug: 'donnees_mail',
          config: { provider: 'mail', instanceId: '', kinds: ['email'], accountRef: '' },
          x: 40,
          y: 200,
          nextId: analyseId
        },
        {
          id: listId,
          brickId: 'data',
          kind: 'action',
          operation: 'data.read',
          name: 'Liste intentions',
          slug: 'liste_intentions',
          config: listCollectionConfig('mail', 'Intentions mail'),
          x: 280,
          y: 200,
          nextId: analyseId
        },
        {
          id: analyseId,
          brickId: 'action',
          kind: 'action',
          operation: 'action.run',
          name: 'Champs',
          slug: 'champs',
          config: composePromptConfig(),
          x: 80,
          y: 420,
          nextId: iaId
        },
        {
          id: iaId,
          brickId: 'ia',
          kind: 'action',
          operation: 'ia.run',
          name: 'Exécuter l’IA',
          slug: 'ia',
          config: iaRunConfig(),
          x: 80,
          y: 540,
          nextId: routeId
        },
        {
          id: routeId,
          brickId: 'action',
          kind: 'action',
          operation: 'action.run',
          name: 'Routage',
          slug: 'routage',
          config: { operation: 'route-intention' },
          x: 80,
          y: 660,
          nextId: outId
        },
        {
          id: outId,
          brickId: 'output',
          kind: 'action',
          operation: 'output.emit',
          name: 'Envoi mail',
          slug: 'envoi_mail',
          config: {
            provider: 'mail',
            connectorId: 'mail-out',
            instanceId: '',
            accountRef: '',
            to: '',
            subject: '{{subject}}',
            body: '{{body}}',
            usePreviousRoute: true,
            mapping: {
              to: 'donnees_mail.from',
              subject: 'donnees_mail.subject',
              body: 'ia.response'
            },
            literals: {}
          },
          x: 80,
          y: 780,
          nextId: null
        }
      ]
    },
    entrepriseId
  };
}

function facebookAgentTemplate(entrepriseId) {
  const triggerId = 'node-trigger';
  const dataId = 'node-data';
  const listId = 'node-intentions';
  const analyseId = 'node-analyse';
  const iaId = 'node-ia';
  const routeId = 'node-route';
  return {
    name: 'Agent Facebook',
    description: 'Webhook Facebook → données → collection → prompt → IA → routage. Lancer manuel = dernier post.',
    enabled: true,
    templateId: 'agent-facebook',
    trigger: { brickId: 'trigger', config: { mode: 'webhook', webhookInstanceId: '' } },
    steps: [
      {
        id: dataId,
        brickId: 'data',
        operation: 'data.read',
        config: {
          provider: 'facebook',
          instanceId: '',
          kinds: ['posts'],
          pageId: '',
          ingestModes: ['poll'],
          resources: ['posts'],
          limit: 25,
          lookbackHours: 168
        }
      },
      {
        id: listId,
        brickId: 'data',
        operation: 'data.read',
        config: listCollectionConfig('reseaux-sociaux', 'Intentions réseaux')
      },
      {
        id: analyseId,
        brickId: 'action',
        operation: 'action.run',
        config: composePromptConfig()
      },
      {
        id: iaId,
        brickId: 'ia',
        operation: 'ia.run',
        config: iaRunConfig()
      },
      {
        id: routeId,
        brickId: 'action',
        operation: 'action.run',
        config: { operation: 'route-intention' }
      }
    ],
    canvas: {
      nodes: [
        {
          id: triggerId,
          brickId: 'trigger',
          kind: 'trigger',
          name: 'Déclencher',
          slug: 'declencher',
          config: { mode: 'webhook', webhookInstanceId: '' },
          x: 80,
          y: 60,
          nextId: dataId,
          nextIds: [dataId, listId]
        },
        {
          id: dataId,
          brickId: 'data',
          kind: 'action',
          operation: 'data.read',
          name: 'Entrées Facebook',
          slug: 'donnees_facebook',
          config: {
            provider: 'facebook',
            instanceId: '',
            kinds: ['posts'],
            pageId: '',
            ingestModes: ['poll'],
            resources: ['posts'],
            limit: 25,
            lookbackHours: 168
          },
          x: 40,
          y: 200,
          nextId: analyseId
        },
        {
          id: listId,
          brickId: 'data',
          kind: 'action',
          operation: 'data.read',
          name: 'Liste intentions',
          slug: 'liste_intentions',
          config: listCollectionConfig('reseaux-sociaux', 'Intentions réseaux'),
          x: 280,
          y: 200,
          nextId: analyseId
        },
        {
          id: analyseId,
          brickId: 'action',
          kind: 'action',
          operation: 'action.run',
          name: 'Champs',
          slug: 'champs',
          config: composePromptConfig(),
          x: 80,
          y: 420,
          nextId: iaId
        },
        {
          id: iaId,
          brickId: 'ia',
          kind: 'action',
          operation: 'ia.run',
          name: 'Exécuter l’IA',
          slug: 'ia',
          config: iaRunConfig(),
          x: 80,
          y: 540,
          nextId: routeId
        },
        {
          id: routeId,
          brickId: 'action',
          kind: 'action',
          operation: 'action.run',
          name: 'Routage',
          slug: 'routage',
          config: { operation: 'route-intention' },
          x: 80,
          y: 660,
          nextId: null
        }
      ]
    },
    entrepriseId
  };
}

function assistedDocAgentTemplate(entrepriseId) {
  const triggerId = 'node-trigger';
  const listId = 'node-intentions';
  const analyseId = 'node-analyse';
  const iaId = 'node-ia';
  const reviewId = 'node-validation';
  const routeId = 'node-route';
  return {
    name: 'Agent avec validation',
    description: 'Manuel → collection → prompt → IA → validation humaine → routage',
    enabled: true,
    templateId: 'agent-assisted-doc',
    trigger: { brickId: 'trigger', config: { mode: 'button' } },
    steps: [
      {
        id: listId,
        brickId: 'data',
        operation: 'data.read',
        config: listCollectionConfig('mail', 'Intentions mail')
      },
      {
        id: analyseId,
        brickId: 'action',
        operation: 'action.run',
        config: composePromptConfig()
      },
      {
        id: iaId,
        brickId: 'ia',
        operation: 'ia.run',
        config: iaRunConfig()
      },
      {
        id: reviewId,
        brickId: 'validation',
        operation: 'validation.pause',
        config: {
          title: 'Revue avant routage',
          instructions: 'Vérifiez puis validez.',
          templateNamespace: ''
        }
      },
      {
        id: routeId,
        brickId: 'action',
        operation: 'action.run',
        config: { operation: 'route-intention' }
      }
    ],
    canvas: {
      nodes: [
        {
          id: triggerId,
          brickId: 'trigger',
          kind: 'trigger',
          name: 'Déclencher',
          slug: 'declencher',
          config: { mode: 'button' },
          x: 80,
          y: 60,
          nextId: listId
        },
        {
          id: listId,
          brickId: 'data',
          kind: 'action',
          operation: 'data.read',
          name: 'Liste intentions',
          slug: 'liste_intentions',
          config: listCollectionConfig('mail', 'Intentions mail'),
          x: 80,
          y: 180,
          nextId: analyseId
        },
        {
          id: analyseId,
          brickId: 'action',
          kind: 'action',
          operation: 'action.run',
          name: 'Champs',
          slug: 'champs',
          config: composePromptConfig(),
          x: 80,
          y: 300,
          nextId: iaId
        },
        {
          id: iaId,
          brickId: 'ia',
          kind: 'action',
          operation: 'ia.run',
          name: 'Exécuter l’IA',
          slug: 'ia',
          config: iaRunConfig(),
          x: 80,
          y: 420,
          nextId: reviewId
        },
        {
          id: reviewId,
          brickId: 'validation',
          kind: 'action',
          operation: 'validation.pause',
          name: 'Validation',
          slug: 'validation',
          config: {
            title: 'Revue avant routage',
            instructions: 'Vérifiez puis validez.',
            templateNamespace: ''
          },
          x: 80,
          y: 540,
          nextId: routeId
        },
        {
          id: routeId,
          brickId: 'action',
          kind: 'action',
          operation: 'action.run',
          name: 'Routage',
          slug: 'routage',
          config: { operation: 'route-intention' },
          x: 80,
          y: 660,
          nextId: null
        }
      ]
    },
    entrepriseId
  };
}

function invoiceMailAgentTemplate(entrepriseId) {
  const triggerId = 'node-trigger';
  const dataId = 'node-data';
  const ifFromId = 'node-if-from';
  const ifSubjectId = 'node-if-subject';
  const saveId = 'node-save';
  const reviewId = 'node-validation';
  const delId = 'node-delete';
  return {
    name: 'Agent factures mail',
    description: 'Mail → filtres → PJ → validation → suppression IMAP si validé',
    enabled: true,
    templateId: 'agent-mail-invoices',
    trigger: { brickId: 'trigger', config: { mode: 'button' } },
    agentContext: 'Traite les factures reçues par mail avec validation humaine.',
    steps: [],
    canvas: {
      nodes: [
        {
          id: triggerId,
          brickId: 'trigger',
          kind: 'trigger',
          name: 'Déclencher',
          slug: 'declencher',
          config: { mode: 'button' },
          x: 80,
          y: 40,
          nextId: dataId
        },
        {
          id: dataId,
          brickId: 'data',
          kind: 'action',
          operation: 'data.read',
          name: 'Entrées mail',
          slug: 'donnees_mail',
          config: { provider: 'mail' },
          x: 80,
          y: 140,
          nextId: ifFromId
        },
        {
          id: ifFromId,
          brickId: 'condition',
          kind: 'action',
          operation: 'condition.if',
          name: 'Si expéditeur',
          slug: 'si_expediteur',
          config: { mode: 'if', field: 'from', op: 'contains', value: 'games workshop' },
          x: 80,
          y: 240,
          nextId: ifSubjectId,
          nextFalseId: null
        },
        {
          id: ifSubjectId,
          brickId: 'condition',
          kind: 'action',
          operation: 'condition.if',
          name: 'Si sujet invoice',
          slug: 'si_sujet_invoice',
          config: { mode: 'if', field: 'subject', op: 'contains', value: 'invoice' },
          x: 80,
          y: 340,
          nextId: saveId,
          nextFalseId: null
        },
        {
          id: saveId,
          brickId: 'action',
          kind: 'action',
          operation: 'action.run',
          name: 'Sauver PJ',
          slug: 'sauver_pj',
          config: { kind: 'function', actionId: 'mail.save-attachments', operation: 'mail.save-attachments', subfolder: 'factures' },
          x: 80,
          y: 440,
          nextId: reviewId
        },
        {
          id: reviewId,
          brickId: 'validation',
          kind: 'action',
          operation: 'validation.pause',
          name: 'Validation facture',
          slug: 'validation_facture',
          config: {
            title: 'Revue facture',
            instructions: 'Vérifiez la facture puis validez ou rejetez.',
            templateNamespace: 'agent:review:invoice'
          },
          x: 80,
          y: 540,
          nextId: delId
        },
        {
          id: delId,
          brickId: 'action',
          kind: 'action',
          operation: 'action.run',
          name: 'Supprimer mail',
          config: { kind: 'function', actionId: 'mail.delete', operation: 'mail.delete', onlyOnApprove: true },
          x: 80,
          y: 640,
          nextId: null
        }
      ]
    },
    entrepriseId
  };
}

const DESIGN_CHROME_PROMPT = 'Tu produis le CADRE d’une page web (header, nav, main, footer). Pas de contenu métier.\n'
  + 'Marque : {{brand}}\nLogo : {{logoUrl}}\n'
  + 'Couleurs : principal {{primary}}, fond {{background}}, surface {{surface}}, texte {{text}}, secondaire {{muted}}\n'
  + 'Zones : {{zones}}\nTon : {{tone}}\n'
  + 'JSON uniquement : { "html": "...", "css": "..." }. html = structure avec les zones ; css = feuilles de style. Placeholders {{zone}} dans le HTML.';

function designFieldsConfig() {
  return {
    actionId: 'ia.compose',
    operation: 'ia.compose',
    writeMode: 'merge',
    activeZone: 'prompt',
    variables: [
      { key: 'brand', label: 'Marque / titre', type: 'text', required: true },
      { key: 'logoUrl', label: 'Logo (URL)', type: 'text' },
      { key: 'primary', label: 'Couleur principale', type: 'text' },
      { key: 'background', label: 'Fond', type: 'text' },
      { key: 'surface', label: 'Cartes', type: 'text' },
      { key: 'text', label: 'Texte', type: 'text' },
      { key: 'muted', label: 'Texte secondaire', type: 'text' },
      { key: 'zones', label: 'Zones', type: 'text' },
      { key: 'tone', label: 'Ton / style', type: 'textarea' },
      { key: 'prompt', label: 'Prompt chrome', type: 'textarea', required: true }
    ],
    values: {
      brand: 'Mon entreprise',
      primary: '#1d4ed8',
      background: '#f1f5f9',
      surface: '#ffffff',
      text: '#0f172a',
      muted: '#64748b',
      zones: 'header, nav, main, footer',
      tone: 'Page web claire, admin SaaS',
      prompt: DESIGN_CHROME_PROMPT
    },
    prompt: DESIGN_CHROME_PROMPT
  };
}

function designPageWebAgentTemplate(entrepriseId) {
  const triggerId = 'node-trigger';
  const dataId = 'node-collection';
  const fieldsId = 'node-fields';
  const iaId = 'node-ia';
  const outId = 'node-output';
  const hookId = 'node-hook';
  return {
    name: 'Design page web',
    description: 'Agent GDRI : couleurs, logo, zones. Importable comme sous-agent. Aucun champ métier.',
    enabled: true,
    templateId: 'agent-design-page-web',
    official: true,
    importable: true,
    agentContext: 'Tâche dirigée : cadre d’une page web (tokens + zones), jamais le métier du flux hôte.',
    trigger: { brickId: 'trigger', config: { mode: 'button' } },
    steps: [
      {
        id: dataId,
        brickId: 'data',
        operation: 'data.read',
        config: {
          provider: 'json',
          presetId: '',
          collectionId: '',
          collectionNamespace: 'atelier-design-page-web',
          modelName: 'Design page web'
        }
      },
      { id: fieldsId, brickId: 'action', operation: 'action.run', config: designFieldsConfig() },
      { id: iaId, brickId: 'ia', operation: 'ia.run', config: iaRunConfig({
        prompt: 'champs.prompt',
        context: 'champs.tone',
        rag: 'collection_design.items'
      }) },
      {
        id: outId,
        brickId: 'output',
        operation: 'output.emit',
        config: {
          provider: 'flow',
          connectorId: 'flow',
          exportName: 'chrome'
        }
      },
      {
        id: hookId,
        brickId: 'action',
        operation: 'action.run',
        config: { kind: 'function', actionId: 'surface.hook', operation: 'surface.hook', surface: 'tab' }
      }
    ],
    canvas: {
      nodes: [
        {
          id: triggerId,
          brickId: 'trigger',
          kind: 'trigger',
          name: 'Déclencher',
          slug: 'declencher',
          config: { mode: 'button' },
          x: 80,
          y: 60,
          nextId: dataId,
          nextIds: [dataId]
        },
        {
          id: dataId,
          brickId: 'data',
          kind: 'action',
          operation: 'data.read',
          name: 'Collection design',
          slug: 'collection_design',
          config: {
            provider: 'json',
            collectionId: '',
            collectionNamespace: 'atelier-design-page-web',
            modelName: 'Design page web'
          },
          x: 80,
          y: 200,
          nextId: fieldsId,
          nextIds: [fieldsId]
        },
        {
          id: fieldsId,
          brickId: 'action',
          kind: 'action',
          operation: 'action.run',
          name: 'Champs design',
          slug: 'champs',
          config: designFieldsConfig(),
          x: 80,
          y: 340,
          nextId: iaId,
          nextIds: [iaId]
        },
        {
          id: iaId,
          brickId: 'ia',
          kind: 'action',
          operation: 'ia.run',
          name: 'IA chrome',
          slug: 'ia',
          config: iaRunConfig({
            prompt: 'champs.prompt',
            context: 'champs.tone',
            rag: 'collection_design.items'
          }),
          x: 80,
          y: 480,
          nextId: outId,
          nextIds: [outId]
        },
        {
          id: outId,
          brickId: 'output',
          kind: 'action',
          operation: 'output.emit',
          name: 'Sortie flux',
          slug: 'sortie_chrome',
          config: {
            provider: 'flow',
            connectorId: 'flow',
            exportName: 'chrome'
          },
          x: 80,
          y: 620,
          nextId: hookId,
          nextIds: [hookId]
        },
        {
          id: hookId,
          brickId: 'action',
          kind: 'action',
          operation: 'action.run',
          name: 'Accrocher (onglet)',
          slug: 'hook',
          config: { kind: 'function', actionId: 'surface.hook', operation: 'surface.hook', surface: 'tab' },
          x: 80,
          y: 760,
          nextId: null,
          nextIds: []
        }
      ]
    },
    entrepriseId
  };
}

const { vizConceptionFlow, FLOW_TEMPLATE_ID: VIZ_CONCEPTION_ID } = require('./vizConception');

const TEMPLATES = {
  'agent-mail': mailAgentTemplate,
  'agent-facebook': facebookAgentTemplate,
  'agent-assisted-doc': assistedDocAgentTemplate,
  'agent-mail-invoices': invoiceMailAgentTemplate,
  'agent-design-page-web': designPageWebAgentTemplate,
  [VIZ_CONCEPTION_ID]: vizConceptionFlow
};

const TEMPLATE_CATALOG = [
  { id: 'agent-mail', name: 'Agent Mail', description: 'Mail → collection → prompt → IA → routage → envoi' },
  { id: 'agent-facebook', name: 'Agent Facebook', description: 'Facebook → collection → prompt → IA → routage' },
  { id: 'agent-assisted-doc', name: 'Agent avec validation', description: 'Collection → prompt → IA → validation → routage' },
  {
    id: 'agent-mail-invoices',
    name: 'Agent factures mail',
    description: 'Mail → conditions → PJ → validation → suppression IMAP'
  },
  {
    id: 'agent-design-page-web',
    name: 'Design page web',
    description: 'Agent GDRI : couleurs, logo, zones. Importable comme sous-agent.',
    official: true,
    importable: true
  }
];

module.exports = {
  mailAgentTemplate,
  facebookAgentTemplate,
  assistedDocAgentTemplate,
  invoiceMailAgentTemplate,
  designPageWebAgentTemplate,
  vizConceptionFlow,
  TEMPLATES,
  TEMPLATE_CATALOG
};
