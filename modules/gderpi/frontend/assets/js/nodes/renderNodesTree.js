/**
 * FICHIER : modules/gderpi/frontend/assets/js/nodes/renderNodesTree.js
 * RÔLE : Rend l'arbre de nœuds catalogue dans le panneau catégories.
 *
 * ENTRÉES : tree[], container, callbacks
 * SORTIES : HTML arbre interactif
 *
 * DÉPEND DE : GderpiEscape
 * NE PAS : chargement API
 *
 * APPELÉ PAR : bindNodesTab.js
 */
(function initGderpiRenderNodesTree(global) {
  'use strict';

  const esc = (v) => global.GderpiEscape.escapeHtml(v);

  function renderNodesTree(tree, container, callbacks) {
    const roots = Array.isArray(tree) ? tree : [];
    const onSelect = callbacks && callbacks.onSelect;
    const onDelete = callbacks && callbacks.onDelete;

    function renderNode(node, depth) {
      const pad = depth * 16;
      const kids = Array.isArray(node.children) ? node.children : [];
      let html = '<div class="gderpi-node-row" data-node-id="' + esc(node.id) + '" style="padding-left:' + pad + 'px">';
      html += '<button type="button" class="btn btn-link btn-sm gderpi-node-select">' + esc(node.label) + '</button>';
      html += ' <button type="button" class="btn btn-outline-danger btn-sm gderpi-node-delete" title="Supprimer">×</button>';
      html += '</div>';
      kids.forEach((child) => { html += renderNode(child, depth + 1); });
      return html;
    }

    container.innerHTML = roots.length
      ? roots.map((n) => renderNode(n, 0)).join('')
      : '<p class="text-muted">Aucune catégorie. Ajoutez un nœud racine.</p>';

    container.querySelectorAll('.gderpi-node-select').forEach((btn) => {
      btn.addEventListener('click', () => {
        const row = btn.closest('.gderpi-node-row');
        const id = row && row.getAttribute('data-node-id');
        container.querySelectorAll('.gderpi-node-row').forEach((r) => r.classList.remove('is-selected'));
        if (row) row.classList.add('is-selected');
        if (onSelect && id) onSelect(id);
      });
    });

    container.querySelectorAll('.gderpi-node-delete').forEach((btn) => {
      btn.addEventListener('click', async (ev) => {
        ev.stopPropagation();
        const row = btn.closest('.gderpi-node-row');
        const id = row && row.getAttribute('data-node-id');
        if (!id || !onDelete) return;
        if (!window.confirm('Supprimer cette catégorie ? Les sous-catégories seront remontées.')) return;
        await onDelete(id);
      });
    });
  }

  global.GderpiNodesRender = { renderNodesTree };
})(window);
