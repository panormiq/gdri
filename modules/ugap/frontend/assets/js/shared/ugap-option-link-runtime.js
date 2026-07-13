/**
 * FICHIER : modules/ugap/frontend/assets/js/shared/ugap-option-link-runtime.js
 * RÔLE : Évaluation runtime des liaisons (incompatibilité, requires, fit, auto-add).
 *
 * ENTRÉES : optionLinkRules, dependencyRules, categories, importBaseProducts, selectedSet
 * SORTIES : statuts visuels, conflits, alternatives, auto-adds
 *
 * DÉPEND DE : ugap-base-adj-links.js (IBP ↔ MINO)
 * NE PAS : UI modal, DOM configurateur
 * APPELÉ PAR : configurateur-link-bridge.js
 */
(function initUgapOptionLinkRuntime(global) {
    'use strict';

    function normalizeIds(raw) {
        return [...new Set(
            (Array.isArray(raw) ? raw : [])
                .map((x) => String(x || '').trim())
                .filter(Boolean)
        )];
    }

    function flattenOptions(categories) {
        const out = [];
        (Array.isArray(categories) ? categories : []).forEach((cat) => {
            (Array.isArray(cat?.options) ? cat.options : []).forEach((opt) => {
                if (opt && typeof opt === 'object') out.push(opt);
            });
        });
        return out;
    }

    function createRuntime(ctx) {
        const categories = Array.isArray(ctx?.categories) ? ctx.categories : [];
        const importBaseProducts = Array.isArray(ctx?.importBaseProducts) ? ctx.importBaseProducts : [];
        const optionLinkRules = Array.isArray(ctx?.optionLinkRules) ? ctx.optionLinkRules : [];
        const dependencyRules = Array.isArray(ctx?.dependencyRules) ? ctx.dependencyRules : [];
        const findOptionById = typeof ctx?.findOptionById === 'function'
            ? ctx.findOptionById
            : (id) => flattenOptions(categories).find((o) => String(o?.id || '') === String(id || '')) || null;

        const optionById = new Map(
            flattenOptions(categories).map((opt) => [String(opt.id || '').trim(), opt]).filter(([id]) => id)
        );

        const incompatibilityMap = new Map();
        const addIncompat = (a, b) => {
            const left = String(a || '').trim();
            const right = String(b || '').trim();
            if (!left || !right || left === right) return;
            if (!incompatibilityMap.has(left)) incompatibilityMap.set(left, new Set());
            if (!incompatibilityMap.has(right)) incompatibilityMap.set(right, new Set());
            incompatibilityMap.get(left).add(right);
            incompatibilityMap.get(right).add(left);
        };

        const addClique = (ids) => {
            const list = normalizeIds(ids);
            for (let i = 0; i < list.length; i += 1) {
                for (let j = i + 1; j < list.length; j += 1) {
                    addIncompat(list[i], list[j]);
                }
            }
        };

        optionLinkRules.forEach((rule) => {
            if (String(rule?.type || '') !== 'incompatibility') return;
            const sources = normalizeIds(rule.sourceOptionIds);
            const targets = normalizeIds(rule.targetOptionIds);
            sources.forEach((s) => targets.forEach((t) => addIncompat(s, t)));
        });

        const equivParent = new Map();
        const equivFind = (id) => {
            const cur = String(id || '').trim();
            if (!cur) return '';
            if (!equivParent.has(cur)) equivParent.set(cur, cur);
            if (equivParent.get(cur) !== cur) equivParent.set(cur, equivFind(equivParent.get(cur)));
            return equivParent.get(cur);
        };
        const equivUnion = (a, b) => {
            const ra = equivFind(a);
            const rb = equivFind(b);
            if (ra && rb && ra !== rb) equivParent.set(rb, ra);
        };
        optionLinkRules.forEach((rule) => {
            if (String(rule?.type || '') !== 'equivalent_base') return;
            const members = normalizeIds([...(rule.sourceOptionIds || []), ...(rule.targetOptionIds || [])]);
            members.forEach((id) => equivFind(id));
            members.forEach((id, idx) => {
                if (idx > 0) equivUnion(members[0], id);
            });
        });

        const BAL = global.UgapBaseAdjLinks;
        const ibpEquivClusters = new Map();
        flattenOptions(categories).forEach((opt) => {
            if (!BAL?.isImportGeneratedBaseOption?.(opt)) return;
            const id = String(opt.id || '').trim();
            if (!id) return;
            const root = equivFind(id) || id;
            if (!ibpEquivClusters.has(root)) ibpEquivClusters.set(root, new Set());
            ibpEquivClusters.get(root).add(id);
        });

        if (BAL?.isImportGeneratedBaseOption && BAL?.resolveSourceAdjOptionIdsForBase) {
            const processedRoots = new Set();
            flattenOptions(categories).forEach((opt) => {
                if (!BAL.isImportGeneratedBaseOption(opt)) return;
                const baseId = String(opt.id || '').trim();
                const root = equivFind(baseId) || baseId;
                if (processedRoots.has(root)) return;
                processedRoots.add(root);

                const clusterBases = ibpEquivClusters.get(root) || new Set([baseId]);
                const adjIds = new Set();
                clusterBases.forEach((bid) => {
                    BAL.resolveSourceAdjOptionIdsForBase(bid, categories, importBaseProducts)
                        .forEach((adjId) => adjIds.add(String(adjId || '').trim()));
                });
                const mutexAdj = [...adjIds].filter((adjId) => {
                    const opt = optionById.get(adjId);
                    if (!opt) return true;
                    return !(BAL.isMotorBaseNonSupplyLabel
                        && BAL.isMotorBaseNonSupplyLabel(String(opt?.name || '')));
                });
                const members = [...clusterBases, ...mutexAdj].filter(Boolean);
                addClique(members);
                clusterBases.forEach((baseId) => {
                    [...adjIds].forEach((adjId) => {
                        const opt = optionById.get(adjId);
                        if (!opt || !BAL.isMotorBaseNonSupplyLabel?.(String(opt?.name || ''))) return;
                        addIncompat(baseId, adjId);
                    });
                });
            });
        }

        optionLinkRules.forEach((rule) => {
            if (String(rule?.type || '') !== 'complementary') return;
            normalizeIds(rule.sourceOptionIds).forEach((sourceId) => {
                normalizeIds(rule.targetOptionIds).forEach((targetId) => addIncompat(sourceId, targetId));
            });
        });

        const requiresRules = optionLinkRules.filter((r) => String(r?.type || '') === 'requires');
        const fitRules = optionLinkRules.filter((r) => String(r?.type || '') === 'variant_fit');

        function rulesForChild(optionId) {
            const oid = String(optionId || '').trim();
            return {
                requires: requiresRules.filter((r) => normalizeIds(r.targetOptionIds).includes(oid)),
                fit: fitRules.filter((r) => normalizeIds(r.targetOptionIds).includes(oid)),
            };
        }

        function parentsForChild(optionId) {
            const { requires, fit } = rulesForChild(optionId);
            const parents = new Set();
            [...requires, ...fit].forEach((rule) => {
                normalizeIds(rule.sourceOptionIds).forEach((id) => parents.add(id));
            });
            return [...parents];
        }

        function getIncompatibles(optionId) {
            return [...(incompatibilityMap.get(String(optionId || '').trim()) || [])];
        }

        function getVisualStatus(optionId, selectedSet) {
            const oid = String(optionId || '').trim();
            const selected = selectedSet instanceof Set ? selectedSet : new Set();
            if (selected.has(oid)) return 'selected';

            const parents = parentsForChild(oid);
            const { requires, fit } = rulesForChild(oid);

            if (requires.length || fit.length) {
                const selectedParents = parents.filter((pid) => selected.has(pid));
                if (selectedParents.length) {
                    return fit.length ? 'recommended' : 'recommended';
                }
                const incompatSelected = getIncompatibles(oid).filter((id) => selected.has(id));
                if (incompatSelected.length) return 'incompatible';
                return 'neutral';
            }

            const wouldConflict = getIncompatibles(oid).some((id) => selected.has(id));
            if (wouldConflict) return 'incompatible';
            return 'neutral';
        }

        function analyzeSelect(optionId, selectedSet) {
            const oid = String(optionId || '').trim();
            const selected = selectedSet instanceof Set ? new Set(selectedSet) : new Set();
            const conflicts = getIncompatibles(oid).filter((id) => selected.has(id));
            const { requires } = rulesForChild(oid);
            const missingParents = [];
            if (requires.length) {
                const parents = parentsForChild(oid);
                const hasParent = parents.some((pid) => selected.has(pid));
                if (!hasParent) missingParents.push(...parents);
            }

            if (!conflicts.length && !missingParents.length) {
                return { ok: true, conflicts: [], missingParents: [], alternatives: [] };
            }

            const alternatives = [];
            if (conflicts.length) {
                requires.forEach((rule) => {
                    normalizeIds(rule.sourceOptionIds).forEach((parentId) => {
                        if (!conflicts.includes(parentId) && optionById.has(parentId)) {
                            alternatives.push({
                                kind: 'parent',
                                optionId: parentId,
                                label: String(findOptionById(parentId)?.name || parentId),
                                message: `Choisir ${findOptionById(parentId)?.name || parentId} comme prérequis`,
                            });
                        }
                    });
                });
                fitRules.forEach((rule) => {
                    normalizeIds(rule.targetOptionIds).forEach((targetId) => {
                        if (targetId === oid) return;
                        normalizeIds(rule.sourceOptionIds).forEach((parentId) => {
                            if (!conflicts.includes(parentId) && optionById.has(targetId)) {
                                alternatives.push({
                                    kind: 'sibling',
                                    optionId: targetId,
                                    label: String(findOptionById(targetId)?.name || targetId),
                                    message: rule.label || 'Variante compatible',
                                });
                            }
                        });
                    });
                });
            }

            if (missingParents.length) {
                missingParents.forEach((parentId) => {
                    alternatives.push({
                        kind: 'require_parent',
                        optionId: parentId,
                        label: String(findOptionById(parentId)?.name || parentId),
                        message: `Ajouter le prérequis ${findOptionById(parentId)?.name || parentId}`,
                    });
                });
            }

            const conflictLabels = conflicts.map((id) => String(findOptionById(id)?.name || id));
            let message = '';
            if (conflicts.length && missingParents.length) {
                message = `Incompatible avec : ${conflictLabels.join(', ')}. Prérequis manquant.`;
            } else if (conflicts.length) {
                message = `Incompatible avec la sélection actuelle : ${conflictLabels.join(', ')}.`;
            } else {
                message = 'Prérequis non satisfait pour cette option.';
            }

            return {
                ok: false,
                conflicts,
                missingParents,
                alternatives,
                message,
                optionLabel: String(findOptionById(oid)?.name || oid),
            };
        }

        function applyAutoAdds(selectedSet) {
            const selected = selectedSet instanceof Set ? selectedSet : new Set();
            const added = [];
            let changed = true;
            while (changed) {
                changed = false;
                dependencyRules.forEach((rule) => {
                    const trigger = String(rule?.triggerOptionId || '').trim();
                    if (!trigger || !selected.has(trigger)) return;
                    normalizeIds(rule.autoSelectOptionIds).forEach((id) => {
                        if (!selected.has(id)) {
                            selected.add(id);
                            added.push(id);
                            changed = true;
                        }
                    });
                });
            }
            return added;
        }

        function reconcileDependents(removedId, selectedSet) {
            const removed = String(removedId || '').trim();
            const selected = selectedSet instanceof Set ? selectedSet : new Set();
            const toRemove = [];
            selected.forEach((id) => {
                const parents = parentsForChild(id);
                if (!parents.length) return;
                if (parents.includes(removed)) toRemove.push(id);
            });
            toRemove.forEach((id) => selected.delete(id));
            return toRemove;
        }

        function resolveIncompatibilities(selectedSet) {
            const selected = selectedSet instanceof Set ? selectedSet : new Set();
            const removed = [];
            [...selected].forEach((id) => {
                getIncompatibles(id).forEach((other) => {
                    if (selected.has(other)) {
                        selected.delete(other);
                        removed.push(other);
                    }
                });
            });
            return [...new Set(removed)];
        }

        return {
            getVisualStatus,
            analyzeSelect,
            applyAutoAdds,
            reconcileDependents,
            resolveIncompatibilities,
            getIncompatibles,
            parentsForChild,
            optionById,
        };
    }

    global.UgapOptionLinkRuntime = { createRuntime, flattenOptions, normalizeIds };
})(typeof window !== 'undefined' ? window : globalThis);
