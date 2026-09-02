/**
 * Étape 1 visualisation : page web partagée (couleurs, logo, zones).
 * Le design embarque des placeholders valides pour un rendu dès l’ouverture.
 */

const DEFAULT_PROMPT = 'Page web claire : en-tête avec logo, barre d’onglets (données / pièces), cartes De / Sujet / Message / pièces jointes, boutons Valider et Rejeter.';

const DEFAULT_ZONES = ['nav', 'data'];

const DEFAULT_COLORS = {
  primary: '#1d4ed8',
  background: '#f1f5f9',
  surface: '#ffffff',
  text: '#0f172a',
  muted: '#64748b'
};

function sanitizeZoneName(raw) {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 32);
}

function normalizeColors(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const out = { ...DEFAULT_COLORS };
  Object.keys(DEFAULT_COLORS).forEach((key) => {
    const v = String(src[key] || '').trim();
    if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v)) out[key] = v;
  });
  return out;
}

function normalizeZones(raw) {
  const list = Array.isArray(raw) ? raw : DEFAULT_ZONES;
  const seen = {};
  const out = [];
  list.forEach((name) => {
    const k = sanitizeZoneName(name);
    if (!k || seen[k]) return;
    seen[k] = true;
    out.push(k);
  });
  if (!out.includes('data')) out.push('data');
  if (!out.includes('nav')) out.unshift('nav');
  return out;
}

function normalizeDesign(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  return {
    templateId: String(src.templateId || '').trim(),
    logoUrl: String(src.logoUrl || '').trim(),
    prompt: String(src.prompt || '').trim() || DEFAULT_PROMPT,
    colors: normalizeColors(src.colors),
    zones: normalizeZones(src.zones)
  };
}

function defaultZoneHtml(name) {
  const zone = sanitizeZoneName(name);
  if (zone === 'nav' || zone === 'tabs' || zone === 'onglets') {
    return `
      <nav class="viz-tabs" aria-label="Étapes">
        <a class="viz-tab is-active" href="#data">Données</a>
        <a class="viz-tab" href="#pj">Pièces <span class="viz-count">{{itemsCount}}</span></a>
        <a class="viz-tab" href="#valider">{{cta}}</a>
      </nav>`;
  }
  if (zone === 'aside') {
    return `
      <aside class="viz-aside">
        <p class="viz-k">Contexte</p>
        <p>{{lead}}</p>
        <a class="viz-cta" href="#valider">{{cta}}</a>
      </aside>`;
  }
  if (zone === 'data' || zone === 'donnees') {
    return `
      <div class="viz-hero">
        <p class="viz-kicker">{{kicker}}</p>
        <h1>{{page_title}}</h1>
        <p class="viz-lead">{{lead}}</p>
      </div>
      <div class="viz-grid">
        <article class="viz-card">
          <p class="viz-k">De</p>
          <p class="viz-v">{{from}}</p>
        </article>
        <article class="viz-card">
          <p class="viz-k">Sujet</p>
          <p class="viz-v">{{subject}}</p>
        </article>
        <article class="viz-card is-wide">
          <p class="viz-k">Message</p>
          <div class="viz-body">{{text}}</div>
        </article>
        <article class="viz-card is-wide" id="pj">
          <p class="viz-k">Pièces jointes</p>
          <div>{{attachments_html}}</div>
        </article>
      </div>
      <div class="viz-actions">
        <a class="viz-cta" href="#valider">{{cta}}</a>
        <a class="viz-cta viz-cta-ghost" href="#rejeter">Rejeter</a>
      </div>`;
  }
  return `
      <p class="viz-k">${zone}</p>
      <p class="viz-v">{{${zone}}}</p>
      <p>{{text}}</p>`;
}

function zoneSection(name) {
  return `    <section class="viz-zone viz-zone-${name}" data-zone="${name}">${defaultZoneHtml(name)}\n    </section>`;
}

function pageCss(c) {
  return `.agent-viz-page{
  --viz-primary:${c.primary};
  --viz-bg:${c.background};
  --viz-surface:${c.surface};
  --viz-text:${c.text};
  --viz-muted:${c.muted};
  font-family:Inter,Segoe UI,system-ui,sans-serif;
  color:var(--viz-text);
  background:var(--viz-bg);
  min-height:100%;
  margin:0;
}
.agent-viz-page *{box-sizing:border-box;}
.agent-viz-page .viz-top{
  display:flex;align-items:center;gap:14px;
  padding:18px 28px;background:var(--viz-primary);color:#fff;
}
.agent-viz-page .viz-logo{height:36px;width:auto;max-width:140px;object-fit:contain;background:#fff;border-radius:8px;padding:4px;}
.agent-viz-page .viz-logo[hidden],.agent-viz-page .viz-logo[src=""]{display:none;}
.agent-viz-page .viz-mark{
  width:36px;height:36px;border-radius:10px;background:rgba(255,255,255,.18);
  display:flex;align-items:center;justify-content:center;font-weight:800;letter-spacing:-.04em;
}
.agent-viz-page .viz-brand{font-weight:800;letter-spacing:-.03em;font-size:1.1rem;}
.agent-viz-page .viz-zone-nav{background:var(--viz-surface);border-bottom:1px solid #e2e8f0;padding:0 28px;}
.agent-viz-page .viz-tabs{display:flex;gap:6px;flex-wrap:wrap;}
.agent-viz-page .viz-tab{
  display:inline-flex;align-items:center;gap:6px;padding:14px 16px;
  color:var(--viz-muted);text-decoration:none;font-weight:600;font-size:.92rem;
  border-bottom:2px solid transparent;
}
.agent-viz-page .viz-tab.is-active{color:var(--viz-primary);border-bottom-color:var(--viz-primary);}
.agent-viz-page .viz-count{
  min-width:1.4em;padding:0 6px;border-radius:999px;background:#e2e8f0;font-size:.75rem;text-align:center;
}
.agent-viz-page .viz-zone-data{padding:22px 28px 32px;}
.agent-viz-page .viz-hero{
  background:linear-gradient(135deg,var(--viz-primary),#0f172a);
  color:#fff;border-radius:16px;padding:22px 24px;margin-bottom:16px;
}
.agent-viz-page .viz-kicker{
  margin:0 0 6px;font-size:.72rem;letter-spacing:.14em;text-transform:uppercase;color:#bfdbfe;
}
.agent-viz-page .viz-hero h1{margin:0;font-size:1.55rem;letter-spacing:-.03em;}
.agent-viz-page .viz-lead{margin:8px 0 0;color:#e2e8f0;max-width:42rem;line-height:1.5;}
.agent-viz-page .viz-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;}
.agent-viz-page .viz-card{
  background:var(--viz-surface);border:1px solid #e2e8f0;border-radius:14px;padding:16px 18px;
}
.agent-viz-page .viz-card.is-wide{grid-column:1 / -1;}
.agent-viz-page .viz-k{
  margin:0 0 4px;font-size:.72rem;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--viz-muted);
}
.agent-viz-page .viz-v{margin:0;font-weight:700;word-break:break-word;}
.agent-viz-page .viz-body{
  margin:0;white-space:pre-wrap;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:12px;line-height:1.5;
}
.agent-viz-page .viz-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:18px;}
.agent-viz-page .viz-cta{
  display:inline-block;padding:10px 16px;border-radius:10px;background:var(--viz-primary);color:#fff;font-weight:700;text-decoration:none;
}
.agent-viz-page .viz-cta-ghost{background:#fff;color:var(--viz-text);border:1px solid #cbd5e1;}
.agent-viz-page .viz-zone-aside{padding:22px 28px;}
.agent-viz-page .viz-aside{
  background:var(--viz-surface);border:1px solid #e2e8f0;border-radius:14px;padding:16px 18px;
}
@media (max-width:720px){
  .agent-viz-page .viz-grid{grid-template-columns:1fr;}
  .agent-viz-page .viz-hero h1{font-size:1.25rem;}
}`;
}

function buildDesignHtml(design) {
  const d = normalizeDesign(design);
  const c = d.colors;
  const hasLogo = !!d.logoUrl;
  const logo = hasLogo
    ? `<img class="viz-logo" src="${escapeAttr(d.logoUrl)}" alt="">`
    : `<span class="viz-mark">A</span><img class="viz-logo" src="" alt="" hidden>`;
  const zones = d.zones.map(zoneSection).join('\n');
  return `<article class="agent-viz-page">
<style>
${pageCss(c)}
</style>
  <header class="viz-top">
    ${logo}
    <div class="viz-brand">{{page_title}}</div>
  </header>
${zones}
</article>
`;
}

function escapeAttr(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;');
}

function applyDesignTokens(html, design) {
  const d = normalizeDesign(design);
  let out = String(html || '');
  if (!out.trim()) return buildDesignHtml(d);
  const c = d.colors;
  out = out.replace(/--viz-primary\s*:\s*[^;]+/i, `--viz-primary:${c.primary}`);
  out = out.replace(/--viz-bg\s*:\s*[^;]+/i, `--viz-bg:${c.background}`);
  out = out.replace(/--viz-surface\s*:\s*[^;]+/i, `--viz-surface:${c.surface}`);
  out = out.replace(/--viz-text\s*:\s*[^;]+/i, `--viz-text:${c.text}`);
  out = out.replace(/--viz-muted\s*:\s*[^;]+/i, `--viz-muted:${c.muted}`);
  if (d.logoUrl) {
    out = out.replace(
      /(<img class="viz-logo"[^>]*src=")[^"]*(")/i,
      `$1${escapeAttr(d.logoUrl)}$2`
    );
    out = out.replace(/<img class="viz-logo"([^>]*) hidden/i, '<img class="viz-logo"$1');
  }
  return out;
}

module.exports = {
  DEFAULT_ZONES,
  DEFAULT_COLORS,
  DEFAULT_PROMPT,
  normalizeDesign,
  normalizeZones,
  defaultZoneHtml,
  buildDesignHtml,
  applyDesignTokens
};
