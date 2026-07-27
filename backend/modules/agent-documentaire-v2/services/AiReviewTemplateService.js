/**
 * Génération IA d'un template canvas « revue mail / facture ».
 */

const path = require('path');

const ALLOWED_VARS = [
  'from',
  'subject',
  'text',
  'sourceRef',
  'messageId',
  'channel',
  'author.email',
  'author.name',
  'attachments_html',
  'attachmentCount',
  'metadata.accountRef',
  'metadata.mailbox'
];

function safeId(raw, fallback) {
  const s = String(raw || fallback || 'zone')
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
  return s || fallback || 'zone';
}

function clamp(n, min, max) {
  const v = Number(n);
  if (!Number.isFinite(v)) return min;
  return Math.min(max, Math.max(min, v));
}

class AiReviewTemplateService {
  buildPrompt({ brief, agentContext, reviewContext, namespace, fields }) {
    const fieldList = (fields || ALLOWED_VARS).map((f) => `- {{${f}}}`).join('\n');
    return [
      'Tu conçois une page A4 de DÉTAIL pour UN SEUL mail (pas une liste).',
      'À l\'exécution : 1 run = 1 mail. La liste des mails en attente est gérée à part (file d\'attente).',
      'Cette page affiche le mail courant (expéditeur, sujet, corps, pièces jointes) pour Valider / Rejeter.',
      'Retourne UNIQUEMENT un JSON valide (pas de markdown, pas de commentaire).',
      '',
      'Schéma exact :',
      '{',
      '  "name": "string",',
      '  "zones": [',
      '    {',
      '      "id": "snake_case",',
      '      "title": "libellé zone",',
      '      "html": "HTML simple avec variables {{...}}",',
      '      "y": 15,',
      '      "height": 28,',
      '      "accent": "#2563eb"',
      '    }',
      '  ]',
      '}',
      '',
      'Contraintes :',
      '- Format page A4 verticale, y et height en mm (marges 15 mm).',
      '- 3 à 5 zones max, non chevauchantes, y croissant.',
      '- HTML simple uniquement : p, strong, ul, li, h1, h2, a, br — pas de script.',
      '- NE PAS inventer une liste de mails (pas de tableau multi-lignes factice).',
      '- Utilise UNIQUEMENT ces variables (données DU mail courant) :',
      fieldList,
      '- Inclus obligatoirement {{from}}, {{subject}}, {{text}}, {{attachments_html}}.',
      '- La dernière zone doit afficher les pièces jointes.',
      '- La page doit aider un humain à valider/rejeter CE mail avant action (ex. suppression).',
      '',
      `Namespace cible : ${namespace || 'agent:review:invoice'}`,
      '',
      '=== CONTEXTE GÉNÉRAL DE L\'AGENT (mission globale / file de mails) ===',
      agentContext || brief || '(non précisé)',
      '',
      '=== CONTEXTE DE LA PAGE DE DÉTAIL (ce que l\'humain contrôle SUR UN mail) ===',
      reviewContext || brief || '(non précisé — détail du mail courant et de ses PJ)',
      '',
      'Conçois le détail d\'UN mail, pas une boîte de réception.'
    ].join('\n');
  }

  validateAiPayload(data) {
    if (!data || typeof data !== 'object' || !Array.isArray(data.zones) || !data.zones.length) {
      return null;
    }
    const zones = data.zones
      .filter((z) => z && (z.html || z.title))
      .slice(0, 6)
      .map((z, i) => ({
        id: safeId(z.id, `zone_${i + 1}`),
        title: String(z.title || `Zone ${i + 1}`).slice(0, 80),
        html: String(z.html || '<p></p>').slice(0, 8000),
        y: clamp(z.y, 15, 250),
        height: clamp(z.height, 16, 140),
        accent: String(z.accent || '#2563eb').slice(0, 32)
      }));
    if (!zones.length) return null;
    return {
      name: String(data.name || 'Revue mail IA').slice(0, 120),
      zones
    };
  }

  layoutZones(zones) {
    let y = 15;
    return zones.map((z, i) => {
      const height = clamp(z.height, 18, 120);
      const placed = { ...z, y, height };
      y += height + 6;
      if (y > 280 && i < zones.length - 1) {
        // compress remaining into remaining space
        placed.height = Math.max(18, Math.min(height, 297 - 15 - y + height));
      }
      return placed;
    });
  }

  buildTemplateFromZones(namespace, payload) {
    const zones = this.layoutZones(payload.zones);
    const nodes = [];
    zones.forEach((z, index) => {
      const zoneId = `zone_${z.id}`;
      const tfId = `tf_${z.id}`;
      nodes.push({
        id: zoneId,
        type: 'zone',
        zoneType: z.id,
        label: z.title,
        parentId: null,
        layout: { x: 15, y: z.y, width: 180, height: z.height, unit: 'mm' },
        zIndex: index + 1,
        style: {
          border: `1px solid ${z.accent || '#cbd5e1'}`,
          backgroundColor: 'rgba(255,255,255,0.96)'
        },
        children: [tfId]
      });
      nodes.push({
        id: tfId,
        type: 'text-frame',
        parentId: zoneId,
        layout: { x: 3, y: 3, width: 174, height: Math.max(12, z.height - 6), unit: 'mm' },
        content: {
          mode: 'flow',
          html: z.html
        },
        style: { fontSize: 11 }
      });
    });

    return {
      namespace: String(namespace),
      name: payload.name || 'Revue mail IA',
      documentMode: 'canvas',
      scope: 'agent-review',
      page: {
        format: 'A4',
        widthMm: 210,
        heightMm: 297,
        margins: { top: 15, right: 15, bottom: 15, left: 15 }
      },
      guides: { vertical: [], horizontal: [] },
      snap: {
        enabled: true,
        thresholdMm: 1.5,
        snapToPage: true,
        snapToGuides: true,
        snapToNodes: true
      },
      nodes
    };
  }

  fallbackPayload(brief) {
    return {
      name: 'Revue facture (IA fallback)',
      zones: [
        {
          id: 'header',
          title: 'En-tête',
          y: 15,
          height: 22,
          accent: '#2563eb',
          html: `<h1 style="margin:0;font-size:18px;">Revue facture</h1><p style="margin:4px 0 0;color:#64748b;">${String(brief || 'Validez le mail et les pièces jointes.').slice(0, 160)}</p>`
        },
        {
          id: 'meta',
          title: 'Métadonnées',
          y: 43,
          height: 30,
          accent: '#94a3b8',
          html: '<p><strong>De :</strong> {{from}}</p><p><strong>Sujet :</strong> {{subject}}</p><p><strong>Réf. :</strong> {{sourceRef}}</p>'
        },
        {
          id: 'body',
          title: 'Corps',
          y: 79,
          height: 110,
          accent: '#cbd5e1',
          html: '<p><strong>Corps du mail</strong></p><p>{{text}}</p>'
        },
        {
          id: 'attachments',
          title: 'Pièces jointes',
          y: 195,
          height: 55,
          accent: '#ea580c',
          html: '<p><strong>Pièces jointes ({{attachmentCount}})</strong></p><p>{{attachments_html}}</p>'
        }
      ]
    };
  }

  async generate({ namespace, brief, agentContext, reviewContext, entrepriseId }) {
    const ns = String(namespace || 'agent:review:invoice').trim();
    const agentCtx = String(agentContext || '').trim();
    const reviewCtx = String(reviewContext || brief || '').trim();
    let payload = null;
    let source = 'fallback';
    let iaMeta = null;
    let iaError = null;

    try {
      const PromptService = require(path.resolve(
        __dirname,
        '../../../../modules/prompt/backend/services/PromptService'
      ));
      const promptService = entrepriseId
        ? await PromptService.forEntity(String(entrepriseId))
        : PromptService.global();

      const prompt = this.buildPrompt({
        brief,
        agentContext: agentCtx,
        reviewContext: reviewCtx,
        namespace: ns,
        fields: ALLOWED_VARS
      });
      const gen = await promptService.generateJson(
        prompt,
        { max_tokens: 1800, temperature: 0.3 },
        {
          retries: 1,
          validate: (data) => this.validateAiPayload(data)
        }
      );

      if (gen.success && gen.data) {
        payload = gen.data;
        source = 'ia';
        iaMeta = gen.meta || null;
      } else {
        iaError = gen.error?.message || 'Réponse IA invalide';
      }
    } catch (err) {
      iaError = err.message || 'IA indisponible';
    }

    if (!payload) {
      payload = this.validateAiPayload(
        this.fallbackPayload(reviewCtx || agentCtx || brief)
      );
      source = iaError ? 'fallback' : source;
    }

    const template = this.buildTemplateFromZones(ns, payload);
    return {
      template,
      source,
      iaError,
      iaMeta,
      allowedVars: ALLOWED_VARS
    };
  }
}

module.exports = AiReviewTemplateService;
