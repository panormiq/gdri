/**
 * FICHIER : modules/ugap/frontend/parametrage/assets/js/catalogue/catalogue-tab.js
 * RÔLE : Onglet Catalogue v2 — arbre unifié (nodes[]) + détail nœud.
 *
 * SORTIES : mountUgapCatalogue, UgapCatalogueTab
 * APPELÉ PAR : parametrage-boot.js
 */
(function initUgapCatalogueTab(global) {
    'use strict';

    const MOUNT_ID = 'ugap-catalogue-mount';
    const State = () => global.UgapCatalogueLcState;
    const Core = () => global.UgapCatalogueNodesCore;
    const Types = () => global.UgapCatalogueTypes;

    let mountEl = null;
    let delegatesBound = false;

    let ui = { nodeId: '', view: 'structure', tagFilter: '' };

    function esc(v) {
        if (typeof global.escapeHtml === 'function') return global.escapeHtml(v);
        return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    function toast(msg, type) {
        global.showAlert?.(msg, type || 'info');
    }

    function selectedNode() {
        const id = String(ui.nodeId || '').trim();
        if (!id) return null;
        return State()?.getNodeById?.(id) || null;
    }

    function nodeStats(nodes, nodeId) {
        const optCount = State().getOptionsForNode(nodeId, nodes).length;
        const childCount = Core()?.getChildren?.(nodes, nodeId).length || 0;
        return Core()?.nodeRoleLabel?.(optCount, childCount) || { type: 'empty', text: '—' };
    }

    /** Liste parent pour le select : racine + arbre indenté. */
    function buildParentSelectOptions(nodes, excludeNodeId) {
        const exclude = String(excludeNodeId || '').trim();
        const drop = exclude
            ? new Set([exclude, ...Core()?.collectDescendantIds?.(nodes, exclude)])
            : null;
        const options = [{ value: '', label: '— Racine (aucun parent) —' }];

        const walk = (parentId, depth) => {
            (Core()?.getChildren?.(nodes, parentId) || []).forEach((node) => {
                if (drop?.has(node.id)) return;
                const path = Core()?.nodeBreadcrumb?.(nodes, node.id) || node.label;
                const prefix = depth > 0 ? `${'　'.repeat(depth)}└ ` : '';
                options.push({ value: node.id, label: `${prefix}${path}` });
                walk(node.id, depth + 1);
            });
        };
        walk('', 0);
        return options;
    }

    function renderTreeNodes(nodes, parentId) {
        const children = Core()?.getChildren?.(nodes, parentId) || [];
        if (!children.length && !parentId) {
            return '<p class="ugap-catalogue-muted">Aucun nœud. Utilisez « Créer un nœud ».</p>';
        }
        return children.map((node) => {
            const id = String(node.id);
            const active = ui.nodeId === id ? ' is-active' : '';
            const role = nodeStats(nodes, id);
            const badgeClass = role.type === 'choice' ? 'ugap-catalogue-tree__count' : 'ugap-catalogue-tree__count ugap-catalogue-tree__count--multi';
            const kids = renderTreeNodes(nodes, id);
            return `
                <div class="ugap-catalogue-tree__item">
                    <div class="ugap-catalogue-tree__row${active}" data-pick-node="${esc(id)}">
                        <button type="button" class="ugap-catalogue-tree__pick" data-pick-node="${esc(id)}">
                            <span class="ugap-catalogue-tree__label">${esc(node.label)}</span>
                            <span class="${badgeClass}">${esc(role.text)}</span>
                        </button>
                    </div>
                    ${kids ? `<div class="ugap-catalogue-tree__children">${kids}</div>` : ''}
                </div>`;
        }).join('');
    }

    function renderTagChips(catalog) {
        const registry = Array.isArray(catalog?.tagRegistry) ? catalog.tagRegistry : [];
        const tabs = [{ id: '', label: 'Tous' }, ...registry];
        return `<div class="ugap-catalogue-tag-tabs">${tabs.map((t) => {
            const active = ui.tagFilter === t.id ? ' is-active' : '';
            return `<button type="button" class="btn btn-outline btn-sm${active}" data-tag-filter="${esc(t.id)}">${esc(t.label)}</button>`;
        }).join('')}</div>`;
    }

    function renderTagViewHtml(catalog) {
        const filter = String(ui.tagFilter || '').trim();
        const options = State().getAllOptions().filter((o) => {
            if (!filter) return true;
            return (o.tags || []).includes(filter);
        });
        const nodeMap = new Map((catalog.nodes || []).map((n) => [n.id, n]));
        const rows = options.map((o) => {
            const node = nodeMap.get(o.catalogObjectId);
            const where = node
                ? Core()?.nodeBreadcrumb?.(catalog.nodes, node.id) || node.label
                : '— non lié —';
            return `<tr>
                <td>${esc(o.name)}</td>
                <td>${esc(where)}</td>
                <td>${esc(o.categoryName)}</td>
                <td>${(o.tags || []).map((t) => `<span class="ugap-catalogue-tag-pill">${esc(t)}</span>`).join(' ')}</td>
            </tr>`;
        }).join('');
        return `
            ${renderTagChips(catalog)}
            <div class="ugap-catalogue-tag-table-wrap">
                <table class="ugap-catalogue-tag-table">
                    <thead><tr><th>Option</th><th>Nœud catalogue</th><th>Import</th><th>Tags</th></tr></thead>
                    <tbody>${rows || '<tr><td colspan="4" class="ugap-catalogue-muted">Aucune option.</td></tr>'}</tbody>
                </table>
            </div>`;
    }

    function renderDetailForm(catalog, node) {
        const registry = catalog.tagRegistry || [];
        const tagChecks = registry.map((t) => {
            const on = (node.tags || []).includes(t.id) ? ' checked' : '';
            return `<label class="ugap-catalogue-tag-check"><input type="checkbox" data-node-tag="${esc(t.id)}"${on}> ${esc(t.label)}</label>`;
        }).join('');

        const parentId = String(node.parentId || '').trim();
        const parentOptions = buildParentSelectOptions(catalog.nodes, node.id)
            .map((o) => {
                const selected = o.value === parentId ? ' selected' : '';
                return `<option value="${esc(o.value)}"${selected}>${esc(o.label)}</option>`;
            })
            .join('');

        const linked = State().getOptionsForNode(node.id, catalog.nodes);
        const optList = linked.length
            ? `<ul class="ugap-catalogue-linked-list">${linked.map((o) =>
                `<li><strong>${esc(o.name)}</strong>${o.details ? ` — <span class="ugap-catalogue-muted">${esc(o.details)}</span>` : ''}</li>`
            ).join('')}</ul>`
            : '<p class="ugap-catalogue-muted">Aucune option liée. Utilisez « Proposer des liaisons » ou « Créer une option ».</p>';

        const hideMinoration = Core()?.resolveHideMinorationInChoices?.(node) === true;

        return `
            <form class="ugap-catalogue-detail-form" data-node-detail-form>
                <p class="ugap-catalogue-breadcrumb">${esc(Core()?.nodeBreadcrumb?.(catalog.nodes, node.id) || node.label)}</p>
                <label class="ugap-catalogue-modal__field">
                    <span>Libellé</span>
                    <input type="text" data-node-label value="${esc(node.label)}" required>
                </label>
                <label class="ugap-catalogue-modal__field">
                    <span>Parent</span>
                    <select data-node-parent>${parentOptions}</select>
                    <span class="ugap-catalogue-muted">Racine = aucun parent. Les descendants de ce nœud sont exclus.</span>
                </label>
                <label class="ugap-catalogue-modal__field">
                    <span>Mots-clés (liaison heuristique)</span>
                    <input type="text" data-node-keywords value="${esc(node.keywords)}" placeholder='"pont", passerelle, bain'>
                    <span class="ugap-catalogue-muted">Même filtre que l’onglet Options : sous-chaîne (accents ignorés). Virgules = OU ; guillemets = phrase obligatoire.</span>
                </label>
                <label class="ugap-catalogue-modal__field">
                    <span>Mode de décision</span>
                    <select data-node-decision>
                        <option value="single_choice"${node.decisionMode !== 'multi_choice' ? ' selected' : ''}>Choix unique</option>
                        <option value="multi_choice"${node.decisionMode === 'multi_choice' ? ' selected' : ''}>Choix multiple</option>
                    </select>
                </label>
                <label class="ugap-catalogue-modal__field ugap-catalogue-checkbox-field">
                    <span class="ugap-catalogue-checkbox-field__row">
                        <input type="checkbox" data-node-hide-minoration${hideMinoration ? ' checked' : ''}>
                        <span class="ugap-catalogue-checkbox-field__label">Ne pas afficher minoration</span>
                    </span>
                    <span class="ugap-catalogue-muted ugap-catalogue-checkbox-field__hint">Dans le configurateur, les lignes minoration (MINO) sont exclues du picker de ce nœud. Coché par défaut pour Moteur / Motorisation.</span>
                </label>
                <fieldset class="ugap-catalogue-modal__field">
                    <legend>Tags catalogue</legend>
                    <div class="ugap-catalogue-tag-checks">${tagChecks || '<span class="ugap-catalogue-muted">Aucun tag.</span>'}</div>
                </fieldset>
                <div class="ugap-catalogue-detail-actions">
                    <button type="button" class="btn btn-primary" data-save-node-detail>Enregistrer</button>
                    <button type="button" class="btn btn-outline" data-associate-node-auto
                        title="Lie automatiquement les options correspondant aux mots-clés de ce nœud uniquement">
                        Associer options à ce nœud
                    </button>
                    <button type="button" class="btn btn-outline" data-suggest-links>Proposer des liaisons</button>
                    <button type="button" class="btn btn-outline" data-create-option>Créer une option</button>
                    <button type="button" class="btn btn-outline btn-danger" data-delete-node>Supprimer</button>
                </div>
                <section class="ugap-catalogue-linked-section">
                    <h4>Options liées (${linked.length})</h4>
                    ${optList}
                </section>
            </form>`;
    }

    function renderDetailHtml(catalog) {
        const node = selectedNode();
        if (!node) {
            return '<p class="ugap-catalogue-muted">Sélectionnez un nœud dans l’arbre, ou <button type="button" class="ugap-catalogue-inline-link" data-create-node>créez-en un</button>.</p>';
        }
        return renderDetailForm(catalog, node);
    }

    function readDetailTags(root) {
        const tags = [];
        root?.querySelectorAll('[data-node-tag]:checked').forEach((el) => {
            const id = el.getAttribute('data-node-tag');
            if (id) tags.push(id);
        });
        return tags;
    }

    function ensureConfirmModal() {
        if (global.document.getElementById('ugap-catalogue-confirm-modal')) return;
        const wrap = global.document.createElement('div');
        wrap.innerHTML = `
            <div id="ugap-catalogue-confirm-modal" class="ugap-catalogue-link-modal" hidden role="dialog" aria-modal="true">
                <div class="ugap-catalogue-link-modal__backdrop" data-catalogue-confirm-close></div>
                <div class="ugap-catalogue-link-modal__panel card">
                    <p id="ugap-catalogue-confirm-msg"></p>
                    <footer class="ugap-catalogue-link-modal__foot">
                        <button type="button" class="btn btn-outline" data-catalogue-confirm-close>Annuler</button>
                        <button type="button" class="btn btn-primary" id="ugap-catalogue-confirm-ok">Confirmer</button>
                    </footer>
                </div>
            </div>`;
        global.document.body.appendChild(wrap.firstElementChild);
    }

    let confirmCallback = null;

    function openConfirm(message, onOk) {
        ensureConfirmModal();
        const modal = global.document.getElementById('ugap-catalogue-confirm-modal');
        const msg = global.document.getElementById('ugap-catalogue-confirm-msg');
        if (!modal || !msg) return;
        msg.textContent = message;
        msg.style.whiteSpace = 'pre-line';
        confirmCallback = onOk;
        modal.hidden = false;
    }

    function closeConfirm() {
        const modal = global.document.getElementById('ugap-catalogue-confirm-modal');
        if (modal) modal.hidden = true;
        confirmCallback = null;
    }

    function ensureCreateNodeModal() {
        if (global.document.getElementById('ugap-catalogue-node-create-modal')) return;
        const wrap = global.document.createElement('div');
        wrap.innerHTML = `
            <div id="ugap-catalogue-node-create-modal" class="ugap-catalogue-link-modal" hidden role="dialog" aria-modal="true"
                aria-labelledby="ugap-catalogue-node-create-title">
                <div class="ugap-catalogue-link-modal__backdrop" data-catalogue-node-create-close></div>
                <div class="ugap-catalogue-link-modal__panel card ugap-catalogue-modal__panel--wide">
                    <header class="ugap-catalogue-link-modal__head">
                        <h3 id="ugap-catalogue-node-create-title">Créer un nœud</h3>
                        <button type="button" class="btn btn-outline btn-sm" data-catalogue-node-create-close aria-label="Fermer">×</button>
                    </header>
                    <div class="ugap-catalogue-modal__body">
                        <label class="ugap-catalogue-modal__field">
                            <span>Libellé <span class="ugap-catalogue-muted">*</span></span>
                            <input type="text" id="ugap-catalogue-node-create-label" autocomplete="off" required>
                        </label>
                        <label class="ugap-catalogue-modal__field">
                            <span>Parent</span>
                            <select id="ugap-catalogue-node-create-parent"></select>
                            <small class="ugap-catalogue-muted">Racine = nœud de premier niveau.</small>
                        </label>
                    </div>
                    <footer class="ugap-catalogue-modal__foot">
                        <button type="button" class="btn btn-outline" data-catalogue-node-create-close>Annuler</button>
                        <button type="button" class="btn btn-primary" id="ugap-catalogue-node-create-submit">Créer</button>
                    </footer>
                </div>
            </div>`;
        global.document.body.appendChild(wrap.firstElementChild);
    }

    function closeCreateNodeModal() {
        const modal = global.document.getElementById('ugap-catalogue-node-create-modal');
        if (modal) modal.hidden = true;
    }

    function fillCreateNodeParentSelect(defaultParentId) {
        const sel = global.document.getElementById('ugap-catalogue-node-create-parent');
        if (!sel) return;
        const nodes = State().getCatalog().nodes || [];
        const pref = String(defaultParentId || '').trim();
        sel.innerHTML = buildParentSelectOptions(nodes).map((o) => {
            const selected = o.value === pref ? ' selected' : '';
            return `<option value="${esc(o.value)}"${selected}>${esc(o.label)}</option>`;
        }).join('');
        if (pref && [...sel.options].some((opt) => opt.value === pref)) {
            sel.value = pref;
        }
    }

    function openCreateNodeModal(defaultParentId) {
        ensureCreateNodeModal();
        const modal = global.document.getElementById('ugap-catalogue-node-create-modal');
        const input = global.document.getElementById('ugap-catalogue-node-create-label');
        if (!modal || !input) return;
        fillCreateNodeParentSelect(defaultParentId ?? ui.nodeId);
        input.value = '';
        modal.hidden = false;
        input.focus();
    }

    function submitCreateNode() {
        const label = String(global.document.getElementById('ugap-catalogue-node-create-label')?.value || '').trim();
        const parentId = String(global.document.getElementById('ugap-catalogue-node-create-parent')?.value || '').trim();
        if (!label) {
            toast('Libellé requis.', 'warning');
            return;
        }
        const row = State().addNode({ parentId, label });
        if (!row) {
            toast('Impossible de créer le nœud.', 'error');
            return;
        }
        ui.nodeId = row.id;
        closeCreateNodeModal();
        renderStructurePanels({ tree: true, detail: true, preserveTreeScroll: true });
        toast('Nœud créé.', 'success');
    }

    function ensureModals() {
        ensureConfirmModal();
        ensureCreateNodeModal();

        const confirmModal = global.document.getElementById('ugap-catalogue-confirm-modal');
        if (confirmModal && !confirmModal.dataset.bound) {
            confirmModal.dataset.bound = '1';
            confirmModal.querySelectorAll('[data-catalogue-confirm-close]').forEach((el) => {
                el.addEventListener('click', closeConfirm);
            });
            global.document.getElementById('ugap-catalogue-confirm-ok')?.addEventListener('click', () => {
                const fn = confirmCallback;
                closeConfirm();
                if (fn) void fn();
            });
        }

        const createModal = global.document.getElementById('ugap-catalogue-node-create-modal');
        if (createModal && !createModal.dataset.bound) {
            createModal.dataset.bound = '1';
            createModal.querySelectorAll('[data-catalogue-node-create-close]').forEach((el) => {
                el.addEventListener('click', closeCreateNodeModal);
            });
            global.document.getElementById('ugap-catalogue-node-create-submit')?.addEventListener('click', submitCreateNode);
            global.document.getElementById('ugap-catalogue-node-create-label')?.addEventListener('keydown', (ev) => {
                if (ev.key === 'Enter') {
                    ev.preventDefault();
                    submitCreateNode();
                }
            });
        }
    }

    function captureTreeScroll() {
        const el = mountEl?.querySelector('.ugap-catalogue-col__body--tree');
        return el ? el.scrollTop : 0;
    }

    function restoreTreeScroll(scrollTop) {
        const el = mountEl?.querySelector('.ugap-catalogue-col__body--tree');
        if (el && Number.isFinite(scrollTop)) el.scrollTop = scrollTop;
    }

    function updateTreeActiveState() {
        const root = mountEl?.querySelector('[data-ugap-catalogue-root]');
        if (!root) return;
        const activeId = String(ui.nodeId || '').trim();
        root.querySelectorAll('.ugap-catalogue-tree__row').forEach((row) => {
            const id = String(row.getAttribute('data-pick-node') || '').trim();
            row.classList.toggle('is-active', id === activeId && !!activeId);
        });
    }

    function scrollTreeToActiveNode() {
        const root = mountEl?.querySelector('[data-ugap-catalogue-root]');
        const treeBody = root?.querySelector('.ugap-catalogue-col__body--tree');
        const active = root?.querySelector('.ugap-catalogue-tree__row.is-active');
        if (!treeBody || !active) return;
        const bodyRect = treeBody.getBoundingClientRect();
        const rowRect = active.getBoundingClientRect();
        if (rowRect.top < bodyRect.top || rowRect.bottom > bodyRect.bottom) {
            active.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
    }

    function renderDetailPanel() {
        const panel = mountEl?.querySelector('.ugap-catalogue-col__body--detail');
        if (!panel) return false;
        const catalog = State().getCatalog();
        panel.innerHTML = renderDetailHtml(catalog);
        return true;
    }

    function renderTreePanel(preserveScroll = true) {
        const treeBody = mountEl?.querySelector('.ugap-catalogue-col__body--tree');
        if (!treeBody) return false;
        const scrollTop = preserveScroll ? treeBody.scrollTop : 0;
        const catalog = State().getCatalog();
        treeBody.innerHTML = renderTreeNodes(catalog.nodes, '');
        if (preserveScroll) treeBody.scrollTop = scrollTop;
        updateTreeActiveState();
        return true;
    }

    /** Mise à jour partielle structure : évite de reconstruire tout l’écran au clic arbre. */
    function renderStructurePanels(options = {}) {
        const { tree = true, detail = true, preserveTreeScroll = true } = options;
        const root = mountEl?.querySelector('[data-ugap-catalogue-root]');
        if (!root || ui.view !== 'structure') {
            render({ preserveTreeScroll });
            return;
        }
        if (tree) renderTreePanel(preserveTreeScroll);
        else updateTreeActiveState();
        if (detail) renderDetailPanel();
    }

    function selectNode(nodeId) {
        ui.nodeId = String(nodeId || '').trim();
        if (!renderDetailPanel()) {
            render({ preserveTreeScroll: true });
            return;
        }
        updateTreeActiveState();
        scrollTreeToActiveNode();
    }

    function render(options = {}) {
        if (!mountEl) return;
        const preserveTreeScroll = options.preserveTreeScroll !== false;
        const scrollTop = preserveTreeScroll ? captureTreeScroll() : 0;
        const catalog = State().getCatalog();
        const structureView = ui.view === 'structure';

        mountEl.innerHTML = `
            <div class="ugap-catalogue" data-ugap-catalogue-root>
                <header class="ugap-catalogue-header">
                    <div>
                        <h2 class="ugap-catalogue-title">Catalogue</h2>
                        <p class="ugap-catalogue-desc">Arbre catalogue + liaison des options (catalogObjectId).
                            Mots-clés sur chaque nœud ; « Associer options aux nœuds » traite l’arbre nœud par nœud.</p>
                    </div>
                    <div class="ugap-catalogue-header__actions">
                        <button type="button" class="btn btn-primary btn-sm" data-bulk-associate-options
                            title="Parcourt chaque nœud (mots-clés) et lie les options correspondantes">
                            Associer options aux nœuds
                        </button>
                        <button type="button" class="btn btn-outline${structureView ? ' is-active' : ''}" data-view="structure">Structure</button>
                        <button type="button" class="btn btn-outline${!structureView ? ' is-active' : ''}" data-view="tags">Vue tags</button>
                        <button type="button" class="btn btn-outline btn-sm" data-refresh-catalogue title="Recharger">↻</button>
                    </div>
                </header>
                ${structureView ? `
                <div class="ugap-catalogue-grid">
                    <aside class="ugap-catalogue-col ugap-catalogue-col--tree">
                        <div class="ugap-catalogue-col__head ugap-catalogue-col__head--with-action">
                            <h3>Arbre</h3>
                            <button type="button" class="ugap-catalogue-head-btn ugap-catalogue-action-btn ugap-catalogue-action-btn--create" data-create-node>Créer un nœud</button>
                        </div>
                        <div class="ugap-catalogue-col__body ugap-catalogue-col__body--tree">${renderTreeNodes(catalog.nodes, '')}</div>
                    </aside>
                    <section class="ugap-catalogue-col ugap-catalogue-col--detail">
                        <div class="ugap-catalogue-col__head">
                            <h3>Détail du nœud</h3>
                        </div>
                        <div class="ugap-catalogue-col__body ugap-catalogue-col__body--detail">${renderDetailHtml(catalog)}</div>
                    </section>
                </div>` : `<div class="ugap-catalogue-grid ugap-catalogue-grid--single">${renderTagViewHtml(catalog)}</div>`}
            </div>`;

        if (structureView && preserveTreeScroll) {
            global.requestAnimationFrame(() => {
                restoreTreeScroll(scrollTop);
                updateTreeActiveState();
            });
        }
    }

    async function saveNodeDetail(root) {
        const node = selectedNode();
        if (!node || !root) return;
        const label = String(root.querySelector('[data-node-label]')?.value || '').trim();
        if (!label) {
            toast('Libellé requis.', 'warning');
            return;
        }
        const parentId = String(root.querySelector('[data-node-parent]')?.value || '').trim();
        const check = Core()?.canSetNodeParent?.(State().getCatalog().nodes, node.id, parentId);
        if (check && !check.ok) {
            toast(check.message || 'Parent invalide.', 'warning');
            return;
        }
        try {
            State().updateNode(node.id, {
                label,
                parentId,
                keywords: String(root.querySelector('[data-node-keywords]')?.value || '').trim(),
                decisionMode: root.querySelector('[data-node-decision]')?.value === 'multi_choice' ? 'multi_choice' : 'single_choice',
                hideMinorationInChoices: !!root.querySelector('[data-node-hide-minoration]')?.checked,
                tags: readDetailTags(root),
            });
            await State().persistNow();
        } catch (err) {
            toast(err?.message || 'Enregistrement impossible.', 'error');
            return;
        }
        toast('Nœud enregistré.', 'success');
        renderStructurePanels({ tree: true, detail: true, preserveTreeScroll: true });
    }

    function onMountClick(ev) {
        const root = mountEl?.querySelector('[data-ugap-catalogue-root]');
        if (!root || !root.contains(ev.target)) return;

        const viewBtn = ev.target.closest('[data-view]');
        if (viewBtn) {
            ui.view = viewBtn.getAttribute('data-view') === 'tags' ? 'tags' : 'structure';
            render();
            return;
        }
        if (ev.target.closest('[data-refresh-catalogue]')) {
            void State()?.reload?.().then(render);
            return;
        }
        if (ev.target.closest('[data-bulk-associate-options]')) {
            if (!global.UgapCatalogueBulkLink?.runWithConfirm) {
                toast('Module d’association catalogue indisponible — rechargez la page (Ctrl+F5).', 'error');
                return;
            }
            void global.UgapCatalogueBulkLink.runWithConfirm({ confirm: openConfirm })
                .then((result) => {
                    if (result?.saved) renderStructurePanels({ tree: true, detail: true, preserveTreeScroll: true });
                })
                .catch(() => { /* alerté dans bulk-link */ });
            return;
        }
        const tagTab = ev.target.closest('[data-tag-filter]');
        if (tagTab) {
            ui.tagFilter = tagTab.getAttribute('data-tag-filter') || '';
            render();
            return;
        }

        const pick = ev.target.closest('[data-pick-node]');
        if (pick) {
            selectNode(pick.getAttribute('data-pick-node') || '');
            return;
        }

        if (ev.target.closest('[data-create-node]')) {
            openCreateNodeModal(ui.nodeId);
            return;
        }

        if (ev.target.closest('[data-save-node-detail]')) {
            void saveNodeDetail(root);
            return;
        }

        if (ev.target.closest('[data-delete-node]')) {
            const node = selectedNode();
            if (!node) return;
            const kids = Core()?.collectDescendantIds?.(State().getCatalog().nodes, node.id);
            const msg = kids?.size
                ? `Supprimer « ${node.label} » et ${kids.size} descendant(s) ?`
                : `Supprimer « ${node.label} » ?`;
            openConfirm(msg, async () => {
                State().deleteNode(node.id);
                ui.nodeId = '';
                await State()?.persistNow?.();
                renderStructurePanels({ tree: true, detail: true, preserveTreeScroll: true });
                toast('Supprimé.', 'success');
            });
            return;
        }

        if (ev.target.closest('[data-suggest-links]')) {
            const node = selectedNode();
            if (!node) {
                toast('Sélectionnez un nœud.', 'warning');
                return;
            }
            const draft = {
                ...node,
                keywords: String(root.querySelector('[data-node-keywords]')?.value || node.keywords || '').trim(),
            };
            void global.UgapCatalogueLinkModal?.open({
                catalogObject: draft,
                onApplied: () => renderStructurePanels({ tree: true, detail: true, preserveTreeScroll: true }),
            });
            return;
        }

        if (ev.target.closest('[data-associate-node-auto]')) {
            const node = selectedNode();
            if (!node) {
                toast('Sélectionnez un nœud.', 'warning');
                return;
            }
            if (!global.UgapCatalogueBulkLink?.runSingleNodeWithConfirm) {
                toast('Module d’association catalogue indisponible — rechargez la page (Ctrl+F5).', 'error');
                return;
            }
            const draft = {
                ...node,
                keywords: String(root.querySelector('[data-node-keywords]')?.value || node.keywords || '').trim(),
            };
            const btn = ev.target.closest('[data-associate-node-auto]');
            void global.UgapCatalogueBulkLink.runSingleNodeWithConfirm(draft, {
                confirm: openConfirm,
                btn,
            }).then((result) => {
                if (result?.saved) {
                    renderStructurePanels({ tree: true, detail: true, preserveTreeScroll: true });
                }
            }).catch(() => { /* alerté dans bulk-link */ });
            return;
        }

        if (ev.target.closest('[data-create-option]')) {
            const node = selectedNode();
            if (!node) {
                toast('Sélectionnez un nœud.', 'warning');
                return;
            }
            global.UgapCatalogueCreateOptionModal?.open({
                catalogObject: node,
                onCreated: () => renderStructurePanels({ tree: true, detail: true, preserveTreeScroll: true }),
            });
        }
    }

    function bindDelegates() {
        if (delegatesBound || !mountEl) return;
        delegatesBound = true;
        mountEl.addEventListener('click', onMountClick);
    }

    async function mount() {
        mountEl = global.document.getElementById(MOUNT_ID);
        if (!mountEl) return;
        ensureModals();
        bindDelegates();
        try {
            await State()?.loadFromServer?.(true);
        } catch (err) {
            mountEl.innerHTML = `<p class="ugap-param-placeholder">Erreur : ${esc(err?.message || err)}</p>`;
            return;
        }
        render();
        if (typeof global.scheduleParentEmbedResize === 'function') {
            global.scheduleParentEmbedResize();
        }
    }

    async function refresh() {
        await State()?.reload?.();
        render();
    }

    global.UgapCatalogueTab = { mount, refresh, openConfirm };
    global.mountUgapCatalogue = mount;
})(window);
