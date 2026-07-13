/**
 * FICHIER : modules/ugap/frontend/assets/js/tabs/template-bateau-variant-editor.js
 * RÔLE : Aperçu / réordonnancement d’un variant (parcours personnalisé) dérivé d’un template de base.
 *
 * ENTRÉES : template, variant, conteneur DOM
 * SORTIES : tableau parcours (drag reorder) via parametrage-parcours-bridge
 *
 * DÉPEND DE : parametrage-parcours-bridge.js, bateau-base-lc-state.js, boat-template-tree.js
 * NE PAS : édition structure template, persistance template
 *
 * APPELÉ PAR : template-bateau-tab.js
 */
(function initUgapTemplateBateauVariantEditor(global) {
    'use strict';

    const St = () => global.UgapBateauBaseLcState;
    const Bridge = () => global.UgapParametrageParcoursBridge;
    const Tree = () => global.UgapBoatTemplateTree;

    function esc(v) {
        if (typeof global.escapeHtml === 'function') return global.escapeHtml(v);
        return String(v ?? '');
    }

    function buildVariantPreviewTemplate(baseTpl, variant) {
        const tpl = baseTpl && typeof baseTpl === 'object' ? baseTpl : {};
        const vid = String(variant?.id || '').trim();
        const snap = tpl.snapshot && typeof tpl.snapshot === 'object' ? { ...tpl.snapshot } : {};
        const templateId = String(tpl.id || '').trim();
        const { order } = St()?.getMergedTemplateVariantCatalogNodeOrder?.(templateId, vid) || { order: {} };
        const catalogNodes = resolveCatalogNodes();
        const BTree = Tree();
        const included = BTree?.resolveIncludedCatalogNodeIds?.(snap, catalogNodes, snap.catalogNodeOrder) || [];
        const storedOrder = BTree?.applyStoredCatalogNodeOrder?.(catalogNodes, order, included) || order;
        let categoryTree = [];
        if (BTree?.buildCategoryTreeFromIncludedCatalog) {
            categoryTree = BTree.buildCategoryTreeFromIncludedCatalog(catalogNodes, storedOrder, included);
        }
        return {
            id: `${templateId}::${vid}`,
            label: String(variant?.label || 'Variant').trim(),
            snapshot: {
                ...snap,
                catalogNodeOrder: storedOrder,
                includedCatalogNodeIds: included,
                categoryTree,
            },
        };
    }

    function resolveCatalogNodes() {
        const Cat = global.UgapGroupCatalog;
        if (Cat?.resolveCatalogNodes) {
            const nodes = Cat.resolveCatalogNodes({}) || [];
            if (nodes.length) return nodes;
        }
        const Core = global.UgapCatalogueNodesCore;
        let nodes = global.UgapCatalogueLcState?.getCatalog?.()?.nodes || [];
        if (nodes.length && Core?.normalizeCatalog) {
            return Core.normalizeCatalog({ nodes }).nodes || [];
        }
        return nodes;
    }

    function refreshVariantParcoursPreview(baseTpl, variant, mount, callbacks) {
        if (!mount) return;
        const previewTpl = buildVariantPreviewTemplate(baseTpl, variant);
        const bridge = Bridge();
        if (!bridge?.renderTemplateParcoursPreview) {
            mount.innerHTML = '<p class="ugap-param-placeholder">Aperçu parcours indisponible.</p>';
            return;
        }
        const templateId = String(baseTpl?.id || '').trim();
        const variantId = String(variant?.id || '').trim();
        const variantCallbacks = {
            onReorder: (parentId, fromId, toId, mode) => {
                St()?.reorderTemplateVariantCatalogSiblings?.(templateId, variantId, parentId, fromId, toId, mode);
                refreshVariantParcoursPreview(baseTpl, variant, mount, callbacks);
                callbacks?.onChanged?.();
            },
            onRefreshPreview: () => refreshVariantParcoursPreview(baseTpl, variant, mount, callbacks),
            onFivePercentLineToggle: () => { /* lecture seule pour variant */ },
        };
        if (bridge.refreshTemplateParcoursInPlace?.(previewTpl, mount, previewTpl.label, variantCallbacks)) {
            return;
        }
        bridge.renderTemplateParcoursPreview(previewTpl, mount, previewTpl.label, variantCallbacks);
    }

    function renderVariantEditorShellHtml(variantLabel) {
        const PP = global.UgapParcoursLabels?.parcoursPerso || {};
        return `
            <div class="ugap-tpl-variant-editor">
                <p class="ugap-tpl-variant-editor__hint">${esc(PP.reorderHint || 'Glissez pour adapter l’ordre d’affichage.')}</p>
                <div id="template-bateau-variant-parcours-mount" data-variant-label="${esc(variantLabel || '')}"></div>
            </div>`;
    }

    global.UgapTemplateBateauVariantEditor = {
        buildVariantPreviewTemplate,
        refreshVariantParcoursPreview,
        renderVariantEditorShellHtml,
    };
})(window);
