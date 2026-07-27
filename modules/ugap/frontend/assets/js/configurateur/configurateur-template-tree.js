/**
 * FICHIER : modules/ugap/frontend/assets/js/configurateur/configurateur-template-tree.js
 * RÔLE : Parcours configurateur step 3 — arbre catalogue (UgapModelBaseOptions), comme « Définir options de base ».
 *
 * ENTRÉES : state (modèle, sélections), slots catalogue, callbacks DOM
 * SORTIES : Rendu onglets / nœuds / modals (affichage prix uniquement, toutes options du nœud)
 *
 * DÉPEND DE : ugap-model-base-options.js, boat-template-tree.js
 * NE PAS : admin template CRUD, vues métier Excel
 *
 * APPELÉ PAR : index.html renderStep3
 */
(function initUgapConfiguratorTemplateTree(global) {
    'use strict';

    const Tree = () => global.UgapBoatTemplateTree;

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function ugapTplPerfWrap(label, fn) {
        if (typeof fn !== 'function') return undefined;
        let enabled = false;
        try {
            enabled = String(localStorage.getItem('ugap.perf') || '').trim() === '1';
        } catch (_) {
            enabled = false;
        }
        if (!enabled) return fn();
        const t0 = typeof performance !== 'undefined' && typeof performance.now === 'function'
            ? performance.now()
            : Date.now();
        const out = fn();
        const t1 = typeof performance !== 'undefined' && typeof performance.now === 'function'
            ? performance.now()
            : Date.now();
        try {
            // eslint-disable-next-line no-console
            console.log(`[UGAP][perf] ${label}: ${(t1 - t0).toFixed(1)}ms`);
        } catch (_) {
            // no-op
        }
        return out;
    }

    function getTpl(state) {
        return state._boatTemplateResolved || null;
    }

    function getModelBaseEditorTree(state) {
        syncModelBaseBridge(state);
        const MBO = getModelBaseOptions();
        const model = state?.selectedModel;
        if (!MBO?.buildModelBaseEditorTree || !model) {
            return { roots: [], orphanSlots: [] };
        }
        const mid = String(model?.id || '').trim();
        if (mid && state._modelBaseEditorTreeCacheKey === mid && state._modelBaseEditorTreeCache) {
            return state._modelBaseEditorTreeCache;
        }
        const tree = MBO.buildModelBaseEditorTree(model) || { roots: [], orphanSlots: [] };
        if (mid) {
            state._modelBaseEditorTreeCache = tree;
            state._modelBaseEditorTreeCacheKey = mid;
        }
        return tree;
    }

    function getCatalogRoots(state) {
        const tree = getModelBaseEditorTree(state);
        return Array.isArray(tree.roots) ? tree.roots : [];
    }

    function editorTreeHasParcours(tree) {
        if (!tree || typeof tree !== 'object') return false;
        if ((Array.isArray(tree.roots) ? tree.roots : []).length) return true;
        if ((Array.isArray(tree.orphanSlots) ? tree.orphanSlots : []).length) return true;
        return false;
    }

    function slotToGroup(slot) {
        const s = slot && typeof slot === 'object' ? slot : {};
        const MBO = getModelBaseOptions();
        const isMulti = MBO?.isMultiChoiceSlot?.(s) === true
            || String(s.decisionMode || '').trim().toLowerCase() === 'multi_choice';
        const title = MBO?.formatSlotTitle?.(s)
            || String(s.groupLabel || s.catalogNodeLabel || s.groupId || '').trim();
        const catalogNodeId = String(s.catalogNodeId || '').trim();
        const groupId = String(s.groupId || '').trim()
            || (catalogNodeId ? `cn_${catalogNodeId}` : '');
        return {
            familyLabel: String(s.familyLabel || '').trim(),
            groupId,
            label: title || groupId,
            categoryName: String(s.categoryName || s.familyLabel || '').trim(),
            catalogNodeId: catalogNodeId || undefined,
            decisionMode: isMulti ? 'multi_choice' : 'single_choice',
            optionIds: (Array.isArray(s.groupOptionIds) ? s.groupOptionIds : [])
                .map((x) => String(x || '').trim())
                .filter(Boolean),
            options: [],
            _slot: s,
        };
    }

    function groupSelectionKey(group) {
        const slot = group?._slot || groupToSlot(group);
        const MBO = getModelBaseOptions();
        if (MBO?.getSlotKey) return MBO.getSlotKey(slot);
        return `${String(group.familyLabel || '').trim()}:${String(group.groupId || '').trim()}`;
    }

    function isDevisSlotUserCleared(state, group) {
        const key = groupSelectionKey(group);
        return !!(state._devisSlotNoAutoDefault && state._devisSlotNoAutoDefault.has(key));
    }

    function markDevisSlotUserCleared(state, group) {
        if (!state._devisSlotNoAutoDefault) state._devisSlotNoAutoDefault = new Set();
        state._devisSlotNoAutoDefault.add(groupSelectionKey(group));
    }

    function unmarkDevisSlotUserCleared(state, group) {
        state._devisSlotNoAutoDefault?.delete(groupSelectionKey(group));
    }

    function clearDevisSingleChoiceSlot(state, group, hooks) {
        if (isParametrageBaseMode(hooks) && typeof hooks.onParametrageClearSlot === 'function') {
            const result = hooks.onParametrageClearSlot(state, group);
            if (result && typeof result.then === 'function') {
                return result.then(() => {
                    syncParcoursSelectionsFromMbo(state, hooks);
                });
            }
            syncParcoursSelectionsFromMbo(state, hooks);
            return;
        }
        markDevisSlotUserCleared(state, group);
        global.UgapBaseAdjLinks?.clearLinkedAdjForGroup?.(state, group);
        clearGroupSelection(state, group);
        state._lastParcoursPickGroup = group;
        state._parcoursPickNeedsFullRefresh = true;
    }

    function getModelBaseOptions() {
        return global.UgapModelBaseOptions;
    }

    function isFivePercentCatalogOption(hooks, opt) {
        if (typeof hooks?.isFivePercentCatalogOption === 'function') {
            return hooks.isFivePercentCatalogOption(opt) === true;
        }
        const kind = String(hooks?.getOptionInclusionKind?.(opt) || '').trim().toLowerCase();
        return kind === 'devis_5pct';
    }

    function fivePercentBadgeHtml(hooks) {
        if (typeof hooks?.renderFivePercentBadgeHtml === 'function') {
            return hooks.renderFivePercentBadgeHtml();
        }
        return '<span class="ugap-five-pct-badge">5% Devis</span>';
    }

    function resolvePickerCatalogOption(state, hooks, optionId) {
        const oid = String(optionId || '').trim();
        if (!oid) return null;
        const MBO = getModelBaseOptions();
        return findCatalogOption(state, hooks, oid)
            || MBO?.findOptionRecord?.(oid)?.option
            || null;
    }

    function filterStandardChoiceRows(state, hooks, rows, group) {
        const slot = group ? groupToSlot(group) : null;
        const hideMinoration = !!(slot && getModelBaseOptions()?.slotHidesMinorationInChoices?.(slot));
        const MBO = getModelBaseOptions();
        const OLK = global.UgapOptionLineKind;
        const motorPicker = !!(slot && MBO?.isMotorChoiceSlot?.(slot));
        const mid = String(state?.selectedModel?.id || '').trim();
        return (Array.isArray(rows) ? rows : []).filter((row) => {
            if (row?.isBaseOption) {
                const opt = resolvePickerCatalogOption(state, hooks, row?.id);
                if (!opt) return true;
                if (mid && MBO?.isCompatible && MBO.isCompatible(opt, mid) === false) return false;
                return true;
            }
            const opt = resolvePickerCatalogOption(state, hooks, row?.id);
            if (!opt) return false;
            if (isFivePercentCatalogOption(hooks, opt)) return false;
            if (mid && MBO?.isCompatible && MBO.isCompatible(opt, mid) === false) return false;
            if (motorPicker) {
                if (MBO?.isOptionOnSiblingMotorisationNode?.(opt, slot)) return false;
                const isBase = MBO?.isMotorBaseCatalogOption?.(opt);
                if (isBase) return true;
                // Moteurs de remplacement (lignes tarif) du nœud du slot, déjà filtrés par modèle.
                if (MBO?.isMotorTarifCatalogOption?.(opt)) {
                    return MBO?.isOptionOnMotorChoiceSlotNode?.(opt, slot) !== false;
                }
                if (MBO?.isImportGeneratedBaseOption?.(opt)) return true;
                return false;
            }
            if (hideMinoration) {
                if (MBO?.isMotorBaseCatalogOption?.(opt)) return true;
                const kind = String(OLK?.inferOptionLineKind?.(opt) || '').trim().toLowerCase();
                if (kind === 'minoration' || opt?.isMinoration === true) return false;
            }
            return true;
        });
    }

    function applyFivePercentCatalogPick(state, hooks, optionId) {
        const id = String(optionId || '').trim();
        if (!id) return false;
        if (typeof hooks?.addFivePercentCatalogOption === 'function') {
            return hooks.addFivePercentCatalogOption(id) !== false;
        }
        const opt = findCatalogOption(state, hooks, id);
        const price = typeof hooks?.getFivePercentOptionPrice === 'function'
            ? hooks.getFivePercentOptionPrice(opt)
            : catalogUgapPrice(opt);
        if (typeof hooks?.tryAddFivePercentPriceDelta === 'function'
            && hooks.tryAddFivePercentPriceDelta(price) === false) {
            return false;
        }
        state.selectedOptions.delete(id);
        state.fivePercentOptions.add(id);
        return true;
    }

    function syncModelBaseBridge(state) {
        global.UgapConfiguratorModelBaseBridge?.sync?.(state);
    }

    function groupToSlot(group) {
        if (group?._slot) return group._slot;
        if (global.UgapConfiguratorModelBaseBridge?.groupToSlot) {
            return global.UgapConfiguratorModelBaseBridge.groupToSlot(group);
        }
        const g = group && typeof group === 'object' ? group : {};
        const slot = {
            familyLabel: String(g.familyLabel || '').trim(),
            groupId: String(g.groupId || '').trim(),
            groupLabel: String(g.label || g.groupId || '').trim(),
            categoryName: String(g.categoryName || g.familyLabel || '').trim(),
        };
        const cn = String(g.catalogNodeId || '').trim();
        if (cn) slot.catalogNodeId = cn;
        return slot;
    }

    function collectChoiceIdsForSlot(state, slot) {
        const MBO = getModelBaseOptions();
        const model = state?.selectedModel;
        const ids = new Set();
        if (MBO?.getChoiceRows && model) {
            syncModelBaseBridge(state);
            (MBO.getChoiceRows(model, slot, { baseOnly: false }) || []).forEach((row) => {
                const id = String(row?.id || '').trim();
                if (id) ids.add(id);
            });
        }
        return ids;
    }

    function getSelectedInGroup(state, group, hooks) {
        const found = new Set();
        const slot = groupToSlot(group);
        collectChoiceIdsForSlot(state, slot).forEach((id) => {
            if (state.selectedOptions.has(id) || state.fivePercentOptions.has(id)) {
                found.add(id);
            }
        });
        (Array.isArray(group?.options) ? group.options : [])
            .map((o) => String(o?.id || '').trim())
            .filter(Boolean)
            .forEach((id) => {
                if (state.selectedOptions.has(id) || state.fivePercentOptions.has(id)) {
                    found.add(id);
                }
            });
        (Array.isArray(group?.optionIds) ? group.optionIds : [])
            .map((x) => String(x || '').trim())
            .filter(Boolean)
            .forEach((id) => {
                if (state.selectedOptions.has(id) || state.fivePercentOptions.has(id)) {
                    found.add(id);
                }
            });
        const catalogNodeId = catalogNodeIdFromSlot(slot)
            || String(group?.catalogNodeId || '').trim();
        if (catalogNodeId) {
            state.selectedOptions.forEach((optId) => {
                const id = String(optId || '').trim();
                if (!id || found.has(id)) return;
                if (optionMatchesCatalogSlot(state, hooks, id, slot)) found.add(id);
            });
        }
        appendFivePercentSelectionsForGroup(state, group, found, hooks);
        return Array.from(found);
    }

    function appendFivePercentSelectionsForGroup(state, group, foundSet, hooks) {
        const slot = groupToSlot(group);
        const catalogNodeId = catalogNodeIdFromSlot(slot)
            || String(group?.catalogNodeId || '').trim();
        const map = buildOptionById(Array.isArray(state.categories) ? state.categories : []);
        state.fivePercentOptions.forEach((optId) => {
            const id = String(optId || '').trim();
            if (!id || foundSet.has(id)) return;
            const opt = map.get(id);
            if (!opt) return;
            if (catalogNodeId && optionMatchesCatalogSlot(state, hooks, id, slot)) {
                foundSet.add(id);
                return;
            }
            if ((Array.isArray(group?.optionIds) ? group.optionIds : []).map(String).includes(id)) {
                foundSet.add(id);
            }
        });
    }

    function getSingleSelectedOption(state, group, hooks) {
        const selected = getSelectedInGroup(state, group, hooks);
        if (!selected.length) return null;
        const baseId = String(getGroupBaseOptionId(state, group, hooks) || '').trim();
        const map = new Map((group.options || []).map((o) => [o.id, o]));
        const resolve = (id) => map.get(id) || findCatalogOption(state, hooks, id);
        if (selected.length > 1 && baseId) {
            const explicit = selected.find((id) => String(id || '').trim() && String(id) !== baseId);
            if (explicit) return resolve(explicit);
        }
        return resolve(selected[0]);
    }

    function isBaseCatalogOption(hooks, opt) {
        if (typeof hooks?.isBaseCatalogOption === 'function') return hooks.isBaseCatalogOption(opt);
        if (!opt || typeof opt !== 'object') return false;
        if (opt.isBaseOption === true) return true;
        if (opt.baseIncluded === true) return true;
        return false;
    }

    function isMotorTarifCatalogOption(hooks, opt) {
        if (typeof hooks?.isMotorTarifCatalogOption === 'function') return hooks.isMotorTarifCatalogOption(opt);
        const MBO = getModelBaseOptions();
        if (!opt) return false;
        if (MBO?.isImportGeneratedBaseOption?.(opt)) return false;
        if (MBO?.isMotorTarifName) return MBO.isMotorTarifName(opt.name);
        if (opt.importGeneratedFromBaseProduct === true) return false;
        const name = String(opt?.name || '').replace(/\s+/g, ' ').trim();
        if (!name || /\ben\s+remplacement\b/i.test(name)) return false;
        if (!/\bmoteur\b/i.test(name) || name.length < 55) return false;
        return /\b(hors-bord|essence|diesel|démarrage|direction|hélice|helice|arbre)\b/i.test(name);
    }

    function isImportGeneratedBaseOption(opt) {
        const MBO = getModelBaseOptions();
        if (MBO?.isImportGeneratedBaseOption) return MBO.isImportGeneratedBaseOption(opt);
        if (!opt) return false;
        if (opt.importGeneratedFromBaseProduct === true) return true;
        return String(opt.refUgap || '').trim().toUpperCase().startsWith('IBP-');
    }

    function findCatalogOption(state, hooks, optionId) {
        const oid = String(optionId || '').trim();
        if (!oid) return null;
        if (typeof hooks?.getCatalogOptionById === 'function') {
            const fromHook = hooks.getCatalogOptionById(oid);
            if (fromHook) return fromHook;
        }
        const fromMap = getTplOptionByIdMap(state).get(oid);
        if (fromMap) return fromMap;
        const cats = Array.isArray(state.categories) ? state.categories : [];
        for (const cat of cats) {
            const hit = (Array.isArray(cat?.options) ? cat.options : []).find((o) => String(o?.id) === oid);
            if (hit) {
                const catName = String(cat?.name || cat?.objectName || '').trim();
                return {
                    ...hit,
                    categoryName: String(hit.categoryName || catName || '').trim() || catName,
                };
            }
        }
        return null;
    }

    function isCompatibleForModel(state, hooks, opt) {
        if (!opt) return false;
        if (typeof hooks?.isOptionCompatibleWithModel === 'function') {
            return hooks.isOptionCompatibleWithModel(opt);
        }
        const mid = String(state.selectedModel?.id || '').trim();
        if (!mid) return true;
        const comp = Array.isArray(opt.compatibleModels) ? opt.compatibleModels.map(String) : [];
        // Sans modèle attitré, l'option est compatible avec tous les modèles.
        if (!comp.length) return true;
        return comp.includes(mid);
    }

    function findOptionInGroupOrCatalog(state, group, hooks, optionId) {
        const oid = String(optionId || '').trim();
        if (!oid) return null;
        const inGroup = (Array.isArray(group?.options) ? group.options : []).find((o) => o.id === oid);
        if (inGroup) return inGroup;
        return findCatalogOption(state, hooks, oid);
    }

    function getGroupBaseOptionId(state, group, hooks) {
        const MBO = getModelBaseOptions();
        const model = state.selectedModel;
        const mid = String(model?.id || '').trim();
        if (MBO?.getAssignedOptionId && mid) {
            syncModelBaseBridge(state);
            const assigned = String(MBO.getAssignedOptionId(mid, groupToSlot(group)) || '').trim();
            if (assigned) {
                const opt = findCatalogOption(state, hooks, assigned);
                if (opt) return assigned;
            }
        }

        const opts = Array.isArray(group?.options) ? group.options : [];
        const defId = String(group.defaultOptionId || '').trim();
        if (defId) {
            const opt = findCatalogOption(state, hooks, defId);
            if (opt) return defId;
        }
        for (const opt of opts) {
            if (!isBaseCatalogOption(hooks, opt)) continue;
            return opt.id;
        }
        return '';
    }

    /** Ne retire plus les lignes moteur catalogue : remplacement valide si le modèle (poste) est coché. */
    function purgeMotorTarifFromGroupSelection() {}

    /**
     * Choix unique ≠ option de base du groupe (remplacement).
     * La minoration liée auto ne s’applique que si le groupe est motorisation (voir isMotorLinkedAdjGroup).
     */
    function isBaseReplacedInGroup(state, group, hooks) {
        if (!group || group.decisionMode === 'multi_choice') return false;
        const display = getSingleChoiceDisplay(state, group, hooks);
        const shownId = String(display?.option?.id || '').trim();
        const baseId = String(getGroupBaseOptionId(state, group, hooks) || '').trim();
        if (!shownId || !display?.option || !baseId) return false;
        return shownId !== baseId;
    }

    /** @deprecated Utiliser isBaseReplacedInGroup */
    function isIbpReplacedInGroup(state, group, hooks) {
        return isBaseReplacedInGroup(state, group, hooks);
    }

    function purgeLinkedAdjForDefaultBaseInGroup(state, group, hooks) {
        if (isIbpReplacedInGroup(state, group, hooks)) return;
        global.UgapBaseAdjLinks?.clearLinkedAdjForGroup?.(state, group);
    }

    /** Option affichée pour un choix unique : sélection utilisateur, sinon option de base. */
    function getSingleChoiceDisplay(state, group, hooks) {
        let selected = getSingleSelectedOption(state, group, hooks);
        if (selected) {
            return { option: selected, isExplicitSelection: true, isBaseDefault: false };
        }
        if (isDevisSlotUserCleared(state, group)) {
            return { option: null, isExplicitSelection: false, isBaseDefault: false };
        }
        const baseId = getGroupBaseOptionId(state, group, hooks);
        if (baseId) {
            const baseOpt = findOptionInGroupOrCatalog(state, group, hooks, baseId);
            if (baseOpt) {
                return { option: baseOpt, isExplicitSelection: false, isBaseDefault: true };
            }
        }
        return { option: null, isExplicitSelection: false, isBaseDefault: false };
    }

    function ensureSingleChoiceGroupDefault(state, group, hooks) {
        if (group.decisionMode === 'multi_choice') return;
        if (isDevisSlotUserCleared(state, group)) return;
        if (getSelectedInGroup(state, group).length > 0) return;

        syncModelBaseBridge(state);
        const mid = String(state.selectedModel?.id || '').trim();
        const MBO = getModelBaseOptions();
        if (mid && MBO?.getConfiguratorDefaultPickIds) {
            const pickIds = MBO.getConfiguratorDefaultPickIds(mid, groupToSlot(group));
            if (pickIds.length) {
                applyDefaultPickIdsToGroup(state, group, [pickIds[0]]);
                return;
            }
        }

        const baseId = getGroupBaseOptionId(state, group, hooks);
        if (!baseId) return;
        state.selectedOptions.add(baseId);
    }

    function applyDefaultPickIdsToGroup(state, group, pickIds) {
        const slot = groupToSlot(group);
        const allowed = new Set(collectChoiceIdsForSlot(state, slot));
        (Array.isArray(group?.options) ? group.options : []).forEach((o) => {
            const id = String(o?.id || '').trim();
            if (id) allowed.add(id);
        });
        [...new Set(pickIds)].forEach((rawId) => {
            const oid = String(rawId || '').trim();
            if (!oid) return;
            if (allowed.size > 0 && !allowed.has(oid)) return;
            state.selectedOptions.add(oid);
        });
    }

    /** Choix multiple : coche par défaut les options de base du modèle (comme paramétrage modèle de base). */
    function ensureMultiChoiceGroupDefault(state, group, hooks) {
        if (!group || group.decisionMode !== 'multi_choice') return;
        if (isDevisSlotUserCleared(state, group)) return;

        syncModelBaseBridge(state);
        const mid = String(state.selectedModel?.id || '').trim();
        const MBO = getModelBaseOptions();
        if (!mid || !MBO?.getConfiguratorDefaultPickIds) return;

        const pickIds = MBO.getConfiguratorDefaultPickIds(mid, groupToSlot(group));
        if (!pickIds.length) return;

        const missing = pickIds.filter(
            (id) => !state.selectedOptions.has(id) && !state.fivePercentOptions.has(id)
        );
        if (missing.length) applyDefaultPickIdsToGroup(state, group, missing);
    }

    function ensureSingleChoiceDefaultsForGroups(state, groups, hooks) {
        const list = Array.isArray(groups) ? groups : [];
        list.forEach((g) => {
            if (!g || g.missing) return;
            if (g.decisionMode === 'multi_choice') {
                ensureMultiChoiceGroupDefault(state, g, hooks);
                return;
            }
            ensureSingleChoiceGroupDefault(state, g, hooks);
            purgeLinkedAdjForDefaultBaseInGroup(state, g, hooks);
        });
        const BAL = global.UgapBaseAdjLinks;
        if (BAL?.syncLinkedAdjForAdjPricingGroups) {
            BAL.syncLinkedAdjForAdjPricingGroups(
                state,
                list,
                hooks,
                (id) => findCatalogOption(state, hooks, id),
                {
                    isBaseReplacedInGroup: (st, grp, h) => isBaseReplacedInGroup(st, grp, h),
                    isIbpReplacedInGroup: (st, grp, h) => isBaseReplacedInGroup(st, grp, h),
                    getGroupBaseOptionId,
                    getSingleChoiceDisplay
                }
            );
        }
    }

    /** Le modèle est censé utiliser le parcours template (pas les vues métier). */
    function modelRequiresTemplate(state) {
        syncModelBaseBridge(state);
        const MBO = getModelBaseOptions();
        if (MBO?.resolveBoatTemplateIdForModel && state?.selectedModel) {
            return !!String(MBO.resolveBoatTemplateIdForModel(state.selectedModel) || '').trim();
        }
        return !!String(state.selectedModel?.boatTemplateId || '').trim();
    }

    function getBoatTemplateForModel(state) {
        syncModelBaseBridge(state);
        const MBO = getModelBaseOptions();
        const tid = MBO?.resolveBoatTemplateIdForModel && state?.selectedModel
            ? String(MBO.resolveBoatTemplateIdForModel(state.selectedModel) || '').trim()
            : String(state.selectedModel?.boatTemplateId || '').trim();
        if (!tid) return null;
        if (MBO?.getTemplateById) {
            const tpl = MBO.getTemplateById(tid);
            if (tpl) return tpl;
        }
        const list = Array.isArray(state.uiState?.boatTemplates) ? state.uiState.boatTemplates : [];
        let tpl = list.find((t) => String(t?.id || '') === tid);
        if (!tpl) {
            try {
                const raw = global.localStorage.getItem('ugap.templateBateau.saved');
                const parsed = raw ? JSON.parse(raw) : [];
                tpl = (Array.isArray(parsed) ? parsed : []).find((t) => String(t?.id || '') === tid);
            } catch (_) {
                tpl = null;
            }
        }
        return tpl || null;
    }

    /** Index option par id — invalidé quand la référence du tableau categories change. */
    let _optionByIdCache = null;

    function buildOptionById(categories) {
        const cats = Array.isArray(categories) ? categories : [];
        if (_optionByIdCache && _optionByIdCache.cats === cats) return _optionByIdCache.map;
        const T = Tree();
        const map = T?.buildCatalogueOptionById ? T.buildCatalogueOptionById(cats) : new Map();
        _optionByIdCache = { cats, map };
        return map;
    }

    function resolveTemplateForState(state) {
        const tpl = getBoatTemplateForModel(state);
        if (!tpl || !Tree()) return null;
        const categories = Array.isArray(state.categories) ? state.categories : [];
        const byCatId = new Map(categories.map((c) => [String(c.id || '').trim(), c]));
        const families = typeof state.getValidatedFamilies === 'function'
            ? state.getValidatedFamilies()
            : (Array.isArray(state.uiState?.families) ? state.uiState.families : []);
        const optionById = buildOptionById(categories);
        const isSelectable = typeof state.isOptionCompatibleWithSelectedModel === 'function'
            ? state.isOptionCompatibleWithSelectedModel
            : (typeof state.isOptionSelectable === 'function' ? state.isOptionSelectable : () => true);
        const MBO = getModelBaseOptions();
        const catalogNodes = MBO?.getCatalogNodesForRuntime
            ? MBO.getCatalogNodesForRuntime()
            : (Array.isArray(state.uiState?.catalog?.nodes)
                ? state.uiState.catalog.nodes
                : (global.UgapCatalogueLcState?.getCatalog?.()?.nodes || []));
        const snap = Tree().normalizeBoatTemplateSnapshot(tpl.snapshot || {}, {
            resolveCategoryById: (id) => byCatId.get(String(id || '').trim()) || null,
            catalogNodes,
        });
        const migrated = { ...tpl, snapshot: snap };
        return Tree().resolveTemplateTree(migrated, {
            catalogueFamilies: families,
            optionById,
            isOptionSelectable: isSelectable,
            resolveCategoryById: (id) => byCatId.get(String(id || '').trim()) || null
        });
    }

    function ensureResolved(state) {
        state._boatTemplateResolved = resolveTemplateForState(state);
        return state._boatTemplateResolved;
    }

    /**
     * @returns {{ mode: 'legacy'|'template'|'template_error', reason?: string, tpl?: object, resolved?: object }}
     */
    function getTemplateConfiguratorStatus(state) {
        if (!modelRequiresTemplate(state)) {
            return { mode: 'legacy' };
        }
        const tpl = getBoatTemplateForModel(state);
        if (!tpl) {
            return { mode: 'template_error', reason: 'missing_template' };
        }
        const Core = global.UgapCatalogueNodesCore;
        if (!Core?.getChildren) {
            return { mode: 'template_error', reason: 'catalog_core_unavailable', tpl };
        }
        syncModelBaseBridge(state);
        const model = state.selectedModel;
        const mboStatus = getMboStatusCached(state, model);
        const tree = getModelBaseEditorTree(state);
        const hasSlots = (Array.isArray(mboStatus.slots) ? mboStatus.slots : []).length > 0;
        if (!editorTreeHasParcours(tree) && !hasSlots) {
            return { mode: 'template_error', reason: 'empty_tree', tpl };
        }
        return { mode: 'template', tpl };
    }

    function renderTemplateError(state, hooks, status) {
        const h = hooks && typeof hooks === 'object' ? hooks : {};
        const tabs = h.tabsContainer;
        const sub = h.subcategoriesContainer;
        const opt = h.optionsContainer;
        if (tabs) tabs.innerHTML = '';
        if (sub) sub.innerHTML = '';

        const tid = String(state.selectedModel?.boatTemplateId || '').trim();
        const messages = {
            missing_template: `Template « ${escapeHtml(tid)} » introuvable. Enregistrez-le dans Paramétrage → Ordre des options, puis rechargez cette page.`,
            empty_tree: 'Aucun nœud catalogue pour cet ordre des options — créez l’arborescence dans Paramétrage → Catalogue, enregistrez l’ordre des options, et liez-le au modèle.',
            catalog_nodes_missing: 'Le catalogue publié n’est pas chargé dans le configurateur. Rechargez la page (Ctrl+F5). Si le paramétrage affiche bien l’arbre, republiez les données UGAP.',
            no_groups: 'Aucun poste catalogue sur ce modèle. Assignez les options de base par nœud dans Modèles → Définir options de base.',
            module_unavailable: 'Module ordre des options non chargé (boat-template-tree.js). Rechargez la page (Ctrl+F5).',
            catalog_core_unavailable: 'Module catalogue non chargé (catalogue-nodes-core.js). Rechargez la page (Ctrl+F5).',
        };
        const msg = messages[status.reason] || 'Configuration template invalide.';

        if (opt) {
            opt.innerHTML = `<div style="padding:16px;border:2px solid #f59e0b;border-radius:8px;background:#fffbeb;color:#92400e;font-size:14px;line-height:1.5;">
                <strong>Parcours options</strong> (pas les vues métier)<br><br>${msg}
            </div>`;
        }
        if (typeof h.setStep3Hint === 'function') {
            h.setStep3Hint(true, status.reason);
        }
        return true;
    }

    function clearGroupSelection(state, group, exceptId, hooks) {
        const slot = groupToSlot(group);
        const except = String(exceptId || '').trim();
        collectChoiceIdsForSlot(state, slot).forEach((id) => {
            if (except && id === except) return;
            state.selectedOptions.delete(id);
            state.fivePercentOptions.delete(id);
        });
        (Array.isArray(group?.options) ? group.options : []).forEach((opt) => {
            const oid = String(opt?.id || '').trim();
            if (!oid || (except && oid === except)) return;
            state.selectedOptions.delete(oid);
            state.fivePercentOptions.delete(oid);
        });
        (Array.isArray(group?.optionIds) ? group.optionIds : []).forEach((rawId) => {
            const oid = String(rawId || '').trim();
            if (!oid || (except && oid === except)) return;
            state.selectedOptions.delete(oid);
            state.fivePercentOptions.delete(oid);
        });
        const catalogNodeId = catalogNodeIdFromSlot(slot)
            || String(group?.catalogNodeId || '').trim();
        if (catalogNodeId && state.selectedOptions) {
            const map = buildOptionById(Array.isArray(state.categories) ? state.categories : []);
            [...state.selectedOptions].forEach((optId) => {
                const id = String(optId || '').trim();
                if (!id || (except && id === except)) return;
                const opt = map.get(id);
                if (opt && String(opt.catalogObjectId || '').trim() === catalogNodeId) {
                    state.selectedOptions.delete(id);
                    state.fivePercentOptions.delete(id);
                }
            });
        }
        if (except && hooks) {
            const baseId = String(getGroupBaseOptionId(state, group, hooks) || '').trim();
            if (baseId && baseId !== except) {
                state.selectedOptions.delete(baseId);
                state.fivePercentOptions.delete(baseId);
            }
        }
    }

    /* ——— Parcours étape 3 (création devis) : tableau Famille | Poste | Option | Prix UGAP HT + modals ——— */

    function isParametrageBaseMode(hooks) {
        return hooks?.parcoursMode === 'parametrage_base';
    }

    /** Tableau 3 colonnes fusionnées — paramétrage Modèles + édition Ordre des options. */
    function useMergedNodePathColumns(hooks) {
        return isParametrageBaseMode(hooks) || isParcoursReorderTableMode(hooks);
    }

    function isParcoursStructureMode(hooks) {
        return hooks?.parcoursStructureMode === true;
    }

    function isParcoursReorderTableMode(hooks) {
        return hooks?.parcoursReorderMode === true || isParcoursStructureMode(hooks);
    }

    function applyParcoursTableRowspans(rows, hooks) {
        if (useMergedNodePathColumns(hooks)) return applyBaseModelTableRowspans(rows);
        return applyLegacyCategorieRowspans(rows);
    }

    function isParcoursReadOnly(hooks) {
        return hooks?.parcoursReadOnly === true;
    }

    /** True si la ligne de choix est une option de base (incluse, non configurable). */
    function isBaseChoiceRow(state, hooks, row) {
        if (!row) return true;
        if (row.isBaseOption === true) return true;
        const opt = resolvePickerCatalogOption(state, hooks, row?.id);
        if (!opt) return true;
        return isBaseCatalogOption(hooks, opt) || isImportGeneratedBaseOption(opt);
    }

    /**
     * Configurateur devis : true s'il existe au moins une option non-base à proposer.
     * Vide ou uniquement option(s) de base → false.
     */
    function slotHasConfigurableChoices(state, hooks, slot) {
        const group = slotToGroup(slot);
        const rows = filterStandardChoiceRows(
            state,
            hooks,
            parcoursChoiceRows(state, slot, hooks),
            group
        );
        return rows.some((row) => !isBaseChoiceRow(state, hooks, row));
    }

    /** Sélection active non-base sur le poste (pour ne pas masquer un choix déjà fait). */
    function slotHasNonBaseConfiguratorSelection(state, hooks, slot) {
        const ids = parcoursSelectedIds(state, slot, hooks);
        if (!ids.length) return false;
        const group = slotToGroup(slot);
        const display = group.decisionMode === 'multi_choice'
            ? null
            : getSingleChoiceDisplay(state, group, hooks);
        // Base affichée par défaut (implicite) : ne compte pas comme sélection configurable.
        if (display?.isBaseDefault && !display?.isExplicitSelection && ids.length === 1) {
            const onlyId = String(ids[0] || '').trim();
            const shownId = String(display?.option?.id || '').trim();
            if (onlyId && onlyId === shownId) return false;
        }
        return ids.some((id) => {
            const opt = resolvePickerCatalogOption(state, hooks, id);
            if (!opt) return false;
            return !isBaseCatalogOption(hooks, opt) && !isImportGeneratedBaseOption(opt);
        });
    }

    function shouldShowParcoursSlot(state, hooks, slot) {
        // Paramétrage / réordonnancement : toujours afficher la structure.
        if (isParametrageBaseMode(hooks) || isParcoursReorderTableMode(hooks)) return true;

        // Case nœud catalogue : forcer l’affichage même si vide / base seule.
        const forceShowEmpty = getModelBaseOptions()?.slotShowsEvenIfEmptyOrBaseOnly?.(slot) === true;

        // Configurateur : masquer si aucune option, ou uniquement option(s) de base.
        if (!forceShowEmpty
            && !slotHasConfigurableChoices(state, hooks, slot)
            && !slotHasNonBaseConfiguratorSelection(state, hooks, slot)) {
            return false;
        }

        if (hooks?.showAllParcoursSlots === true) return true;

        const group = hydrateGroupOptions(state, slotToGroup(slot));
        const isMulti = getModelBaseOptions()?.isMultiChoiceSlot?.(slot) === true
            || group.decisionMode === 'multi_choice';

        if (hooks?.hideUnselectedParcoursSlots === true) {
            if (isMulti) {
                return parcoursSelectedIds(state, slot, hooks).length > 0;
            }
            return !!getSingleChoiceDisplay(state, group, hooks)?.option;
        }

        if (slotHasConfiguratorSelections(state, hooks, slot)) return true;
        return parcoursSlotChoiceCount(state, slot, hooks) > 0;
    }

    function optionMatchesCatalogSlot(state, hooks, rawId, slot) {
        const id = String(rawId || '').trim();
        if (!id || !slot) return false;
        const categories = Array.isArray(state?.categories) ? state.categories : [];
        const map = buildOptionById(categories);
        const opt = map.get(id);
        if (!opt) return false;
        const mid = String(state?.selectedModel?.id || '').trim();
        if (mid) {
            const comp = Array.isArray(opt.compatibleModels) ? opt.compatibleModels.map(String) : [];
            if (comp.length && !comp.includes(mid)) return false;
        }
        const catalogNodeId = catalogNodeIdFromSlot(slot);
        if (catalogNodeId) {
            const catalogNodes = getCatalogNodesForParcours(hooks);
            const optCn = String(opt.catalogObjectId || '').trim();
            const MBO = getModelBaseOptions();
            if (MBO?.slotUsesDirectCatalogOptionsOnly?.(slot)) {
                return optCn === catalogNodeId;
            }
            const nodeIds = catalogNodeIdsWithDescendantsForParcours(catalogNodeId, catalogNodes);
            return !!(optCn && nodeIds.has(optCn));
        }
        const MBO = getModelBaseOptions();
        if (MBO?.optionMatchesSlot) return MBO.optionMatchesSlot(id, slot);
        return false;
    }

    function slotHasConfiguratorSelections(state, hooks, slot) {
        if (isParametrageBaseMode(hooks)) return false;
        for (const id of state.selectedOptions || []) {
            if (optionMatchesCatalogSlot(state, hooks, id, slot)) return true;
        }
        for (const id of state.fivePercentOptions || []) {
            if (optionMatchesCatalogSlot(state, hooks, id, slot)) return true;
        }
        return false;
    }

    /** Descendants par nœud — invalidé quand la référence catalogNodes change. */
    let _descendantsCache = null;

    function catalogNodeIdsWithDescendantsForParcours(catalogNodeId, catalogNodes) {
        const nid = String(catalogNodeId || '').trim();
        if (!nid) return new Set();
        if (!_descendantsCache || _descendantsCache.nodes !== catalogNodes) {
            _descendantsCache = { nodes: catalogNodes, byId: new Map() };
        }
        const cached = _descendantsCache.byId.get(nid);
        if (cached) return cached;
        const Core = global.UgapCatalogueNodesCore;
        const out = new Set([nid]);
        if (Core?.collectDescendantIds) {
            Core.collectDescendantIds(catalogNodes, nid).forEach((id) => {
                const did = String(id || '').trim();
                if (did) out.add(did);
            });
        }
        _descendantsCache.byId.set(nid, out);
        return out;
    }

    /** Ids déjà couverts par les lignes parcours (sans les orphelines). */
    function collectParcoursCoveredOptionIds(state, hooks) {
        const selCount = (state.selectedOptions?.size || 0) + (state.fivePercentOptions?.size || 0);
        const cacheKey = `${String(state?.selectedModel?.id || '')}|${selCount}|${state.selectedOptions?.size || 0}`;
        if (state._parcoursCoveredCacheKey === cacheKey && state._parcoursCoveredCache) {
            return state._parcoursCoveredCache;
        }
        const covered = new Set();
        if (!shouldUseTemplateTree(state)) return covered;
        syncModelBaseBridge(state);
        const tree = getModelBaseEditorTree(state);
        collectParcoursSlots(tree).forEach((slot) => {
            const group = slotToGroup(slot);
            parcoursSelectedIds(state, slot, hooks).forEach((id) => {
                const oid = String(id || '').trim();
                if (oid) covered.add(oid);
            });
            getLinkedAdjIdsForReplacedBaseInGroup(state, group, hooks).forEach((id) => {
                const oid = String(id || '').trim();
                if (oid) covered.add(oid);
            });
        });
        state._parcoursCoveredCache = covered;
        state._parcoursCoveredCacheKey = cacheKey;
        return covered;
    }

    /** Options cochées mais absentes des lignes parcours (ex. lien catalogue / slot incomplet). */
    function collectOrphanConfiguratorOptionIds(state, hooks) {
        const covered = collectParcoursCoveredOptionIds(state, hooks);
        const out = [];
        const seen = new Set();
        const mid = String(state?.selectedModel?.id || '').trim();
        const map = buildOptionById(Array.isArray(state?.categories) ? state.categories : []);
        const push = (rawId) => {
            const id = String(rawId || '').trim();
            if (!id || seen.has(id) || covered.has(id)) return;
            const opt = map.get(id);
            if (!opt) return;
            if (isFivePercentCatalogOption(hooks, opt)) return;
            // Sélection explicite hors parcours (ex. option rattachée directement à une
            // catégorie comme Transport) : on ne rejette que les incompatibilités avérées.
            if (mid) {
                const comp = Array.isArray(opt.compatibleModels) ? opt.compatibleModels.map(String) : [];
                if (comp.length && !comp.includes(mid)) return;
            }
            seen.add(id);
            out.push(id);
        };
        (state.selectedOptions || []).forEach(push);
        return out;
    }

    function appendOrphanConfiguratorOptionIds(state, hooks, visitor, { billableOnly = false } = {}) {
        if (typeof visitor !== 'function') return;
        collectOrphanConfiguratorOptionIds(state, hooks).forEach((id) => {
            if (billableOnly && !isParcoursBillableOptionId(state, hooks, id)) return;
            visitor(id);
        });
    }

    function collectUnclassifiedFivePercentSelections(state, hooks) {
        const categories = Array.isArray(state?.categories) ? state.categories : [];
        const map = buildOptionById(categories);
        const out = [];
        const isUnclassified = (opt) => {
            if (!opt || typeof opt !== 'object') return false;
            const cnId = String(opt.catalogObjectId || '').trim();
            if (cnId) return false;
            if (typeof hooks?.isFivePercentCatalogOption === 'function'
                && hooks.isFivePercentCatalogOption(opt)) {
                return true;
            }
            return false;
        };
        state.fivePercentOptions.forEach((optId) => {
            const id = String(optId || '').trim();
            if (!id) return;
            const opt = map.get(id);
            if (isUnclassified(opt)) out.push(id);
        });
        (Array.isArray(state.fivePercentCustomOptions) ? state.fivePercentCustomOptions : []).forEach((custom) => {
            if (!custom || custom.selected !== true) return;
            const hasGroup = String(custom.familyLabel || '').trim() && String(custom.groupId || '').trim();
            if (!hasGroup) out.push(String(custom.id || '').trim());
        });
        return out.filter(Boolean);
    }

    function buildUnclassifiedFivePercentRefCell(state, hooks) {
        const selectedIds = collectUnclassifiedFivePercentSelections(state, hooks);
        const sanitize = global.UgapRefDisplay?.sanitizeUgapRefForDisplay
            ? global.UgapRefDisplay.sanitizeUgapRefForDisplay.bind(global.UgapRefDisplay)
            : (ref) => String(ref || '').trim();
        const refs = selectedIds.map((id) => {
            const opt = findCatalogOption(state, hooks, id)
                || (Array.isArray(state.fivePercentCustomOptions)
                    ? state.fivePercentCustomOptions.find((o) => String(o?.id || '') === id)
                    : null);
            return sanitize(String(opt?.refUgap || opt?.baseRefUgap || '5%').trim());
        }).filter(Boolean);
        if (!refs.length) {
            return '<span class="ugap-devis-ref ugap-devis-ref--muted">—</span>';
        }
        return refs.map((ref) => `<span class="ugap-devis-ref">${escapeHtml(ref)}</span>`).join('');
    }

    function buildUnclassifiedFivePercentOptionCell(state, hooks) {
        const selectedIds = collectUnclassifiedFivePercentSelections(state, hooks);
        const labels = selectedIds.map((id) => {
            const opt = findCatalogOption(state, hooks, id)
                || (Array.isArray(state.fivePercentCustomOptions)
                    ? state.fivePercentCustomOptions.find((o) => String(o?.id || '') === id)
                    : null);
            return opt ? escapeHtml(String(opt.name || id).trim()) : escapeHtml(id);
        });
        const summary = labels.length
            ? `<span class="ugap-devis-pick-current">${labels.join(', ')}${fivePercentBadgeHtml(hooks)}</span>`
            : '<span class="ugap-devis-pick-placeholder">Ajouter une option 5% non classée</span>';
        return `
            <button type="button" class="ugap-devis-pick-btn ugap-five-pct-orphans-open" title="Options 5% hors parcours catalogue">
                <span class="ugap-devis-pick-label">${summary}</span>
                <span class="ugap-devis-pick-chevron" aria-hidden="true">›</span>
            </button>`;
    }

    function syncParcoursSelectionsFromMbo(state, hooks) {
        if (!isParametrageBaseMode(hooks)) return;
        state.selectedOptions = new Set();
        state.fivePercentOptions = new Set();
        const model = state.selectedModel;
        const mid = String(model?.id || '').trim();
        const MBO = getModelBaseOptions();
        if (!mid || !MBO?.getStatus) return;
        syncModelBaseBridge(state);
        (MBO.getStatus(model).slots || []).forEach((slot) => {
            (MBO.getAssignedOptionIds(mid, slot) || []).forEach((id) => {
                const oid = String(id || '').trim();
                if (oid) state.selectedOptions.add(oid);
            });
        });
    }

    function parcoursChoiceRows(state, slot, hooks) {
        syncModelBaseBridge(state);
        const model = state.selectedModel;
        const MBO = getModelBaseOptions();
        if (!MBO?.getChoiceRows || !model) return [];
        const baseOnly = isParametrageBaseMode(hooks);
        return MBO.getChoiceRows(model, slot, { baseOnly }) || [];
    }

    function parcoursSlotChoiceCount(state, slot, hooks) {
        return parcoursChoiceRows(state, slot, hooks).length;
    }

    function parcoursSelectedIds(state, slot, hooks) {
        if (isParametrageBaseMode(hooks)) {
            const MBO = getModelBaseOptions();
            const mid = String(state.selectedModel?.id || '').trim();
            if (!mid || !MBO?.getAssignedOptionIds) return [];
            syncModelBaseBridge(state);
            const allowed = new Set(
                parcoursChoiceRows(state, slot, hooks).map((r) => String(r?.id || '').trim()).filter(Boolean)
            );
            return MBO.getAssignedOptionIds(mid, slot)
                .map((x) => String(x || '').trim())
                .filter((id) => allowed.has(id));
        }
        const out = [];
        const seen = new Set();
        parcoursChoiceRows(state, slot, hooks).forEach((row) => {
            const id = String(row?.id || '').trim();
            if (!id || seen.has(id)) return;
            if (state.selectedOptions.has(id) || state.fivePercentOptions.has(id)) {
                seen.add(id);
                out.push(id);
            }
        });
        state.selectedOptions.forEach((optId) => {
            const id = String(optId || '').trim();
            if (!id || seen.has(id)) return;
            if (optionMatchesCatalogSlot(state, hooks, id, slot)) {
                seen.add(id);
                out.push(id);
            }
        });
        state.fivePercentOptions.forEach((optId) => {
            const id = String(optId || '').trim();
            if (!id || seen.has(id)) return;
            if (optionMatchesCatalogSlot(state, hooks, id, slot)) {
                seen.add(id);
                out.push(id);
            }
        });
        const group = slotToGroup(slot);
        const isMulti = getModelBaseOptions()?.isMultiChoiceSlot?.(slot) === true
            || group.decisionMode === 'multi_choice';
        if (!isMulti && !isDevisSlotUserCleared(state, group)) {
            const display = getSingleChoiceDisplay(state, group, hooks);
            const did = String(display?.option?.id || '').trim();
            if (did && !seen.has(did)) {
                seen.add(did);
                out.push(did);
            }
        }
        return out;
    }

    function clearSlotSelection(state, slot, exceptId, hooks) {
        parcoursChoiceRows(state, slot, hooks).forEach((row) => {
            const id = String(row?.id || '').trim();
            if (!id || (exceptId && id === exceptId)) return;
            state.selectedOptions.delete(id);
            state.fivePercentOptions.delete(id);
        });
    }

    function parcoursSlotPriceSum(state, slot, hooks) {
        let sum = 0;
        parcoursSelectedIds(state, slot, hooks).forEach((id) => {
            const opt = findCatalogOption(state, hooks, id);
            if (!opt || isImportGeneratedBaseOption(opt)) return;
            if (isFivePercentCatalogOption(hooks, opt)) return;
            if (typeof hooks?.isBaseCatalogOption === 'function' && hooks.isBaseCatalogOption(opt)) return;
            sum += catalogUgapPrice(opt);
        });
        return sum;
    }

    function isOptionIncludedInDevis(hooks, opt) {
        if (!opt) return true;
        if (isImportGeneratedBaseOption(opt)) return true;
        if (typeof hooks?.isBaseCatalogOption === 'function' && hooks.isBaseCatalogOption(opt)) return true;
        return false;
    }

    function formatDevisOptionPrice(state, hooks, opt) {
        if (!opt) {
            return { text: '—', included: false };
        }
        if (isOptionIncludedInDevis(hooks, opt)) {
            // Option de base : comprise dans le prix du modèle, on n'affiche jamais de montant.
            return { text: 'Inclus', included: true };
        }
        const raw = catalogUgapPrice(opt);
        return { text: `${raw.toFixed(2)} €`, included: false };
    }

    function forEachParcoursSingleChoiceGroup(state, hooks, visitor) {
        if (typeof visitor !== 'function') return;
        syncModelBaseBridge(state);
        collectParcoursSlots(getModelBaseEditorTree(state)).forEach((slot) => {
            const group = hydrateGroupOptions(state, slotToGroup(slot));
            if (group.decisionMode === 'multi_choice') return;
            visitor(group, slot);
        });
    }

    function formatLinkedMotorAdjDevisPrice(state, hooks, adj) {
        if (!adj) return { text: '—', included: false };
        if (typeof hooks?.getOptionBillablePrice === 'function') {
            const billable = hooks.getOptionBillablePrice(adj);
            return { text: `${billable.toFixed(2)} €`, included: false };
        }
        const raw = catalogUgapPrice(adj);
        const OLK = global.UgapOptionLineKind;
        const isMino = String(OLK?.inferOptionLineKind?.(adj) || '').trim().toLowerCase() === 'minoration';
        const amount = isMino ? -Math.abs(raw) : raw;
        return { text: `${amount.toFixed(2)} €`, included: false };
    }

    function collectParcoursSlots(tree) {
        const list = [];
        const walk = (node) => {
            (Array.isArray(node?.slots) ? node.slots : []).forEach((s) => list.push(s));
            (Array.isArray(node?.children) ? node.children : []).forEach(walk);
        };
        (Array.isArray(tree?.roots) ? tree.roots : []).forEach(walk);
        (Array.isArray(tree?.orphanSlots) ? tree.orphanSlots : []).forEach((s) => list.push(s));
        return list;
    }

    function isParcoursBillableOptionId(state, hooks, rawId) {
        const id = String(rawId || '').trim();
        if (!id) return false;
        const opt = findCatalogOption(state, hooks, id);
        if (!opt) return false;
        if (isFivePercentCatalogOption(hooks, opt)) return false;
        if (typeof hooks?.isBaseCatalogOption === 'function' && hooks.isBaseCatalogOption(opt)) return false;
        return true;
    }

    function visitParcoursBillableOptionIds(state, hooks, visitor) {
        if (!shouldUseTemplateTree(state) || typeof visitor !== 'function') return;
        syncModelBaseBridge(state);
        const tree = getModelBaseEditorTree(state);
        collectParcoursSlots(tree).forEach((slot) => {
            const group = slotToGroup(slot);
            const visitBillableId = (rawId) => {
                if (!isParcoursBillableOptionId(state, hooks, rawId)) return;
                visitor(String(rawId || '').trim());
            };
            parcoursSelectedIds(state, slot, hooks).forEach(visitBillableId);
            getLinkedAdjIdsForReplacedBaseInGroup(state, group, hooks).forEach(visitBillableId);
        });
        appendOrphanConfiguratorOptionIds(state, hooks, visitor, { billableOnly: true });
    }

    /** Ordre parcours : choix puis mino/majo liée juste en dessous. */
    function collectParcoursOrderedBillableOptionIds(state, hooks) {
        const out = [];
        const seen = new Set();
        visitParcoursBillableOptionIds(state, hooks, (id) => {
            if (!id || seen.has(id)) return;
            seen.add(id);
            out.push(id);
        });
        return out;
    }

    function visitParcoursDisplayOptionIds(state, hooks, visitor) {
        if (!shouldUseTemplateTree(state) || typeof visitor !== 'function') return;
        syncModelBaseBridge(state);
        const tree = getModelBaseEditorTree(state);
        collectParcoursSlots(tree).forEach((slot) => {
            const group = hydrateGroupOptions(state, slotToGroup(slot));
            const visitId = (rawId) => {
                const id = String(rawId || '').trim();
                if (id) visitor(id);
            };
            parcoursSelectedIds(state, slot, hooks).forEach(visitId);
            getLinkedAdjIdsForReplacedBaseInGroup(state, group, hooks).forEach(visitId);
        });
        appendOrphanConfiguratorOptionIds(state, hooks, (rawId) => {
            const id = String(rawId || '').trim();
            if (id) visitor(id);
        });
    }

    /** Ordre PDF / devis détaillé : option puis lignes liées (mino/majo) du même groupe. */
    function collectParcoursOrderedDisplayOptionIds(state, hooks) {
        const out = [];
        const seen = new Set();
        visitParcoursDisplayOptionIds(state, hooks, (id) => {
            if (!id || seen.has(id)) return;
            seen.add(id);
            out.push(id);
        });
        return out;
    }

    function collectDevisOptionCategoryMap(state, hooks) {
        const map = {};
        const assign = (optId, rowDef) => {
            const id = String(optId || '').trim();
            if (!id) return;
            const categorie = String(rowDef?.categorie || '').trim();
            if (!categorie || categorie === '—' || categorie === 'Options non classées') return;
            map[id] = {
                categorie,
                sousNoeud: String(rowDef?.sousNoeud || '').trim()
            };
        };
        if (!shouldUseTemplateTree(state)) return map;
        syncModelBaseBridge(state);
        const tree = getModelBaseEditorTree(state);
        const catalogNodes = getCatalogNodesForParcours(hooks);
        collectDevisTableRowDefs(state, hooks, tree, catalogNodes).forEach((row) => {
            if (!row?.group) return;
            if (row.mode === 'multi_line' && row.optId) {
                assign(row.optId, row);
                return;
            }
            if (row.mode !== 'single') return;
            const display = getSingleChoiceDisplay(state, row.group, hooks);
            assign(display?.option?.id, row);
            getLinkedAdjIdsForReplacedBaseInGroup(state, row.group, hooks).forEach((adjId) => assign(adjId, row));
        });
        return map;
    }

    function collectDevisModelCategory(state, hooks) {
        if (!shouldUseTemplateTree(state)) return '';
        syncModelBaseBridge(state);
        const tree = getModelBaseEditorTree(state);
        const catalogNodes = getCatalogNodesForParcours(hooks);
        const roots = Array.isArray(tree?.roots) ? tree.roots : [];
        if (roots.length) {
            const first = roots[0];
            const cnId = String(first?.catalogNodeId || first?.nodeId || '').trim();
            if (cnId) {
                const { categorie } = catalogNodeCategoryLabels(catalogNodes, cnId, {});
                if (categorie && categorie !== '—') return categorie;
            }
        }
        const Core = global.UgapCatalogueNodesCore;
        const rootNodes = Core?.getRootNodes?.(catalogNodes) || [];
        return String(rootNodes[0]?.label || '').trim();
    }

    function appendParcoursBillableOptionIds(state, hooks, targetSet) {
        if (!targetSet || typeof targetSet.add !== 'function') return;
        visitParcoursBillableOptionIds(state, hooks, (id) => {
            if (id) targetSet.add(id);
        });
    }

    function applyDefaultSelectionsForParcours(state, hooks) {
        if (isParametrageBaseMode(hooks) || isParcoursReadOnly(hooks)) return;
        if (hooks?.skipParcoursDefaultSelections) return;
        syncModelBaseBridge(state);
        collectParcoursSlots(getModelBaseEditorTree(state)).forEach((slot) => {
            if (parcoursSlotChoiceCount(state, slot, hooks) <= 0) return;
            // Pas besoin d'hydrater tout le catalogue pour appliquer les picks par défaut.
            const g = slotToGroup(slot);
            if (g.decisionMode === 'multi_choice') {
                ensureMultiChoiceGroupDefault(state, g, hooks);
            } else {
                ensureSingleChoiceGroupDefault(state, g, hooks);
            }
        });
    }

    function forEachParcoursDecisionGroup(state, hooks, visitor) {
        if (typeof visitor !== 'function') return;
        syncModelBaseBridge(state);
        collectParcoursSlots(getModelBaseEditorTree(state)).forEach((slot) => {
            visitor(slotToGroup(slot), slot);
        });
    }

    function getCatalogNodesForParcours(hooks) {
        if (hooks && typeof hooks.resolveCatalogNodes === 'function') {
            const nodes = hooks.resolveCatalogNodes();
            if (Array.isArray(nodes) && nodes.length) return nodes;
        }
        return getModelBaseOptions()?.getCatalogNodesForRuntime?.() || [];
    }

    function catalogNodeIdFromSlot(slot) {
        const s = slot && typeof slot === 'object' ? slot : {};
        const direct = String(s.catalogNodeId || '').trim();
        if (direct) return direct;
        const gid = String(s.groupId || '').trim();
        return gid.startsWith('cn_') ? gid.slice(3) : '';
    }

    /** Chemin catalogue racine → feuille (une entrée par niveau de nœud). */
    function catalogNodePathLabels(catalogNodes, catalogNodeId, slot) {
        const cnId = String(catalogNodeId || '').trim();
        const poste = String(slot?.groupLabel || slot?.groupId || '').trim();
        if (!cnId) {
            const nodePath = poste ? ['—', poste] : ['—'];
            return { nodePath };
        }
        const Core = global.UgapCatalogueNodesCore;
        const chain = [];
        let cur = Core?.getNodeById?.(catalogNodes, cnId);
        let guard = 0;
        while (cur && guard < 32) {
            chain.unshift(cur);
            cur = cur.parentId ? Core.getNodeById(catalogNodes, cur.parentId) : null;
            guard += 1;
        }
        if (!chain.length) {
            const nodePath = poste ? [cnId, poste] : [cnId];
            return { nodePath };
        }
        const nodePath = chain
            .map((n) => String(n.label || n.id || '').trim())
            .filter(Boolean);
        if (nodePath.length === 1 && poste) {
            nodePath.push(poste);
        }
        if (!nodePath.length) nodePath.push('—');
        return { nodePath };
    }

    /** Col. 1 = catégorie racine catalogue, col. 2+ = niveaux enfants (ou poste sur racine). */
    function catalogNodeCategoryLabels(catalogNodes, catalogNodeId, slot) {
        const { nodePath } = catalogNodePathLabels(catalogNodes, catalogNodeId, slot);
        return {
            nodePath,
            categorie: nodePath[0] || '—',
            sousNoeud: nodePath.slice(1).join(' › ') || '—',
        };
    }

    function slotTableColumnLabels(slot, catalogNodes) {
        const cnId = catalogNodeIdFromSlot(slot);
        if (cnId) {
            return catalogNodeCategoryLabels(catalogNodes, cnId, slot);
        }
        const fallback = String(
            slot?.catalogNodeLabel || slot?.groupLabel || slot?.familyLabel || ''
        ).trim() || '—';
        return { categorie: 'Autres', sousNoeud: fallback, nodePath: ['Autres', fallback] };
    }

    function devisPickerModalTitle(slot, catalogNodes, fallbackLabel, suffix) {
        const { categorie, sousNoeud } = slotTableColumnLabels(slot, catalogNodes);
        const tail = suffix ? ` ${suffix}` : '';
        if (sousNoeud && sousNoeud !== '—') {
            return `${categorie} — ${sousNoeud}${tail}`;
        }
        return `${categorie || fallbackLabel || 'Choix'}${tail}`;
    }

    function catalogNodeParentId(catalogNodes, catalogNodeId) {
        const cnId = String(catalogNodeId || '').trim();
        if (!cnId) return '';
        const Core = global.UgapCatalogueNodesCore;
        const node = Core?.getNodeById?.(catalogNodes, cnId);
        return String(node?.parentId || '').trim();
    }

    /** Profondeur catalogue (0 = racine) depuis l’id nœud. */
    function catalogNodeDepth(catalogNodes, catalogNodeId) {
        const cnId = String(catalogNodeId || '').trim();
        if (!cnId) return 0;
        const Core = global.UgapCatalogueNodesCore;
        let depth = 0;
        let cur = Core?.getNodeById?.(catalogNodes, cnId);
        let guard = 0;
        while (cur?.parentId && guard < 32) {
            const parent = Core.getNodeById?.(catalogNodes, cur.parentId);
            if (!parent) break;
            depth += 1;
            cur = parent;
            guard += 1;
        }
        return depth;
    }

    function orderedCatalogSiblingIdsForReorder(parentId, catalogNodes, orderMap) {
        const MBO = getModelBaseOptions();
        const BTree = global.UgapBoatTemplateTree;
        if (MBO?.getOrderedCatalogSiblingIds) {
            return MBO.getOrderedCatalogSiblingIds(parentId, catalogNodes, orderMap);
        }
        if (BTree?.orderedCatalogSiblingIds) {
            return BTree.orderedCatalogSiblingIds(parentId, catalogNodes, orderMap);
        }
        const Core = global.UgapCatalogueNodesCore;
        return (Core?.getChildren?.(catalogNodes, parentId) || [])
            .map((n) => String(n.id || '').trim())
            .filter(Boolean);
    }

    /**
     * Ordre parcours sous une catégorie : [self, enfant1, enfant2…] stocké dans catalogNodeOrder[cnId].
     */
    function getParcoursMixedSiblingIds(catalogNodeId, catalogNodes, orderMap) {
        const id = String(catalogNodeId || '').trim();
        if (!id) return [];
        const childIds = orderedCatalogSiblingIdsForReorder(id, catalogNodes, orderMap);
        if (!childIds.length) return [id];
        const order = orderMap && typeof orderMap === 'object' ? orderMap : {};
        const stored = Array.isArray(order[id]) ? order[id].map((x) => String(x || '').trim()).filter(Boolean) : [];
        const valid = new Set([id, ...childIds]);
        const out = [];
        if (stored.length) {
            stored.forEach((sid) => {
                if (valid.has(sid) && !out.includes(sid)) out.push(sid);
            });
            childIds.forEach((cid) => {
                if (!out.includes(cid)) out.push(cid);
            });
            if (!out.includes(id)) out.push(id);
            return out;
        }
        out.push(id);
        childIds.forEach((cid) => {
            if (!out.includes(cid)) out.push(cid);
        });
        return out;
    }

    /**
     * Frères réordonnables sous un parent P.
     * P === '' → catégories racines ; sinon → [P implicite, enfant1, enfant2…]
     */
    function getParcoursOrderedSiblings(parentCatalogNodeId, catalogNodes, orderMap) {
        const pid = String(parentCatalogNodeId ?? '').trim();
        if (!pid) {
            return orderedCatalogSiblingIdsForReorder('', catalogNodes, orderMap);
        }
        return getParcoursMixedSiblingIds(pid, catalogNodes, orderMap);
    }

    /** @deprecated alias */
    function getReorderSiblingList(groupParentId, catalogNodes, orderMap) {
        return getParcoursOrderedSiblings(groupParentId, catalogNodes, orderMap);
    }

    function makeReorderHandle(parentId, siblingId, catalogNodes, orderMap, extra) {
        const pid = String(parentId ?? '');
        const sid = String(siblingId || '').trim();
        const list = getParcoursOrderedSiblings(pid, catalogNodes, orderMap);
        const base = extra && typeof extra === 'object' ? extra : {};
        return {
            ...base,
            catalogNodeId: sid,
            parentCatalogNodeId: pid,
            hasReorderSiblings: list.length > 1 && list.includes(sid),
        };
    }

    function resolveReorderDragMeta(rowDef, column, catalogNodes, orderMap) {
        const base = {
            reorderDirectOptionCount: Number(rowDef?.reorderDirectOptionCount) || 0,
            reorderHasChildren: rowDef?.reorderHasChildren === true,
            reorderSubtreeSize: Number(rowDef?.reorderSubtreeSize) || 0,
        };
        const slot = rowDef?.reorderHandles?.[column];
        if (!slot) {
            return { ...base, catalogNodeId: '', parentCatalogNodeId: '', hasReorderSiblings: false };
        }
        return makeReorderHandle(slot.parentId, slot.siblingId, catalogNodes, orderMap, base);
    }

    function getReorderContextFromHooks(state, hooks) {
        const MBO = getModelBaseOptions();
        const model = state?.selectedModel;
        const templateId = String(model?.boatTemplateId || '').trim();
        const tpl = typeof hooks?.resolveBoatTemplate === 'function'
            ? hooks.resolveBoatTemplate(state)
            : MBO?.getTemplateById?.(templateId);
        const catalogNodes = getCatalogNodesForParcours(hooks);
        const order = tpl ? (MBO?.getTemplateCatalogParcours?.(tpl) || {}).order || {} : {};
        return { catalogNodes, orderMap: order };
    }

    function countCatalogDescendants(catalogNodeId, catalogNodes, orderMap) {
        let count = 0;
        const visit = (cnId) => {
            orderedCatalogSiblingIdsForReorder(cnId, catalogNodes, orderMap).forEach((childId) => {
                count += 1;
                visit(childId);
            });
        };
        visit(String(catalogNodeId || '').trim());
        return count;
    }

    function countCatalogNodeDirectOptions(catalogNodeId, catalogNodes) {
        const id = String(catalogNodeId || '').trim();
        if (!id) return 0;
        const MBO = getModelBaseOptions();
        if (MBO?.collectDirectOptionIdsFromCatalog) {
            return MBO.collectDirectOptionIdsFromCatalog(id).length;
        }
        const St = global.UgapCatalogueLcState;
        if (St?.getOptionsForNode) {
            return (St.getOptionsForNode(id, catalogNodes) || []).length;
        }
        return 0;
    }

    function findReorderRowByCatalogId(mountEl, catalogNodeId) {
        const id = String(catalogNodeId || '').trim();
        if (!mountEl || !id) return null;
        const rows = mountEl.querySelectorAll('tr[data-tpl-reorder-item]');
        for (let i = 0; i < rows.length; i += 1) {
            if (String(rows[i].getAttribute('data-tpl-reorder-item') || '').trim() === id) {
                return rows[i];
            }
        }
        return null;
    }

    /** Bloc contigu DFS : le nœud + tous ses descendants rendus juste en dessous. */
    function getReorderSubtreeRows(mountEl, startRow) {
        if (!mountEl || !startRow) return [];
        const rows = Array.from(mountEl.querySelectorAll('tr[data-tpl-reorder-item]'));
        const startIdx = rows.indexOf(startRow);
        if (startIdx < 0) return [startRow];
        const depth = Number(startRow.getAttribute('data-tpl-reorder-depth') || 0);
        const block = [startRow];
        for (let i = startIdx + 1; i < rows.length; i += 1) {
            const rowDepth = Number(rows[i].getAttribute('data-tpl-reorder-depth') || 0);
            if (rowDepth <= depth) break;
            block.push(rows[i]);
        }
        return block;
    }

    /** Sous-arbre d’un nœud catalogue (y compris L1 sans ligne propre). */
    function getReorderSubtreeRowsForNodeId(mountEl, nodeId, groupParentId, catalogNodes, orderMap) {
        return findReorderBlockRows(mountEl, nodeId, groupParentId, catalogNodes, orderMap);
    }

    function resolveReorderParentIdForNode(mountEl, nodeId) {
        const id = String(nodeId || '').trim();
        if (!id || !mountEl) return '';
        const row = findReorderRowByCatalogId(mountEl, id);
        if (row) return String(row.getAttribute('data-tpl-reorder-parent') ?? '');

        const childRow = Array.from(mountEl.querySelectorAll('tr[data-tpl-reorder-l1-id]')).find(
            (el) => String(el.getAttribute('data-tpl-reorder-l1-id') || '').trim() === id
        );
        if (childRow) return String(childRow.getAttribute('data-tpl-reorder-l1-parent') ?? '');

        return '';
    }

    function findReorderSiblingRow(mountEl, row, targetParentId) {
        let cur = row;
        let guard = 0;
        const pid = String(targetParentId ?? '');
        while (cur && guard < 64) {
            const parent = String(cur.getAttribute('data-tpl-reorder-parent') ?? '');
            if (parent === pid) return cur;
            const parentNodeId = parent;
            if (!parentNodeId) return null;
            cur = findReorderRowByCatalogId(mountEl, parentNodeId);
            guard += 1;
        }
        return null;
    }

    function resolveReorderDropRow(mountEl, row, targetParentId) {
        if (!row) return null;
        const pid = String(targetParentId ?? '');
        const direct = String(row.getAttribute('data-tpl-reorder-parent') ?? '');
        if (direct === pid) return row;
        const l1Parent = String(row.getAttribute('data-tpl-reorder-l1-parent') ?? '');
        if (l1Parent === pid) return row;
        const rowItemId = String(row.getAttribute('data-tpl-reorder-item') || '').trim();
        if (row.getAttribute('data-tpl-reorder-among-children') === '1' && rowItemId === pid) return row;
        return findReorderSiblingRow(mountEl, row, pid);
    }

    function isReorderSiblingTargetRow(fromId, groupParentId, row, catalogNodes, orderMap) {
        const fid = String(fromId || '').trim();
        if (!fid || !row) return false;
        const list = getParcoursOrderedSiblings(groupParentId, catalogNodes, orderMap);
        if (!list.includes(fid)) return false;
        const dropId = resolveReorderDropTargetId(row, groupParentId, catalogNodes, orderMap);
        return !!(dropId && dropId !== fid && list.includes(dropId));
    }

    function resolveReorderDropTargetId(row, groupParentId, catalogNodes, orderMap) {
        const pid = String(groupParentId ?? '').trim();
        const list = getParcoursOrderedSiblings(pid, catalogNodes, orderMap);
        const listSet = new Set(list);
        if (!pid) {
            const root = String(row?.getAttribute?.('data-tpl-reorder-root-cat') || '').trim();
            return root && listSet.has(root) ? root : '';
        }
        const rowId = String(row?.getAttribute?.('data-tpl-reorder-item') || '').trim();
        if (!rowId) return '';
        if (listSet.has(rowId)) return rowId;
        let cur = rowId;
        let guard = 0;
        while (cur && guard < 64) {
            if (listSet.has(cur)) return cur;
            const parent = catalogNodeParentId(catalogNodes, cur);
            if (!parent || parent === pid) break;
            cur = parent;
            guard += 1;
        }
        return '';
    }

    function findReorderBlockRows(mountEl, fromId, groupParentId, catalogNodes, orderMap) {
        const id = String(fromId || '').trim();
        const pid = String(groupParentId ?? '').trim();
        if (!id || !mountEl) return [];
        const rows = Array.from(mountEl.querySelectorAll('tr[data-tpl-reorder-item]'));
        if (!pid) {
            return rows.filter((row) => String(row.getAttribute('data-tpl-reorder-root-cat') || '').trim() === id);
        }
        const blocks = [];
        let block = [];
        rows.forEach((row) => {
            const dropKey = resolveReorderDropTargetId(row, pid, catalogNodes, orderMap);
            if (dropKey === id) {
                block.push(row);
            } else if (block.length) {
                blocks.push(block);
                block = [];
            }
        });
        if (block.length) blocks.push(block);
        const directRow = rows.find((row) => String(row.getAttribute('data-tpl-reorder-item') || '').trim() === id);
        for (let i = 0; i < blocks.length; i += 1) {
            if (directRow && blocks[i].includes(directRow)) return blocks[i];
        }
        if (blocks.length === 1) return blocks[0];
        if (directRow) return [directRow];
        return [];
    }

    /** Id du nœud catalogue à profondeur `targetDepth` (0 = racine affichée). */
    function catalogAncestorIdAtDepth(catalogNodes, catalogNodeId, targetDepth) {
        let cur = String(catalogNodeId || '').trim();
        if (!cur) return '';
        let depth = catalogNodeDepth(catalogNodes, cur);
        while (depth > targetDepth && cur) {
            cur = catalogNodeParentId(catalogNodes, cur);
            depth -= 1;
        }
        return depth === targetDepth ? cur : '';
    }

    /** Lignes du tableau réordonnancement — une boucle récursive, même règle à tous les niveaux. */
    function collectParcoursReorderNodeRows(catalogNodes, orderMap) {
        const rows = [];
        let prevParent = null;
        let prevDepth = -1;

        const catalogChildren = (cnId) => orderedCatalogSiblingIdsForReorder(cnId, catalogNodes, orderMap);

        const buildReorderHandles = (entryId, listParentId, rootCatId, opts) => {
            const id = String(entryId || '').trim();
            const root = String(rootCatId || '').trim();
            const listPid = String(listParentId ?? '').trim();
            const handles = {};
            if (root) {
                handles.cat = { parentId: '', siblingId: root };
            }
            const mixedUnderRoot = root && getParcoursOrderedSiblings(root, catalogNodes, orderMap);
            if (mixedUnderRoot && mixedUnderRoot.includes(id)) {
                handles.n2 = { parentId: root, siblingId: id };
            }
            if (listPid && listPid !== root && getParcoursOrderedSiblings(listPid, catalogNodes, orderMap).includes(id)) {
                handles.leaf = { parentId: listPid, siblingId: id };
            }
            if (opts?.implicitSelf === true && listPid === id) {
                if (root && root !== id && mixedUnderRoot && mixedUnderRoot.includes(id)) {
                    handles.n2 = { parentId: root, siblingId: id };
                }
                handles.leaf = { parentId: listPid, siblingId: id };
            }
            if (opts?.implicitSelf === true && listPid === root && id === root) {
                handles.n2 = { parentId: root, siblingId: id };
                delete handles.leaf;
            }
            return handles;
        };

        const pushReorderRow = (entryId, depth, listParentId, rootCatId, opts) => {
            const id = String(entryId || '').trim();
            if (!id) return;
            const parentId = catalogNodeParentId(catalogNodes, id);
            const childIds = catalogChildren(id);
            const Core = global.UgapCatalogueNodesCore;
            const cn = Core?.getNodeById?.(catalogNodes, id);
            const nodeLabel = String(cn?.label || id).trim();
            const { nodePath } = catalogNodePathLabels(catalogNodes, id, {});
            const categorie = nodePath[0] || '—';
            const root = String(rootCatId || (depth === 0 ? id : catalogAncestorIdAtDepth(catalogNodes, id, 0)) || '').trim();
            const groupStart = opts?.groupStart === true
                || (prevParent !== null && (parentId !== prevParent || depth < prevDepth));
            prevParent = parentId;
            prevDepth = depth;

            const implicitSelf = opts?.implicitSelf === true;
            const amongInCol2 = implicitSelf && String(listParentId ?? '') === root;
            const amongInCol3 = implicitSelf && String(listParentId ?? '') !== root;

            rows.push({
                catalogNodeId: id,
                parentCatalogNodeId: parentId,
                reorderListParentId: String(listParentId ?? '').trim(),
                reorderRootCatId: root,
                reorderHandles: buildReorderHandles(id, listParentId, root, opts),
                reorderAmongChildren: implicitSelf,
                reorderAmongInCol3: amongInCol3,
                reorderAmongInCol2: amongInCol2,
                reorderSubcategoryCol2Anchor: opts?.subcategoryCol2Anchor === true,
                reorderSubcategoryBlockId: String(
                    opts?.subcategoryBlockId
                    || (depth >= 2 ? catalogAncestorIdAtDepth(catalogNodes, id, 1) : (depth === 1 ? id : ''))
                    || ''
                ).trim(),
                reorderDepth: depth,
                catalogDepth: depth,
                reorderAnchor: true,
                reorderGroupStart: groupStart,
                reorderHasChildren: childIds.length > 0,
                reorderSubtreeSize: countCatalogDescendants(id, catalogNodes, orderMap),
                reorderNodeLabel: nodeLabel,
                reorderDirectOptionCount: countCatalogNodeDirectOptions(id, catalogNodes),
                categorie,
                sousNoeud: depth === 0 ? nodeLabel : nodePath.slice(1).join(' › ') || nodeLabel,
                nodePath,
                mode: 'reorder_node',
            });
        };

        const visitContainer = (containerId, depth, listParentId, rootCatId, opts) => {
            const cid = String(containerId || '').trim();
            if (!cid) return;
            const root = String(rootCatId || (depth === 0 ? cid : catalogAncestorIdAtDepth(catalogNodes, cid, 0)) || '').trim();
            const siblings = getParcoursOrderedSiblings(cid, catalogNodes, orderMap);
            let firstEntry = true;
            siblings.forEach((entryId) => {
                const eid = String(entryId || '').trim();
                if (!eid) return;
                const entryOpts = { ...(opts || {}), groupStart: firstEntry === true };
                firstEntry = false;
                if (eid === cid) {
                    if (!catalogChildren(cid).length) return;
                    pushReorderRow(eid, depth, cid, root, {
                        ...entryOpts,
                        implicitSelf: true,
                        subcategoryCol2Anchor: depth === 1,
                        subcategoryBlockId: depth >= 1
                            ? catalogAncestorIdAtDepth(catalogNodes, eid, 1)
                            : '',
                    });
                    return;
                }
                const kids = catalogChildren(eid);
                if (kids.length > 0) {
                    visitContainer(eid, depth + 1, eid, root, { groupStart: false });
                } else {
                    pushReorderRow(eid, depth + 1, cid, root, {
                        ...entryOpts,
                        subcategoryBlockId: depth >= 1
                            ? catalogAncestorIdAtDepth(catalogNodes, eid, 1)
                            : eid,
                    });
                }
            });
        };

        const rootIds = getParcoursOrderedSiblings('', catalogNodes, orderMap);
        if (!rootIds.length) {
            const Core = global.UgapCatalogueNodesCore;
            (Core?.getRootNodes?.(catalogNodes) || [])
                .map((n) => String(n.id || '').trim())
                .filter(Boolean)
                .forEach((id) => {
                    if (catalogChildren(id).length > 0) {
                        visitContainer(id, 0, id, id, { groupStart: true });
                    } else {
                        pushReorderRow(id, 0, '', id, { groupStart: true });
                    }
                });
        } else {
            rootIds.forEach((rootId) => {
                const id = String(rootId || '').trim();
                if (!id) return;
                if (catalogChildren(id).length > 0) {
                    visitContainer(id, 0, id, id, { groupStart: true });
                } else {
                    pushReorderRow(id, 0, '', id, { groupStart: true });
                }
            });
        }
        return applyReorderParcoursTableRowspans(filterReorderDisplayRows(rows));
    }

    function getCatalogNodeLabelForReorder(catalogNodes, catalogNodeId) {
        const id = String(catalogNodeId || '').trim();
        if (!id) return '';
        const Core = global.UgapCatalogueNodesCore;
        return String(Core?.getNodeById?.(catalogNodes, id)?.label || id).trim();
    }

    function reorderTreeHasSiblings(parentId, siblingId, catalogNodes, orderMap) {
        const list = getParcoursOrderedSiblings(parentId, catalogNodes, orderMap);
        const sid = resolveReorderItemId(siblingId);
        return list.length > 1 && list.includes(sid);
    }

    function buildReorderTreeHandleHtml(parentId, fromId, catalogNodes, orderMap, dragTitle) {
        const sid = String(fromId || '').trim();
        if (!sid || !reorderTreeHasSiblings(parentId, sid, catalogNodes, orderMap)) {
            return '<span class="ugap-tpl-reorder-spacer" aria-hidden="true"></span>';
        }
        const title = String(dragTitle || 'Glisser pour réordonner').trim();
        return `<span class="ugap-reorder-dnd-handle" draggable="true" title="${escapeHtml(title)}">⋮⋮</span>`;
    }

    const IMPLICIT_REORDER_PREFIX = '__implicit__:';

    function implicitReorderItemId(catalogNodeId) {
        const id = String(catalogNodeId || '').trim();
        return id ? `${IMPLICIT_REORDER_PREFIX}${id}` : '';
    }

    function resolveReorderItemId(raw) {
        const id = String(raw || '').trim();
        if (id.startsWith(IMPLICIT_REORDER_PREFIX)) {
            return id.slice(IMPLICIT_REORDER_PREFIX.length);
        }
        return id;
    }

    function buildReorderTreeImplicitSlotHtml(parentId, catalogNodes, orderMap) {
        const pid = String(parentId || '').trim();
        if (!pid) return '';
        const itemKey = implicitReorderItemId(pid);
        const optCount = countCatalogNodeDirectOptions(pid, catalogNodes);
        const badge = optCount > 0
            ? `<span class="ugap-tpl-reorder-group-badge ugap-tpl-reorder-group-badge--options">${optCount} option${optCount > 1 ? 's' : ''}</span>`
            : '<span class="ugap-tpl-reorder-group-badge ugap-tpl-reorder-group-badge--options">0 option</span>';
        const handle = buildReorderTreeHandleHtml(
            pid,
            itemKey,
            catalogNodes,
            orderMap,
            getReorderLabel('implicitSlotDragTitle', 'Réordonner parmi les éléments de ce niveau')
        );
        const hint = getReorderLabel('implicitDirectOptionsHint', '');
        const hintAttr = hint ? ` title="${escapeHtml(hint)}"` : '';
        return `
        <div class="ugap-reorder-slot ugap-reorder-slot--implicit" data-reorder-item="${escapeHtml(itemKey)}" data-reorder-implicit-for="${escapeHtml(pid)}">
            <div class="ugap-reorder-slot__body"${hintAttr}>
                ${handle}
                <span class="ugap-reorder-slot__label">${escapeHtml(getReorderImplicitSlotLabel())}</span>
                ${badge}
            </div>
        </div>`;
    }

    function buildReorderTreeZoneHtml(parentId, parentDepth, rootCatId, catalogNodes, orderMap) {
        const pid = String(parentId || '').trim();
        if (!pid) return '';
        const siblings = getParcoursOrderedSiblings(pid, catalogNodes, orderMap);
        const catalogChildrenFn = (cnId) => orderedCatalogSiblingIdsForReorder(cnId, catalogNodes, orderMap);
        const childDepth = parentDepth + 1;
        const root = String(rootCatId || '').trim();
        let html = '';
        siblings.forEach((entryId) => {
            const eid = String(entryId || '').trim();
            if (!eid) return;
            if (eid === pid) {
                if (!catalogChildrenFn(pid).length) return;
                html += buildReorderTreeImplicitSlotHtml(pid, catalogNodes, orderMap);
                return;
            }
            const kids = catalogChildrenFn(eid);
            if (kids.length > 0) {
                html += buildReorderTreeContainerNodeHtml(eid, pid, childDepth, root, catalogNodes, orderMap);
            } else {
                html += buildReorderTreeLeafNodeHtml(eid, pid, childDepth, catalogNodes, orderMap);
            }
        });
        if (!html) return '';
        const zoneClass = parentDepth <= 0
            ? 'ugap-reorder-zone ugap-reorder-zone--subcategory'
            : 'ugap-reorder-zone ugap-reorder-zone--subnode';
        const listAttr = ` data-reorder-list data-reorder-parent-id="${escapeHtml(pid)}"`;
        return `<div class="${zoneClass}"${listAttr}>${html}</div>`;
    }

    function buildReorderTreeLeafNodeHtml(nodeId, siblingParentId, depth, catalogNodes, orderMap) {
        const id = String(nodeId || '').trim();
        const pid = String(siblingParentId ?? '').trim();
        if (!id) return '';
        const label = getCatalogNodeLabelForReorder(catalogNodes, id);
        const optCount = countCatalogNodeDirectOptions(id, catalogNodes);
        const badge = optCount > 0
            ? `<span class="ugap-tpl-reorder-group-badge ugap-tpl-reorder-group-badge--options">${optCount} option${optCount !== 1 ? 's' : ''}</span>`
            : '';
        const isSubnode = depth >= 2;
        const nodeKindClass = isSubnode ? ' ugap-reorder-node--subnode' : ' ugap-reorder-node--subcategory-leaf';
        const dragTitle = isSubnode
            ? getReorderLabel('subnodeDragTitle', 'Réordonner les sous-nœuds')
            : getReorderLabel('subcategoryDragTitle', 'Réordonner les sous-catégories');
        const handle = buildReorderTreeHandleHtml(pid, id, catalogNodes, orderMap, dragTitle);
        return `
        <div class="ugap-reorder-node ugap-reorder-node--leaf${nodeKindClass} ugap-reorder-node--depth-${Math.min(depth, 6)}" data-reorder-item="${escapeHtml(id)}">
            <div class="ugap-reorder-node__head">
                <div class="ugap-reorder-node__info">
                    ${handle}
                    <span class="ugap-reorder-node__label">${escapeHtml(label)}</span>
                    ${badge}
                </div>
            </div>
        </div>`;
    }

    function buildReorderTreeContainerNodeHtml(nodeId, siblingParentId, depth, rootCatId, catalogNodes, orderMap) {
        const id = String(nodeId || '').trim();
        if (!id) return '';
        const root = depth === 0 ? id : String(rootCatId || '').trim();
        const label = getCatalogNodeLabelForReorder(catalogNodes, id);
        const subtree = countCatalogDescendants(id, catalogNodes, orderMap);
        const depthClass = `ugap-reorder-node--depth-${Math.min(depth, 6)}`;
        const catClass = depth === 0
            ? ' ugap-reorder-node--category'
            : (depth === 1 ? ' ugap-reorder-node--subcategory' : ' ugap-reorder-node--subnode-group');
        const dragTitle = depth === 0
            ? getReorderLabel('categoryDragTitle', 'Réordonner les catégories entre elles')
            : (depth === 1
                ? getReorderLabel('subcategoryDragTitle', 'Réordonner les sous-catégories')
                : getReorderLabel('subnodeDragTitle', 'Réordonner les sous-nœuds'));
        const levelTag = depth === 0
            ? `<span class="ugap-tpl-reorder-level-tag">${escapeHtml(getReorderLabel('categoryLevelTag', 'Catégorie'))}</span>`
            : '';
        const subtreeBadge = subtree > 0
            ? `<span class="ugap-tpl-reorder-group-badge">${subtree} sous-nœud${subtree > 1 ? 's' : ''}</span>`
            : '';
        const pid = String(siblingParentId ?? '').trim();
        const handle = buildReorderTreeHandleHtml(pid, id, catalogNodes, orderMap, dragTitle);
        const zone = buildReorderTreeZoneHtml(id, depth, root, catalogNodes, orderMap);
        return `
        <div class="ugap-reorder-node${catClass} ${depthClass} ugap-reorder-table-block" data-reorder-item="${escapeHtml(id)}">
            <div class="ugap-reorder-node__head">
                <div class="ugap-reorder-node__info">
                    ${handle}
                    ${levelTag}
                    <span class="ugap-reorder-node__label">${escapeHtml(label)}</span>
                    ${subtreeBadge}
                </div>
            </div>
            ${zone}
        </div>`;
    }

    function buildReorderTreeRootLeafHtml(nodeId, catalogNodes, orderMap) {
        const id = String(nodeId || '').trim();
        if (!id) return '';
        const label = getCatalogNodeLabelForReorder(catalogNodes, id);
        const optCount = countCatalogNodeDirectOptions(id, catalogNodes);
        const badge = optCount > 0
            ? `<span class="ugap-tpl-reorder-group-badge ugap-tpl-reorder-group-badge--options">${optCount} option${optCount !== 1 ? 's' : ''}</span>`
            : '';
        const handle = buildReorderTreeHandleHtml(
            '',
            id,
            catalogNodes,
            orderMap,
            getReorderLabel('categoryDragTitle', 'Réordonner les catégories entre elles')
        );
        return `
        <div class="ugap-reorder-node ugap-reorder-node--category ugap-reorder-node--leaf-root ugap-reorder-node--depth-0 ugap-reorder-table-block" data-reorder-item="${escapeHtml(id)}">
            <div class="ugap-reorder-node__head">
                <div class="ugap-reorder-node__info">
                    ${handle}
                    <span class="ugap-tpl-reorder-level-tag">${escapeHtml(getReorderLabel('categoryLevelTag', 'Catégorie'))}</span>
                    <span class="ugap-reorder-node__label">${escapeHtml(label)}</span>
                    ${badge}
                </div>
            </div>
        </div>`;
    }

    function renderParcoursReorderTreeInnerHtml(catalogNodes, orderMap) {
        let forest = '';
        const catalogChildrenFn = (cnId) => orderedCatalogSiblingIdsForReorder(cnId, catalogNodes, orderMap);
        const rootIds = getParcoursOrderedSiblings('', catalogNodes, orderMap);
        const roots = rootIds.length
            ? rootIds
            : (global.UgapCatalogueNodesCore?.getRootNodes?.(catalogNodes) || [])
                .map((n) => String(n.id || '').trim())
                .filter(Boolean);
        roots.forEach((rootId) => {
            const id = String(rootId || '').trim();
            if (!id) return;
            if (catalogChildrenFn(id).length > 0) {
                forest += buildReorderTreeContainerNodeHtml(id, '', 0, id, catalogNodes, orderMap);
            } else {
                forest += buildReorderTreeRootLeafHtml(id, catalogNodes, orderMap);
            }
        });
        return forest;
    }

    function renderParcoursReorderTreeHtml(catalogNodes, orderMap, hooks) {
        const inner = renderParcoursReorderTreeInnerHtml(catalogNodes, orderMap);
        if (!inner) {
            return '<p class="ugap-devis-empty">Aucun nœud catalogue — créez l’arborescence dans l’onglet <strong>Catalogue</strong>.</p>';
        }
        const hint = getReorderLabel(
            'treeHint',
            'Affichage <strong>tableau</strong> (3 colonnes) avec structure imbriquée : réordonnez uniquement dans la même zone (sous-catégories ou sous-nœuds).'
        );
        return `
        <div class="excel-options-wrap ugap-devis-table-wrap ugap-devis-table-wrap--reorder-tree">
            <p class="ugap-tpl-reorder-hint">${hint}</p>
            <div class="excel-options-scroll">
                <div class="ugap-reorder-table-shell">
                    <div class="ugap-reorder-thead" aria-hidden="true">
                        <div class="ugap-reorder-th ugap-reorder-th--cat">Catégorie</div>
                        <div class="ugap-reorder-th ugap-reorder-th--n2">Sous-catégorie</div>
                        <div class="ugap-reorder-th ugap-reorder-th--n3">Sous-nœud</div>
                    </div>
                    <div id="ugap-devis-reorder-tree" class="ugap-reorder-forest" data-reorder-list data-reorder-parent-id="">
                        ${inner}
                    </div>
                </div>
            </div>
        </div>`;
    }

    function renderParcoursReorderTableHtml(state, hooks, catalogNodes, orderMap) {
        const rowDefs = collectParcoursReorderNodeRows(catalogNodes, orderMap);
        if (!rowDefs.length) {
            return '<p class="ugap-devis-empty">Aucun nœud catalogue — créez l’arborescence dans l’onglet <strong>Catalogue</strong>.</p>';
        }
        const reorderCtx = { catalogNodes, orderMap };
        const bodyHtml = rowDefs.map((r) => buildDevisTableRowHtml(state, hooks, r, reorderCtx)).join('');
        const hint = getReorderLabel(
            'tableHint',
            'Col. 1 <strong>Catégorie</strong> : réordonner les catégories entre elles. Col. 2 / 3 : sous-nœuds du parcours ; la ligne <strong>Options directes</strong> n’apparaît que lorsqu’un nœud a des sous-nœuds catalogue rattachés.'
        );
        return `
        <div class="excel-options-wrap ugap-devis-table-wrap ugap-devis-table-wrap--reorder">
            <p class="ugap-tpl-reorder-hint">${hint}</p>
            <div class="excel-options-scroll">
                <table class="excel-options-table ugap-devis-options-table tpl-config-table ugap-devis-options-table--reorder">
                    <thead>
                        <tr>
                            <th class="ugap-devis-th-categorie">Catégorie</th>
                            <th class="ugap-devis-th-sous-categorie">Sous-catégorie</th>
                            <th class="ugap-devis-th-sous-feuille">Sous-nœud</th>
                        </tr>
                    </thead>
                    <tbody id="ugap-devis-options-tbody">${bodyHtml}</tbody>
                </table>
            </div>
        </div>`;
    }

    /** DnD arbre parcours — catégories racine = liste plate ; enfants = listes imbriquées. */
    function bindParcoursTreeReorderEvents(mountEl, hooks) {
        if (!mountEl || !hooks?.parcoursReorderMode || isParcoursStructureMode(hooks)) return;
        mountEl._parcoursReorderHooks = hooks;

        const tree = mountEl.querySelector('#ugap-devis-reorder-tree');
        if (!tree) return;
        if (tree.dataset.parcoursTreeReorderBound === '1') return;
        tree.dataset.parcoursTreeReorderBound = '1';

        const drag = { parentId: null, fromId: null, domFromId: null, el: null };

        const normPid = (v) => String(v ?? '');

        const getDomItemId = (el) => String(el?.getAttribute('data-reorder-item') || '').trim();

        const getRootCategories = () => Array.from(
            tree.querySelectorAll(':scope > .ugap-reorder-node--category[data-reorder-item]')
        );

        /** Liste enfants la plus proche (jamais la forêt racine). */
        const findInnerListFromHandle = (handle) => {
            let el = handle;
            while (el && el !== tree) {
                if (el.matches?.('[data-reorder-list]') && el !== tree) {
                    return el;
                }
                el = el.parentElement;
            }
            return null;
        };

        /** Cible réelle sous le curseur (e.target pointe souvent vers l’élément qu’on traîne). */
        const hitUnderPointer = (event) => {
            const x = event.clientX;
            const y = event.clientY;
            if (!Number.isFinite(x) || !Number.isFinite(y)) return event.target;
            const stack = document.elementsFromPoint(x, y);
            for (let i = 0; i < stack.length; i += 1) {
                const el = stack[i];
                if (!el || !tree.contains(el)) continue;
                if (drag.el && (el === drag.el || drag.el.contains(el))) continue;
                return el;
            }
            return event.target;
        };

        const findRootCategoryFromTarget = (target) => {
            if (!target) return null;
            let el = target;
            while (el && el !== tree) {
                if (el.matches?.('.ugap-reorder-node--category[data-reorder-item]')
                    && el.parentElement === tree) {
                    return el;
                }
                el = el.parentElement;
            }
            return null;
        };

        const findRootCategoryFromPointer = (event) => {
            const cat = findRootCategoryFromTarget(hitUnderPointer(event));
            if (!cat) return null;
            const id = getDomItemId(cat);
            if (!id || id === drag.domFromId) return null;
            return cat;
        };

        const findNestedItemFromPointer = (event, parentId) => {
            const under = hitUnderPointer(event);
            const list = findNestedList(under, parentId);
            if (!list) return null;
            const item = findDirectItemInList(list, under);
            if (!item) return null;
            if (getDomItemId(item) === drag.domFromId) return null;
            return item;
        };

        const findNestedList = (target, parentId) => {
            const want = normPid(parentId);
            let el = target;
            while (el && el !== tree) {
                if (el.matches?.('[data-reorder-list]')
                    && normPid(el.getAttribute('data-reorder-parent-id')) === want) {
                    return el;
                }
                el = el.parentElement;
            }
            return null;
        };

        const findDirectItemInList = (list, target) => {
            if (!list || !target || !list.contains(target)) return null;
            let el = target;
            while (el && el !== list) {
                if (el.matches?.('[data-reorder-item]') && el.parentElement === list) {
                    return el;
                }
                el = el.parentElement;
            }
            return null;
        };

        const isRootCategoryHandle = (handle) => {
            if (!handle) return false;
            const cat = handle.closest('.ugap-reorder-node--category');
            if (!cat || cat.parentElement !== tree) return false;
            const head = cat.querySelector(':scope > .ugap-reorder-node__head');
            return !!(head && head.contains(handle));
        };

        const dropMode = (event, el) => {
            const rect = el.getBoundingClientRect();
            return event.clientY - rect.top > rect.height * 0.55 ? 'after' : 'before';
        };

        const clearMarks = () => {
            tree.querySelectorAll('[data-reorder-item]').forEach((el) => {
                el.classList.remove(
                    'ugap-dnd--drop-before',
                    'ugap-dnd--drop-after',
                    'ugap-dnd--dragging'
                );
                el.style.pointerEvents = '';
            });
            drag.el = null;
        };

        const clearDropMarks = () => {
            tree.querySelectorAll('.ugap-dnd--drop-before, .ugap-dnd--drop-after').forEach((el) => {
                el.classList.remove('ugap-dnd--drop-before', 'ugap-dnd--drop-after');
            });
        };

        const fireReorder = (parentId, fromId, toId, mode) => {
            const h = mountEl._parcoursReorderHooks || hooks;
            if (typeof h?.onReorderCatalogNode === 'function') {
                h.onReorderCatalogNode(parentId, fromId, toId, mode);
            }
        };

        tree.addEventListener('dragstart', (e) => {
            const handle = e.target?.closest?.('.ugap-reorder-dnd-handle');
            if (!handle || !e.dataTransfer) return;

            if (isRootCategoryHandle(handle)) {
                const cat = handle.closest('.ugap-reorder-node--category');
                const domFromId = getDomItemId(cat);
                const fromId = resolveReorderItemId(domFromId);
                if (!fromId) {
                    e.preventDefault();
                    return;
                }
                drag.parentId = '';
                drag.domFromId = domFromId;
                drag.fromId = fromId;
                drag.el = cat;
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', domFromId);
                cat.classList.add('ugap-dnd--dragging');
                global.requestAnimationFrame?.(() => {
                    if (drag.el) drag.el.style.pointerEvents = 'none';
                });
                return;
            }

            const implicitSlot = handle.closest('.ugap-reorder-slot--implicit');
            let list = null;
            let item = null;
            if (implicitSlot) {
                list = implicitSlot.parentElement;
                if (!list?.matches?.('[data-reorder-list]') || list === tree) {
                    e.preventDefault();
                    return;
                }
                item = implicitSlot;
            } else {
                list = findInnerListFromHandle(handle);
                item = list ? findDirectItemInList(list, handle) : null;
                if (!list || !item || list === tree) {
                    e.preventDefault();
                    return;
                }
            }
            const domFromId = getDomItemId(item);
            const fromId = resolveReorderItemId(domFromId);
            if (!fromId) {
                e.preventDefault();
                return;
            }
            drag.parentId = normPid(list.getAttribute('data-reorder-parent-id'));
            drag.domFromId = domFromId;
            drag.fromId = fromId;
            drag.el = item;
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', domFromId);
            item.classList.add('ugap-dnd--dragging');
            global.requestAnimationFrame?.(() => {
                if (drag.el) drag.el.style.pointerEvents = 'none';
            });
        });

        tree.addEventListener('dragend', () => {
            clearMarks();
            drag.parentId = null;
            drag.fromId = null;
            drag.domFromId = null;
        });

        tree.addEventListener('dragenter', (e) => {
            if (!drag.fromId) return;
            e.preventDefault();
        });

        tree.addEventListener('dragover', (e) => {
            if (!drag.fromId) return;
            e.preventDefault();
            if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';

            let targetEl = null;
            if (drag.parentId === '') {
                targetEl = findRootCategoryFromPointer(e);
            } else {
                targetEl = findNestedItemFromPointer(e, drag.parentId);
            }

            clearDropMarks();
            if (!targetEl) return;

            const mode = dropMode(e, targetEl);
            targetEl.classList.add(mode === 'after' ? 'ugap-dnd--drop-after' : 'ugap-dnd--drop-before');
        });

        tree.addEventListener('drop', (e) => {
            if (!drag.fromId) return;
            e.preventDefault();
            e.stopPropagation();

            let targetEl = null;
            if (drag.parentId === '') {
                targetEl = findRootCategoryFromPointer(e);
            } else {
                targetEl = findNestedItemFromPointer(e, drag.parentId);
            }

            if (!targetEl) return;

            const toId = resolveReorderItemId(getDomItemId(targetEl));
            const mode = dropMode(e, targetEl);
            const fromId = drag.fromId;
            const parentId = drag.parentId;
            clearMarks();
            drag.parentId = null;
            drag.fromId = null;
            drag.domFromId = null;

            if (!toId || toId === fromId) return;
            fireReorder(parentId, fromId, toId, mode);
        });
    }

    /** Masque les lignes « conteneur » L1+ sans ligne ancre col.2/col.3. */
    function filterReorderDisplayRows(rows) {
        return (Array.isArray(rows) ? rows : []).filter((row) => {
            if (row?.reorderAmongChildren === true || row?.reorderSubcategoryCol2Anchor === true) return true;
            const depth = Number(row?.catalogDepth ?? row?.reorderDepth ?? 0);
            if (row?.reorderHasChildren && depth >= 1) return false;
            return true;
        });
    }

    function findParcoursTreeNode(roots, catalogNodeId) {
        const id = String(catalogNodeId || '').trim();
        if (!id) return null;
        const walk = (node) => {
            const nid = String(node?.catalogNodeId || node?.nodeId || '').trim();
            if (nid === id) return node;
            for (const child of (Array.isArray(node?.children) ? node.children : [])) {
                const hit = walk(child);
                if (hit) return hit;
            }
            return null;
        };
        for (const root of (Array.isArray(roots) ? roots : [])) {
            const hit = walk(root);
            if (hit) return hit;
        }
        return null;
    }

    function treeNodeHasDescendantSlots(treeNode) {
        if (!treeNode || typeof treeNode !== 'object') return false;
        for (const child of (Array.isArray(treeNode.children) ? treeNode.children : [])) {
            if ((Array.isArray(child?.slots) && child.slots.length > 0) || treeNodeHasDescendantSlots(child)) {
                return true;
            }
        }
        return false;
    }

    /** Nœud catalogue conteneur : ne pas dupliquer les lignes des nœuds enfants (paramétrage inclus). */
    function shouldSkipEmptyParentCatalogSlot(state, hooks, slot, tree) {
        const cnId = catalogNodeIdFromSlot(slot);
        if (!cnId) return false;
        const MBO = getModelBaseOptions();
        if (MBO?.isMotorCatalogContainerSlot?.(slot) === true) return true;
        if (MBO?.isMotorGenericOptionCatalogSlot?.(slot) === true) return true;
        const treeNode = findParcoursTreeNode(tree?.roots, cnId);
        const hasDescendantSlots = treeNodeHasDescendantSlots(treeNode);
        if (!hasDescendantSlots) return false;

        if (isParametrageBaseMode(hooks)) {
            const nodeDepth = Number.isFinite(Number(treeNode?.depth))
                ? Number(treeNode.depth)
                : 0;
            // Sous-catégorie avec enfants plus profonds : pas de ligne « sous-cat seule » en col.2 ;
            // le libellé L1 est fusionné sur la première ligne feuille (col.2 + col.3).
            if (nodeDepth >= 1) return true;
        }

        if (slotHasConfiguratorSelections(state, hooks, slot)) return false;
        if (parcoursSlotChoiceCount(state, slot, hooks) > 0) return false;
        if (MBO?.catalogNodeHasDirectOptions?.(cnId)) return false;
        return true;
    }

    /** Minos/majos liées déjà affichées sous la ligne parente (remplacement option de base). */
    function collectInlineLinkedAdjIds(state, hooks, tree) {
        const ids = new Set();
        const visitSlot = (slot) => {
            const group = slotToGroup(slot);
            getLinkedAdjIdsForReplacedBaseInGroup(state, group, hooks).forEach((adjId) => ids.add(adjId));
        };
        const walkNode = (node) => {
            (Array.isArray(node?.slots) ? node.slots : []).forEach(visitSlot);
            (Array.isArray(node?.children) ? node.children : []).forEach(walkNode);
        };
        (Array.isArray(tree?.roots) ? tree.roots : []).forEach(walkNode);
        (Array.isArray(tree?.orphanSlots) ? tree.orphanSlots : []).forEach(visitSlot);
        return ids;
    }

    /** Masque une ligne catalogue si la mino/majo liée est déjà affichée sous le choix parent. */
    function shouldHideInlineLinkedAdjSlot(state, hooks, slot, group, inlineLinkedAdjIds) {
        if (isParametrageBaseMode(hooks) || !inlineLinkedAdjIds?.size) return false;
        if (global.UgapBaseAdjLinks?.shouldAutoApplyLinkedAdj?.(group) === true) return false;

        const selectedIds = parcoursSelectedIds(state, slot, hooks)
            .map((id) => String(id || '').trim())
            .filter(Boolean);
        if (selectedIds.some((id) => inlineLinkedAdjIds.has(id))) return true;

        const BAL = global.UgapBaseAdjLinks;
        if (BAL?.isAdjPricingGroup?.(group) !== true) return false;

        const choiceIds = parcoursChoiceRows(state, slot, hooks)
            .map((row) => String(row?.id || '').trim())
            .filter(Boolean);
        return choiceIds.some((id) => inlineLinkedAdjIds.has(id));
    }

    function collectMotorInlineLinkedAdjIds(state, hooks, tree) {
        return collectInlineLinkedAdjIds(state, hooks, tree);
    }

    function shouldHideInlineMotorAdjSlot(state, hooks, slot, group, inlineMotorAdjIds) {
        return shouldHideInlineLinkedAdjSlot(state, hooks, slot, group, inlineMotorAdjIds);
    }

    function buildModelBaseDevisRowDef(state, hooks) {
        const model = state?.selectedModel;
        if (!model || hooks?.hideModelBaseDevisRow === true) return null;
        if (isParametrageBaseMode(hooks) || hooks?.parcoursReorderMode) return null;

        const resolvePrice = hooks?.resolveModelBasePrice;
        const modelPrice = typeof resolvePrice === 'function'
            ? Number(resolvePrice(model))
            : Number(model.basePrice ?? model.priceClient ?? model.priceUgap ?? 0);
        const categorie = collectDevisModelCategory(state, hooks) || 'Modèle';
        const modelLabel = String(
            model.baseLabel || model.importExcelLabel || model.name || getModelTabLabel(state)
        ).trim();
        const modelRef = resolveModelRefUgap(state);

        return {
            mode: 'model_base',
            categorie,
            sousNoeud: '',
            showCategorie: true,
            showSousNoeud: false,
            nodePath: [categorie],
            modelLabel,
            modelRef,
            modelPrice: Number.isFinite(modelPrice) ? modelPrice : 0,
        };
    }

    function collectDevisTableRowDefs(state, hooks, tree, catalogNodes) {
        const rows = [];
        let lastCategorie = '';
        /** Catégorie à afficher sur la prochaine ligne réellement émise (pas seulement slotIdx 0). */
        let pendingCategorieCell = false;
        const reorderAnchorSeen = new Set();
        const inlineLinkedAdjIds = collectInlineLinkedAdjIds(state, hooks, tree);
        const hydratedGroupBySlotKey = new Map();
        const MBO = getModelBaseOptions();
        const groupForSlot = (slot) => {
            const key = MBO?.getSlotKey?.(slot)
                || `${String(slot?.catalogNodeId || '').trim()}:${String(slot?.groupId || '').trim()}`;
            if (hydratedGroupBySlotKey.has(key)) return hydratedGroupBySlotKey.get(key);
            const group = slotToGroup(slot);
            hydratedGroupBySlotKey.set(key, group);
            return group;
        };

        const modelBaseRow = buildModelBaseDevisRowDef(state, hooks);
        if (modelBaseRow) {
            lastCategorie = modelBaseRow.categorie;
            rows.push(modelBaseRow);
        }

        const takeShowCategorie = () => {
            if (!pendingCategorieCell) return false;
            pendingCategorieCell = false;
            return true;
        };

        const markCategorieColumn = (categorie) => {
            if (categorie !== lastCategorie) {
                lastCategorie = categorie;
                pendingCategorieCell = true;
            }
        };

        const pushSlot = (slot, categorie, sousNoeud, nodePath, catalogNodeId, catalogDepth) => {
            if (!shouldShowParcoursSlot(state, hooks, slot)) return;
            if (shouldSkipEmptyParentCatalogSlot(state, hooks, slot, tree)) return;
            const group = groupForSlot(slot);
            if (shouldHideInlineLinkedAdjSlot(state, hooks, slot, group, inlineLinkedAdjIds)) return;
            const isMulti = getModelBaseOptions()?.isMultiChoiceSlot?.(slot) === true
                || group.decisionMode === 'multi_choice';
            const cnId = String(catalogNodeId || catalogNodeIdFromSlot(slot) || '').trim();
            const parentCatalogNodeId = cnId ? catalogNodeParentId(catalogNodes, cnId) : '';
            let reorderAnchor = false;
            if (hooks?.parcoursReorderMode && cnId && !reorderAnchorSeen.has(cnId)) {
                reorderAnchorSeen.add(cnId);
                reorderAnchor = true;
            }
            const path = Array.isArray(nodePath) ? nodePath : [categorie];
            const mergedCols = useMergedNodePathColumns(hooks);
            const depth = Number.isFinite(Number(catalogDepth))
                ? Number(catalogDepth)
                : (cnId ? catalogNodeDepth(catalogNodes, cnId) : 0);
            const rowMeta = {
                catalogNodeId: cnId,
                parentCatalogNodeId,
                reorderAnchor,
                nodePath: path,
                catalogDepth: depth,
            };

            if (isMulti) {
                const ids = parcoursSelectedIds(state, slot, hooks)
                    .map((id) => String(id || '').trim())
                    .filter((id) => id && !inlineLinkedAdjIds.has(id));
                if (!ids.length) {
                    rows.push({
                        group,
                        slot,
                        categorie,
                        sousNoeud,
                        showCategorie: mergedCols ? undefined : takeShowCategorie(),
                        showSousNoeud: mergedCols ? undefined : true,
                        mode: 'multi_empty',
                        ...rowMeta,
                    });
                    return;
                }
                ids.forEach((optId, idx) => {
                    rows.push({
                        group,
                        slot,
                        categorie,
                        sousNoeud,
                        showCategorie: mergedCols ? undefined : (idx === 0 ? takeShowCategorie() : false),
                        showSousNoeud: mergedCols ? undefined : idx === 0,
                        mode: 'multi_line',
                        optId,
                        ...rowMeta,
                    });
                });
                if (!hooks?.hideUnselectedParcoursSlots) {
                    rows.push({
                        group,
                        slot,
                        categorie,
                        sousNoeud,
                        showCategorie: mergedCols ? undefined : false,
                        showSousNoeud: mergedCols ? undefined : false,
                        mode: 'multi_pick',
                        ...rowMeta,
                    });
                }
                return;
            }

            rows.push({
                group,
                slot,
                categorie,
                sousNoeud,
                showCategorie: mergedCols ? undefined : takeShowCategorie(),
                showSousNoeud: mergedCols ? undefined : true,
                mode: 'single',
                ...rowMeta,
            });
        };

        const walkNode = (node) => {
            const cnId = String(node?.catalogNodeId || node?.nodeId || '').trim();
            const nodeDepth = Number.isFinite(Number(node?.depth))
                ? Number(node.depth)
                : (cnId ? catalogNodeDepth(catalogNodes, cnId) : 0);
            const slotsOnNode = Array.isArray(node?.slots) ? node.slots : [];
            const hasChildNodes = (Array.isArray(node?.children) ? node.children : []).length > 0;
            slotsOnNode.forEach((slot) => {
                let { categorie, sousNoeud, nodePath } = catalogNodeCategoryLabels(catalogNodes, cnId, slot);
                if (hasChildNodes && useMergedNodePathColumns(hooks)) {
                    // Modes paramétrage / réordonnancement (colonnes fusionnées) :
                    // libellé générique « Options directes » pour l'emplacement implicite.
                    // Configurateur : garder les libellés naturels (sous-catégorie associée,
                    // ou poste du slot sur une catégorie racine) — pas de duplication.
                    const MBO = getModelBaseOptions();
                    if (MBO?.catalogNodeHasDirectOptions?.(cnId)) {
                        const implicitLabel = getReorderImplicitSlotLabel();
                        sousNoeud = implicitLabel;
                        nodePath = [categorie, implicitLabel];
                    }
                }
                markCategorieColumn(categorie);
                pushSlot(slot, categorie, sousNoeud, nodePath, cnId, nodeDepth);
            });
            (Array.isArray(node?.children) ? node.children : []).forEach((child) => walkNode(child));
        };

        (Array.isArray(tree?.roots) ? tree.roots : []).forEach(walkNode);

        (Array.isArray(tree?.orphanSlots) ? tree.orphanSlots : []).forEach((slot) => {
            const { categorie, sousNoeud, nodePath } = slotTableColumnLabels(slot, catalogNodes);
            markCategorieColumn(categorie);
            pushSlot(slot, categorie, sousNoeud, nodePath, catalogNodeIdFromSlot(slot));
        });

        if (!isParametrageBaseMode(hooks) && !hooks?.parcoursReorderMode) {
            collectOrphanConfiguratorOptionIds(state, hooks).forEach((optId, idx) => {
                rows.push({
                    mode: 'orphan_line',
                    optId,
                    categorie: 'Options sélectionnées',
                    sousNoeud: '',
                    showCategorie: idx === 0,
                    showSousNoeud: false,
                    nodePath: ['Options sélectionnées'],
                });
            });
            rows.push({
                mode: 'five_pct_orphans',
                categorie: 'Options non classées',
                sousNoeud: 'Option 5% devis',
                nodePath: ['Options non classées', 'Option 5% devis'],
                showCategorie: true,
                showSousNoeud: true,
            });
        }

        return applyParcoursTableRowspans(rows, hooks);
    }

    function pathPrefixEqual(a, b, len) {
        const left = Array.isArray(a) ? a : [];
        const right = Array.isArray(b) ? b : [];
        if (left.length < len || right.length < len) return false;
        for (let i = 0; i < len; i += 1) {
            if (String(left[i] ?? '') !== String(right[i] ?? '')) return false;
        }
        return true;
    }

    /**
     * Col.1 = catégorie (1× fusionnée), col.2 = sous-catégories, col.3 = sous-nœuds d'une sous-catégorie.
     */
    function getReorderImplicitSlotLabel() {
        return String(global.UgapParcoursLabels?.reorder?.implicitDirectOptions || 'Options directes').trim();
    }

    function getReorderLabel(key, fallback) {
        return String(global.UgapParcoursLabels?.reorder?.[key] || fallback || '').trim();
    }

    function prepareReorderParcoursRowLabels(row) {
        const path = (Array.isArray(row.nodePath) ? row.nodePath : [])
            .map((x) => String(x || '').trim())
            .filter(Boolean);
        const depth = Number.isFinite(Number(row.catalogDepth)) ? Number(row.catalogDepth) : 0;

        if (!path.length) {
            row.categorie = '—';
            row.noeudN2 = '';
            row.sousNoeudFeuille = '';
            return;
        }

        row.categorie = path[0];
        row.noeudN2 = '';
        row.sousNoeudFeuille = '';

        if (row.reorderAmongChildren === true && row.reorderAmongInCol2 === true && depth <= 0) {
            row.noeudN2 = getReorderImplicitSlotLabel();
            row.n2ImplicitSlot = true;
            return;
        }
        if (row.reorderAmongInCol3 === true && row.reorderSubcategoryCol2Anchor === true) {
            const label = String(path[1] || path[path.length - 1] || row.reorderNodeLabel || '').trim();
            row.noeudN2 = label;
            row.sousNoeudFeuille = getReorderImplicitSlotLabel();
            row.leafImplicitSlot = true;
            return;
        }
        if (row.reorderAmongInCol3 === true) {
            row.sousNoeudFeuille = getReorderImplicitSlotLabel();
            row.leafImplicitSlot = true;
            return;
        }
        if (row.reorderSubcategoryCol2Anchor === true) {
            row.noeudN2 = String(path[1] || path[path.length - 1] || row.reorderNodeLabel || '').trim();
            return;
        }
        if (depth <= 0) {
            row.noeudN2 = '';
            row.sousNoeudFeuille = '';
            return;
        }
        if (depth === 1) {
            row.noeudN2 = String(path[1] || path[path.length - 1] || row.reorderNodeLabel || '').trim();
            return;
        }
        row.sousNoeudFeuille = path.length >= 3
            ? (path.length === 3 ? path[2] : path.slice(2).join(' › '))
            : String(path[depth] || path[path.length - 1] || row.reorderNodeLabel || '').trim();
    }

    /** Paramétrage options de base : colonnes par profondeur catalogue. */
    function prepareBaseModelRowLabels(row) {
        const path = (Array.isArray(row.nodePath) ? row.nodePath : [])
            .map((x) => String(x || '').trim())
            .filter(Boolean);
        const depth = Number.isFinite(Number(row.catalogDepth)) ? Number(row.catalogDepth) : 0;

        if (!path.length) {
            row.categorie = '—';
            row.noeudN2 = '';
            row.sousNoeudFeuille = '';
            return;
        }

        row.categorie = path[0];
        row.noeudN2 = '';
        row.sousNoeudFeuille = '';

        if (depth <= 0) {
            const nodeLabel = String(path[0] || '').trim();
            const poste = path.length >= 2 ? String(path[1] || '').trim() : '';
            row.noeudN2 = (poste && poste !== nodeLabel) ? poste : nodeLabel;
            return;
        }
        if (depth === 1) {
            row.noeudN2 = String(path[1] || path[path.length - 1] || '').trim();
            return;
        }
        row.noeudN2 = String(path[1] || '').trim();
        if (path.length >= 3) {
            row.sousNoeudFeuille = path.length === 3 ? path[2] : path.slice(2).join(' › ');
        } else {
            row.sousNoeudFeuille = String(path[depth] || path[path.length - 1] || '').trim();
        }
    }

    function applyMergedColumnGroup(list, getKey, getLabel, cellProp) {
        let i = 0;
        while (i < list.length) {
            const key = getKey(list[i]);
            let j = i + 1;
            while (j < list.length && getKey(list[j]) === key) {
                j += 1;
            }
            const span = j - i;
            const label = getLabel(list[i]);
            list[i][cellProp] = { show: true, skip: false, rowspan: span, label };
            for (let k = i + 1; k < j; k += 1) {
                list[k][cellProp] = { skip: true };
            }
            i = j;
        }
    }

    function buildMergedCatalogTd(tdClass, labelClass, cell) {
        if (cell?.skip) return '';
        const label = String(cell?.label || '').trim();
        const content = label ? `<span class="${labelClass}">${escapeHtml(label)}</span>` : '';
        return buildMergedCatalogTdContent(tdClass, cell, content);
    }

    function buildMergedCatalogTdContent(tdClass, cell, contentHtml, colSpan) {
        if (cell?.skip) return '';
        const span = Number(cell?.rowspan) || 1;
        const rowspanAttr = span > 1 ? ` rowspan="${span}"` : '';
        const mergedClass = span > 1 ? ' ugap-devis-td-node--merged' : '';
        const cols = Number(colSpan) > 1 ? Number(colSpan) : 0;
        const colSpanAttr = cols > 1 ? ` colspan="${cols}"` : '';
        const extendedClass = cols > 1 ? ' ugap-devis-td-catalog-extended' : '';
        return `<td class="${tdClass}${mergedClass}${extendedClass}"${rowspanAttr}${colSpanAttr}>${contentHtml || ''}</td>`;
    }

    function buildReorderPlainLabel(label, labelClass) {
        const text = String(label || '').trim();
        if (!text) return '';
        return `<span class="${labelClass}">${escapeHtml(text)}</span>`;
    }

    function buildReorderBadgeHtml(badgeMode, meta) {
        const mode = String(badgeMode || '').trim();
        if (mode === 'subtree') {
            const n = Number(meta?.reorderSubtreeSize) || 0;
            if (n <= 0 || meta?.reorderHasChildren !== true) return '';
            return `<span class="ugap-tpl-reorder-group-badge" title="Sous-nœuds du parcours">${n} sous-nœud${n > 1 ? 's' : ''}</span>`;
        }
        if (mode === 'options') {
            const n = Number(meta?.reorderDirectOptionCount) || 0;
            return `<span class="ugap-tpl-reorder-group-badge ugap-tpl-reorder-group-badge--options" title="Options rattachées à ce nœud catalogue">${n} option${n > 1 ? 's' : ''}</span>`;
        }
        return '';
    }

    function buildReorderCategoryCellContent(rowDef, hooks, reorderCtx) {
        const label = String(rowDef?.catCell?.label || rowDef?.categorie || '').trim();
        if (!label) return '';
        const depth = Number(rowDef?.catalogDepth ?? rowDef?.reorderDepth ?? 0);
        const badge = depth <= 0
            ? buildReorderBadgeHtml('subtree', rowDef)
            : '';
        const labelHtml = `<span class="ugap-devis-categorie">${escapeHtml(label)}</span>`;
        const categoryTag = depth <= 0 && hooks?.parcoursReorderMode
            ? `<span class="ugap-tpl-reorder-level-tag">${escapeHtml(getReorderLabel('categoryLevelTag', 'Catégorie'))}</span>`
            : '';
        const body = !badge
            ? `<span class="ugap-tpl-reorder-line ugap-tpl-reorder-line--category">${categoryTag}${labelHtml}</span>`
            : `<span class="ugap-tpl-reorder-line ugap-tpl-reorder-line--category">${categoryTag}${labelHtml}${badge}</span>`;
        const showCatDrag = hooks?.parcoursReorderMode
            && !rowDef.catCell?.skip
            && reorderCtx
            && rowDef?.reorderHandles?.cat
            && !isParcoursStructureMode(hooks);
        if (!showCatDrag) return body;
        const meta = resolveReorderDragMeta(rowDef, 'cat', reorderCtx.catalogNodes, reorderCtx.orderMap);
        const handle = buildReorderDragHandle(
            meta,
            hooks,
            getReorderLabel('categoryDragTitle', 'Réordonner les catégories entre elles')
        );
        return `<span class="ugap-tpl-reorder-line">${handle}${body}</span>`;
    }

    function buildReorderDragHandle(meta, hooks, dragTitle) {
        const dragId = String(meta?.catalogNodeId || '').trim();
        const dragParent = String(meta?.parentCatalogNodeId ?? '');
        const canReorder = !!(meta?.hasReorderSiblings && dragId);
        if (isParcoursStructureMode(hooks) || !canReorder) {
            return '<span class="ugap-tpl-reorder-spacer" aria-hidden="true"></span>';
        }
        const title = String(
            dragTitle || 'Glisser pour réordonner entre éléments du même niveau'
        ).trim();
        return `<span class="ugap-dnd-handle ugap-dnd-handle-cat" draggable="true" data-reorder-from-id="${escapeHtml(dragId)}" data-reorder-parent-id="${escapeHtml(dragParent)}" title="${escapeHtml(title)}">⋮⋮</span>`;
    }

    function buildReorderNodeLineInner(label, dragMeta, lineOpts, hooks) {
        const meta = dragMeta && typeof dragMeta === 'object' ? dragMeta : {};
        const opts = lineOpts && typeof lineOpts === 'object' ? lineOpts : {};
        const badgeMode = String(opts.badgeMode || meta.badgeMode || 'none').trim();
        const showDragHandle = opts.showDragHandle !== false;
        const handleHtml = showDragHandle
            ? buildReorderDragHandle(meta, hooks, opts.dragTitle)
            : '<span class="ugap-tpl-reorder-spacer" aria-hidden="true"></span>';
        const groupBadge = buildReorderBadgeHtml(badgeMode, meta);
        const implicitClass = opts.implicitSlot === true ? ' ugap-tpl-reorder-line--implicit-slot' : '';
        const implicitHint = opts.implicitSlot === true
            ? getReorderLabel('implicitDirectOptionsHint', '')
            : '';
        const hintAttr = implicitHint ? ` title="${escapeHtml(implicitHint)}"` : '';
        const labelHtml = label
            ? `<span class="ugap-tpl-reorder-node-label${opts.implicitSlot ? ' ugap-tpl-reorder-node-label--implicit' : ''}"${hintAttr}>${escapeHtml(label)}</span>`
            : '';
        return `<span class="ugap-tpl-reorder-line${implicitClass}">${handleHtml}${labelHtml}${groupBadge}</span>`;
    }

    function buildReorderCatalogColumnCells(rowDef, hooks, reorderCtx) {
        const depth = Number.isFinite(Number(rowDef?.catalogDepth))
            ? Number(rowDef.catalogDepth)
            : Number(rowDef?.reorderDepth) || 0;
        const nodeLabel = String(rowDef?.reorderNodeLabel || '').trim();
        const leaf = String(rowDef?.sousNoeudFeuille || '').trim();
        const n2Label = String(rowDef.n2Cell?.label || rowDef.noeudN2 || (depth === 1 ? nodeLabel : '') || '').trim();
        const ctx = reorderCtx || null;

        let n2BadgeMode = 'none';
        let showLeaf = false;
        let leafLabel = leaf;
        let leafBadgeMode = 'none';

        if (depth <= 0) {
            if (rowDef?.n2ImplicitSlot === true || rowDef?.reorderAmongChildren === true) {
                if (leaf && leaf !== n2Label) {
                    showLeaf = true;
                    leafBadgeMode = 'options';
                } else if (n2Label) {
                    n2BadgeMode = 'options';
                }
            }
        } else if (depth === 1) {
            if (rowDef?.reorderAmongChildren === true && rowDef?.reorderSubcategoryCol2Anchor === true) {
                n2BadgeMode = 'options';
                showLeaf = true;
                leafLabel = String(rowDef.sousNoeudFeuille || rowDef.noeudN2 || nodeLabel || n2Label || '').trim();
                leafBadgeMode = 'options';
            } else if (leaf && leaf !== n2Label) {
                showLeaf = true;
                leafBadgeMode = 'options';
            } else {
                showLeaf = true;
                leafLabel = nodeLabel || n2Label;
                leafBadgeMode = 'options';
            }
        } else if (rowDef?.reorderAmongChildren === true && rowDef?.reorderAmongInCol3 === true) {
            showLeaf = true;
            leafLabel = String(leaf || nodeLabel || '').trim();
            leafBadgeMode = 'options';
        } else if (leaf) {
            showLeaf = true;
            leafBadgeMode = 'options';
        }

        let html = '';

        if (!rowDef.catCell?.skip) {
            const catContent = buildReorderCategoryCellContent(rowDef, hooks, ctx);
            html += buildMergedCatalogTdContent('ugap-devis-td-categorie', rowDef.catCell, catContent);
        }

        if (!rowDef.n2Cell?.skip) {
            if (n2Label) {
                const hasN2 = !!(rowDef?.reorderHandles?.n2);
                const n2Meta = ctx && hasN2
                    ? resolveReorderDragMeta(rowDef, 'n2', ctx.catalogNodes, ctx.orderMap)
                    : {};
                const n2Implicit = rowDef?.n2ImplicitSlot === true;
                const n2DragTitle = n2Implicit
                    ? getReorderLabel('implicitSlotDragTitle', 'Réordonner l’emplacement des options directes')
                    : getReorderLabel('subcategoryDragTitle', 'Réordonner les sous-catégories');
                const n2Content = buildReorderNodeLineInner(
                    n2Label,
                    n2Meta,
                    {
                        badgeMode: n2BadgeMode,
                        showDragHandle: !!(ctx && hasN2 && n2Meta.hasReorderSiblings),
                        implicitSlot: n2Implicit,
                        dragTitle: n2DragTitle,
                    },
                    hooks
                );
                html += buildMergedCatalogTdContent('ugap-devis-td-sous-noeud', rowDef.n2Cell, n2Content);
            } else {
                html += '<td class="ugap-devis-td-sous-noeud"></td>';
            }
        }

        if (showLeaf && leafLabel) {
            const hasLeaf = !!(rowDef?.reorderHandles?.leaf);
            const leafMeta = ctx && hasLeaf
                ? resolveReorderDragMeta(rowDef, 'leaf', ctx.catalogNodes, ctx.orderMap)
                : {};
            const leafImplicit = rowDef?.leafImplicitSlot === true;
            const leafDragTitle = leafImplicit
                ? getReorderLabel('implicitSlotDragTitle', 'Réordonner l’emplacement des options directes')
                : getReorderLabel('subnodeDragTitle', 'Réordonner les sous-nœuds');
            const leafContent = buildReorderNodeLineInner(
                leafLabel,
                leafMeta,
                {
                    badgeMode: leafBadgeMode,
                    showDragHandle: !!(ctx && hasLeaf && leafMeta.hasReorderSiblings),
                    implicitSlot: leafImplicit,
                    dragTitle: leafDragTitle,
                },
                hooks
            );
            html += `<td class="ugap-devis-td-sous-feuille">${leafContent}</td>`;
        } else {
            html += '<td class="ugap-devis-td-sous-feuille"></td>';
        }

        return html;
    }

    function buildStructureActionCellHtml(hooks, rowDef) {
        if (!isParcoursStructureMode(hooks)) return '';
        if (typeof hooks.buildStructureActionCell === 'function') {
            return hooks.buildStructureActionCell(rowDef);
        }
        const cnId = String(rowDef?.catalogNodeId || '').trim();
        if (!cnId) return '<td class="ugap-tpl-structure-action-td"></td>';
        return `<td class="ugap-tpl-structure-action-td">
            <button type="button" class="btn btn-outline btn-sm" data-remove-catalog-node="${escapeHtml(cnId)}" title="Retirer du template">Retirer</button>
        </td>`;
    }

    function applyReorderCategoryRowspans(list) {
        let i = 0;
        while (i < list.length) {
            const cat = String(list[i]?.categorie ?? '');
            let j = i + 1;
            while (j < list.length && String(list[j]?.categorie ?? '') === cat) {
                j += 1;
            }
            let anchor = i;
            while (anchor < j && list[anchor]?.reorderSkipCatCell === true) {
                anchor += 1;
            }
            if (anchor < j) {
                const span = j - i;
                list[anchor].catCell = { show: true, skip: false, rowspan: span, label: cat };
                for (let k = i; k < j; k += 1) {
                    if (k !== anchor) list[k].catCell = { skip: true };
                }
            } else {
                for (let k = i; k < j; k += 1) {
                    list[k].catCell = { skip: true };
                }
            }
            i = j;
        }
    }

    function applyReorderParcoursTableRowspans(rows) {
        const list = Array.isArray(rows) ? rows : [];
        if (!list.length) return list;

        list.forEach((row) => prepareReorderParcoursRowLabels(row));
        applyReorderCategoryRowspans(list);
        applyReorderN2Rowspans(list);

        return list;
    }

    function applyReorderN2Rowspans(list) {
        let i = 0;
        while (i < list.length) {
            const blockId = String(list[i]?.reorderSubcategoryBlockId || '').trim();

            if (blockId) {
                let j = i + 1;
                while (j < list.length
                    && String(list[j]?.reorderSubcategoryBlockId || '').trim() === blockId) {
                    j += 1;
                }
                const span = j - i;
                let anchor = i;
                let label = String(list[i]?.noeudN2 || '').trim();
                for (let k = i; k < j; k += 1) {
                    if (list[k]?.reorderSubcategoryCol2Anchor === true) {
                        anchor = k;
                        label = String(list[k]?.noeudN2 || list[k]?.reorderNodeLabel || '').trim();
                        break;
                    }
                    const rowLabel = String(list[k]?.noeudN2 || '').trim();
                    if (!label && rowLabel) {
                        label = rowLabel;
                        anchor = k;
                    }
                }
                if (!label) {
                    label = String(list[anchor]?.reorderNodeLabel || '').trim();
                }
                list[anchor].n2Cell = { show: true, skip: false, rowspan: span, label };
                for (let k = i; k < j; k += 1) {
                    if (k !== anchor) list[k].n2Cell = { skip: true };
                }
                i = j;
                continue;
            }

            const label = String(list[i]?.noeudN2 || '').trim();
            if (label) {
                list[i].n2Cell = { show: true, skip: false, rowspan: 1, label };
            } else if (!list[i].n2Cell?.skip) {
                list[i].n2Cell = { show: true, skip: false, rowspan: 1, label: '' };
            }
            i += 1;
        }
    }

    function baseModelN2MergeKey(row) {
        const cat = String(row.categorie ?? '');
        const depth = Number(row.catalogDepth ?? 0);
        const n2 = String(row.noeudN2 ?? '').trim();
        if (depth <= 0) {
            return `${cat}\0d0\0${n2}\0${String(row.catalogNodeId ?? '')}`;
        }
        const anchorId = depth >= 2
            ? String(row.parentCatalogNodeId ?? '')
            : String(row.catalogNodeId ?? '');
        return `${cat}\0l1\0${n2}\0${anchorId}`;
    }

    function applyBaseModelTableRowspans(rows) {
        const list = Array.isArray(rows) ? rows : [];
        if (!list.length) return list;

        list.forEach((row) => prepareBaseModelRowLabels(row));

        applyMergedColumnGroup(
            list,
            (row) => String(row.categorie ?? ''),
            (row) => String(row.categorie ?? ''),
            'catCell'
        );
        applyMergedColumnGroup(
            list,
            (row) => baseModelN2MergeKey(row),
            (row) => String(row.noeudN2 ?? ''),
            'n2Cell'
        );

        return list;
    }

    function buildBaseModelCatalogColumnCells(rowDef) {
        const catHtml = buildMergedCatalogTd('ugap-devis-td-categorie', 'ugap-devis-categorie', rowDef.catCell);
        const n2Html = buildMergedCatalogTd('ugap-devis-td-sous-noeud', 'ugap-devis-sous-noeud', rowDef.n2Cell);
        const leaf = String(rowDef?.sousNoeudFeuille || '').trim();
        const leafHtml = leaf
            ? `<span class="ugap-devis-sous-noeud ugap-devis-sous-noeud--l3">${escapeHtml(leaf)}</span>`
            : '';
        return `${catHtml}${n2Html}<td class="ugap-devis-td-sous-feuille">${leafHtml}</td>`;
    }

    /** Fusion récursive (rowspan) pour chaque niveau du chemin catalogue. */
    function applyNodePathRowspans(rows) {
        const list = Array.isArray(rows) ? rows : [];
        if (!list.length) return list;

        const maxDepth = Math.max(
            1,
            ...list.map((row) => (Array.isArray(row.nodePath) ? row.nodePath.length : 0))
        );

        list.forEach((row) => {
            row.nodePath = Array.isArray(row.nodePath)
                ? row.nodePath
                : [String(row.categorie || '—')];
            row.nodeLevelCells = Array.from({ length: maxDepth }, () => ({
                skip: false,
                show: false,
                rowspan: 1,
                label: '',
            }));
            row.nodePathDepth = maxDepth;
        });

        for (let level = 0; level < maxDepth; level += 1) {
            let i = 0;
            while (i < list.length) {
                const path = list[i].nodePath || [];
                if (level >= path.length) {
                    list[i].nodeLevelCells[level] = { skip: false, show: true, rowspan: 1, label: '' };
                    i += 1;
                    continue;
                }
                let j = i + 1;
                while (j < list.length && pathPrefixEqual(path, list[j].nodePath || [], level + 1)) {
                    j += 1;
                }
                const span = j - i;
                list[i].nodeLevelCells[level] = {
                    show: true,
                    skip: false,
                    rowspan: span,
                    label: path[level],
                };
                for (let k = i + 1; k < j; k += 1) {
                    list[k].nodeLevelCells[level] = { skip: true };
                }
                i = j;
            }
        }

        return list;
    }

    /** Configurateur / devis : fusion colonne Catégorie uniquement (comportement d’origine). */
    function applyLegacyCategorieRowspans(rows) {
        const list = Array.isArray(rows) ? rows : [];
        let i = 0;
        while (i < list.length) {
            const cat = String(list[i]?.categorie ?? '');
            let j = i + 1;
            while (j < list.length && String(list[j]?.categorie ?? '') === cat) {
                j += 1;
            }
            const span = j - i;
            list[i].showCategorie = true;
            list[i].categorieRowspan = span;
            list[i].skipCategorieCell = false;
            for (let k = i + 1; k < j; k += 1) {
                list[k].showCategorie = false;
                list[k].skipCategorieCell = true;
                list[k].categorieRowspan = 0;
            }
            i = j;
        }
        return list;
    }

    function buildNodePathTableHeaders(maxDepth) {
        const depth = Math.max(1, Number(maxDepth) || 1);
        const labels = ['Catégorie', 'Sous-nœud'];
        while (labels.length < depth) {
            labels.push(`Niveau ${labels.length + 1}`);
        }
        return labels.slice(0, depth).map((label, idx) => {
            const cls = idx === 0 ? 'ugap-devis-th-categorie' : 'ugap-devis-th-sous-noeud';
            return `<th class="${cls}">${escapeHtml(label)}</th>`;
        }).join('');
    }

    function buildNodePathCellsHtml(rowDef) {
        const depth = Number(rowDef?.nodePathDepth) || 1;
        const cells = Array.isArray(rowDef?.nodeLevelCells) ? rowDef.nodeLevelCells : [];
        let html = '';
        for (let level = 0; level < depth; level += 1) {
            const cell = cells[level] || {};
            if (cell.skip) continue;
            const label = String(cell.label || '').trim();
            const span = Number(cell.rowspan) || 1;
            const rowspanAttr = span > 1 ? ` rowspan="${span}"` : '';
            const tdClass = level === 0 ? 'ugap-devis-td-categorie' : 'ugap-devis-td-sous-noeud';
            const mergedClass = span > 1 ? ' ugap-devis-td-node--merged' : '';
            const labelClass = level === 0 ? 'ugap-devis-categorie' : 'ugap-devis-sous-noeud';
            const content = label ? `<span class="${labelClass}">${escapeHtml(label)}</span>` : '';
            html += `<td class="${tdClass}${mergedClass}"${rowspanAttr}>${content}</td>`;
        }
        return html;
    }

    function buildLegacyCatalogColumnCells(rowDef, categorie, sousNoeud) {
        let categorieCell = '';
        if (!rowDef?.skipCategorieCell) {
            if (rowDef?.showCategorie) {
                const span = Number(rowDef?.categorieRowspan) || 1;
                const rowspanAttr = span > 1 ? ` rowspan="${span}"` : '';
                // Même style (fond gris) pour toutes les cellules catégorie,
                // y compris celles qui ne couvrent qu'une seule ligne.
                categorieCell = `<td class="ugap-devis-td-categorie ugap-devis-td-categorie--merged"${rowspanAttr}><span class="ugap-devis-categorie">${escapeHtml(categorie)}</span></td>`;
            } else {
                categorieCell = '<td class="ugap-devis-td-categorie"></td>';
            }
        }
        const sousNoeudCell = rowDef?.showSousNoeud
            ? `<span class="ugap-devis-sous-noeud">${escapeHtml(sousNoeud)}</span>`
            : '';
        return `${categorieCell}<td class="ugap-devis-td-sous-noeud">${sousNoeudCell}</td>`;
    }

    function buildCatalogColumnCells(rowDef, hooks, categorie, sousNoeud) {
        if (useMergedNodePathColumns(hooks)) return buildBaseModelCatalogColumnCells(rowDef);
        return buildLegacyCatalogColumnCells(rowDef, categorie, sousNoeud);
    }

    function buildCatalogColumnHeaders(rowDefs, hooks) {
        if (useMergedNodePathColumns(hooks)) {
            return [
                '<th class="ugap-devis-th-categorie">Catégorie</th>',
                '<th class="ugap-devis-th-sous-categorie">Sous-catégorie</th>',
                '<th class="ugap-devis-th-sous-feuille">Sous-nœud</th>',
            ].join('');
        }
        return '<th class="ugap-devis-th-categorie">Catégorie</th><th class="ugap-devis-th-sous-noeud">Sous-nœud</th>';
    }

    /** Réordonnancement ordre des options : fusion racine uniquement. */
    function applyCategorieRowspans(rows) {
        return applyLegacyCategorieRowspans(rows);
    }

    function buildCategorieTableCell(categorie, rowDef) {
        if (rowDef?.skipCategorieCell) return '';
        if (!rowDef?.showCategorie) {
            return '<td class="ugap-devis-td-categorie"></td>';
        }
        const span = Number(rowDef?.categorieRowspan) || 1;
        const rowspanAttr = span > 1 ? ` rowspan="${span}"` : '';
        return `<td class="ugap-devis-td-categorie ugap-devis-td-categorie--merged"${rowspanAttr}><span class="ugap-devis-categorie">${escapeHtml(categorie)}</span></td>`;
    }

    function getLinkedAdjIdsForReplacedBaseInGroup(state, group, hooks) {
        const BAL = global.UgapBaseAdjLinks;
        if (!group || BAL?.shouldAutoApplyLinkedAdj?.(group) !== true) return [];
        if (!BAL?.resolveSourceAdjOptionIdsForBase) return [];

        const baseId = String(getGroupBaseOptionId(state, group, hooks) || '').trim();
        if (!baseId) return [];

        const replaced = isBaseReplacedInGroup(state, group, hooks);
        const adjGroup = BAL.effectiveAdjGroupForLinks?.(group) || group;
        const priceMode = BAL.normalizeGroupPriceMode?.(adjGroup) || '';
        const gKey = groupSelectionKey(group);
        const selCount = (state.selectedOptions?.size || 0) + (state.fivePercentOptions?.size || 0);
        const cacheKey = `${gKey}|${baseId}|${replaced ? 1 : 0}|${priceMode}|${selCount}`;
        if (!state._linkedAdjIdsByKey) state._linkedAdjIdsByKey = new Map();
        const cached = state._linkedAdjIdsByKey.get(cacheKey);
        if (cached) return cached;

        const categories = Array.isArray(state?.categories) ? state.categories : [];
        const importBaseProducts = Array.isArray(state?.importBaseProducts) ? state.importBaseProducts : [];

        let linked = BAL.resolveSourceAdjOptionIdsForBase(baseId, categories, importBaseProducts);
        if (BAL.filterAdjIdsForGroupPriceMode) {
            linked = BAL.filterAdjIdsForGroupPriceMode(linked, categories, adjGroup);
        }
        linked = linked
            .map((x) => String(x || '').trim())
            .filter(Boolean)
            .filter((adjId) => !!findCatalogOption(state, hooks, adjId));

        if (!linked.length) {
            state._linkedAdjIdsByKey.set(cacheKey, linked);
            return linked;
        }
        if (replaced) {
            state._linkedAdjIdsByKey.set(cacheKey, linked);
            return linked;
        }

        const selected = new Set();
        (state.selectedOptions || []).forEach((id) => selected.add(String(id || '').trim()));
        (state.fivePercentOptions || []).forEach((id) => selected.add(String(id || '').trim()));
        const filtered = linked.filter((id) => selected.has(id));
        state._linkedAdjIdsByKey.set(cacheKey, filtered);
        return filtered;
    }

    function buildLinkedAdjKindBadge(adj) {
        const OLK = global.UgapOptionLineKind;
        const kind = String(OLK?.inferOptionLineKind?.(adj) || '').trim().toLowerCase();
        if (kind === 'majoration') {
            return { label: 'MAJO', className: 'majoration' };
        }
        return { label: 'MINO', className: 'minoration' };
    }

    function buildLinkedAdjSupplementHtml(state, group, hooks) {
        const ids = getLinkedAdjIdsForReplacedBaseInGroup(state, group, hooks);
        if (!ids.length) return '';
        return ids.map((adjId) => {
            const adj = findCatalogOption(state, hooks, adjId);
            if (!adj) return '';
            const badge = buildLinkedAdjKindBadge(adj);
            const name = resolveOptionDisplayName(state, adj, hooks);
            const adjRef = resolveLinkedAdjRefUgap(adj);
            const refHtml = adjRef
                ? `<span style="margin-left:6px;color:#7c3aed;font-weight:600;">${escapeHtml(adjRef)}</span>`
                : '';
            return `<div class="ugap-devis-linked-adj" style="margin-top:6px;padding:6px 10px;background:#f5f0ff;border:1px solid #d8b4fe;border-radius:6px;font-size:12px;color:#5b21b6;line-height:1.35;">
                <span class="excel-line-badge ${badge.className}" style="margin-right:6px;vertical-align:middle;">${escapeHtml(badge.label)}</span>
                <span style="vertical-align:middle;">${escapeHtml(name)}${refHtml}</span>
            </div>`;
        }).filter(Boolean).join('');
    }

    function isTechnicalCatalogRef(ref) {
        const r = String(ref || '').trim();
        if (!r) return false;
        return /^(BASE-|IBP-|bp_src_|opt_ibp_)/i.test(r);
    }

    function resolveMultiChoiceOptionLabel(state, opt, hooks, rowName) {
        let text = String(rowName || '').trim();
        if (!text) text = resolveOptionDisplayName(state, opt, hooks);
        if (!text || text === '—' || text === 'de base') {
            const raw = String(opt?.name || opt?.importExcelLabel || '')
                .replace(/^\d{5,}\s*/, '')
                .replace(/\s+/g, ' ')
                .trim();
            if (raw) text = raw;
        }
        return text || 'Option';
    }

    function resolveModelRefUgap(state) {
        const sanitize = global.UgapRefDisplay?.sanitizeUgapRefForDisplay
            ? global.UgapRefDisplay.sanitizeUgapRefForDisplay.bind(global.UgapRefDisplay)
            : (ref) => String(ref || '').trim();
        const ref = sanitize(String(state?.selectedModel?.refUgap || '').trim());
        return ref || '';
    }

    function resolveParcoursRefUgap(state, hooks, opt) {
        if (!opt) return '';
        if (isOptionIncludedInDevis(hooks, opt)) {
            const modelRef = resolveModelRefUgap(state);
            if (modelRef) return modelRef;
        }
        const sanitize = global.UgapRefDisplay?.sanitizeUgapRefForDisplay
            ? global.UgapRefDisplay.sanitizeUgapRefForDisplay.bind(global.UgapRefDisplay)
            : (ref) => String(ref || '').trim();
        const ref = sanitize(String(opt?.refUgap || opt?.baseRefUgap || '').trim());
        if (!ref || isTechnicalCatalogRef(ref)) return '';
        return ref;
    }

    function resolveLinkedAdjRefUgap(adj) {
        const sanitize = global.UgapRefDisplay?.sanitizeUgapRefForDisplay
            ? global.UgapRefDisplay.sanitizeUgapRefForDisplay.bind(global.UgapRefDisplay)
            : (ref) => String(ref || '').trim();
        const ref = sanitize(String(adj?.refUgap || adj?.baseRefUgap || '').trim());
        return ref || '';
    }

    function formatParcoursOptionLineLabel(state, opt, hooks) {
        if (!opt) return '—';
        const ARO = global.UgapAdjReplacementOptions;
        if (isParcoursReadOnly(hooks) && ARO?.resolveDevisLineLabel) {
            return ARO.resolveDevisLineLabel(opt);
        }
        const text = resolveMultiChoiceOptionLabel(state, opt, hooks, '');
        const det = String(opt.details || '').trim();
        if (det && det !== text && !text.includes(det)) {
            return `${text} (${det})`;
        }
        return text;
    }

    function buildDevisTableRefUgapCell(state, hooks, mode, group, optId) {
        if (mode === 'multi_empty' || mode === 'multi_pick') {
            return '<span class="ugap-devis-ref ugap-devis-ref--muted">—</span>';
        }
        let opt = null;
        if ((mode === 'multi_line' || mode === 'orphan_line') && optId) {
            opt = findCatalogOption(state, hooks, optId);
        } else if (mode === 'single') {
            opt = getSingleChoiceDisplay(state, group, hooks).option;
        }
        const ref = resolveParcoursRefUgap(state, hooks, opt);
        if (!ref && mode !== 'single') {
            return '<span class="ugap-devis-ref ugap-devis-ref--muted">—</span>';
        }
        let html = ref
            ? `<span class="ugap-devis-ref">${escapeHtml(ref)}</span>`
            : '<span class="ugap-devis-ref ugap-devis-ref--muted">—</span>';
        if (mode === 'single') {
            getLinkedAdjIdsForReplacedBaseInGroup(state, group, hooks).forEach((adjId) => {
                const adj = findCatalogOption(state, hooks, adjId);
                if (!adj) return;
                const adjRef = resolveLinkedAdjRefUgap(adj);
                if (!adjRef) return;
                html += `<div class="ugap-devis-ref" style="margin-top:4px;font-size:12px;">${escapeHtml(adjRef)}</div>`;
            });
        }
        return html;
    }

    function buildDevisTableOptionCell(state, group, hooks, mode, optId) {
        const key = escapeHtml(groupSelectionKey(group));

        if (isParcoursReadOnly(hooks)) {
            return '<span class="ugap-devis-pick-placeholder ugap-devis-ref--muted">—</span>';
        }

        if (mode === 'multi_line' && optId) {
            const opt = findCatalogOption(state, hooks, optId);
            const name = formatParcoursOptionLineLabel(state, opt, hooks);
            const badge = opt && isFivePercentCatalogOption(hooks, opt)
                ? fivePercentBadgeHtml(hooks)
                : '';
            return `<span class="ugap-devis-opt-name">${escapeHtml(name)}${badge}</span>`;
        }

        if (mode === 'orphan_line' && optId) {
            const opt = findCatalogOption(state, hooks, optId);
            if (!opt) return '<span class="ugap-devis-pick-placeholder">—</span>';
            const name = formatParcoursOptionLineLabel(state, opt, hooks);
            const badge = isFivePercentCatalogOption(hooks, opt) ? fivePercentBadgeHtml(hooks) : '';
            return `<span class="ugap-devis-opt-name">${escapeHtml(name)}${badge}</span>`;
        }

        if (mode === 'multi_empty' || mode === 'multi_pick') {
            return `
                <button type="button" class="ugap-devis-pick-btn tpl-config-multi-add" data-tpl-group="${key}">
                    <span class="ugap-devis-pick-action">Choisir des options</span>
                    <span class="ugap-devis-pick-chevron" aria-hidden="true">›</span>
                </button>`;
        }

        const display = getSingleChoiceDisplay(state, group, hooks);
        const opt = display.option;
        const badge = opt && isFivePercentCatalogOption(hooks, opt)
            ? fivePercentBadgeHtml(hooks)
            : '';
        const nameHtml = opt
            ? `<span class="ugap-devis-pick-current">${escapeHtml(resolveOptionDisplayName(state, opt, hooks))}${badge}</span>`
            : '<span class="ugap-devis-pick-placeholder">Sélectionnez une option</span>';
        const linkedHtml = buildLinkedAdjSupplementHtml(state, group, hooks);
        const pickClass = opt
            ? 'tpl-config-single-pick tpl-config-single-pick--unique ugap-devis-pick-btn'
            : 'tpl-config-single-pick tpl-config-single-pick--unique tpl-config-single-pick--empty ugap-devis-pick-btn';
        return `
            <div class="${pickClass}" data-tpl-group="${key}" role="button" tabindex="0">
                <span class="ugap-devis-pick-label">${nameHtml}</span>
                <span class="ugap-devis-pick-chevron" aria-hidden="true">›</span>
            </div>${linkedHtml}`;
    }

    function buildDevisTablePriceCell(state, hooks, mode, group, optId) {
        if (mode === 'multi_empty' || mode === 'multi_pick') {
            return '<span class="ugap-devis-price ugap-devis-price--muted">—</span>';
        }
        if (mode === 'multi_line' && optId) {
            const opt = findCatalogOption(state, hooks, optId);
            const price = formatDevisOptionPrice(state, hooks, opt);
            const cls = price.included ? 'ugap-devis-price is-included' : 'ugap-devis-price';
            return `<span class="${cls}">${escapeHtml(price.text)}</span>`;
        }
        if (mode === 'orphan_line' && optId) {
            const opt = findCatalogOption(state, hooks, optId);
            const price = formatDevisOptionPrice(state, hooks, opt);
            const cls = price.included ? 'ugap-devis-price is-included' : 'ugap-devis-price';
            return `<span class="${cls}">${escapeHtml(price.text)}</span>`;
        }
        const display = getSingleChoiceDisplay(state, group, hooks);
        if (!display.option) {
            return '<span class="ugap-devis-price ugap-devis-price--muted">—</span>';
        }
        const price = formatDevisOptionPrice(state, hooks, display.option);
        const cls = price.included ? 'ugap-devis-price is-included' : 'ugap-devis-price';
        let html = `<span class="${cls}">${escapeHtml(price.text)}</span>`;
        getLinkedAdjIdsForReplacedBaseInGroup(state, group, hooks).forEach((adjId) => {
            const adj = findCatalogOption(state, hooks, adjId);
            if (!adj) return;
            const adjPrice = formatLinkedMotorAdjDevisPrice(state, hooks, adj);
            const adjCls = adjPrice.included ? 'ugap-devis-price is-included' : 'ugap-devis-price';
            html += `<div class="${adjCls}" style="margin-top:4px;font-size:12px;">${escapeHtml(adjPrice.text)}</div>`;
        });
        return html;
    }

    function patchSingleChoiceDevisRow(state, hooks, group, tr) {
        const refCell = tr.querySelector('.ugap-devis-td-ref');
        const optCell = tr.querySelector('.ugap-devis-td-option');
        const priceCell = tr.querySelector('.ugap-devis-td-price');
        if (refCell) refCell.innerHTML = buildDevisTableRefUgapCell(state, hooks, 'single', group, null);
        if (optCell) optCell.innerHTML = buildDevisTableOptionCell(state, group, hooks, 'single', null);
        if (priceCell) priceCell.innerHTML = buildDevisTablePriceCell(state, hooks, 'single', group, null);
    }

    function bindDevisTableGroupEvents(state, hooks, container, group) {
        if (hooks?.parcoursReorderMode || isParcoursReadOnly(hooks) || !container || !group) return;
        const key = groupSelectionKey(group);
        const openSingle = (el, e) => {
            e?.stopPropagation?.();
            if (groupSelectionKey(group) === key) openSingleChoiceModal(state, group, hooks);
        };
        const openMulti = (e) => {
            e?.stopPropagation?.();
            openMultiChoiceModal(state, group, hooks);
        };
        container.querySelectorAll(`tr[data-tpl-group="${key}"] .tpl-config-single-pick`).forEach((el) => {
            el.addEventListener('click', openSingle);
            el.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    openSingle(el, e);
                }
            });
        });
        container.querySelectorAll(`tr[data-tpl-group="${key}"] .ugap-devis-row--single`).forEach((tr) => {
            tr.addEventListener('click', (e) => {
                if (e.target.closest('.tpl-config-multi-add')) return;
                openSingle(tr, e);
            });
        });
        container.querySelectorAll(`tr[data-tpl-group="${key}"] .tpl-config-multi-add`).forEach((btn) => {
            btn.addEventListener('click', openMulti);
        });
        container.querySelectorAll(`tr[data-tpl-group="${key}"] .ugap-devis-row--multi-pick`).forEach((tr) => {
            tr.addEventListener('click', (e) => {
                if (e.target.closest('.tpl-config-multi-add')) return;
                openMulti(e);
            });
        });
    }

    /** Met à jour uniquement les lignes d'un groupe (évite le rebuild complet du parcours). */
    function refreshDevisTableGroupRows(state, hooks, group) {
        const root = global.document.getElementById('ugap-config-parcours-root');
        if (!root || !group) return false;
        const tbody = root.querySelector('#ugap-devis-options-tbody');
        if (!tbody) return false;

        group = hydrateGroupOptions(state, group);
        const key = groupSelectionKey(group);
        const existingRows = Array.from(tbody.querySelectorAll('tr[data-tpl-group]'))
            .filter((tr) => {
                const attr = tr.getAttribute('data-tpl-group') || '';
                return attr === key || attr === escapeHtml(key);
            });
        if (!existingRows.length) return false;

        const slot = groupToSlot(group);
        const isMulti = getModelBaseOptions()?.isMultiChoiceSlot?.(slot) === true
            || group.decisionMode === 'multi_choice';

        if (!isMulti && existingRows.length === 1 && existingRows[0].classList.contains('ugap-devis-row--single')) {
            patchSingleChoiceDevisRow(state, hooks, group, existingRows[0]);
            return true;
        }

        syncModelBaseBridge(state);
        const tree = getModelBaseEditorTree(state);
        const catalogNodes = getCatalogNodesForParcours(hooks);
        const groupDefs = collectDevisTableRowDefs(state, hooks, tree, catalogNodes)
            .filter((r) => groupSelectionKey(r.group) === key);
        if (!groupDefs.length) return false;

        // Remplace seulement le bloc de lignes du groupe (évite le rebuild complet)
        const tmp = global.document.createElement('tbody');
        tmp.innerHTML = groupDefs.map((r) => buildDevisTableRowHtml(state, hooks, r, null)).join('');
        const newRows = Array.from(tmp.children);
        if (!newRows.length) return false;

        // Nombre de lignes changé (ex. 1re sélection d'un groupe multi) : les rowspans
        // des cellules fusionnées (catégorie / sous-nœud) deviennent faux → rebuild complet.
        if (newRows.length !== existingRows.length) return false;

        const insertBefore = existingRows[0];
        newRows.forEach((tr) => tbody.insertBefore(tr, insertBefore));
        existingRows.forEach((tr) => tr.remove());
        return true;
    }

    /**
     * Rafraîchit le parcours après un pick utilisateur.
     * Chemin rapide : une seule ligne (single) ou un bloc groupe (multi).
     * Rebuild complet seulement si mino/majo liées impliquent d'autres lignes.
     */
    function refreshParcoursAfterPick(state, hooks) {
        const group = state._lastParcoursPickGroup;
        const forceFull = state._parcoursPickNeedsFullRefresh === true;
        state._parcoursPickNeedsFullRefresh = false;

        if (!forceFull && group && refreshDevisTableGroupRows(state, hooks, group)) {
            return 'group';
        }
        if (typeof refreshDevisTableChoiceCells === 'function') {
            refreshDevisTableChoiceCells(state, hooks);
            return 'full';
        }
        if (typeof hooks?.onParcoursRefresh === 'function') {
            hooks.onParcoursRefresh();
            return 'callback';
        }
        renderTemplateTreeStep3(state, hooks);
        return 'render';
    }

    function refreshDevisTableBody(state, hooks) {
        const root = global.document.getElementById('ugap-config-parcours-root');
        if (!root) return false;

        if (isParcoursReorderTableMode(hooks) && !isParcoursStructureMode(hooks)) {
            refreshDevisTableChoiceCells(state, hooks);
            return true;
        }

        const tbody = root.querySelector('#ugap-devis-options-tbody');
        if (!tbody) return false;

        syncModelBaseBridge(state);
        const model = state.selectedModel;
        const MBO = getModelBaseOptions();
        const templateId = String(model?.boatTemplateId || '').trim();
        const tpl = typeof hooks?.resolveBoatTemplate === 'function'
            ? hooks.resolveBoatTemplate(state)
            : MBO?.getTemplateById?.(templateId);
        const catalogNodes = getCatalogNodesForParcours(hooks);

        let rowDefs;
        let reorderCtx = null;
        if (isParcoursReorderTableMode(hooks) && tpl) {
            const order = typeof hooks?.resolveCatalogNodeOrder === 'function'
                ? (hooks.resolveCatalogNodeOrder(state, tpl) || {})
                : (MBO?.getTemplateCatalogParcours?.(tpl) || {}).order || {};
            hooks._reorderCatalogNodes = catalogNodes;
            hooks._reorderOrderMap = order;
            if (!isParcoursStructureMode(hooks)) {
                const body = root.querySelector('.ugap-devis-parcours__body');
                if (body) {
                    body.innerHTML = renderParcoursReorderTreeHtml(catalogNodes, order, hooks);
                    const bindMount = root.parentElement || root;
                    bindDevisTableEvents(state, hooks, bindMount);
                    return true;
                }
            }
            rowDefs = collectParcoursReorderNodeRows(catalogNodes, order);
            reorderCtx = null;
        } else {
            const tree = getModelBaseEditorTree(state);
            rowDefs = collectDevisTableRowDefs(state, hooks, tree, catalogNodes);
        }
        if (!rowDefs.length) return false;

        tbody.innerHTML = rowDefs.map((r) => buildDevisTableRowHtml(state, hooks, r, reorderCtx)).join('');
        const bindMount = isParcoursReorderTableMode(hooks) ? (root.parentElement || root) : root;
        // Cache les groupes pour éviter un re-collect coûteux au bind events.
        try {
            const groups = [];
            rowDefs.forEach((r) => {
                if (!r?.group) return;
                const k = groupSelectionKey(r.group);
                if (!k) return;
                if (!groups.some((g) => groupSelectionKey(g) === k)) groups.push(r.group);
            });
            bindMount._ugapDevisGroupByKey = new Map(groups.map((g) => [groupSelectionKey(g), g]));
        } catch (_) {
            // no-op
        }
        bindDevisTableEvents(state, hooks, bindMount);
        return true;
    }

    function ensureDevisTablePriceHeader(root, hooks) {
        if (hooks?.hideParcoursPriceColumn || !root) return;
        const headRow = root.querySelector('.ugap-devis-options-table thead tr');
        if (!headRow || headRow.querySelector('.ugap-devis-th-price')) return;
        headRow.insertAdjacentHTML('beforeend', '<th class="ugap-devis-th-price">Prix UGAP HT</th>');
    }

    function refreshDevisTableChoiceCells(state, hooks) {
        const root = global.document.getElementById('ugap-config-parcours-root');
        if (!root) return;

        const scrollWrap = root.querySelector('.excel-options-scroll');
        const scrollSaved = scrollWrap
            ? { top: scrollWrap.scrollTop, left: scrollWrap.scrollLeft }
            : null;

        syncModelBaseBridge(state);
        const model = state.selectedModel;
        const MBO = getModelBaseOptions();
        const templateId = String(model?.boatTemplateId || '').trim();
        if (!templateId) return;

        const tpl = typeof hooks?.resolveBoatTemplate === 'function'
            ? hooks.resolveBoatTemplate(state)
            : MBO?.getTemplateById?.(templateId);
        if (!tpl) return;

        const catalogNodes = getCatalogNodesForParcours(hooks);
        const bindMount = isParcoursReorderTableMode(hooks) ? (root.parentElement || root) : root;

        if (isParcoursReorderTableMode(hooks) && !isParcoursStructureMode(hooks)) {
            const order = typeof hooks?.resolveCatalogNodeOrder === 'function'
                ? (hooks.resolveCatalogNodeOrder(state, tpl) || {})
                : (MBO?.getTemplateCatalogParcours?.(tpl) || {}).order || {};
            hooks._reorderCatalogNodes = catalogNodes;
            hooks._reorderOrderMap = order;
            const treeMount = root.querySelector('#ugap-devis-reorder-tree');
            if (treeMount) {
                treeMount.innerHTML = renderParcoursReorderTreeInnerHtml(catalogNodes, order);
                bindDevisTableEvents(state, hooks, bindMount);
            } else {
                const body = root.querySelector('.ugap-devis-parcours__body');
                if (body) {
                    body.innerHTML = renderParcoursReorderTreeHtml(catalogNodes, order, hooks);
                    bindDevisTableEvents(state, hooks, bindMount);
                }
            }
        } else {
            const tbody = root.querySelector('#ugap-devis-options-tbody');
            if (!tbody) return;
            ensureDevisTablePriceHeader(root, hooks);
            let rowDefs;
            let reorderCtx = null;
            if (isParcoursReorderTableMode(hooks)) {
                const order = typeof hooks?.resolveCatalogNodeOrder === 'function'
                    ? (hooks.resolveCatalogNodeOrder(state, tpl) || {})
                    : (MBO?.getTemplateCatalogParcours?.(tpl) || {}).order || {};
                hooks._reorderCatalogNodes = catalogNodes;
                hooks._reorderOrderMap = order;
                rowDefs = collectParcoursReorderNodeRows(catalogNodes, order);
            } else {
                const tree = MBO.buildModelBaseEditorTree(model) || { roots: [], orphanSlots: [] };
                rowDefs = collectDevisTableRowDefs(state, hooks, tree, catalogNodes);
            }
            const groupByKey = new Map();
            rowDefs.forEach((r) => {
                if (!r?.group) return;
                const k = groupSelectionKey(r.group);
                if (k && !groupByKey.has(k)) groupByKey.set(k, r.group);
            });
            hooks._devisGroupByKey = groupByKey;
            tbody.innerHTML = rowDefs.map((r) => buildDevisTableRowHtml(state, hooks, r, reorderCtx)).join('');
            bindDevisTableEvents(state, hooks, bindMount);
        }

        if (scrollWrap && scrollSaved) {
            scrollWrap.scrollTop = scrollSaved.top;
            scrollWrap.scrollLeft = scrollSaved.left;
            global.requestAnimationFrame?.(() => {
                scrollWrap.scrollTop = scrollSaved.top;
                scrollWrap.scrollLeft = scrollSaved.left;
            });
        }
    }

    function buildDevisTableRowHtml(state, hooks, rowDef, reorderCtx) {
        const {
            group, mode, optId, categorie, sousNoeud, showCategorie, showSousNoeud,
            catalogNodeId, parentCatalogNodeId, reorderAnchor, reorderDepth,
            reorderGroupStart, reorderHasChildren, reorderSubtreeSize, hasReorderSiblings,
        } = rowDef;

        if (mode === 'model_base') {
            const catalogCols = buildCatalogColumnCells(rowDef, hooks, categorie, sousNoeud);
            const priceText = Number.isFinite(Number(rowDef.modelPrice))
                ? `${Number(rowDef.modelPrice).toFixed(2)} €`
                : '—';
            const priceCell = hooks?.hideParcoursPriceColumn
                ? ''
                : `<td class="ugap-devis-td-price"><span class="ugap-devis-price">${escapeHtml(priceText)}</span></td>`;
            const label = escapeHtml(String(rowDef.modelLabel || getModelTabLabel(state)));
            const refHtml = rowDef.modelRef
                ? `<span class="ugap-devis-ref">${escapeHtml(rowDef.modelRef)}</span>`
                : '<span class="ugap-devis-ref ugap-devis-ref--muted">—</span>';
            return `
            <tr class="ugap-devis-row ugap-devis-row--model-base">
                ${catalogCols}
                <td class="ugap-devis-td-ref">${refHtml}</td>
                <td class="ugap-devis-td-option"><span class="ugap-devis-opt-name">${label}</span></td>
                ${priceCell}
            </tr>`;
        }

        if (mode === 'five_pct_orphans') {
            const catalogCols = buildCatalogColumnCells(rowDef, hooks, categorie, sousNoeud);
            const priceCell = hooks?.hideParcoursPriceColumn
                ? ''
                : '<td class="ugap-devis-td-price"><span class="ugap-devis-price ugap-devis-price--muted">—</span></td>';
            return `
            <tr class="ugap-devis-row ugap-devis-row--five-pct-orphans">
                ${catalogCols}
                <td class="ugap-devis-td-ref">${buildUnclassifiedFivePercentRefCell(state, hooks)}</td>
                <td class="ugap-devis-td-option">${buildUnclassifiedFivePercentOptionCell(state, hooks)}</td>
                ${priceCell}
            </tr>`;
        }

        if (mode === 'orphan_line') {
            const catalogCols = buildCatalogColumnCells(rowDef, hooks, categorie, sousNoeud);
            const priceCell = hooks?.hideParcoursPriceColumn
                ? ''
                : `<td class="ugap-devis-td-price">${buildDevisTablePriceCell(state, hooks, mode, null, optId)}</td>`;
            return `
            <tr class="ugap-devis-row ugap-devis-row--orphan-line" data-tpl-orphan-opt="${escapeHtml(optId || '')}">
                ${catalogCols}
                <td class="ugap-devis-td-ref">${buildDevisTableRefUgapCell(state, hooks, mode, null, optId)}</td>
                <td class="ugap-devis-td-option">${buildDevisTableOptionCell(state, null, hooks, mode, optId)}</td>
                ${priceCell}
            </tr>`;
        }

        if (mode === 'reorder_node') {
            const depth = Number(reorderDepth) || 0;
            const key = escapeHtml(catalogNodeId || '');
            const groupStartClass = reorderGroupStart ? ' ugap-tpl-reorder-group-start' : '';
            const depthClass = ` ugap-tpl-reorder-depth-${Math.min(depth, 10)}`;
            const childrenClass = reorderHasChildren ? ' ugap-tpl-reorder-has-children' : '';
            const l1Id = String(rowDef?.reorderL1CatalogId || '').trim();
            const l1Parent = String(rowDef?.reorderL1ParentId ?? '').trim();
            const amongChildren = rowDef?.reorderAmongChildren === true ? ' data-tpl-reorder-among-children="1"' : '';
            const catAnchorAttr = rowDef.catCell && rowDef.catCell.skip !== true
                ? ' data-tpl-reorder-cat-anchor="1"'
                : '';
            const reorderRowAttrs = catalogNodeId
                ? ` data-tpl-reorder-item="${escapeHtml(catalogNodeId)}" data-tpl-reorder-parent="${escapeHtml(parentCatalogNodeId || '')}" data-tpl-reorder-depth="${depth}" data-tpl-reorder-root-cat="${escapeHtml(String(rowDef?.reorderRootCatId || catalogNodeId || ''))}"${reorderHasChildren ? ' data-tpl-reorder-has-children="1"' : ''}${l1Id ? ` data-tpl-reorder-l1-id="${escapeHtml(l1Id)}" data-tpl-reorder-l1-parent="${escapeHtml(l1Parent)}"` : ''}${amongChildren}${catAnchorAttr}`
                : '';
            const catalogCols = buildReorderCatalogColumnCells(rowDef, hooks, reorderCtx);
            const actionCell = buildStructureActionCellHtml(hooks, rowDef);

            return `
            <tr class="ugap-devis-row ugap-devis-row--reorder-node${groupStartClass}${depthClass}${childrenClass}" data-tpl-group="${key}"${reorderRowAttrs}>
                ${catalogCols}
                ${actionCell}
            </tr>`;
        }

        const key = escapeHtml(groupSelectionKey(group));
        const rowClass = mode === 'single'
            ? 'ugap-devis-row ugap-devis-row--single tpl-config-row-group tpl-config-row-group--single'
            : (mode === 'multi_empty'
                ? 'ugap-devis-row ugap-devis-row--multi tpl-config-row-group'
                : (mode === 'multi_pick'
                    ? 'ugap-devis-row ugap-devis-row--multi-pick tpl-config-row-group'
                    : 'ugap-devis-row ugap-devis-row--multi-line tpl-config-row-group'));

        const reorderRowAttrs = hooks?.parcoursReorderMode && reorderAnchor && catalogNodeId
            ? ` data-tpl-reorder-item="${escapeHtml(catalogNodeId)}" data-tpl-reorder-parent="${escapeHtml(parentCatalogNodeId || '')}"`
            : '';
        const reorderCell = hooks?.parcoursReorderMode
            ? `<td class="ugap-tpl-reorder-td">${reorderAnchor && catalogNodeId
                ? '<span class="ugap-dnd-handle ugap-dnd-handle-cat" draggable="true" title="Glisser pour réordonner (même niveau)">⋮⋮</span>'
                : ''}</td>`
            : '';

        const catalogCols = buildCatalogColumnCells(rowDef, hooks, categorie, sousNoeud);

        const priceCell = hooks?.hideParcoursPriceColumn
            ? ''
            : `<td class="ugap-devis-td-price">${buildDevisTablePriceCell(state, hooks, mode, group, optId)}</td>`;

        return `
            <tr class="${rowClass}" data-tpl-group="${key}"${reorderRowAttrs}>
                ${reorderCell}
                ${catalogCols}
                <td class="ugap-devis-td-ref">${buildDevisTableRefUgapCell(state, hooks, mode, group, optId)}</td>
                <td class="ugap-devis-td-option">${buildDevisTableOptionCell(state, group, hooks, mode, optId)}</td>
                ${priceCell}
            </tr>`;
    }

    const parcoursTableDndState = { fromId: '', parentId: '', catalogNodes: [], orderMap: {}, dragRows: [] };

    function collectReorderAncestorIds(mountEl, fromId) {
        const ids = new Set();
        let curId = String(fromId || '').trim();
        let guard = 0;
        while (curId && guard < 64) {
            const parentId = String(resolveReorderParentIdForNode(mountEl, curId) || '').trim();
            if (!parentId) break;
            ids.add(parentId);
            curId = parentId;
            guard += 1;
        }
        return ids;
    }

    function clearParcoursReorderDndMarks(mountEl) {
        if (!mountEl) return;
        mountEl.classList.remove('ugap-parcours-reorder-dragging');
        mountEl.querySelectorAll([
            '.ugap-dnd--valid-sibling',
            '.ugap-dnd--invalid-sibling',
            '.ugap-dnd--valid-drop-zone',
            '.ugap-tpl-reorder-group-dragging',
            '.ugap-tpl-reorder-row-dragging',
            '.ugap-tpl-reorder-cell-dragging',
            '.ugap-tpl-reorder-ancestor',
            '.ugap-reorder-node--dragging',
        ].join(', ')).forEach((el) => {
            el.classList.remove(
                'ugap-dnd--valid-sibling',
                'ugap-dnd--invalid-sibling',
                'ugap-dnd--valid-drop-zone',
                'ugap-tpl-reorder-group-dragging',
                'ugap-tpl-reorder-row-dragging',
                'ugap-tpl-reorder-cell-dragging',
                'ugap-tpl-reorder-ancestor',
                'ugap-reorder-node--dragging'
            );
        });
        mountEl.querySelectorAll('.ugap-dnd--drop-before, .ugap-dnd--drop-after').forEach((el) => {
            el.classList.remove('ugap-dnd--drop-before', 'ugap-dnd--drop-after');
        });
    }

    function findCategoryBlockAnchorRow(mountEl, rootCatId) {
        const id = String(rootCatId || '').trim();
        if (!mountEl || !id) return null;
        const rows = Array.from(mountEl.querySelectorAll('tr[data-tpl-reorder-item]'));
        const anchor = rows.find((row) => {
            return String(row.getAttribute('data-tpl-reorder-root-cat') || '').trim() === id
                && row.getAttribute('data-tpl-reorder-cat-anchor') === '1';
        });
        if (anchor) return anchor;
        return rows.find((row) => String(row.getAttribute('data-tpl-reorder-root-cat') || '').trim() === id) || null;
    }

    function resolveReorderDropIndicatorRow(mountEl, hoverRow, groupParentId, catalogNodes, orderMap) {
        if (!hoverRow || !mountEl) return hoverRow;
        const pid = String(groupParentId ?? '').trim();
        const dropKey = resolveReorderDropTargetId(hoverRow, pid, catalogNodes, orderMap);
        if (!dropKey) return hoverRow;
        if (!pid) {
            return findCategoryBlockAnchorRow(mountEl, dropKey) || hoverRow;
        }
        const blockRows = findReorderBlockRows(mountEl, dropKey, pid, catalogNodes, orderMap);
        if (!blockRows.length) return hoverRow;
        const anchorRow = blockRows.find((row) => {
            const rowId = String(row.getAttribute('data-tpl-reorder-item') || '').trim();
            return rowId === dropKey;
        });
        return anchorRow || blockRows[0];
    }

    function resolveReorderDropMode(event, hoverRow, mountEl, groupParentId, catalogNodes, orderMap) {
        if (!hoverRow) return 'before';
        const pid = String(groupParentId ?? '').trim();
        const dropKey = resolveReorderDropTargetId(hoverRow, pid, catalogNodes, orderMap);
        if (!dropKey || !mountEl) {
            const rect = hoverRow.getBoundingClientRect();
            return event.clientY - rect.top > rect.height * 0.55 ? 'after' : 'before';
        }
        const blockRows = findReorderBlockRows(mountEl, dropKey, pid, catalogNodes, orderMap);
        if (blockRows.length <= 1) {
            const rect = hoverRow.getBoundingClientRect();
            return event.clientY - rect.top > rect.height * 0.55 ? 'after' : 'before';
        }
        const firstRect = blockRows[0].getBoundingClientRect();
        const lastRect = blockRows[blockRows.length - 1].getBoundingClientRect();
        const y = event.clientY;
        if (y <= firstRect.top + firstRect.height * 0.45) return 'before';
        if (y >= lastRect.top + lastRect.height * 0.55) return 'after';
        const rect = hoverRow.getBoundingClientRect();
        return y - rect.top > rect.height * 0.55 ? 'after' : 'before';
    }

    function markParcoursReorderSiblingTargets(mountEl, groupParentId, fromId, catalogNodes, orderMap) {
        if (!mountEl) return;
        const pid = String(groupParentId ?? '').trim();
        const fid = String(fromId || '').trim();
        const list = getParcoursOrderedSiblings(pid, catalogNodes, orderMap);
        const listSet = new Set(list);

        if (!pid) {
            const catAnchorRows = new Set();
            list.forEach((siblingId) => {
                const sid = String(siblingId || '').trim();
                if (!sid || sid === fid) return;
                const anchor = findCategoryBlockAnchorRow(mountEl, sid);
                if (anchor) catAnchorRows.add(anchor);
            });

            mountEl.querySelectorAll('tr[data-tpl-reorder-item]').forEach((row) => {
                row.classList.remove(
                    'ugap-dnd--valid-sibling',
                    'ugap-dnd--invalid-sibling',
                    'ugap-dnd--valid-drop-zone',
                    'ugap-tpl-reorder-ancestor'
                );
                const rootCat = String(row.getAttribute('data-tpl-reorder-root-cat') || '').trim();
                if (!rootCat || rootCat === fid || !listSet.has(rootCat)) {
                    row.classList.add('ugap-dnd--invalid-sibling');
                    return;
                }
                if (catAnchorRows.has(row)) {
                    row.classList.add('ugap-dnd--valid-sibling');
                } else {
                    row.classList.add('ugap-dnd--valid-drop-zone');
                }
            });
            return;
        }

        const blockStartRows = new Set();
        list.forEach((siblingId) => {
            const sid = String(siblingId || '').trim();
            if (!sid || sid === fid) return;
            const blockRows = findReorderBlockRows(mountEl, sid, pid, catalogNodes, orderMap);
            if (blockRows.length) blockStartRows.add(blockRows[0]);
        });

        mountEl.querySelectorAll('tr[data-tpl-reorder-item]').forEach((row) => {
            const rowId = String(row.getAttribute('data-tpl-reorder-item') || '').trim();
            row.classList.remove(
                'ugap-dnd--valid-sibling',
                'ugap-dnd--invalid-sibling',
                'ugap-dnd--valid-drop-zone',
                'ugap-tpl-reorder-ancestor'
            );
            if (rowId === fid) return;
            const dropKey = resolveReorderDropTargetId(row, pid, catalogNodes, orderMap);
            if (!dropKey || dropKey === fid || !listSet.has(dropKey)) {
                row.classList.add('ugap-dnd--invalid-sibling');
                return;
            }
            if (rowId === dropKey || blockStartRows.has(row)) {
                row.classList.add('ugap-dnd--valid-sibling');
            } else {
                row.classList.add('ugap-dnd--valid-drop-zone');
            }
        });
    }

    function bindParcoursTableReorderEvents(mountEl, hooks) {
        if (!mountEl || !hooks?.parcoursReorderMode) return;
        if (mountEl.dataset.parcoursReorderBound === '1') {
            mountEl._parcoursReorderHooks = hooks;
            if (hooks?._reorderCatalogNodes) {
                mountEl._parcoursReorderHooks._reorderCatalogNodes = hooks._reorderCatalogNodes;
            }
            if (hooks?._reorderOrderMap) {
                mountEl._parcoursReorderHooks._reorderOrderMap = hooks._reorderOrderMap;
            }
            return;
        }
        mountEl.dataset.parcoursReorderBound = '1';
        mountEl._parcoursReorderHooks = hooks;

        const applyReorderDropIndicator = (event, hoverRow) => {
            const parentId = String(parcoursTableDndState.parentId ?? '');
            const catalogNodes = parcoursTableDndState.catalogNodes || [];
            const orderMap = parcoursTableDndState.orderMap || {};
            const indicatorRow = resolveReorderDropIndicatorRow(
                mountEl,
                hoverRow,
                parentId,
                catalogNodes,
                orderMap
            );
            const mode = resolveReorderDropMode(
                event,
                hoverRow,
                mountEl,
                parentId,
                catalogNodes,
                orderMap
            );
            if (indicatorRow) {
                indicatorRow.classList.add(mode === 'after' ? 'ugap-dnd--drop-after' : 'ugap-dnd--drop-before');
            }
            return mode;
        };

        const hitReorderRowUnderPointer = (event) => {
            const x = event.clientX;
            const y = event.clientY;
            if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
            const stack = document.elementsFromPoint(x, y);
            for (const el of stack) {
                if (!mountEl.contains(el)) continue;
                const row = el.closest?.('tr[data-tpl-reorder-item]');
                if (row) return row;
            }
            return null;
        };

        mountEl.addEventListener('dragstart', (e) => {
            const handle = e.target?.closest?.('.ugap-dnd-handle-cat');
            if (!handle || !e.dataTransfer) {
                e.preventDefault();
                return;
            }
            const row = handle.closest('tr[data-tpl-reorder-item]');
            if (!row) {
                e.preventDefault();
                return;
            }
            const fromId = String(handle.getAttribute('data-reorder-from-id') || '').trim();
            if (!fromId) {
                e.preventDefault();
                return;
            }
            const hooksRef = mountEl._parcoursReorderHooks || hooks;
            const catalogNodes = hooksRef?._reorderCatalogNodes || [];
            const orderMap = hooksRef?._reorderOrderMap || {};
            parcoursTableDndState.fromId = fromId;
            parcoursTableDndState.parentId = String(handle.getAttribute('data-reorder-parent-id') ?? '');
            parcoursTableDndState.catalogNodes = catalogNodes;
            parcoursTableDndState.orderMap = orderMap;
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', fromId);
            const activeTd = handle.closest('td');
            if (activeTd) activeTd.classList.add('ugap-tpl-reorder-cell-dragging');
            parcoursTableDndState.dragRows = getReorderSubtreeRowsForNodeId(
                mountEl,
                fromId,
                parcoursTableDndState.parentId,
                catalogNodes,
                orderMap
            );
            parcoursTableDndState.dragRows.forEach((el) => {
                el.classList.add('ugap-tpl-reorder-row-dragging');
                el.style.pointerEvents = 'none';
            });
            mountEl.classList.add('ugap-parcours-reorder-dragging');
            markParcoursReorderSiblingTargets(
                mountEl,
                parcoursTableDndState.parentId,
                fromId,
                catalogNodes,
                orderMap
            );
        }, true);

        mountEl.addEventListener('dragend', () => {
            (parcoursTableDndState.dragRows || []).forEach((el) => {
                el.style.pointerEvents = '';
            });
            parcoursTableDndState.dragRows = [];
            clearParcoursReorderDndMarks(mountEl);
            parcoursTableDndState.fromId = '';
            parcoursTableDndState.parentId = '';
            parcoursTableDndState.catalogNodes = [];
            parcoursTableDndState.orderMap = {};
        }, true);

        mountEl.addEventListener('dragover', (e) => {
            if (!parcoursTableDndState.fromId) return;
            e.preventDefault();
            if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
            const row = hitReorderRowUnderPointer(e);
            mountEl.querySelectorAll('.ugap-dnd--drop-before, .ugap-dnd--drop-after').forEach((el) => {
                el.classList.remove('ugap-dnd--drop-before', 'ugap-dnd--drop-after');
            });
            if (!row) return;
            if (!row.classList.contains('ugap-dnd--valid-sibling')
                && !row.classList.contains('ugap-dnd--valid-drop-zone')) {
                return;
            }
            const parentId = String(parcoursTableDndState.parentId ?? '');
            if (!isReorderSiblingTargetRow(
                parcoursTableDndState.fromId,
                parentId,
                row,
                parcoursTableDndState.catalogNodes,
                parcoursTableDndState.orderMap
            )) return;
            applyReorderDropIndicator(e, row);
        }, true);

        mountEl.addEventListener('drop', (e) => {
            if (!parcoursTableDndState.fromId) return;
            e.preventDefault();
            e.stopPropagation();
            const row = hitReorderRowUnderPointer(e);
            if (!row) return;
            if (!row.classList.contains('ugap-dnd--valid-sibling')
                && !row.classList.contains('ugap-dnd--valid-drop-zone')) {
                return;
            }
            const parentId = String(parcoursTableDndState.parentId ?? '');
            if (!isReorderSiblingTargetRow(
                parcoursTableDndState.fromId,
                parentId,
                row,
                parcoursTableDndState.catalogNodes,
                parcoursTableDndState.orderMap
            )) return;
            const dropTargetId = resolveReorderDropTargetId(
                row,
                parentId,
                parcoursTableDndState.catalogNodes,
                parcoursTableDndState.orderMap
            );
            if (!dropTargetId || dropTargetId === parcoursTableDndState.fromId) return;
            const mode = resolveReorderDropMode(
                e,
                row,
                mountEl,
                parentId,
                parcoursTableDndState.catalogNodes,
                parcoursTableDndState.orderMap
            );
            mountEl.querySelectorAll('.ugap-dnd--drop-before, .ugap-dnd--drop-after').forEach((el) => {
                el.classList.remove('ugap-dnd--drop-before', 'ugap-dnd--drop-after');
            });
            const h = mountEl._parcoursReorderHooks;
            if (typeof h?.onReorderCatalogNode === 'function') {
                h.onReorderCatalogNode(parentId, parcoursTableDndState.fromId, dropTargetId, mode);
            }
        }, true);
    }

    function resolveDevisTableGroupByKey(container, hooks) {
        if (hooks?._devisGroupByKey instanceof Map && hooks._devisGroupByKey.size) {
            return hooks._devisGroupByKey;
        }
        const cached = container?._ugapDevisGroupByKey;
        if (cached instanceof Map && cached.size) return cached;
        return new Map();
    }

    function bindDevisTableEvents(state, hooks, container) {
        if (isParcoursStructureMode(hooks)) return;
        if (hooks?.parcoursReorderMode) {
            bindParcoursTreeReorderEvents(container, hooks);
            return;
        }
        if (isParcoursReadOnly(hooks)) return;
        const tbody = container.querySelector('#ugap-devis-options-tbody');
        if (!tbody) return;

        const groupByKey = resolveDevisTableGroupByKey(container, hooks);
        if (!groupByKey.size) {
            const groups = [];
            collectDevisTableRowDefs(
                state,
                hooks,
                getModelBaseEditorTree(state),
                getCatalogNodesForParcours(hooks)
            ).forEach((r) => {
                if (!r?.group) return;
                const k = groupSelectionKey(r.group);
                if (k && !groupByKey.has(k)) groupByKey.set(k, r.group);
            });
            try {
                container._ugapDevisGroupByKey = groupByKey;
            } catch (_) {
                // no-op
            }
        }

        if (tbody._ugapDevisDelegated === true) return;
        tbody._ugapDevisDelegated = true;

        const groupFromEvent = (e) => {
            const key = e.target?.closest?.('[data-tpl-group]')?.getAttribute('data-tpl-group');
            if (!key) return null;
            const map = resolveDevisTableGroupByKey(container, hooks);
            return map.get(key) || null;
        };

        tbody.addEventListener('click', (e) => {
            if (e.target.closest('.tpl-config-multi-add')) {
                e.stopPropagation();
                const g = groupFromEvent(e);
                if (g) openMultiChoiceModal(state, g, hooks);
                return;
            }
            if (e.target.closest('.ugap-five-pct-orphans-open')) {
                e.stopPropagation();
                hooks?.openUnclassifiedFivePercentModal?.();
                return;
            }
            const multiPick = e.target.closest('.ugap-devis-row--multi-pick');
            if (multiPick && !e.target.closest('.tpl-config-multi-add')) {
                const g = groupFromEvent(e);
                if (g) openMultiChoiceModal(state, g, hooks);
                return;
            }
            const singlePick = e.target.closest('.tpl-config-single-pick, .ugap-devis-row--single');
            if (singlePick) {
                const g = groupFromEvent(e);
                if (g) openSingleChoiceModal(state, g, hooks);
            }
        });

        tbody.addEventListener('keydown', (e) => {
            if (e.key !== 'Enter' && e.key !== ' ') return;
            const singlePick = e.target.closest('.tpl-config-single-pick');
            if (!singlePick) return;
            e.preventDefault();
            const g = groupFromEvent(e);
            if (g) openSingleChoiceModal(state, g, hooks);
        });
    }

    function buildDevisTableShellHtml(hooks) {
        const optionColLabel = String(hooks?.optionColumnLabel || 'Option sélectionnée').trim() || 'Option sélectionnée';
        const catalogHeaders = buildCatalogColumnHeaders([], hooks);
        const priceHeader = hooks?.hideParcoursPriceColumn
            ? ''
            : '<th class="ugap-devis-th-price">Prix UGAP HT</th>';
        const reorderHeader = hooks?.parcoursReorderMode
            ? '<th class="ugap-tpl-reorder-th" aria-label="Ordre"></th>'
            : '';
        const colCount = 3 + (catalogHeaders.match(/<th/g) || []).length + (priceHeader ? 1 : 0) + (reorderHeader ? 1 : 0);
        return `
            <div class="excel-options-wrap ugap-devis-table-wrap">
                <div class="excel-options-scroll">
                    <table class="excel-options-table ugap-devis-options-table tpl-config-table">
                        <thead>
                            <tr>
                                ${reorderHeader}
                                ${catalogHeaders}
                                <th class="ugap-devis-th-ref">Réf. UGAP</th>
                                <th class="ugap-devis-th-option">${escapeHtml(optionColLabel)}</th>
                                ${priceHeader}
                            </tr>
                        </thead>
                        <tbody id="ugap-devis-options-tbody">
                            <tr class="ugap-devis-row ugap-devis-row--loading">
                                <td colspan="${colCount}" style="text-align:center;padding:22px 16px;color:#64748b;">
                                    <div class="loader" style="margin:0 auto 12px;"></div>
                                    <span style="font-size:14px;font-weight:600;">Chargement des options…</span>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>`;
    }

    /** Statut MBO (slots) mis en cache par modèle — même durée de vie que l'arbre éditeur. */
    function getMboStatusCached(state, model) {
        const MBO = getModelBaseOptions();
        if (!MBO?.getStatus) return { slots: [] };
        const mid = String(model?.id || '').trim();
        if (mid && state._mboStatusCacheKey === mid && state._mboStatusCache) {
            return state._mboStatusCache;
        }
        const status = MBO.getStatus(model) || { slots: [] };
        if (mid) {
            state._mboStatusCache = status;
            state._mboStatusCacheKey = mid;
        }
        return status;
    }

    /** Prépare rowDefs + métadonnées sans générer le HTML des lignes. */
    function collectDevisTableRenderData(state, hooks) {
        syncModelBaseBridge(state);
        const model = state.selectedModel;
        const MBO = getModelBaseOptions();
        const mboStatus = getMboStatusCached(state, model);
        const templateId = String(model?.boatTemplateId || '').trim();

        if (!templateId) {
            return { error: '<p class="ugap-devis-empty">Aucun ordre des options lié à ce modèle.</p>' };
        }
        const tpl = typeof hooks?.resolveBoatTemplate === 'function'
            ? hooks.resolveBoatTemplate(state)
            : MBO?.getTemplateById?.(templateId);
        if (!tpl) {
            return { error: '<p class="ugap-devis-empty">Ordre des options introuvable.</p>' };
        }

        const catalogNodes = getCatalogNodesForParcours(hooks);

        if (isParcoursReorderTableMode(hooks)) {
            return { reorderMode: true, catalogNodes, tpl };
        }

        if (!mboStatus.slots?.length) {
            return { error: '<p class="ugap-devis-empty">Aucun poste sur ce template — paramétrez les options de base dans <strong>Modèles</strong>.</p>' };
        }

        if (isParametrageBaseMode(hooks)) {
            syncParcoursSelectionsFromMbo(state, hooks);
        } else {
            const mid = String(state.selectedModel?.id || '').trim();
            const defaultsAlreadyApplied = mid && state._modelBaseDefaultsAppliedForModelId === mid;
            if (!defaultsAlreadyApplied && !hooks?.skipParcoursDefaultSelections) {
                ugapTplPerfWrap('Tpl.applyDefaultSelectionsForParcours(render)', () => {
                    applyDefaultSelectionsForParcours(state, hooks);
                });
            }
        }

        const tree = getModelBaseEditorTree(state);
        const rowDefs = collectDevisTableRowDefs(state, hooks, tree, catalogNodes);
        if (!rowDefs.length) {
            return { error: '<p class="ugap-devis-empty">Aucun choix affichable (vérifiez les liens nœud catalogue sur les options).</p>' };
        }

        const groupByKey = new Map();
        rowDefs.forEach((r) => {
            if (!r?.group) return;
            const k = groupSelectionKey(r.group);
            if (k && !groupByKey.has(k)) groupByKey.set(k, r.group);
        });

        return {
            rowDefs,
            groupByKey,
            catalogHeaders: buildCatalogColumnHeaders(rowDefs, hooks),
        };
    }

    function buildCatalogParcoursPanelInnerHtml(state, hooks, bodyHtml) {
        const tplLabel = String(
            getBoatTemplateForModel(state)?.label || hooks.getBoatTemplateLabel?.() || ''
        ).trim();
        const modelName = escapeHtml(getModelTabLabel(state));
        const poste = state.selectedModel?.posteNumber;
        const posteLabel = poste != null && poste !== '' && Number.isFinite(Number(poste))
            ? `P${poste}`
            : '';
        const modelLine = posteLabel
            ? `${posteLabel} — ${modelName}`
            : modelName;
        const modelBasePrice = typeof hooks?.resolveModelBasePrice === 'function'
            ? Number(hooks.resolveModelBasePrice(state.selectedModel))
            : Number(state.selectedModel?.basePrice ?? state.selectedModel?.priceClient ?? state.selectedModel?.priceUgap ?? 0);
        const modelPriceHtml = Number.isFinite(modelBasePrice) && modelBasePrice > 0
            ? ` — ${escapeHtml(modelBasePrice.toFixed(2))} € HT`
            : '';
        const excelLabel = typeof hooks.getExcelTabLabel === 'function'
            ? String(hooks.getExcelTabLabel() || '').trim()
            : 'Tableau motorisation';
        const foldOpen = state.devisExcelFoldOpen === true;
        const excelBlock = typeof hooks.renderExcelTable === 'function'
            ? `<details class="ugap-devis-excel-fold"${foldOpen ? ' open' : ''}>
                <summary class="ugap-devis-excel-fold__summary">${escapeHtml(excelLabel)}</summary>
                <div class="ugap-devis-excel-fold__body" id="ugap-config-excel-host"></div>
               </details>`
            : '';
        const modelLineHtml = hooks?.hideParcoursModelLine
            ? ''
            : `<p class="ugap-devis-parcours__model-line">${modelLine}${modelPriceHtml}${tplLabel ? ` — <span class="ugap-devis-parcours__boat-inline">${escapeHtml(tplLabel)}</span>` : ''}</p>`;
        return `
            <div class="ugap-config-parcours ugap-devis-parcours" id="ugap-config-parcours-root">
                ${modelLineHtml}
                ${excelBlock}
                <div class="ugap-devis-parcours__body">${bodyHtml}</div>
            </div>`;
    }

    function mountCatalogParcoursExcelFold(state, hooks, root) {
        if (!root || typeof hooks.renderExcelTable !== 'function') return;
        const excelFold = root.querySelector('.ugap-devis-excel-fold');
        if (!excelFold) return;
        const mountExcelTable = () => {
            const host = root.querySelector('#ugap-config-excel-host');
            if (!host || !excelFold.open) return;
            if (!host.innerHTML.trim()) {
                hooks.renderExcelTable(host);
                hooks.onResize?.();
            }
        };
        mountExcelTable();
        excelFold.addEventListener('toggle', () => {
            state.devisExcelFoldOpen = !!excelFold.open;
            mountExcelTable();
        });
    }

    /**
     * Affiche immédiatement le parcours (modèle + en-têtes tableau) sans attendre les lignes.
     */
    function mountCatalogParcoursShell(state, hooks, container) {
        if (!container) return false;
        const status = getTemplateConfiguratorStatus(state);
        if (status.mode === 'template_error') {
            renderTemplateError(state, hooks, status);
            return false;
        }
        if (status.mode === 'legacy') return false;

        ensureResolved(state);
        const prevFold = container?.querySelector?.('.ugap-devis-excel-fold');
        if (prevFold) state.devisExcelFoldOpen = !!prevFold.open;

        const bodyHtml = isParcoursReorderTableMode(hooks)
            ? buildDevisTableShellHtml(hooks)
            : buildDevisTableShellHtml(hooks);
        container.innerHTML = buildCatalogParcoursPanelInnerHtml(state, hooks, bodyHtml);

        const root = container.querySelector('#ugap-config-parcours-root');
        if (root) {
            const bindMount = isParcoursReorderTableMode(hooks) ? container : root;
            bindDevisTableEvents(state, hooks, bindMount);
            mountCatalogParcoursExcelFold(state, hooks, root);
        }
        hooks?.setStep3Hint?.(true, 'ok');
        hooks?.onResize?.();
        return true;
    }

    function cancelParcoursProgressiveFill(state) {
        state._parcoursProgressiveGen = (state._parcoursProgressiveGen || 0) + 1;
        if (state._parcoursProgressiveRafId != null && typeof cancelAnimationFrame === 'function') {
            cancelAnimationFrame(state._parcoursProgressiveRafId);
            state._parcoursProgressiveRafId = null;
        }
    }

    /**
     * Remplit le tbody ligne par ligne (chunks rAF) après mountCatalogParcoursShell.
     */
    function fillDevisTableProgressive(state, hooks, callbacks) {
        const cbs = callbacks && typeof callbacks === 'object' ? callbacks : {};
        const root = global.document.getElementById('ugap-config-parcours-root')
            || hooks?.optionsContainer?.querySelector?.('#ugap-config-parcours-root');
        const tbody = root?.querySelector('#ugap-devis-options-tbody');
        const bindMount = root
            ? (isParcoursReorderTableMode(hooks) ? (root.parentElement || root) : root)
            : null;

        const finish = (mode) => {
            cbs.onComplete?.(mode);
            hooks?.onResize?.();
        };

        if (!tbody || !bindMount) {
            if (hooks?.optionsContainer) {
                renderCatalogParcoursPanel(state, hooks, hooks.optionsContainer);
            }
            finish('fallback-full');
            return;
        }

        cancelParcoursProgressiveFill(state);
        const gen = state._parcoursProgressiveGen;

        const runCollectAndPump = () => {
            if (gen !== state._parcoursProgressiveGen) return;
            if (state.step != null && state.step !== 4) return;

            const data = ugapTplPerfWrap('Tpl.collectDevisTableRenderData', () => collectDevisTableRenderData(state, hooks));

            if (data?.error) {
                const body = root.querySelector('.ugap-devis-parcours__body');
                if (body) body.innerHTML = data.error;
                finish('error');
                return;
            }

            if (data?.reorderMode) {
                const body = root.querySelector('.ugap-devis-parcours__body');
                if (body) {
                    body.innerHTML = ugapTplPerfWrap('Tpl.renderDevisOptionsTableHtml', () => renderDevisOptionsTableHtml(state, hooks));
                }
                bindDevisTableEvents(state, hooks, bindMount);
                finish('reorder-full');
                return;
            }

            hooks._devisGroupByKey = data.groupByKey;
            const rowDefs = data.rowDefs || [];
            if (!rowDefs.length) {
                const body = root.querySelector('.ugap-devis-parcours__body');
                if (body) {
                    body.innerHTML = '<p class="ugap-devis-empty">Aucun choix affichable.</p>';
                }
                finish('empty');
                return;
            }

            const loadingRow = tbody.querySelector('.ugap-devis-row--loading');
            const CHUNK = 8;
            let idx = 0;
            let firstChunkDone = false;

            const pump = () => {
                if (gen !== state._parcoursProgressiveGen) return;
                if (state.step != null && state.step !== 4) return;

                const end = Math.min(idx + CHUNK, rowDefs.length);
                const slice = rowDefs.slice(idx, end);
                const html = ugapTplPerfWrap(
                    idx === 0 ? 'Tpl.buildDevisTableRowHtml(first)' : 'Tpl.buildDevisTableRowHtml(chunk)',
                    () => slice.map((r) => buildDevisTableRowHtml(state, hooks, r)).join('')
                );

                if (idx === 0 && loadingRow) loadingRow.remove();
                if (html) tbody.insertAdjacentHTML('beforeend', html);
                idx = end;

                if (!firstChunkDone && idx > 0) {
                    firstChunkDone = true;
                    cbs.onFirstChunk?.();
                }

                if (idx < rowDefs.length) {
                    state._parcoursProgressiveRafId = global.requestAnimationFrame(pump);
                } else {
                    state._parcoursProgressiveRafId = null;
                    ugapTplPerfWrap('Tpl.bindDevisTableEvents', () => bindDevisTableEvents(state, hooks, bindMount));
                    finish('progressive');
                }
            };

            state._parcoursProgressiveRafId = global.requestAnimationFrame(pump);
        };

        if (typeof global.requestIdleCallback === 'function') {
            global.requestIdleCallback(runCollectAndPump, { timeout: 120 });
        } else {
            global.requestAnimationFrame(runCollectAndPump);
        }
    }

    function renderTemplateTreeStep3Progressive(state, hooks, callbacks) {
        const h = hooks && typeof hooks === 'object' ? hooks : {};
        const status = getTemplateConfiguratorStatus(state);
        if (status.mode === 'legacy') return false;
        if (status.mode === 'template_error') {
            return renderTemplateError(state, hooks, status);
        }

        const optContainer = h.optionsContainer;
        if (!optContainer) return false;
        if (h.tabsContainer) h.tabsContainer.innerHTML = '';
        if (h.subcategoriesContainer) h.subcategoriesContainer.innerHTML = '';

        state.templateTreeRootIndex = 0;
        state.templateTreePath = [];

        const existingRoot = optContainer.querySelector('#ugap-config-parcours-root');
        const hasShell = existingRoot?.querySelector('.ugap-devis-row--loading')
            || (existingRoot?.querySelector('#ugap-devis-options-tbody')?.children.length === 0);

        if (!existingRoot || !hasShell) {
            optContainer.innerHTML = '';
            ensureResolved(state);
            if (!mountCatalogParcoursShell(state, hooks, optContainer)) return false;
        }

        fillDevisTableProgressive(state, hooks, callbacks);
        return true;
    }

    function renderDevisOptionsTableHtml(state, hooks) {
        const data = collectDevisTableRenderData(state, hooks);
        if (data?.error) return data.error;

        if (data?.reorderMode) {
            syncModelBaseBridge(state);
            const model = state.selectedModel;
            const MBO = getModelBaseOptions();
            const catalogNodes = data.catalogNodes;
            const tpl = data.tpl;
            const order = typeof hooks?.resolveCatalogNodeOrder === 'function'
                ? (hooks.resolveCatalogNodeOrder(state, tpl) || {})
                : (MBO?.getTemplateCatalogParcours?.(tpl) || {}).order || {};
            const structureMode = isParcoursStructureMode(hooks);
            hooks._reorderCatalogNodes = catalogNodes;
            hooks._reorderOrderMap = order;
            if (!structureMode) {
                return renderParcoursReorderTreeHtml(catalogNodes, order, hooks);
            }
            const rowDefs = collectParcoursReorderNodeRows(catalogNodes, order);
            const reorderCtx = null;
            if (!rowDefs.length) {
                return '<p class="ugap-devis-empty">Aucun nœud sélectionné — ajoutez une catégorie racine ci-dessus.</p>';
            }
            const bodyHtml = rowDefs.map((r) => buildDevisTableRowHtml(state, hooks, r, reorderCtx)).join('');
            const wrapClass = 'ugap-devis-table-wrap--structure';
            const tableClass = 'ugap-devis-options-table--structure';
            const hint = String(
                hooks?.getStructureHint?.()
                || 'Ajoutez ou retirez des nœuds catalogue. L’ordre d’affichage se règle dans le parcours <strong>Standard</strong>.'
            );
            const actionHeader = '<th class="ugap-tpl-structure-th">Action</th>';
            return `
            <div class="excel-options-wrap ugap-devis-table-wrap ${wrapClass}">
                <p class="ugap-tpl-reorder-hint">${hint}</p>
                <div class="excel-options-scroll">
                    <table class="excel-options-table ugap-devis-options-table tpl-config-table ${tableClass}">
                        <thead>
                            <tr>
                                <th class="ugap-devis-th-categorie">Catégorie</th>
                                <th class="ugap-devis-th-sous-categorie">Sous-catégorie</th>
                                <th class="ugap-devis-th-sous-feuille">Sous-nœud</th>
                                ${actionHeader}
                            </tr>
                        </thead>
                        <tbody id="ugap-devis-options-tbody">${bodyHtml}</tbody>
                    </table>
                </div>
            </div>`;
        }

        const rowDefs = data.rowDefs;
        hooks._devisGroupByKey = data.groupByKey;

        const bodyHtml = ugapTplPerfWrap('Tpl.buildDevisTableRowHtml', () => rowDefs.map((r) => buildDevisTableRowHtml(state, hooks, r)).join(''));
        const optionColLabel = String(hooks?.optionColumnLabel || 'Option sélectionnée').trim() || 'Option sélectionnée';
        const catalogHeaders = buildCatalogColumnHeaders(rowDefs, hooks);
        const priceHeader = hooks?.hideParcoursPriceColumn
            ? ''
            : '<th class="ugap-devis-th-price">Prix UGAP HT</th>';
        const reorderHeader = hooks?.parcoursReorderMode
            ? '<th class="ugap-tpl-reorder-th" aria-label="Ordre"></th>'
            : '';

        return `
            <div class="excel-options-wrap ugap-devis-table-wrap">
                <div class="excel-options-scroll">
                    <table class="excel-options-table ugap-devis-options-table tpl-config-table">
                        <thead>
                            <tr>
                                ${reorderHeader}
                                ${catalogHeaders}
                                <th class="ugap-devis-th-ref">Réf. UGAP</th>
                                <th class="ugap-devis-th-option">${escapeHtml(optionColLabel)}</th>
                                ${priceHeader}
                            </tr>
                        </thead>
                        <tbody id="ugap-devis-options-tbody">${bodyHtml}</tbody>
                    </table>
                </div>
            </div>`;
    }

    function captureParcoursPanelScroll(container) {
        if (!container) return null;
        return {
            scrollAreas: Array.from(container.querySelectorAll('.excel-options-scroll')).map((el) => ({
                top: el.scrollTop,
                left: el.scrollLeft,
            })),
            winY: global.scrollY || 0,
        };
    }

    function restoreParcoursPanelScroll(container, saved) {
        if (!container || !saved) return;
        const areas = container.querySelectorAll('.excel-options-scroll');
        (saved.scrollAreas || []).forEach((pos, idx) => {
            const el = areas[idx];
            if (!el || !pos) return;
            el.scrollTop = pos.top;
            el.scrollLeft = pos.left;
        });
        const winY = Number(saved.winY);
        if (Number.isFinite(winY) && winY > 0) {
            try {
                global.scrollTo({ top: winY, behavior: 'instant' });
            } catch (_) {
                global.scrollTo(0, winY);
            }
        }
    }

    function renderCatalogParcoursPanel(state, hooks, container) {
        if (!container) return;
        const scrollSaved = captureParcoursPanelScroll(container);
        try {
        const bodyHtml = ugapTplPerfWrap('Tpl.renderDevisOptionsTableHtml', () => renderDevisOptionsTableHtml(state, hooks));
        container.innerHTML = buildCatalogParcoursPanelInnerHtml(state, hooks, bodyHtml);
        const root = container.querySelector('#ugap-config-parcours-root');
        if (root) {
            const bindMount = isParcoursReorderTableMode(hooks) ? container : root;
            ugapTplPerfWrap('Tpl.bindDevisTableEvents', () => bindDevisTableEvents(state, hooks, bindMount));
            mountCatalogParcoursExcelFold(state, hooks, root);
        }
        restoreParcoursPanelScroll(container, scrollSaved);
        global.requestAnimationFrame?.(() => restoreParcoursPanelScroll(container, scrollSaved));
        } catch (err) {
            console.error('[UGAP][renderCatalogParcoursPanel]', err);
            container.innerHTML = `<div style="padding:16px;border:2px solid #f59e0b;border-radius:8px;background:#fffbeb;color:#92400e;font-size:14px;line-height:1.5;">
                <strong>Parcours options</strong><br><br>
                ${escapeHtml(err?.message || String(err))}
            </div>`;
        }
    }

    function renderTemplateTreeStep3(state, hooks) {
        const h = hooks && typeof hooks === 'object' ? hooks : {};
        const status = getTemplateConfiguratorStatus(state);

        if (status.mode === 'legacy') {
            return false;
        }
        if (status.mode === 'template_error') {
            return renderTemplateError(state, hooks, status);
        }

        if (typeof h.setStep3Hint === 'function') {
            h.setStep3Hint(true, 'ok');
        }

        const tabsContainer = h.tabsContainer;
        const subContainer = h.subcategoriesContainer;
        const optContainer = h.optionsContainer;
        if (!optContainer) return false;
        if (tabsContainer) tabsContainer.innerHTML = '';
        if (subContainer) subContainer.innerHTML = '';
        optContainer.innerHTML = '';

        state.templateTreeRootIndex = 0;
        state.templateTreePath = [];

        ensureResolved(state);

        try {
            renderCatalogParcoursPanel(state, hooks, optContainer);
        } catch (err) {
            console.error('[UGAP][renderTemplateTreeStep3]', err);
            optContainer.innerHTML = `<div style="padding:16px;border:2px solid #f59e0b;border-radius:8px;background:#fffbeb;color:#92400e;font-size:14px;line-height:1.5;">
                <strong>Parcours options</strong><br><br>
                ${escapeHtml(err?.message || String(err))}
            </div>`;
        }

        h.onResize?.();
        return true;
    }

    function getInclusionKind(hooks, opt) {
        if (typeof hooks.getOptionInclusionKind === 'function') {
            return hooks.getOptionInclusionKind(opt);
        }
        return 'option_devis';
    }

    function getInclusionLabel(hooks, kind) {
        if (typeof hooks.getOptionInclusionLabel === 'function') {
            return hooks.getOptionInclusionLabel(kind);
        }
        return kind || 'Option devis';
    }

    function catalogUgapPrice(opt) {
        const ODN = global.UgapOptionDisplayName;
        if (ODN?.resolveCatalogOptionUgapPrice) return ODN.resolveCatalogOptionUgapPrice(opt);
        if (!opt) return 0;
        const ugap = Number(opt.priceUgap);
        if (Number.isFinite(ugap)) return ugap;
        return Number(opt.priceClient) || 0;
    }

    function formatPrice(opt, hooks, state) {
        if (!opt) return '';
        // Option de base : comprise dans le prix du modèle, pas de montant affiché.
        if (isImportGeneratedBaseOption(opt)) return 'Inclus';
        if (typeof hooks?.isBaseCatalogOption === 'function' && hooks.isBaseCatalogOption(opt)) {
            return 'Inclus';
        }
        return `${catalogUgapPrice(opt).toFixed(2)} €`;
    }

    /** Toutes les options du groupe famille (compatibles modèle), pas seulement les IBP. */
    function getGroupChoiceOptionsForPicker(group, hooks, model) {
        const fromGroup = Array.isArray(group?.options) ? group.options : [];
        const fromIds = (Array.isArray(group?.optionIds) ? group.optionIds : [])
            .map((id) => String(id || '').trim())
            .filter(Boolean)
            .map((id) => (typeof hooks?.getCatalogOptionById === 'function' ? hooks.getCatalogOptionById(id) : null))
            .filter(Boolean);
        const all = [];
        [...fromGroup, ...fromIds].forEach((opt) => {
            const oid = String(opt?.id || '').trim();
            if (!oid) return;
            if (!all.some((x) => String(x?.id || '').trim() === oid)) all.push(opt);
        });

        const compatible = (opt) => {
            const mid = String(model?.id || '').trim();
            if (!mid) return true;
            // compatibleModels stricte quand renseignée ; vide = tous les modèles.
            const comp = Array.isArray(opt?.compatibleModels) ? opt.compatibleModels.map(String) : [];
            if (comp.length) return comp.includes(mid);
            return true;
        };
        const filtered = all.filter((opt) => opt && compatible(opt));
        if (filtered.length) return filtered;
        return all.filter(Boolean);
    }

    function resolveOptionDisplayName(state, opt, hooks) {
        if (!opt) return '—';
        const ODN = global.UgapOptionDisplayName;
        const models = Array.isArray(state?.models) ? state.models : [];
        const modelId = String(state.selectedModel?.id || '').trim();
        if (ODN?.resolveOptionDisplayName) {
            return String(ODN.resolveOptionDisplayName(opt, { models, modelId }) || opt.name || '—').trim() || '—';
        }
        return String(opt.name || '—').trim() || '—';
    }

    function buildCol2ChoiceHtml(state, group, hooks) {
        const key = escapeHtml(groupSelectionKey(group));
        if (group.decisionMode === 'multi_choice') {
            const ids = getSelectedInGroup(state, group);
            const chips = ids.map((optId) => {
                const opt = findCatalogOption(state, hooks, optId)
                    || (group.options || []).find((o) => o.id === optId);
                if (!opt) return '';
                const badge = isFivePercentCatalogOption(hooks, opt) ? fivePercentBadgeHtml(hooks) : '';
                return `<span class="tpl-config-chip" data-tpl-group="${key}" data-tpl-opt="${escapeHtml(opt.id)}"
                    style="display:inline-flex;align-items:center;gap:6px;padding:6px 10px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:999px;font-size:13px;">
                    ${escapeHtml(resolveMultiChoiceOptionLabel(state, opt, hooks, ''))}${badge}
                    <button type="button" class="tpl-config-chip-remove" data-tpl-group="${key}" data-tpl-opt="${escapeHtml(opt.id)}"
                        aria-label="Retirer" style="border:none;background:transparent;cursor:pointer;font-size:16px;line-height:1;color:#64748b;">×</button>
                </span>`;
            }).filter(Boolean).join('');
            return `
                <div style="font-size:12px;font-weight:600;color:#475569;margin-bottom:6px;">${escapeHtml(group.label)}</div>
                <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;">
                    ${chips}
                    <button type="button" class="tpl-config-multi-add btn btn-outline" data-tpl-group="${key}"
                        style="width:36px;height:36px;border-radius:50%;padding:0;font-size:20px;line-height:1;">+</button>
                </div>
            `;
        }
        const display = getSingleChoiceDisplay(state, group, hooks);
        const opt = display.option;
        const badge = opt && isFivePercentCatalogOption(hooks, opt) ? fivePercentBadgeHtml(hooks) : '';
        const nameHtml = opt
            ? `<span style="font-weight:600;color:#0f172a;">${escapeHtml(resolveOptionDisplayName(state, opt, hooks))}${badge}</span>`
            : '<span style="color:#b45309;font-style:italic;">Sélectionnez une option</span>';
        const pickClass = opt
            ? 'tpl-config-single-pick tpl-config-single-pick--unique'
            : 'tpl-config-single-pick tpl-config-single-pick--unique tpl-config-single-pick--empty';
        return `
            <div style="font-size:12px;font-weight:600;color:#475569;margin-bottom:6px;">${escapeHtml(group.label)}</div>
            <div class="${pickClass}" data-tpl-group="${key}" role="button" tabindex="0"
                style="display:flex;align-items:center;justify-content:space-between;gap:10px;width:100%;max-width:520px;padding:10px 12px;border-radius:6px;cursor:pointer;font-size:14px;">
                <span style="flex:1;min-width:0;">${nameHtml}</span>
                <span style="color:#94a3b8;font-size:18px;line-height:1;flex-shrink:0;">›</span>
            </div>
        `;
    }

    function getNodeCatalogSlots(node) {
        return Array.isArray(node?.slots) ? node.slots : [];
    }

    function getNodeCatalogChildren(node) {
        return Array.isArray(node?.children) ? node.children : [];
    }

    function groupsForNode(node) {
        return getNodeCatalogSlots(node).map(slotToGroup);
    }

    function buildMultiChoicePriceCell(state, group, hooks) {
        const ids = getSelectedInGroup(state, group);
        if (!ids.length) return '<span style="color:#94a3b8;">—</span>';
        let sum = 0;
        ids.forEach((optId) => {
            const opt = findCatalogOption(state, hooks, optId)
                || (group.options || []).find((o) => o.id === optId);
            if (opt && !isImportGeneratedBaseOption(opt) && !isFivePercentCatalogOption(hooks, opt)) {
                sum += catalogUgapPrice(opt);
            }
        });
        return `<span style="font-size:13px;font-weight:600;color:#334155;">${sum.toFixed(2)} €</span>`;
    }

    function buildGroupRowHtml(state, group, hooks, categoryLabel, showCategory) {
        const key = escapeHtml(groupSelectionKey(group));
        const isSingle = group.decisionMode !== 'multi_choice';
        const rowClass = isSingle ? 'tpl-config-row-group tpl-config-row-group--single' : 'tpl-config-row-group';
        let priceCell = '—';
        if (isSingle) {
            const display = getSingleChoiceDisplay(state, group, hooks);
            priceCell = display.option
                ? escapeHtml(formatPrice(display.option, hooks, state))
                : '—';
        } else {
            priceCell = buildMultiChoicePriceCell(state, group, hooks);
        }
        const catCell = showCategory
            ? `<span style="font-size:12px;color:#64748b;font-weight:600;">${escapeHtml(categoryLabel)}</span>`
            : '';
        return `
            <tr class="${rowClass}" data-tpl-group="${key}">
                <td style="vertical-align:top;">${catCell}</td>
                <td style="vertical-align:top;">${buildCol2ChoiceHtml(state, group, hooks)}</td>
                <td style="vertical-align:top;text-align:right;">${priceCell}</td>
            </tr>
        `;
    }

    function applyDevisSingleChoicePick(state, group, hooks, oid) {
        if (isParametrageBaseMode(hooks) && typeof hooks.onParametragePickSingle === 'function') {
            const result = hooks.onParametragePickSingle(state, group, oid);
            if (result && typeof result.then === 'function') {
                return result.then(() => {
                    syncParcoursSelectionsFromMbo(state, hooks);
                    return 'picked';
                });
            }
            syncParcoursSelectionsFromMbo(state, hooks);
            return 'picked';
        }

        const opt = findCatalogOption(state, hooks, oid);
        if (isFivePercentCatalogOption(hooks, opt)) {
            unmarkDevisSlotUserCleared(state, group);
            clearGroupSelection(state, group, oid, hooks);
            if (!applyFivePercentCatalogPick(state, hooks, oid)) return;
            return 'picked';
        }

        unmarkDevisSlotUserCleared(state, group);
        const BAL = global.UgapBaseAdjLinks;
        const ARO = global.UgapAdjReplacementOptions;
        const groupForAdj = { ...group, options: group.options };
        if (BAL?.clearLinkedAdjForGroup) {
            BAL.clearLinkedAdjForGroup(state, groupForAdj);
        }
        if (ARO?.clearLinkedAdjForReplacementPick) {
            ARO.clearLinkedAdjForReplacementPick(state, (id) => findCatalogOption(state, hooks, id));
        }
        clearGroupSelection(state, group, oid, hooks);
        getSelectedInGroup(state, group, hooks).forEach((id) => {
            const sid = String(id || '').trim();
            if (sid && sid !== String(oid || '').trim()) {
                state.selectedOptions.delete(sid);
                state.fivePercentOptions.delete(sid);
            }
        });
        state.selectedOptions.add(oid);
        const addedAdjIds = [];
        const linkedAdjGroup = BAL?.shouldAutoApplyLinkedAdj?.(groupForAdj) === true;
        if (linkedAdjGroup && ARO?.applyLinkedAdjForReplacementPick) {
            const fromRep = ARO.applyLinkedAdjForReplacementPick(
                state,
                oid,
                (id) => findCatalogOption(state, hooks, id)
            );
            if (Array.isArray(fromRep)) addedAdjIds.push(...fromRep);
        }
        if (!addedAdjIds.length && isBaseReplacedInGroup(state, groupForAdj, hooks) && linkedAdjGroup) {
            const defaultBaseId = getGroupBaseOptionId(state, groupForAdj, hooks);
            if (defaultBaseId) {
                const adjGroup = BAL?.effectiveAdjGroupForLinks?.(groupForAdj) || groupForAdj;
                const added = BAL?.applyLinkedAdjToConfiguratorSelection?.(
                    state,
                    defaultBaseId,
                    hooks,
                    (id) => findCatalogOption(state, hooks, id),
                    adjGroup
                );
                if (Array.isArray(added)) {
                    addedAdjIds.push(...added.map((x) => String(x || '').trim()).filter(Boolean));
                }
            }
        }
        state._lastParcoursPickGroup = group;
        state._parcoursPickNeedsFullRefresh = addedAdjIds.length > 0
            || isBaseReplacedInGroup(state, groupForAdj, hooks);
        hooks?.invalidateBillableCache?.();
    }

    function dismissPickerModalUi(state) {
        hidePickerModalImmediate();
        state._templateTreeModalGroup = null;
    }

    function schedulePickerModalRefresh(state, hooks) {
        state._lastParcoursPickGroup = state._templateTreeModalGroup || state._lastParcoursPickGroup || null;
        // Mise à jour immédiate de la ligne (pas de rebuild complet du parcours).
        ugapTplPerfWrap('Tpl.refreshParcoursAfterPick', () => refreshParcoursAfterPick(state, hooks));
        hooks?.updateSummary?.({ lite: true, skipDevisSync: true, skipAdjSync: true });
        if (typeof hooks?.scheduleParcoursUiRefresh === 'function') {
            // Recalcul prix complet (mino/majo liées) en différé uniquement.
            if (state._parcoursPickFullSummaryTimer) {
                clearTimeout(state._parcoursPickFullSummaryTimer);
            }
            state._parcoursPickFullSummaryTimer = setTimeout(() => {
                state._parcoursPickFullSummaryTimer = null;
                hooks.updateSummary?.({ skipDevisSync: true });
            }, 180);
            return;
        }
        if (state._pickerModalRefreshTimer) {
            clearTimeout(state._pickerModalRefreshTimer);
        }
        state._pickerModalRefreshTimer = setTimeout(() => {
            state._pickerModalRefreshTimer = null;
            hooks?.updateSummary?.({ skipDevisSync: true });
            hooks?.onCategoryTableChanged?.();
        }, 16);
    }

    const LINKED_RELATION_LABELS = {
        prerequis: 'Prérequis',
        variante: 'Variante',
        complement: 'Complément',
    };

    /** Bouton œil sur une ligne d'option : liste les options liées (prérequis / variantes) sélectionnables. */
    function appendLinkedOptionsEye(state, hooks, item, container, optionId) {
        if (typeof hooks?.getLinkedOptionsForOption !== 'function') return;
        const oid = String(optionId || '').trim();
        if (!oid) return;
        const linked = hooks.getLinkedOptionsForOption(oid) || [];
        if (!linked.length) return;

        const btn = global.document.createElement('button');
        btn.type = 'button';
        btn.className = 'tpl-linked-eye';
        btn.title = `${linked.length} option(s) liée(s) — prérequis / variantes`;
        btn.innerHTML = `<span aria-hidden="true">👁</span><span class="tpl-linked-eye__count">${linked.length}</span>`;

        const panel = global.document.createElement('div');
        panel.className = 'tpl-linked-panel';
        panel.hidden = true;

        const renderPanel = () => {
            panel.innerHTML = '';
            (hooks.getLinkedOptionsForOption(oid) || []).forEach((lk) => {
                const opt = lk.option || findCatalogOption(state, hooks, lk.id);
                if (!opt) return;
                const row = global.document.createElement('label');
                row.className = 'tpl-linked-row';
                const cb = global.document.createElement('input');
                cb.type = 'checkbox';
                cb.checked = state.selectedOptions.has(lk.id);
                cb.onchange = () => {
                    if (cb.checked) state.selectedOptions.add(lk.id);
                    else state.selectedOptions.delete(lk.id);
                    hooks.invalidateBillableCache?.();
                    hooks.scheduleParcoursUiRefresh?.();
                };
                const badge = global.document.createElement('span');
                badge.className = `tpl-linked-badge tpl-linked-badge--${lk.relation}`;
                badge.textContent = LINKED_RELATION_LABELS[lk.relation] || 'Liée';
                const name = global.document.createElement('span');
                name.className = 'tpl-linked-name';
                name.textContent = resolveOptionDisplayName(state, opt, hooks);
                const price = global.document.createElement('span');
                price.className = 'price';
                price.textContent = formatDevisOptionPrice(state, hooks, opt).text;
                row.appendChild(cb);
                row.appendChild(badge);
                row.appendChild(name);
                row.appendChild(price);
                panel.appendChild(row);
            });
        };

        // stopPropagation : le clic sur l'œil ne doit pas sélectionner la ligne.
        btn.addEventListener('pointerdown', (e) => e.stopPropagation());
        btn.onclick = (e) => {
            e.stopPropagation();
            e.preventDefault();
            panel.hidden = !panel.hidden;
            btn.classList.toggle('is-open', !panel.hidden);
            if (!panel.hidden) renderPanel();
        };
        item.appendChild(btn);
        container.appendChild(panel);
    }

    function appendSingleChoicePickerToModal(state, group, hooks, optionsList, onClose) {
        const afterPick = () => {
            if (typeof onClose === 'function') {
                dismissPickerModalUi(state);
                onClose();
                return;
            }
            schedulePickerModalRefresh(state, hooks);
        };
        const hint = global.document.createElement('p');
        hint.style.cssText = 'color:#666;margin:0 0 12px;font-size:13px;';
        hint.textContent = 'Cliquez sur une option pour la sélectionner ; recliquez sur la même pour décocher.';
        optionsList.appendChild(hint);

        const clearBtn = global.document.createElement('button');
        clearBtn.type = 'button';
        clearBtn.className = 'btn btn-secondary ugap-devis-modal-clear';
        clearBtn.style.cssText = 'margin-bottom:12px;width:100%;';
        clearBtn.textContent = 'Aucune option sélectionnée';
        clearBtn.onclick = () => {
            dismissPickerModalUi(state);
            const result = clearDevisSingleChoiceSlot(state, group, hooks);
            if (result && typeof result.then === 'function') {
                result.then(afterPick);
                return;
            }
            afterPick();
        };
        optionsList.appendChild(clearBtn);

        const list = global.document.createElement('div');
        list.className = 'options-list';
        const baseId = getGroupBaseOptionId(state, group, hooks);
        const MBO = getModelBaseOptions();
        const model = state.selectedModel;
        const slot = groupToSlot(group);
        let rows = [];

        if (MBO?.getChoiceRows && model) {
            syncModelBaseBridge(state);
            const baseOnly = isParametrageBaseMode(hooks);
            rows = filterStandardChoiceRows(state, hooks, MBO.getChoiceRows(model, slot, { baseOnly }) || [], group);
        }
        if (!rows.length) {
            const ODN = global.UgapOptionDisplayName;
            const models = Array.isArray(state?.models) ? state.models : [];
            const modelId = String(model?.id || '').trim();
            rows = filterStandardChoiceRows(state, hooks, getGroupChoiceOptionsForPicker(group, hooks, model)
                .map((opt) => {
                    const displayName = ODN?.resolveOptionDisplayName
                        ? ODN.resolveOptionDisplayName(opt, { models, modelId })
                        : String(opt.name || opt.id || '').trim();
                    return {
                        id: String(opt.id || '').trim(),
                        name: String(displayName || opt.name || opt.id || '').trim(),
                        refUgap: String(opt.refUgap || opt.baseRefUgap || '').trim(),
                        details: ODN?.resolveOptionDisplayDetails
                            ? ODN.resolveOptionDisplayDetails(opt, displayName)
                            : String(opt.details || '').trim(),
                        isBaseOption: String(opt.id || '').trim() === baseId,
                    };
                })
                .filter((row) => row.id), group);
        }

        if (baseId && !rows.some((row) => String(row?.id || '').trim() === baseId)) {
            const baseOpt = findOptionInGroupOrCatalog(state, group, hooks, baseId);
            if (baseOpt) {
                const ODN = global.UgapOptionDisplayName;
                const models = Array.isArray(state?.models) ? state.models : [];
                const modelId = String(model?.id || '').trim();
                const displayName = ODN?.resolveOptionDisplayName
                    ? ODN.resolveOptionDisplayName(baseOpt, { models, modelId })
                    : String(baseOpt.name || baseId).trim();
                rows.unshift({
                    id: baseId,
                    name: String(displayName || baseOpt.name || baseId).trim(),
                    refUgap: String(baseOpt.refUgap || baseOpt.baseRefUgap || '').trim(),
                    details: ODN?.resolveOptionDisplayDetails
                        ? ODN.resolveOptionDisplayDetails(baseOpt, displayName)
                        : String(baseOpt.details || '').trim(),
                    isBaseOption: true,
                });
            }
        }

        const displayed = getSingleChoiceDisplay(state, group, hooks)?.option;
        const displayedId = String(displayed?.id || '').trim();
        if (displayedId && !rows.some((row) => String(row?.id || '').trim() === displayedId)) {
            const ODN = global.UgapOptionDisplayName;
            const models = Array.isArray(state?.models) ? state.models : [];
            const modelId = String(model?.id || '').trim();
            const displayName = ODN?.resolveOptionDisplayName
                ? ODN.resolveOptionDisplayName(displayed, { models, modelId })
                : String(displayed.name || displayedId).trim();
            rows.unshift({
                id: displayedId,
                name: String(displayName || displayed.name || displayedId).trim(),
                refUgap: String(displayed.refUgap || displayed.baseRefUgap || '').trim(),
                details: ODN?.resolveOptionDisplayDetails
                    ? ODN.resolveOptionDisplayDetails(displayed, displayName)
                    : String(displayed.details || '').trim(),
                isBaseOption: displayedId === baseId,
            });
        }

        if (!rows.length) {
            list.innerHTML = '<p style="color:#666;">Aucune option dans ce groupe pour ce modèle. Vérifiez la famille (onglet Famille) et les affectations (onglet Options).</p>';
            optionsList.appendChild(list);
            if (typeof hooks?.appendFivePercentCustomPickerToList === 'function') {
                hooks.appendFivePercentCustomPickerToList(list, group, 'single', {
                    onClose: afterPick
                });
            }
            if (typeof hooks?.appendFivePercentOptionForm === 'function') {
                hooks.appendFivePercentOptionForm(optionsList, group, {
                    onAdded: () => hooks.refreshTemplateTreePickerModal?.(group)
                });
            }
            return;
        }

        rows.forEach((row) => {
            const oid = String(row.id || '').trim();
            const opt = findOptionInGroupOrCatalog(state, group, hooks, oid)
                || findCatalogOption(state, hooks, oid);
            if (!opt) return;
            const item = global.document.createElement('div');
            item.className = 'option-item tpl-single-choice-option';
            item.style.cursor = 'pointer';
            const displayRow = getSingleChoiceDisplay(state, group, hooks);
            const selected = String(displayRow?.option?.id || '').trim() === oid;
            const isBase = oid === baseId;
            if (selected) item.classList.add('tpl-single-choice-option--selected');
            else if (isBase) item.classList.add('tpl-single-choice-option--base');
            const baseTag = isBase ? ' <span style="font-size:11px;color:#059669;">(base)</span>' : '';
            item.innerHTML = `
                <span style="flex:1;">${escapeHtml(row.name || resolveOptionDisplayName(state, opt, hooks))}${baseTag}</span>
                <span class="price">${formatDevisOptionPrice(state, hooks, opt).text}</span>
            `;
            item.onclick = () => {
                dismissPickerModalUi(state);
                const display = getSingleChoiceDisplay(state, group, hooks);
                const currentId = String(display?.option?.id || '').trim();
                if (currentId === oid) {
                    // Base affichée par défaut (implicite) : confirmer, ne pas décocher.
                    if (display?.isBaseDefault && !display?.isExplicitSelection) {
                        applyDevisSingleChoicePick(state, group, hooks, oid);
                        afterPick();
                        return;
                    }
                    const cleared = clearDevisSingleChoiceSlot(state, group, hooks);
                    if (cleared && typeof cleared.then === 'function') {
                        cleared.then(afterPick);
                        return;
                    }
                    afterPick();
                    return;
                }
                applyDevisSingleChoicePick(state, group, hooks, oid);
                afterPick();
            };
            list.appendChild(item);
            appendLinkedOptionsEye(state, hooks, item, list, oid);
        });
        if (typeof hooks?.appendFivePercentCustomPickerToList === 'function') {
            hooks.appendFivePercentCustomPickerToList(list, group, 'single', {
                onClose: afterPick
            });
        }
        optionsList.appendChild(list);
        if (typeof hooks?.appendFivePercentOptionForm === 'function') {
            hooks.appendFivePercentOptionForm(optionsList, group, {
                onAdded: () => hooks.refreshTemplateTreePickerModal?.(group)
            });
        }
    }

    function getTplOptionByIdMap(state) {
        const catCount = (Array.isArray(state.categories) ? state.categories : []).length;
        const key = String(catCount);
        if (state._tplOptionByIdMap && state._tplOptionByIdMapKey === key) {
            return state._tplOptionByIdMap;
        }
        const map = buildOptionById(Array.isArray(state.categories) ? state.categories : []);
        state._tplOptionByIdMap = map;
        state._tplOptionByIdMapKey = key;
        return map;
    }

    function hydrateGroupOptions(state, group) {
        const g = group && typeof group === 'object' ? group : {};
        let ids = (Array.isArray(g.optionIds) ? g.optionIds : [])
            .map((x) => String(x || '').trim())
            .filter(Boolean);
        if (!ids.length && g._slot) {
            ids = (Array.isArray(g._slot.groupOptionIds) ? g._slot.groupOptionIds : [])
                .map((x) => String(x || '').trim())
                .filter(Boolean);
        }
        if (!ids.length) return g;
        const map = getTplOptionByIdMap(state);
        const mid = String(state?.selectedModel?.id || '').trim();
        const pick = typeof state.passesCategoryTableModelFilter === 'function'
            ? (opt) => state.passesCategoryTableModelFilter(opt, state.selectedModel)
            : (typeof state.isOptionCompatibleWithSelectedModel === 'function'
                ? state.isOptionCompatibleWithSelectedModel
                : () => true);
        const keepOption = (opt) => {
            if (!opt) return false;
            // compatibleModels prime : pas de passe-droit "option de base".
            const comp = Array.isArray(opt?.compatibleModels) ? opt.compatibleModels.map(String) : [];
            if (mid && comp.length) return comp.includes(mid);
            return pick(opt);
        };
        const options = ids
            .map((id) => map.get(id))
            .filter((opt) => keepOption(opt));
        return { ...g, optionIds: ids, options };
    }

    function showPickerModalLoadingShell(titleText, wide) {
        const modal = global.document.getElementById('subcategory-modal');
        const title = global.document.getElementById('subcategory-modal-title');
        const optionsList = global.document.getElementById('subcategory-options-list');
        if (!modal || !title || !optionsList) return null;
        const content = modal.querySelector('.modal-content');
        if (content) content.classList.toggle('modal-wide', !!wide);
        title.textContent = titleText;
        optionsList.innerHTML = `
            <div class="ugap-modal-options-loading" style="padding:24px 12px;text-align:center;color:#64748b;">
                <div class="loader" style="margin:0 auto 14px;"></div>
                <span style="font-size:14px;font-weight:600;">Chargement des options…</span>
            </div>`;
        modal.classList.add('active');
        return { modal, optionsList };
    }

    function openSingleChoiceModal(state, group, hooks) {
        group = hydrateGroupOptions(state, group);
        state.familyModalContext = null;
        state._templateTreeModalGroup = group;
        const slot = groupToSlot(group);
        const shell = showPickerModalLoadingShell(
            devisPickerModalTitle(slot, getCatalogNodesForParcours(), group.label),
            false
        );
        if (!shell) return;
        global.requestAnimationFrame(() => {
            if (!shell.modal.classList.contains('active')) return;
            try {
                shell.optionsList.innerHTML = '';
                appendSingleChoicePickerToModal(state, group, hooks, shell.optionsList);
            } catch (err) {
                console.error('[UGAP][openSingleChoiceModal]', err);
                shell.optionsList.innerHTML = '<p style="color:#b45309;">Impossible de charger les options. Rechargez la page (Ctrl+F5).</p>';
            }
        });
    }

    function normalizeFamilyGroupForConfigurator(family, group) {
        const fam = family && typeof family === 'object' ? family : {};
        const g = group && typeof group === 'object' ? group : {};
        const optionIds = (Array.isArray(g.optionIds) ? g.optionIds : [])
            .map((x) => String(x || '').trim())
            .filter(Boolean);
        const fallbackOptionIds = (Array.isArray(g.options) ? g.options : [])
            .map((opt) => {
                if (typeof opt === 'string') return String(opt || '').trim();
                return String(opt?.id || '').trim();
            })
            .filter(Boolean);
        const mergedOptionIds = Array.from(new Set([...(optionIds || []), ...fallbackOptionIds]));
        const priceMode = String(g.priceMode || g.pricingMode || 'option').trim().toLowerCase();
        return {
            familyLabel: String(fam.name || fam.familyLabel || '').trim(),
            groupId: String(g.id || '').trim(),
            label: String(g.label || g.id || '').trim(),
            decisionMode: g.decisionMode || 'single_choice',
            priceMode,
            pricingMode: priceMode,
            optionIds: mergedOptionIds,
            options: Array.isArray(g.options) ? g.options : [],
            defaultOptionId: String(fam.defaultOptionId || '').trim() || undefined
        };
    }

    function renderFamilyGroupsConfiguratorTable(state, families, hooks, container) {
        const list = Array.isArray(families) ? families : [];
        const groups = [];
        list.forEach((fam) => {
            (Array.isArray(fam?.decisionGroups) ? fam.decisionGroups : []).forEach((g) => {
                const norm = hydrateGroupOptions(state, normalizeFamilyGroupForConfigurator(fam, g));
                if ((norm.optionIds || []).length) groups.push(norm);
            });
        });
        ensureSingleChoiceDefaultsForGroups(state, groups, hooks);
        if (!groups.length) {
            container.innerHTML = '<p style="color:#666;">Aucun groupe de décision pour ce modèle.</p>';
            return;
        }
        const rows = [];
        let prevCol1 = '';
        list.forEach((fam) => {
            (Array.isArray(fam?.decisionGroups) ? fam.decisionGroups : []).forEach((g) => {
                const norm = hydrateGroupOptions(state, normalizeFamilyGroupForConfigurator(fam, g));
                if (!(norm.optionIds || []).length) return;
                const col1 = String(fam.categoryName || norm.familyLabel || '').trim() || '—';
                const showCategory = col1 !== prevCol1;
                rows.push(buildGroupRowHtml(state, norm, hooks, col1, showCategory));
                prevCol1 = col1;
            });
        });
        container.innerHTML = `
            <div class="excel-options-wrap" id="ugap-family-config-table">
                <div class="excel-options-scroll">
                    <table class="excel-options-table tpl-config-table">
                        <thead>
                            <tr>
                                <th style="width:140px;">Famille</th>
                                <th>Option</th>
                                <th style="width:120px;text-align:right;">Prix UGAP HT</th>
                            </tr>
                        </thead>
                        <tbody id="ugap-family-config-tbody">${rows.join('')}</tbody>
                    </table>
                </div>
            </div>
        `;
        const tbody = container.querySelector('#ugap-family-config-tbody');
        if (!tbody) return;
        const groupByKey = new Map(groups.map((g) => [groupSelectionKey(g), g]));
        const openSingleFromEl = (el, e) => {
            e?.stopPropagation?.();
            const g = groupByKey.get(el.getAttribute('data-tpl-group'));
            if (g) openSingleChoiceModal(state, g, hooks);
        };
        tbody.querySelectorAll('.tpl-config-single-pick').forEach((el) => {
            el.addEventListener('click', (e) => openSingleFromEl(el, e));
        });
        tbody.querySelectorAll('.tpl-config-row-group--single').forEach((tr) => {
            tr.addEventListener('click', (e) => {
                if (e.target.closest('.tpl-config-chip-remove, .tpl-config-multi-add')) return;
                openSingleFromEl(tr, e);
            });
        });
        tbody.querySelectorAll('.tpl-config-multi-add').forEach((btn) => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const g = groupByKey.get(btn.getAttribute('data-tpl-group'));
                if (g) openMultiChoiceModal(state, g, hooks);
            });
        });
        tbody.querySelectorAll('.tpl-config-chip-remove').forEach((btn) => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const optId = String(btn.getAttribute('data-tpl-opt') || '').trim();
                if (!optId) return;
                state.selectedOptions.delete(optId);
                state.fivePercentOptions.delete(optId);
                hooks.updateSummary?.();
                renderFamilyGroupsConfiguratorTable(state, families, hooks, container);
            });
        });
    }

    function openMultiChoiceModal(state, group, hooks) {
        group = hydrateGroupOptions(state, group);
        ensureMultiChoiceGroupDefault(state, group, hooks);
        state.familyModalContext = null;
        state._templateTreeModalGroup = group;
        const slotMc = groupToSlot(group);
        const shell = showPickerModalLoadingShell(
            devisPickerModalTitle(slotMc, getCatalogNodesForParcours(), group.label, '(choix multiple)'),
            false
        );
        if (!shell) return;
        global.requestAnimationFrame(() => {
            if (!shell.modal.classList.contains('active')) return;
            try {
                buildMultiChoiceModalContent(state, group, hooks, shell.optionsList);
            } catch (err) {
                console.error('[UGAP][openMultiChoiceModal]', err);
                shell.optionsList.innerHTML = '<p style="color:#b45309;">Impossible de charger les options. Rechargez la page (Ctrl+F5).</p>';
            }
        });
    }

    function buildMultiChoiceModalContent(state, group, hooks, optionsList) {
        optionsList.innerHTML = '';

        const draft = new Set(getSelectedInGroup(state, group));
        const MBO = getModelBaseOptions();
        const model = state.selectedModel;
        const slot = groupToSlot(group);
        let rows = [];
        if (MBO?.getChoiceRows && model) {
            syncModelBaseBridge(state);
            const baseOnly = isParametrageBaseMode(hooks);
            rows = filterStandardChoiceRows(state, hooks, MBO.getChoiceRows(model, slot, { baseOnly }) || [], group);
        }
        if (!rows.length) {
            const ODN = global.UgapOptionDisplayName;
            const models = Array.isArray(state?.models) ? state.models : [];
            const modelId = String(model?.id || '').trim();
            rows = filterStandardChoiceRows(state, hooks, (Array.isArray(group.options) ? group.options : [])
                .map((opt) => ({
                    id: String(opt?.id || '').trim(),
                    name: ODN?.resolveOptionDisplayName
                        ? ODN.resolveOptionDisplayName(opt, { models, modelId })
                        : String(opt?.name || '').trim(),
                    isBaseOption: String(opt?.id || '').trim() === String(getGroupBaseOptionId(state, group, hooks) || '').trim(),
                }))
                .filter((row) => row.id), group);
        }

        const multiBaseIds = new Set();
        const multiBaseId = String(getGroupBaseOptionId(state, group, hooks) || '').trim();
        if (multiBaseId) multiBaseIds.add(multiBaseId);
        if (MBO?.getConfiguratorDefaultPickIds && model) {
            MBO.getConfiguratorDefaultPickIds(String(model.id || '').trim(), slot).forEach((id) => {
                const oid = String(id || '').trim();
                if (oid) multiBaseIds.add(oid);
            });
        }
        multiBaseIds.forEach((baseId) => {
            if (!baseId || rows.some((row) => String(row?.id || '').trim() === baseId)) return;
            const baseOpt = findOptionInGroupOrCatalog(state, group, hooks, baseId);
            if (!baseOpt) return;
            const ODN = global.UgapOptionDisplayName;
            const models = Array.isArray(state?.models) ? state.models : [];
            const modelId = String(model?.id || '').trim();
            rows.unshift({
                id: baseId,
                name: ODN?.resolveOptionDisplayName
                    ? ODN.resolveOptionDisplayName(baseOpt, { models, modelId })
                    : String(baseOpt.name || baseId).trim(),
                isBaseOption: true,
            });
        });

        rows.forEach((row) => {
            const oid = String(row.id || '').trim();
            const opt = findOptionInGroupOrCatalog(state, group, hooks, oid)
                || findCatalogOption(state, hooks, oid);
            if (!opt) return;
            const item = global.document.createElement('div');
            item.className = 'option-item';
            const cb = global.document.createElement('input');
            cb.type = 'checkbox';
            cb.id = `tpl-mc-${oid}`;
            cb.checked = draft.has(oid);
            cb.onchange = () => {
                if (cb.checked) draft.add(oid);
                else draft.delete(oid);
            };
            const label = global.document.createElement('label');
            label.htmlFor = cb.id;
            label.innerHTML = `${escapeHtml(resolveMultiChoiceOptionLabel(state, opt, hooks, row.name))}`;
            label.style.flex = '1';
            label.style.marginLeft = '10px';
            const price = global.document.createElement('div');
            price.className = 'price';
            price.textContent = formatDevisOptionPrice(state, hooks, opt).text;
            item.appendChild(cb);
            item.appendChild(label);
            item.appendChild(price);
            optionsList.appendChild(item);
            appendLinkedOptionsEye(state, hooks, item, optionsList, oid);
        });

        const mcList = global.document.createElement('div');
        mcList.className = 'options-list';
        if (typeof hooks?.appendFivePercentCustomPickerToList === 'function') {
            hooks.appendFivePercentCustomPickerToList(mcList, group, 'multi');
        }
        if (mcList.childNodes.length) optionsList.appendChild(mcList);

        if (typeof hooks?.appendFivePercentOptionForm === 'function') {
            hooks.appendFivePercentOptionForm(optionsList, group, {
                onAdded: () => hooks.refreshTemplateTreePickerModal?.(group)
            });
        }

        const actions = global.document.createElement('div');
        actions.style.cssText = 'margin-top:16px;display:flex;gap:10px;justify-content:flex-end;';
        const cancel = global.document.createElement('button');
        cancel.type = 'button';
        cancel.className = 'btn btn-secondary';
        cancel.textContent = 'Annuler';
        cancel.onclick = () => finishConfiguratorPickerModal(state, hooks);
        const ok = global.document.createElement('button');
        ok.type = 'button';
        ok.className = 'btn btn-primary';
        ok.textContent = 'Valider';
        ok.onclick = () => {
            dismissPickerModalUi(state);
            if (isParametrageBaseMode(hooks) && typeof hooks.onParametragePickMulti === 'function') {
                const result = hooks.onParametragePickMulti(state, group, Array.from(draft));
                const finish = () => {
                    syncParcoursSelectionsFromMbo(state, hooks);
                    schedulePickerModalRefresh(state, hooks);
                };
                if (result && typeof result.then === 'function') {
                    result.then(finish);
                    return;
                }
                finish();
                return;
            }
            clearGroupSelection(state, group);
            draft.forEach((id) => {
                const opt = findCatalogOption(state, hooks, id);
                if (isFivePercentCatalogOption(hooks, opt)) {
                    applyFivePercentCatalogPick(state, hooks, id);
                    return;
                }
                state.selectedOptions.add(id);
            });
            state._lastParcoursPickGroup = group;
            state._parcoursPickNeedsFullRefresh = false;
            schedulePickerModalRefresh(state, hooks);
        };
        actions.appendChild(cancel);
        actions.appendChild(ok);
        optionsList.appendChild(actions);
    }

    function hidePickerModalImmediate() {
        const modal = global.document.getElementById('subcategory-modal');
        if (!modal) return;
        if (typeof global.closeUgapModal === 'function') global.closeUgapModal(modal);
        else modal.classList.remove('active');
        modal.querySelector('.modal-content')?.classList.remove('modal-wide');
    }

    /** Fermeture picker annulation (sans recalcul). */
    function finishConfiguratorPickerModal(state, hooks) {
        dismissPickerModalUi(state);
    }

    function closeTemplateTreeModal(state, hooks) {
        dismissPickerModalUi(state);
        schedulePickerModalRefresh(state, hooks);
    }

    /** true = ne pas afficher le vieux parcours vues métier / familles */
    function shouldUseTemplateTree(state) {
        return modelRequiresTemplate(state);
    }

    function onModelSelected(state) {
        state.templateTreePath = [];
        state._boatTemplateResolved = null;
        state.templateTreeRootIndex = editorTreeHasParcours(getModelBaseEditorTree(state)) ? 0 : -1;
    }

    function getModelTabLabel(state) {
        return String(state.selectedModel?.name || state.selectedModel?.label || 'Modèle').trim() || 'Modèle';
    }

    function isModelCategoryTabActive(state) {
        return Number(state.templateTreeRootIndex) === -1;
    }

    function renderModelCategoryTab(state, hooks, status) {
        const h = hooks && typeof hooks === 'object' ? hooks : {};
        const subContainer = h.subcategoriesContainer;
        const optContainer = h.optionsContainer;
        if (subContainer) subContainer.innerHTML = '';
        if (!optContainer) return;

        const tplLabel = String(status?.tpl?.label || h.getBoatTemplateLabel?.() || '').trim();
        const modelName = escapeHtml(getModelTabLabel(state));
        const banner = tplLabel
            ? `<p class="ugap-config-model-banner" style="margin:0 0 12px;padding:10px 14px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;font-size:13px;color:#1e40af;">
                Modèle <strong>${modelName}</strong> — ordre des options <strong>${escapeHtml(tplLabel)}</strong>
            </p>`
            : `<p class="ugap-config-model-banner" style="margin:0 0 12px;padding:10px 14px;background:#fffbeb;border:1px solid #fcd34d;border-radius:8px;font-size:13px;color:#92400e;">
                Modèle <strong>${modelName}</strong> — aucun ordre des options lié.
            </p>`;

        if (typeof h.renderCategoryTable === 'function') {
            h.renderCategoryTable(optContainer, { bannerHtml: banner });
        } else {
            optContainer.innerHTML = `${banner}<p style="color:#666;">Tableau catégories indisponible.</p>`;
        }
    }

    global.UgapConfiguratorTemplateTree = {
        modelRequiresTemplate,
        getTemplateConfiguratorStatus,
        shouldUseTemplateTree,
        ensureResolved,
        renderTemplateTreeStep3,
        renderTemplateTreeStep3Progressive,
        mountCatalogParcoursShell,
        fillDevisTableProgressive,
        renderCatalogParcoursPanel,
        syncParcoursSelectionsFromMbo,
        renderFamilyGroupsConfiguratorTable,
        openSingleChoiceModal,
        openMultiChoiceModal,
        hydrateGroupOptions,
        appendSingleChoicePickerToModal,
        ensureSingleChoiceGroupDefault,
        ensureMultiChoiceGroupDefault,
        ensureSingleChoiceDefaultsForGroups,
        applyDefaultSelectionsForParcours,
        forEachParcoursDecisionGroup,
        getSingleChoiceDisplay,
        getGroupBaseOptionId,
        isBaseReplacedInGroup,
        isIbpReplacedInGroup,
        normalizeFamilyGroupForConfigurator,
        closeTemplateTreeModal,
        hidePickerModalImmediate,
        schedulePickerModalRefresh,
        finishConfiguratorPickerModal,
        clearGroupSelection,
        onModelSelected,
        getBoatTemplateForModel,
        refreshDevisTableChoiceCells,
        refreshDevisTableGroupRows,
        refreshParcoursAfterPick,
        cancelParcoursProgressiveFill,
        appendParcoursBillableOptionIds,
        collectParcoursOrderedBillableOptionIds,
        collectParcoursOrderedDisplayOptionIds,
        collectOrphanConfiguratorOptionIds,
        collectDevisOptionCategoryMap,
        collectDevisModelCategory,
        forEachParcoursSingleChoiceGroup,
        getParcoursMixedSiblingIds,
        getParcoursOrderedSiblings,
        getReorderSiblingList,
    };
})(typeof window !== 'undefined' ? window : global);
