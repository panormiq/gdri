/**
 * Extraction des numéros de poste depuis un libellé Excel (aligné UgapImportAssignmentService).
 */
(function initUgapPosteFromLabel(global) {
    'use strict';

    function normalizeLabelForPosteParse(label) {
        return String(label || '')
            .replace(/\u00a0/g, ' ')
            .replace(/[\u2018\u2019\u201A\u2032]/g, "'")
            .replace(/\s+/g, ' ')
            .trim();
    }

    function getExplicitPosteSetFromLabel(label) {
        const raw = normalizeLabelForPosteParse(label);
        if (!raw.trim()) return null;
        const set = new Set();
        let found = false;
        const rangeRe = /\bpostes?\s+(\d+)\s*(?:à|a|-|–|—)\s*(\d+)\b/gi;
        let m;
        while ((m = rangeRe.exec(raw)) !== null) {
            found = true;
            let a = parseInt(m[1], 10);
            let b = parseInt(m[2], 10);
            if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
            if (b < a) [a, b] = [b, a];
            for (let i = a; i <= b; i += 1) set.add(i);
        }
        const scratch = raw.replace(/\bpostes?\s+\d+\s*(?:à|a|-|–|—)\s*\d+\b/gi, ' ');
        const singlePosteRe = /\bposte\s+n°?\s*(\d+)\b/gi;
        while ((m = singlePosteRe.exec(raw)) !== null) {
            found = true;
            set.add(parseInt(m[1], 10));
        }
        const listRe = /\bpostes?\s+([\d,\s]+(?:et\s+\d+)*)/gi;
        while ((m = listRe.exec(scratch)) !== null) {
            const chunk = m[1] || '';
            if (/\d\s*(?:à|a|-|–|—)\s*\d/.test(chunk)) continue;
            found = true;
            const nums = chunk.match(/\d+/g);
            if (nums) nums.forEach((x) => set.add(parseInt(x, 10)));
        }
        const suffixRe = /(?:-|–|—)\s*postes?\s+([\d,\setàa\-–—\s]+)$/i;
        const suffix = raw.match(suffixRe);
        if (suffix) {
            const tail = String(suffix[1] || '').trim();
            const rangeInTail = tail.match(/^(\d+)\s*(?:à|a|-|–|—)\s*(\d+)$/i);
            if (rangeInTail) {
                found = true;
                let a = parseInt(rangeInTail[1], 10);
                let b = parseInt(rangeInTail[2], 10);
                if (Number.isFinite(a) && Number.isFinite(b)) {
                    if (b < a) [a, b] = [b, a];
                    for (let i = a; i <= b; i += 1) set.add(i);
                }
            } else {
                const nums = tail.match(/\d+/g);
                if (nums && nums.length) {
                    found = true;
                    nums.forEach((x) => set.add(parseInt(x, 10)));
                }
            }
        }
        if (!found) return null;
        return set;
    }

    function getSortedExplicitPosteNumbersFromLabel(label) {
        const set = getExplicitPosteSetFromLabel(label);
        if (!set || !set.size) return [];
        return [...set].filter(Number.isFinite).sort((a, b) => a - b);
    }

    function modelIdsFromExplicitLabelPostes(label, models) {
        const list = Array.isArray(models) ? models : [];
        const explicit = getExplicitPosteSetFromLabel(label);
        if (!explicit || !explicit.size) return [];
        return list
            .filter((m) => {
                const pn = Number(m?.posteNumber);
                return Number.isFinite(pn) && explicit.has(pn);
            })
            .map((m) => String(m?.id || '').trim())
            .filter(Boolean);
    }

    global.UgapPosteFromLabel = {
        normalizeLabelForPosteParse,
        getExplicitPosteSetFromLabel,
        getSortedExplicitPosteNumbersFromLabel,
        modelIdsFromExplicitLabelPostes,
    };
    global.getExplicitPosteSetFromLabel = getExplicitPosteSetFromLabel;
    global.getSortedExplicitPosteNumbersFromLabel = getSortedExplicitPosteNumbersFromLabel;
})(window);
