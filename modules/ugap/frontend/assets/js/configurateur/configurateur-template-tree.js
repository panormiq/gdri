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
        return MBO.buildModelBaseEditorTree(model) || { roots: [], orphanSlots: [] };
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
        return {
            familyLabel: String(s.familyLabel || '').trim(),
            groupId: String(s.groupId || '').trim(),
            label: title || String(s.groupId || '').trim(),
            categoryName: String(s.categoryName || s.familyLabel || '').trim(),
            catalogNodeId: String(s.catalogNodeId || '').trim() || undefined,
            decisionMode: isMulti ? 'multi_choice' : 'single_choice',
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
        markDevisSlotUserCleared(state, group);
        global.UgapBaseAdjLinks?.clearLinkedAdjForGroup?.(state, group);
        clearGroupSelection(state, group);
        hooks.updateSummary?.();
    }

    function getModelBaseOptions() {
        return global.UgapModelBaseOptions;
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

    function getSelectedInGroup(state, group) {
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
        return Array.from(found);
    }

    function getSingleSelectedOption(state, group, hooks) {
        const selected = getSelectedInGroup(state, group);
        if (!selected.length) return null;
        const map = new Map((group.options || []).map((o) => [o.id, o]));
        return map.get(selected[0]) || findCatalogOption(state, hooks, selected[0]);
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
        if (!/\b(moteur|motorisation)\b/i.test(name) || name.length < 55) return false;
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
        if (!comp.length) return !!opt.isDivers;
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
     * On ne fournit pas le moteur / produit de base du groupe (choix ≠ base assignée).
     * → minoration « non fourniture du moteur de base » si groupe en prix minoration.
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
        return !!String(state.selectedModel?.boatTemplateId || '').trim();
    }

    function getBoatTemplateForModel(state) {
        syncModelBaseBridge(state);
        const tid = String(state.selectedModel?.boatTemplateId || '').trim();
        if (!tid) return null;
        const MBO = getModelBaseOptions();
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

    function buildOptionById(categories) {
        const T = Tree();
        if (T?.buildCatalogueOptionById) return T.buildCatalogueOptionById(categories);
        return new Map();
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
        const mboStatus = getModelBaseOptions()?.getStatus?.(model) || { slots: [] };
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
            missing_template: `Template « ${escapeHtml(tid)} » introuvable. Enregistrez-le dans Paramétrage → Bateau de base, puis rechargez cette page.`,
            empty_tree: 'Aucun nœud catalogue pour ce bateau de base — créez l’arborescence dans Paramétrage → Catalogue, enregistrez le template Bateau de base, et liez-le au modèle.',
            catalog_nodes_missing: 'Le catalogue publié n’est pas chargé dans le configurateur. Rechargez la page (Ctrl+F5). Si le paramétrage affiche bien l’arbre, republiez les données UGAP.',
            no_groups: 'Aucun poste catalogue sur ce modèle. Assignez les options de base par nœud dans Modèles → Définir options de base.',
            module_unavailable: 'Module template bateau non chargé (boat-template-tree.js). Rechargez la page (Ctrl+F5).',
            catalog_core_unavailable: 'Module catalogue non chargé (catalogue-nodes-core.js). Rechargez la page (Ctrl+F5).',
        };
        const msg = messages[status.reason] || 'Configuration template invalide.';

        if (opt) {
            opt.innerHTML = `<div style="padding:16px;border:2px solid #f59e0b;border-radius:8px;background:#fffbeb;color:#92400e;font-size:14px;line-height:1.5;">
                <strong>Parcours template bateau</strong> (pas les vues métier)<br><br>${msg}
            </div>`;
        }
        if (typeof h.setStep3Hint === 'function') {
            h.setStep3Hint(true, status.reason);
        }
        return true;
    }

    function clearGroupSelection(state, group, exceptId) {
        const slot = groupToSlot(group);
        collectChoiceIdsForSlot(state, slot).forEach((id) => {
            if (exceptId && id === exceptId) return;
            state.selectedOptions.delete(id);
            state.fivePercentOptions.delete(id);
        });
        (Array.isArray(group?.options) ? group.options : []).forEach((opt) => {
            const oid = String(opt?.id || '').trim();
            if (!oid || (exceptId && oid === exceptId)) return;
            state.selectedOptions.delete(oid);
            state.fivePercentOptions.delete(oid);
        });
    }

    /* ——— Parcours étape 3 (création devis) : tableau Famille | Poste | Option | Prix + modals ——— */

    function parcoursChoiceRows(state, slot) {
        syncModelBaseBridge(state);
        const model = state.selectedModel;
        const MBO = getModelBaseOptions();
        if (!MBO?.getChoiceRows || !model) return [];
        return MBO.getChoiceRows(model, slot, { baseOnly: false }) || [];
    }

    function parcoursSlotChoiceCount(state, slot) {
        return parcoursChoiceRows(state, slot).length;
    }

    function parcoursSelectedIds(state, slot) {
        const out = [];
        const seen = new Set();
        parcoursChoiceRows(state, slot).forEach((row) => {
            const id = String(row?.id || '').trim();
            if (!id || seen.has(id)) return;
            if (state.selectedOptions.has(id) || state.fivePercentOptions.has(id)) {
                seen.add(id);
                out.push(id);
            }
        });
        return out;
    }

    function clearSlotSelection(state, slot, exceptId) {
        parcoursChoiceRows(state, slot).forEach((row) => {
            const id = String(row?.id || '').trim();
            if (!id || (exceptId && id === exceptId)) return;
            state.selectedOptions.delete(id);
            state.fivePercentOptions.delete(id);
        });
    }

    function parcoursSlotPriceSum(state, slot, hooks) {
        let sum = 0;
        parcoursSelectedIds(state, slot).forEach((id) => {
            const opt = findCatalogOption(state, hooks, id);
            if (!opt || isImportGeneratedBaseOption(opt)) return;
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
        if (isOptionIncludedInDevis(hooks, opt)) {
            return { text: 'Inclus', included: true };
        }
        return { text: formatPrice(opt, hooks), included: false };
    }

    function parcoursProgress(state, hooks) {
        const tree = getModelBaseEditorTree(state);
        const slots = collectParcoursSlots(tree).filter((s) => parcoursSlotChoiceCount(state, s) > 0);
        const done = slots.filter((s) => parcoursSelectedIds(state, s).length > 0).length;
        return { total: slots.length, done };
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

    function applyDefaultSelectionsForParcours(state, hooks) {
        syncModelBaseBridge(state);
        collectParcoursSlots(getModelBaseEditorTree(state)).forEach((slot) => {
            if (parcoursSlotChoiceCount(state, slot) <= 0) return;
            const g = hydrateGroupOptions(state, slotToGroup(slot));
            if (g.decisionMode === 'multi_choice') {
                ensureMultiChoiceGroupDefault(state, g, hooks);
            } else {
                ensureSingleChoiceGroupDefault(state, g, hooks);
            }
        });
    }

    function getCatalogNodesForParcours() {
        return getModelBaseOptions()?.getCatalogNodesForRuntime?.() || [];
    }

    function catalogNodeIdFromSlot(slot) {
        const s = slot && typeof slot === 'object' ? slot : {};
        const direct = String(s.catalogNodeId || '').trim();
        if (direct) return direct;
        const gid = String(s.groupId || '').trim();
        return gid.startsWith('cn_') ? gid.slice(3) : '';
    }

    /** Col. 1 = catégorie racine catalogue, col. 2 = chemin sous la racine (ou poste sur racine). */
    function catalogNodeCategoryLabels(catalogNodes, catalogNodeId, slot) {
        const cnId = String(catalogNodeId || '').trim();
        const poste = String(slot?.groupLabel || slot?.groupId || '').trim();
        if (!cnId) {
            return { categorie: '—', sousNoeud: poste || '—' };
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
            return { categorie: cnId, sousNoeud: poste || '—' };
        }
        const categorie = String(chain[0].label || chain[0].id || '').trim() || '—';
        if (chain.length === 1) {
            return { categorie, sousNoeud: poste || '—' };
        }
        const pathBelowRoot = chain
            .slice(1)
            .map((n) => String(n.label || n.id || '').trim())
            .filter(Boolean);
        return {
            categorie,
            sousNoeud: pathBelowRoot.join(' › ') || poste || '—',
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
        return { categorie: 'Autres', sousNoeud: fallback };
    }

    function devisPickerModalTitle(slot, catalogNodes, fallbackLabel, suffix) {
        const { categorie, sousNoeud } = slotTableColumnLabels(slot, catalogNodes);
        const tail = suffix ? ` ${suffix}` : '';
        if (sousNoeud && sousNoeud !== '—') {
            return `${categorie} — ${sousNoeud}${tail}`;
        }
        return `${categorie || fallbackLabel || 'Choix'}${tail}`;
    }

    function collectDevisTableRowDefs(state, hooks, tree, catalogNodes) {
        const rows = [];
        let lastCategorie = '';
        /** Catégorie à afficher sur la prochaine ligne réellement émise (pas seulement slotIdx 0). */
        let pendingCategorieCell = false;

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

        const pushSlot = (slot, categorie, sousNoeud, showSousNoeud) => {
            if (!parcoursSlotChoiceCount(state, slot)) return;
            const group = hydrateGroupOptions(state, slotToGroup(slot));
            const isMulti = getModelBaseOptions()?.isMultiChoiceSlot?.(slot) === true
                || group.decisionMode === 'multi_choice';

            if (isMulti) {
                const ids = parcoursSelectedIds(state, slot);
                if (!ids.length) {
                    rows.push({
                        group,
                        slot,
                        categorie,
                        sousNoeud,
                        showCategorie: takeShowCategorie(),
                        showSousNoeud,
                        mode: 'multi_empty',
                    });
                    return;
                }
                ids.forEach((optId, idx) => {
                    rows.push({
                        group,
                        slot,
                        categorie,
                        sousNoeud,
                        showCategorie: idx === 0 ? takeShowCategorie() : false,
                        showSousNoeud: showSousNoeud && idx === 0,
                        mode: 'multi_line',
                        optId,
                    });
                });
                rows.push({
                    group,
                    slot,
                    categorie,
                    sousNoeud,
                    showCategorie: false,
                    showSousNoeud: false,
                    mode: 'multi_pick',
                });
                return;
            }

            rows.push({
                group,
                slot,
                categorie,
                sousNoeud,
                showCategorie: takeShowCategorie(),
                showSousNoeud,
                mode: 'single',
            });
        };

        const walkNode = (node) => {
            const cnId = String(node?.catalogNodeId || node?.nodeId || '').trim();
            const slotsOnNode = Array.isArray(node?.slots) ? node.slots : [];
            slotsOnNode.forEach((slot) => {
                const { categorie, sousNoeud } = catalogNodeCategoryLabels(catalogNodes, cnId, slot);
                markCategorieColumn(categorie);
                pushSlot(slot, categorie, sousNoeud, true);
            });
            (Array.isArray(node?.children) ? node.children : []).forEach((child) => walkNode(child));
        };

        (Array.isArray(tree?.roots) ? tree.roots : []).forEach(walkNode);

        (Array.isArray(tree?.orphanSlots) ? tree.orphanSlots : []).forEach((slot) => {
            const { categorie, sousNoeud } = slotTableColumnLabels(slot, catalogNodes);
            markCategorieColumn(categorie);
            pushSlot(slot, categorie, sousNoeud, true);
        });

        return rows;
    }

    function getLinkedAdjIdsForReplacedBaseInGroup(state, group, hooks) {
        if (!isBaseReplacedInGroup(state, group, hooks)) return [];
        const baseId = String(getGroupBaseOptionId(state, group, hooks) || '').trim();
        if (!baseId) return [];
        const BAL = global.UgapBaseAdjLinks;
        if (!BAL?.resolveSourceAdjOptionIdsForBase) return [];
        const categories = Array.isArray(state?.categories) ? state.categories : [];
        const importBaseProducts = Array.isArray(state?.importBaseProducts) ? state.importBaseProducts : [];
        return BAL.resolveSourceAdjOptionIdsForBase(baseId, categories, importBaseProducts)
            .map((x) => String(x || '').trim())
            .filter(Boolean);
    }

    function buildLinkedAdjSupplementHtml(state, group, hooks) {
        const ids = getLinkedAdjIdsForReplacedBaseInGroup(state, group, hooks);
        if (!ids.length) return '';
        return ids.map((adjId) => {
            const adj = findCatalogOption(state, hooks, adjId);
            if (!adj) return '';
            const name = resolveOptionDisplayName(state, adj, hooks);
            return `<div class="ugap-devis-linked-adj" style="margin-top:6px;padding:6px 10px;background:#f5f0ff;border:1px solid #d8b4fe;border-radius:6px;font-size:12px;color:#5b21b6;line-height:1.35;">
                <span class="excel-line-badge minoration" style="margin-right:6px;vertical-align:middle;">MINO</span>
                <span style="vertical-align:middle;">${escapeHtml(name)}</span>
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

    function formatParcoursOptionLineLabel(state, opt, hooks) {
        if (!opt) return '—';
        const text = resolveMultiChoiceOptionLabel(state, opt, hooks, '');
        const ref = String(opt.refUgap || opt.baseRefUgap || '').trim();
        const det = String(opt.details || '').trim();
        if (ref && !isTechnicalCatalogRef(ref) && !text.includes(ref)) {
            return `${text} — ${ref}`;
        }
        if (det && det !== text && !text.includes(det)) {
            return `${text} (${det})`;
        }
        return text;
    }

    function buildDevisTableOptionCell(state, group, hooks, mode, optId) {
        const key = escapeHtml(groupSelectionKey(group));

        if (mode === 'multi_line' && optId) {
            const opt = findCatalogOption(state, hooks, optId);
            const name = formatParcoursOptionLineLabel(state, opt, hooks);
            return `<span class="ugap-devis-opt-name">${escapeHtml(name)}</span>`;
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
        const nameHtml = opt
            ? `<span class="ugap-devis-pick-current">${escapeHtml(resolveOptionDisplayName(state, opt, hooks))}</span>`
            : '<span class="ugap-devis-pick-placeholder">Sélectionnez une option</span>';
        const linkedHtml = buildLinkedAdjSupplementHtml(state, group, hooks);
        return `
            <div class="tpl-config-single-pick ugap-devis-pick-btn" data-tpl-group="${key}" role="button" tabindex="0">
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
            const adjPrice = formatDevisOptionPrice(state, hooks, adj);
            const adjCls = adjPrice.included ? 'ugap-devis-price is-included' : 'ugap-devis-price';
            html += `<div class="${adjCls}" style="margin-top:4px;font-size:12px;">${escapeHtml(adjPrice.text)}</div>`;
        });
        return html;
    }

    function refreshDevisTableChoiceCells(state, hooks) {
        const root = global.document.getElementById('ugap-config-parcours-root');
        if (!root) return;
        const tbody = root.querySelector('#ugap-devis-options-tbody');
        if (!tbody) return;

        syncModelBaseBridge(state);
        const model = state.selectedModel;
        const MBO = getModelBaseOptions();
        const templateId = String(model?.boatTemplateId || '').trim();
        if (!templateId || !MBO?.getTemplateById?.(templateId)) return;

        const tree = MBO.buildModelBaseEditorTree(model) || { roots: [], orphanSlots: [] };
        const catalogNodes = getCatalogNodesForParcours();
        const rowDefs = collectDevisTableRowDefs(state, hooks, tree, catalogNodes);
        tbody.innerHTML = rowDefs.map((r) => buildDevisTableRowHtml(state, hooks, r)).join('');
        bindDevisTableEvents(state, hooks, root);
        refreshParcoursProgressUi(root, state, hooks);
    }

    function buildDevisTableRowHtml(state, hooks, rowDef) {
        const {
            group, mode, optId, categorie, sousNoeud, showCategorie, showSousNoeud,
        } = rowDef;
        const key = escapeHtml(groupSelectionKey(group));
        const rowClass = mode === 'single'
            ? 'ugap-devis-row ugap-devis-row--single tpl-config-row-group tpl-config-row-group--single'
            : (mode === 'multi_empty'
                ? 'ugap-devis-row ugap-devis-row--multi tpl-config-row-group'
                : (mode === 'multi_pick'
                    ? 'ugap-devis-row ugap-devis-row--multi-pick tpl-config-row-group'
                    : 'ugap-devis-row ugap-devis-row--multi-line tpl-config-row-group'));

        const categorieCell = showCategorie
            ? `<span class="ugap-devis-categorie">${escapeHtml(categorie)}</span>`
            : '';
        const sousNoeudCell = showSousNoeud
            ? `<span class="ugap-devis-sous-noeud">${escapeHtml(sousNoeud)}</span>`
            : '';

        return `
            <tr class="${rowClass}" data-tpl-group="${key}">
                <td class="ugap-devis-td-categorie">${categorieCell}</td>
                <td class="ugap-devis-td-sous-noeud">${sousNoeudCell}</td>
                <td class="ugap-devis-td-option">${buildDevisTableOptionCell(state, group, hooks, mode, optId)}</td>
                <td class="ugap-devis-td-price">${buildDevisTablePriceCell(state, hooks, mode, group, optId)}</td>
            </tr>`;
    }

    function bindDevisTableEvents(state, hooks, container) {
        const tbody = container.querySelector('#ugap-devis-options-tbody');
        if (!tbody) return;

        const groups = [];
        collectDevisTableRowDefs(
            state,
            hooks,
            getModelBaseEditorTree(state),
            getCatalogNodesForParcours()
        ).forEach((r) => {
            if (!groups.some((g) => groupSelectionKey(g) === groupSelectionKey(r.group))) {
                groups.push(r.group);
            }
        });
        const groupByKey = new Map(groups.map((g) => [groupSelectionKey(g), g]));

        const openSingleFromEl = (el, e) => {
            e?.stopPropagation?.();
            const g = groupByKey.get(el.getAttribute('data-tpl-group'));
            if (g) openSingleChoiceModal(state, g, hooks);
        };

        tbody.querySelectorAll('.tpl-config-single-pick').forEach((el) => {
            el.addEventListener('click', (e) => openSingleFromEl(el, e));
            el.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    openSingleFromEl(el, e);
                }
            });
        });
        tbody.querySelectorAll('.ugap-devis-row--single').forEach((tr) => {
            tr.addEventListener('click', (e) => {
                if (e.target.closest('.tpl-config-multi-add')) return;
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
        tbody.querySelectorAll('.ugap-devis-row--multi-pick').forEach((tr) => {
            tr.addEventListener('click', (e) => {
                if (e.target.closest('.tpl-config-multi-add')) return;
                const g = groupByKey.get(tr.getAttribute('data-tpl-group'));
                if (g) openMultiChoiceModal(state, g, hooks);
            });
        });
    }

    function renderDevisOptionsTableHtml(state, hooks) {
        syncModelBaseBridge(state);
        const model = state.selectedModel;
        const MBO = getModelBaseOptions();
        const mboStatus = MBO?.getStatus?.(model) || { slots: [] };
        const templateId = String(model?.boatTemplateId || '').trim();

        if (!templateId) {
            return '<p class="ugap-devis-empty">Aucun bateau de base lié à ce modèle.</p>';
        }
        if (!MBO?.getTemplateById?.(templateId)) {
            return '<p class="ugap-devis-empty">Bateau de base introuvable.</p>';
        }
        if (!mboStatus.slots?.length) {
            return '<p class="ugap-devis-empty">Aucun poste sur ce template — paramétrez les options de base dans <strong>Modèles</strong>.</p>';
        }

        applyDefaultSelectionsForParcours(state, hooks);

        const tree = MBO.buildModelBaseEditorTree(model) || { roots: [], orphanSlots: mboStatus.slots };
        const catalogNodes = getCatalogNodesForParcours();
        const rowDefs = collectDevisTableRowDefs(state, hooks, tree, catalogNodes);

        if (!rowDefs.length) {
            return '<p class="ugap-devis-empty">Aucun choix affichable (vérifiez les liens nœud catalogue sur les options).</p>';
        }

        const bodyHtml = rowDefs.map((r) => buildDevisTableRowHtml(state, hooks, r)).join('');

        return `
            <div class="excel-options-wrap ugap-devis-table-wrap">
                <div class="excel-options-scroll">
                    <table class="excel-options-table ugap-devis-options-table tpl-config-table">
                        <thead>
                            <tr>
                                <th class="ugap-devis-th-categorie">Catégorie</th>
                                <th class="ugap-devis-th-sous-noeud">Sous-nœud</th>
                                <th>Option sélectionnée</th>
                                <th class="ugap-devis-th-price">Prix</th>
                            </tr>
                        </thead>
                        <tbody id="ugap-devis-options-tbody">${bodyHtml}</tbody>
                    </table>
                </div>
            </div>`;
    }

    function renderParcoursProgressHtml(state, hooks) {
        const { total, done } = parcoursProgress(state, hooks);
        if (!total) return '';
        const pct = Math.round((done / total) * 100);
        const pending = total - done;
        const sub = pending
            ? `${pending} équipement${pending > 1 ? 's' : ''} restant${pending > 1 ? 's' : ''}`
            : 'Tous les équipements sont renseignés — vous pouvez encore modifier vos choix';
        return `
            <div class="ugap-devis-progress" role="status" aria-live="polite">
                <div class="ugap-devis-progress__top">
                    <span class="ugap-devis-progress__label"><strong>${done}</strong> / ${total} équipements</span>
                    <span class="ugap-devis-progress__sub">${escapeHtml(sub)}</span>
                </div>
                <div class="ugap-devis-progress__track" aria-hidden="true">
                    <div class="ugap-devis-progress__bar" style="width:${pct}%"></div>
                </div>
            </div>`;
    }

    function refreshParcoursProgressUi(rootEl, state, hooks) {
        if (!rootEl) return;
        const host = rootEl.querySelector('.ugap-devis-progress');
        const html = renderParcoursProgressHtml(state, hooks);
        if (!host || !html) return;
        const wrap = document.createElement('div');
        wrap.innerHTML = html.trim();
        const next = wrap.firstElementChild;
        if (next) host.replaceWith(next);
    }

    function renderCatalogParcoursPanel(state, hooks, container) {
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

        const excelLabel = typeof hooks.getExcelTabLabel === 'function'
            ? String(hooks.getExcelTabLabel() || '').trim()
            : 'Tableau motorisation';
        const excelBlock = typeof hooks.renderExcelTable === 'function'
            ? `<details class="ugap-devis-excel-fold">
                <summary class="ugap-devis-excel-fold__summary">${escapeHtml(excelLabel)} (optionnel)</summary>
                <div class="ugap-devis-excel-fold__body" id="ugap-config-excel-host"></div>
               </details>`
            : '';

        const bodyHtml = renderDevisOptionsTableHtml(state, hooks);
        const progressHtml = renderParcoursProgressHtml(state, hooks);

        container.innerHTML = `
            <div class="ugap-config-parcours ugap-devis-parcours" id="ugap-config-parcours-root">
                <p class="ugap-devis-parcours__model-line">${modelLine}${tplLabel ? ` — <span class="ugap-devis-parcours__boat-inline">${escapeHtml(tplLabel)}</span>` : ''}</p>
                ${progressHtml}
                ${excelBlock}
                <div class="ugap-devis-parcours__body">${bodyHtml}</div>
            </div>`;
        const root = container.querySelector('#ugap-config-parcours-root');
        if (root) {
            bindDevisTableEvents(state, hooks, root);
            const excelFold = root.querySelector('.ugap-devis-excel-fold');
            if (excelFold && typeof hooks.renderExcelTable === 'function') {
                excelFold.addEventListener('toggle', () => {
                    const host = root.querySelector('#ugap-config-excel-host');
                    if (!host || !excelFold.open) return;
                    if (!host.innerHTML.trim()) {
                        hooks.renderExcelTable(host);
                        hooks.onResize?.();
                    }
                });
            }
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
        if (!tabsContainer || !subContainer || !optContainer) return false;

        state.templateTreeRootIndex = 0;
        state.templateTreePath = [];

        tabsContainer.innerHTML = '';
        subContainer.innerHTML = '';
        optContainer.innerHTML = '';

        renderCatalogParcoursPanel(state, hooks, optContainer);

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

    function formatPrice(opt, hooks) {
        if (!opt) return '';
        if (isImportGeneratedBaseOption(opt)) return '0,00 € (inclus)';
        if (typeof hooks?.isBaseCatalogOption === 'function' && hooks.isBaseCatalogOption(opt)) {
            return '0,00 € (inclus)';
        }
        return `${catalogUgapPrice(opt).toFixed(2)} €`;
    }

    function formatPickerDeltaHint(state, hooks, ibpCatalogId) {
        const ibpId = String(ibpCatalogId || '').trim();
        if (!ibpId) return '';
        const BAL = global.UgapBaseAdjLinks;
        const categories = Array.isArray(state?.categories) ? state.categories : [];
        const importBaseProducts = Array.isArray(state?.importBaseProducts) ? state.importBaseProducts : [];
        if (!BAL?.resolveSourceAdjOptionIdsForBase) return '';
        const linked = BAL.resolveSourceAdjOptionIdsForBase(ibpId, categories, importBaseProducts);
        if (!linked.length) return '';
        let sum = 0;
        linked.forEach((adjId) => {
            const adj = findCatalogOption(state, hooks, adjId);
            if (adj) sum += catalogUgapPrice(adj);
        });
        if (!sum) return '';
        const sign = sum >= 0 ? '+' : '';
        return `<span style="font-size:11px;color:#64748b;margin-left:6px;">${sign}${sum.toFixed(2)} € (mino/majo)</span>`;
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
            if (typeof hooks?.isOptionCompatibleWithModel === 'function') {
                return hooks.isOptionCompatibleWithModel(opt) !== false;
            }
            const mid = String(model?.id || '').trim();
            if (!mid) return true;
            const comp = Array.isArray(opt?.compatibleModels) ? opt.compatibleModels.map(String) : [];
            if (!comp.length) return !!opt?.isDivers;
            return comp.includes(mid);
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
                return `<span class="tpl-config-chip" data-tpl-group="${key}" data-tpl-opt="${escapeHtml(opt.id)}"
                    style="display:inline-flex;align-items:center;gap:6px;padding:6px 10px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:999px;font-size:13px;">
                    ${escapeHtml(resolveMultiChoiceOptionLabel(state, opt, hooks, ''))}
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
        const nameHtml = opt
            ? `<span style="font-weight:600;color:#0f172a;">${escapeHtml(resolveOptionDisplayName(state, opt, hooks))}</span>`
            : '<span style="color:#b45309;font-style:italic;">Sélectionnez une option</span>';
        const borderColor = opt ? '#cbd5e1' : '#fcd34d';
        return `
            <div style="font-size:12px;font-weight:600;color:#475569;margin-bottom:6px;">${escapeHtml(group.label)}</div>
            <div class="tpl-config-single-pick" data-tpl-group="${key}" role="button" tabindex="0"
                style="display:flex;align-items:center;justify-content:space-between;gap:10px;width:100%;max-width:520px;padding:10px 12px;border:1px solid ${borderColor};border-radius:6px;background:#fff;cursor:pointer;font-size:14px;">
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
            if (opt && !isImportGeneratedBaseOption(opt)) {
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
                ? escapeHtml(formatPrice(display.option, hooks))
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
        unmarkDevisSlotUserCleared(state, group);
        const BAL = global.UgapBaseAdjLinks;
        const groupForAdj = { ...group, options: group.options };
        if (BAL?.clearLinkedAdjForGroup) {
            BAL.clearLinkedAdjForGroup(state, groupForAdj);
        }
        clearGroupSelection(state, group, oid);
        state.selectedOptions.add(oid);
        const addedAdjIds = [];
        if (isBaseReplacedInGroup(state, groupForAdj, hooks)) {
            const defaultBaseId = getGroupBaseOptionId(state, groupForAdj, hooks);
            if (defaultBaseId) {
                const adjGroup = BAL?.isAdjPricingGroup?.(groupForAdj)
                    ? groupForAdj
                    : { ...groupForAdj, priceMode: 'minoration', pricingMode: 'minoration' };
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
        try {
            const selectedNow = Array.from(state.selectedOptions || []).map((x) => String(x || '').trim());
            console.log('[UGAP][moteur-change] added', {
                selectedMotorId: String(oid || '').trim(),
                addedMinorationIds: addedAdjIds,
                selectedOptionsNow: selectedNow
            });
        } catch (_) {
            // no-op debug
        }
        hooks.updateSummary?.();
    }

    function appendSingleChoicePickerToModal(state, group, hooks, optionsList, onClose) {
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
            clearDevisSingleChoiceSlot(state, group, hooks);
            if (typeof onClose === 'function') onClose();
            else finishConfiguratorPickerModal(state, hooks);
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
            rows = MBO.getChoiceRows(model, slot, { baseOnly: false }) || [];
        }
        if (!rows.length) {
            const ODN = global.UgapOptionDisplayName;
            const models = Array.isArray(state?.models) ? state.models : [];
            const modelId = String(model?.id || '').trim();
            rows = getGroupChoiceOptionsForPicker(group, hooks, model)
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
                    };
                })
                .filter((row) => row.id);
        }

        if (!rows.length) {
            list.innerHTML = '<p style="color:#666;">Aucune option dans ce groupe pour ce modèle. Vérifiez la famille (onglet Famille) et les affectations (onglet Options).</p>';
            optionsList.appendChild(list);
            return;
        }

        rows.forEach((row) => {
            const oid = String(row.id || '').trim();
            const opt = findCatalogOption(state, hooks, oid);
            if (!opt) return;
            const item = global.document.createElement('div');
            item.className = 'option-item';
            item.style.cursor = 'pointer';
            const displayRow = getSingleChoiceDisplay(state, group, hooks);
            const selected = String(displayRow?.option?.id || '').trim() === oid;
            const isBase = oid === baseId;
            if (selected) item.style.background = '#eff6ff';
            else if (isBase) item.style.borderLeft = '3px solid #059669';
            const isIbp = isImportGeneratedBaseOption(opt)
                || (typeof hooks?.isBaseCatalogOption === 'function' && hooks.isBaseCatalogOption(opt));
            const deltaHint = isIbp ? formatPickerDeltaHint(state, hooks, oid) : '';
            const baseTag = isBase ? ' <span style="font-size:11px;color:#059669;">(base)</span>' : '';
            item.innerHTML = `
                <span style="flex:1;">${escapeHtml(row.name || resolveOptionDisplayName(state, opt, hooks))}${baseTag}</span>
                <span class="price">${formatDevisOptionPrice(state, hooks, opt).text}${deltaHint}</span>
            `;
            item.onclick = () => {
                const display = getSingleChoiceDisplay(state, group, hooks);
                const currentId = String(display?.option?.id || '').trim();
                if (currentId === oid) {
                    clearDevisSingleChoiceSlot(state, group, hooks);
                    if (typeof onClose === 'function') onClose();
                    else finishConfiguratorPickerModal(state, hooks);
                    return;
                }
                try {
                    console.log('[UGAP][group-change][start]', {
                        groupId: String(group?.groupId || group?.id || '').trim(),
                        groupLabel: String(group?.label || '').trim(),
                        selectedOptionId: String(oid || '').trim(),
                        baseOptionId: String(getGroupBaseOptionId(state, group, hooks) || '').trim()
                    });
                } catch (_) {}
                applyDevisSingleChoicePick(state, group, hooks, oid);
                if (typeof onClose === 'function') onClose();
                else finishConfiguratorPickerModal(state, hooks);
            };
            list.appendChild(item);
        });
        optionsList.appendChild(list);
    }

    function hydrateGroupOptions(state, group) {
        const g = group && typeof group === 'object' ? group : {};
        const ids = (Array.isArray(g.optionIds) ? g.optionIds : [])
            .map((x) => String(x || '').trim())
            .filter(Boolean);
        if (!ids.length) return g;
        const map = buildOptionById(Array.isArray(state.categories) ? state.categories : []);
        const pick = typeof state.passesCategoryTableModelFilter === 'function'
            ? (opt) => state.passesCategoryTableModelFilter(opt, state.selectedModel)
            : (typeof state.isOptionCompatibleWithSelectedModel === 'function'
                ? state.isOptionCompatibleWithSelectedModel
                : () => true);
        const options = ids
            .map((id) => map.get(id))
            .filter((opt) => opt && pick(opt));
        return { ...g, optionIds: ids, options };
    }

    function openSingleChoiceModal(state, group, hooks) {
        const modal = global.document.getElementById('subcategory-modal');
        const title = global.document.getElementById('subcategory-modal-title');
        const optionsList = global.document.getElementById('subcategory-options-list');
        if (!modal || !title || !optionsList) return;

        group = hydrateGroupOptions(state, group);
        state.familyModalContext = null;
        state._templateTreeModalGroup = group;
        modal.querySelector('.modal-content')?.classList.remove('modal-wide');
        const slot = groupToSlot(group);
        title.textContent = devisPickerModalTitle(
            slot,
            getCatalogNodesForParcours(),
            group.label
        );
        optionsList.innerHTML = '';
        appendSingleChoicePickerToModal(state, group, hooks, optionsList);
        modal.classList.add('active');
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
                                <th style="width:120px;text-align:right;">Prix</th>
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
        const modal = global.document.getElementById('subcategory-modal');
        const title = global.document.getElementById('subcategory-modal-title');
        const optionsList = global.document.getElementById('subcategory-options-list');
        if (!modal || !title || !optionsList) return;

        group = hydrateGroupOptions(state, group);
        ensureMultiChoiceGroupDefault(state, group, hooks);
        state.familyModalContext = null;
        state._templateTreeModalGroup = group;
        modal.querySelector('.modal-content')?.classList.remove('modal-wide');
        const slotMc = groupToSlot(group);
        title.textContent = devisPickerModalTitle(
            slotMc,
            getCatalogNodesForParcours(),
            group.label,
            '(choix multiple)'
        );
        optionsList.innerHTML = '';

        const draft = new Set(getSelectedInGroup(state, group));
        const MBO = getModelBaseOptions();
        const model = state.selectedModel;
        const slot = groupToSlot(group);
        let rows = [];
        if (MBO?.getChoiceRows && model) {
            syncModelBaseBridge(state);
            rows = MBO.getChoiceRows(model, slot, { baseOnly: false }) || [];
        }
        if (!rows.length) {
            const ODN = global.UgapOptionDisplayName;
            const models = Array.isArray(state?.models) ? state.models : [];
            const modelId = String(model?.id || '').trim();
            rows = (Array.isArray(group.options) ? group.options : [])
                .map((opt) => ({
                    id: String(opt?.id || '').trim(),
                    name: ODN?.resolveOptionDisplayName
                        ? ODN.resolveOptionDisplayName(opt, { models, modelId })
                        : String(opt?.name || '').trim(),
                }))
                .filter((row) => row.id);
        }

        rows.forEach((row) => {
            const oid = String(row.id || '').trim();
            const opt = findCatalogOption(state, hooks, oid);
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
            label.textContent = resolveMultiChoiceOptionLabel(state, opt, hooks, row.name);
            label.style.flex = '1';
            label.style.marginLeft = '10px';
            const price = global.document.createElement('div');
            price.className = 'price';
            price.textContent = formatDevisOptionPrice(state, hooks, opt).text;
            item.appendChild(cb);
            item.appendChild(label);
            item.appendChild(price);
            optionsList.appendChild(item);
        });

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
            clearGroupSelection(state, group);
            draft.forEach((id) => state.selectedOptions.add(id));
            hooks.updateSummary?.();
            finishConfiguratorPickerModal(state, hooks);
        };
        actions.appendChild(cancel);
        actions.appendChild(ok);
        optionsList.appendChild(actions);
        modal.classList.add('active');
    }

    /** Fermeture picker : index.html rafraîchit le tableau catégorie via closeSubCategoryModal. */
    function finishConfiguratorPickerModal(state, hooks) {
        if (typeof global.closeSubCategoryModal === 'function') {
            global.closeSubCategoryModal();
            return;
        }
        closeTemplateTreeModal(state, hooks);
    }

    function closeTemplateTreeModal(state, hooks) {
        state._templateTreeModalGroup = null;
        const modal = global.document.getElementById('subcategory-modal');
        if (modal) {
            modal.classList.remove('active');
            modal.querySelector('.modal-content')?.classList.remove('modal-wide');
        }
        hooks.onCategoryTableChanged?.();
        renderTemplateTreeStep3(state, hooks);
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
                Modèle <strong>${modelName}</strong> — bateau de base <strong>${escapeHtml(tplLabel)}</strong>
            </p>`
            : `<p class="ugap-config-model-banner" style="margin:0 0 12px;padding:10px 14px;background:#fffbeb;border:1px solid #fcd34d;border-radius:8px;font-size:13px;color:#92400e;">
                Modèle <strong>${modelName}</strong> — aucun bateau de base lié.
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
        renderFamilyGroupsConfiguratorTable,
        openSingleChoiceModal,
        openMultiChoiceModal,
        hydrateGroupOptions,
        appendSingleChoicePickerToModal,
        ensureSingleChoiceGroupDefault,
        ensureMultiChoiceGroupDefault,
        ensureSingleChoiceDefaultsForGroups,
        applyDefaultSelectionsForParcours,
        getSingleChoiceDisplay,
        getGroupBaseOptionId,
        isBaseReplacedInGroup,
        isIbpReplacedInGroup,
        normalizeFamilyGroupForConfigurator,
        closeTemplateTreeModal,
        onModelSelected,
        getBoatTemplateForModel,
        refreshDevisTableChoiceCells
    };
})(typeof window !== 'undefined' ? window : global);
