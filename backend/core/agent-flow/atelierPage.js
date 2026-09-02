/**
 * Page web générée depuis les champs d’un schéma atelier (catalogue nom / type).
 */

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function asList(value) {
  if (Array.isArray(value)) return value.map((v) => String(v).trim()).filter(Boolean);
  return String(value || '')
    .split(/[,;\n]+/)
    .map((v) => v.trim())
    .filter(Boolean);
}

function fieldValue(field, values) {
  if (!field || !field.key) return '';
  const src = values && typeof values === 'object' ? values : {};
  if (src[field.key] !== undefined && src[field.key] !== null) return src[field.key];
  if (field.default !== undefined) return field.default;
  return '';
}

function inputHtml(field, values) {
  const key = field.key;
  const val = fieldValue(field, values);
  const req = field.required ? ' required' : '';
  const name = escapeHtml(key);
  const type = String(field.type || 'text');
  if (type === 'textarea') {
    return `<textarea name="${name}" rows="3"${req}>${escapeHtml(val)}</textarea>`;
  }
  if (type === 'boolean') {
    return `<input type="checkbox" name="${name}" value="1"${val ? ' checked' : ''}>`;
  }
  if (type === 'color') {
    const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(String(val)) ? String(val) : '#1d4ed8';
    return `<input type="color" name="${name}" value="${escapeHtml(hex)}"${req}>`;
  }
  if (type === 'array') {
    return `<input type="text" name="${name}" value="${escapeHtml(asList(val).join(', '))}" placeholder="header, nav, main, footer"${req}>`;
  }
  const inputType = type === 'url' ? 'url' : type === 'number' ? 'number' : type === 'date' ? 'date' : 'text';
  return `<input type="${inputType}" name="${name}" value="${escapeHtml(val)}" placeholder="${escapeHtml(field.placeholder || '')}"${req}>`;
}

function renderAtelierPage({ title, instructions, fields, values } = {}) {
  const list = Array.isArray(fields) ? fields : [];
  const vals = values && typeof values === 'object' ? values : {};
  const primary = String(vals.primary || '#1d4ed8');
  const background = String(vals.background || '#f1f5f9');
  const surface = String(vals.surface || '#ffffff');
  const text = String(vals.text || '#0f172a');
  const muted = String(vals.muted || '#64748b');
  const brand = String(vals.brand || title || 'Atelier');
  const rows = list.map((field) => `
    <label class="atelier-field" data-key="${escapeHtml(field.key)}">
      <span>${escapeHtml(field.label || field.key)}${field.required ? ' *' : ''}</span>
      ${field.description ? `<small>${escapeHtml(field.description)}</small>` : ''}
      ${inputHtml(field, vals)}
    </label>`).join('\n');

  return `<article class="atelier-page">
<style>
.atelier-page{--c:${escapeHtml(primary)};--bg:${escapeHtml(background)};--s:${escapeHtml(surface)};--t:${escapeHtml(text)};--m:${escapeHtml(muted)};font-family:Inter,Segoe UI,system-ui,sans-serif;color:var(--t);background:var(--bg);min-height:100%;margin:0;}
.atelier-page *{box-sizing:border-box;}
.atelier-page header{padding:18px 24px;background:var(--c);color:#fff;font-weight:800;}
.atelier-page main{padding:22px 24px 32px;max-width:640px;}
.atelier-page .lead{color:var(--m);margin:0 0 16px;}
.atelier-page .atelier-field{display:block;margin:0 0 12px;background:var(--s);border:1px solid #e2e8f0;border-radius:12px;padding:12px 14px;}
.atelier-page .atelier-field span{display:block;font-size:.78rem;font-weight:700;margin-bottom:4px;}
.atelier-page .atelier-field small{display:block;color:var(--m);font-size:.72rem;margin-bottom:6px;}
.atelier-page input,.atelier-page textarea{width:100%;border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;font:inherit;background:#fff;color:var(--t);}
.atelier-page input[type=color]{height:36px;padding:2px;width:72px;}
</style>
  <header>${escapeHtml(brand)}</header>
  <main>
    <p class="lead">${escapeHtml(instructions || 'Renseignez les champs, puis validez.')}</p>
    <form class="atelier-form" data-atelier="1">
${rows}
    </form>
  </main>
</article>`;
}

module.exports = {
  renderAtelierPage,
  asList,
  fieldValue
};
