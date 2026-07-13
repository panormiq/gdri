/**
 * FICHIER : parametrage/assets/js/catalogue/catalogue-bulk-link.js
 * RÔLE : Association globale option ↔ nœud catalogue, nœud par nœud (mots-clés).
 * ENTRÉES : arbre catalogue, options (UgapCatalogueLcState), heuristique
 * SORTIES : updateOptionFieldsBulk
 * DÉPEND DE : catalogue-option-link-heuristic.js, catalogue-lc-state.js, catalogue-nodes-core.js
 * APPELÉ PAR : catalogue-tab.js
 */
(function initUgapCatalogueBulkLink(global) {
    'use strict';

    const Heur = () => global.UgapCatalogueOptionLinkHeuristic;
    const State = () => global.UgapCatalogueLcState;
    const Core = () => global.UgapCatalogueNodesCore;

    /** Parcours profondeur : parent avant enfants (priorité aux dossiers racine). */
    function collectNodesDepthFirst(nodes) {
        const list = Array.isArray(nodes) ? nodes : [];
        const out = [];
        const walk = (parentId) => {
            (Core()?.getChildren?.(list, parentId) || []).forEach((node) => {
                out.push(node);
                walk(String(node.id || '').trim());
            });
        };
        walk('');
        return out;
    }

    /**
     * Propositions → affectations pour un seul nœud (même règles que l’association globale).
     * @returns {{ assignments: object[], count: number, skipped?: string, message?: string, label?: string }}
     */
    function collectAssignmentsForNode(node, allOptions, options = {}) {
        const H = Heur();
        const nodeId = String(node?.id || '').trim();
        const label = String(node?.label || nodeId).trim();
        const assignedInRun = options.assignedInRun instanceof Set ? options.assignedInRun : new Set();
        const assignments = [];

        const kwRaw = String(node?.keywords || '').trim();
        if (!kwRaw) {
            return { assignments, count: 0, skipped: 'no_keywords', label };
        }

        const kwCheck = H?.validateObjectKeywords?.(node);
        if (kwCheck && !kwCheck.ok) {
            return {
                assignments,
                count: 0,
                skipped: 'invalid_keywords',
                message: kwCheck.message,
                label,
            };
        }

        const suggestions = H.suggestOptionsForObject(node, allOptions, { objectId: nodeId });
        let count = 0;

        (Array.isArray(suggestions) ? suggestions : []).forEach((row) => {
            if (!row?.score) return;
            const opt = row.option || {};
            const optId = String(opt.id || '').trim();
            if (!optId) return;

            const linked = String(opt.catalogObjectId || '').trim();
            if (linked && linked !== nodeId) return;
            if (assignedInRun.has(optId)) return;

            assignments.push({ optionId: optId, catalogObjectId: nodeId });
            assignedInRun.add(optId);
            count += 1;
        });

        return { assignments, count, label };
    }

    async function persistAssignments(assignments) {
        const St = State();
        if (!assignments.length) return;
        if (St.updateOptionFieldsBulk) {
            await St.updateOptionFieldsBulk(assignments);
        } else {
            for (const item of assignments) {
                await St.updateOptionFields(item.optionId, { catalogObjectId: item.catalogObjectId });
            }
        }
    }

    /**
     * Lie automatiquement les options correspondant aux mots-clés d’un seul nœud.
     * @param {object} node — nœud catalogue (id + keywords)
     * @returns {Promise<{ assignments: object[], saved: boolean, stats: object }>}
     */
    async function runAssociateForNode(node) {
        const H = Heur();
        const St = State();
        if (!H?.suggestOptionsForObject || !St?.getAllOptions) {
            throw new Error('Heuristique ou état catalogue indisponible.');
        }
        if (!node?.id) throw new Error('Nœud invalide.');

        try {
            await St.refreshOptionsFromServer?.();
        } catch (err) {
            console.warn('[UgapCatalogue] Rafraîchissement options avant association nœud :', err);
        }

        const allOptions = St.getAllOptions() || [];
        const result = collectAssignmentsForNode(node, allOptions);
        const stats = {
            nodeId: String(node.id || '').trim(),
            label: result.label || String(node.label || '').trim(),
            optionsLinked: result.count,
            skipped: result.skipped || null,
            message: result.message || '',
        };

        if (result.skipped === 'no_keywords') {
            return { assignments: [], stats, saved: false };
        }
        if (result.skipped === 'invalid_keywords') {
            return { assignments: [], stats, saved: false };
        }
        if (!result.assignments.length) {
            return { assignments: [], stats, saved: false };
        }

        await persistAssignments(result.assignments);
        return { assignments: result.assignments, stats, saved: true };
    }

    /**
     * Confirmation puis association automatique pour un seul nœud.
     * @param {object} node
     * @param {{ confirm?: function, btn?: HTMLElement }} [options]
     */
    async function runSingleNodeWithConfirm(node, options = {}) {
        const St = State();
        const H = Heur();
        const nodeId = String(node?.id || '').trim();
        const label = String(node?.label || nodeId).trim();
        const kwRaw = String(node?.keywords || '').trim();

        if (!nodeId) {
            global.showAlert?.('Sélectionnez un nœud.', 'warning');
            return;
        }
        if (!kwRaw) {
            global.showAlert?.(
                'Renseignez les mots-clés de ce nœud (ex. pont, cadene), puis enregistrez ou relancez.',
                'warning'
            );
            return;
        }

        const kwCheck = H?.validateObjectKeywords?.(node);
        if (kwCheck && !kwCheck.ok) {
            global.showAlert?.(kwCheck.message || 'Mots-clés invalides.', 'warning');
            return;
        }

        const unlinked = (St?.getAllOptions?.() || []).filter((o) => {
            if (!H?.isEligibleImportOption?.(o)) return false;
            return !String(o.catalogObjectId || '').trim();
        }).length;

        const msg = [
            `Associer les options à « ${label} » ?`,
            '',
            `• Mots-clés : ${kwRaw}`,
            `• ${unlinked} option(s) sans nœud actuellement`,
            '• Les options déjà liées ailleurs ne seront pas déplacées',
            '• Même règle que « Proposer des liaisons » (sans sélection manuelle)',
        ].join('\n');

        const btn = options.btn || null;
        const run = () => executeSingleNodeAssociate(node, btn);

        if (typeof options.confirm === 'function') {
            return new Promise((resolve, reject) => {
                options.confirm(msg, () => {
                    void run().then(resolve).catch(reject);
                });
            });
        }

        const ok = typeof global.confirm === 'function' ? global.confirm(msg) : window.confirm(msg);
        if (!ok) return;
        return run();
    }

    async function executeSingleNodeAssociate(node, btn) {
        const label = String(node?.label || node?.id || '').trim();
        if (btn) {
            btn.disabled = true;
            btn.dataset.prevLabel = btn.textContent || '';
            btn.textContent = 'Association…';
        }
        try {
            const result = await runAssociateForNode(node);
            if (result.stats?.skipped === 'no_keywords') {
                global.showAlert?.(
                    'Aucun mot-clé sur ce nœud. Renseignez-les dans le champ ci-dessus.',
                    'warning'
                );
                return result;
            }
            if (result.stats?.skipped === 'invalid_keywords') {
                global.showAlert?.(result.stats.message || 'Mots-clés invalides.', 'warning');
                return result;
            }
            if (!result.assignments.length) {
                global.showAlert?.(
                    `Aucune correspondance pour « ${label} ». Vérifiez les mots-clés et les libellés des options.`,
                    'info'
                );
                return result;
            }
            global.showAlert?.(
                `${result.stats.optionsLinked} option(s) liée(s) à « ${label} ».`,
                'success'
            );
            return result;
        } catch (err) {
            global.showAlert?.(err?.message || String(err), 'error');
            throw err;
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.textContent = btn.dataset.prevLabel || 'Associer options à ce nœud';
                delete btn.dataset.prevLabel;
            }
        }
    }

    /**
     * Pour chaque nœud avec mots-clés valides, lie les options correspondantes (non liées ailleurs).
     * @returns {Promise<{ assignments: object[], stats: object }>}
     */
    async function runBulkAssociateByNode() {
        const H = Heur();
        const St = State();
        if (!H?.suggestOptionsForObject || !St?.getAllOptions) {
            throw new Error('Heuristique ou état catalogue indisponible.');
        }

        try {
            await St.refreshOptionsFromServer?.();
        } catch (err) {
            console.warn('[UgapCatalogue] Rafraîchissement options avant association globale :', err);
        }

        const catalog = St.getCatalog?.() || {};
        const nodes = collectNodesDepthFirst(catalog.nodes);
        const allOptions = St.getAllOptions() || [];

        const assignments = [];
        const assignedInRun = new Set();
        const stats = {
            nodesTotal: nodes.length,
            nodesWithKeywords: 0,
            nodesSkippedNoKeywords: 0,
            nodesSkippedInvalidKw: 0,
            optionsLinked: 0,
            perNode: []
        };

        nodes.forEach((node) => {
            const nodeId = String(node.id || '').trim();
            const label = String(node.label || nodeId).trim();
            const kwRaw = String(node.keywords || '').trim();

            if (!kwRaw) {
                stats.nodesSkippedNoKeywords += 1;
                return;
            }

            const kwCheck = H.validateObjectKeywords?.(node);
            if (kwCheck && !kwCheck.ok) {
                stats.nodesSkippedInvalidKw += 1;
                return;
            }

            stats.nodesWithKeywords += 1;
            const { assignments: nodeAssignments, count: nodeCount } = collectAssignmentsForNode(
                node,
                allOptions,
                { assignedInRun }
            );

            nodeAssignments.forEach((item) => assignments.push(item));

            if (nodeCount > 0) {
                stats.perNode.push({ nodeId, label, count: nodeCount });
            }
        });

        stats.optionsLinked = assignments.length;

        if (!assignments.length) {
            return { assignments: [], stats, saved: false };
        }

        await persistAssignments(assignments);

        return { assignments, stats, saved: true };
    }

    async function executeBulkAssociate(btn) {
        if (btn) {
            btn.disabled = true;
            btn.textContent = 'Association…';
        }
        try {
            const result = await runBulkAssociateByNode();
            if (!result.assignments.length) {
                global.showAlert?.(
                    'Aucune correspondance trouvée. Vérifiez les mots-clés des nœuds et les libellés des options.',
                    'info'
                );
                return result;
            }
            const top = result.stats.perNode
                .slice(0, 5)
                .map((r) => `  · ${r.label} : ${r.count}`)
                .join('\n');
            const more = result.stats.perNode.length > 5
                ? `\n  … et ${result.stats.perNode.length - 5} autre(s) nœud(s)`
                : '';
            global.showAlert?.(
                `${result.stats.optionsLinked} option(s) liée(s) sur `
                + `${result.stats.nodesWithKeywords} nœud(s).\n${top}${more}`,
                'success'
            );
            return result;
        } catch (err) {
            global.showAlert?.(err?.message || String(err), 'error');
            throw err;
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.textContent = 'Associer options aux nœuds';
            }
        }
    }

    /**
     * Demande confirmation puis exécute l’association nœud par nœud.
     * @param {{ confirm?: (message: string, onOk: () => void) => void }} [options]
     */
    async function runWithConfirm(options = {}) {
        const St = State();
        const catalog = St?.getCatalog?.() || {};
        const nodesWithKw = collectNodesDepthFirst(catalog.nodes)
            .filter((n) => String(n.keywords || '').trim());
        if (!nodesWithKw.length) {
            global.showAlert?.(
                'Aucun nœud avec mots-clés. Renseignez-les dans le détail de chaque nœud (ex. pont, cadene).',
                'warning'
            );
            return;
        }

        const unlinked = (St?.getAllOptions?.() || []).filter((o) => {
            if (!Heur()?.isEligibleImportOption?.(o)) return false;
            return !String(o.catalogObjectId || '').trim();
        }).length;

        const msg = [
            'Associer les options aux nœuds du catalogue ?',
            '',
            `• ${nodesWithKw.length} nœud(s) avec mots-clés seront traités un par un`,
            `• ${unlinked} option(s) sans nœud actuellement`,
            '• Les options déjà liées ailleurs ne seront pas déplacées',
            '• Même règle de correspondance que « Proposer des liaisons »',
        ].join('\n');

        const btn = global.document.querySelector('[data-bulk-associate-options]');
        const run = () => executeBulkAssociate(btn);

        if (typeof options.confirm === 'function') {
            return new Promise((resolve, reject) => {
                options.confirm(msg, () => {
                    void run().then(resolve).catch(reject);
                });
            });
        }

        const ok = typeof global.confirm === 'function' ? global.confirm(msg) : window.confirm(msg);
        if (!ok) return;
        return run();
    }

    global.UgapCatalogueBulkLink = {
        collectNodesDepthFirst,
        collectAssignmentsForNode,
        runAssociateForNode,
        runSingleNodeWithConfirm,
        runBulkAssociateByNode,
        runWithConfirm
    };
})(window);
