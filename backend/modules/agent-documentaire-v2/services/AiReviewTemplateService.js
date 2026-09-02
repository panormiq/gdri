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
  'metadata.mailbox',
  'items_html',
  'itemsCount',
  'data_html'
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

function isMailContract(dataContract) {
  const providers = ((dataContract && dataContract.providers) || []).map((p) => String(p).toLowerCase());
  return providers.includes('mail') || providers.includes('mail-in');
}

function resolveAllowedVars(dataContract) {
  const extra = ((dataContract && dataContract.fields) || [])
    .map((f) => f && f.key)
    .filter(Boolean);
  const reviewVars = ['items_html', 'itemsCount', 'data_html'];
  if (extra.length) {
    const seen = new Set();
    const out = [];
    extra.concat(reviewVars).forEach((key) => {
      if (!seen.has(key)) {
        seen.add(key);
        out.push(key);
      }
    });
    if (isMailContract(dataContract) || seen.has('attachments')) {
      ['attachments_html', 'attachmentCount'].forEach((key) => {
        if (!seen.has(key)) {
          seen.add(key);
          out.push(key);
        }
      });
    }
    return out;
  }
  return ALLOWED_VARS;
}

function formatDataContractForPrompt(dataContract) {
  if (!dataContract || typeof dataContract !== 'object') {
    return '(aucun contrat — utilise les variables génériques ci-dessus)';
  }
  const providers = Array.isArray(dataContract.providers) && dataContract.providers.length
    ? dataContract.providers.join(', ')
    : '—';
  const kinds = Array.isArray(dataContract.kinds) && dataContract.kinds.length
    ? dataContract.kinds.join(', ')
    : '—';
  const fields = Array.isArray(dataContract.fields) ? dataContract.fields : [];
  const lines = fields.map((f) => `- {{${f.key}}} — ${f.label || f.key}`);
  return [
    `Connecteur(s) : ${providers}`,
    `Types lus : ${kinds}`,
    'Champs réellement renvoyés par la brique Données :',
    lines.length ? lines.join('\n') : '(aucun champ)'
  ].join('\n');
}

function inferRole(zone) {
  const explicit = String((zone && zone.role) || '').toLowerCase();
  const known = ['header', 'meta', 'field', 'body', 'list', 'attachments', 'footer'];
  if (known.indexOf(explicit) >= 0) return explicit;
  const raw = String((zone && (zone.id || zone.title)) || '').toLowerCase();
  if (/header|titre|hero|en-tete|entete/.test(raw)) return 'header';
  if (/attach|pj|piece/.test(raw)) return 'attachments';
  if (/footer|action|valider|pied/.test(raw)) return 'footer';
  if (/list|liste|items|check|coche/.test(raw)) return 'list';
  if (/body|message|texte|contenu/.test(raw)) return 'body';
  if (/meta|from|sujet|expediteur/.test(raw)) return 'meta';
  return 'field';
}

function inferWidth(role, requested) {
  const w = String(requested || '').toLowerCase();
  if (w === 'half' || w === 'full') return w;
  if (role === 'meta' || role === 'field') return 'half';
  return 'full';
}

function defaultHeight(role) {
  if (role === 'header') return 36;
  if (role === 'list') return 88;
  if (role === 'body') return 72;
  if (role === 'attachments') return 38;
  if (role === 'footer') return 20;
  return 26;
}

function zoneSkin(role) {
  if (role === 'header') {
    return { border: 'none', backgroundColor: '#0f172a', borderRadius: '2.5mm' };
  }
  if (role === 'attachments') {
    return { border: '1px solid #fdba74', backgroundColor: 'rgba(255,247,237,0.96)', borderRadius: '2mm' };
  }
  if (role === 'footer') {
    return { border: 'none', backgroundColor: 'transparent' };
  }
  return { border: '1px solid #e2e8f0', backgroundColor: '#ffffff', borderRadius: '2mm' };
}

function escapeText(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function headerHtml(payload) {
  const kicker = escapeText(payload.kicker || 'À traiter');
  const title = escapeText(payload.page_title || payload.name || 'Page agent');
  const lead = escapeText(payload.lead || '');
  return [
    `<p style="margin:0;font-size:8pt;letter-spacing:.14em;text-transform:uppercase;color:#93c5fd;">${kicker}</p>`,
    `<h1 style="margin:1.5mm 0 0;font-size:16pt;line-height:1.15;color:#ffffff;letter-spacing:-.03em;">${title}</h1>`,
    lead ? `<p style="margin:2mm 0 0;font-size:9.5pt;color:#cbd5e1;line-height:1.4;">${lead}</p>` : ''
  ].join('');
}

function wrapZoneHtml(role, title, html) {
  const inner = String(html || '').trim() || '<p></p>';
  if (role === 'header') {
    if (/color\s*:/.test(inner)) return inner;
    return `<div style="color:#f8fafc;">${inner}</div>`;
  }
  if (role === 'footer') return inner;
  const label = escapeText(title || '');
  if (label && !new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(inner.replace(/<[^>]+>/g, ''))) {
    return `<p style="margin:0 0 2mm;font-size:7.5pt;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#64748b;">${label}</p>${inner}`;
  }
  return inner;
}

class AiReviewTemplateService {
  buildPrompt({ brief, agentContext, reviewContext, namespace, fields, dataContract }) {
    const fieldList = (fields || ALLOWED_VARS).map((f) => `- {{${f}}}`).join('\n');
    return [
      'Tu conçois un DOCUMENT A4 d’interaction (même qualité qu’un devis : en-tête, cartes, placeholders).',
      'Tu dessines la structure. Le moteur documents pose la page, les marges et le CSS.',
      'Suis EN PRIORITÉ le contexte de page (demande utilisateur).',
      'Retourne UNIQUEMENT un JSON valide.',
      '',
      'Schéma :',
      '{',
      '  "name": "nom court du document",',
      '  "page_title": "titre affiché",',
      '  "kicker": "label 2 à 4 mots",',
      '  "lead": "consigne, 1 phrase",',
      '  "zones": [',
      '    {',
      '      "id": "snake_case",',
      '      "role": "header|meta|field|body|list|attachments|footer",',
      '      "width": "full|half",',
      '      "title": "libellé de zone",',
      '      "html": "HTML simple avec {{placeholders}}"',
      '    }',
      '  ]',
      '}',
      '',
      'Règles :',
      '- 3 à 6 zones. role header une seule fois (ou omis : le moteur le crée).',
      '- width half pour les fiches courtes (expéditeur, sujet), full pour texte long / liste / PJ.',
      '- HTML : p, strong, ul, li, h1, h2, a, br, label, input checkbox, table. Pas de script, pas de CSS de page.',
      '- Placeholders UNIQUEMENT parmi :',
      fieldList,
      '- N’invente ni marque, ni chiffres, ni variables hors contrat.',
      '- Si liste à cocher : zone list avec {{items_html}} et {{itemsCount}}.',
      isMailContract(dataContract)
        ? '- Canal mail : {{from}}, {{subject}}, {{text}}, {{attachments_html}} si présents au contrat.'
        : '- Pas de champs mail si le contrat n’est pas mail.',
      '- Ne force pas une « revue facture » si l’utilisateur n’en parle pas.',
      '',
      `Namespace : ${namespace || 'agent:review'}`,
      '',
      '=== CONTEXTE GÉNÉRAL DE L’AGENT ===',
      agentContext || '(non précisé)',
      '',
      '=== CONTEXTE DE CETTE PAGE (prioritaire) ===',
      reviewContext || brief || '(non précisé)',
      '',
      '=== CONTRAT DONNÉES ===',
      formatDataContractForPrompt(dataContract)
    ].join('\n');
  }

  validateAiPayload(data) {
    if (!data || typeof data !== 'object') return null;
    let rawZones = Array.isArray(data.zones) ? data.zones : [];
    if (!rawZones.length && Array.isArray(data.cards)) {
      rawZones = data.cards.map((c, i) => ({
        id: (c && c.key) || `card_${i + 1}`,
        title: (c && (c.title || c.key)) || `Zone ${i + 1}`,
        role: (c && c.kind) === 'html' ? 'attachments' : ((c && c.kind) === 'body' ? 'body' : 'field'),
        width: c && c.wide ? 'full' : 'half',
        html: (c && c.key) ? `<p>{{${c.key}}}</p>` : '<p></p>'
      }));
    }
    const zones = rawZones
      .filter((z) => z && (z.html || z.title || z.role))
      .slice(0, 8)
      .map((z, i) => {
        const role = inferRole(z);
        return {
          id: safeId(z.id, `zone_${i + 1}`),
          title: String(z.title || `Zone ${i + 1}`).slice(0, 80),
          html: String(z.html || '<p></p>').slice(0, 8000),
          role,
          width: inferWidth(role, z.width),
          height: clamp(z.height || defaultHeight(role), 16, 140)
        };
      });
    if (!zones.length && !String(data.page_title || data.name || '').trim()) return null;
    return {
      name: String(data.name || data.page_title || 'Page agent').slice(0, 120),
      page_title: String(data.page_title || data.title || data.name || '').slice(0, 120),
      kicker: String(data.kicker || '').slice(0, 48),
      lead: String(data.lead || '').slice(0, 280),
      zones
    };
  }

  layoutZones(zones) {
    const list = Array.isArray(zones) ? zones : [];
    const placed = [];
    let y = 15;
    let pending = null;
    const flushPending = () => {
      if (!pending) return;
      placed.push(pending);
      y = pending.y + pending.height + 5;
      pending = null;
    };
    list.forEach((z) => {
      const height = clamp(z.height || defaultHeight(z.role), 18, 120);
      const half = z.width === 'half' && z.role !== 'header';
      if (half && pending) {
        const rowH = Math.max(pending.height, height);
        pending.height = rowH;
        placed.push(pending);
        placed.push({ ...z, x: 110, y: pending.y, widthMm: 85, height: rowH });
        y = pending.y + rowH + 5;
        pending = null;
        return;
      }
      if (half) {
        pending = { ...z, x: 15, y, widthMm: 85, height };
        return;
      }
      flushPending();
      placed.push({ ...z, x: 15, y, widthMm: 180, height });
      y += height + 5;
    });
    flushPending();
    return placed;
  }

  buildTemplateFromZones(namespace, payload) {
    let source = Array.isArray(payload.zones) ? payload.zones.slice() : [];
    if (!source.some((z) => z.role === 'header')) {
      source.unshift({
        id: 'header',
        role: 'header',
        title: payload.page_title || payload.name || 'Page agent',
        width: 'full',
        height: defaultHeight('header'),
        html: headerHtml(payload)
      });
    }
    if (!source.some((z) => z.role && z.role !== 'header')) {
      source.push({
        id: 'body',
        role: 'body',
        title: 'Données',
        width: 'full',
        height: defaultHeight('body'),
        html: '<p style="margin:0;white-space:pre-wrap;">{{text}}</p>{{items_html}}'
      });
    }
    const zones = this.layoutZones(source);
    const nodes = [];
    zones.forEach((z, index) => {
      const zoneId = `zone_${z.id}`;
      const tfId = `tf_${z.id}`;
      const width = Number(z.widthMm) || 180;
      const x = Number(z.x) || 15;
      const pad = 3;
      nodes.push({
        id: zoneId,
        type: 'zone',
        zoneType: z.role || z.id,
        label: z.title,
        parentId: null,
        layout: { x, y: z.y, width, height: z.height, unit: 'mm' },
        zIndex: index + 1,
        style: zoneSkin(z.role),
        children: [tfId]
      });
      nodes.push({
        id: tfId,
        type: 'text-frame',
        parentId: zoneId,
        layout: {
          x: pad,
          y: pad,
          width: Math.max(12, width - pad * 2),
          height: Math.max(12, z.height - pad * 2),
          unit: 'mm'
        },
        content: {
          mode: 'flow',
          html: z.role === 'header' && !String(z.html || '').trim()
            ? headerHtml(payload)
            : wrapZoneHtml(z.role, z.title, z.html)
        },
        style: { fontSize: z.role === 'header' ? 12 : 10 }
      });
    });

    return {
      namespace: String(namespace),
      name: payload.name || payload.page_title || 'Page agent',
      documentMode: 'canvas',
      scope: 'agent-review',
      page: {
        format: 'A4',
        widthMm: 210,
        heightMm: 297,
        margins: { top: 15, right: 15, bottom: 15, left: 15 }
      },
      guides: { vertical: [105], horizontal: [52] },
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

  fallbackPayload(brief, dataContract) {
    const title = String(brief || 'Page agent').replace(/\s+/g, ' ').trim().slice(0, 90) || 'Page agent';
    const text = title.toLowerCase();
    const wantsList = /liste|case|coch|checkbox|donn[eé]es|items|lignes/.test(text);
    if (wantsList) {
      return {
        name: 'Validation des données',
        page_title: title,
        kicker: 'À valider',
        lead: 'Cochez les éléments concernés, puis validez.',
        zones: [
          {
            id: 'count',
            role: 'field',
            width: 'half',
            title: 'Éléments',
            html: '<p style="margin:0;font-size:16pt;font-weight:700;">{{itemsCount}}</p>'
          },
          {
            id: 'items',
            role: 'list',
            width: 'full',
            title: 'Liste',
            html: '{{items_html}}'
          }
        ]
      };
    }
    const fields = ((dataContract && dataContract.fields) || []).map((f) => f && f.key).filter(Boolean);
    const mail = isMailContract(dataContract)
      || fields.includes('from')
      || fields.includes('subject')
      || fields.includes('attachments_html');
    if (mail) {
      return {
        name: 'Revue mail',
        page_title: title,
        kicker: 'Boîte à traiter',
        lead: 'Vérifiez l’expéditeur, le sujet et les pièces avant de valider.',
        zones: [
          { id: 'from', role: 'field', width: 'half', title: 'De', html: '<p style="margin:0;font-weight:700;">{{from}}</p>' },
          { id: 'subject', role: 'field', width: 'half', title: 'Sujet', html: '<p style="margin:0;font-weight:700;">{{subject}}</p>' },
          { id: 'text', role: 'body', width: 'full', title: 'Message', html: '<p style="margin:0;white-space:pre-wrap;">{{text}}</p>' },
          { id: 'pj', role: 'attachments', width: 'full', title: 'Pièces jointes', html: '{{attachments_html}}' }
        ]
      };
    }
    return {
      name: title,
      page_title: title,
      kicker: 'À traiter',
      lead: 'Contrôlez les informations, puis validez ou rejetez.',
      zones: [
        { id: 'from', role: 'field', width: 'half', title: 'Source', html: '<p style="margin:0;font-weight:700;">{{from}}</p>' },
        { id: 'subject', role: 'field', width: 'half', title: 'Sujet', html: '<p style="margin:0;font-weight:700;">{{subject}}</p>' },
        { id: 'body', role: 'body', width: 'full', title: 'Données', html: '<p>{{data_html}}</p><p style="white-space:pre-wrap;">{{text}}</p>' }
      ]
    };
  }

  async generate({ namespace, brief, agentContext, reviewContext, dataContract, entrepriseId }) {
    const ns = String(namespace || 'agent:review:invoice').trim();
    const agentCtx = String(agentContext || '').trim();
    const reviewCtx = String(reviewContext || brief || '').trim();
    const contract = dataContract && typeof dataContract === 'object' ? dataContract : null;
    const allowedVars = resolveAllowedVars(contract);
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
        fields: allowedVars,
        dataContract: contract
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
        this.fallbackPayload(reviewCtx || agentCtx || brief, contract)
      );
      source = iaError ? 'fallback' : source;
    }

    const template = this.buildTemplateFromZones(ns, payload);
    template.metadata = {
      agentPageContext: {
        agentContext: agentCtx,
        reviewContext: reviewCtx,
        dataContract: contract
      }
    };
    return {
      template,
      source,
      iaError,
      iaMeta,
      allowedVars
    };
  }
}

module.exports = AiReviewTemplateService;
