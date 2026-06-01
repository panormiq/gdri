/**
 * FICHIER : modules/ugap/frontend/assets/js/shared/ugap-family-draft-ui.js
 * RÔLE : Liste compacte familles + groupes ; ajout via bouton (menu au clic).
 *
 * ENTRÉES : registre par préfixe (vue-metier, categorie) — getDraft, getCatalogueFamilies
 * SORTIES : HTML panneau familles, rafraîchissement liste
 *
 * DÉPEND DE : admin.php (getFamiliesForAssignationTab, normalizeFamilyDecisionGroups), ugap-family-decision-group.js
 * NE PAS : persistance API, onglets Famille / Options ; pas de blocage des libellés en double
 *
 * APPELÉ PAR : admin.php (vue métier), categorie-tab.js
 */
(function initUgapFamilyDraftUi(global) {
    'use strict';

    const registry = {};

    function escapeHtml(value) {
        if (typeof global.escapeHtml === 'function') return global.escapeHtml(value);
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function groupTypeLabel(type) {
        const FDG = global.UgapFamilyDecisionGroup;
        const t = String(type || '').trim();
        if (FDG?.getTypeLabel) {
            const full = FDG.getTypeLabel(t);
            if (full && full.length <= 8) return full;
            if (t === 'model') return 'mod.';
            if (t === 'static') return 'stat.';
            if (t === 'garantie') return 'gar.';
            if (t === 'personnalise') return 'pers.';
            return 'opt.';
        }
        if (t === 'model') return 'mod.';
        if (t === 'static') return 'stat.';
        return 'opt.';
    }

    function groupPriceLabel(group) {
        const FDG = global.UgapFamilyDecisionGroup;
        const mode = group?.priceMode || group?.pricingMode || '';
        if (FDG?.getPriceModeLabel) {
            const full = FDG.getPriceModeLabel(mode);
            if (mode === 'minoration') return '−';
            if (mode === 'majoration') return '+';
            if (mode === 'static') return '€';
            if (mode === 'none') return '—';
            return full ? full.split(' ')[0].slice(0, 4) : '';
        }
        return '';
    }

    function getHandler(prefix) {
        return registry[String(prefix || '').trim()] || null;
    }

    function normalizeGroups(raw) {
        const fn = global.normalizeFamilyDecisionGroups;
        if (typeof fn === 'function') return fn(raw);
        return Array.isArray(raw) ? raw : [];
    }

    /** Libellé famille dans la liste (ex. « Garantie #2 » si doublon). */
    function formatFamilyDisplayLabel(entry, draftIdx, families) {
        const label = String(entry?.familyLabel || 'Famille').trim();
        const key = label.toLowerCase();
        const list = Array.isArray(families) ? families : [];
        const same = list.filter((f) => String(f?.familyLabel || '').trim().toLowerCase() === key);
        if (same.length <= 1) return label;
        let n = 0;
        for (let i = 0; i <= draftIdx && i < list.length; i += 1) {
            if (String(list[i]?.familyLabel || '').trim().toLowerCase() === key) n += 1;
        }
        return `${label} #${n}`;
    }

    /** Libellé groupe si plusieurs portent le même nom (ex. deux « Garantie »). */
    function formatGroupDisplayLabel(group, groupIndex, groups) {
        const label = String(group?.label || group?.id || '').trim() || 'Groupe';
        const key = label.toLowerCase();
        const list = Array.isArray(groups) ? groups : [];
        const same = list.filter((g) => String(g?.label || g?.id || '').trim().toLowerCase() === key);
        if (same.length <= 1) return label;
        let n = 0;
        for (let i = 0; i <= groupIndex && i < list.length; i += 1) {
            if (String(list[i]?.label || list[i]?.id || '').trim().toLowerCase() === key) n += 1;
        }
        return `${label} #${n}`;
    }

    /**
     * Groupes cochés par défaut à l’ajout : tout si 1ère occurrence du libellé, sinon aucun
     * (permet une 2e ligne « Garantie » avec d’autres groupes).
     */
    function defaultSelectedGroupIdsForAdd(catalogueFamily, draftFamilies) {
        const src = catalogueFamily && typeof catalogueFamily === 'object' ? catalogueFamily : {};
        const labelKey = String(src?.familyLabel || '').trim().toLowerCase();
        const groups = normalizeGroups(src?.decisionGroups);
        const list = Array.isArray(draftFamilies) ? draftFamilies : [];
        const hasSameLabel = labelKey && list.some(
            (f) => String(f?.familyLabel || '').trim().toLowerCase() === labelKey
        );
        if (hasSameLabel) return [];
        return groups.map((g) => String(g.id || '').trim()).filter(Boolean);
    }

    function countDraftUsesOfSourceIndex(draftFamilies, sourceIndex) {
        const idx = Number(sourceIndex);
        return (Array.isArray(draftFamilies) ? draftFamilies : []).filter(
            (f) => Number(f?.sourceIndex) === idx
        ).length;
    }

    function getPickOptionsHtml(prefix) {
        const h = getHandler(prefix);
        if (!h) return '<option value="">— Indisponible —</option>';
        const catalogue = typeof h.getCatalogueFamilies === 'function' ? h.getCatalogueFamilies() : [];
        const draft = typeof h.getDraft === 'function' ? h.getDraft() : { families: [] };
        const draftFamilies = Array.isArray(draft.families) ? draft.families : [];
        if (!catalogue.length) {
            return '<option value="">— Aucune famille validée (onglet Famille) —</option>';
        }
        const options = catalogue
            .filter((f) => String(f?.familyLabel || '').trim())
            .map((f) => {
                const idx = f.__idx;
                const label = String(f?.familyLabel || '').trim();
                const obj = String(f?.objectName || '').trim();
                const groups = normalizeGroups(f?.decisionGroups);
                const suffix = obj ? ` — ${obj}` : '';
                const gCount = groups.length ? ` (${groups.length} g.)` : '';
                const uses = countDraftUsesOfSourceIndex(draftFamilies, idx);
                const useHint = uses > 0 ? ` · déjà ${uses}×` : '';
                return `<option value="${idx}">${escapeHtml(label + suffix + gCount + useHint)}</option>`;
            });
        return `<option value="">— Choisir —</option>${options.join('')}`;
    }

    function reorderDraftFamilies(prefix, fromIdx, toIdx, mode) {
        const h = getHandler(prefix);
        if (!h || typeof h.getDraft !== 'function') return;
        const draft = h.getDraft();
        const families = Array.isArray(draft.families) ? draft.families : [];
        const from = Number(fromIdx);
        let to = Number(toIdx);
        if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || to < 0 || from >= families.length || to >= families.length) return;
        if (from === to) return;
        const next = families.slice();
        const [moved] = next.splice(from, 1);
        if (from < to) to -= 1;
        if (mode === 'after') to += 1;
        next.splice(Math.max(0, Math.min(to, next.length)), 0, moved);
        draft.families = next;
    }

    function bindGroupsDragDrop(prefix, draftIdx) {
        const h = getHandler(prefix);
        if (!h?.enableGroupDragReorder || !global.UgapSortableDnd?.bindSortableDnd) return;
        if (typeof h.reorderGroups !== 'function') return;
        const listEl = global.document.getElementById(`${prefix}-draft-groups-${draftIdx}`);
        if (!listEl) return;
        delete listEl.dataset.ugapDndBound;
        global.UgapSortableDnd.bindSortableDnd(listEl, {
            dataType: `text/ugap-fg-${prefix}`,
            itemSelector: '[data-ugap-fd-group-item]',
            handleSelector: '.ugap-dnd-handle-group',
            allowNest: false,
            getItemId: (el) => el.getAttribute('data-ugap-fd-group-item'),
            onDrop: (fromId, toId, mode) => {
                h.reorderGroups(Number(draftIdx), fromId, toId, mode);
                refreshPanel(prefix);
                if (typeof h.onRefresh === 'function') h.onRefresh();
            }
        });
    }

    function bindFamiliesDragDrop(prefix) {
        const h = getHandler(prefix);
        if (!h?.enableDragReorder || !global.UgapSortableDnd?.bindSortableDnd) return;
        const listEl = global.document.getElementById(`${prefix}-draft-families-list`);
        if (!listEl) return;
        delete listEl.dataset.ugapDndBound;
        global.UgapSortableDnd.bindSortableDnd(listEl, {
            dataType: `text/ugap-fd-${prefix}`,
            itemSelector: '[data-ugap-fd-drag-item]',
            handleSelector: '.ugap-dnd-handle:not(.ugap-dnd-handle-group)',
            allowNest: false,
            getItemId: (el) => el.getAttribute('data-ugap-fd-drag-item'),
            onDrop: (fromId, toId, mode) => {
                reorderDraftFamilies(prefix, Number(fromId), Number(toId), mode);
                refreshPanel(prefix);
                if (typeof h.onRefresh === 'function') h.onRefresh();
            }
        });
    }

    function renderFamiliesListHtml(prefix) {
        const h = getHandler(prefix);
        if (!h) return '';
        const draft = typeof h.getDraft === 'function' ? h.getDraft() : { families: [] };
        const catalogue = typeof h.getCatalogueFamilies === 'function' ? h.getCatalogueFamilies() : [];
        const families = Array.isArray(draft.families) ? draft.families : [];
        const dragReorder = !!h.enableDragReorder;
        const groupDragReorder = !!h.enableGroupDragReorder;
        if (!families.length) {
            return '<p class="ugap-family-draft-empty" style="margin:0; color:#94a3b8; font-size:13px;">Aucune famille. Cliquez sur « Ajouter une famille » en bas à droite.</p>';
        }
        return families.map((entry, draftIdx) => {
            const src = catalogue.find((f) => Number(f.__idx) === Number(entry.sourceIndex))
                || catalogue[entry.sourceIndex];
            const groups = normalizeGroups(src?.decisionGroups || entry.decisionGroups);
            const selectedIds = new Set(
                (Array.isArray(entry.selectedGroupIds) ? entry.selectedGroupIds : [])
                    .map((x) => String(x || '').trim())
                    .filter(Boolean)
            );
            const order = Array.isArray(entry.groupOrder)
                ? entry.groupOrder.map((x) => String(x || '').trim()).filter(Boolean)
                : [];
            const orderedGroups = order.length
                ? order.map((gid) => groups.find((g) => String(g.id || '').trim() === gid)).filter(Boolean)
                : groups.slice();
            groups.forEach((g) => {
                const gid = String(g.id || '').trim();
                if (gid && !orderedGroups.some((x) => String(x.id || '').trim() === gid)) {
                    orderedGroups.push(g);
                }
            });
            const displayFamilyLabel = escapeHtml(formatFamilyDisplayLabel(entry, draftIdx, families));
            const objectName = String(entry.objectName || src?.objectName || '').trim();
            const groupsInline = orderedGroups.length
                ? orderedGroups.map((g, gIdx) => {
                    const gid = String(g.id || '').trim();
                    const checked = selectedIds.has(gid);
                    const optCount = Array.isArray(g.optionIds) ? g.optionIds.length : 0;
                    const gLabel = escapeHtml(formatGroupDisplayLabel(g, gIdx, orderedGroups));
                    const groupHandle = groupDragReorder
                        ? `<span class="ugap-dnd-handle ugap-dnd-handle-group" draggable="true" title="Glisser pour réordonner le groupe" onclick="event.stopPropagation();">⋮</span>`
                        : '';
                    const groupDragAttr = groupDragReorder ? ` data-ugap-fd-group-item="${escapeHtml(gid)}"` : '';
                    return `<label class="ugap-family-draft-group" data-ugap-fd-group-item-wrap${groupDragAttr} style="display:inline-flex; align-items:center; gap:4px; font-size:12px; white-space:nowrap; cursor:pointer; margin:0; padding:2px 4px; border-radius:4px; background:#fff; border:1px solid #e2e8f0;">
                        ${groupHandle}
                        <input type="checkbox" data-ugap-fd-prefix="${escapeHtml(prefix)}" data-ugap-fd-draft-idx="${draftIdx}" data-ugap-fd-group-id="${escapeHtml(gid)}" ${checked ? 'checked' : ''} onchange="UgapFamilyDraftUi.onGroupToggleFromEl(this)">
                        <span><strong>${gLabel}</strong><span style="color:#64748b;"> (${groupTypeLabel(g.type)}${groupPriceLabel(g) ? ` · ${escapeHtml(groupPriceLabel(g))}` : ''}${optCount ? `, ${optCount} opt.` : ''})</span></span>
                    </label>`;
                }).join('')
                : '<span style="font-size:12px; color:#b45309;">Aucun groupe</span>';
            const dragHandle = dragReorder
                ? `<span class="ugap-dnd-handle" draggable="true" title="Glisser pour changer l'ordre des familles dans le parcours" onclick="event.stopPropagation();">⋮⋮</span>`
                : '';
            const dragAttr = dragReorder ? ` data-ugap-fd-drag-item="${draftIdx}"` : '';
            const groupsWrap = groupDragReorder
                ? `<div id="${escapeHtml(prefix)}-draft-groups-${draftIdx}" class="ugap-family-draft-groups" data-ugap-dnd-root style="display:flex; flex-wrap:wrap; gap:6px 12px; flex:1; align-items:center; min-width:0;">${groupsInline}</div>`
                : `<div style="display:flex; flex-wrap:wrap; gap:6px 12px; flex:1; align-items:center; min-width:0;">${groupsInline}</div>`;
            return `
                <div class="ugap-family-draft-row" data-ugap-fd-draft-idx="${draftIdx}"${dragAttr} style="display:flex; align-items:center; gap:10px; flex-wrap:wrap; padding:8px 10px; border:1px solid #e2e8f0; border-radius:6px; background:#f8fafc;">
                    ${dragHandle}
                    <div style="flex:0 0 auto; min-width:100px; max-width:200px;">
                        <span style="font-weight:600; font-size:13px; color:#0f172a;">${displayFamilyLabel}</span>
                        ${objectName ? `<span style="font-size:11px; color:#64748b; margin-left:4px;">(${escapeHtml(objectName)})</span>` : ''}
                    </div>
                    ${groupsWrap}
                    <button type="button" class="btn btn-outline" style="font-size:11px; padding:3px 8px; flex-shrink:0;" onclick="UgapFamilyDraftUi.removeFamily('${escapeHtml(prefix)}', ${draftIdx})">Retirer</button>
                </div>
            `;
        }).join('');
    }

    function renderPanelHtml(prefix, options) {
        const opts = options && typeof options === 'object' ? options : {};
        const title = opts.sectionTitle || 'Familles';
        const afterListHtml = String(opts.afterListHtml || '');
        const showSubCategoryAction = !!opts.showSubCategoryAction;
        const p = escapeHtml(prefix);
        const subcatPickWrapHtml = showSubCategoryAction
            ? `
                    <div id="${p}-subcat-pick-wrap" hidden style="display:flex; flex-wrap:wrap; gap:8px; align-items:center; width:100%;">
                        <input id="${p}-subcat-pick-name" type="text" placeholder="Nom de la sous-catégorie" autocomplete="off"
                            style="flex:1; min-width:160px; padding:6px 8px; border:1px solid #ddd; border-radius:6px; font-size:13px;">
                        <button type="button" class="btn btn-primary" style="font-size:12px; padding:6px 10px;"
                            onclick="UgapCategorieTabSubcategories.confirmAddFromPicker('${p}')">Créer</button>
                        <button type="button" class="btn btn-outline" style="font-size:12px; padding:6px 10px;"
                            onclick="UgapCategorieTabSubcategories.cancelAddPicker('${p}')">Annuler</button>
                    </div>`
            : '';
        const subcatBtnHtml = showSubCategoryAction
            ? `<button type="button" class="btn btn-outline" style="font-size:12px; padding:6px 12px;"
                        onclick="UgapCategorieTabSubcategories.showAddPicker('${p}')">+ Sous-catégorie</button>`
            : '';
        return `
            <div class="ugap-family-draft-panel" data-ugap-fd-prefix="${p}" style="padding:12px; border:1px dashed #cbd5e1; border-radius:8px; background:#fafbfc;">
                <div style="font-size:12px; font-weight:600; color:#475569; margin-bottom:8px;">${escapeHtml(title)}</div>
                <div id="${p}-draft-families-list" class="ugap-family-draft-list" style="display:flex; flex-direction:column; gap:6px;">
                    ${renderFamiliesListHtml(prefix)}
                </div>
                ${afterListHtml ? `<div class="ugap-family-draft-after-list" style="margin-top:10px;">${afterListHtml}</div>` : ''}
                <div style="display:flex; justify-content:flex-end; align-items:flex-end; flex-wrap:wrap; gap:8px; margin-top:10px;">
                    <div id="${p}-family-pick-wrap" hidden style="display:flex; flex-wrap:wrap; gap:8px; align-items:center; width:100%;">
                        <select id="${p}-family-pick" style="min-width:200px; padding:6px 8px; border:1px solid #ddd; border-radius:6px; font-size:13px;">
                            ${getPickOptionsHtml(prefix)}
                        </select>
                        <button type="button" class="btn btn-primary" style="font-size:12px; padding:6px 10px;" onclick="UgapFamilyDraftUi.confirmAdd('${p}')">Ajouter</button>
                        <button type="button" class="btn btn-outline" style="font-size:12px; padding:6px 10px;" onclick="UgapFamilyDraftUi.cancelPick('${p}')">Annuler</button>
                    </div>
                    ${subcatPickWrapHtml}
                    <button type="button" class="btn btn-outline" style="font-size:12px; padding:6px 12px;" onclick="UgapFamilyDraftUi.showPicker('${p}')">+ Ajouter une famille</button>
                    ${subcatBtnHtml}
                </div>
            </div>
        `;
    }

    function refreshPanel(prefix) {
        const p = String(prefix || '').trim();
        const listEl = global.document.getElementById(`${p}-draft-families-list`);
        const pickEl = global.document.getElementById(`${p}-family-pick`);
        if (listEl) listEl.innerHTML = renderFamiliesListHtml(p);
        if (pickEl) pickEl.innerHTML = getPickOptionsHtml(p);
        bindFamiliesDragDrop(p);
        const h = getHandler(p);
        if (h?.enableGroupDragReorder) {
            const draft = typeof h.getDraft === 'function' ? h.getDraft() : { families: [] };
            (Array.isArray(draft.families) ? draft.families : []).forEach((_, draftIdx) => {
                bindGroupsDragDrop(p, draftIdx);
            });
        }
        if (typeof global.scheduleParentEmbedResize === 'function') global.scheduleParentEmbedResize();
    }

    function showPicker(prefix) {
        const p = String(prefix || '').trim();
        if (global.UgapCategorieTabSubcategories?.cancelAddPicker) {
            global.UgapCategorieTabSubcategories.cancelAddPicker(p);
        }
        const wrap = global.document.getElementById(`${p}-family-pick-wrap`);
        if (wrap) {
            wrap.removeAttribute('hidden');
            refreshPanel(p);
            const pick = global.document.getElementById(`${p}-family-pick`);
            pick?.focus();
        }
    }

    function cancelPick(prefix) {
        const wrap = global.document.getElementById(`${prefix}-family-pick-wrap`);
        const pick = global.document.getElementById(`${prefix}-family-pick`);
        if (pick) pick.value = '';
        if (wrap) wrap.setAttribute('hidden', '');
    }

    function confirmAdd(prefix) {
        const h = getHandler(prefix);
        if (!h || typeof h.addFamilyFromPick !== 'function') return;
        const pick = global.document.getElementById(`${prefix}-family-pick`);
        const raw = String(pick?.value ?? '').trim();
        if (!raw) {
            global.showAlert?.('Choisissez une famille.', 'warning');
            return;
        }
        h.addFamilyFromPick(raw);
        cancelPick(prefix);
        refreshPanel(prefix);
        if (typeof h.onRefresh === 'function') h.onRefresh();
    }

    function removeFamily(prefix, draftIdx) {
        const h = getHandler(prefix);
        if (!h || typeof h.removeFamilyAt !== 'function') return;
        h.removeFamilyAt(Number(draftIdx));
        refreshPanel(prefix);
        if (typeof h.onRefresh === 'function') h.onRefresh();
    }

    function onGroupToggleFromEl(el) {
        if (!el) return;
        const prefix = String(el.getAttribute('data-ugap-fd-prefix') || '').trim();
        const draftIdx = Number(el.getAttribute('data-ugap-fd-draft-idx'));
        const gid = String(el.getAttribute('data-ugap-fd-group-id') || '').trim();
        const h = getHandler(prefix);
        if (!h || typeof h.toggleGroup !== 'function') return;
        h.toggleGroup(draftIdx, gid, !!el.checked);
        if (typeof h.onRefresh === 'function') h.onRefresh();
    }

    const UgapFamilyDraftUi = {
        register(prefix, handler) {
            registry[String(prefix || '').trim()] = handler;
        },
        renderPanelHtml,
        refreshPanel,
        showPicker,
        cancelPick,
        confirmAdd,
        removeFamily,
        onGroupToggleFromEl,
        defaultSelectedGroupIdsForAdd,
        formatFamilyDisplayLabel,
        formatGroupDisplayLabel
    };

    global.UgapFamilyDraftUi = UgapFamilyDraftUi;
})(window);
