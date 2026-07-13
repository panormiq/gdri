/**
 * FICHIER : modules/ugap/frontend/assets/js/shared/ugap-sortable-dnd.js
 * RÔLE : Glisser-déposer — réordonnancement et imbrication (listes admin UGAP).
 *
 * ENTRÉES : conteneur DOM, callbacks onReorder / onNest
 * SORTIES : listeners attachés (idempotent via data-ugap-dnd-bound)
 *
 * DÉPEND DE : aucun
 * NE PAS : persistance API, rendu métier des onglets
 *
 * APPELÉ PAR : categorie-tab.js, categorie-tab-subcategories.js, ugap-view-templates.js
 */
(function initUgapSortableDnd(global) {
    'use strict';

    const DROP_BEFORE = 'before';
    const DROP_AFTER = 'after';
    const DROP_NEST = 'nest';

    function escapeAttr(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/</g, '&lt;');
    }

    function clearDropIndicators(scope) {
        scope.querySelectorAll('[data-ugap-dnd-item]').forEach((el) => {
            el.classList.remove('ugap-dnd--drop-before', 'ugap-dnd--drop-after', 'ugap-dnd--drop-nest');
        });
    }

    function resolveDropMode(event, itemEl, allowNest) {
        const rect = itemEl.getBoundingClientRect();
        const y = event.clientY - rect.top;
        const h = rect.height || 1;
        if (!allowNest) {
            return y > h * 0.55 ? DROP_AFTER : DROP_BEFORE;
        }
        if (y < h * 0.22) return DROP_BEFORE;
        if (y > h * 0.72) return DROP_AFTER;
        return DROP_NEST;
    }

    function applyDropIndicator(scope, itemEl, mode) {
        clearDropIndicators(scope);
        if (mode === DROP_BEFORE) itemEl.classList.add('ugap-dnd--drop-before');
        else if (mode === DROP_AFTER) itemEl.classList.add('ugap-dnd--drop-after');
        else itemEl.classList.add('ugap-dnd--drop-nest');
    }

    function transferHasType(event, dataType) {
        const types = event?.dataTransfer?.types;
        if (!types || !dataType) return false;
        return Array.from(types).includes(dataType);
    }

    /** Cible DnD limitée au conteneur (évite les listes imbriquées). */
    function isEventInNestedSortable(scope, target) {
        if (!scope || !target || !scope.contains(target)) return false;
        let el = target;
        while (el && el !== scope) {
            if (
                el !== scope
                && el.dataset?.ugapDndBound === '1'
                && (el.hasAttribute('data-ugap-dnd-list') || el.hasAttribute('data-ugap-dnd-root'))
            ) {
                return true;
            }
            el = el.parentElement;
        }
        return false;
    }

    function closestDirectItemInScope(scope, target, itemSelector) {
        if (!scope || !target || !itemSelector) return null;
        let el = target;
        while (el && el !== scope) {
            if (el.matches?.(itemSelector) && el.parentElement === scope) {
                return el;
            }
            el = el.parentElement;
        }
        return null;
    }

    function closestItemInScope(scope, target, itemSelector, onlyDirectChildren) {
        if (!scope || !target || !itemSelector) return null;

        if (isEventInNestedSortable(scope, target)) {
            if (!onlyDirectChildren) return null;
            // Survol profond (ex. zone Enfants) → cibler le frère direct du scope qui contient la cible.
            let el = target;
            while (el && el !== scope) {
                if (el.matches?.(itemSelector) && el.parentElement === scope) {
                    return el;
                }
                el = el.parentElement;
            }
            return null;
        }

        let el = target;
        while (el && el !== scope) {
            if (el.matches?.(itemSelector)) {
                if (!onlyDirectChildren || el.parentElement === scope) return el;
            }
            el = el.parentElement;
        }
        return null;
    }

    /**
     * @param {HTMLElement} root
     * @param {object} options
     * @param {string} options.dataType - MIME custom pour dataTransfer
     * @param {string} [options.itemSelector] - défaut [data-ugap-dnd-item]
     * @param {string} [options.handleSelector] - si défini, drag uniquement depuis la poignée
     * @param {boolean} [options.allowNest] - drop au centre = imbriquer
     * @param {function(string):string} options.getItemId
     * @param {function(string,string,'before'|'after'|'nest'):void|Promise} options.onDrop
     */
    function bindSortableDnd(root, options) {
        const scope = root && root.querySelector ? root : null;
        if (!scope || scope.dataset.ugapDndBound === '1') return;
        scope.dataset.ugapDndBound = '1';
        if (!scope.hasAttribute('data-ugap-dnd-root')) scope.setAttribute('data-ugap-dnd-root', '1');

        const opts = options && typeof options === 'object' ? options : {};
        const dataType = String(opts.dataType || 'text/ugap-dnd-id').trim();
        const itemSelector = String(opts.itemSelector || '[data-ugap-dnd-item]').trim();
        const handleSelector = opts.handleSelector ? String(opts.handleSelector).trim() : '';
        const allowNest = !!opts.allowNest;
        const onlyDirectChildren = !!opts.onlyDirectChildren;
        const getItemId = typeof opts.getItemId === 'function' ? opts.getItemId : (el) => el.getAttribute('data-ugap-dnd-item');
        const onDrop = typeof opts.onDrop === 'function' ? opts.onDrop : null;
        if (!onDrop) return;

        let draggingId = '';

        scope.addEventListener('dragstart', (e) => {
            if (isEventInNestedSortable(scope, e.target)) return;
            const handle = handleSelector ? e.target?.closest?.(handleSelector) : null;
            if (handleSelector && !handle) return;
            const item = onlyDirectChildren
                ? closestDirectItemInScope(scope, e.target, itemSelector)
                : closestItemInScope(scope, e.target, itemSelector, onlyDirectChildren);
            if (!item || !e.dataTransfer) return;
            const id = String(getItemId(item) || '').trim();
            if (!id) return;
            draggingId = id;
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData(dataType, id);
            item.classList.add('ugap-dnd--dragging');
            e.stopPropagation();
        }, true);

        scope.addEventListener('dragend', () => {
            if (!draggingId) return;
            scope.querySelectorAll(`${itemSelector}.ugap-dnd--dragging`).forEach((el) => {
                el.classList.remove('ugap-dnd--dragging');
            });
            draggingId = '';
            clearDropIndicators(scope);
        }, true);

        scope.addEventListener('dragover', (e) => {
            if (!transferHasType(e, dataType)) return;
            const item = closestItemInScope(scope, e.target, itemSelector, onlyDirectChildren);
            if (!item) return;
            const targetId = String(getItemId(item) || '').trim();
            if (!targetId || targetId === draggingId) return;
            e.preventDefault();
            e.stopPropagation();
            if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
            const mode = resolveDropMode(e, item, allowNest);
            applyDropIndicator(scope, item, mode);
        }, true);

        scope.addEventListener('dragleave', (e) => {
            if (!transferHasType(e, dataType)) return;
            const item = closestItemInScope(scope, e.target, itemSelector, onlyDirectChildren);
            if (!item) return;
            const related = e.relatedTarget;
            if (related && item.contains(related)) return;
            item.classList.remove('ugap-dnd--drop-before', 'ugap-dnd--drop-after', 'ugap-dnd--drop-nest');
        }, true);

        scope.addEventListener('drop', async (e) => {
            if (!transferHasType(e, dataType)) return;
            const item = closestItemInScope(scope, e.target, itemSelector, onlyDirectChildren);
            if (!item) return;
            e.preventDefault();
            e.stopPropagation();
            const fromId = String(e.dataTransfer?.getData(dataType) || draggingId || '').trim();
            const toId = String(getItemId(item) || '').trim();
            const mode = resolveDropMode(e, item, allowNest);
            clearDropIndicators(scope);
            if (!fromId || !toId || fromId === toId) return;
            try {
                await onDrop(fromId, toId, mode);
            } catch (err) {
                global.showAlert?.('Erreur réorganisation : ' + (err?.message || err), 'error');
            }
        }, true);
    }

    global.UgapSortableDnd = {
        DROP_BEFORE,
        DROP_AFTER,
        DROP_NEST,
        bindSortableDnd,
        escapeAttr
    };
})(typeof window !== 'undefined' ? window : globalThis);
