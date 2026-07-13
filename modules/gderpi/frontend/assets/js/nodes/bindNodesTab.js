/**
 * FICHIER : modules/gderpi/frontend/assets/js/nodes/bindNodesTab.js
 * RÔLE : Onglet catégories — arbre + panneau création (vue LC adaptée).
 */

(function initGderpiBindNodesTab(global) {
  'use strict';

  let nodesState = { tree: [], nodes: [] };
  let selectedNodeId = '';

  async function reloadNodes() {
    const res = await global.GderpiApi.apiCall('/nodes');
    nodesState = res.data || { tree: [], nodes: [] };
    const treeEl = document.getElementById('gderpi-nodes-tree');
    if (!treeEl) return;
    global.GderpiNodesRender.renderNodesTree(nodesState.tree, treeEl, {
      onSelect: (id) => {
        selectedNodeId = id;
        const parentInput = document.getElementById('gderpi-node-parent');
        if (parentInput) parentInput.value = id;
        if (typeof global.GderpiAppNav === 'function') {
          global.GderpiAppNav('articles');
        }
        global.GderpiArticlesRefresh?.refreshArticlesList?.(id);
      },
      onDelete: async (id) => {
        await global.GderpiApi.apiCall('/nodes/' + encodeURIComponent(id), { method: 'DELETE' });
        global.GderpiStatus.showStatus('Catégorie supprimée.', 'success');
        if (selectedNodeId === id) selectedNodeId = '';
        await reloadNodes();
        global.GderpiArticlesRefresh?.refreshArticlesList?.('');
        global.GderpiDashboardTab?.refreshDashboard?.();
      }
    });
    global.GderpiArticlesRefresh?.populateNodeSelects?.(nodesState.nodes);
  }

  function bindNodesTab() {
    const root = document.querySelector('[data-gderpi-vue-lc="categories"]');
    const createBtn = root?.querySelector('[data-gderpi-lc-create="categories"]');
    const createPanel = root?.querySelector('[data-gderpi-lc-create-panel="categories"]');
    const form = document.getElementById('gderpi-node-form');
    const btnReload = document.getElementById('gderpi-nodes-reload');
    const nodeModal = createPanel && global.GderpiModal
      ? global.GderpiModal.enhance(createPanel, { title: 'Nouvelle catégorie' })
      : null;

    if (createBtn && createPanel && !createBtn.dataset.gderpiLcBound) {
      createBtn.dataset.gderpiLcBound = '1';
      createBtn.addEventListener('click', () => {
        if (nodeModal) {
          if (nodeModal.isOpen()) nodeModal.close();
          else {
            nodeModal.open();
            document.getElementById('gderpi-node-label')?.focus();
          }
          createBtn.setAttribute('aria-expanded', nodeModal.isOpen() ? 'true' : 'false');
          return;
        }
        const open = createPanel.hasAttribute('hidden');
        if (open) {
          createPanel.removeAttribute('hidden');
          createBtn.setAttribute('aria-expanded', 'true');
          document.getElementById('gderpi-node-label')?.focus();
        } else {
          createPanel.setAttribute('hidden', '');
          createBtn.setAttribute('aria-expanded', 'false');
        }
      });
    }

    if (btnReload) btnReload.addEventListener('click', () => reloadNodes().catch(handleErr));

    if (form) {
      form.addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const label = document.getElementById('gderpi-node-label').value.trim();
        const parentId = document.getElementById('gderpi-node-parent').value.trim();
        if (!label) return;
        await global.GderpiApi.apiCall('/nodes', {
          method: 'POST',
          body: JSON.stringify({ label, parentId })
        });
        form.reset();
        if (nodeModal) nodeModal.close();
        else if (createPanel) createPanel.setAttribute('hidden', '');
        if (createBtn) createBtn.setAttribute('aria-expanded', 'false');
        global.GderpiStatus.showStatus('Catégorie créée.', 'success');
        await reloadNodes();
      });
    }
  }

  function handleErr(err) {
    global.GderpiStatus.showStatus(err.message || 'Erreur catégories', 'danger');
  }

  global.GderpiNodesTab = { bindNodesTab, reloadNodes, getSelectedNodeId: () => selectedNodeId };
})(window);
