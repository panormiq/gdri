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
            const suggestions = H.suggestOptionsForObject(node, allOptions, { objectId: nodeId });
            let nodeCount = 0;

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
                nodeCount += 1;
            });

            if (nodeCount > 0) {
                stats.perNode.push({ nodeId, label, count: nodeCount });
            }
        });

        stats.optionsLinked = assignments.length;

        if (!assignments.length) {
            return { assignments: [], stats, saved: false };
        }

        if (St.updateOptionFieldsBulk) {
            await St.updateOptionFieldsBulk(assignments);
        } else {
            for (const item of assignments) {
                await St.updateOptionFields(item.optionId, { catalogObjectId: item.catalogObjectId });
            }
        }

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
        runBulkAssociateByNode,
        runWithConfirm
    };
})(window);
