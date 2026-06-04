/**
 * FICHIER : modules/ugap/frontend/assets/js/shared/ugap-categorie-display-behavior.js
 * RÔLE : Comportement d’affichage catégorie (standard / regroupé) + groupes cibles picker.
 *
 * ENTRÉES : catégorie ou draft création, familles catalogue validées
 * SORTIES : displayBehavior normalisé, groupes cibles, fusion pour configurateur
 *
 * DÉPEND DE : normalizeFamilyDecisionGroups
 * NE PAS : persistance API
 *
 * APPELÉ PAR : categorie-tab.js, configurateur-template-tree.js
 */
(function initUgapCategorieDisplayBehavior(global) {
    'use strict';

    function normalizeGroups(raw) {
        if (typeof global.normalizeFamilyDecisionGroups === 'function') {
            return global.normalizeFamilyDecisionGroups(raw);
        }
        return Array.isArray(raw) ? raw : [];
    }

    function groupRefKey(ref) {
        const fam = String(ref?.familyLabel || '').trim().toLowerCase();
        const comp = String(ref?.componentId || '').trim().toLowerCase();
        const grp = String(ref?.groupId || '').trim();
        return comp ? `${fam}::${comp}::${grp}` : `${fam}::${grp}`;
    }

    function normalizeDisplayBehavior(raw) {
        const src = raw && typeof raw === 'object' ? raw : {};
        const mode = String(src.mode || 'standard').trim().toLowerCase() === 'grouped' ? 'grouped' : 'standard';
        const groupedSets = (Array.isArray(src.groupedSets) ? src.groupedSets : [])
            .map((set, idx) => {
                const s = set && typeof set === 'object' ? set : {};
                const groupRefs = (Array.isArray(s.groupRefs) ? s.groupRefs : [])
                    .map((r) => {
                        const ref = {
                            familyLabel: String(r?.familyLabel || '').trim(),
                            groupId: String(r?.groupId || '').trim(),
                            sourceIndex: Number.isInteger(Number(r?.sourceIndex)) ? Number(r.sourceIndex) : undefined,
                        };
                        const componentId = String(r?.componentId || '').trim();
                        if (componentId) ref.componentId = componentId;
                        return ref;
                    })
                    .filter((r) => r.familyLabel && r.groupId);
                if (!groupRefs.length) return null;
                return {
                    id: String(s.id || `grouped_${idx + 1}`).trim(),
                    label: String(s.label || 'Options catalogue').trim() || 'Options catalogue',
                    groupRefs,
                };
            })
            .filter(Boolean);
        return { mode, groupedSets };
    }

    function findCatalogueFamily(catalogue, entry) {
        const list = Array.isArray(catalogue) ? catalogue : [];
        const e = entry && typeof entry === 'object' ? entry : {};
        const sourceIndex = Number(e.sourceIndex);
        if (Number.isInteger(sourceIndex)) {
            const hit = list.find((f) => Number(f.__idx) === sourceIndex);
            if (hit) return hit;
        }
        const label = String(e.familyLabel || '').trim().toLowerCase();
        return list.find((f) => String(f?.familyLabel || '').trim().toLowerCase() === label) || null;
    }

    function collectFamilyEntriesFromDraft(draft) {
        const d = draft && typeof draft === 'object' ? draft : {};
        const out = [];
        (Array.isArray(d.families) ? d.families : []).forEach((entry) => out.push(entry));
        (Array.isArray(d.subCategories) ? d.subCategories : []).forEach((sc) => {
            (Array.isArray(sc?.families) ? sc.families : []).forEach((entry) => out.push(entry));
        });
        return out;
    }

    /** Groupes cochés dans le draft catégorie → cibles du picker (type option catalogue). */
    function buildTargetGroupsFromDraft(draft, catalogueFamilies) {
        const catalogue = Array.isArray(catalogueFamilies) ? catalogueFamilies : [];
        const entries = collectFamilyEntriesFromDraft(draft);
        const targets = [];
        const seen = new Set();

        entries.forEach((entry) => {
            const src = findCatalogueFamily(catalogue, entry);
            const familyLabel = String(entry?.familyLabel || src?.familyLabel || '').trim();
            if (!familyLabel) return;
            const FCmp = global.UgapFamilyComponents;
            const groups = FCmp?.flattenDecisionGroups
                ? FCmp.flattenDecisionGroups(src || {})
                : normalizeGroups(src?.decisionGroups || entry?.decisionGroups);
            const selected = new Set(
                (Array.isArray(entry?.selectedGroupIds) ? entry.selectedGroupIds : [])
                    .map((x) => String(x || '').trim())
                    .filter(Boolean)
            );
            const matchSel = FCmp?.selectionKeyMatchesGroup
                ? (g, key) => FCmp.selectionKeyMatchesGroup(key, g)
                : (g, key) => String(g?.id || '').trim() === String(key || '').trim();
            groups.forEach((group) => {
                const groupId = String(group?.groupId || group?.id || '').trim();
                const componentId = String(group?.componentId || '').trim();
                if (!groupId) return;
                const isSelected = Array.from(selected).some((key) => matchSel(group, key));
                if (!isSelected) return;
                const type = String(group?.type || '').trim().toLowerCase();
                if (type && type !== 'option') return;
                const key = groupRefKey({ familyLabel, componentId, groupId });
                if (seen.has(key)) return;
                seen.add(key);
                const compLabel = String(group?.componentLabel || '').trim();
                const gLabel = String(group?.label || groupId).trim();
                targets.push({
                    familyLabel,
                    componentId: componentId || undefined,
                    groupId,
                    groupLabel: compLabel ? `${compLabel} · ${gLabel}` : gLabel,
                    sourceIndex: Number.isInteger(Number(entry?.sourceIndex)) ? Number(entry.sourceIndex) : undefined,
                    defaultChecked: groupId === 'option_catalogue',
                });
            });
        });

        return targets.sort((a, b) => {
            const fa = String(a.familyLabel || '').localeCompare(String(b.familyLabel || ''), 'fr');
            if (fa !== 0) return fa;
            return String(a.groupLabel || '').localeCompare(String(b.groupLabel || ''), 'fr');
        });
    }

    function buildGroupedGroupRefsChecklist(draft, catalogueFamilies) {
        return buildTargetGroupsFromDraft(draft, catalogueFamilies).map((g) => ({
            ...g,
            refKey: groupRefKey(g),
        }));
    }

    function readDisplayBehaviorFromDraft(draft) {
        const d = draft && typeof draft === 'object' ? draft : {};
        return normalizeDisplayBehavior(d.displayBehavior);
    }

    function writeDisplayBehaviorToDraft(draft, behavior) {
        const d = draft && typeof draft === 'object' ? draft : {};
        d.displayBehavior = normalizeDisplayBehavior(behavior);
        return d.displayBehavior;
    }

    function groupSelectionKey(group) {
        return `${String(group?.familyLabel || '').trim()}:${String(group?.groupId || group?.id || '').trim()}`;
    }

    function mergeGroupsForDisplay(groups, mergedLabel) {
        const list = Array.isArray(groups) ? groups : [];
        if (list.length < 2) return list[0] || null;
        const optionIds = new Set();
        const options = [];
        list.forEach((g) => {
            (Array.isArray(g?.optionIds) ? g.optionIds : []).forEach((id) => optionIds.add(String(id || '').trim()));
            (Array.isArray(g?.options) ? g.options : []).forEach((opt) => {
                const oid = String(opt?.id || '').trim();
                if (!oid || options.some((x) => String(x?.id || '') === oid)) return;
                options.push(opt);
            });
        });
        const first = list[0] || {};
        const mergedKeys = list.map((g) => groupSelectionKey(g));
        return {
            ...first,
            label: String(mergedLabel || 'Options catalogue').trim() || 'Options catalogue',
            decisionMode: 'multi_choice',
            optionIds: Array.from(optionIds).filter(Boolean),
            options,
            groupId: `__merged_${mergedKeys.join('_').slice(0, 80)}`,
            _mergedGroupKeys: mergedKeys,
            _isMergedDisplayGroup: true,
        };
    }

    /**
     * Applique le mode regroupé : fusionne les groupes listés dans groupedSets.
     * Les groupes non listés restent inchangés.
     */
    function applyGroupedDisplayToGroups(groups, category) {
        const list = Array.isArray(groups) ? groups.slice() : [];
        const behavior = normalizeDisplayBehavior(category?.displayBehavior);
        if (behavior.mode !== 'grouped' || !behavior.groupedSets.length) return list;

        const consumed = new Set();
        const result = [];

        behavior.groupedSets.forEach((set) => {
            const refs = new Set((set.groupRefs || []).map((r) => groupRefKey(r)));
            const toMerge = list.filter((g) => {
                const key = groupRefKey({ familyLabel: g.familyLabel, groupId: g.groupId || g.id });
                return refs.has(key);
            });
            if (toMerge.length < 2) {
                toMerge.forEach((g) => {
                    const key = groupSelectionKey(g);
                    if (!consumed.has(key)) {
                        consumed.add(key);
                        result.push(g);
                    }
                });
                return;
            }
            toMerge.forEach((g) => consumed.add(groupSelectionKey(g)));
            const merged = mergeGroupsForDisplay(toMerge, set.label);
            if (merged) result.push(merged);
        });

        list.forEach((g) => {
            const key = groupSelectionKey(g);
            if (!consumed.has(key)) result.push(g);
        });

        return result;
    }

    function renderDisplayBehaviorFormHtml() {
        return `
            <div class="ugap-cat-display-behavior" id="ugap-cat-display-behavior">
                <div class="ugap-cat-display-behavior__title">Affichage configurateur</div>
                <div class="ugap-cat-display-behavior__modes">
                    <label class="ugap-cat-display-behavior__mode">
                        <input type="radio" name="ugap-cat-display-mode" value="standard" checked>
                        Standard (un bloc par groupe)
                    </label>
                    <label class="ugap-cat-display-behavior__mode">
                        <input type="radio" name="ugap-cat-display-mode" value="grouped">
                        Regroupé (fusionner des groupes)
                    </label>
                </div>
                <div id="ugap-cat-grouped-config" class="ugap-cat-display-behavior__grouped" hidden>
                    <label for="ugap-cat-grouped-label" style="display:block;font-size:12px;color:#555;margin:8px 0 4px;">
                        Libellé du bloc regroupé
                    </label>
                    <input type="text" id="ugap-cat-grouped-label" class="ugap-cat-display-behavior__label-input"
                        placeholder="Ex. Options catalogue" autocomplete="off">
                    <p style="margin:8px 0 4px;font-size:12px;color:#64748b;">Groupes à fusionner :</p>
                    <div id="ugap-cat-grouped-group-list" class="ugap-cat-display-behavior__group-list"></div>
                </div>
            </div>
        `;
    }

    function syncDisplayBehaviorFormFromDraft(draft, catalogueFamilies) {
        const behavior = readDisplayBehaviorFromDraft(draft);
        const mode = behavior.mode;
        global.document.querySelectorAll('input[name="ugap-cat-display-mode"]').forEach((el) => {
            el.checked = String(el.value) === mode;
        });
        const groupedWrap = global.document.getElementById('ugap-cat-grouped-config');
        if (groupedWrap) groupedWrap.hidden = mode !== 'grouped';

        const labelInput = global.document.getElementById('ugap-cat-grouped-label');
        const setLabel = behavior.groupedSets[0]?.label || 'Options catalogue';
        if (labelInput) labelInput.value = setLabel;

        const listEl = global.document.getElementById('ugap-cat-grouped-group-list');
        if (!listEl) return;

        const checklist = buildGroupedGroupRefsChecklist(draft, catalogueFamilies);
        const selectedKeys = new Set(
            (behavior.groupedSets[0]?.groupRefs || []).map((r) => groupRefKey(r))
        );

        if (!checklist.length) {
            listEl.innerHTML = '<p style="margin:0;font-size:12px;color:#94a3b8;">Rattachez des familles avec groupes cochés.</p>';
            return;
        }

        listEl.innerHTML = checklist.map((g) => {
            const ref = JSON.stringify({
                familyLabel: g.familyLabel,
                groupId: g.groupId,
                sourceIndex: g.sourceIndex,
            });
            const checked = selectedKeys.has(g.refKey) ? 'checked' : '';
            return `
                <label class="ugap-cat-display-behavior__group-item">
                    <input type="checkbox" data-ugap-grouped-ref="${encodeURIComponent(ref)}" ${checked}>
                    <span><strong>${g.groupLabel}</strong> <span style="color:#64748b;">(${g.familyLabel})</span></span>
                </label>
            `;
        }).join('');
    }

    function readDisplayBehaviorFromForm() {
        const modeEl = global.document.querySelector('input[name="ugap-cat-display-mode"]:checked');
        const mode = String(modeEl?.value || 'standard').trim().toLowerCase() === 'grouped' ? 'grouped' : 'standard';
        if (mode !== 'grouped') {
            return normalizeDisplayBehavior({ mode: 'standard', groupedSets: [] });
        }
        const label = String(global.document.getElementById('ugap-cat-grouped-label')?.value || '').trim()
            || 'Options catalogue';
        const listEl = global.document.getElementById('ugap-cat-grouped-group-list');
        const groupRefs = [];
        if (listEl) {
            listEl.querySelectorAll('input[type="checkbox"][data-ugap-grouped-ref]:checked').forEach((el) => {
                try {
                    const raw = decodeURIComponent(el.getAttribute('data-ugap-grouped-ref') || '');
                    const parsed = JSON.parse(raw);
                    if (parsed?.familyLabel && parsed?.groupId) groupRefs.push(parsed);
                } catch (_) { /* skip */ }
            });
        }
        return normalizeDisplayBehavior({
            mode: 'grouped',
            groupedSets: groupRefs.length
                ? [{ id: 'grouped_main', label, groupRefs }]
                : [],
        });
    }

    function bindDisplayBehaviorForm(onChange) {
        const root = global.document.getElementById('ugap-cat-display-behavior');
        if (!root || root.dataset.ugapBound === '1') return;
        root.dataset.ugapBound = '1';
        root.addEventListener('change', (e) => {
            if (
                e.target.matches('input[name="ugap-cat-display-mode"]')
                || e.target.matches('#ugap-cat-grouped-label')
                || e.target.matches('[data-ugap-grouped-ref]')
            ) {
                const groupedWrap = global.document.getElementById('ugap-cat-grouped-config');
                const mode = global.document.querySelector('input[name="ugap-cat-display-mode"]:checked')?.value;
                if (groupedWrap) groupedWrap.hidden = mode !== 'grouped';
                if (typeof onChange === 'function') onChange();
            }
        });
    }

    global.UgapCategorieDisplayBehavior = {
        normalizeDisplayBehavior,
        buildTargetGroupsFromDraft,
        buildGroupedGroupRefsChecklist,
        readDisplayBehaviorFromDraft,
        writeDisplayBehaviorToDraft,
        applyGroupedDisplayToGroups,
        renderDisplayBehaviorFormHtml,
        syncDisplayBehaviorFormFromDraft,
        readDisplayBehaviorFromForm,
        bindDisplayBehaviorForm,
        groupRefKey,
    };
})(window);
