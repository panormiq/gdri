/**
 * Options de base modèle ↔ template bateau (paramétrage v2, sans legacy admin).
 */
(function initUgapModelBaseOptions(global) {
    'use strict';

    /** Contexte optionnel (configurateur) — ne pas écraser les globals paramétrage. */
    let runtimeContext = null;

    function setConfiguratorContext(ctx) {
        runtimeContext = ctx && typeof ctx === 'object' ? ctx : null;
    }

    function clearConfiguratorContext() {
        runtimeContext = null;
    }

    function resolveData() {
        if (typeof runtimeContext?.getData === 'function') {
            const data = runtimeContext.getData();
            if (data && typeof data === 'object') return data;
        }
        return typeof global.getUgapCurrentData === 'function' ? global.getUgapCurrentData() : null;
    }

    function getData() {
        return resolveData();
    }

    function normalizeGroups(raw) {
        if (typeof global.normalizeFamilyDecisionGroups === 'function') {
            return global.normalizeFamilyDecisionGroups(raw);
        }
        return Array.isArray(raw) ? raw : [];
    }

    function parseFamilyLabel(rawLabel) {
        const fullLabel = String(rawLabel || '').trim();
        if (!fullLabel) return { fullLabel: '', familyName: '', subFamilyName: '' };
        const parts = fullLabel.split('/').map((p) => String(p || '').trim()).filter(Boolean);
        if (parts.length <= 1) return { fullLabel, familyName: fullLabel, subFamilyName: '' };
        return { fullLabel, familyName: parts[0], subFamilyName: parts.slice(1).join(' / ') };
    }

    function familyRootLabel(family) {
        return parseFamilyLabel(String(family?.familyLabel || '').trim()).familyName
            || String(family?.familyLabel || '').trim();
    }

    function resolveFamilies() {
        if (typeof runtimeContext?.getFamilies === 'function') {
            const list = runtimeContext.getFamilies();
            if (Array.isArray(list)) return list;
        }
        return typeof global.getFamiliesForAssignationTab === 'function'
            ? global.getFamiliesForAssignationTab()
            : [];
    }

    function getFamilies() {
        return resolveFamilies();
    }

    function resolveTemplates() {
        if (typeof runtimeContext?.getTemplates === 'function') {
            const list = runtimeContext.getTemplates();
            if (Array.isArray(list)) return list;
        }
        return typeof global.getSavedBoatTemplates === 'function' ? global.getSavedBoatTemplates() : [];
    }

    function getTemplates() {
        return resolveTemplates();
    }

    function getTemplateById(templateId) {
        const id = String(templateId || '').trim();
        return getTemplates().find((t) => String(t?.id || '').trim() === id) || null;
    }

    function getTemplateLabel(templateId) {
        const tpl = getTemplateById(templateId);
        return String(tpl?.label || templateId || '').trim();
    }

    function findOptionRecord(optionId) {
        const oid = String(optionId || '').trim();
        if (!oid) return null;
        const data = resolveData();
        for (const cat of (Array.isArray(data?.categories) ? data.categories : [])) {
            for (const opt of (Array.isArray(cat?.options) ? cat.options : [])) {
                if (String(opt?.id || '').trim() === oid) {
                    return { category: cat, option: opt };
                }
            }
        }
        return null;
    }

    function findFamilyForTemplateLabel(templateFamilyLabel) {
        const wanted = String(templateFamilyLabel || '').trim().toLowerCase();
        if (!wanted) return null;
        return getFamilies().find((f) => {
            const root = familyRootLabel(f).toLowerCase();
            const lbl = String(f?.familyLabel || '').trim().toLowerCase();
            return root === wanted || lbl === wanted;
        }) || null;
    }

    function getOptionAssignmentContext(optionId, fallbackFamilyLabel) {
        const wanted = String(optionId || '').trim();
        for (const f of getFamilies()) {
            const familyName = familyRootLabel(f);
            const groups = normalizeGroups(f?.decisionGroups);
            for (const g of groups) {
                const gIds = (Array.isArray(g?.optionIds) ? g.optionIds : []).map((x) => String(x));
                if (gIds.includes(wanted)) {
                    return { familyName, groupLabel: String(g?.label || g?.id || '').trim() };
                }
            }
        }
        const parsed = parseFamilyLabel(fallbackFamilyLabel);
        return {
            familyName: parsed.familyName || String(fallbackFamilyLabel || '').trim(),
            groupLabel: parsed.subFamilyName || '',
        };
    }

    function isMinorationOption(opt) {
        if (!opt || typeof opt !== 'object') return false;
        if (opt.isMinoration === true) return true;
        const ref = String(opt.refUgap || opt.baseRefUgap || '').trim().toUpperCase();
        if (ref.startsWith('MINO')) return true;
        return /^(moins-value|plus-value|plus\s+value)\b/i.test(String(opt.name || ''));
    }

    function isImportGeneratedBaseOption(opt) {
        if (!opt || typeof opt !== 'object') return false;
        if (opt.importGeneratedFromBaseProduct || opt.importBaseProductId) return true;
        return String(opt.refUgap || '').trim().toUpperCase().startsWith('IBP-');
    }

    function isMotorTarifName(name) {
        const n = String(name || '').replace(/\s+/g, ' ').trim();
        if (!n || /\ben\s+remplacement\b/i.test(n)) return false;
        if (!/\b(moteur|motorisation)\b/i.test(n)) return false;
        if (n.length < 55) return false;
        return /\b(hors-bord|essence|démarrage|direction|hélice|helice|arbre)\b/i.test(n)
            || (/\bDF\d{2,4}/i.test(n) && /\bsuzuki|mercury|yamaha|honda\b/i.test(n));
    }

    function isCompatible(opt, modelId) {
        const comp = Array.isArray(opt?.compatibleModels) ? opt.compatibleModels.map(String) : [];
        return comp.includes(String(modelId || '').trim());
    }

    function isBaseForModel(optionId, modelId) {
        const rec = findOptionRecord(optionId)?.option;
        if (!rec?.baseIncluded) return false;
        if (isMotorTarifName(rec.name) && !isImportGeneratedBaseOption(rec)) return false;
        return isCompatible(rec, modelId);
    }

    function getSlotKey(slot) {
        return `${String(slot?.familyLabel || '').trim().toLowerCase()}::${String(slot?.groupId || '').trim()}`;
    }

    function resolveSlotPicks() {
        if (typeof runtimeContext?.getModelBaseSlotPicks === 'function') {
            const picks = runtimeContext.getModelBaseSlotPicks();
            if (picks && typeof picks === 'object' && !Array.isArray(picks)) return picks;
        }
        return global.UgapBateauBaseLcState?.getModelBaseSlotPicks?.() || {};
    }

    function getSlotPicksForModel(modelId) {
        const picks = resolveSlotPicks();
        const row = picks[String(modelId || '').trim()];
        return row && typeof row === 'object' ? row : {};
    }

    function getTemplateDecisionSlots(tpl) {
        if (!tpl) return [];
        const slots = [];
        const categories = typeof global.getBoatTemplateSnapshotCategories === 'function'
            ? global.getBoatTemplateSnapshotCategories(tpl)
            : [];
        categories.forEach((cat) => {
            const categoryName = String(cat?.name || cat?.objectName || '').trim();
            (Array.isArray(cat?.families) ? cat.families : []).forEach((tf) => {
                const familyLabel = String(tf?.familyLabel || '').trim();
                if (!familyLabel) return;
                normalizeGroups(tf?.decisionGroups).forEach((g) => {
                    const groupId = String(g?.id || '').trim();
                    if (!groupId) return;
                    slots.push({
                        categoryName,
                        familyLabel,
                        groupId,
                        groupLabel: String(g?.label || g?.id || '').trim(),
                    });
                });
            });
        });
        return slots;
    }

    function optionMatchesSlot(optionId, slot) {
        const oid = String(optionId || '').trim();
        if (!oid || !slot) return false;
        const rec = findOptionRecord(oid)?.option;
        if (rec && isMinorationOption(rec)) return false;
        if (slot.fixedOptionId) return oid === String(slot.fixedOptionId).trim();

        const fam = findFamilyForTemplateLabel(slot.familyLabel);
        if (!fam) return false;
        const groups = normalizeGroups(fam.decisionGroups);
        const grp = groups.find((g) => String(g?.id || '').trim() === String(slot.groupId || '').trim());
        if (!grp) return false;

        const groupOptionIds = (Array.isArray(grp.optionIds) ? grp.optionIds : [])
            .map((x) => String(x || '').trim()).filter(Boolean);
        if (groupOptionIds.includes(oid)) return true;

        const ctx = getOptionAssignmentContext(oid, rec?.familyLabel);
        const famRoot = familyRootLabel(fam).toLowerCase();
        const ctxFam = String(ctx.familyName || '').trim().toLowerCase();
        const slotFam = String(slot.familyLabel || '').trim().toLowerCase();
        const ctxGrp = String(ctx.groupLabel || '').trim().toLowerCase();
        const slotGrp = String(slot.groupLabel || '').trim().toLowerCase();
        return (ctxFam === famRoot || ctxFam === slotFam) && ctxGrp && slotGrp && ctxGrp === slotGrp;
    }

    function getAssignedOptionId(modelId, slot) {
        const mid = String(modelId || '').trim();
        if (!mid || !slot) return '';
        const explicit = String(getSlotPicksForModel(mid)[getSlotKey(slot)] || '').trim();
        if (explicit) {
            const rec = findOptionRecord(explicit)?.option;
            if (rec && isBaseForModel(explicit, mid) && optionMatchesSlot(explicit, slot)) return explicit;
        }
        const data = resolveData();
        const model = (Array.isArray(data?.models) ? data.models : [])
            .find((m) => String(m?.id || '').trim() === mid);
        const matches = [];
        (Array.isArray(data?.categories) ? data.categories : []).forEach((cat) => {
            (cat.options || []).forEach((opt) => {
                const oid = String(opt?.id || '').trim();
                if (!oid || isMinorationOption(opt) || !isBaseForModel(oid, mid)) return;
                if (optionMatchesSlot(oid, slot)) matches.push(oid);
            });
        });
        if (!matches.length) return '';
        const ibp = matches.find((id) => isImportGeneratedBaseOption(findOptionRecord(id)?.option));
        if (ibp) return ibp;
        const nonTarif = matches.filter((id) => {
            const rec = findOptionRecord(id)?.option;
            return rec && !isMotorTarifName(rec.name);
        });
        if (nonTarif.length === 1) return nonTarif[0];
        return matches[0];
    }

    function getGroupOptionIdsForSlot(slot) {
        const fam = findFamilyForTemplateLabel(slot?.familyLabel);
        if (!fam) return [];
        const gid = String(slot?.groupId || '').trim();
        const grp = normalizeGroups(fam.decisionGroups).find(
            (g) => String(g?.id || '').trim() === gid
        );
        return (Array.isArray(grp?.optionIds) ? grp.optionIds : [])
            .map((x) => String(x || '').trim())
            .filter(Boolean);
    }

    /** Options du groupe famille (onglet Modèle / choix de base), pas tout le catalogue. */
    function canOfferAsChoice(opt, modelId, slot) {
        if (!opt || isMinorationOption(opt) || !isCompatible(opt, modelId)) return false;
        const oid = String(opt.id || '').trim();
        const inGroup = getGroupOptionIdsForSlot(slot).includes(oid);
        if (!inGroup) return false;
        if (isMotorTarifName(opt.name) && !isImportGeneratedBaseOption(opt)) return false;
        return true;
    }

    function getChoiceRows(model, slot) {
        const modelId = String(model?.id || '').trim();
        const ids = new Set();
        const assigned = getAssignedOptionId(modelId, slot);
        if (assigned) ids.add(assigned);
        getGroupOptionIdsForSlot(slot).forEach((oid) => {
            const opt = findOptionRecord(oid)?.option;
            if (opt && canOfferAsChoice(opt, modelId, slot)) ids.add(oid);
        });
        return Array.from(ids).map((oid) => {
            const rec = findOptionRecord(oid)?.option || {};
            return {
                id: oid,
                name: String(rec.name || oid).trim(),
                refUgap: String(rec.baseRefUgap || rec.refUgap || '').trim(),
            };
        }).sort((a, b) => a.name.localeCompare(b.name, 'fr'));
    }

    function getStatus(model) {
        const modelId = String(model?.id || '').trim();
        const templateId = String(model?.boatTemplateId || '').trim();
        if (!templateId) {
            return { hasTemplate: false, isComplete: true, missingCount: 0, slots: [] };
        }
        const tpl = getTemplateById(templateId);
        const slots = getTemplateDecisionSlots(tpl).map((s, idx) => ({ ...s, __idx: idx }));
        let missingCount = 0;
        slots.forEach((slot) => {
            if (!getAssignedOptionId(modelId, slot)) missingCount += 1;
        });
        return {
            hasTemplate: true,
            isComplete: missingCount === 0,
            missingCount,
            slots,
            templateLabel: getTemplateLabel(templateId),
        };
    }

    function groupSlotsByFamily(slots) {
        const map = new Map();
        (Array.isArray(slots) ? slots : []).forEach((slot) => {
            const fam = String(slot.categoryName || slot.familyLabel || '').trim() || 'Options de base';
            if (!map.has(fam)) map.set(fam, []);
            map.get(fam).push(slot);
        });
        return map;
    }

    async function reloadData() {
        await global.UgapBateauBaseLcState?.loadFromServer?.(true);
        await global.UgapFamilleLcState?.loadFromServer?.(true);
    }

    async function assignBoatTemplate(modelId, templateId) {
        const mid = String(modelId || '').trim();
        const tid = String(templateId || '').trim();
        await global.apiCall(`/models/${encodeURIComponent(mid)}`, {
            method: 'PUT',
            body: JSON.stringify({ boatTemplateId: tid || null }),
        });
        const data = getData();
        const model = (Array.isArray(data?.models) ? data.models : []).find((m) => String(m?.id) === mid);
        if (model) model.boatTemplateId = tid || null;
        if (typeof global.setUgapCurrentData === 'function' && data) global.setUgapCurrentData(data);
    }

    async function assignOptionToFamilyGroup(optionId, familyLabel, groupId) {
        const oid = String(optionId || '').trim();
        const famLabel = String(familyLabel || '').trim();
        const gid = String(groupId || '').trim();
        if (!oid || !famLabel) return;
        const families = JSON.parse(JSON.stringify(global.UgapFamilleLcState?.getFamilies?.() || []));
        const target = families.find((f) => familyRootLabel(f).toLowerCase() === famLabel.toLowerCase()
            || String(f?.familyLabel || '').trim().toLowerCase() === famLabel.toLowerCase());
        if (!target) return;
        const ids = new Set([oid]);
        families.forEach((family) => {
            family.optionIds = (Array.isArray(family.optionIds) ? family.optionIds : [])
                .filter((id) => !ids.has(String(id)));
            normalizeGroups(family.decisionGroups).forEach((group) => {
                group.optionIds = (Array.isArray(group.optionIds) ? group.optionIds : [])
                    .filter((id) => !ids.has(String(id)));
            });
        });
        target.optionIds = [...new Set([...(Array.isArray(target.optionIds) ? target.optionIds : []), oid])];
        const groups = normalizeGroups(target.decisionGroups);
        const resolved = gid || groups[0]?.id || '';
        groups.forEach((group) => {
            const id = String(group?.id || '').trim();
            group.optionIds = Array.isArray(group.optionIds) ? group.optionIds : [];
            if (id && id === resolved) group.optionIds.push(oid);
        });
        target.decisionGroups = groups;
        global.UgapFamilleLcState?.setFamilies?.(families, { persist: false });
        await global.apiCall('/ui-state', {
            method: 'PUT',
            body: JSON.stringify({
                families: families.map((f) => {
                    const row = { ...f };
                    delete row.__idx;
                    return row;
                }),
                familyGroupTypes: global.UgapFamilleLcState?.getCustomGroupTypes?.() || [],
                boatTemplates: getTemplates(),
                modelBaseSlotPicks: global.UgapBateauBaseLcState?.getModelBaseSlotPicks?.() || {},
            }),
        });
    }

    async function linkBaseOption(optionId, modelId, slot) {
        const rec = findOptionRecord(optionId)?.option;
        if (!rec) throw new Error('Option introuvable.');
        if (isMotorTarifName(rec.name) && !isImportGeneratedBaseOption(rec)) {
            throw new Error('Ligne tarif moteur catalogue — utilisez une option de base import (IBP-…).');
        }
        const compatible = [...new Set([...(Array.isArray(rec.compatibleModels) ? rec.compatibleModels.map(String) : []), String(modelId)])];
        await global.apiCall(`/options/${encodeURIComponent(optionId)}`, {
            method: 'PUT',
            body: JSON.stringify({
                ...rec,
                compatibleModels: compatible,
                baseIncluded: true,
                isBaseOption: true,
                priceClient: 0,
            }),
        });
        rec.compatibleModels = compatible;
        rec.baseIncluded = true;
        rec.isBaseOption = true;
        rec.priceClient = 0;
        const famLabel = String(slot?.familyLabel || '').trim();
        const fullFamily = slot?.groupLabel ? `${familyRootLabel(findFamilyForTemplateLabel(famLabel) || { familyLabel: famLabel })} / ${slot.groupLabel}` : famLabel;
        if (fullFamily) {
            await global.apiCall('/options/assign-families-bulk', {
                method: 'POST',
                body: JSON.stringify({ assignments: [{ optionId, familyLabel: fullFamily }] }),
            });
            rec.familyLabel = fullFamily;
        }
        await assignOptionToFamilyGroup(optionId, famLabel, slot?.groupId);
    }

    async function clearCompeting(modelId, slot, keepOptionId) {
        const mid = String(modelId || '').trim();
        const keep = String(keepOptionId || '').trim();
        const tasks = [];
        (Array.isArray(getData()?.categories) ? getData().categories : []).forEach((cat) => {
            (cat.options || []).forEach((opt) => {
                const oid = String(opt?.id || '').trim();
                if (!oid || oid === keep || !isBaseForModel(oid, mid) || !optionMatchesSlot(oid, slot)) return;
                tasks.push(global.apiCall(`/options/${encodeURIComponent(oid)}`, {
                    method: 'PUT',
                    body: JSON.stringify({ ...opt, baseIncluded: false, isBaseOption: false }),
                }).then(() => { opt.baseIncluded = false; }));
            });
        });
        if (tasks.length) await Promise.all(tasks);
    }

    async function pickBaseOption(modelId, slotIdx, optionId) {
        const data = getData();
        const model = (Array.isArray(data?.models) ? data.models : []).find((m) => String(m?.id) === String(modelId));
        const status = getStatus(model);
        const slot = status.slots[Number(slotIdx)];
        const oid = String(optionId || '').trim();
        if (!model || !slot || !oid) return;
        await clearCompeting(modelId, slot, oid);
        await linkBaseOption(oid, modelId, slot);
        global.UgapBateauBaseLcState?.setModelBaseSlotPick?.(modelId, getSlotKey(slot), oid);
    }

    function nextManualOptionId() {
        const ids = new Set();
        (Array.isArray(getData()?.categories) ? getData().categories : []).forEach((cat) => {
            (cat.options || []).forEach((opt) => ids.add(String(opt?.id || '').trim()));
        });
        let n = 1;
        while (ids.has(`opt_${n}`)) n += 1;
        return `opt_${n}`;
    }

    async function createBaseOption(modelId, slotIdx, payload) {
        const data = getData();
        const model = (Array.isArray(data?.models) ? data.models : []).find((m) => String(m?.id) === String(modelId));
        const status = getStatus(model);
        const slot = status.slots[Number(slotIdx)];
        const name = String(payload?.name || '').trim();
        const refUgap = String(payload?.refUgap || '').trim();
        const priceN = Number(String(payload?.price ?? '').replace(',', '.'));
        const baseIncludedPrice = Number.isFinite(priceN) ? priceN : 0;
        if (!model || !slot || !name) throw new Error('Données invalides.');
        const categoryId = String(data?.categories?.[0]?.id || '').trim();
        if (!categoryId) throw new Error('Aucune catégorie catalogue.');
        const fam = findFamilyForTemplateLabel(slot.familyLabel);
        const familyName = slot.familyLabel ? familyRootLabel(fam || { familyLabel: slot.familyLabel }) : '';
        const groupLabel = String(slot.groupLabel || '').trim();
        const id = nextManualOptionId();
        await global.apiCall('/options', {
            method: 'POST',
            body: JSON.stringify({
                id,
                categoryId,
                name,
                refUgap,
                baseRefUgap: refUgap,
                compatibleModels: [String(modelId)],
                familyLabel: groupLabel ? `${familyName} / ${groupLabel}` : familyName,
                subFamily: groupLabel,
                manualBaseOption: true,
                baseIncluded: true,
                isBaseOption: true,
                baseIncludedPrice,
                priceUgap: baseIncludedPrice,
                priceClient: 0,
            }),
        });
        await reloadData();
        await clearCompeting(modelId, slot, id);
        await linkBaseOption(id, modelId, slot);
        global.UgapBateauBaseLcState?.setModelBaseSlotPick?.(modelId, getSlotKey(slot), id);
        return id;
    }

    global.UgapModelBaseOptions = {
        getData,
        getTemplates,
        getTemplateLabel,
        getTemplateById,
        getStatus,
        getChoiceRows,
        getAssignedOptionId,
        groupSlotsByFamily,
        assignBoatTemplate,
        pickBaseOption,
        createBaseOption,
        reloadData,
        getSlotKey,
        setConfiguratorContext,
        clearConfiguratorContext,
        isMotorTarifName,
        isImportGeneratedBaseOption,
        isBaseForModel,
        optionMatchesSlot,
        findOptionRecord,
    };
})(window);
