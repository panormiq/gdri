/**
 * FICHIER : modules/ugap/frontend/parametrage/assets/js/catalogue/catalogue-option-link-heuristic.js
 * RÔLE : Propositions option ↔ nœud — même filtre textuel que l’onglet Options.
 *
 * ENTRÉES : option, nœud { keywords } ex. pont, cadene, "pont amovible"
 * SORTIES : liste filtrée (sans plafond)
 *
 * RÈGLES (alignées options-tab filteredRows) :
 * - sous-chaîne normalisée (accents ignorés) sur libellé, nœud catalogue, catégorie, type, postes
 * - mots-clés , ; | → au moins un segment doit matcher (OU)
 * - "phrase" entre guillemets → la phrase entière doit être trouvée (comme la barre de recherche Options)
 *
 * DÉPEND DE : ugap-option-text-match.js, ugap-option-line-kind.js
 * APPELÉ PAR : catalogue-option-link-modal.js
 */
(function initUgapCatalogueOptionLinkHeuristic(global) {
    'use strict';

    const Text = () => global.UgapOptionTextMatch;
    const MAX_SUGGESTIONS = null;

    function parseKeywordQuery(raw) {
        const required = [];
        const optional = [];
        const text = String(raw || '').trim();
        if (!text) return { required, optional };

        const re = /"([^"]*)"/g;
        let cursor = 0;
        let match;
        const unquotedChunks = [];

        while ((match = re.exec(text)) !== null) {
            unquotedChunks.push(text.slice(cursor, match.index));
            const inner = String(match[1] || '').trim();
            if (inner) required.push(inner);
            cursor = match.index + match[0].length;
        }
        unquotedChunks.push(text.slice(cursor));

        const TM = Text();
        unquotedChunks.join(' ').split(/[;,|]+/g).forEach((chunk) => {
            const segment = String(chunk || '').trim();
            if (!segment) return;
            optional.push(segment);
        });

        const dedupe = (arr) => [...new Set(arr)];
        return {
            required: dedupe(required),
            optional: dedupe(optional.filter((seg) => !required.includes(seg))),
        };
    }

    function isEligibleImportOption(opt) {
        if (!opt || typeof opt !== 'object') return false;
        const name = String(opt?.name || opt?.importOptionLabel || '').trim();
        if (opt?.isSparePart === true) return false;
        if (/^PR\s/i.test(name)) return false;
        const OLK = global.UgapOptionLineKind;
        const kind = OLK?.inferOptionLineKind ? OLK.inferOptionLineKind(opt) : 'option';
        // PR catalogue uniquement ; mino/majo (ex. moteurs hors-bord) doivent pouvoir être liés à un nœud.
        if (kind === 'pr') return false;
        return true;
    }

    /** Ligne compatible buildOptionsFilterHaystack (champs onglet Options). */
    function optionAsFilterRow(option) {
        const opt = option && typeof option === 'object' ? option : {};
        const details = String(opt.details || opt.importExcelLabel || '').trim();
        return {
            name: String(opt.name || opt.importOptionLabel || '').trim(),
            familyLabel: String(opt.familyLabel || '').trim(),
            details,
            importExcelLabel: details,
            importOptionLabel: String(opt.importOptionLabel || '').trim(),
            refUgap: String(opt.refUgap || opt.baseRefUgap || '').trim(),
            groups: Array.isArray(opt.groups) ? opt.groups : [],
            category: String(opt.category || opt.categoryName || '').trim(),
            categoryName: String(opt.categoryName || opt.category || '').trim(),
            optionTypeLabel: String(opt.optionTypeLabel || '').trim(),
            optionType: String(opt.optionType || '').trim(),
            assignedPostes: String(opt.assignedPostes || '').trim(),
        };
    }

    function getOptionSearchHaystack(option) {
        return Text()?.buildOptionsFilterHaystack?.(optionAsFilterRow(option)) || '';
    }

    function getDetailsSearchText(option) {
        return getOptionSearchHaystack(option);
    }

    function validateObjectKeywords(catalogObject) {
        const query = parseKeywordQuery(catalogObject?.keywords || '');
        if (!query.required.length && !query.optional.length) {
            return {
                ok: false,
                query,
                message: 'Mots-clés : utilisez "phrase obligatoire" entre guillemets et/ou des termes séparés par des virgules (ex. pont, cadene).',
            };
        }
        return { ok: true, query, message: '' };
    }

    function evaluateOptionMatch(option, query) {
        const TM = Text();
        if (!TM) return { ok: false, score: 0, reasons: [] };

        const row = optionAsFilterRow(option);
        const reasons = [];
        let score = 0;

        for (const phrase of query.required) {
            if (!TM.rowMatchesRequiredPhrase(row, phrase)) {
                return { ok: false, score: 0, reasons: [] };
            }
            reasons.push(`obligatoire « ${phrase} »`);
            score += 20;
        }

        if (query.optional.length) {
            const hay = TM.buildOptionsFilterHaystack(row);
            const hits = query.optional.filter((seg) => TM.haystackIncludesQuery(hay, seg));
            if (!hits.length) {
                return { ok: false, score: 0, reasons: [] };
            }
            hits.forEach((w) => {
                reasons.push(`« ${w} »`);
                score += 5;
            });
        }

        if (!query.required.length && !query.optional.length) {
            return { ok: false, score: 0, reasons: [] };
        }

        return { ok: true, score, reasons };
    }

    function scoreOptionForCatalogObject(option, catalogObject) {
        const check = validateObjectKeywords(catalogObject);
        if (!check.ok) return { score: 0, reasons: [] };

        const hit = evaluateOptionMatch(option, check.query);
        if (!hit.ok) return { score: 0, reasons: [] };

        return {
            score: hit.score,
            reasons: hit.reasons.map((r) => `${r} (filtre Options)`),
        };
    }

    function suggestOptionsForObject(catalogObject, allOptions, opts = {}) {
        const check = validateObjectKeywords(catalogObject);
        if (!check.ok) return [];

        const maxResults = Number.isFinite(opts.maxResults) ? opts.maxResults : null;
        const objectId = String(opts.objectId || catalogObject?.id || '').trim();

        const rows = (Array.isArray(allOptions) ? allOptions : [])
            .filter((o) => isEligibleImportOption(o))
            .filter((o) => {
                const linked = String(o?.catalogObjectId || '').trim();
                return linked !== objectId;
            })
            .map((option) => {
                const hit = scoreOptionForCatalogObject(option, catalogObject);
                const linkedElsewhere = String(option?.catalogObjectId || '').trim();
                return {
                    option,
                    score: hit.score,
                    reasons: hit.reasons,
                    linkedElsewhere: !!linkedElsewhere && linkedElsewhere !== objectId,
                };
            })
            .filter((row) => row.score > 0)
            .sort((a, b) => b.score - a.score || String(a.option.name || '').localeCompare(String(b.option.name || ''), 'fr'));

        const totalMatches = rows.length;
        const capped = maxResults != null ? rows.slice(0, maxResults) : rows.slice();
        capped.totalMatches = totalMatches;
        capped.truncated = maxResults != null && totalMatches > maxResults;
        capped.query = check.query;
        return capped;
    }

    function describeQueryRules(query) {
        const parts = [];
        if (query.required.length) {
            parts.push(`obligatoires : ${query.required.map((p) => `"${p}"`).join(', ')}`);
        }
        if (query.optional.length) {
            parts.push(`au moins un parmi : ${query.optional.join(', ')}`);
        }
        parts.push('même règle que la recherche Options (sous-chaîne, accents ignorés)');
        return parts.join(' · ');
    }

    global.UgapCatalogueOptionLinkHeuristic = {
        MAX_SUGGESTIONS,
        parseKeywordQuery,
        validateObjectKeywords,
        describeQueryRules,
        isEligibleImportOption,
        optionAsFilterRow,
        getOptionSearchHaystack,
        getDetailsSearchText,
        scoreOptionForCatalogObject,
        suggestOptionsForObject,
    };
})(window);
