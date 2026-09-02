/**
 * Templates de production (console plateforme).
 * La mise en page est figée ici. L’IA / le flux ne font que remplir les {{slots}}.
 */

const DOC_CSS = `
.agent-prod-doc{font-family:Inter,Segoe UI,system-ui,sans-serif;color:#0f172a;line-height:1.55;max-width:720px;margin:0 auto;}
.agent-prod-doc *{box-sizing:border-box;}
.agent-prod-doc h1{margin:0;font-size:1.35rem;letter-spacing:-.02em;}
.agent-prod-doc h2{margin:0 0 8px;font-size:.78rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#64748b;}
.agent-prod-doc p{margin:0 0 8px;}
.agent-prod-doc .prod-hero{padding:18px 20px;border-radius:14px;background:linear-gradient(135deg,#0f172a,#1e3a5f);color:#f8fafc;margin-bottom:14px;}
.agent-prod-doc .prod-hero p{margin:6px 0 0;color:#cbd5e1;font-size:.9rem;}
.agent-prod-doc .prod-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px;}
.agent-prod-doc .prod-card{border:1px solid #e2e8f0;border-radius:12px;padding:14px 16px;background:#fff;}
.agent-prod-doc .prod-card.is-wide{grid-column:1 / -1;}
.agent-prod-doc .prod-k{font-size:.72rem;color:#64748b;text-transform:uppercase;letter-spacing:.05em;margin-bottom:2px;}
.agent-prod-doc .prod-v{font-size:.95rem;font-weight:600;word-break:break-word;}
.agent-prod-doc .prod-body{white-space:pre-wrap;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px;font-size:.92rem;}
.agent-prod-doc .prod-badge{display:inline-block;padding:4px 10px;border-radius:999px;background:#dbeafe;color:#1d4ed8;font-weight:700;font-size:.85rem;}
.agent-prod-doc .prod-conf{height:8px;border-radius:99px;background:#e2e8f0;overflow:hidden;margin-top:6px;}
.agent-prod-doc .prod-conf>span{display:block;height:100%;background:#2563eb;border-radius:99px;}
.agent-prod-doc .prod-dl{display:grid;grid-template-columns:140px 1fr;gap:6px 12px;margin:0;}
.agent-prod-doc .prod-dl dt{color:#64748b;font-size:.8rem;}
.agent-prod-doc .prod-dl dd{margin:0;font-weight:600;}
.agent-prod-doc .review-check-list{margin:0;padding:0;list-style:none;}
.agent-prod-doc .review-check-list li{padding:8px 0;border-bottom:1px solid #f1f5f9;}
.agent-prod-doc .review-check-list label{display:flex;gap:8px;align-items:flex-start;cursor:pointer;}
.agent-prod-doc a{color:#2563eb;}
@media (max-width:640px){.agent-prod-doc .prod-grid{grid-template-columns:1fr;}}
`;

function wrapDoc(inner) {
  return `<article class="agent-prod-doc"><style>${DOC_CSS}</style>${inner}</article>`;
}

const PAGE_CSS = `
.agent-prod-page{font-family:Inter,Segoe UI,system-ui,sans-serif;color:#0f172a;background:#f1f5f9;min-height:100%;}
.agent-prod-page *{box-sizing:border-box;}
.agent-prod-page a{color:inherit;text-decoration:none;}
.agent-prod-page .pw-nav{display:flex;justify-content:space-between;align-items:center;padding:16px 28px;background:#0f172a;color:#f8fafc;}
.agent-prod-page .pw-brand{font-weight:800;letter-spacing:-.03em;font-size:1.05rem;}
.agent-prod-page .pw-nav span{color:#94a3b8;font-size:.8rem;}
.agent-prod-page .pw-hero{padding:40px 28px 28px;background:linear-gradient(135deg,#0f172a 0%,#1d4ed8 70%,#0ea5e9 140%);color:#fff;}
.agent-prod-page .pw-kicker{font-size:.75rem;letter-spacing:.12em;text-transform:uppercase;color:#bfdbfe;margin:0 0 8px;}
.agent-prod-page .pw-hero h1{margin:0 0 10px;font-size:2rem;letter-spacing:-.04em;max-width:720px;}
.agent-prod-page .pw-hero p{margin:0;max-width:640px;color:#e2e8f0;font-size:1.05rem;line-height:1.55;}
.agent-prod-page .pw-wrap{padding:0 28px 36px;max-width:1080px;margin:0 auto;}
.agent-prod-page .pw-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin:-22px 0 22px;}
.agent-prod-page .pw-stat{background:#fff;border-radius:14px;padding:16px;box-shadow:0 8px 24px rgba(15,23,42,.06);border:1px solid #e2e8f0;}
.agent-prod-page .pw-stat b{display:block;font-size:1.25rem;}
.agent-prod-page .pw-stat span{color:#64748b;font-size:.78rem;text-transform:uppercase;letter-spacing:.04em;}
.agent-prod-page .pw-grid{display:grid;grid-template-columns:1.4fr .8fr;gap:16px;}
.agent-prod-page .pw-card{background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:20px;}
.agent-prod-page .pw-card h2{margin:0 0 12px;font-size:.95rem;}
.agent-prod-page .pw-section{margin:0 0 16px;}
.agent-prod-page .pw-section h3{margin:0 0 6px;font-size:1rem;}
.agent-prod-page .pw-section p{margin:0;color:#334155;line-height:1.55;}
.agent-prod-page .pw-cta{display:inline-block;margin-top:8px;padding:10px 16px;border-radius:10px;background:#2563eb;color:#fff;font-weight:700;}
.agent-prod-page .pw-cta-ghost{background:#fff;color:#0f172a;border:1px solid #cbd5e1;margin-left:8px;}
.agent-prod-page .pw-aside p{margin:0 0 8px;color:#475569;font-size:.92rem;}
.agent-prod-page .pw-foot{padding:18px 28px;color:#64748b;font-size:.8rem;}
@media (max-width:800px){.agent-prod-page .pw-grid{grid-template-columns:1fr;}.agent-prod-page .pw-hero h1{font-size:1.5rem;}}
`;

function wrapPage(inner) {
  return `<article class="agent-prod-page"><style>${PAGE_CSS}</style>${inner}</article>`;
}

const PALETTE_BTN_CSS = `
.agent-prod-palette{font-family:Inter,Segoe UI,system-ui,sans-serif;padding:8px;}
.agent-prod-palette *{box-sizing:border-box;}
.agent-prod-palette .pb-btn{
  display:flex;align-items:center;gap:8px;padding:6px 10px;
  background:#0f172a;border:1px dashed #334155;border-radius:10px;
  color:#e2e8f0;max-width:240px;
}
.agent-prod-palette .pb-btn img{width:22px;height:22px;border-radius:6px;object-fit:cover;}
.agent-prod-palette .pb-emoji{font-size:1.15rem;line-height:1;width:22px;text-align:center;}
.agent-prod-palette .pb-meta{display:flex;flex-direction:column;gap:2px;min-width:0;}
.agent-prod-palette .pb-meta strong{font-size:.8rem;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.agent-prod-palette .pb-badge{
  display:inline-block;font-size:.62rem;letter-spacing:.04em;text-transform:uppercase;
  color:#c4b5fd;background:#1e1b4b;border-radius:999px;padding:1px 6px;width:fit-content;
}
.agent-prod-palette .pb-dot{width:8px;height:8px;border-radius:99px;flex-shrink:0;background:var(--pb-color,#7c3aed);}
`;

function wrapPaletteButton(inner) {
  return `<article class="agent-prod-palette"><style>${PALETTE_BTN_CSS}</style>${inner}</article>`;
}

/** Profils LLM : calés sur le catalogue Ollama / serveurs GDRI (plus capable d’abord). */
const MODEL_PROFILES = {
  fast: {
    label: 'Rapide',
    prefer: [
      'qwen3.5:9b', 'qwen3.5', 'qwen3',
      'llama3.1:latest', 'llama3.1:8b', 'llama3.1',
      'mistral:latest', 'mistral:7b', 'mistral',
      'qwen2.5:7b', 'llama3.2:3b', 'llama3.2', 'qwen2.5:3b', 'phi4', 'phi3', 'gemma2:2b'
    ],
    temperature: 0.1,
    maxTokens: 500
  },
  balanced: {
    label: 'Équilibré',
    prefer: [
      'qwen3.5:9b', 'qwen3.5', 'qwen3',
      'llama3.1:latest', 'llama3.1:8b', 'llama3.1',
      'mistral:latest', 'mistral',
      'qwen2.5:14b', 'qwen2.5:7b', 'gemma2:9b'
    ],
    temperature: 0.3,
    maxTokens: 900
  },
  quality: {
    label: 'Qualité',
    prefer: [
      'qwen3.5:9b', 'qwen3.5', 'qwen3',
      'llama3.1:latest', 'llama3.1',
      'qwen2.5:32b', 'qwen2.5:14b', 'llama3.3', 'mixtral', 'mistral-small',
      'mistral:latest', 'qwen2.5:7b'
    ],
    temperature: 0.35,
    maxTokens: 1600
  },
  code: {
    label: 'Code / HTML',
    prefer: [
      'qwen2.5-coder:7b', 'qwen2.5-coder:14b', 'qwen2.5-coder:32b',
      'qwen2.5-coder:latest', 'qwen2.5-coder', 'qwen2.5:coder',
      'deepseek-coder', 'codellama',
      'qwen3.5:9b', 'qwen3.5',
      'qwen2.5:14b', 'qwen2.5:7b', 'mistral:latest', 'mistral'
    ],
    temperature: 0.15,
    maxTokens: 2500
  }
};

function modelSpecOf(template) {
  const spec = (template && template.model && typeof template.model === 'object') ? template.model : {};
  const profileId = String(spec.profile || 'balanced');
  const profile = MODEL_PROFILES[profileId] || MODEL_PROFILES.balanced;
  return {
    profile: profileId,
    label: profile.label,
    prefer: Array.isArray(spec.prefer) && spec.prefer.length ? spec.prefer : profile.prefer,
    temperature: spec.temperature != null ? spec.temperature : profile.temperature,
    maxTokens: spec.maxTokens || profile.maxTokens
  };
}

function normalizeModelHay(llm) {
  return `${(llm && llm.model) || ''} ${(llm && llm.name) || ''} ${(llm && llm.id) || ''}`
    .toLowerCase()
    .replace(/[\s_]+/g, ':');
}

function isUnsuitableLlm(llm, profile) {
  const hay = normalizeModelHay(llm);
  if (!hay.trim()) return true;
  if (/nomic-embed|embed-text|:embed\b|embedding/.test(hay)) return true;
  if (/llava|vision/.test(hay)) return true;
  if (/deepseek-r1|deepseek-reasoner/.test(hay)) return true;
  if (profile === 'code' && /coder/.test(hay) && /:0\.5b|:1\.5b|:3b\b/.test(hay)) return true;
  return false;
}

function scoreLlmAgainstPrefer(llm, prefer, profile) {
  if (isUnsuitableLlm(llm, profile)) return -1;
  const hay = normalizeModelHay(llm);
  let best = -1;
  (prefer || []).forEach((raw, i) => {
    const needle = String(raw || '').toLowerCase().replace(/[\s_]+/g, ':');
    if (!needle || hay.indexOf(needle) < 0) return;
    const score = 120 - i * 5 + Math.min(12, needle.length);
    if (score > best) best = score;
  });
  if (llm && llm.isDefault && best < 0) best = 8;
  return best;
}

function pickModelForTemplate(template, llms) {
  const spec = modelSpecOf(template);
  const list = Array.isArray(llms)
    ? llms.filter((llm) => llm && !isUnsuitableLlm(llm, spec.profile))
    : [];
  let best = null;
  let bestScore = -1;
  list.forEach((llm) => {
    const score = scoreLlmAgainstPrefer(llm, spec.prefer, spec.profile);
    if (score > bestScore) {
      bestScore = score;
      best = llm;
    }
  });
  if (!best && list.length) {
    best = list.find((l) => l.isDefault) || list[0];
  }
  if (!best) {
    return {
      id: '',
      model: spec.prefer[0] || '',
      name: spec.prefer[0] || spec.label,
      unmatched: true,
      ...spec
    };
  }
  return {
    id: String(best.id || ''),
    model: String(best.model || best.name || ''),
    name: String(best.name || best.model || best.id),
    unmatched: bestScore < 0,
    ...spec
  };
}

const CATALOG = [
  {
    id: 'review-mail',
    usage: 'validation',
    kind: 'html',
    title: 'Revue mail',
    description: 'Expéditeur, sujet, corps du message et pièces jointes — pour valider un courrier.',
    channels: ['mail'],
    keywords: ['mail', 'email', 'courrier', 'imap', 'boîte', 'boite', 'pièce jointe', 'piece jointe', 'pj', 'message'],
    distinctive: [],
    fields: ['from', 'subject', 'text', 'attachments_html'],
    pairsWith: '',
    model: { profile: 'fast' },
    html: wrapDoc(`
      <div class="prod-hero">
        <h1>Validation du courrier</h1>
        <p>Vérifiez l’expéditeur, le sujet, le contenu et les pièces jointes avant de valider.</p>
      </div>
      <div class="prod-grid">
        <div class="prod-card"><div class="prod-k">De</div><div class="prod-v">{{from}}</div></div>
        <div class="prod-card"><div class="prod-k">Sujet</div><div class="prod-v">{{subject}}</div></div>
        <div class="prod-card is-wide"><h2>Message</h2><div class="prod-body">{{text}}</div></div>
        <div class="prod-card is-wide"><h2>Pièces jointes ({{attachmentCount}})</h2>{{attachments_html}}</div>
      </div>
    `)
  },
  {
    id: 'review-ia',
    usage: 'validation',
    kind: 'html',
    title: 'Revue analyse IA',
    description: 'Verdict IA (intention, confiance, résumé) à côté du message d’origine.',
    channels: ['mail', 'facebook', 'http'],
    keywords: ['intention', 'analyse', 'ia', 'résumé', 'resume', 'confiance', 'classif', 'tri'],
    distinctive: ['intention', 'analyse', 'confiance'],
    fields: ['intention', 'confiance', 'resume', 'response', 'from', 'subject', 'text'],
    pairsWith: 'prompt-intention',
    model: { profile: 'fast' },
    html: wrapDoc(`
      <div class="prod-hero">
        <h1>Analyse à valider</h1>
        <p>Contrôlez le verdict de l’IA par rapport au message d’origine.</p>
      </div>
      <div class="prod-grid">
        <div class="prod-card">
          <div class="prod-k">Intention</div>
          <div class="prod-v"><span class="prod-badge">{{intention}}</span></div>
        </div>
        <div class="prod-card">
          <div class="prod-k">Confiance</div>
          <div class="prod-v">{{confiance_label}}</div>
          <div class="prod-conf"><span style="width:{{confiance_pct}}%"></span></div>
        </div>
        <div class="prod-card is-wide"><h2>Résumé</h2><p>{{resume}}</p></div>
        <div class="prod-card is-wide"><h2>Champs extraits</h2>{{response_html}}</div>
        <div class="prod-card is-wide">
          <h2>Message d’origine</h2>
          <p><strong>{{from}}</strong> — {{subject}}</p>
          <div class="prod-body">{{text}}</div>
        </div>
      </div>
    `)
  },
  {
    id: 'review-extract',
    usage: 'validation',
    kind: 'html',
    title: 'Revue extraction',
    description: 'Champs extraits (nom, montant, dates…) présentés comme une fiche à contrôler.',
    channels: ['mail', 'facebook'],
    keywords: ['extract', 'extraction', 'champs', 'montant', 'nom', 'téléphone', 'telephone', 'devis', 'commande'],
    distinctive: ['extraction', 'extract', 'montant'],
    fields: ['response', 'nom', 'email', 'montant', 'objet'],
    pairsWith: 'prompt-extract',
    model: { profile: 'fast' },
    html: wrapDoc(`
      <div class="prod-hero">
        <h1>Données extraites</h1>
        <p>Vérifiez chaque champ. Corrigez dans le document si une valeur est fausse, puis validez.</p>
      </div>
      <div class="prod-grid">
        <div class="prod-card is-wide"><h2>Fiche</h2>{{response_html}}</div>
        <div class="prod-card is-wide">
          <h2>Source</h2>
          <p><strong>{{from}}</strong> · {{subject}}</p>
          <div class="prod-body">{{text}}</div>
        </div>
      </div>
    `)
  },
  {
    id: 'review-invoice',
    usage: 'validation',
    kind: 'html',
    title: 'Revue facture',
    description: 'En-tête fournisseur, détail du mail et pièces jointes avant traitement d’une facture.',
    channels: ['mail'],
    keywords: ['facture', 'invoice', 'tva', 'avoir', 'fournisseur', 'règlement', 'reglement'],
    distinctive: ['facture', 'invoice', 'tva'],
    fields: ['from', 'subject', 'text', 'attachments_html', 'montant'],
    pairsWith: 'prompt-extract',
    model: { profile: 'fast' },
    html: wrapDoc(`
      <div class="prod-hero">
        <h1>Revue facture</h1>
        <p>Validez le contenu et les pièces jointes avant de poursuivre le traitement.</p>
      </div>
      <div class="prod-grid">
        <div class="prod-card"><div class="prod-k">Fournisseur / de</div><div class="prod-v">{{from}}</div></div>
        <div class="prod-card"><div class="prod-k">Objet</div><div class="prod-v">{{subject}}</div></div>
        <div class="prod-card is-wide"><h2>Analyse</h2>{{response_html}}</div>
        <div class="prod-card is-wide"><h2>Corps du mail</h2><div class="prod-body">{{text}}</div></div>
        <div class="prod-card is-wide"><h2>Pièces jointes ({{attachmentCount}})</h2>{{attachments_html}}</div>
      </div>
    `)
  },
  {
    id: 'review-list',
    usage: 'validation',
    kind: 'html',
    title: 'Revue liste',
    description: 'Liste d’éléments à cocher (lignes, pièces, messages).',
    channels: ['mail', 'facebook', 'http'],
    keywords: ['liste', 'cocher', 'checkbox', 'lignes', 'items', 'éléments', 'elements', 'données', 'donnees'],
    distinctive: ['liste', 'cocher', 'checkbox'],
    fields: ['items_html', 'itemsCount'],
    pairsWith: '',
    model: { profile: 'fast' },
    html: wrapDoc(`
      <div class="prod-hero">
        <h1>Éléments à valider</h1>
        <p>{{itemsCount}} élément(s) — décochez ce qui ne doit pas passer.</p>
      </div>
      <div class="prod-card"><h2>Liste</h2>{{items_html}}</div>
    `)
  },
  {
    id: 'prompt-intention',
    usage: 'ia',
    kind: 'prompt',
    title: 'Détection d’intention',
    description: 'Classe chaque message dans la liste d’intentions. Sortie JSON alignée sur le prompt.',
    channels: ['mail', 'facebook'],
    keywords: ['intention', 'classif', 'tri', 'route'],
    distinctive: ['intention', 'classif'],
    fields: ['subject', 'text', 'from', 'intentions'],
    pairsWith: 'review-ia',
    model: { profile: 'fast', temperature: 0.05, maxTokens: 450 },
    values: {
      context: 'Tu es l’assistant de tri des messages de l’entreprise. Réponds en français, de façon factuelle. N’invente rien.',
      prompt: 'Classe CHAQUE message dans la liste d’intentions fournie.\n'
        + 'Règles :\n'
        + '- "intention" = EXACTEMENT un identifiant de la liste (ex. commercial, sav, generic). Pas une phrase.\n'
        + '- "confiance" = nombre entre 0 et 1, calculé pour CE message (ne recopie pas l’exemple).\n'
        + '- "resume" = 1 à 2 phrases, faits du message seulement.\n'
        + '- S’il y a N messages, le JSON est un tableau de N objets, même ordre.\n\n'
        + '{{#donnees[i]}}\n--- Message {{itemNumber}} ---\nSujet : {{sujet}}\nTexte : {{texte}}\nExpéditeur : {{expediteur}}\n{{/donnees}}\n\n'
        + 'Liste d’intentions :\n{{intentions}}',
      rag: ''
    },
    outputFormat: 'json',
    outputHint: '[\n  { "intention": "commercial", "confiance": 0.8, "resume": "Demande de devis pour …" }\n]'
  },
  {
    id: 'prompt-extract',
    usage: 'ia',
    kind: 'prompt',
    title: 'Extraction de champs',
    description: 'Remplit uniquement les champs demandés. Valeur vide si l’info n’est pas dans le texte.',
    channels: ['mail'],
    keywords: ['extract', 'extraction', 'champs', 'facture', 'montant'],
    distinctive: ['extraction', 'extract'],
    fields: ['subject', 'text', 'from'],
    pairsWith: 'review-extract',
    model: { profile: 'fast', temperature: 0, maxTokens: 600 },
    values: {
      context: 'Tu extrais des informations structurées. N’invente rien : si une info manque, laisse la valeur vide ("").',
      prompt: 'Extrais les champs à partir du message. Ne reformule pas le mail : remplis uniquement le JSON.\n\n'
        + 'Sujet : {{subject}}\nExpéditeur : {{from}}\nTexte :\n{{text}}',
      rag: ''
    },
    outputFormat: 'json',
    outputHint: '{ "nom": "", "email": "", "telephone": "", "objet": "", "montant": "", "date": "" }'
  },
  {
    id: 'prompt-reply',
    usage: 'ia',
    kind: 'prompt',
    title: 'Réponse professionnelle',
    description: 'Corps de mail courtois, sans objet ni signature, calé sur le message reçu.',
    channels: ['mail'],
    keywords: ['réponse', 'reponse', 'reply', 'mail', 'rédige', 'redige'],
    distinctive: ['réponse', 'reponse', 'reply'],
    fields: ['subject', 'text', 'from'],
    pairsWith: '',
    model: { profile: 'balanced', temperature: 0.4, maxTokens: 900 },
    values: {
      context: 'Tu rédiges des e-mails professionnels, clairs et courtois, en français. Tu n’inventes aucun engagement commercial, délai ou tarif.',
      prompt: 'Rédige le corps de la réponse à ce message. Ton professionnel, concis (8 à 14 lignes max).\n'
        + 'Pas d’objet, pas de signature, pas de formules « en tant qu’IA ».\n\n'
        + 'Destinataire : {{from}}\nSujet : {{subject}}\nMessage :\n{{text}}\n\nConsignes métier :\n{{rag}}',
      rag: ''
    },
    outputFormat: 'text',
    outputHint: 'Uniquement le corps du mail, paragraphes courts, tutoiement ou vouvoiement selon le message reçu.'
  },
  {
    id: 'prompt-summary',
    usage: 'ia',
    kind: 'prompt',
    title: 'Résumé opérateur',
    description: '3 à 5 phrases pour un humain : qui, quoi, urgence.',
    channels: ['mail', 'facebook'],
    keywords: ['résumé', 'resume', 'summary', 'synthèse', 'synthese'],
    distinctive: ['résumé', 'resume', 'summary'],
    fields: ['subject', 'text', 'from'],
    pairsWith: '',
    model: { profile: 'fast', temperature: 0.2, maxTokens: 500 },
    values: {
      context: 'Tu résumes des messages pour un opérateur humain. Français, factuel, sans jargon.',
      prompt: 'Résume le message en 3 à 5 phrases. Mentionne l’expéditeur, la demande, et s’il y a une urgence ou une pièce jointe.\n\n'
        + 'De : {{from}}\nSujet : {{subject}}\nTexte :\n{{text}}',
      rag: ''
    },
    outputFormat: 'text',
    outputHint: 'Texte court en paragraphes, pas de puces, pas de JSON.'
  },
  {
    id: 'prompt-viz-base',
    usage: 'ia',
    kind: 'prompt',
    title: 'Concevoir une page de base',
    description: 'Sous-agent visualisation, 1er appel. Libellés du chrome uniquement. Le moteur documents pose nav, hero, CSS.',
    channels: ['mail', 'facebook', 'http'],
    keywords: ['page de base', 'chrome', 'design général', 'visualisation', 'gabarit'],
    distinctive: ['page de base', 'design général', 'chrome'],
    fields: ['brief', 'fields', 'agentContext', 'rag'],
    pairsWith: 'prompt-viz-zone',
    model: { profile: 'fast', temperature: 0.2, maxTokens: 450 },
    values: {
      context: 'Tu choisis UNIQUEMENT les textes du chrome d’une page d’interaction.\n'
        + 'La mise en page (nav, hero, cartes, CSS) est déjà fournie par le moteur documents. Tu n’écris pas de HTML.',
      prompt: 'À partir de la demande, remplis le JSON de libellés. Pas de HTML.\n'
        + '- name : nom court du gabarit.\n'
        + '- page_title : titre affiché (6 à 12 mots).\n'
        + '- kicker : label au-dessus du titre (2 à 4 mots).\n'
        + '- lead : chapô, 1 à 2 phrases, ce que l’humain doit faire.\n'
        + '- cta : libellé du bouton principal (Valider, Continuer…).\n'
        + '- aside : aide courte à droite.\n'
        + '\n'
        + 'Demande :\n'
        + '{{brief}}\n'
        + '\n'
        + 'Contexte de l’agent :\n'
        + '{{agentContext}}\n'
        + '\n'
        + 'Contrat (ton seulement) :\n'
        + '{{fields}}\n'
        + '{{rag}}',
      rag: ''
    },
    outputFormat: 'json',
    outputHint: '{\n'
      + '  "name": "Revue mail",\n'
      + '  "page_title": "Validation du courrier",\n'
      + '  "kicker": "À traiter",\n'
      + '  "lead": "Vérifiez l’expéditeur, le sujet et les pièces avant de valider.",\n'
      + '  "cta": "Valider",\n'
      + '  "aside": "Corrigez si besoin, puis validez ou rejetez."\n'
      + '}'
  },
  {
    id: 'prompt-viz-zone',
    usage: 'ia',
    kind: 'prompt',
    title: 'Concevoir une zone données',
    description: 'Sous-agent visualisation, 2e appel. Choisit les cartes et placeholders. Le moteur documents habille (CSS devis / revue).',
    channels: ['mail', 'facebook', 'http'],
    keywords: [
      'zone données', 'sous-template', 'visualisation', 'gabarit', 'conception',
      'créer une zone', 'template de zone', 'page d’interaction'
    ],
    distinctive: ['zone données', 'sous-template', 'concevoir une zone'],
    fields: ['brief', 'fields', 'agentContext', 'rag'],
    pairsWith: 'prompt-viz-base',
    model: { profile: 'fast', temperature: 0.15, maxTokens: 700 },
    values: {
      context: 'Tu choisis les CARTES d’une zone de données. Le moteur documents dessine (cartes, hero, CSS). Tu n’écris pas de HTML ni de CSS.',
      prompt: 'Décris la zone en JSON. Chaque carte pointe un champ du contrat (identifiant exact).\n'
        + '- name : libellé de la zone.\n'
        + '- hero : titre du bandeau.\n'
        + '- lead : consigne courte.\n'
        + '- cards : 2 à 6 cartes. key = identifiant du contrat. kind = value (fiche), body (texte long) ou html (liste / PJ déjà en HTML). wide = true pour une carte pleine largeur.\n'
        + '- Un champ du contrat au plus une fois. N’invente aucune key.\n'
        + '\n'
        + 'Demande :\n'
        + '{{brief}}\n'
        + '\n'
        + 'Contexte de l’agent :\n'
        + '{{agentContext}}\n'
        + '\n'
        + 'Contrat — champs autorisés :\n'
        + '{{fields}}\n'
        + '{{rag}}',
      rag: ''
    },
    outputFormat: 'json',
    outputHint: '{\n'
      + '  "name": "Revue mail",\n'
      + '  "hero": "Validation du courrier",\n'
      + '  "lead": "Vérifiez l’expéditeur, le sujet et les pièces.",\n'
      + '  "cards": [\n'
      + '    { "title": "De", "key": "from", "kind": "value" },\n'
      + '    { "title": "Sujet", "key": "subject", "kind": "value" },\n'
      + '    { "title": "Message", "key": "text", "kind": "body", "wide": true },\n'
      + '    { "title": "Pièces jointes", "key": "attachments_html", "kind": "html", "wide": true }\n'
      + '  ]\n'
      + '}'
  },
  {
    id: 'prompt-page',
    usage: 'ia',
    kind: 'prompt',
    title: 'Création de page web',
    description: 'Produit le contenu structuré d’une page web (titre, chapô, sections, indicateurs, CTA). Cœur du système.',
    channels: ['mail', 'facebook', 'http'],
    keywords: ['page web', 'site web', 'landing', 'dashboard', 'application', 'écran', 'ecran', 'portail', 'création de page', 'creation de page'],
    distinctive: ['page web', 'landing', 'dashboard', 'site web'],
    fields: ['subject', 'text', 'from', 'response'],
    pairsWith: 'page-web',
    model: { profile: 'code', temperature: 0.2, maxTokens: 2200 },
    values: {
      context: 'Tu conçois le contenu d’une page web métier pour un agent. Français, clair, sans inventer de chiffres ni de marque.',
      prompt: 'À partir des données, remplis UNIQUEMENT le JSON de page.\n'
        + '- title : titre de page (court).\n'
        + '- kicker : label au-dessus du titre (2 à 4 mots).\n'
        + '- lead : chapô, 1 à 2 phrases.\n'
        + '- stats : 2 à 4 indicateurs { "label", "value" } tirés des données (vide si rien de fiable).\n'
        + '- sections : 2 à 4 blocs { "title", "body" }.\n'
        + '- aside : texte court d’aide / prochaines étapes.\n'
        + '- cta : libellé du bouton (ex. Valider, Continuer).\n'
        + 'N’invente pas d’information absente du message.\n\n'
        + 'Sujet : {{subject}}\nDe : {{from}}\nTexte :\n{{text}}\nAnalyse amont :\n{{response}}',
      rag: ''
    },
    outputFormat: 'json',
    outputHint: '{\n  "title": "",\n  "kicker": "",\n  "lead": "",\n  "stats": [{ "label": "", "value": "" }],\n  "sections": [{ "title": "", "body": "" }],\n  "aside": "",\n  "cta": "Continuer"\n}'
  },
  {
    id: 'palette-button',
    usage: 'hook',
    kind: 'html',
    title: 'Bouton palette',
    description: 'Gabarit du bouton accroché dans la palette (logo, nom, couleur). Surface palette.',
    channels: [],
    keywords: ['palette', 'bouton', 'hook', 'sous-action', 'logo', 'icône', 'icone'],
    distinctive: ['bouton palette', 'palette'],
    fields: ['name', 'label', 'iconEmoji', 'logoUrl', 'color', 'description'],
    pairsWith: '',
    model: { profile: 'fast' },
    html: wrapPaletteButton(`
      <div class="pb-btn" style="--pb-color:{{color}}">
        <span class="pb-dot" aria-hidden="true"></span>
        {{icon_html}}
        <span class="pb-meta">
          <strong>{{name}}</strong>
          <span class="pb-badge">ss-action</span>
        </span>
      </div>
    `)
  },
  {
    id: 'page-web',
    usage: 'page',
    kind: 'html',
    alsoFor: ['validation', 'output', 'hook'],
    title: 'Page web agent',
    description: 'Mise en page web (nav, hero, indicateurs, sections, CTA). À remplir par le prompt « Création de page web ».',
    channels: ['mail', 'facebook', 'http'],
    keywords: ['page web', 'site web', 'landing', 'dashboard', 'application', 'écran', 'ecran', 'portail', 'création de page', 'creation de page'],
    distinctive: ['page web', 'landing', 'dashboard', 'site web'],
    fields: ['page_title', 'kicker', 'lead', 'sections_html', 'stats_html', 'cta', 'aside'],
    pairsWith: 'prompt-page',
    model: { profile: 'code' },
    html: wrapPage(`
      <header class="pw-nav">
        <div class="pw-brand">{{page_title}}</div>
        <span>{{kicker}}</span>
      </header>
      <section class="pw-hero">
        <p class="pw-kicker">{{kicker}}</p>
        <h1>{{page_title}}</h1>
        <p>{{lead}}</p>
      </section>
      <div class="pw-wrap">
        <div class="pw-stats">{{stats_html}}</div>
        <div class="pw-grid">
          <div class="pw-card">
            <h2>Contenu</h2>
            {{sections_html}}
            <a class="pw-cta" href="#valider">{{cta}}</a>
          </div>
          <aside class="pw-card pw-aside">
            <h2>Contexte</h2>
            <p><strong>{{from}}</strong></p>
            <p>{{subject}}</p>
            <p>{{aside}}</p>
          </aside>
        </div>
      </div>
      <footer class="pw-foot">Page agent · {{date}}</footer>
    `)
  }
];

function listProductionTemplates(usage) {
  const u = String(usage || '').trim().toLowerCase();
  return CATALOG.filter((t) => {
    if (!u) return true;
    if (t.usage === u) return true;
    return Array.isArray(t.alsoFor) && t.alsoFor.indexOf(u) >= 0;
  }).map(summarize);
}

function summarize(t) {
  if (!t) return null;
  const spec = modelSpecOf(t);
  const pair = t.pairsWith ? getProductionTemplate(t.pairsWith) : null;
  return {
    id: t.id,
    usage: t.usage,
    kind: t.kind,
    title: t.title,
    description: t.description,
    channels: t.channels || [],
    keywords: t.keywords || [],
    fields: t.fields || [],
    pairsWith: t.pairsWith || '',
    pairTitle: pair ? pair.title : '',
    outputHint: t.outputHint || '',
    outputFormat: t.outputFormat || '',
    model: {
      profile: spec.profile,
      label: spec.label,
      prefer: spec.prefer.slice(0, 6),
      temperature: spec.temperature,
      maxTokens: spec.maxTokens
    }
  };
}

function getProductionTemplate(id) {
  const key = String(id || '').trim();
  if (!key) return null;
  return CATALOG.find((t) => t.id === key) || null;
}

function tokenize(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 2);
}

function matchProductionTemplate(opts = {}) {
  const usage = String(opts.usage || 'validation').toLowerCase();
  const channel = String(opts.channel || '').toLowerCase();
  const brief = `${opts.brief || ''} ${opts.reviewContext || ''} ${opts.agentContext || ''}`;
  const tokens = new Set(tokenize(brief));
  const fields = new Set((opts.fields || []).map((f) => String(f || '').toLowerCase()));
  const pool = CATALOG.filter((t) => {
    if (t.usage === usage) return true;
    return Array.isArray(t.alsoFor) && t.alsoFor.indexOf(usage) >= 0;
  });
  let best = null;
  let bestScore = -1;
  pool.forEach((t) => {
    let score = 0;
    if (channel && (t.channels || []).includes(channel)) score += 4;
    (t.keywords || []).forEach((kw) => {
      const k = String(kw).toLowerCase();
      if (brief.toLowerCase().indexOf(k) >= 0) score += 3;
      tokenize(k).forEach((w) => {
        if (tokens.has(w)) score += 1;
      });
    });
    (t.distinctive || []).forEach((kw) => {
      if (brief.toLowerCase().indexOf(String(kw).toLowerCase()) >= 0) score += 8;
    });
    (t.fields || []).forEach((f) => {
      if (fields.has(String(f).toLowerCase())) score += 2;
    });
    if (score > bestScore) {
      bestScore = score;
      best = t;
    }
  });
  if (!best) {
    if (usage === 'page') return getProductionTemplate('page-web');
    if (usage === 'validation') {
      if (channel === 'mail') return getProductionTemplate('review-mail');
      return getProductionTemplate('review-ia');
    }
    return pool[0] || null;
  }
  if (bestScore <= 0 && usage === 'page') {
    return getProductionTemplate('page-web');
  }
  if (bestScore <= 0 && usage === 'validation') {
    if (channel === 'mail') return getProductionTemplate('review-mail');
    if (fields.has('intention') || fields.has('resume') || fields.has('response')) {
      return getProductionTemplate('review-ia');
    }
  }
  return best;
}

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function looksLikeHtml(text) {
  const s = String(text || '').trim();
  return /^</.test(s) && /<\/[a-z][\w:-]*>/i.test(s);
}

function jsonObjectSlice(text) {
  const s = String(text || '');
  const iArr = s.indexOf('[');
  const iObj = s.indexOf('{');
  if (iArr >= 0 && (iObj < 0 || iArr < iObj)) {
    const end = s.lastIndexOf(']');
    if (end > iArr) return s.slice(iArr, end + 1);
  }
  const start = s.lastIndexOf('{');
  const end = s.lastIndexOf('}');
  if (start < 0 || end <= start) return '';
  return s.slice(start, end + 1);
}

function parseStructured(text) {
  const slice = jsonObjectSlice(text);
  if (!slice) return null;
  try {
    return JSON.parse(slice);
  } catch (_) {
    return null;
  }
}

const SKIP_RESPONSE_KEYS = new Set([
  'prompt', 'context', 'rag', 'llmId', 'llm', 'model', 'temperature', 'maxTokens', 'max_tokens',
  'rendered', 'success', 'type', 'mode', 'item', 'items', 'itemsCount', 'itemIndex', 'html', 'editedHtml'
]);

function fieldLabel(key) {
  const known = {
    intention: 'Intention',
    intention_principale: 'Intention',
    confiance: 'Confiance',
    confidence: 'Confiance',
    resume: 'Résumé',
    résumé: 'Résumé',
    summary: 'Résumé',
    nom: 'Nom',
    email: 'E-mail',
    telephone: 'Téléphone',
    objet: 'Objet',
    montant: 'Montant',
    date: 'Date',
    from: 'De',
    subject: 'Sujet'
  };
  if (known[key] || known[String(key).toLowerCase()]) {
    return known[key] || known[String(key).toLowerCase()];
  }
  return String(key || '').replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function objectToDl(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return '';
  const rows = Object.keys(obj)
    .filter((k) => !SKIP_RESPONSE_KEYS.has(k) && obj[k] != null && obj[k] !== '')
    .map((k) => {
      const val = obj[k];
      const shown = typeof val === 'object' ? JSON.stringify(val) : String(val);
      return `<dt>${escapeHtml(fieldLabel(k))}</dt><dd>${escapeHtml(shown)}</dd>`;
    });
  if (!rows.length) return '';
  return `<dl class="prod-dl">${rows.join('')}</dl>`;
}

function formatResponseHtml(raw, extraObj) {
  if (looksLikeHtml(raw)) return String(raw);
  const parsed = parseStructured(raw);
  if (Array.isArray(parsed)) {
    return parsed.map((row, i) => {
      const inner = objectToDl(row) || `<p>${escapeHtml(JSON.stringify(row))}</p>`;
      return `<div class="prod-card" style="margin-bottom:8px;"><div class="prod-k">Ligne ${i + 1}</div>${inner}</div>`;
    }).join('');
  }
  const fromObj = objectToDl(parsed && typeof parsed === 'object' ? parsed : extraObj);
  if (fromObj) return fromObj;
  const text = String(raw || '').trim();
  if (!text) return '<p><em>Aucune analyse à afficher.</em></p>';
  return `<div class="prod-body">${escapeHtml(text)}</div>`;
}

function confianceParts(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return { pct: 0, label: '—' };
  const pct = n <= 1 ? Math.round(n * 100) : Math.round(n);
  const clamped = Math.max(0, Math.min(100, pct));
  return { pct: clamped, label: `${clamped} %` };
}

function emptyToDash(value) {
  const s = String(value == null ? '' : value).trim();
  return s || '—';
}

function formatStatsHtml(stats) {
  if (!Array.isArray(stats) || !stats.length) return '';
  return stats.slice(0, 4).map((row) => {
    const r = row && typeof row === 'object' ? row : { value: row };
    return `<div class="pw-stat"><span>${escapeHtml(r.label || 'Indicateur')}</span><b>${escapeHtml(r.value != null ? r.value : '—')}</b></div>`;
  }).join('');
}

function formatSectionsHtml(sections) {
  if (!Array.isArray(sections) || !sections.length) return '';
  return sections.slice(0, 6).map((row) => {
    const r = row && typeof row === 'object' ? row : { body: row };
    return `<div class="pw-section"><h3>${escapeHtml(r.title || '')}</h3><p>${escapeHtml(r.body || '')}</p></div>`;
  }).join('');
}

function buildProductionLocals(base = {}) {
  const src = base && typeof base === 'object' ? base : {};
  const parsed = parseStructured(src.response);
  const page = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  const confiance = confianceParts(src.confiance != null ? src.confiance : src.confidence);
  const extra = {};
  ['intention', 'intention_principale', 'resume', 'nom', 'email', 'telephone', 'objet', 'montant', 'date'].forEach((k) => {
    if (src[k] != null && src[k] !== '') extra[k] = src[k];
  });
  const stats = src.stats || page.stats;
  const sections = src.sections || page.sections;
  return {
    ...src,
    from: emptyToDash(src.from),
    subject: emptyToDash(src.subject),
    text: emptyToDash(src.text),
    intention: emptyToDash(src.intention || src.intention_principale),
    resume: emptyToDash(src.resume),
    page_title: emptyToDash(src.page_title || src.title || page.title || src.subject),
    kicker: emptyToDash(src.kicker || page.kicker),
    lead: emptyToDash(src.lead || page.lead || src.resume),
    aside: emptyToDash(src.aside || page.aside),
    cta: emptyToDash(src.cta || page.cta || 'Continuer'),
    date: emptyToDash(src.date || page.date),
    stats_html: src.stats_html || formatStatsHtml(stats) || '<div class="pw-stat"><span>Statut</span><b>—</b></div>',
    sections_html: src.sections_html || formatSectionsHtml(sections) || `<div class="pw-section"><p>${escapeHtml(src.text || src.resume || '')}</p></div>`,
    confiance_pct: String(confiance.pct),
    confiance_label: confiance.label,
    attachmentCount: src.attachmentCount != null ? String(src.attachmentCount) : '0',
    itemsCount: src.itemsCount != null ? String(src.itemsCount) : '0',
    attachments_html: src.attachments_html || '<p><em>Aucune pièce jointe</em></p>',
    items_html: src.items_html || '<p><em>Aucun élément</em></p>',
    data_html: src.data_html || '',
    response_html: src.response_html || formatResponseHtml(src.response, extra),
    icon_html: src.logoUrl
      ? `<img src="${escapeHtml(src.logoUrl)}" alt="">`
      : `<span class="pb-emoji">${escapeHtml(src.iconEmoji || '⚙')}</span>`,
    name: emptyToDash(src.name || src.label || src.page_title),
    color: String(src.color || '#7c3aed').trim() || '#7c3aed',
    iconEmoji: emptyToDash(src.iconEmoji || '⚙'),
    logoUrl: String(src.logoUrl || '').trim(),
    description: emptyToDash(src.description),
    surface: emptyToDash(src.surface),
    label: emptyToDash(src.label || src.name)
  };
}

function fillProductionHtml(html, locals) {
  const bag = locals && typeof locals === 'object' ? locals : {};
  return String(html || '').replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => {
    if (!Object.prototype.hasOwnProperty.call(bag, key) || bag[key] == null) return '';
    return String(bag[key]);
  });
}

function renderProductionTemplate(idOrDoc, locals) {
  const doc = typeof idOrDoc === 'string' ? getProductionTemplate(idOrDoc) : idOrDoc;
  if (!doc || doc.kind !== 'html' || !doc.html) return '';
  return fillProductionHtml(doc.html, buildProductionLocals(locals || {}));
}

module.exports = {
  CATALOG,
  MODEL_PROFILES,
  listProductionTemplates,
  getProductionTemplate,
  matchProductionTemplate,
  summarize,
  modelSpecOf,
  pickModelForTemplate,
  formatResponseHtml,
  buildProductionLocals,
  renderProductionTemplate,
  wrapDoc,
  wrapPage,
  wrapPaletteButton,
  fillProductionHtml
};
