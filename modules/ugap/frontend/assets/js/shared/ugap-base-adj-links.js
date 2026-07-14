/**
 * Option de base (IBP) ↔ ligne mino/majo source dont elle est déduite.
 * Ex. IBP « Suzuki DF200… » ← ligne « Non fourniture du moteur de base - Poste 1 ».
 */
(function initUgapBaseAdjLinks(global) {
    'use strict';

    function isMotorBaseNonSupplyLabel(name) {
        const OLK = global.UgapOptionLineKind;
        if (OLK?.isMotorBaseNonSupplyLabel) return OLK.isMotorBaseNonSupplyLabel(name);
        return false;
    }

    function inferAdjLineKind(opt) {
        const OLK = global.UgapOptionLineKind;
        if (OLK?.inferOptionLineKind) return OLK.inferOptionLineKind(opt);
        return 'option';
    }

    function isImportGeneratedBaseOption(opt) {
        if (!opt || typeof opt !== 'object') return false;
        if (opt.importGeneratedFromBaseProduct === true || opt.importBaseProductId) return true;
        const id = String(opt?.id || '').trim();
        if (id.startsWith('opt_ibp_')) return true;
        return String(opt.refUgap || '').trim().toUpperCase().startsWith('IBP-');
    }

    function isAdjOptionForBaseLink(opt) {
        if (!opt || typeof opt !== 'object') return false;
        if (isImportGeneratedBaseOption(opt)) return false;
        if (opt.importExcludeFromBaseProduct === true) return false;
        const kind = inferAdjLineKind(opt);
        return kind === 'minoration' || kind === 'majoration';
    }

    /** Index catalogue (flatten + id normalisé) — invalidé quand la référence categories change. */
    let _catalogIndexCache = null;

    function getCatalogIndex(categories) {
        const cats = Array.isArray(categories) ? categories : [];
        if (_catalogIndexCache && _catalogIndexCache.cats === cats) return _catalogIndexCache;
        const flat = [];
        const byNormalizedId = new Map();
        cats.forEach((cat) => {
            (Array.isArray(cat?.options) ? cat.options : []).forEach((opt) => {
                if (!opt || typeof opt !== 'object') return;
                flat.push(opt);
                const nid = normalizeCatalogOptionId(opt.id);
                if (nid && !byNormalizedId.has(nid)) byNormalizedId.set(nid, opt);
            });
        });
        _catalogIndexCache = { cats, flat, byNormalizedId };
        return _catalogIndexCache;
    }

    function flattenCatalogOptions(categories) {
        return getCatalogIndex(categories).flat;
    }

    function normalizeCatalogOptionId(rawId) {
        const id = String(rawId || '').trim();
        if (!id) return '';
        if (/^opt_/i.test(id)) return id;
        const m = id.match(/(opt_[a-z0-9_]+)/i);
        return m ? m[1] : id;
    }

    function findCatalogOption(categories, optionId) {
        const oid = normalizeCatalogOptionId(optionId);
        if (!oid) return null;
        return getCatalogIndex(categories).byNormalizedId.get(oid) || null;
    }

    function findImportBaseProductByCatalogId(importBaseProducts, catalogOptionId) {
        const cid = normalizeCatalogOptionId(catalogOptionId);
        if (!cid) return null;
        return (Array.isArray(importBaseProducts) ? importBaseProducts : [])
            .find((bp) => normalizeCatalogOptionId(bp?.catalogOptionId) === cid) || null;
    }

    function filterAdjOptionIds(categories, ids) {
        return [...new Set(
            (Array.isArray(ids) ? ids : [])
                .map((x) => normalizeCatalogOptionId(x))
                .filter((id) => {
                    if (!id) return false;
                    const opt = findCatalogOption(categories, id);
                    return opt && isAdjOptionForBaseLink(opt);
                })
        )];
    }

    function findAdjByExcelLabel(categories, excelLabel) {
        const wanted = String(excelLabel || '').replace(/\s+/g, ' ').trim();
        if (!wanted) return '';
        const hit = flattenCatalogOptions(categories).find((opt) => {
            if (!isAdjOptionForBaseLink(opt)) return false;
            return String(opt.name || '').replace(/\s+/g, ' ').trim() === wanted;
        });
        return hit ? String(hit.id || '').trim() : '';
    }

    /**
     * Ligne(s) mino/majo dont l'IBP est déduite (importBaseProducts.optionIds, libellé Excel…).
     */
    function mergeResolvedAdjForBase(baseOpt, categories, ids) {
        const cats = Array.isArray(categories) ? categories : [];
        const merged = filterAdjOptionIds(cats, ids);
        findMotorNonSupplyAdjOptionIds(baseOpt, cats).forEach((id) => {
            if (id && !merged.includes(id)) merged.push(id);
        });
        return filterAdjOptionIds(cats, merged);
    }

    const _resolveAdjSourceCache = new Map();

    function clearResolveAdjSourceCache() {
        _resolveAdjSourceCache.clear();
    }

    function resolveSourceAdjOptionIdsForBase(baseCatalogOptionId, categories, importBaseProducts) {
        const baseId = String(baseCatalogOptionId || '').trim();
        if (!baseId) return [];

        const cats = Array.isArray(categories) ? categories : [];
        const ibp = Array.isArray(importBaseProducts) ? importBaseProducts : [];
        const cached = _resolveAdjSourceCache.get(baseId);
        if (cached && cached.cats === cats && cached.ibp === ibp) {
            return cached.out;
        }

        const baseOpt = findCatalogOption(cats, baseId);
        let out = [];

        if (baseOpt) {
            const fromSource = filterAdjOptionIds(
                cats,
                baseOpt.importBaseProductSourceOptionIds
            );
            if (fromSource.length) {
                out = mergeResolvedAdjForBase(baseOpt, cats, fromSource);
            } else {
                const fromLinked = filterAdjOptionIds(
                    cats,
                    (Array.isArray(baseOpt.linkedMinorationOptions) ? baseOpt.linkedMinorationOptions : [])
                        .map((x) => x?.optionId)
                );
                if (fromLinked.length) {
                    out = mergeResolvedAdjForBase(baseOpt, cats, fromLinked);
                } else {
                    const excelId = findAdjByExcelLabel(
                        cats,
                        baseOpt.importExcelLabel || baseOpt.details
                    );
                    if (excelId) {
                        out = mergeResolvedAdjForBase(baseOpt, cats, [excelId]);
                    }
                }
            }
        }

        if (!out.length) {
            const bp = findImportBaseProductByCatalogId(ibp, baseId);
            if (bp) {
                const fromBp = filterAdjOptionIds(cats, bp.optionIds);
                if (fromBp.length) {
                    out = mergeResolvedAdjForBase(baseOpt, cats, fromBp);
                } else {
                    const excelId = findAdjByExcelLabel(cats, bp.excelLabel);
                    if (excelId) {
                        out = mergeResolvedAdjForBase(baseOpt, cats, [excelId]);
                    }
                }
            }
        }

        if (!out.length) {
            const fallback = new Set();
            flattenCatalogOptions(cats).forEach((opt) => {
                if (!isAdjOptionForBaseLink(opt)) return;
                if (String(opt.linkedBaseCatalogOptionId || '').trim() === baseId) {
                    fallback.add(String(opt.id || '').trim());
                }
            });
            out = mergeResolvedAdjForBase(baseOpt, cats, [...fallback]);
        }

        _resolveAdjSourceCache.set(baseId, { cats, ibp, out });
        return out;
    }

    /** Option de base créée à la main (paramétrage modèle) — pas d’IBP import / moteur. */
    function isManualBaseCatalogOption(opt) {
        if (!opt || typeof opt !== 'object') return false;
        if (opt.manualBaseOption === true) return true;
        if (opt.importGeneratedFromBaseProduct === true || opt.importBaseProductId) return false;
        const id = String(opt?.id || '').trim();
        if (id.startsWith('opt_ibp_')) return false;
        return opt.baseIncluded === true && opt.isBaseOption === true;
    }

    /** Lignes « Non fourniture du moteur de base » liées au moteur de base du poste. */
    function findMotorNonSupplyAdjOptionIds(baseOpt, categories) {
        const baseId = String(baseOpt?.id || '').trim();
        const out = new Set();
        if (!baseId || isManualBaseCatalogOption(baseOpt)) return [];
        flattenCatalogOptions(categories).forEach((opt) => {
            const oid = String(opt?.id || '').trim();
            if (!oid || !isMotorBaseNonSupplyLabel(opt?.name)) return;
            if (inferAdjLineKind(opt) !== 'minoration') return;
            const linkedBase = String(opt.linkedBaseCatalogOptionId || '').trim();
            if (linkedBase && linkedBase === baseId) {
                out.add(oid);
                return;
            }
            if (isImportGeneratedBaseOption(baseOpt) && modelsOverlap(baseOpt, opt)) {
                out.add(oid);
            }
        });
        return [...out];
    }

    function filterAdjIdsForGroupPriceMode(adjIds, categories, group) {
        const mode = normalizeGroupPriceMode(group);
        if (mode !== 'minoration' && mode !== 'majoration') {
            return filterAdjOptionIds(categories, adjIds);
        }
        return filterAdjOptionIds(categories, adjIds).filter((id) => {
            const opt = findCatalogOption(categories, id);
            if (!opt) return false;
            const kind = inferAdjLineKind(opt);
            if (mode === 'minoration') return kind === 'minoration';
            if (mode === 'majoration') return kind === 'majoration';
            return true;
        });
    }

    function modelsOverlap(baseOpt, adjOpt) {
        const a = new Set(
            (Array.isArray(baseOpt?.compatibleModels) ? baseOpt.compatibleModels : [])
                .map((x) => String(x || '').trim())
                .filter(Boolean)
        );
        const b = (Array.isArray(adjOpt?.compatibleModels) ? adjOpt.compatibleModels : [])
            .map((x) => String(x || '').trim())
            .filter(Boolean);
        if (!a.size || !b.length) return true;
        return b.some((id) => a.has(id));
    }

    /** Candidats pour corriger une liaison manquante (même poste / modèles). */
    function getSourceAdjCandidatesForBase(baseOpt, categories) {
        const baseId = String(baseOpt?.id || '').trim();
        return flattenCatalogOptions(categories).filter((opt) => {
            const oid = String(opt?.id || '').trim();
            if (!oid || oid === baseId) return false;
            if (!isAdjOptionForBaseLink(opt)) return false;
            return modelsOverlap(baseOpt, opt);
        });
    }

    function normalizeGroupPriceMode(group) {
        return String(group?.priceMode ?? group?.pricingMode ?? '').trim().toLowerCase();
    }

    /** Groupe famille en « Prix minoration » ou « Prix majoration » → liaison source automatique. */
    function isAdjPricingGroup(group) {
        const mode = normalizeGroupPriceMode(group);
        return mode === 'minoration' || mode === 'majoration';
    }

    /**
     * Liaison mino/majo auto : uniquement motorisation / moteur (ex. « non fourniture moteur de base »).
     * Pas pour console, guindeau, etc. même si le choix remplace l’option de base du groupe.
     */
    function isMotorLinkedAdjGroup(group) {
        if (!group || typeof group !== 'object') return false;
        const hay = [
            group.label,
            group.groupLabel,
            group.groupId,
            group.familyLabel,
            group.categoryName,
            group.componentLabel,
        ].map((x) => String(x || '').trim().toLowerCase()).join(' ');
        if (!hay) return false;
        if (/\b(motorisation|moteurs?)\b/i.test(hay)) return true;
        return false;
    }

    function shouldAutoApplyLinkedAdj(group) {
        if (!group || typeof group !== 'object') return false;
        // Motorisation : minoration auto dès remplacement du moteur de base.
        if (isMotorLinkedAdjGroup(group)) return true;
        return isAdjPricingGroup(group);
    }

    /** Groupe motorisation sans mode explicite → minoration par défaut. */
    function effectiveAdjGroupForLinks(group) {
        if (!group || typeof group !== 'object') return group;
        if (isMotorLinkedAdjGroup(group) && !isAdjPricingGroup(group)) {
            return { ...group, priceMode: 'minoration', pricingMode: 'minoration' };
        }
        return group;
    }

    function isOptionSelectableForModel(opt, model, isSelectable) {
        if (typeof isSelectable === 'function') {
            try {
                return isSelectable(opt, model) !== false;
            } catch (_) {
                return true;
            }
        }
        return true;
    }

    function applyLinkedAdjToConfiguratorSelection(state, baseCatalogOptionId, hooks, findOptionFn, group) {
        const baseId = String(baseCatalogOptionId || '').trim();
        if (!baseId || !state || typeof state !== 'object') return [];
        group = effectiveAdjGroupForLinks(group);
        if (!shouldAutoApplyLinkedAdj(group)) return [];
        const categories = Array.isArray(state.categories) ? state.categories : [];
        const importBaseProducts = Array.isArray(state.importBaseProducts) ? state.importBaseProducts : [];
        let linked = resolveSourceAdjOptionIdsForBase(baseId, categories, importBaseProducts);
        linked = filterAdjIdsForGroupPriceMode(linked, categories, group);
        if (!linked.length) return [];

        const resolve = typeof findOptionFn === 'function'
            ? findOptionFn
            : (id) => findCatalogOption(categories, id);
        const pick = hooks?.isOptionCompatibleWithSelectedModel
            || hooks?.isOptionSelectable
            || null;
        const model = state.selectedModel || null;
        const mode = normalizeGroupPriceMode(group);
        const added = [];

        linked.forEach((adjId) => {
            const opt = resolve(adjId);
            if (!opt || !isAdjOptionForBaseLink(opt)) return;
            // Règle métier: en groupe "minoration", la ligne liée s'applique dès que la base est remplacée.
            if (mode !== 'minoration' && !isOptionSelectableForModel(opt, model, pick)) return;
            state.selectedOptions.add(adjId);
            added.push(adjId);
        });
        return added;
    }

    function removeLinkedAdjFromConfiguratorSelection(state, baseCatalogOptionId, group) {
        const baseId = String(baseCatalogOptionId || '').trim();
        if (!baseId || !state?.selectedOptions) return;
        group = effectiveAdjGroupForLinks(group);
        if (!shouldAutoApplyLinkedAdj(group)) return;

        const categories = Array.isArray(state.categories) ? state.categories : [];
        const importBaseProducts = Array.isArray(state.importBaseProducts) ? state.importBaseProducts : [];
        resolveSourceAdjOptionIdsForBase(baseId, categories, importBaseProducts).forEach((id) => {
            state.selectedOptions.delete(id);
            state.fivePercentOptions?.delete?.(id);
        });
    }

    /**
     * Retire les mino/majo liées aux options de base du groupe (changement de moteur).
     * Uniquement groupes motorisation — pas console / autres IBP.
     */
    function clearLinkedAdjForGroup(state, group) {
        if (!state?.selectedOptions || !group) return;
        group = effectiveAdjGroupForLinks(group);
        if (!shouldAutoApplyLinkedAdj(group)) return;
        const categories = Array.isArray(state.categories) ? state.categories : [];
        const importBaseProducts = Array.isArray(state.importBaseProducts) ? state.importBaseProducts : [];
        const baseIds = new Set();
        (Array.isArray(group.optionIds) ? group.optionIds : []).forEach((id) => {
            const oid = String(id || '').trim();
            if (oid) baseIds.add(oid);
        });
        (Array.isArray(group.options) ? group.options : []).forEach((opt) => {
            const oid = String(opt?.id || '').trim();
            if (oid) baseIds.add(oid);
        });

        const toRemove = new Set();
        baseIds.forEach((baseId) => {
            resolveSourceAdjOptionIdsForBase(baseId, categories, importBaseProducts)
                .forEach((adjId) => toRemove.add(String(adjId || '').trim()));
        });
        flattenCatalogOptions(categories).forEach((opt) => {
            if (!isAdjOptionForBaseLink(opt)) return;
            const linkedBase = String(opt.linkedBaseCatalogOptionId || '').trim();
            if (linkedBase && baseIds.has(linkedBase)) {
                toRemove.add(String(opt.id || '').trim());
            }
        });

        toRemove.forEach((id) => {
            if (!id) return;
            state.selectedOptions.delete(id);
            state.fivePercentOptions?.delete?.(id);
        });
    }

    /**
     * Après défauts single-choice : pour chaque groupe en prix mino/majo, sélectionne aussi la ligne source.
     */
    function syncLinkedAdjForAdjPricingGroups(state, groups, hooks, findOptionFn, groupCtx) {
        if (!state || typeof state !== 'object') return;
        const ctx = groupCtx && typeof groupCtx === 'object' ? groupCtx : {};
        const isReplaced = ctx.isBaseReplacedInGroup || ctx.isIbpReplacedInGroup;
        const getBaseId = ctx.getGroupBaseOptionId;
        (Array.isArray(groups) ? groups : []).forEach((group) => {
            if (!group || group.missing) return;

            const replaced = typeof isReplaced === 'function' && isReplaced(state, group, hooks);
            if (!replaced) {
                if (isAdjPricingGroup(group)) clearLinkedAdjForGroup(state, group);
                return;
            }

            const defaultBaseId = typeof getBaseId === 'function'
                ? String(getBaseId(state, group, hooks) || '').trim()
                : '';
            if (!defaultBaseId) return;

            if (!isMotorLinkedAdjGroup(group)) return;

            applyLinkedAdjToConfiguratorSelection(
                state,
                defaultBaseId,
                hooks,
                findOptionFn,
                effectiveAdjGroupForLinks(group)
            );
        });
    }

    global.UgapBaseAdjLinks = {
        inferAdjLineKind,
        isAdjOptionForBaseLink,
        isImportGeneratedBaseOption,
        isManualBaseCatalogOption,
        normalizeGroupPriceMode,
        isAdjPricingGroup,
        isMotorLinkedAdjGroup,
        isMotorBaseNonSupplyLabel,
        shouldAutoApplyLinkedAdj,
        effectiveAdjGroupForLinks,
        flattenCatalogOptions,
        findCatalogOption,
        findAdjByExcelLabel,
        resolveSourceAdjOptionIdsForBase,
        clearResolveAdjSourceCache,
        getSourceAdjCandidatesForBase,
        filterAdjIdsForGroupPriceMode,
        applyLinkedAdjToConfiguratorSelection,
        removeLinkedAdjFromConfiguratorSelection,
        clearLinkedAdjForGroup,
        syncLinkedAdjForAdjPricingGroups,
        findMotorNonSupplyAdjOptionIds,
    };
})(typeof window !== 'undefined' ? window : globalThis);
