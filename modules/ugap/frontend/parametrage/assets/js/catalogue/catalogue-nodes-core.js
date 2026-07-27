/**
 * FICHIER : modules/ugap/frontend/parametrage/assets/js/catalogue/catalogue-nodes-core.js
 * RÔLE : Nœuds catalogue unifiés (arbre + migration legacy cat/objets).
 *
 * SORTIES : normalizeNode, migrateLegacyCatalog, helpers arbre
 * APPELÉ PAR : catalogue-lc-state.js, UgapDataService (miroir backend)
 */
(function initUgapCatalogueNodesCore(global) {
    'use strict';

    const Types = () => global.UgapCatalogueTypes;

    function newId(prefix) {
        return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    }

    function resolveNodeId(raw) {
        const n = raw && typeof raw === 'object' ? raw : {};
        const idRaw = n.id ?? n._id ?? n.nodeId ?? '';
        if (idRaw && typeof idRaw === 'object') {
            if (idRaw.$oid) return String(idRaw.$oid).trim();
            if (typeof idRaw.toString === 'function') return String(idRaw.toString()).trim();
        }
        return String(idRaw || '').trim();
    }

    function resolveParentId(raw) {
        const n = raw && typeof raw === 'object' ? raw : {};
        const pid = String(n.parentId ?? n.parent ?? '').trim();
        if (!pid || pid === 'null' || pid === 'undefined') return '';
        return pid;
    }

    function isMotorCatalogNodeLabel(node) {
        const blob = `${String(node?.label || '').toLowerCase()} ${String(node?.keywords || '').toLowerCase()}`;
        if (/\b(hélice|helice|propulseur)\b/.test(blob) && !/\bmoteur/.test(blob)) return false;
        return /\b(moteur|motorisation)\b/.test(blob);
    }

    /** true = masquer les lignes minoration dans le picker configurateur pour ce nœud. */
    function resolveHideMinorationInChoices(node) {
        if (!node || typeof node !== 'object') return false;
        if (node.hideMinorationInChoices === true) return true;
        if (node.hideMinorationInChoices === false) return false;
        return isMotorCatalogNodeLabel(node);
    }

    /**
     * true = forcer l’affichage du nœud dans le configurateur même s’il est vide
     * ou ne contient que l’option de base.
     */
    function resolveShowEvenIfEmptyOrBaseOnly(node) {
        return !!(node && typeof node === 'object' && node.showEvenIfEmptyOrBaseOnly === true);
    }

    function normalizeNode(raw, index) {
        const n = raw && typeof raw === 'object' ? raw : {};
        const id = resolveNodeId(n) || newId('node');
        const row = {
            id,
            parentId: resolveParentId(n),
            label: String(n.label || n.name || 'Nœud').trim(),
            decisionMode: String(n.decisionMode || '').trim() === 'multi_choice' ? 'multi_choice' : 'single_choice',
            keywords: String(n.keywords || '').trim(),
            tags: (Array.isArray(n.tags) ? n.tags : []).map((x) => String(x || '').trim()).filter(Boolean),
            sortOrder: Number.isFinite(Number(n.sortOrder)) ? Number(n.sortOrder) : (Number(index) || 0) * 10,
        };
        if (Object.prototype.hasOwnProperty.call(n, 'hideMinorationInChoices')) {
            row.hideMinorationInChoices = n.hideMinorationInChoices === true;
        }
        if (Object.prototype.hasOwnProperty.call(n, 'showEvenIfEmptyOrBaseOnly')) {
            row.showEvenIfEmptyOrBaseOnly = n.showEvenIfEmptyOrBaseOnly === true;
        }
        return row;
    }

    function normalizeTagRow(raw) {
        const t = raw && typeof raw === 'object' ? raw : {};
        const id = Types()?.normalizeTagId?.(t.id || t.value) || String(t.id || '').trim();
        const label = String(t.label || t.title || id).trim();
        if (!id) return null;
        return { id, label: label || id };
    }

    /** Ancien modèle categories + objects → nodes[]. */
    function migrateLegacyCatalog(raw) {
        const src = raw && typeof raw === 'object' ? raw : {};
        if (Array.isArray(src.nodes) && src.nodes.length) {
            return src.nodes.map((n, i) => normalizeNode(n, i));
        }

        const nodes = [];
        let order = 0;
        const nextOrder = () => {
            order += 10;
            return order;
        };

        (Array.isArray(src.categories) ? src.categories : []).forEach((cat) => {
            const c = cat && typeof cat === 'object' ? cat : {};
            const catId = String(c.id || newId('cat')).trim();
            nodes.push({
                id: catId,
                parentId: '',
                label: String(c.name || 'Catégorie').trim(),
                decisionMode: 'single_choice',
                keywords: '',
                tags: [],
                sortOrder: nextOrder(),
            });
            (Array.isArray(c.subCategories) ? c.subCategories : []).forEach((sc) => {
                const s = sc && typeof sc === 'object' ? sc : {};
                const subId = String(s.id || newId('sub')).trim();
                nodes.push({
                    id: subId,
                    parentId: catId,
                    label: String(s.name || 'Sous-catégorie').trim(),
                    decisionMode: 'single_choice',
                    keywords: '',
                    tags: [],
                    sortOrder: nextOrder(),
                });
            });
        });

        (Array.isArray(src.objects) ? src.objects : []).forEach((o) => {
            const obj = o && typeof o === 'object' ? o : {};
            const objId = String(obj.id || newId('node')).trim();
            const parentId = String(obj.subCategoryId || obj.categoryId || '').trim();
            nodes.push({
                id: objId,
                parentId,
                label: String(obj.label || 'Choix').trim(),
                decisionMode: String(obj.decisionMode || '').trim() === 'multi_choice' ? 'multi_choice' : 'single_choice',
                keywords: String(obj.keywords || '').trim(),
                tags: Array.isArray(obj.tags) ? obj.tags.slice() : [],
                sortOrder: nextOrder(),
            });
        });

        const byId = new Map();
        nodes.forEach((n) => {
            if (!byId.has(n.id)) byId.set(n.id, n);
        });
        return Array.from(byId.values()).sort((a, b) => a.label.localeCompare(b.label, 'fr') || a.sortOrder - b.sortOrder);
    }

    function normalizeCatalog(raw) {
        const src = raw && typeof raw === 'object' ? raw : {};
        const nodes = migrateLegacyCatalog(src);
        const tagRegistry = (Array.isArray(src.tagRegistry) ? src.tagRegistry : []).length
            ? src.tagRegistry.map(normalizeTagRow).filter(Boolean)
            : (Types()?.DEFAULT_TAG_REGISTRY?.slice() || []);
        return { nodes, tagRegistry };
    }

    function emptyCatalog() {
        return {
            nodes: [],
            tagRegistry: Types()?.DEFAULT_TAG_REGISTRY?.slice() || [],
        };
    }

    function catalogCounts(c) {
        const x = c && typeof c === 'object' ? c : {};
        return { nodes: Array.isArray(x.nodes) ? x.nodes.length : 0 };
    }

    function sortNodes(list) {
        return (Array.isArray(list) ? list : []).slice()
            .sort((a, b) => a.label.localeCompare(b.label, 'fr') || a.sortOrder - b.sortOrder);
    }

    function nodeRow(n, index) {
        const raw = n && typeof n === 'object' ? n : {};
        const id = resolveNodeId(raw) || String(raw.id || '').trim();
        if (!id) return null;
        return {
            id,
            parentId: resolveParentId(raw),
            label: String(raw.label || raw.name || 'Nœud').trim(),
            sortOrder: Number.isFinite(Number(raw.sortOrder)) ? Number(raw.sortOrder) : (Number(index) || 0) * 10,
        };
    }

    function asNodeRows(nodes) {
        return (Array.isArray(nodes) ? nodes : [])
            .map((n, i) => nodeRow(n, i))
            .filter(Boolean);
    }

    /** Racines : parentId vide ou parent absent du lot. Retourne des nœuds normalisés (keywords, tags, …). */
    function getRootNodes(nodes) {
        const list = (Array.isArray(nodes) ? nodes : []).map((n, i) => normalizeNode(n, i));
        if (!list.length) return [];
        const byId = new Set(list.map((n) => n.id));
        return sortNodes(list.filter((n) => !n.parentId || !byId.has(n.parentId)));
    }

    function getChildren(nodes, parentId) {
        const pid = String(parentId || '').trim();
        if (!pid) return getRootNodes(nodes);
        const list = (Array.isArray(nodes) ? nodes : []).map((n, i) => normalizeNode(n, i));
        return sortNodes(list.filter((n) => n.parentId === pid));
    }

    function getNodeById(nodes, id) {
        const nid = String(id || '').trim();
        if (!nid) return null;
        const list = Array.isArray(nodes) ? nodes : [];
        const idx = list.findIndex((n) => {
            const row = n && typeof n === 'object' ? n : {};
            return String(row.id || resolveNodeId(row)) === nid;
        });
        if (idx < 0) return null;
        return normalizeNode(list[idx], idx);
    }

    function collectDescendantIds(nodes, rootId) {
        const out = new Set();
        const walk = (pid) => {
            getChildren(nodes, pid).forEach((c) => {
                out.add(c.id);
                walk(c.id);
            });
        };
        walk(rootId);
        return out;
    }

    /** Chemin affiché : Pont › Accessoire › Trappes */
    function nodeBreadcrumb(nodes, nodeId) {
        const parts = [];
        let cur = getNodeById(nodes, nodeId);
        let guard = 0;
        while (cur && guard < 32) {
            parts.unshift(cur.label || cur.id);
            cur = cur.parentId ? getNodeById(nodes, cur.parentId) : null;
            guard += 1;
        }
        return parts.join(' › ');
    }

    function nodeRoleLabel(optCount, childCount) {
        if (optCount > 0) return { type: 'choice', text: `Choix · ${optCount} opt.` };
        if (childCount > 0) return { type: 'folder', text: `Dossier · ${childCount}` };
        return { type: 'empty', text: 'Vide' };
    }

    /** Vérifie qu’un changement de parent ne crée pas de cycle. */
    function canSetNodeParent(nodes, nodeId, newParentId) {
        const id = String(nodeId || '').trim();
        const pid = String(newParentId || '').trim();
        if (!id) return { ok: false, message: 'Nœud invalide.' };
        if (!pid) return { ok: true };
        if (pid === id) {
            return { ok: false, message: 'Un nœud ne peut pas être son propre parent.' };
        }
        if (!getNodeById(nodes, pid)) {
            return { ok: false, message: 'Parent introuvable.' };
        }
        const descendants = collectDescendantIds(nodes, id);
        if (descendants.has(pid)) {
            return { ok: false, message: 'Le parent ne peut pas être un descendant de ce nœud.' };
        }
        return { ok: true };
    }

    global.UgapCatalogueNodesCore = {
        newId,
        resolveNodeId,
        resolveParentId,
        asNodeRows,
        normalizeNode,
        normalizeCatalog,
        emptyCatalog,
        catalogCounts,
        getChildren,
        getRootNodes,
        getNodeById,
        collectDescendantIds,
        nodeBreadcrumb,
        nodeRoleLabel,
        canSetNodeParent,
        migrateLegacyCatalog,
        isMotorCatalogNodeLabel,
        resolveHideMinorationInChoices,
        resolveShowEvenIfEmptyOrBaseOnly,
    };
})(window);
