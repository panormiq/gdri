/**
 * Type de ligne catalogue (aligné paramétrage / import : importOptionLineKind).
 */
(function initUgapOptionLineKind(global) {
    'use strict';

    function isMotorBaseNonSupplyLabel(name) {
        const n = String(name || '').replace(/\s+/g, ' ').trim();
        if (!n || !/\bnon\s+fourniture\b/i.test(n) || !/\bmoteurs?\b/i.test(n)) return false;
        return /\bmoteurs?\s+de\s+base\b/i.test(n)
            || /\bnon\s+fourniture\s+(?:du|des)\s+(?:\d+\s+)?moteurs?\s+de\s+base\b/i.test(n);
    }

    /**
     * @param {object|null|undefined} opt
     * @returns {'minoration'|'majoration'|'pr'|'option'}
     */
    function inferOptionLineKind(opt) {
        if (!opt || typeof opt !== 'object') return 'option';
        const manual = String(opt.importOptionLineKind || '').trim().toLowerCase();
        if (manual === 'minoration' || manual === 'majoration' || manual === 'pr' || manual === 'option') {
            if (manual === 'majoration' && isMotorBaseNonSupplyLabel(opt.name)) return 'minoration';
            return manual;
        }
        if (opt.manualMinorationAssignment === true || opt.isMinoration === true) return 'minoration';
        if (opt.manualMajorationAssignment === true) return 'majoration';
        if (opt.isSparePart === true) return 'pr';
        const ref = String(opt.refUgap || '').trim().toUpperCase();
        const name = String(opt.name || '').replace(/\s+/g, ' ').trim();
        if (ref.includes('MINO') || /^moins-value\b/i.test(name)) return 'minoration';
        if (isMotorBaseNonSupplyLabel(name)) return 'minoration';
        if (/^PR\s/i.test(name)) return 'pr';
        if (
            /^(plus-value|plus\s+value)\b/i.test(name) ||
            /\ben\s+lieu\s+et\s+place\b/i.test(name) ||
            /\bau\s+lieu\s+et\s+place\b/i.test(name) ||
            /\ben\s+remplacement\b/i.test(name) ||
            /\bnon\s+fourniture\b/i.test(name)
        ) {
            return 'majoration';
        }
        return 'option';
    }

    const DISPLAY = {
        minoration: { label: 'Minoration / MV / PV', badgeClass: 'minoration' },
        majoration: { label: 'Majoration', badgeClass: 'majoration' },
        pr: { label: 'PR', badgeClass: 'pr' },
        option: { label: 'Option', badgeClass: 'option' },
    };

    function getOptionLineKindDisplay(opt) {
        const kind = inferOptionLineKind(opt);
        const meta = DISPLAY[kind] || DISPLAY.option;
        return { kind, label: meta.label, badgeClass: meta.badgeClass };
    }

    global.UgapOptionLineKind = {
        isMotorBaseNonSupplyLabel,
        inferOptionLineKind,
        getOptionLineKindDisplay,
    };
})(typeof window !== 'undefined' ? window : globalThis);
