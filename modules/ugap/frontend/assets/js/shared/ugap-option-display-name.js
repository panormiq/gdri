/**
 * Nom affiché option — aligné import / paramétrage « Options de base »
 * (UgapDataService.resolveImportBaseProductDisplayName, import-workflow-steps).
 *
 * @param {object} opt — ligne catalogue
 * @param {{ models?: object[], modelId?: string }} [ctx] — modèle courant (poste) pour motorisation
 */
(function initUgapOptionDisplayName(global) {
    'use strict';

    function isMotorBaseNonSupplyLabel(name) {
        const OLK = global.UgapOptionLineKind;
        if (OLK?.isMotorBaseNonSupplyLabel) return OLK.isMotorBaseNonSupplyLabel(name);
        const n = String(name || '').replace(/\s+/g, ' ').trim();
        if (!n || !/\bnon\s+fourniture\b/i.test(n) || !/\bmoteurs?\b/i.test(n)) return false;
        return /\bmoteurs?\s+de\s+base\b/i.test(n)
            || /\bnon\s+fourniture\s+(?:du|des)\s+(?:\d+\s+)?moteurs?\s+de\s+base\b/i.test(n);
    }

    function isGenericBasePlaceholderLabel(label) {
        const n = String(label || '').replace(/\s+/g, ' ').trim().toLowerCase();
        if (!n || n === 'de base' || n === 'produit de base') return true;
        if (n === 'moteur choisi' || n === 'moteur de base') return true;
        if (/^(\d+\s+)?moteurs?\s+de\s+base$/.test(n)) return true;
        if (/^ceux?\s+de\s+base$/.test(n)) return true;
        const norm = n.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        if (norm === 'celui de base' || norm === 'celle de base' || norm === 'ceux de base') return true;
        return false;
    }

    function stripPostesSuffix(text) {
        return String(text || '')
            .replace(/\s*-\s*postes?\s+[\d\s,etàa\-–—]+$/i, '')
            .replace(/\s+postes?\s+[\d\s,etàa\-–—]+$/i, '')
            .trim();
    }

    function stripMvPvPrefix(text) {
        return String(text || '')
            .replace(/^(moins-value|plus-value|plus\s+value)\s+/i, '')
            .trim();
    }

    function inferReplacedBaseFromNewObject(beforeNoPrefix, replacedSegment) {
        let initial = String(replacedSegment || '').trim();
        if (!/^cel(le|ui|les)?\s+de\s+base$/i.test(initial) && !/^ceux\s+de\s+base$/i.test(initial)) {
            return initial;
        }
        const before = String(beforeNoPrefix || '').trim();
        const head = before.match(/\b(flotteur|moteur|combin[ée]|sondeur|sonde|module|coque|console)\b/i);
        if (!head) return 'produit de base';
        let term = head[1].toLowerCase();
        if (term === 'sonde') term = 'sondeur';
        return `${term} de base`;
    }

    function parseReplacementFromLabel(label) {
        const raw = String(label || '').replace(/\s+/g, ' ').trim();
        if (!raw) return { newObject: '', replacedObject: '' };

        const cleaned = stripPostesSuffix(raw);
        const keywords = [
            /\ben\s+remplacement\s+de\b/i,
            /\ben\s+remplacement\b/i,
            /\ben\s+lieu\s+et\s+place\s+de\b/i,
            /\bau\s+lieu\s+et\s+place\s+de\b/i,
            /\ben\s+lieu\s+et\s+place\b/i,
            /\bau\s+lieu\s+et\s+place\b/i,
        ];

        for (const re of keywords) {
            const match = cleaned.match(re);
            if (!match || match.index == null) continue;
            const before = cleaned.slice(0, match.index).trim();
            const afterRaw = stripPostesSuffix(
                cleaned.slice(match.index + match[0].length)
                    .replace(/^(?:de\s+)?(?:l['']|la\s+|le\s+|les\s+)/i, '')
                    .replace(/\s+fourni\s+de\s+base\s*$/i, '')
                    .trim()
            );
            const newObject = stripMvPvPrefix(before);
            return {
                newObject,
                replacedObject: inferReplacedBaseFromNewObject(newObject, afterRaw),
            };
        }

        if (/\bnon\s+fourniture\s+du\s+moteur\s+de\s+base\b/i.test(cleaned)) {
            return { newObject: 'moteur choisi', replacedObject: 'moteur de base' };
        }

        const nonSupply = cleaned.match(/^non\s+fourniture\s+(?:du|de\s+la|des|de\s+l[''])\s+(.+)$/i);
        if (nonSupply) {
            return { replacedObject: stripPostesSuffix(String(nonSupply[1] || '').trim()), newObject: '' };
        }

        return { newObject: '', replacedObject: '' };
    }

    function parseBaseReplacementProducts(label) {
        const raw = String(label || '').replace(/\s+/g, ' ').trim();
        if (!raw) return { initialProduct: '', finalProduct: '' };

        const cleaned = stripPostesSuffix(raw);

        if (/\bnon\s+fourniture\s+du\s+moteur\s+de\s+base\b/i.test(cleaned)) {
            return { initialProduct: 'moteur de base', finalProduct: 'moteur choisi' };
        }

        const nonSupplyMatch = cleaned.match(/^non\s+fourniture\s+(?:du|de\s+la|des|de\s+l[''])\s+(.+)$/i);
        if (nonSupplyMatch) {
            return {
                initialProduct: stripPostesSuffix(String(nonSupplyMatch[1] || '').trim()),
                finalProduct: '',
            };
        }

        const replacementMatch =
            cleaned.match(/^(.*?)\s+en\s+remplacement\s+de\s+(?:l['']|la\s+|le\s+|les\s+)?(.+?)\s+fourni\s+de\s+base\b/i)
            || cleaned.match(/^(.*?)\s+en\s+remplacement\s+de\s+(?:l['']|la\s+|le\s+|les\s+)?(.+)$/i)
            || cleaned.match(/^(.*?)\s+en\s+remplacement\s+(?:de\s+)?(?:l['']|la\s+|le\s+|les\s+)?(.+)$/i);
        if (replacementMatch) {
            const before = String(replacementMatch[1] || '').trim();
            const replacedBase = stripPostesSuffix(String(replacementMatch[2] || '').trim());
            const beforeNoPrefix = before.replace(/^(moins-value|plus-value|plus\s+value)\s+/i, '').trim();
            let finalProduct = beforeNoPrefix
                .replace(/^(module\s+sondeur|combin[ée]|motorisation|moteur|pack|option)\s+/i, '')
                .trim();
            if (!finalProduct) finalProduct = beforeNoPrefix;
            return {
                initialProduct: inferReplacedBaseFromNewObject(beforeNoPrefix, replacedBase),
                finalProduct,
            };
        }

        const inPlaceMatch = cleaned.match(/^(.*?)\s+(?:au|en)\s+lieu\s+et\s+place\s+de\s+(?:l['']|la\s+|le\s+|les\s+)?(.+)$/i);
        if (inPlaceMatch) {
            const before = String(inPlaceMatch[1] || '').trim();
            const replaced = String(inPlaceMatch[2] || '').trim();
            return {
                initialProduct: inferReplacedBaseFromNewObject(before, replaced),
                finalProduct: before,
            };
        }

        return { initialProduct: '', finalProduct: '' };
    }

    function getParsedBaseReplacementLinks(opt) {
        const backendInitial = String(opt?.initialProduct || '').trim();
        const backendFinal = String(opt?.finalProduct || '').trim();
        if (backendInitial || backendFinal) {
            return { initialProduct: backendInitial, finalProduct: backendFinal };
        }
        return parseBaseReplacementProducts(opt?.name);
    }

    function getMotorLabelForModel(model) {
        return String(model?.motorizationBase || model?.motorization || '').trim();
    }

    function resolveTargetModels(opt, models, modelId) {
        const list = Array.isArray(models) ? models : [];
        const mid = String(modelId || '').trim();
        const cm = (Array.isArray(opt?.compatibleModels) ? opt.compatibleModels : [])
            .map((x) => String(x || '').trim())
            .filter(Boolean);
        const sortByPoste = (arr) => arr.slice().sort((a, b) => {
            const na = Number(a?.posteNumber);
            const nb = Number(b?.posteNumber);
            if (Number.isFinite(na) && Number.isFinite(nb) && na !== nb) return na - nb;
            return 0;
        });
        if (mid && cm.includes(mid)) {
            const hit = list.find((m) => String(m?.id || '').trim() === mid);
            return hit ? [hit] : [];
        }
        if (!cm.length) return [];
        return sortByPoste(list.filter((m) => cm.includes(String(m?.id || '').trim())));
    }

    /**
     * Nom affiché pour une option (toutes lignes compatibles poste, pas seulement IBP).
     */
    function resolveOptionDisplayName(opt, ctx) {
        if (!opt || typeof opt !== 'object') return '';
        const models = Array.isArray(ctx?.models) ? ctx.models : [];
        const modelId = String(ctx?.modelId || '').trim();

        const custom = String(opt.importOptionLabel || '').trim();
        if (custom && !isGenericBasePlaceholderLabel(custom)) return custom;

        if (isMotorBaseNonSupplyLabel(opt?.name)) {
            for (const model of resolveTargetModels(opt, models, modelId)) {
                const lab = getMotorLabelForModel(model);
                if (lab && !isGenericBasePlaceholderLabel(lab)) return lab;
            }
        }

        const parsed = getParsedBaseReplacementLinks(opt);
        const initialP = String(parsed?.initialProduct || '').trim();
        const finalP = String(parsed?.finalProduct || '').trim();
        if (initialP && !isGenericBasePlaceholderLabel(initialP)) return initialP;
        if (finalP && !isGenericBasePlaceholderLabel(finalP)) return finalP;

        const rep = parseReplacementFromLabel(opt?.name);
        const repO = String(rep?.replacedObject || '').trim();
        const newO = String(rep?.newObject || '').trim();
        if (repO && !isGenericBasePlaceholderLabel(repO)) return repO;
        if (newO && !isGenericBasePlaceholderLabel(newO)) return newO;

        const name = String(opt?.name || '')
            .replace(/^\d{5,}\s*/, '')
            .replace(/\s+/g, ' ')
            .trim();
        if (name && !isGenericBasePlaceholderLabel(name)) return name;

        return String(opt?.name || '').trim() || 'de base';
    }

    /** Libellé Excel / complément (si différent du nom affiché). */
    function resolveOptionDisplayDetails(opt, displayName) {
        const excel = String(opt?.importExcelLabel || opt?.details || '').trim();
        const shown = String(displayName || '').trim();
        if (excel && excel !== shown) return excel;
        const raw = String(opt?.name || '').trim();
        if (raw && raw !== shown && !/\b(en\s+remplacement|lieu\s+et\s+place)\b/i.test(shown)) return raw;
        return String(opt?.details || '').trim();
    }

    global.UgapOptionDisplayName = {
        resolveOptionDisplayName,
        resolveOptionDisplayDetails,
        isGenericBasePlaceholderLabel,
        parseReplacementFromLabel,
        parseBaseReplacementProducts,
    };
})(window);
