/**
 * FICHIER : modules/ugap/frontend/assets/js/shared/ugap-option-text-match.js
 * RÔLE : Filtre textuel Options (normalisation + sous-chaîne) — réutilisé par le catalogue.
 *
 * SORTIES : UgapOptionTextMatch
 * APPELÉ PAR : options-tab.js, catalogue-option-link-heuristic.js
 */
(function initUgapOptionTextMatch(global) {
    'use strict';

    function normalizeText(value) {
        return String(value || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[-_/]+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .toLowerCase();
    }

    /** Segments séparés par , ; | (liste de mots-clés catalogue). */
    function tokenizeKeywordList(raw) {
        return String(raw || '')
            .split(/[;,|]+/)
            .map((x) => x.trim())
            .filter(Boolean);
    }

    /**
     * Même haystack que filteredRows() dans options-tab.js.
     * @param {object} source row Options ou option catalogue enrichie
     */
    function buildOptionsFilterHaystack(source) {
        const src = source && typeof source === 'object' ? source : {};
        const groups = Array.isArray(src.groups) ? src.groups.join(' ') : String(src.groups || '');
        return normalizeText([
            src.name,
            src.familyLabel,
            src.catalogNodeLabel,
            src.details,
            src.importExcelLabel,
            src.importOptionLabel,
            src.refUgap,
            groups,
            src.category || src.categoryName,
            src.optionTypeLabel,
            src.optionType,
            src.assignedPostes,
        ].join(' '));
    }

    function haystackIncludesQuery(haystackNorm, queryRaw) {
        const q = normalizeText(queryRaw);
        if (!q) return false;
        return haystackNorm.includes(q);
    }

    /** Filtre champ recherche onglet Options (chaîne saisie entière). */
    function rowMatchesOptionsFilter(source, filterQuery) {
        const q = normalizeText(filterQuery || '');
        if (!q) return true;
        return buildOptionsFilterHaystack(source).includes(q);
    }

    /** Au moins un segment ,;| matche (comme plusieurs recherches Options en OU). */
    function rowMatchesAnyKeyword(source, keywordsRaw) {
        const hay = buildOptionsFilterHaystack(source);
        const tokens = tokenizeKeywordList(keywordsRaw);
        if (!tokens.length) return { ok: false, hits: [] };
        const hits = tokens.filter((token) => haystackIncludesQuery(hay, token));
        return { ok: hits.length > 0, hits };
    }

    /** Phrase entre guillemets = même règle qu’une recherche Options sur la phrase entière. */
    function rowMatchesRequiredPhrase(source, phrase) {
        const p = String(phrase || '').trim();
        if (!p) return false;
        return haystackIncludesQuery(buildOptionsFilterHaystack(source), p);
    }

    global.UgapOptionTextMatch = {
        normalizeText,
        tokenizeKeywordList,
        buildOptionsFilterHaystack,
        haystackIncludesQuery,
        rowMatchesOptionsFilter,
        rowMatchesAnyKeyword,
        rowMatchesRequiredPhrase,
    };
})(window);
