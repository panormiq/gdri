/**
 * Canvas A4 — éditeur existant (document-agent-v2), ouvert depuis Documents.
 */
export function canvasEditorUrl(opts = {}) {
  const base = String(window.CANVAS_EDITOR_URL || '').trim()
    || `${String(window.BASE_URL || '/').replace(/\/?$/, '/')}pages/modules/document-agent-v2/editor.php`;
  const params = new URLSearchParams();
  params.set('template', opts.template || 'v3:layout:default');
  params.set('return', opts.returnUrl || window.location.href);
  return `${base}${base.includes('?') ? '&' : '?'}${params.toString()}`;
}

export function templateIdOf(template) {
  if (!template) return '';
  const id = template._id;
  if (id && typeof id === 'object') {
    return String(id.$oid || id);
  }
  return String(id || '');
}

export function canvasNamespaceForTemplate(template) {
  const id = templateIdOf(template);
  return id ? `v3:${id}` : 'v3:layout:default';
}

export function openCanvasEditor(opts = {}) {
  window.location.href = canvasEditorUrl(opts);
}
