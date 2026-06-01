/**
 * FICHIER : modules/ugap/frontend/assets/js/configurateur/configurateur-template-tree.js
 * RÔLE : Parcours configurateur step 3 via categoryTree du template bateau (modals choix unique / multiple).
 *
 * ENTRÉES : state (modèle, sélections), template résolu, callbacks DOM
 * SORTIES : Rendu onglets / nœuds / modals
 *
 * DÉPEND DE : boat-template-tree.js
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

    function getNavPath(state) {
        if (!Array.isArray(state.templateTreePath)) state.templateTreePath = [];
        return state.templateTreePath;
    }

    function getActiveRoot(state) {
        const tpl = getTpl(state);
        const roots = tpl?.resolvedRoots || [];
        if (!roots.length) return null;
        const ri = Number(state.templateTreeRootIndex);
        const idx = Number.isInteger(ri) && ri >= 0 && ri < roots.length ? ri : 0;
        return roots[idx];
    }

    function getCurrentNode(state) {
        let node = getActiveRoot(state);
        if (!node) return null;
        getNavPath(state).forEach((raw) => {
            const i = Number(raw);
            const children = Array.isArray(node?.children) ? node.children : [];
            if (!Number.isInteger(i) || i < 0 || i >= children.length) return;
            node = children[i];
        });
        return node;
    }

    function groupSelectionKey(group) {
        return `${String(group.familyLabel || '').trim()}:${String(group.groupId || '').trim()}`;
    }

    function getModelBaseOptions() {
        return global.UgapModelBaseOptions;
    }

    function syncModelBaseBridge(state) {
        global.UgapConfiguratorModelBaseBridge?.sync?.(state);
    }

    function groupToSlot(group) {
        if (global.UgapConfiguratorModelBaseBridge?.groupToSlot) {
            return global.UgapConfiguratorModelBaseBridge.groupToSlot(group);
        }
        const g = group && typeof group === 'object' ? group : {};
        return {
            familyLabel: String(g.familyLabel || '').trim(),
            groupId: String(g.groupId || '').trim(),
            groupLabel: String(g.label || g.groupId || '').trim(),
            categoryName: String(g.categoryName || g.familyLabel || '').trim(),
        };
    }

    function getSelectedInGroup(state, group) {
        const ids = (Array.isArray(group?.options) ? group.options : [])
            .map((o) => String(o?.id || '').trim())
            .filter(Boolean);
        return ids.filter((id) =>
            state.selectedOptions.has(id) || state.fivePercentOptions.has(id)
        );
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
            return hooks.getCatalogOptionById(oid);
        }
        const cats = Array.isArray(state.categories) ? state.categories : [];
        for (const cat of cats) {
            const hit = (Array.isArray(cat?.options) ? cat.options : []).find((o) => String(o?.id) === oid);
            if (hit) return hit;
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
                if (!opt || !isMotorTarifCatalogOption(hooks, opt)) return assigned;
            }
        }

        const opts = Array.isArray(group?.options) ? group.options : [];
        const defId = String(group.defaultOptionId || '').trim();
        if (defId) {
            const opt = findCatalogOption(state, hooks, defId);
            if (opt && !isMotorTarifCatalogOption(hooks, opt)) return defId;
        }
        for (const opt of opts) {
            if (!isBaseCatalogOption(hooks, opt)) continue;
            if (isMotorTarifCatalogOption(hooks, opt)) continue;
            return opt.id;
        }
        return '';
    }

    function purgeMotorTarifFromGroupSelection(state, group, hooks) {
        const baseId = getGroupBaseOptionId(state, group, hooks);
        const slot = groupToSlot(group);
        const MBO = getModelBaseOptions();
        const toCheck = new Set(getSelectedInGroup(state, group));
        if (MBO?.getChoiceRows && state.selectedModel) {
            syncModelBaseBridge(state);
            (MBO.getChoiceRows(state.selectedModel, slot) || []).forEach((row) => {
                const id = String(row?.id || '').trim();
                if (id && (state.selectedOptions.has(id) || state.fivePercentOptions.has(id))) {
                    toCheck.add(id);
                }
            });
        }
        toCheck.forEach((id) => {
            if (id === baseId) return;
            const opt = findCatalogOption(state, hooks, id)
                || (group.options || []).find((o) => o.id === id);
            if (opt && isMotorTarifCatalogOption(hooks, opt)) {
                state.selectedOptions.delete(id);
                state.fivePercentOptions.delete(id);
            }
        });
    }

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
        purgeMotorTarifFromGroupSelection(state, group, hooks);
        let selected = getSingleSelectedOption(state, group, hooks);
        if (selected && isMotorTarifCatalogOption(hooks, selected)) {
            state.selectedOptions.delete(selected.id);
            state.fivePercentOptions.delete(selected.id);
            selected = null;
        }
        if (selected) {
            return { option: selected, isExplicitSelection: true, isBaseDefault: false };
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
        purgeMotorTarifFromGroupSelection(state, group, hooks);
        const baseId = getGroupBaseOptionId(state, group, hooks);
        if (!baseId) return;
        if (!getSelectedInGroup(state, group).length) {
            state.selectedOptions.add(baseId);
        }
    }

    function ensureSingleChoiceDefaultsForGroups(state, groups, hooks) {
        const list = Array.isArray(groups) ? groups : [];
        list.forEach((g) => {
            if (g?.decisionMode !== 'multi_choice' && !g?.missing) {
                ensureSingleChoiceGroupDefault(state, g, hooks);
                purgeLinkedAdjForDefaultBaseInGroup(state, g, hooks);
            }
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
        const tid = String(state.selectedModel?.boatTemplateId || '').trim();
        if (!tid) return null;
        const list = Array.isArray(state.uiState?.boatTemplates) ? state.uiState.boatTemplates : [];
        let tpl = list.find((t) => String(t?.id || '') === tid);
        if (!tpl) {
            try {
                const raw = localStorage.getItem('ugap.templateBateau.saved');
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
        const snap = Tree().normalizeBoatTemplateSnapshot(tpl.snapshot || {}, {
            resolveCategoryById: (id) => byCatId.get(String(id || '').trim()) || null
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
        if (!Tree()) {
            return { mode: 'template_error', reason: 'module_unavailable', tpl };
        }
        const resolved = ensureResolved(state);
        const roots = resolved?.resolvedRoots || [];
        if (!roots.length) {
            return { mode: 'template_error', reason: 'empty_tree', tpl, resolved };
        }
        // Ne bloque pas le configurateur sur ce diagnostic :
        // certains catalogues (IDs normalisés / groupes hybrides) peuvent être utilisables
        // même si treeHasResolvableGroups renvoie false.
        return { mode: 'template', tpl, resolved };
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
            missing_template: `Template « ${escapeHtml(tid)} » introuvable. Enregistrez-le dans l’admin (Template bateau) puis rechargez cette page.`,
            empty_tree: 'Le template lié au modèle n’a pas d’arbre de catégories. Ouvrez Template bateau → Modifier et construisez l’arbre.',
            no_groups: 'L’arbre du template n’a aucun groupe de décision utilisable. Ajoutez des groupes (+ Groupe) sur les nœuds, après avoir paramétré Famille et Catégorie.',
            module_unavailable: 'Module template bateau non chargé (boat-template-tree.js).'
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
        (Array.isArray(group?.options) ? group.options : []).forEach((opt) => {
            if (exceptId && opt.id === exceptId) return;
            state.selectedOptions.delete(opt.id);
            state.fivePercentOptions.delete(opt.id);
        });
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

        const tpl = status.resolved;
        if (typeof h.setStep3Hint === 'function') {
            h.setStep3Hint(true, 'ok');
        }

        const tabsContainer = h.tabsContainer;
        const subContainer = h.subcategoriesContainer;
        const optContainer = h.optionsContainer;
        if (!tabsContainer || !subContainer || !optContainer) return false;

        const roots = tpl.resolvedRoots || [];
        const path = getNavPath(state);
        if (!Number.isInteger(Number(state.templateTreeRootIndex))) {
            state.templateTreeRootIndex = -1;
        }
        const onModelTab = isModelCategoryTabActive(state);
        const activeRootIndex = getActiveTemplateRootIndex(state, roots);
        const excelRootActive = isExcelTemplateRootActive(state, roots);
        const excelTabLabel = typeof h.getExcelTabLabel === 'function'
            ? String(h.getExcelTabLabel() || '').trim()
            : 'Excel de base';

        tabsContainer.innerHTML = '';

        const modelTab = global.document.createElement('div');
        modelTab.className = `tab ${onModelTab ? 'active' : ''}`;
        modelTab.textContent = getModelTabLabel(state);
        modelTab.onclick = () => {
            state.templateTreeRootIndex = -1;
            state.templateTreePath = [];
            renderTemplateTreeStep3(state, hooks);
            h.onResize?.();
        };
        tabsContainer.appendChild(modelTab);

        roots.forEach((node, index) => {
            const tab = global.document.createElement('div');
            const isActive = !onModelTab && index === activeRootIndex;
            tab.className = `tab ${isActive ? 'active' : ''}`;
            tab.textContent = isMotorisationTemplateRoot(node)
                ? (excelTabLabel || 'Excel de base')
                : (node.label || 'Catégorie');
            tab.onclick = () => {
                state.templateTreeRootIndex = index;
                state.templateTreePath = [];
                renderTemplateTreeStep3(state, hooks);
                h.onResize?.();
            };
            tabsContainer.appendChild(tab);
        });
        if (path.length && !onModelTab && !excelRootActive) {
            const back = global.document.createElement('div');
            back.className = 'tab';
            back.textContent = '← Sous-catégorie';
            back.style.marginLeft = '8px';
            back.onclick = () => {
                state.templateTreePath = path.slice(0, -1);
                renderTemplateTreeStep3(state, hooks);
                h.onResize?.();
            };
            tabsContainer.appendChild(back);
        }

        subContainer.innerHTML = '';
        optContainer.innerHTML = '';

        if (onModelTab) {
            renderModelCategoryTab(state, hooks, status);
            return true;
        }

        if (excelRootActive) {
            subContainer.innerHTML = '';
            if (typeof h.renderExcelTable === 'function') {
                h.renderExcelTable(optContainer);
            } else {
                optContainer.innerHTML = '<p style="color:#666;">Tableau Excel indisponible.</p>';
            }
            h.onResize?.();
            return true;
        }

        const displayNode = getCurrentNode(state);
        if (!displayNode) {
            optContainer.innerHTML = '<p style="color:#666;">Catégorie introuvable.</p>';
            return true;
        }

        renderTemplateConfiguratorTable(state, displayNode, path, hooks, optContainer);
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

    function formatPrice(opt, hooks) {
        if (!opt) return '';
        if (isImportGeneratedBaseOption(opt)) return '0,00 € (inclus)';
        if (typeof hooks?.isBaseCatalogOption === 'function' && hooks.isBaseCatalogOption(opt)) {
            return '0,00 € (inclus)';
        }
        return `${(opt.priceClient || opt.priceUgap || 0).toFixed(2)} €`;
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
            if (adj) sum += Number(adj.priceClient ?? adj.priceUgap ?? 0) || 0;
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
        const filtered = all
            .filter((opt) => opt && !isMotorTarifCatalogOption(hooks, opt) && compatible(opt));
        if (filtered.length) return filtered;
        // Debug/failsafe: ne pas bloquer le choix moteur si la compatibilité modèle est incohérente.
        return all.filter((opt) => opt && !isMotorTarifCatalogOption(hooks, opt));
    }

    function buildCol3OptionHtml(selected, showCol3) {
        if (!showCol3 || !selected) {
            return '<span style="color:#94a3b8;">—</span>';
        }
        const name = escapeHtml(String(selected.name || '—').trim() || '—');
        const details = String(selected.details || '').trim();
        if (!details) {
            return `<span style="font-weight:600;">${name}</span>`;
        }
        return `<span style="font-weight:600;">${name}</span>
            <div style="font-size:13px;color:#475569;margin-top:4px;">${escapeHtml(details)}</div>`;
    }

    function buildCol3ForGroup(state, group, showCol3, hooks) {
        if (!showCol3) {
            return '<span style="color:#94a3b8;">—</span>';
        }
        if (group.decisionMode === 'multi_choice') {
            const parts = getSelectedInGroup(state, group).map((optId) => {
                const opt = (group.options || []).find((o) => o.id === optId);
                if (!opt) return null;
                const details = String(opt.details || '').trim();
                const name = escapeHtml(String(opt.name || '').trim() || '—');
                if (!details) return `<span style="font-weight:600;">${name}</span>`;
                return `<span style="font-weight:600;">${name}</span>
                    <span style="display:block;font-size:13px;color:#475569;margin-top:2px;">${escapeHtml(details)}</span>`;
            }).filter(Boolean);
            if (!parts.length) return '<span style="color:#94a3b8;">—</span>';
            return parts.join('<div style="height:8px;"></div>');
        }
        const display = getSingleChoiceDisplay(state, group, hooks);
        return buildCol3OptionHtml(display.option, true);
    }

    function getRootCategoryLabel(state) {
        const root = getActiveRoot(state);
        return String(root?.label || '').trim() || '—';
    }

    function buildCol1CategoryHtml(categoryLabel, showCategory) {
        if (!showCategory) return '';
        return `<span style="font-size:12px;color:#64748b;font-weight:600;">${escapeHtml(categoryLabel)}</span>`;
    }

    function buildInclusionBadgeHtml(hooks, opt) {
        if (!opt) return '';
        const kind = getInclusionKind(hooks, opt);
        const label = getInclusionLabel(hooks, kind);
        const price = formatPrice(opt, hooks);
        return `
            <div style="margin-top:8px;">
                <span class="category-table-inclusion ${escapeHtml(kind)}">${escapeHtml(label)}</span>
                ${price ? `<span style="font-size:12px;color:#64748b;margin-left:8px;">${escapeHtml(price)}</span>` : ''}
            </div>
        `;
    }

    function buildCol2ChoiceHtml(state, group, showCol3, hooks) {
        const key = escapeHtml(groupSelectionKey(group));
        if (group.decisionMode === 'multi_choice') {
            const ids = getSelectedInGroup(state, group);
            const chips = ids.map((optId) => {
                const opt = (group.options || []).find((o) => o.id === optId);
                if (!opt) return '';
                return `<span class="tpl-config-chip" data-tpl-group="${key}" data-tpl-opt="${escapeHtml(opt.id)}"
                    style="display:inline-flex;align-items:center;gap:6px;padding:6px 10px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:999px;font-size:13px;">
                    ${escapeHtml(opt.name)}
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
            ? `<span style="font-weight:600;color:#0f172a;">${escapeHtml(String(opt.name || '').trim() || '—')}</span>`
            : '<span style="color:#b45309;font-style:italic;">Sélectionnez une option</span>';
        const priceHtml = opt
            ? `<span style="font-size:12px;color:#64748b;">${escapeHtml(formatPrice(opt, hooks))}</span>`
            : '';
        const baseHint = display.isBaseDefault && !display.isExplicitSelection
            ? '<span style="font-size:11px;color:#059669;">option de base</span>'
            : '';
        const borderColor = opt ? '#cbd5e1' : '#fcd34d';
        const linkedDebug = buildLinkedAdjDebugHtml(state, group, hooks);
        return `
            <div style="font-size:12px;font-weight:600;color:#475569;margin-bottom:6px;">${escapeHtml(group.label)}</div>
            <div class="tpl-config-single-pick" data-tpl-group="${key}" role="button" tabindex="0"
                style="display:flex;align-items:center;justify-content:space-between;gap:10px;width:100%;max-width:480px;padding:10px 12px;border:1px solid ${borderColor};border-radius:6px;background:#fff;cursor:pointer;font-size:14px;">
                <span style="flex:1;min-width:0;">${nameHtml}</span>
                <span style="display:flex;align-items:center;gap:8px;flex-shrink:0;">${baseHint}${priceHtml}<span style="color:#94a3b8;font-size:18px;line-height:1;">›</span></span>
            </div>
            ${linkedDebug}
        `;
    }

    function buildLinkedAdjDebugHtml(state, group, hooks) {
        const BAL = global.UgapBaseAdjLinks;
        if (!BAL?.resolveSourceAdjOptionIdsForBase) return '';
        if (String(group?.decisionMode || '') === 'multi_choice') return '';
        const normalizeId = (raw) => {
            const id = String(raw || '').trim();
            if (!id) return '';
            if (/^opt_/i.test(id)) return id;
            const m = id.match(/(opt_[a-z0-9_]+)/i);
            return m ? m[1] : id;
        };

        const categories = Array.isArray(state?.categories) ? state.categories : [];
        const importBaseProducts = Array.isArray(state?.importBaseProducts) ? state.importBaseProducts : [];
        const display = getSingleChoiceDisplay(state, group, hooks);
        const shownId = String(display?.option?.id || '').trim();
        const baseId = String(getGroupBaseOptionId(state, group, hooks) || '').trim();
        if (!shownId && !baseId) return '';

        const dbg = [];
        if (baseId) {
            dbg.push(
                `<div>option de base → brut:<code>${escapeHtml(baseId)}</code> normalisé:<code>${escapeHtml(normalizeId(baseId))}</code></div>`
            );
        }
        const pushRows = (label, sourceId) => {
            const sid = String(sourceId || '').trim();
            if (!sid) return;
            const linked = BAL.resolveSourceAdjOptionIdsForBase(sid, categories, importBaseProducts);
            if (!linked.length) return;
            linked.forEach((adjId) => {
                const aid = String(adjId || '').trim();
                if (!aid) return;
                const opt = findCatalogOption(state, hooks, aid);
                const checked = state.selectedOptions?.has(aid) ? '✓' : '✗';
                const name = escapeHtml(String(opt?.name || '—').trim());
                dbg.push(`<div>${checked} ${escapeHtml(label)} → <code>${escapeHtml(aid)}</code> ${name}</div>`);
            });
        };

        pushRows('base', baseId);
        if (!dbg.length) {
            return '<div style="font-size:11px;color:#94a3b8;margin-top:6px;">MINO liée: aucune trouvée</div>';
        }
        return `<div style="font-size:11px;color:#475569;margin-top:6px;">MINO/MAJO liées (debug):${dbg.join('')}</div>`;
    }

    function getResolvableGroups(node) {
        return (Array.isArray(node?.decisionGroups) ? node.decisionGroups : [])
            .filter((g) => !g.missing);
    }

    function childHasNestedTemplateChildren(child) {
        return (Array.isArray(child?.children) ? child.children : []).length > 0;
    }

    /** Groupes affichés sous la ligne sous-catégorie (sans navigation). */
    function shouldInlineChildGroups(child) {
        const childGroups = getResolvableGroups(child);
        if (!childGroups.length) return false;
        if (String(child?.subCategoryRefId || '').trim()) return true;
        return !childHasNestedTemplateChildren(child);
    }

    function buildSubCategoryLabelRowHtml(child, categoryLabel, showCategory) {
        const grpCount = getResolvableGroups(child).length;
        const countHint = grpCount
            ? `<span style="font-size:12px;color:#64748b;font-weight:400;margin-left:8px;">${grpCount} groupe(s)</span>`
            : '';
        return `
            <tr class="tpl-config-row-subcategory-label">
                <td style="vertical-align:top;">${buildCol1CategoryHtml(categoryLabel, showCategory)}</td>
                <td style="font-weight:600;font-size:14px;color:#1e293b;">${escapeHtml(child.label)}${countHint}</td>
                <td style="color:#94a3b8;">—</td>
            </tr>
        `;
    }

    function buildCategoryNavRowHtml(child, childIdx, categoryLabel, showCategory) {
        const grpCount = getResolvableGroups(child).length;
        const nestedCount = (Array.isArray(child?.children) ? child.children : []).length;
        const countHint = nestedCount
            ? `<span style="font-size:12px;color:#64748b;font-weight:400;margin-left:8px;">${nestedCount} sous-niveau(x)</span>`
            : (grpCount ? `<span style="font-size:12px;color:#64748b;font-weight:400;margin-left:8px;">${grpCount} groupe(s)</span>` : '');
        return `
            <tr class="tpl-config-row-category" data-tpl-child-idx="${childIdx}" style="cursor:pointer;">
                <td style="vertical-align:top;">${buildCol1CategoryHtml(categoryLabel, showCategory)}</td>
                <td style="font-weight:600;font-size:14px;color:#1e293b;">${escapeHtml(child.label)}${countHint}</td>
                <td style="color:#94a3b8;">—</td>
            </tr>
        `;
    }

    function buildGroupRowHtml(state, group, hooks, showCol3, categoryLabel, showCategory) {
        const key = escapeHtml(groupSelectionKey(group));
        const isSingle = group.decisionMode !== 'multi_choice';
        const display = isSingle ? getSingleChoiceDisplay(state, group, hooks) : null;
        const col1Selected = isSingle
            ? display?.option
            : (group.options || []).find((o) => getSelectedInGroup(state, group).includes(o.id)) || null;
        const col3Body = showCol3
            ? `${buildCol3ForGroup(state, group, true, hooks)}${buildInclusionBadgeHtml(hooks, col1Selected)}`
            : `${buildCol3ForGroup(state, group, false, hooks)}${!showCol3 ? buildInclusionBadgeHtml(hooks, col1Selected) : ''}`;
        const rowClass = isSingle ? 'tpl-config-row-group tpl-config-row-group--single' : 'tpl-config-row-group';
        return `
            <tr class="${rowClass}" data-tpl-group="${key}">
                <td style="vertical-align:top;">${buildCol1CategoryHtml(categoryLabel, showCategory)}</td>
                <td style="vertical-align:top;">${buildCol2ChoiceHtml(state, group, showCol3, hooks)}</td>
                <td style="vertical-align:top;font-size:13px;color:#475569;">${col3Body}</td>
            </tr>
        `;
    }

    function collectTableGroupsByKey(displayNode, inlineGroupNodes) {
        const groupByKey = new Map();
        const register = (node) => {
            getResolvableGroups(node).forEach((g) => {
                groupByKey.set(groupSelectionKey(g), g);
            });
        };
        register(displayNode);
        (Array.isArray(inlineGroupNodes) ? inlineGroupNodes : []).forEach(register);
        return groupByKey;
    }

    function bindTemplateTableEvents(state, displayNode, path, hooks, rootEl, inlineGroupNodes) {
        const groupByKey = collectTableGroupsByKey(displayNode, inlineGroupNodes);

        rootEl.querySelectorAll('.tpl-config-row-category').forEach((tr) => {
            tr.addEventListener('click', () => {
                const childIdx = Number(tr.getAttribute('data-tpl-child-idx'));
                if (!Number.isInteger(childIdx)) return;
                state.templateTreePath = [...path, childIdx];
                renderTemplateTreeStep3(state, hooks);
                hooks.onResize?.();
            });
        });

        const openSingleFromEl = (el, e) => {
            e?.stopPropagation?.();
            const g = groupByKey.get(el.getAttribute('data-tpl-group'));
            if (g) openSingleChoiceModal(state, g, hooks);
        };
        rootEl.querySelectorAll('.tpl-config-single-pick').forEach((el) => {
            el.addEventListener('click', (e) => openSingleFromEl(el, e));
            el.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    openSingleFromEl(el, e);
                }
            });
        });
        rootEl.querySelectorAll('.tpl-config-row-group--single').forEach((tr) => {
            tr.addEventListener('click', (e) => {
                if (e.target.closest('.tpl-config-chip-remove, .tpl-config-multi-add')) return;
                openSingleFromEl(tr, e);
            });
        });

        rootEl.querySelectorAll('.tpl-config-multi-add').forEach((btn) => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const g = groupByKey.get(btn.getAttribute('data-tpl-group'));
                if (g) openMultiChoiceModal(state, g, hooks);
            });
        });

        rootEl.querySelectorAll('.tpl-config-chip-remove').forEach((btn) => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const optId = String(btn.getAttribute('data-tpl-opt') || '').trim();
                if (!optId) return;
                state.selectedOptions.delete(optId);
                state.fivePercentOptions.delete(optId);
                hooks.updateSummary?.();
                renderTemplateTreeStep3(state, hooks);
            });
        });
    }

    function renderTemplateConfiguratorTable(state, displayNode, path, hooks, container) {
        const children = Array.isArray(displayNode.children) ? displayNode.children : [];
        const groups = getResolvableGroups(displayNode);
        ensureSingleChoiceDefaultsForGroups(state, groups, hooks);
        const inSubCategory = path.length > 0;
        const categoryLabel = getRootCategoryLabel(state);
        const rows = [];
        const inlineGroupNodes = [];
        let showCategoryOnNext = true;

        if (inSubCategory) {
            rows.push(`
                <tr class="tpl-config-row-category tpl-config-row-category--current">
                    <td style="vertical-align:top;">${buildCol1CategoryHtml(categoryLabel, true)}</td>
                    <td style="font-weight:600;font-size:14px;color:#1e293b;">${escapeHtml(displayNode.label)}</td>
                    <td style="color:#94a3b8;">—</td>
                </tr>
            `);
            showCategoryOnNext = false;
        }

        if (children.length) {
            children.forEach((child, childIdx) => {
                if (shouldInlineChildGroups(child)) {
                    rows.push(buildSubCategoryLabelRowHtml(child, categoryLabel, showCategoryOnNext));
                    showCategoryOnNext = false;
                    const childGroups = getResolvableGroups(child);
                    ensureSingleChoiceDefaultsForGroups(state, childGroups, hooks);
                    childGroups.forEach((group) => {
                        rows.push(buildGroupRowHtml(state, group, hooks, true, categoryLabel, showCategoryOnNext));
                        showCategoryOnNext = false;
                    });
                    inlineGroupNodes.push(child);
                } else if (childHasNestedTemplateChildren(child)) {
                    rows.push(buildCategoryNavRowHtml(child, childIdx, categoryLabel, showCategoryOnNext));
                    showCategoryOnNext = false;
                } else {
                    rows.push(buildSubCategoryLabelRowHtml(child, categoryLabel, showCategoryOnNext));
                    showCategoryOnNext = false;
                }
            });
        }

        const hasAnyContent = groups.length
            || children.length
            || inlineGroupNodes.some((c) => getResolvableGroups(c).length);
        if (!hasAnyContent) {
            container.innerHTML = '<p style="color:#666;">Aucune option.</p>';
            return;
        }

        groups.forEach((group) => {
            rows.push(buildGroupRowHtml(state, group, hooks, inSubCategory, categoryLabel, showCategoryOnNext));
            showCategoryOnNext = false;
        });

        container.innerHTML = `
            <div class="excel-options-wrap" id="ugap-template-config-table">
                <div class="excel-options-scroll">
                    <table class="excel-options-table tpl-config-table">
                        <thead>
                            <tr>
                                <th style="width:140px;">Catégorie</th>
                                <th>Option / Sous-catégorie</th>
                                <th>Option</th>
                            </tr>
                        </thead>
                        <tbody id="ugap-template-config-tbody">${rows.join('')}</tbody>
                    </table>
                </div>
            </div>
        `;

        const tbody = container.querySelector('#ugap-template-config-tbody');
        if (tbody) bindTemplateTableEvents(state, displayNode, path, hooks, tbody, inlineGroupNodes);
    }

    function appendSingleChoicePickerToModal(state, group, hooks, optionsList, onClose) {
        const normalizeId = (raw) => {
            const id = String(raw || '').trim();
            if (!id) return '';
            if (/^opt_/i.test(id)) return id;
            const m = id.match(/(opt_[a-z0-9_]+)/i);
            return m ? m[1] : id;
        };
        const hint = global.document.createElement('p');
        hint.style.cssText = 'color:#666;margin:0 0 12px;font-size:13px;';
        hint.textContent = 'Options de cette famille / groupe pour le modèle. L’option de base (IBP) est indiquée ; en choisir une autre peut appliquer la minoration liée.';
        optionsList.appendChild(hint);

        const list = global.document.createElement('div');
        list.className = 'options-list';
        const baseId = getGroupBaseOptionId(state, group, hooks);
        const BAL = global.UgapBaseAdjLinks;
        const categories = Array.isArray(state?.categories) ? state.categories : [];
        const importBaseProducts = Array.isArray(state?.importBaseProducts) ? state.importBaseProducts : [];
        const baseOpt = baseId ? findCatalogOption(state, hooks, baseId) : null;
        const rawFromSource = (Array.isArray(baseOpt?.importBaseProductSourceOptionIds) ? baseOpt.importBaseProductSourceOptionIds : [])
            .map((id) => String(id || '').trim())
            .filter(Boolean);
        const rawFromLinked = (Array.isArray(baseOpt?.linkedMinorationOptions) ? baseOpt.linkedMinorationOptions : [])
            .map((x) => String(x?.optionId || '').trim())
            .filter(Boolean);
        const rawFromBp = [];
        if (baseId) {
            const bp = (Array.isArray(importBaseProducts) ? importBaseProducts : [])
                .find((x) => String(x?.catalogOptionId || '').trim() === String(baseId || '').trim());
            (Array.isArray(bp?.optionIds) ? bp.optionIds : [])
                .forEach((id) => rawFromBp.push(String(id || '').trim()));
        }
        const rawAssociatedIds = [...rawFromSource, ...rawFromLinked, ...rawFromBp].filter(Boolean);
        const resolvedAssociatedIds = (BAL?.resolveSourceAdjOptionIdsForBase
            ? BAL.resolveSourceAdjOptionIdsForBase(baseId, categories, importBaseProducts)
            : [])
            .map((id) => String(id || '').trim())
            .filter(Boolean);
        const MBO = getModelBaseOptions();
        const model = state.selectedModel;
        const slot = groupToSlot(group);
        let rows = [];
        const baseDebug = global.document.createElement('p');
        baseDebug.style.cssText = 'color:#7c2d12;margin:0 0 10px;font-size:13px;font-weight:700;background:#ffedd5;padding:6px 8px;border:1px solid #fdba74;border-radius:6px;';
        const rawFirst = rawAssociatedIds.find(Boolean) || '—';
        const resolvedFirst = resolvedAssociatedIds.find(Boolean) || '—';
        baseDebug.innerHTML =
            `BASE DEBUG >>> brut: <code>${escapeHtml(rawFirst)}</code> | normalisé: <code>${escapeHtml(normalizeId(rawFirst) || '—')}</code> | résolu: <code>${escapeHtml(resolvedFirst)}</code><br>` +
            `sourceIds: <code>${escapeHtml(rawFromSource.join(', ') || '—')}</code> | linkedIds: <code>${escapeHtml(rawFromLinked.join(', ') || '—')}</code> | bp.optionIds: <code>${escapeHtml(rawFromBp.join(', ') || '—')}</code>`;
        optionsList.appendChild(baseDebug);

        if (MBO?.getChoiceRows && model) {
            syncModelBaseBridge(state);
            rows = MBO.getChoiceRows(model, slot) || [];
        }
        if (!rows.length) {
            rows = getGroupChoiceOptionsForPicker(group, hooks, model)
                .map((opt) => ({
                    id: String(opt.id || '').trim(),
                    name: String(opt.name || opt.id || '').trim(),
                    refUgap: String(opt.refUgap || opt.baseRefUgap || '').trim(),
                }))
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
            const selected = getSelectedInGroup(state, group).includes(oid)
                || state.selectedOptions.has(oid);
            const isBase = oid === baseId;
            if (selected) item.style.background = '#eff6ff';
            else if (isBase) item.style.borderLeft = '3px solid #059669';
            const ref = row.refUgap ? ` <span style="font-size:11px;color:#64748b;">${escapeHtml(row.refUgap)}</span>` : '';
            const isIbp = isImportGeneratedBaseOption(opt)
                || (typeof hooks?.isBaseCatalogOption === 'function' && hooks.isBaseCatalogOption(opt));
            const deltaHint = isIbp ? formatPickerDeltaHint(state, hooks, oid) : '';
            const baseTag = isBase
                ? ' <span style="font-size:11px;color:#059669;">(base modèle)</span>'
                : (isIbp ? ' <span style="font-size:11px;color:#64748b;">(IBP)</span>' : '');
            item.innerHTML = `
                <span style="flex:1;">${escapeHtml(row.name || opt.name)}${ref}${baseTag}</span>
                <span class="price">${isIbp ? `${formatPrice(opt, hooks)}${deltaHint}` : formatPrice(opt, hooks)}</span>
            `;
            item.onclick = () => {
                const BAL = global.UgapBaseAdjLinks;
                const groupForAdj = { ...group, options: group.options };
                try {
                    console.log('[UGAP][group-change][start]', {
                        groupId: String(groupForAdj?.groupId || groupForAdj?.id || '').trim(),
                        groupLabel: String(groupForAdj?.label || '').trim(),
                        decisionMode: String(groupForAdj?.decisionMode || '').trim(),
                        priceMode: String(groupForAdj?.priceMode || groupForAdj?.pricingMode || '').trim(),
                        selectedOptionId: String(oid || '').trim(),
                        baseOptionId: String(getGroupBaseOptionId(state, groupForAdj, hooks) || '').trim()
                    });
                } catch (_) {}
                if (BAL?.clearLinkedAdjForGroup) {
                    try { console.log('[UGAP][group-change][clear-linked]'); } catch (_) {}
                    BAL.clearLinkedAdjForGroup(state, groupForAdj);
                }
                clearGroupSelection(state, group, oid);
                state.selectedOptions.add(oid);
                const addedAdjIds = [];
                if (isBaseReplacedInGroup(state, groupForAdj, hooks)) {
                    const defaultBaseId = getGroupBaseOptionId(state, groupForAdj, hooks);
                    try { console.log('[UGAP][group-change][base-replaced]', { defaultBaseId: String(defaultBaseId || '').trim() }); } catch (_) {}
                    if (defaultBaseId) {
                        const added = BAL?.applyLinkedAdjToConfiguratorSelection?.(
                            state,
                            defaultBaseId,
                            hooks,
                            (id) => findCatalogOption(state, hooks, id),
                            groupForAdj
                        );
                        if (Array.isArray(added)) addedAdjIds.push(...added.map((x) => String(x || '').trim()).filter(Boolean));
                    }
                } else {
                    try { console.log('[UGAP][group-change][base-not-replaced]'); } catch (_) {}
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
        ensureSingleChoiceGroupDefault(state, group, hooks);
        state.familyModalContext = null;
        state._templateTreeModalGroup = group;
        modal.querySelector('.modal-content')?.classList.remove('modal-wide');
        title.textContent = group.label || 'Choix';
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
                rows.push(buildGroupRowHtml(state, norm, hooks, true, col1, showCategory));
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
                                <th>Détail</th>
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
        state.familyModalContext = null;
        state._templateTreeModalGroup = group;
        modal.querySelector('.modal-content')?.classList.remove('modal-wide');
        title.textContent = group.label || 'Options';
        optionsList.innerHTML = '';

        const draft = new Set(getSelectedInGroup(state, group));

        (Array.isArray(group.options) ? group.options : []).forEach((opt) => {
            const item = global.document.createElement('div');
            item.className = 'option-item';
            const cb = global.document.createElement('input');
            cb.type = 'checkbox';
            cb.id = `tpl-mc-${opt.id}`;
            cb.checked = draft.has(opt.id);
            cb.onchange = () => {
                if (cb.checked) draft.add(opt.id);
                else draft.delete(opt.id);
            };
            const label = global.document.createElement('label');
            label.htmlFor = cb.id;
            label.textContent = opt.name;
            label.style.flex = '1';
            label.style.marginLeft = '10px';
            const price = global.document.createElement('div');
            price.className = 'price';
            price.textContent = `${(opt.priceClient || opt.priceUgap || 0).toFixed(2)} €`;
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
        state.templateTreeRootIndex = -1;
        state._boatTemplateResolved = null;
    }

    function getModelTabLabel(state) {
        return String(state.selectedModel?.name || state.selectedModel?.label || 'Modèle').trim() || 'Modèle';
    }

    function isModelCategoryTabActive(state) {
        return Number(state.templateTreeRootIndex) === -1;
    }

    function isMotorisationTemplateRoot(node) {
        const label = String(node?.label || '').trim().toLowerCase();
        return /\bmotorisation\b/.test(label) || /^moteurs?$/.test(label);
    }

    function getActiveTemplateRootIndex(state, roots) {
        const list = Array.isArray(roots) ? roots : [];
        if (isModelCategoryTabActive(state) || !list.length) return -1;
        const rootIdx = Number(state.templateTreeRootIndex);
        if (Number.isInteger(rootIdx) && rootIdx >= 0 && rootIdx < list.length) return rootIdx;
        return 0;
    }

    function isExcelTemplateRootActive(state, roots) {
        const idx = getActiveTemplateRootIndex(state, roots);
        if (idx < 0) return false;
        return isMotorisationTemplateRoot(roots[idx]);
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
        getSingleChoiceDisplay,
        getGroupBaseOptionId,
        isBaseReplacedInGroup,
        isIbpReplacedInGroup,
        normalizeFamilyGroupForConfigurator,
        closeTemplateTreeModal,
        onModelSelected,
        getBoatTemplateForModel
    };
})(typeof window !== 'undefined' ? window : global);
