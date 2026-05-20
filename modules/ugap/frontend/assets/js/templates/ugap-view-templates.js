/**
 * Templates de vues UGAP
 * - tutorial : enveloppe d'onglet + aide contextuelle (FAB)
 * - vueLC    : liste configurable + panneau création au clic
 */
(function initUgapViewTemplates(global) {
    const doc = global.document;
    if (!doc) return;

    const TAB_LABELS = {
        import: 'Import',
        famille: 'Famille',
        'template-bateau': 'Template bateau',
        models: 'Modèles',
        categories: 'Vues métier',
        options: 'Options'
    };

    const TUTORIAL_CONTENT = Object.fromEntries(
        Object.entries(TAB_LABELS).map(([key, label]) => [key, `tuto pour l'onglet ${label}`])
    );

    /** Politique commune Vue LC : bouton « Créer un/une … » (article inclus). */
    const LC_CREATE_BUTTON_LABELS = {
        famille: 'Créer une famille',
        'template-bateau': 'Créer un template bateau',
        template: 'Créer un template',
        modele: 'Créer un modèle',
        models: 'Créer un modèle',
        option: 'Créer une option'
    };

    function resolveLcCreateButtonLabel(config) {
        if (config?.createButtonLabel) return String(config.createButtonLabel).trim();
        const key = String(config?.elementKey || '').trim();
        const label = String(config?.elementLabel || '').trim().toLowerCase();
        if (LC_CREATE_BUTTON_LABELS[key]) return LC_CREATE_BUTTON_LABELS[key];
        if (LC_CREATE_BUTTON_LABELS[label]) return LC_CREATE_BUTTON_LABELS[label];
        return `Créer un ${label || 'élément'}`;
    }

    function escapeHtml(value) {
        if (global.escapeHtml && typeof global.escapeHtml === 'function') {
            return global.escapeHtml(value);
        }
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function getCellValue(row, column) {
        if (typeof column.getValue === 'function') {
            return column.getValue(row);
        }
        if (column.key) return row[column.key];
        return '';
    }

    function renderCell(row, column) {
        if (column.type === 'html') {
            const raw = getCellValue(row, column);
            return raw == null ? '' : String(raw);
        }
        const value = getCellValue(row, column);
        if (value == null || value === '') {
            return escapeHtml(column.empty ?? '—');
        }
        return escapeHtml(String(value));
    }

    function getLcListState(elementKey) {
        global.__ugapLcListState = global.__ugapLcListState || {};
        if (!global.__ugapLcListState[elementKey]) {
            global.__ugapLcListState[elementKey] = { search: '', sortDir: 'asc' };
        }
        return global.__ugapLcListState[elementKey];
    }

    function filterLcRows(rows, search, searchKeys) {
        const q = String(search || '').trim().toLowerCase();
        if (!q) return rows;
        const keys = Array.isArray(searchKeys) && searchKeys.length ? searchKeys : [];
        return rows.filter((row) => keys.some((key) =>
            String(row?.[key] ?? '').toLowerCase().includes(q)
        ));
    }

    function sortLcRows(rows, sortKey, sortDir) {
        const key = String(sortKey || '').trim();
        if (!key) return rows.slice();
        const dir = sortDir === 'desc' ? 'desc' : 'asc';
        const sorted = rows.slice().sort((a, b) => {
            const av = String(a?.[key] ?? '').trim();
            const bv = String(b?.[key] ?? '').trim();
            return av.localeCompare(bv, 'fr', { sensitivity: 'base' });
        });
        return dir === 'desc' ? sorted.reverse() : sorted;
    }

    function getLcRowIndex(row, displayIndex) {
        if (row && Number.isInteger(row.__idx)) return row.__idx;
        return displayIndex;
    }

    function buildVueLCTableBodyHtml(rows, columns, config, elementKey) {
        const emptyMessage = config.emptyMessage || 'Aucun élément pour le moment.';
        const emptySearchMessage = config.emptySearchMessage || 'Aucun résultat pour cette recherche.';
        const hasSearch = String(getLcListState(elementKey).search || '').trim().length > 0;
        const list = Array.isArray(rows) ? rows : [];

        if (list.length === 0) {
            const msg = hasSearch ? emptySearchMessage : emptyMessage;
            return `<tr><td colspan="${Math.max(columns.length, 1)}"><div class="ugap-vue-lc__empty">${escapeHtml(msg)}</div></td></tr>`;
        }

        return list.map((row, displayIndex) => {
            const cells = columns.map((col) => `<td>${renderCell(row, col)}</td>`).join('');
            const rowIdx = getLcRowIndex(row, displayIndex);
            const dblAttr = config.rowDblClickHandler
                ? ` data-ugap-lc-row-index="${rowIdx}" data-ugap-lc-element="${escapeHtml(elementKey)}" style="cursor:pointer;" title="Double-clic pour éditer"`
                : '';
            return `<tr${dblAttr}>${cells}</tr>`;
        }).join('');
    }

    function updateVueLCCount(shell, elementKey, visibleCount, totalCount, countLabel) {
        const el = shell.querySelector(`[data-ugap-lc-count="${elementKey}"]`);
        if (!el) return;
        const label = countLabel || 'élément(s)';
        if (totalCount === 0) {
            el.textContent = '';
            return;
        }
        if (visibleCount < totalCount) {
            el.textContent = `${visibleCount} sur ${totalCount} ${label}`;
        } else {
            el.textContent = `${totalCount} ${label}`;
        }
    }

    function getSortHeaderTitle(sortDir) {
        return sortDir === 'desc' ? 'Tri Z → A (cliquer pour inverser)' : 'Tri A → Z (cliquer pour inverser)';
    }

    function getSortHeaderIndicator(sortDir) {
        return sortDir === 'desc' ? '▼' : '▲';
    }

    function renderVueLCHeaderHtml(columns, elementKey, listToolbar, listState) {
        return columns.map((col) => {
            const label = escapeHtml(col.label || col.key || '');
            const isSortCol = listToolbar && listState
                && String(listToolbar.sortKey || '').trim() === String(col.key || '').trim();
            if (isSortCol) {
                return `<th class="ugap-vue-lc__th--sortable">
                    <span class="ugap-vue-lc__th-label">${label}</span>
                    <button
                        type="button"
                        class="ugap-vue-lc__th-sort${listState.sortDir === 'desc' ? ' is-desc' : ''}"
                        data-ugap-lc-sort="${escapeHtml(elementKey)}"
                        title="${escapeHtml(getSortHeaderTitle(listState.sortDir))}"
                        aria-label="${escapeHtml(getSortHeaderTitle(listState.sortDir))}"
                    >${getSortHeaderIndicator(listState.sortDir)}</button>
                </th>`;
            }
            return `<th>${label}</th>`;
        }).join('');
    }

    function updateVueLCSortHeader(shell, elementKey, sortDir) {
        const sortBtn = shell.querySelector(`[data-ugap-lc-sort="${elementKey}"]`);
        if (!sortBtn) return;
        sortBtn.textContent = getSortHeaderIndicator(sortDir);
        sortBtn.title = getSortHeaderTitle(sortDir);
        sortBtn.setAttribute('aria-label', getSortHeaderTitle(sortDir));
        sortBtn.classList.toggle('is-desc', sortDir === 'desc');
    }

    function bindLcRows(shell, elementKey, config) {
        if (typeof config?.rowDblClickHandler !== 'function') return;
        shell.querySelectorAll(`[data-ugap-lc-element="${elementKey}"][data-ugap-lc-row-index]`).forEach((tr) => {
            if (tr.dataset.ugapLcRowBound === '1') return;
            tr.dataset.ugapLcRowBound = '1';
            tr.addEventListener('dblclick', () => {
                const idx = parseInt(tr.getAttribute('data-ugap-lc-row-index'), 10);
                if (!Number.isNaN(idx)) config.rowDblClickHandler(idx);
            });
        });
    }

    const UgapTemplates = {
        TAB_LABELS,
        TUTORIAL_CONTENT,
        LC_CREATE_BUTTON_LABELS,
        resolveLcCreateButtonLabel,

        getTutorialContent(tabKey) {
            const key = String(tabKey || '').trim();
            return TUTORIAL_CONTENT[key] || `tuto pour l'onglet ${TAB_LABELS[key] || key}`;
        },

        renderTutorialShell(options) {
            const tabKey = String(options.tabKey || '').trim();
            const tabLabel = options.tabLabel || TAB_LABELS[tabKey] || tabKey;
            const contentHtml = options.contentHtml || '';
            const tutorialText = options.tutorialHtml || this.getTutorialContent(tabKey);

            return `
                <div class="ugap-tutorial-shell" data-ugap-tab="${escapeHtml(tabKey)}">
                    <div class="ugap-tutorial-shell__body">
                        ${contentHtml}
                    </div>
                    <button
                        type="button"
                        class="ugap-tutorial-fab"
                        data-ugap-tutorial-fab="${escapeHtml(tabKey)}"
                        aria-label="Aide — ${escapeHtml(tabLabel)}"
                        title="Aide — ${escapeHtml(tabLabel)}"
                    >?</button>
                    <div
                        class="ugap-tutorial-panel"
                        data-ugap-tutorial-panel="${escapeHtml(tabKey)}"
                        hidden
                        role="dialog"
                        aria-label="Tutoriel ${escapeHtml(tabLabel)}"
                    >
                        <h4 class="ugap-tutorial-panel__title">Tutoriel — ${escapeHtml(tabLabel)}</h4>
                        <p class="ugap-tutorial-panel__body">${escapeHtml(tutorialText)}</p>
                    </div>
                </div>
            `;
        },

        bindTutorialFab(root) {
            const scope = root && root.querySelector ? root : doc;
            scope.querySelectorAll('[data-ugap-tutorial-fab]').forEach((fab) => {
                if (fab.dataset.ugapTutorialBound) return;
                fab.dataset.ugapTutorialBound = '1';
                const tabKey = fab.getAttribute('data-ugap-tutorial-fab');
                const panel = scope.querySelector(`[data-ugap-tutorial-panel="${tabKey}"]`);
                if (!panel) return;
                fab.addEventListener('click', (event) => {
                    event.stopPropagation();
                    const willOpen = panel.hasAttribute('hidden');
                    scope.querySelectorAll('.ugap-tutorial-panel').forEach((p) => p.setAttribute('hidden', ''));
                    if (willOpen) panel.removeAttribute('hidden');
                    if (typeof global.notifyEmbedResize === 'function') {
                        global.notifyEmbedResize();
                    }
                });
            });
            if (!doc.body.dataset.ugapTutorialDocBound) {
                doc.body.dataset.ugapTutorialDocBound = '1';
                doc.addEventListener('click', (event) => {
                    if (event.target.closest('[data-ugap-tutorial-fab], .ugap-tutorial-panel')) return;
                    doc.querySelectorAll('.ugap-tutorial-panel').forEach((p) => p.setAttribute('hidden', ''));
                });
            }
        },

        initTutorialShells() {
            Object.keys(TAB_LABELS).forEach((tabKey) => {
                // Import : workflow interactif (boutons étapes) — ne pas remplacer le DOM (casse les listeners).
                if (tabKey === 'import') return;
                const panel = doc.getElementById(`tab-${tabKey}`);
                if (!panel || panel.dataset.ugapTutorialWrapped === '1') return;
                panel.dataset.ugapTutorialWrapped = '1';
                panel.innerHTML = this.renderTutorialShell({
                    tabKey,
                    tabLabel: TAB_LABELS[tabKey],
                    contentHtml: panel.innerHTML
                });
            });
            this.bindTutorialFab(doc);
        },

        renderVueLC(config) {
            const elementKey = String(config.elementKey || 'element').trim();
            const elementLabel = String(config.elementLabel || elementKey).trim();
            const title = config.title || (elementLabel.charAt(0).toUpperCase() + elementLabel.slice(1) + 's');
            const description = config.description || '';
            const columns = Array.isArray(config.columns) ? config.columns : [];
            const allRows = typeof config.getRows === 'function'
                ? config.getRows()
                : (Array.isArray(config.rows) ? config.rows : []);
            const emptyMessage = config.emptyMessage || `Aucun ${elementLabel} pour le moment.`;
            const listToolbar = config.listToolbar && typeof config.listToolbar === 'object' ? config.listToolbar : null;
            const listState = listToolbar ? getLcListState(elementKey) : null;
            let displayRows = allRows;
            if (listToolbar && listState) {
                displayRows = filterLcRows(allRows, listState.search, listToolbar.searchKeys);
                displayRows = sortLcRows(displayRows, listToolbar.sortKey, listState.sortDir);
            }
            const createFormHtml = config.createFormHtml || '';
            const createLabel = resolveLcCreateButtonLabel(config);

            const headHtml = listToolbar && listState
                ? renderVueLCHeaderHtml(columns, elementKey, listToolbar, listState)
                : columns.map((col) => `<th>${escapeHtml(col.label || col.key || '')}</th>`).join('');

            const bodyHtml = buildVueLCTableBodyHtml(displayRows, columns, config, elementKey);

            const toolbarHtml = listToolbar ? `
                    <div class="ugap-vue-lc__toolbar" data-ugap-lc-toolbar="${escapeHtml(elementKey)}">
                        <label class="ugap-vue-lc__search">
                            <span class="ugap-vue-lc__search-label">Recherche</span>
                            <input
                                type="search"
                                class="ugap-vue-lc__search-input"
                                data-ugap-lc-search="${escapeHtml(elementKey)}"
                                placeholder="${escapeHtml(listToolbar.searchPlaceholder || 'Rechercher…')}"
                                value="${escapeHtml(listState.search || '')}"
                                autocomplete="off"
                            >
                        </label>
                        <span class="ugap-vue-lc__count" data-ugap-lc-count="${escapeHtml(elementKey)}"></span>
                    </div>
            ` : '';

            return `
                <div class="ugap-vue-lc" data-ugap-vue-lc="${escapeHtml(elementKey)}">
                    <div class="ugap-vue-lc__header">
                        <div>
                            <h3 class="ugap-vue-lc__title">${escapeHtml(title)}</h3>
                            ${description ? `<p class="ugap-vue-lc__desc">${escapeHtml(description)}</p>` : ''}
                        </div>
                        <button
                            type="button"
                            class="btn btn-primary"
                            data-ugap-lc-create="${escapeHtml(elementKey)}"
                            aria-expanded="false"
                        >${escapeHtml(createLabel)}</button>
                    </div>
                    <div
                        class="ugap-vue-lc__create-panel"
                        data-ugap-lc-create-panel="${escapeHtml(elementKey)}"
                        hidden
                    >
                        ${createFormHtml}
                    </div>
                    <div class="ugap-vue-lc__list-header">Liste</div>
                    ${toolbarHtml}
                    <div class="ugap-vue-lc__table-wrap">
                        <table class="ugap-vue-lc__table">
                            <thead><tr>${headHtml}</tr></thead>
                            <tbody>${bodyHtml}</tbody>
                        </table>
                    </div>
                </div>
            `;
        },

        refreshVueLCList(elementKey, root) {
            const key = String(elementKey || '').trim();
            const config = (global.__ugapLcConfigs || {})[key];
            if (!config) return;
            const scope = root && root.querySelector ? root : doc;
            const shell = scope.querySelector(`[data-ugap-vue-lc="${key}"]`);
            if (!shell) return;

            const columns = Array.isArray(config.columns) ? config.columns : [];
            const allRows = typeof config.getRows === 'function'
                ? config.getRows()
                : (Array.isArray(config.rows) ? config.rows : []);
            const listToolbar = config.listToolbar && typeof config.listToolbar === 'object' ? config.listToolbar : null;
            const state = listToolbar ? getLcListState(key) : null;
            let displayRows = allRows;
            if (listToolbar && state) {
                displayRows = filterLcRows(allRows, state.search, listToolbar.searchKeys);
                displayRows = sortLcRows(displayRows, listToolbar.sortKey, state.sortDir);
            }

            const tbody = shell.querySelector('.ugap-vue-lc__table tbody');
            if (tbody) {
                tbody.innerHTML = buildVueLCTableBodyHtml(displayRows, columns, config, key);
            }
            updateVueLCCount(shell, key, displayRows.length, allRows.length, config.countLabel);
            if (listToolbar && state) {
                updateVueLCSortHeader(shell, key, state.sortDir);
            }
            bindLcRows(shell, key, config);
            if (typeof global.notifyEmbedResize === 'function') {
                global.notifyEmbedResize();
            }
        },

        bindVueLC(root, config) {
            const scope = root && root.querySelector ? root : doc;
            const elementKey = String(config?.elementKey || '').trim();
            if (!elementKey) return;

            global.__ugapLcConfigs = global.__ugapLcConfigs || {};
            global.__ugapLcConfigs[elementKey] = config;

            const shell = scope.querySelector(`[data-ugap-vue-lc="${elementKey}"]`) || scope;
            const createBtn = shell.querySelector(`[data-ugap-lc-create="${elementKey}"]`);
            const createPanel = shell.querySelector(`[data-ugap-lc-create-panel="${elementKey}"]`);

            if (createBtn && createPanel && !createBtn.dataset.ugapLcBound) {
                createBtn.dataset.ugapLcBound = '1';
                createBtn.addEventListener('click', () => {
                    const isHidden = createPanel.hasAttribute('hidden');
                    if (isHidden) {
                        createPanel.removeAttribute('hidden');
                        createBtn.setAttribute('aria-expanded', 'true');
                        if (typeof config.onCreatePanelOpen === 'function') {
                            config.onCreatePanelOpen();
                        }
                    } else {
                        createPanel.setAttribute('hidden', '');
                        createBtn.setAttribute('aria-expanded', 'false');
                    }
                    if (typeof global.notifyEmbedResize === 'function') {
                        global.notifyEmbedResize();
                    }
                });
            }

            if (config.listToolbar) {
                const searchInput = shell.querySelector(`[data-ugap-lc-search="${elementKey}"]`);
                const sortBtn = shell.querySelector(`[data-ugap-lc-sort="${elementKey}"]`);
                if (searchInput && !searchInput.dataset.ugapLcToolbarBound) {
                    searchInput.dataset.ugapLcToolbarBound = '1';
                    let debounceTimer = null;
                    searchInput.addEventListener('input', () => {
                        if (debounceTimer) clearTimeout(debounceTimer);
                        debounceTimer = setTimeout(() => {
                            getLcListState(elementKey).search = searchInput.value;
                            UgapTemplates.refreshVueLCList(elementKey, scope);
                        }, 150);
                    });
                }
                if (sortBtn && !sortBtn.dataset.ugapLcToolbarBound) {
                    sortBtn.dataset.ugapLcToolbarBound = '1';
                    sortBtn.addEventListener('click', () => {
                        const state = getLcListState(elementKey);
                        state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc';
                        updateVueLCSortHeader(shell, elementKey, state.sortDir);
                        UgapTemplates.refreshVueLCList(elementKey, scope);
                    });
                }
                UgapTemplates.refreshVueLCList(elementKey, scope);
            } else {
                bindLcRows(shell, elementKey, config);
            }
        }
    };

    global.UgapTemplates = UgapTemplates;
})(typeof window !== 'undefined' ? window : globalThis);
