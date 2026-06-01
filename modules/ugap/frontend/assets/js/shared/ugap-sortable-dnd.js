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
        if (!allowNest) return DROP_BEFORE;
        const rect = itemEl.getBoundingClientRect();
        const y = event.clientY - rect.top;
        const h = rect.height || 1;
        if (y < h * 0.22) return DROP_BEFORE;
        if (y > h * 0.72) return DROP_AFTER;
        return DROP_NEST;
    }

    function applyDropIndicator(itemEl, mode) {
        clearDropIndicators(itemEl.closest('[data-ugap-dnd-root]') || itemEl.parentElement || document);
        if (mode === DROP_BEFORE) itemEl.classList.add('ugap-dnd--drop-before');
        else if (mode === DROP_AFTER) itemEl.classList.add('ugap-dnd--drop-after');
        else itemEl.classList.add('ugap-dnd--drop-nest');
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
        const getItemId = typeof opts.getItemId === 'function' ? opts.getItemId : (el) => el.getAttribute('data-ugap-dnd-item');
        const onDrop = typeof opts.onDrop === 'function' ? opts.onDrop : null;
        if (!onDrop) return;

        let draggingId = '';

        scope.addEventListener('dragstart', (e) => {
            const handle = handleSelector ? e.target?.closest?.(handleSelector) : null;
            const item = handle
                ? e.target?.closest?.(itemSelector)
                : e.target?.closest?.(itemSelector);
            if (!item || !e.dataTransfer) return;
            if (handleSelector && !handle) return;
            const id = String(getItemId(item) || '').trim();
            if (!id) return;
            draggingId = id;
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData(dataType, id);
            item.classList.add('ugap-dnd--dragging');
        }, true);

        scope.addEventListener('dragend', (e) => {
            const item = e.target?.closest?.(itemSelector);
            if (item) item.classList.remove('ugap-dnd--dragging');
            draggingId = '';
            clearDropIndicators(scope);
        }, true);

        scope.addEventListener('dragover', (e) => {
            const item = e.target?.closest?.(itemSelector);
            if (!item) return;
            const targetId = String(getItemId(item) || '').trim();
            if (!targetId || targetId === draggingId) return;
            e.preventDefault();
            if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
            const mode = resolveDropMode(e, item, allowNest);
            applyDropIndicator(item, mode);
        }, true);

        scope.addEventListener('dragleave', (e) => {
            const item = e.target?.closest?.(itemSelector);
            if (!item) return;
            const related = e.relatedTarget;
            if (related && item.contains(related)) return;
            item.classList.remove('ugap-dnd--drop-before', 'ugap-dnd--drop-after', 'ugap-dnd--drop-nest');
        }, true);

        scope.addEventListener('drop', async (e) => {
            const item = e.target?.closest?.(itemSelector);
            if (!item) return;
            e.preventDefault();
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
