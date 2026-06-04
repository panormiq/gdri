/**
 * FICHIER : modules/ugap/frontend/assets/js/shared/ugap-catalog-option-picker.js
 * RÔLE : Modal centré — sélection d’options catalogue + affectation multi-groupes.
 *
 * ENTRÉES : liste options, groupes cibles (famille + groupId)
 * SORTIES : onConfirm({ optionIds, groupRefs })
 *
 * DÉPEND DE : ugap-option-line-kind.js (optionnel)
 * NE PAS : persistance API directe
 *
 * APPELÉ PAR : categorie-tab.js
 */
(function initUgapCatalogOptionPicker(global) {
    'use strict';

    const MODAL_ID = 'ugap-catalog-option-picker-modal';

    function esc(value) {
        if (typeof global.escapeHtml === 'function') return global.escapeHtml(value);
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function normalizeText(value) {
        return String(value || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase();
    }

    function isCatalogOptionRow(opt) {
        if (!opt || typeof opt !== 'object') return false;
        const name = String(opt?.name || '').trim();
        if (opt?.isSparePart === true) return false;
        if (/^PR\s/i.test(name)) return false;
        const OLK = global.UgapOptionLineKind;
        const kind = OLK?.inferOptionLineKind ? OLK.inferOptionLineKind(opt) : 'option';
        if (kind === 'minoration' || kind === 'majoration' || kind === 'pr') return false;
        if (opt?.importGeneratedFromBaseProduct === true || opt?.importBaseProductId) return false;
        const id = String(opt?.id || '').trim();
        if (id.startsWith('opt_ibp_')) return false;
        if (String(opt.refUgap || '').trim().toUpperCase().startsWith('IBP-')) return false;
        if (opt?.isBaseOption === true || opt?.baseIncluded === true || opt?.manualBaseOption === true) {
            return false;
        }
        return true;
    }

    function collectCatalogOptionsFromData(data, linksByOptionId) {
        const categories = Array.isArray(data?.categories) ? data.categories : [];
        const links = linksByOptionId instanceof Map ? linksByOptionId : new Map();
        const rows = [];
        categories.forEach((cat) => {
            const categoryName = String(cat?.name || '').trim();
            (Array.isArray(cat?.options) ? cat.options : []).forEach((opt) => {
                if (!isCatalogOptionRow(opt)) return;
                const id = String(opt?.id || '').trim();
                if (!id) return;
                const link = links.get(id);
                rows.push({
                    id,
                    name: String(opt?.name || opt?.importOptionLabel || id).trim(),
                    details: String(opt?.details || '').trim(),
                    familyLabel: String(link?.familyLabel || opt?.familyLabel || '').trim(),
                    categoryName,
                });
            });
        });
        rows.sort((a, b) => {
            const fa = String(a.familyLabel || '');
            const fb = String(b.familyLabel || '');
            if (fa !== fb) return fa.localeCompare(fb, 'fr');
            return String(a.name || '').localeCompare(String(b.name || ''), 'fr');
        });
        return rows;
    }

    function buildLinksByOptionId(families) {
        const map = new Map();
        const FCmp = global.UgapFamilyComponents;

        (Array.isArray(families) ? families : []).forEach((family) => {
            const familyLabel = String(family?.familyLabel || '').trim();
            (Array.isArray(family?.optionIds) ? family.optionIds : []).forEach((idRaw) => {
                const id = String(idRaw || '').trim();
                if (!id) return;
                if (!map.has(id)) map.set(id, { familyLabel: '', groupIds: new Set() });
                if (familyLabel) map.get(id).familyLabel = familyLabel;
            });
            const groups = FCmp?.flattenDecisionGroups
                ? FCmp.flattenDecisionGroups(family)
                : (Array.isArray(family?.decisionGroups) ? family.decisionGroups : []);
            groups.forEach((group) => {
                const gid = String(group?.groupId || group?.id || '').trim();
                const glabel = String(group?.label || gid || '').trim();
                (Array.isArray(group?.optionIds) ? group.optionIds : []).forEach((idRaw) => {
                    const id = String(idRaw || '').trim();
                    if (!id) return;
                    if (!map.has(id)) {
                        map.set(id, { familyLabel: familyLabel || '', groupIds: new Set(), groupLabels: new Set() });
                    }
                    const row = map.get(id);
                    if (familyLabel && !row.familyLabel) row.familyLabel = familyLabel;
                    if (gid) row.groupIds.add(gid);
                    if (glabel) row.groupLabels.add(glabel);
                });
            });
        });
        return map;
    }

    function uniquePush(list, value) {
        const id = String(value || '').trim();
        if (!id) return list;
        const arr = Array.isArray(list) ? list.slice() : [];
        if (!arr.includes(id)) arr.push(id);
        return arr;
    }

    function findFamilyInList(families, familyLabel) {
        const key = String(familyLabel || '').trim().toLowerCase();
        return (Array.isArray(families) ? families : []).find(
            (f) => String(f?.familyLabel || '').trim().toLowerCase() === key
        ) || null;
    }

    /** Ajoute des options à plusieurs groupes (sans retirer des autres familles). */
    function addOptionsToGroups(families, optionIds, groupRefs) {
        const FCmp = global.UgapFamilyComponents;
        const ids = (Array.isArray(optionIds) ? optionIds : [])
            .map((x) => String(x || '').trim())
            .filter(Boolean);
        const refs = (Array.isArray(groupRefs) ? groupRefs : [])
            .map((r) => ({
                familyLabel: String(r?.familyLabel || '').trim(),
                componentId: String(r?.componentId || '').trim(),
                groupId: String(r?.groupId || '').trim(),
            }))
            .filter((r) => r.familyLabel && r.groupId);
        if (!ids.length || !refs.length) return Array.isArray(families) ? families.slice() : [];

        const next = (FCmp?.normalizeFamilyList
            ? FCmp.normalizeFamilyList(families)
            : (Array.isArray(families) ? families : [])).map((f) => {
            const row = FCmp?.ensureComponentsArray ? FCmp.ensureComponentsArray({ ...f }) : { ...f };
            row.optionIds = Array.isArray(row.optionIds) ? row.optionIds.slice() : [];
            row.components = (Array.isArray(row.components) ? row.components : []).map((comp) => ({
                ...comp,
                decisionGroups: (Array.isArray(comp.decisionGroups) ? comp.decisionGroups : []).map((g) => ({
                    ...g,
                    optionIds: Array.isArray(g?.optionIds) ? g.optionIds.slice() : [],
                })),
            }));
            return row;
        });

        refs.forEach((ref) => {
            const target = findFamilyInList(next, ref.familyLabel);
            if (!target) return;
            target.optionIds = Array.isArray(target.optionIds) ? target.optionIds : [];
            ids.forEach((id) => {
                target.optionIds = uniquePush(target.optionIds, id);
            });
            const hit = FCmp?.findGroupInFamily
                ? FCmp.findGroupInFamily(target, ref.componentId, ref.groupId)
                : null;
            if (hit?.group) {
                hit.group.optionIds = Array.isArray(hit.group.optionIds) ? hit.group.optionIds : [];
                ids.forEach((id) => {
                    hit.group.optionIds = uniquePush(hit.group.optionIds, id);
                });
                return;
            }
            (Array.isArray(target.components) ? target.components : []).forEach((comp) => {
                const compId = String(comp?.id || '').trim();
                if (ref.componentId && compId && compId !== ref.componentId) return;
                (Array.isArray(comp.decisionGroups) ? comp.decisionGroups : []).forEach((group) => {
                    const gid = String(group?.id || '').trim();
                    if (gid !== ref.groupId) return;
                    group.optionIds = Array.isArray(group.optionIds) ? group.optionIds : [];
                    ids.forEach((id) => {
                        group.optionIds = uniquePush(group.optionIds, id);
                    });
                });
            });
        });

        return next;
    }

    function ensureModal() {
        let modal = global.document.getElementById(MODAL_ID);
        if (modal) return modal;

        const wrap = global.document.createElement('div');
        wrap.innerHTML = `
            <div id="${MODAL_ID}" class="ugap-catalog-opt-modal" hidden role="dialog" aria-modal="true" aria-labelledby="ugap-catalog-opt-modal-title">
                <div class="ugap-catalog-opt-modal__backdrop" data-ugap-catalog-opt-close></div>
                <div class="ugap-catalog-opt-modal__panel">
                    <header class="ugap-catalog-opt-modal__head">
                        <h3 id="ugap-catalog-opt-modal-title">Options catalogue</h3>
                        <button type="button" class="ugap-catalog-opt-modal__close" data-ugap-catalog-opt-close aria-label="Fermer">×</button>
                    </header>
                    <div class="ugap-catalog-opt-modal__filters">
                        <input type="search" id="ugap-catalog-opt-search" class="ugap-catalog-opt-modal__search"
                            placeholder="Rechercher par nom, détails ou famille…" autocomplete="off">
                        <select id="ugap-catalog-opt-family-filter" class="ugap-catalog-opt-modal__family-filter">
                            <option value="">Toutes les familles</option>
                        </select>
                    </div>
                    <p class="ugap-catalog-opt-modal__hint" id="ugap-catalog-opt-options-hint"></p>
                    <div class="ugap-catalog-opt-modal__lists">
                        <section class="ugap-catalog-opt-modal__section">
                            <h4>Options</h4>
                            <div id="ugap-catalog-opt-options-list" class="ugap-catalog-opt-modal__scroll"></div>
                        </section>
                        <section class="ugap-catalog-opt-modal__section">
                            <h4>Groupes cibles</h4>
                            <div id="ugap-catalog-opt-groups-list" class="ugap-catalog-opt-modal__scroll ugap-catalog-opt-modal__scroll--compact"></div>
                        </section>
                    </div>
                    <footer class="ugap-catalog-opt-modal__foot">
                        <button type="button" class="btn btn-outline" data-ugap-catalog-opt-close>Annuler</button>
                        <button type="button" class="btn btn-success" id="ugap-catalog-opt-confirm">Ajouter la sélection</button>
                    </footer>
                </div>
            </div>
        `;
        modal = wrap.firstElementChild;
        global.document.body.appendChild(modal);
        modal.querySelectorAll('[data-ugap-catalog-opt-close]').forEach((el) => {
            el.addEventListener('click', close);
        });
        global.document.getElementById('ugap-catalog-opt-confirm')?.addEventListener('click', () => {
            void confirmCurrent();
        });
        return modal;
    }

    let activeContext = null;
    let filteredOptions = [];

    function close() {
        const modal = global.document.getElementById(MODAL_ID);
        if (modal) modal.setAttribute('hidden', '');
        activeContext = null;
        filteredOptions = [];
    }

    function getSelectedOptionIds() {
        const list = global.document.getElementById('ugap-catalog-opt-options-list');
        if (!list) return [];
        return Array.from(list.querySelectorAll('input[type="checkbox"][data-opt-id]:checked'))
            .map((el) => String(el.getAttribute('data-opt-id') || '').trim())
            .filter(Boolean);
    }

    function getSelectedGroupRefs() {
        const list = global.document.getElementById('ugap-catalog-opt-groups-list');
        if (!list) return [];
        return Array.from(list.querySelectorAll('input[type="checkbox"][data-group-ref]:checked'))
            .map((el) => {
                try {
                    return JSON.parse(el.getAttribute('data-group-ref') || '{}');
                } catch (_) {
                    return null;
                }
            })
            .filter((r) => r && r.familyLabel && r.groupId);
    }

    function renderOptionsList() {
        const listEl = global.document.getElementById('ugap-catalog-opt-options-list');
        const hint = global.document.getElementById('ugap-catalog-opt-options-hint');
        if (!listEl || !activeContext) return;

        const query = normalizeText(global.document.getElementById('ugap-catalog-opt-search')?.value || '');
        const familyFilter = String(global.document.getElementById('ugap-catalog-opt-family-filter')?.value || '')
            .trim()
            .toLowerCase();

        filteredOptions = (activeContext.options || []).filter((row) => {
            const hay = normalizeText([row.name, row.details, row.familyLabel, row.categoryName].join(' '));
            if (query && !hay.includes(query)) return false;
            if (familyFilter && String(row.familyLabel || '').trim().toLowerCase() !== familyFilter) {
                return false;
            }
            return true;
        });

        if (hint) {
            hint.textContent = `${filteredOptions.length} option(s) affichée(s) sur ${(activeContext.options || []).length}`;
        }

        if (!filteredOptions.length) {
            listEl.innerHTML = '<p class="ugap-catalog-opt-modal__empty">Aucune option pour ce filtre.</p>';
            return;
        }

        listEl.innerHTML = filteredOptions.map((row) => {
            const details = String(row.details || '').trim();
            const detailsHtml = details
                ? `<span class="ugap-catalog-opt-modal__row-details" onclick="event.stopPropagation()">${esc(details)}</span>`
                : '';
            return `
            <label class="ugap-catalog-opt-modal__row">
                <input type="checkbox" data-opt-id="${esc(row.id)}">
                <span class="ugap-catalog-opt-modal__row-main">
                    <strong>${esc(row.name || row.id)}</strong>
                    ${detailsHtml}
                    <span class="ugap-catalog-opt-modal__row-meta">
                        ${row.familyLabel ? esc(row.familyLabel) : '— sans famille —'}
                        ${row.categoryName ? ` · ${esc(row.categoryName)}` : ''}
                    </span>
                </span>
            </label>`;
        }).join('');
    }

    function renderGroupsList() {
        const listEl = global.document.getElementById('ugap-catalog-opt-groups-list');
        if (!listEl || !activeContext) return;
        const groups = Array.isArray(activeContext.targetGroups) ? activeContext.targetGroups : [];
        if (!groups.length) {
            listEl.innerHTML = '<p class="ugap-catalog-opt-modal__empty">Aucun groupe — cochez des groupes dans les familles rattachées.</p>';
            return;
        }
        listEl.innerHTML = groups.map((g) => {
            const ref = JSON.stringify({ familyLabel: g.familyLabel, groupId: g.groupId });
            const checked = g.defaultChecked ? 'checked' : '';
            return `
                <label class="ugap-catalog-opt-modal__row">
                    <input type="checkbox" data-group-ref="${esc(ref)}" ${checked}>
                    <span class="ugap-catalog-opt-modal__row-main">
                        <strong>${esc(g.groupLabel || g.groupId)}</strong>
                        <span class="ugap-catalog-opt-modal__row-meta">${esc(g.familyLabel)}</span>
                    </span>
                </label>
            `;
        }).join('');
    }

    function fillFamilyFilter() {
        const select = global.document.getElementById('ugap-catalog-opt-family-filter');
        if (!select || !activeContext) return;
        const labels = new Set();
        (activeContext.options || []).forEach((row) => {
            const l = String(row.familyLabel || '').trim();
            if (l) labels.add(l);
        });
        const sorted = Array.from(labels).sort((a, b) => a.localeCompare(b, 'fr'));
        const cur = select.value;
        select.innerHTML = `<option value="">Toutes les familles</option>${sorted.map(
            (l) => `<option value="${esc(l)}">${esc(l)}</option>`
        ).join('')}`;
        if (cur && sorted.includes(cur)) select.value = cur;
    }

    async function confirmCurrent() {
        const ctx = activeContext;
        if (!ctx) return;
        const optionIds = getSelectedOptionIds();
        const groupRefs = getSelectedGroupRefs();
        if (!optionIds.length) {
            global.showAlert?.('Sélectionnez au moins une option.', 'warning');
            return;
        }
        if (!groupRefs.length) {
            global.showAlert?.('Sélectionnez au moins un groupe cible.', 'warning');
            return;
        }
        const confirmBtn = global.document.getElementById('ugap-catalog-opt-confirm');
        if (confirmBtn) confirmBtn.disabled = true;
        try {
            await ctx.onConfirm({ optionIds, groupRefs });
            close();
        } catch (err) {
            global.showAlert?.(err?.message || String(err), 'error');
        } finally {
            if (confirmBtn) confirmBtn.disabled = false;
        }
    }

    function open(context) {
        const ctx = context && typeof context === 'object' ? context : {};
        if (!Array.isArray(ctx.options) || !ctx.options.length) {
            global.showAlert?.('Aucune option catalogue disponible.', 'warning');
            return;
        }
        if (!Array.isArray(ctx.targetGroups) || !ctx.targetGroups.length) {
            global.showAlert?.('Ajoutez des familles avec au moins un groupe coché à cette catégorie.', 'warning');
            return;
        }
        if (typeof ctx.onConfirm !== 'function') {
            global.showAlert?.('Picker catalogue : handler manquant.', 'error');
            return;
        }

        activeContext = ctx;
        const modal = ensureModal();
        const title = global.document.getElementById('ugap-catalog-opt-modal-title');
        if (title) title.textContent = String(ctx.title || 'Ajouter des options catalogue');

        fillFamilyFilter();
        renderOptionsList();
        renderGroupsList();

        const search = global.document.getElementById('ugap-catalog-opt-search');
        if (search) {
            search.value = '';
            search.oninput = () => renderOptionsList();
            search.onkeydown = (e) => {
                if (e.key === 'Escape') close();
            };
        }
        const familyFilter = global.document.getElementById('ugap-catalog-opt-family-filter');
        if (familyFilter) {
            familyFilter.onchange = () => renderOptionsList();
        }

        modal.removeAttribute('hidden');
        search?.focus();
        if (typeof global.scheduleParentEmbedResize === 'function') global.scheduleParentEmbedResize();
    }

    global.UgapCatalogOptionPicker = {
        open,
        close,
        collectCatalogOptionsFromData,
        buildLinksByOptionId,
        addOptionsToGroups,
        isCatalogOptionRow,
    };
})(window);
