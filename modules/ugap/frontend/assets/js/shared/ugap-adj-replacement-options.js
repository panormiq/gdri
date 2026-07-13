/**
 * Liaisons manuelles mino/majo ↔ option catalogue de remplacement (indissociables au choix).
 *
 * RÔLE : Runtime configurateur — pas de création auto d'options.
 * ENTRÉES : options catalogue avec linkedMinorationOptionId / linkedMajorationOptionId
 * SORTIES : apply/clear mino/majo au pick ; libellés devis
 * DÉPEND DE : ugap-option-line-kind.js
 * APPELÉ PAR : configurateur-template-tree.js, configurateur-app.js, ugap-model-base-options.js
 */
(function initUgapAdjReplacementOptions(global) {
    'use strict';

    function inferAdjLineKind(opt) {
        const OLK = global.UgapOptionLineKind;
        if (OLK?.inferOptionLineKind) return OLK.inferOptionLineKind(opt);
        if (opt?.isMinoration === true) return 'minoration';
        if (opt?.manualMajorationAssignment === true) return 'majoration';
        return 'option';
    }

    /** Option catalogue liée manuellement à une mino/majo (pas une ligne mino/majo elle-même). */
    function isAdjReplacementOption(opt) {
        if (!opt || typeof opt !== 'object') return false;
        const kind = inferAdjLineKind(opt);
        if (kind === 'minoration' || kind === 'majoration') return false;
        if (opt.importGeneratedFromBaseProduct === true) return false;
        return !!getLinkedAdjIdFromReplacement(opt);
    }

    function getLinkedAdjIdFromReplacement(opt) {
        if (!opt) return '';
        return String(
            opt.linkedAdjOptionId
            || opt.linkedMinorationOptionId
            || opt.linkedMajorationOptionId
            || opt.importReplacementFromAdjOptionId
            || ''
        ).trim();
    }

    function getLinkedReplacementIdFromAdj(opt) {
        return String(opt?.linkedReplacementCatalogOptionId || '').trim();
    }

    /** Masquer la ligne mino/majo du picker si une option de remplacement est liée manuellement. */
    function shouldHideAdjFromChoicePicker() {
        return false;
    }

    function applyLinkedAdjForReplacementPick(state, replacementOptionId, findOptionFn) {
        const repId = String(replacementOptionId || '').trim();
        if (!repId || !state?.selectedOptions) return [];
        const resolve = typeof findOptionFn === 'function' ? findOptionFn : () => null;
        const rep = resolve(repId);
        if (!rep || !isAdjReplacementOption(rep)) return [];
        const adjId = getLinkedAdjIdFromReplacement(rep);
        if (!adjId) return [];
        const adj = resolve(adjId);
        if (!adj) return [];
        state.selectedOptions.add(adjId);
        return [adjId];
    }

    function clearLinkedAdjForReplacementPick(state, findOptionFn) {
        if (!state?.selectedOptions) return;
        const resolve = typeof findOptionFn === 'function' ? findOptionFn : () => null;
        const toRemove = [];
        state.selectedOptions.forEach((id) => {
            const opt = resolve(String(id || '').trim());
            if (!opt) return;
            const kind = inferAdjLineKind(opt);
            if ((kind === 'minoration' || kind === 'majoration') && getLinkedReplacementIdFromAdj(opt)) {
                toRemove.push(String(opt.id || '').trim());
            }
        });
        toRemove.forEach((id) => state.selectedOptions.delete(id));
    }

    function stripMinoPrefix(value) {
        return String(value || '')
            .replace(/^MINO[\s\-_.]*/i, '')
            .replace(/^(moins-value|moins\s+value)[\s\-_.]*/i, '')
            .trim();
    }

    /** Libellé devis : Excel (ou modifié), sinon nom de l'option — sans préfixe MINO. */
    function resolveDevisLineLabel(opt) {
        if (!opt) return '—';
        const raw = String(opt.importExcelLabel || opt.details || opt.name || '').trim();
        return stripMinoPrefix(raw) || raw || '—';
    }

    global.UgapAdjReplacementOptions = {
        isAdjReplacementOption,
        shouldHideAdjFromChoicePicker,
        getLinkedAdjIdFromReplacement,
        getLinkedReplacementIdFromAdj,
        applyLinkedAdjForReplacementPick,
        clearLinkedAdjForReplacementPick,
        stripMinoPrefix,
        resolveDevisLineLabel,
    };
})(typeof window !== 'undefined' ? window : globalThis);
