/**
 * FICHIER : modules/ugap/frontend/assets/js/shared/ugap-group-display.js
 * RÔLE : Libellés groupes de décision (famille + groupe + type + compteurs).
 *
 * ENTRÉES : ref { familyLabel, groupId, sourceIndex?, categoryName?, groupLabel? }
 * SORTIES : métadonnées + fragments HTML compacts
 *
 * DÉPEND DE : ugap-family-decision-group.js, normalizeFamilyDecisionGroups
 * APPELÉ PAR : template-bateau-tab.js, modeles-tab.js
 */
(function initUgapGroupDisplay(global) {
    'use strict';

    function esc(value) {
        if (typeof global.escapeHtml === 'function') return global.escapeHtml(value);
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function normalizeGroups(raw) {
        if (typeof global.normalizeFamilyDecisionGroups === 'function') {
            return global.normalizeFamilyDecisionGroups(raw);
        }
        return Array.isArray(raw) ? raw : [];
    }

    function getCatalogueFamilies() {
        if (typeof global.getFamiliesForAssignationTab === 'function') {
            return global.getFamiliesForAssignationTab();
        }
        if (global.UgapFamilleLcState?.getFamilies) {
            return global.UgapFamilleLcState.getFamilies().map((f, idx) => ({ ...f, __idx: idx }));
        }
        return [];
    }

    function findCatalogueFamily(familyLabel, sourceIndex) {
        const catalogue = getCatalogueFamilies();
        const idx = Number(sourceIndex);
        if (Number.isInteger(idx)) {
            const hit = catalogue.find((f) => Number(f.__idx) === idx);
            if (hit) return hit;
        }
        const key = String(familyLabel || '').trim().toLowerCase();
        return catalogue.find((f) => String(f?.familyLabel || '').trim().toLowerCase() === key) || null;
    }

    function groupTypeShort(type) {
        const FDG = global.UgapFamilyDecisionGroup;
        const t = String(type || '').trim();
        if (FDG?.getTypeLabel) {
            const full = FDG.getTypeLabel(t);
            if (full && full.length <= 8) return full;
        }
        if (t === 'model') return 'mod.';
        if (t === 'static') return 'stat.';
        if (t === 'garantie') return 'gar.';
        if (t === 'personnalise') return 'pers.';
        return 'opt.';
    }

    function groupPriceShort(group) {
        const FDG = global.UgapFamilyDecisionGroup;
        const mode = group?.priceMode || group?.pricingMode || '';
        if (mode === 'minoration') return '−';
        if (mode === 'majoration') return '+';
        if (mode === 'static') return '€';
        if (mode === 'none') return '—';
        if (FDG?.getPriceModeLabel) {
            const full = FDG.getPriceModeLabel(mode);
            return full ? full.split(' ')[0].slice(0, 4) : '';
        }
        return '';
    }

    function decisionModeLabel(mode) {
        const m = String(mode || '').trim();
        if (m === 'multi_choice') return 'choix multiple';
        if (m === 'single_choice') return 'choix unique';
        return m || '—';
    }

    function slugLabel(label) {
        return String(label || '').trim().toLowerCase().replace(/\s+/g, '_');
    }

    /** Libellés techniques ou libellés = type (Option catalogue, Modèle…) — pas un nom métier. */
    function isGenericGroupDisplayLabel(label) {
        const raw = String(label || '').trim();
        const s = slugLabel(raw);
        if (!s) return true;
        const genericSlugs = new Set([
            'option_catalogue',
            'option_catalogue_de_base',
            'modele',
            'model',
            'garantie',
            'statique',
            'static',
            'personnalise',
            'principal',
            'composant',
            'default',
            'main',
            'groupe',
            'group',
        ]);
        if (genericSlugs.has(s)) return true;
        const FDG = global.UgapFamilyDecisionGroup;
        if (FDG?.getTypeLabel) {
            for (const t of ['model', 'option', 'static', 'garantie', 'personnalise']) {
                const tl = String(FDG.getTypeLabel(t) || '').trim();
                if (tl && (slugLabel(tl) === s || raw.toLowerCase() === tl.toLowerCase())) return true;
            }
        }
        if (/^option\s+catalogue/i.test(raw)) return true;
        return /^mod[èe]le$/i.test(raw);
    }

    function isLegacyComponentDisplayLabel(label) {
        const s = slugLabel(label);
        return !s || s === 'principal' || s === 'composant' || s === 'default' || s === 'main';
    }

    /**
     * Titre principal d’un groupe : nom métier (famille / libellé groupe), pas le type.
     */
    function resolvePrimaryGroupTitle(input) {
        const meta = resolveGroupDisplayMeta(input);
        const comp = String(meta.componentLabel || '').trim();
        const grp = String(meta.groupLabel || '').trim();
        const fam = String(meta.familyLabel || '').trim();
        if (grp && !isGenericGroupDisplayLabel(grp)) return grp;
        if (comp && !isLegacyComponentDisplayLabel(comp) && !isGenericGroupDisplayLabel(comp)) return comp;
        if (fam) return fam;
        if (grp) return grp;
        const FDG = global.UgapFamilyDecisionGroup;
        return String(FDG?.getTypeLabel?.(meta.type) || meta.typeLabel || 'Groupe').trim();
    }

    function resolveComponentLabel(fam, compId, hints = {}) {
        const fromHints = String(hints.componentLabel || '').trim();
        if (fromHints) return fromHints;
        const cid = String(compId || '').trim();
        if (!cid || !fam) return '';
        const FCmp = global.UgapFamilyComponents;
        const comp = FCmp?.findComponent ? FCmp.findComponent(fam, cid) : null;
        return String(comp?.label || '').trim();
    }

    /**
     * Résout libellé groupe + métadonnées depuis le catalogue familles.
     */
    function resolveGroupDisplayMeta(input) {
        const src = input && typeof input === 'object' ? input : {};
        const familyLabel = String(src.familyLabel || '').trim();
        const groupId = String(src.groupId || '').trim();
        const categoryName = String(src.categoryName || '').trim();
        const fam = findCatalogueFamily(familyLabel, src.sourceIndex);
        const FCmp = global.UgapFamilyComponents;
        const compId = String(src.componentId || '').trim();
        let group = null;
        let componentLabel = resolveComponentLabel(fam, compId, src);
        if (fam && compId && groupId && FCmp?.findGroupInFamily) {
            const hit = FCmp.findGroupInFamily(fam, compId, groupId);
            if (hit) {
                group = hit.group;
                if (!componentLabel) componentLabel = String(hit.component?.label || '').trim();
            }
        }
        if (!group && fam && groupId) {
            if (FCmp?.resolveGroupInFamily) {
                const resolved = FCmp.resolveGroupInFamily(fam, compId, groupId);
                if (resolved?.group) group = resolved.group;
            }
        }
        if (!group && fam) {
            const groups = FCmp?.flattenDecisionGroups
                ? FCmp.flattenDecisionGroups(fam)
                : normalizeGroups(fam.decisionGroups);
            group = groups.find((g) => {
                const gid = String(g?.id || g?.groupId || '').trim();
                if (gid !== groupId) return false;
                if (compId) {
                    const gComp = String(g?.componentId || '').trim();
                    if (gComp === compId) return true;
                    return !gComp;
                }
                return true;
            }) || null;
            if (group && !componentLabel) {
                componentLabel = String(group.componentLabel || '').trim();
            }
        }
        const groupLabel = String(
            src.groupLabel || src.label || group?.label || groupId || 'Groupe'
        ).trim();
        const slotOptIds = Array.isArray(src.groupOptionIds) ? src.groupOptionIds : [];
        const optionCount = slotOptIds.length
            ? slotOptIds.filter(Boolean).length
            : (group ? (Array.isArray(group.optionIds) ? group.optionIds : []).filter(Boolean).length : 0);
        const type = String(group?.type || src.type || 'option').trim();
        const priceHint = group ? groupPriceShort(group) : '';
        return {
            categoryName,
            familyLabel: familyLabel || String(fam?.familyLabel || '').trim(),
            componentId: compId,
            componentLabel,
            groupId,
            groupLabel,
            type,
            typeLabel: groupTypeShort(type),
            priceHint,
            decisionMode: String(group?.decisionMode || src.decisionMode || 'single_choice').trim(),
            decisionModeLabel: decisionModeLabel(group?.decisionMode || src.decisionMode),
            optionCount,
            missing: !group && !!groupId,
        };
    }

    function renderGroupMetaLine(meta, primaryTitle) {
        const m = meta && typeof meta === 'object' ? meta : {};
        const primary = String(primaryTitle || '').trim();
        const parts = [];
        const fam = String(m.familyLabel || '').trim();
        if (fam && fam !== primary) parts.push(`Famille : ${fam}`);
        const FDG = global.UgapFamilyDecisionGroup;
        const typeFull = FDG?.getTypeLabel
            ? String(FDG.getTypeLabel(m.type) || '').trim()
            : '';
        if (typeFull) parts.push(typeFull);
        else if (m.typeLabel) parts.push(m.typeLabel);
        if (m.priceHint) parts.push(m.priceHint);
        if (m.decisionModeLabel) parts.push(m.decisionModeLabel);
        if (Number.isFinite(Number(m.optionCount))) {
            parts.push(`${m.optionCount} opt.`);
        }
        if (m.missing) parts.push('groupe introuvable');
        return parts.join(' · ');
    }

    /** Titre principal d’un slot groupe (Modèles / options de base). */
    function renderGroupSlotHeaderHtml(meta) {
        const m = resolveGroupDisplayMeta(meta);
        const primaryTitle = resolvePrimaryGroupTitle(meta);
        const catLine = m.categoryName
            ? `<span class="ugap-group-display__category">${esc(m.categoryName)}</span>`
            : '';
        const metaLine = renderGroupMetaLine(m, primaryTitle);
        const comp = String(m.componentLabel || '').trim();
        const showComp = comp
            && !isLegacyComponentDisplayLabel(comp)
            && !isGenericGroupDisplayLabel(comp)
            && comp !== primaryTitle;
        const labelHtml = showComp
            ? `<span class="ugap-group-display__comp-name">${esc(comp)}</span>
                <span class="ugap-group-display__grp-name">${esc(primaryTitle)}</span>`
            : esc(primaryTitle);
        return `
            <div class="ugap-group-display__slot-head">
                ${catLine}
                <div class="ugap-group-display__group-label">${labelHtml}</div>
                <div class="ugap-group-display__meta">${esc(metaLine)}</div>
            </div>`;
    }

    /** Ligne liste groupe (Bateau de base). */
    function renderGroupListItemHtml(meta, options = {}) {
        const m = resolveGroupDisplayMeta(meta);
        const opts = options && typeof options === 'object' ? options : {};
        const compact = !!opts.compact;
        const showId = opts.showTechnicalId !== false && !compact;
        const idPart = showId && m.groupId && m.groupId !== m.groupLabel
            ? `<code class="ugap-group-display__id">${esc(m.groupId)}</code>`
            : '';
        const catPart = !compact && m.categoryName
            ? `<span class="ugap-group-display__chip ugap-group-display__chip--cat">${esc(m.categoryName)}</span>`
            : '';
        const compPart = m.componentLabel
            ? `<span class="ugap-group-display__comp">${esc(m.componentLabel)}</span>`
            : '';
        const primaryTitle = resolvePrimaryGroupTitle(meta);
        const tags = compact
            ? [m.typeLabel, m.priceHint, Number.isFinite(Number(m.optionCount)) ? `${m.optionCount} opt.` : '']
                .filter(Boolean).join(' · ')
            : renderGroupMetaLine(m, primaryTitle);
        const name = compact && compPart
            ? `${m.componentLabel} · ${primaryTitle}`
            : primaryTitle;
        return `
            <span class="ugap-group-display__list-main${compact ? ' ugap-group-display__list-main--compact' : ''}">
                ${catPart}
                ${!compact ? compPart : ''}
                <strong class="ugap-group-display__name">${esc(name)}</strong>
                <span class="ugap-group-display__fam">${esc(m.familyLabel || '—')}</span>
                <span class="ugap-group-display__tags">${esc(tags)}</span>
                ${idPart}
            </span>`;
    }

    function groupSlotsByCategoryAndFamily(slots) {
        const byCat = new Map();
        (Array.isArray(slots) ? slots : []).forEach((slot) => {
            const cat = String(slot?.categoryName || '').trim() || 'Autres';
            if (!byCat.has(cat)) byCat.set(cat, new Map());
            const fam = String(slot?.familyLabel || '').trim() || '—';
            const famMap = byCat.get(cat);
            if (!famMap.has(fam)) famMap.set(fam, []);
            famMap.get(fam).push(slot);
        });
        return byCat;
    }

    global.UgapGroupDisplay = {
        resolveGroupDisplayMeta,
        resolvePrimaryGroupTitle,
        isGenericGroupDisplayLabel,
        renderGroupMetaLine,
        renderGroupSlotHeaderHtml,
        renderGroupListItemHtml,
        groupSlotsByCategoryAndFamily,
        findCatalogueFamily,
    };
})(window);
