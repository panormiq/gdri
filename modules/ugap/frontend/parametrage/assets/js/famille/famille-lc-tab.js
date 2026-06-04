/**
 * Vue LC Famille — paramétrage v2.
 */
(function initUgapFamilleLcTab(global) {
    'use strict';

    const MOUNT_ID = 'ugap-famille-lc-mount';

    function normalizeGroups(raw) {
        const FDG = global.UgapFamilyDecisionGroup;
        return FDG?.normalizeList ? FDG.normalizeList(raw) : (Array.isArray(raw) ? raw : []);
    }

    function groupsSummary(family) {
        const groups = global.UgapFamilleLcState?.getFamilyDisplayGroups
            ? global.UgapFamilleLcState.getFamilyDisplayGroups(family)
            : normalizeGroups(family?.decisionGroups);
        if (!groups.length) return '—';
        const defaultId = global.UgapFamilleLcState?.resolveDefaultDecisionGroupId(
            groups,
            family?.defaultDecisionGroupId
        );
        return groups.map((g) => {
            const kw = String(g.keywords || '').trim();
            const base = `${g.type}:${g.label || g.id}`;
            const def = defaultId && String(g.id) === String(defaultId) ? ' ★ défaut options' : '';
            const withKw = kw ? `${base} (${kw})` : base;
            return withKw + def;
        }).join(', ');
    }

    function getRows() {
        return (global.UgapFamilleLcState?.getFamilies() || []).map((f, idx) => ({
            __idx: idx,
            familyLabel: String(f.familyLabel || 'Famille').trim() || 'Famille',
            familyKeyword: String(f.familyKeyword || f.objectName || f.familyKeywords || '').trim() || '—',
            groupsSummary: groupsSummary(f),
            _actionsHtml: `
                <div style="display:flex;gap:6px;flex-wrap:wrap;">
                    <button type="button" class="btn btn-outline" style="font-size:12px;padding:4px 8px;" data-famille-edit="${idx}">Éditer</button>
                    <button type="button" class="btn btn-outline" style="font-size:12px;padding:4px 8px;" data-famille-delete="${idx}">Supprimer</button>
                </div>
            `,
        }));
    }

    function bindListActions(mount) {
        if (!mount || mount.dataset.familleListBound === '1') return;
        mount.dataset.familleListBound = '1';
        mount.addEventListener('click', (ev) => {
            const editBtn = ev.target.closest('[data-famille-edit]');
            if (editBtn) {
                ev.stopPropagation();
                const idx = Number(editBtn.getAttribute('data-famille-edit'));
                global.UgapFamilleLcForm?.openEditFamily?.(mount, idx);
                return;
            }
            const btn = ev.target.closest('[data-famille-delete]');
            if (!btn) return;
            ev.stopPropagation();
            const idx = Number(btn.getAttribute('data-famille-delete'));
            const list = global.UgapFamilleLcState.getFamilies();
            if (!Number.isInteger(idx) || idx < 0 || idx >= list.length) return;
            list.splice(idx, 1);
            global.UgapFamilleLcState.setFamilies(list);
            refresh();
            global.showAlert?.('Famille retirée de la liste.', 'info');
        });
    }

    async function mount() {
        const mountEl = global.document.getElementById(MOUNT_ID);
        if (!mountEl) return;

        global.UgapFamilleLcState?.syncGroupTypesCatalog();
        await global.UgapFamilleLcState?.loadFromServer?.();

        if (mountEl.querySelector('[data-ugap-vue-lc="famille"]')) {
            refresh();
            return;
        }

        if (!global.UgapTemplates?.renderVueLC) {
            mountEl.innerHTML = '<p class="ugap-famille-muted">Module d’affichage indisponible.</p>';
            return;
        }

        const Form = global.UgapFamilleLcForm;
        const config = {
            elementKey: 'famille',
            elementLabel: 'famille',
            title: 'Familles',
            description: 'Liste et création des familles. Le formulaire s’affiche après « Créer une famille ».',
            createButtonLabel: 'Créer une famille',
            columns: [
                { key: 'familyLabel', label: 'Famille' },
                { key: 'familyKeyword', label: 'Mot clé' },
                { key: 'groupsSummary', label: 'Groupes' },
                { key: '_actionsHtml', label: 'Actions', type: 'html' },
            ],
            getRows,
            listToolbar: {
                sortKey: 'familyLabel',
                searchKeys: ['familyLabel', 'familyKeyword', 'groupsSummary'],
                searchPlaceholder: 'Famille, mot clé, groupes…',
            },
            countLabel: 'famille(s)',
            emptyMessage: 'Aucune famille. Cliquez sur « Créer une famille » en haut à droite.',
            createFormHtml: Form?.renderCreateFormHtml?.() || '',
            createActionsBelowHtml: Form?.renderTypesManagerHtml?.() || '',
            onCreatePanelOpen: () => {
                Form?.onCreatePanelOpen?.(mountEl);
            },
        };

        mountEl.innerHTML = global.UgapTemplates.renderVueLC(config);
        global.UgapTemplates.bindVueLC(mountEl, config);
        Form?.bindCreateForm?.(mountEl);
        bindListActions(mountEl);

        refresh();
        if (typeof global.scheduleParentEmbedResize === 'function') {
            global.scheduleParentEmbedResize();
        }
    }

    function refresh() {
        const mountEl = global.document.getElementById(MOUNT_ID);
        if (mountEl && global.UgapTemplates?.refreshVueLCList) {
            global.UgapTemplates.refreshVueLCList('famille', mountEl);
        }
    }

    global.UgapFamilleLcTab = { mount, refresh };
    global.mountUgapFamilleLc = mount;
})(window);
