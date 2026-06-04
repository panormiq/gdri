/**
 * FICHIER : modules/ugap/frontend/parametrage/assets/js/catalogue/catalogue-option-link-modal.js
 * RÔLE : Modal — propositions heuristiques + validation affectation catalogObjectId.
 *
 * ENTRÉES : objet catalogue, options import (State), heuristique
 * SORTIES : updateOptionFields via UgapCatalogueLcState
 *
 * DÉPEND DE : catalogue-option-link-heuristic.js, catalogue-lc-state.js
 * NE PAS : logique de score (déléguée à l’heuristique)
 *
 * APPELÉ PAR : catalogue-tab.js
 */
(function initUgapCatalogueOptionLinkModal(global) {
    'use strict';

    const MODAL_ID = 'ugap-catalogue-link-suggest-modal';
    const Heur = () => global.UgapCatalogueOptionLinkHeuristic;
    const State = () => global.UgapCatalogueLcState;

    function esc(value) {
        if (typeof global.escapeHtml === 'function') return global.escapeHtml(value);
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    let activeContext = null;

    function bindHideElsewhereControl() {
        const hideCb = global.document.getElementById('ugap-catalogue-link-hide-elsewhere');
        if (!hideCb || hideCb.dataset.bound === '1') return;
        hideCb.dataset.bound = '1';
        hideCb.addEventListener('change', () => {
            renderList();
            syncSelectAllCheckbox();
        });
    }

    function patchModalHideElsewhereCheckbox(modal) {
        if (!modal || modal.querySelector('#ugap-catalogue-link-hide-elsewhere')) return;
        const toolbar = modal.querySelector('.ugap-catalogue-link-modal__toolbar');
        const selectAllLabel = toolbar?.querySelector('label.ugap-catalogue-link-modal__select-all');
        if (!toolbar || !selectAllLabel) return;
        const label = global.document.createElement('label');
        label.className = 'ugap-catalogue-link-modal__select-all';
        label.innerHTML = `
            <input type="checkbox" id="ugap-catalogue-link-hide-elsewhere" checked>
            Masquer déjà affectées ailleurs`;
        toolbar.insertBefore(label, selectAllLabel);
        bindHideElsewhereControl();
    }

    function ensureModal() {
        let modal = global.document.getElementById(MODAL_ID);
        if (modal) {
            patchModalHideElsewhereCheckbox(modal);
            return modal;
        }

        const wrap = global.document.createElement('div');
        wrap.innerHTML = `
            <div id="${MODAL_ID}" class="ugap-catalogue-link-modal" hidden role="dialog" aria-modal="true"
                aria-labelledby="ugap-catalogue-link-modal-title">
                <div class="ugap-catalogue-link-modal__backdrop" data-catalogue-link-close></div>
                <div class="ugap-catalogue-link-modal__panel card">
                    <header class="ugap-catalogue-link-modal__head">
                        <h3 id="ugap-catalogue-link-modal-title">Lier des options</h3>
                        <button type="button" class="btn btn-outline btn-sm" data-catalogue-link-close aria-label="Fermer">×</button>
                    </header>
                    <p class="ugap-catalogue-link-modal__hint" id="ugap-catalogue-link-modal-hint"></p>
                    <div class="ugap-catalogue-link-modal__toolbar">
                        <input type="search" id="ugap-catalogue-link-modal-filter" class="ugap-catalogue-link-modal__search"
                            placeholder="Filtrer les propositions…" autocomplete="off">
                        <label class="ugap-catalogue-link-modal__select-all">
                            <input type="checkbox" id="ugap-catalogue-link-hide-elsewhere" checked>
                            Masquer déjà affectées ailleurs
                        </label>
                        <label class="ugap-catalogue-link-modal__select-all">
                            <input type="checkbox" id="ugap-catalogue-link-select-all" checked>
                            Tout sélectionner
                        </label>
                    </div>
                    <div id="ugap-catalogue-link-modal-list" class="ugap-catalogue-link-modal__list"></div>
                    <footer class="ugap-catalogue-link-modal__foot">
                        <button type="button" class="btn btn-outline" data-catalogue-link-close>Annuler</button>
                        <button type="button" class="btn btn-primary" id="ugap-catalogue-link-confirm">Valider la sélection</button>
                    </footer>
                </div>
            </div>`;
        modal = wrap.firstElementChild;
        global.document.body.appendChild(modal);

        modal.querySelectorAll('[data-catalogue-link-close]').forEach((el) => {
            el.addEventListener('click', close);
        });
        global.document.getElementById('ugap-catalogue-link-confirm')?.addEventListener('click', () => {
            void confirmSelection();
        });
        global.document.getElementById('ugap-catalogue-link-select-all')?.addEventListener('change', (ev) => {
            setAllVisibleChecked(!!ev.target.checked);
        });
        bindHideElsewhereControl();
        global.document.getElementById('ugap-catalogue-link-modal-filter')?.addEventListener('input', () => {
            renderList();
            syncSelectAllCheckbox();
        });

        return modal;
    }

    function close() {
        const modal = global.document.getElementById(MODAL_ID);
        if (modal) modal.hidden = true;
        activeContext = null;
    }

    function isHideLinkedElsewhere() {
        const cb = global.document.getElementById('ugap-catalogue-link-hide-elsewhere');
        return cb ? cb.checked : true;
    }

    function getBaseSuggestions() {
        const rows = Array.isArray(activeContext?.suggestions) ? activeContext.suggestions : [];
        if (!isHideLinkedElsewhere()) return rows;
        return rows.filter((row) => !row.linkedElsewhere);
    }

    function getFilteredSuggestions() {
        if (!activeContext) return [];
        const q = String(global.document.getElementById('ugap-catalogue-link-modal-filter')?.value || '')
            .trim()
            .toLowerCase();
        const rows = getBaseSuggestions();
        if (!q) return rows;
        return rows.filter((row) => {
            const opt = row.option || {};
            const hay = [opt.name, opt.details, opt.categoryName, row.score]
                .join(' ')
                .toLowerCase();
            return hay.includes(q);
        });
    }

    function setAllVisibleChecked(checked) {
        const list = global.document.getElementById('ugap-catalogue-link-modal-list');
        if (!list) return;
        list.querySelectorAll('input[type="checkbox"][data-link-opt-id]').forEach((cb) => {
            cb.checked = checked;
        });
    }

    function syncSelectAllCheckbox() {
        const selectAll = global.document.getElementById('ugap-catalogue-link-select-all');
        const list = global.document.getElementById('ugap-catalogue-link-modal-list');
        if (!selectAll || !list) return;
        const boxes = list.querySelectorAll('input[type="checkbox"][data-link-opt-id]');
        if (!boxes.length) {
            selectAll.checked = false;
            selectAll.indeterminate = false;
            selectAll.disabled = true;
            return;
        }
        selectAll.disabled = false;
        const checked = list.querySelectorAll('input[type="checkbox"][data-link-opt-id]:checked').length;
        selectAll.checked = checked === boxes.length;
        selectAll.indeterminate = checked > 0 && checked < boxes.length;
    }

    function renderList() {
        const listEl = global.document.getElementById('ugap-catalogue-link-modal-list');
        const hint = global.document.getElementById('ugap-catalogue-link-modal-hint');
        if (!listEl || !activeContext) return;

        const filtered = getFilteredSuggestions();
        const shown = filtered.length;
        const all = Array.isArray(activeContext.suggestions) ? activeContext.suggestions : [];
        const listed = getBaseSuggestions().length;
        const hiddenElsewhere = isHideLinkedElsewhere()
            ? all.filter((row) => row.linkedElsewhere).length
            : 0;
        const total = activeContext.totalMatches || all.length;
        const obj = activeContext.catalogObject || {};
        const kwCheck = Heur()?.validateObjectKeywords?.(obj);

        if (hint) {
            const rules = Heur()?.describeQueryRules?.(activeContext.query || kwCheck?.query || {}) || '';
            let msg = `${shown} affichée(s) sur ${listed} sélectionnable(s)`;
            if (hiddenElsewhere) {
                msg += ` · ${hiddenElsewhere} masquée(s) (déjà liées ailleurs)`;
            }
            if (activeContext.truncated && total > all.length) {
                msg += ` (${total} au total)`;
            }
            msg += `. ${rules}.`;
            hint.textContent = msg;
        }

        if (!filtered.length) {
            const emptyMsg = hiddenElsewhere && !listed
                ? 'Aucune proposition (toutes sont déjà liées ailleurs — décochez « Masquer » pour les voir).'
                : 'Aucune ligne pour ce filtre.';
            listEl.innerHTML = `<p class="ugap-catalogue-muted">${esc(emptyMsg)}</p>`;
            syncSelectAllCheckbox();
            return;
        }

        const autoCheck = filtered.length <= 8;
        listEl.innerHTML = filtered.map((row) => {
            const opt = row.option || {};
            const details = String(opt.details || '').trim();
            const detailsHtml = details
                ? `<span class="ugap-catalogue-link-modal__details">${esc(details)}</span>`
                : '<span class="ugap-catalogue-link-modal__details ugap-catalogue-muted">— pas de détails —</span>';
            const checked = autoCheck ? 'checked' : '';
            const reasons = Array.isArray(row.reasons) ? row.reasons : [];
            const reasonsHtml = reasons.length
                ? `<span class="ugap-catalogue-link-modal__match">${esc(reasons.join(' · '))}</span>`
                : '';
            return `
                <label class="ugap-catalogue-link-modal__row">
                    <input type="checkbox" data-link-opt-id="${esc(opt.id)}" ${checked}>
                    <span class="ugap-catalogue-link-modal__row-body">
                        <strong>${esc(opt.name || opt.id)}</strong>
                        ${detailsHtml}
                        ${reasonsHtml}
                        <span class="ugap-catalogue-link-modal__meta">
                            ${esc(opt.categoryName || '—')} · score ${row.score}
                            ${row.linkedElsewhere && !isHideLinkedElsewhere()
                                ? ' · <em class="ugap-catalogue-muted">déjà liée ailleurs</em>' : ''}
                        </span>
                    </span>
                </label>`;
        }).join('');
        syncSelectAllCheckbox();
    }

    function getSelectedOptionIds() {
        const list = global.document.getElementById('ugap-catalogue-link-modal-list');
        if (!list) return [];
        return Array.from(list.querySelectorAll('input[type="checkbox"][data-link-opt-id]:checked'))
            .map((el) => String(el.getAttribute('data-link-opt-id') || '').trim())
            .filter(Boolean);
    }

    async function confirmSelection() {
        const ctx = activeContext;
        if (!ctx?.catalogObject?.id) return;
        const ids = getSelectedOptionIds();
        if (!ids.length) {
            global.showAlert?.('Sélectionnez au moins une option à lier.', 'warning');
            return;
        }
        const btn = global.document.getElementById('ugap-catalogue-link-confirm');
        if (btn) btn.disabled = true;
        try {
            const objectId = String(ctx.catalogObject.id).trim();
            const assignments = ids.map((id) => ({ optionId: id, catalogObjectId: objectId }));
            if (State()?.updateOptionFieldsBulk) {
                await State().updateOptionFieldsBulk(assignments);
            } else {
                for (const id of ids) {
                    await State().updateOptionFields(id, { catalogObjectId: objectId });
                }
            }
            global.showAlert?.(`${ids.length} option(s) liée(s) à « ${ctx.catalogObject.label || objectId} ».`, 'success');
            if (typeof ctx.onApplied === 'function') await ctx.onApplied();
            close();
        } catch (err) {
            global.showAlert?.(err?.message || String(err), 'error');
        } finally {
            if (btn) btn.disabled = false;
        }
    }

    /**
     * @param {{ catalogObject: object, onApplied?: function }} context
     */
    async function open(context) {
        const H = Heur();
        const catalogObject = context?.catalogObject;
        if (!catalogObject?.id || !H?.suggestOptionsForObject) {
            global.showAlert?.('Heuristique catalogue indisponible.', 'error');
            return;
        }

        const kwCheck = H.validateObjectKeywords?.(catalogObject);
        if (kwCheck && !kwCheck.ok) {
            global.showAlert?.(kwCheck.message, 'warning');
            return;
        }

        try {
            await State()?.refreshOptionsFromServer?.();
        } catch (err) {
            console.warn('[UgapCatalogue] Rafraîchissement options avant liaison :', err);
        }

        const allOptions = State()?.getAllOptions?.() || [];
        const suggestions = H.suggestOptionsForObject(catalogObject, allOptions, {
            objectId: catalogObject.id,
        });

        if (!suggestions.length) {
            const rules = H.describeQueryRules?.(kwCheck.query) || '';
            const pool = (Array.isArray(allOptions) ? allOptions : [])
                .filter((o) => H.isEligibleImportOption?.(o));
            const objectId = String(catalogObject.id || '').trim();
            const unlinked = pool.filter((o) => !String(o?.catalogObjectId || '').trim());
            const probe = unlinked
                .map((o) => ({ option: o, hit: H.scoreOptionForCatalogObject?.(o, catalogObject) }))
                .filter((r) => r.hit?.score > 0);
            let hint = '';
            if (unlinked.length && !probe.length) {
                hint = ' Des options non assignées existent mais aucun mot-clé ne matche (essayez hors bord ou "hors-bord").';
            } else if (!unlinked.length && pool.length) {
                hint = ' Toutes les options éligibles sont déjà liées à un nœud — décochez « Masquer déjà affectées » si besoin.';
            }
            global.showAlert?.(
                `Aucune proposition pour « ${catalogObject.label || objectId} » (${rules}). `
                + `${pool.length} option(s) analysée(s), ${unlinked.length} sans nœud.${hint}`,
                'info'
            );
            return;
        }

        activeContext = {
            catalogObject,
            suggestions,
            query: suggestions.query || kwCheck.query,
            totalMatches: suggestions.totalMatches || suggestions.length,
            truncated: !!suggestions.truncated,
            onApplied: context.onApplied,
        };

        const modal = ensureModal();
        const title = global.document.getElementById('ugap-catalogue-link-modal-title');
        if (title) {
            title.textContent = `Lier des options — ${catalogObject.label || catalogObject.id}`;
        }
        const filter = global.document.getElementById('ugap-catalogue-link-modal-filter');
        if (filter) filter.value = '';
        const hideElsewhere = global.document.getElementById('ugap-catalogue-link-hide-elsewhere');
        if (hideElsewhere) hideElsewhere.checked = true;

        renderList();
        modal.hidden = false;
        if (suggestions.truncated) {
            global.showAlert?.(
                `${suggestions.totalMatches || suggestions.length} option(s) correspondent — affichage tronqué.`,
                'warning'
            );
        }
        filter?.focus();
    }

    const api = { open, close };
    global.UgapCatalogueLinkModal = api;
    global.UgapCatalogueOptionLinkModal = api;
})(window);
