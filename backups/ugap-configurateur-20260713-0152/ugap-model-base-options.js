/**
 * Options de base modèle ↔ template bateau (paramétrage v2, sans legacy admin).
 */
(function initUgapModelBaseOptions(global) {
    'use strict';

    /** Contexte optionnel (configurateur) — ne pas écraser les globals paramétrage. */
    let runtimeContext = null;
    /** Session édition preset (paramétrage Modèles) — conservée à travers syncConfiguratorBridge. */
    let presetEditModelId = '';
    let presetEditConfigId = '';

    function mergePresetEditLayer(ctx) {
        const mid = String(presetEditModelId || '').trim();
        const cid = String(presetEditConfigId || '').trim();
        if (!ctx || !mid || !cid || ctx.presetExplicitOnly) return ctx;
        return {
            ...ctx,
            presetExplicitOnly: true,
            getModelBaseSlotPicks: () => {
                const cfg = resolveConfigurationById(mid, cid);
                const picks = cfg?.slotPicks && typeof cfg.slotPicks === 'object' ? cfg.slotPicks : {};
                return { [mid]: { ...picks } };
            },
        };
    }

    function setConfiguratorContext(ctx) {
        const base = ctx && typeof ctx === 'object' ? ctx : null;
        runtimeContext = mergePresetEditLayer(base);
    }

    function clearConfiguratorContext() {
        runtimeContext = null;
        presetEditModelId = '';
        presetEditConfigId = '';
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

    /** Catalogue publié : uiState du configurateur ou LcState paramétrage. */
    function resolveCatalogNodesForRuntime() {
        const data = getData();
        const rawCatalog = data?.uiState?.catalog;
        const Cat = global.UgapGroupCatalog;
        const Core = global.UgapCatalogueNodesCore;
        if (!Cat?.resolveCatalogNodes) return [];
        let nodes = Cat.resolveCatalogNodes({
            catalog: rawCatalog,
            catalogNodes: Array.isArray(rawCatalog?.nodes) ? rawCatalog.nodes : undefined,
            categories: Array.isArray(data?.categories) ? data.categories : undefined,
        }) || [];
        if (!nodes.length && rawCatalog && Core?.normalizeCatalog) {
            nodes = Core.normalizeCatalog(rawCatalog).nodes || [];
        }
        if (!nodes.length && Array.isArray(data?.categories) && data.categories.length && Core?.migrateLegacyCatalog) {
            const migrated = Core.migrateLegacyCatalog({
                categories: data.categories,
                objects: rawCatalog?.objects,
                nodes: rawCatalog?.nodes,
            });
            nodes = Array.isArray(migrated) ? migrated : [];
            if (nodes.length && Core.normalizeCatalog) {
                nodes = Core.normalizeCatalog({ nodes }).nodes || [];
            }
        }
        return nodes;
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
        if (typeof global.getFamiliesForAssignationTab === 'function') {
            return global.getFamiliesForAssignationTab();
        }
        if (global.UgapFamilleLcState?.getFamilies) {
            return global.UgapFamilleLcState.getFamilies().map((f, idx) => ({
                ...(f && typeof f === 'object' ? f : {}),
                __idx: Number.isInteger(f?.__idx) ? f.__idx : idx,
            }));
        }
        return [];
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

    /**
     * Résout le parcours effectif d’un modèle (premier parcours disponible si non assigné).
     */
    function resolveBoatTemplateIdForModel(model) {
        const pool = getTemplates()
            .slice()
            .sort((a, b) => String(a?.label || '').localeCompare(String(b?.label || ''), 'fr', { sensitivity: 'base' }));
        const stored = String(model?.boatTemplateId || '').trim();
        if (stored && pool.some((t) => String(t?.id || '').trim() === stored)) {
            return stored;
        }
        const first = pool[0];
        return first ? String(first.id || '').trim() : '';
    }

    function resolveBoatTemplateForModel(model) {
        const id = resolveBoatTemplateIdForModel(model);
        if (!id) return null;
        return getTemplateById(id) || null;
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
        const St = global.UgapCatalogueLcState;
        if (St?.getAllOptions) {
            const hit = (St.getAllOptions() || []).find((o) => String(o?.id || '').trim() === oid);
            if (hit) {
                const catId = String(data?.categories?.[0]?.id || '').trim();
                const cat = (Array.isArray(data?.categories) ? data.categories : []).find(
                    (c) => String(c?.id || '').trim() === catId
                ) || { id: catId, name: String(hit.categoryName || '').trim() };
                return { category: cat, option: hit };
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

    function findFamilyForSlot(slot) {
        const catalogue = getFamilies();
        const idx = Number(slot?.sourceIndex);
        if (Number.isInteger(idx)) {
            const hit = catalogue.find((f) => Number(f.__idx) === idx);
            if (hit) return hit;
        }
        return findFamilyForTemplateLabel(slot?.familyLabel);
    }

    function optionIdsFromFamilyGroup(fam, groupId) {
        const gid = String(groupId || '').trim();
        if (!gid || !fam) return [];
        const grp = normalizeGroups(fam.decisionGroups || fam.groups).find((g) => {
            return String(g?.id || g?.groupId || '').trim() === gid;
        });
        if (!grp) return [];
        return (Array.isArray(grp.optionIds) ? grp.optionIds : [])
            .map((x) => String(x || '').trim())
            .filter(Boolean);
    }

    function catalogNodeIdFromSlot(slot) {
        const s = slot && typeof slot === 'object' ? slot : {};
        const direct = String(s.catalogNodeId || '').trim();
        if (direct) return direct;
        const gid = String(s.groupId || '').trim();
        if (gid.startsWith('cn_')) return gid.slice(3);
        return '';
    }

    function optionIdsForCatalogNode(catalogNodeId) {
        const nid = String(catalogNodeId || '').trim();
        if (!nid) return [];
        const catalogNodes = resolveCatalogNodesForRuntime();
        const St = global.UgapCatalogueLcState;
        if (St?.getOptionsForNode) {
            const fromIndex = (St.getOptionsForNode(nid, catalogNodes) || [])
                .map((opt) => String(opt?.id || '').trim())
                .filter(Boolean);
            if (fromIndex.length) return fromIndex;
        }
        const data = resolveData();
        const categories = Array.isArray(data?.categories) ? data.categories : [];
        const Tree = global.UgapBoatTemplateTree;
        const optionById = Tree?.buildCatalogueOptionById?.(categories) || new Map();
        const Cat = global.UgapGroupCatalog;
        if (Cat?.collectOptionsForCatalogNode) {
            return Cat.collectOptionsForCatalogNode(nid, optionById, () => true)
                .map((opt) => String(opt?.id || '').trim())
                .filter(Boolean);
        }
        return [];
    }

    function resolveGroupOptionIdsForSlot(slot) {
        const s = slot && typeof slot === 'object' ? slot : {};
        const catalogNodeId = catalogNodeIdFromSlot(s);
        if (catalogNodeId) {
            return optionIdsForCatalogNode(catalogNodeId);
        }
        const gid = String(s.groupId || '').trim();
        if (!gid) return [];
        return (Array.isArray(s.groupOptionIds) ? s.groupOptionIds : [])
            .map((x) => String(x || '').trim())
            .filter(Boolean);
    }

    function isGenericGroupTitle(label) {
        const s = String(label || '').trim().toLowerCase().replace(/\s+/g, '_');
        return !s
            || s === 'option_catalogue'
            || s === 'modele'
            || s === 'model'
            || s === 'garantie'
            || s === 'statique';
    }

    function groupTypeDisplayLabel(type) {
        const t = String(type || '').trim();
        const FDG = global.UgapFamilyDecisionGroup;
        if (FDG?.getTypeLabel && t) return String(FDG.getTypeLabel(t) || '').trim();
        if (t === 'model') return 'Modèle';
        if (t === 'garantie') return 'Garantie';
        if (t === 'static') return 'Statique';
        return '';
    }

    function formatSlotTitle(slot) {
        const GD = global.UgapGroupDisplay;
        if (GD?.resolvePrimaryGroupTitle) {
            return GD.resolvePrimaryGroupTitle(slot);
        }
        const s = slot && typeof slot === 'object' ? slot : {};
        const fam = String(s.familyLabel || '').trim();
        const grpMeta = getDecisionGroupForSlot(s);
        const typeLabel = groupTypeDisplayLabel(s.type || grpMeta?.type);
        const grp = String(s.groupLabel || grpMeta?.label || '').trim();
        if (grp && !isGenericGroupTitle(grp)) return grp;
        if (fam) return fam;
        return typeLabel || grp || 'Groupe';
    }

    /**
     * Groupes assignables = catalogue Famille + groupes présents sur les templates bateau
     * (même liste que les slots « options de base » du modèle).
     */
    function getAssignableGroupsForFamily(family) {
        const fam = repairFamilyFlatGroups(family && typeof family === 'object' ? family : null);
        if (!fam) return [];
        const seen = new Set();
        const out = [];
        normalizeGroups(fam.decisionGroups || fam.groups).forEach((g) => {
            const gid = String(g?.id || g?.groupId || '').trim();
            if (!gid || seen.has(gid)) return;
            seen.add(gid);
            out.push({
                ...g,
                id: gid,
                groupId: gid,
                label: String(g?.label || gid).trim(),
                type: String(g?.type || '').trim(),
                decisionMode: String(g?.decisionMode || 'single_choice').trim(),
            });
        });
        return out.sort((a, b) => String(a.label || a.id || '').localeCompare(
            String(b.label || b.id || ''),
            'fr',
            { sensitivity: 'base' }
        ));
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
        return isCompatible(rec, modelId);
    }

    /** Clé slot : famille + id groupe (ui-state.modelBaseSlotPicks). */
    function getSlotKey(slot) {
        const catalogNodeId = catalogNodeIdFromSlot(slot);
        const groupId = String(slot?.groupId || '').trim();
        if (catalogNodeId && groupId) return `cn::${catalogNodeId}::${groupId}`;
        const fam = String(slot?.familyLabel || '').trim().toLowerCase();
        if (fam && groupId) return `${fam}::${groupId}`;
        return groupId;
    }

    /** Anciennes clés persistées — lecture seule. */
    function buildSlotKeyCandidates(slot) {
        const keys = [];
        const add = (k) => {
            const s = String(k || '').trim();
            if (s && !keys.includes(s)) keys.push(s);
        };
        add(getSlotKey(slot));
        const nodeId = String(slot?.nodeId || '').trim();
        const groupId = String(slot?.groupId || '').trim();
        const fam = String(slot?.familyLabel || '').trim().toLowerCase();
        const grp = groupId.toLowerCase();
        if (nodeId && grp) add(`${nodeId}::${groupId}`);
        if (fam && grp) add(`${fam}::${grp}`);
        if (grp) add(grp);
        if (fam && grp) add(`${fam}::principal::${grp}`);
        return keys;
    }

    function readPickRawForSlot(modelId, slot) {
        const row = getSlotPicksForModel(modelId);
        for (const key of buildSlotKeyCandidates(slot)) {
            if (Object.prototype.hasOwnProperty.call(row, key)) {
                return row[key];
            }
        }
        return undefined;
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

    /** Répare familles sauvegardées sans decisionGroups (bug composants). */
    function repairFamilyFlatGroups(family) {
        const f = family && typeof family === 'object' ? { ...family } : {};
        let groups = normalizeGroups(f.decisionGroups || f.groups);
        if (groups.length) return f;
        if (Array.isArray(f.components)) {
            const rebuilt = [];
            f.components.forEach((comp) => {
                normalizeGroups(comp.decisionGroups).forEach((g) => {
                    const id = String(g?.id || g?.groupId || '').trim();
                    if (!id) return;
                    rebuilt.push({
                        ...g,
                        id,
                        groupId: id,
                        optionIds: Array.isArray(g.optionIds) ? g.optionIds : [],
                    });
                });
            });
            if (rebuilt.length) {
                f.decisionGroups = rebuilt;
                delete f.components;
            }
        }
        return f;
    }

    function getLiveGroupsForFamily(fam) {
        if (!fam) return [];
        const FCmp = global.UgapFamilyComponents;
        if (FCmp?.flattenDecisionGroups) {
            return normalizeGroups(FCmp.flattenDecisionGroups(fam));
        }
        const repaired = repairFamilyFlatGroups(fam);
        return normalizeGroups(repaired.decisionGroups || repaired.groups);
    }

    function resolveLiveGroupInFamily(fam, groupId, componentId) {
        const Cat = global.UgapGroupCatalog;
        if (Cat?.resolveLiveGroupInFamily) {
            return Cat.resolveLiveGroupInFamily(fam, groupId, componentId);
        }
        const gid = String(groupId || '').trim();
        if (!fam || !gid) return null;
        const FCmp = global.UgapFamilyComponents;
        const compId = String(componentId || '').trim();
        if (FCmp?.resolveGroupInFamily) {
            const hit = FCmp.resolveGroupInFamily(fam, compId, gid);
            if (hit?.group) {
                return {
                    ...hit.group,
                    id: String(hit.groupId || hit.group.id || hit.group.groupId || gid).trim(),
                    groupId: String(hit.groupId || hit.group.id || hit.group.groupId || gid).trim(),
                    componentId: String(hit.componentId || hit.group.componentId || compId).trim(),
                };
            }
        }
        const groups = getLiveGroupsForFamily(fam);
        return groups.find((g) => String(g?.id || g?.groupId || '').trim() === gid) || null;
    }

    function buildSlotRowFromGroup(cat, tf, g, familyLabel) {
        const groupId = String(g?.id || g?.groupId || '').trim();
        if (!groupId) return null;
        const compId = String(g?.componentId || tf?.componentId || '').trim();
        const grpMeta = getDecisionGroupForSlot({
            familyLabel,
            groupId,
            componentId: compId,
            sourceIndex: tf?.sourceIndex,
            type: g?.type,
        });
        const catalogNodeId = String(g?.catalogNodeId || tf?.catalogNodeId || '').trim();
        const slotRow = {
            nodeId: String(cat?.id || '').trim(),
            categoryName: String(cat?.name || cat?.objectName || '').trim(),
            catalogNodeLabel: String(tf?.catalogNodeLabel || g?.label || '').trim() || undefined,
            familyLabel: catalogNodeId ? undefined : familyLabel,
            sourceIndex: catalogNodeId ? undefined : tf?.sourceIndex,
            componentId: catalogNodeId ? undefined : compId,
            groupId,
            groupLabel: String(g?.label || g?.id || '').trim(),
            type: String(g?.type || grpMeta?.type || '').trim(),
            catalogNodeId: catalogNodeId || undefined,
            groupOptionIds: (Array.isArray(g?.optionIds) ? g.optionIds : [])
                .map((x) => String(x || '').trim())
                .filter(Boolean),
            decisionMode: String(g?.decisionMode || grpMeta?.decisionMode || '').trim().toLowerCase() === 'multi_choice'
                ? 'multi_choice'
                : 'single_choice',
        };
        const resolvedIds = resolveGroupOptionIdsForSlot(slotRow);
        slotRow.groupOptionIds = resolvedIds.length ? resolvedIds : slotRow.groupOptionIds;
        return slotRow;
    }

    /**
     * Un slot par nœud catalogue — même parcours que l’onglet Ordre des options (ordre template + arbre Catalogue).
     */
    function enumerateCatalogParcoursSlots(tpl) {
        if (!tpl) return [];
        const { catalogNodes, order } = getTemplateCatalogParcours(tpl);
        const Core = global.UgapCatalogueNodesCore;
        if (!catalogNodes.length || !Core?.getChildren) return [];

        const Tree = global.UgapBoatTemplateTree;
        const slots = [];
        const seen = new Set();

        function addCatalogNode(cnId) {
            const id = String(cnId || '').trim();
            if (!id || seen.has(id)) return;
            seen.add(id);
            const cn = Core.getNodeById?.(catalogNodes, id) || { id, label: id };
            const groupId = `cn_${id}`;
            const label = Core.nodeBreadcrumb?.(catalogNodes, id)
                || String(cn.label || id).trim();
            const decisionMode = String(cn.decisionMode || '').trim() === 'multi_choice'
                ? 'multi_choice'
                : 'single_choice';
            const tplNodeId = Tree?.templateNodeIdForCatalog?.(id) || `tplcn_${id}`;
            const slotRow = buildSlotRowFromGroup(
                { id: tplNodeId, name: label, objectName: label },
                { catalogNodeId: id, catalogNodeLabel: label },
                {
                    id: groupId,
                    groupId,
                    catalogNodeId: id,
                    label,
                    type: 'option',
                    decisionMode,
                    optionIds: [],
                },
                label
            );
            if (slotRow) slots.push(slotRow);
        }

        function visit(cnId) {
            addCatalogNode(cnId);
            getOrderedCatalogSiblingIds(cnId, catalogNodes, order).forEach(visit);
        }

        let rootIds = getOrderedCatalogSiblingIds('', catalogNodes, order);
        if (!rootIds.length) {
            rootIds = (Core.getRootNodes?.(catalogNodes) || Core.getChildren?.(catalogNodes, '') || [])
                .map((n) => String(n.id || '').trim())
                .filter(Boolean);
        }
        rootIds.forEach(visit);
        return slots.map((s, idx) => ({ ...s, __idx: idx }));
    }

    function getTemplateDecisionSlotsFromWalk(tpl) {
        if (!tpl) return [];
        const Tree = global.UgapBoatTemplateTree;
        if (!Tree?.walkTemplateDecisionGroupRefs) return [];

        const data = resolveData();
        const categories = Array.isArray(data?.categories) ? data.categories : [];
        const optionById = Tree.buildCatalogueOptionById(categories);
        const catalogNodes = resolveCatalogNodesForRuntime();

        const entries = Tree.walkTemplateDecisionGroupRefs(tpl, {
            catalogNodes,
            optionById,
        });

        const slots = [];
        const seen = new Set();
        entries.forEach((entry) => {
            const resolved = entry?.resolved;
            const rawRef = entry?.rawRef;
            if (!resolved || resolved.missing) return;

            const catalogNodeId = String(resolved.catalogNodeId || rawRef?.catalogNodeId || '').trim();
            const groupId = String(resolved.groupId || '').trim();
            if (!catalogNodeId || !groupId) return;

            const nodeLabel = String(resolved.label || resolved.familyLabel || catalogNodeId).trim();
            const cat = {
                id: String(entry.nodeId || '').trim(),
                name: String(entry.categoryName || nodeLabel).trim(),
                objectName: String(entry.categoryName || nodeLabel).trim(),
            };
            const group = {
                id: groupId,
                groupId,
                catalogNodeId,
                label: nodeLabel,
                type: 'option',
                decisionMode: resolved.decisionMode || 'single_choice',
                optionIds: Array.isArray(resolved.optionIds) ? resolved.optionIds : [],
            };
            const slotRow = buildSlotRowFromGroup(
                cat,
                { catalogNodeId, catalogNodeLabel: nodeLabel },
                group,
                nodeLabel
            );
            if (!slotRow) return;
            const key = getSlotKey(slotRow);
            if (!key || seen.has(key)) return;
            seen.add(key);
            slots.push(slotRow);
        });
        return slots.map((s, idx) => ({ ...s, __idx: idx }));
    }

    function getTemplateDecisionSlots(tpl) {
        const fromCatalog = enumerateCatalogParcoursSlots(tpl);
        if (fromCatalog.length) return fromCatalog;
        return getTemplateDecisionSlotsFromWalk(tpl);
    }

    function getGroupOptionIdsForSlot(slot) {
        return resolveGroupOptionIdsForSlot(slot);
    }

    function optionMatchesSlot(optionId, slot) {
        const oid = String(optionId || '').trim();
        if (!oid || !slot) return false;
        const rec = findOptionRecord(oid)?.option;
        if (rec && isMinorationOption(rec)) return false;
        if (slot.fixedOptionId) return oid === String(slot.fixedOptionId).trim();
        return getGroupOptionIdsForSlot(slot).includes(oid);
    }

    function normalizePickIds(raw) {
        if (Array.isArray(raw)) {
            return raw.map((x) => String(x || '').trim()).filter(Boolean);
        }
        const one = String(raw || '').trim();
        return one ? [one] : [];
    }

    function getDecisionGroupForSlot(slot) {
        const fam = findFamilyForSlot(slot);
        if (!fam) return null;
        return resolveLiveGroupInFamily(
            fam,
            slot?.groupId,
            slot?.componentId
        );
    }

    function getSlotDecisionMode(slot) {
        const fromSlot = String(slot?.decisionMode || '').trim().toLowerCase();
        if (fromSlot === 'multi_choice') return 'multi_choice';
        const grp = getDecisionGroupForSlot(slot);
        return String(grp?.decisionMode || '').trim().toLowerCase() === 'multi_choice'
            ? 'multi_choice'
            : 'single_choice';
    }

    function isMultiChoiceSlot(slot) {
        return getSlotDecisionMode(slot) === 'multi_choice';
    }

    function getExplicitPickIds(modelId, slot) {
        const raw = readPickRawForSlot(modelId, slot);
        return normalizePickIds(raw).filter((oid) => {
            const rec = findOptionRecord(oid)?.option;
            if (!rec || !isCompatible(rec, modelId)) return false;
            return true;
        });
    }

    function persistSlotPicks(modelId, slot, raw) {
        const ids = normalizePickIds(raw);
        const st = global.UgapBateauBaseLcState;
        if (!st?.setModelBaseSlotPick) return;
        if (!ids.length) {
            st.setModelBaseSlotPick(modelId, getSlotKey(slot), []);
            return;
        }
        const value = isMultiChoiceSlot(slot) ? ids : ids[0];
        st.setModelBaseSlotPick(modelId, getSlotKey(slot), value);
    }

    /** Dans la liste du groupe : options déjà marquées option de base pour ce modèle. */
    function defaultBaseOptionIdsInSlot(modelId, slot) {
        const mid = String(modelId || '').trim();
        return getGroupOptionIdsForSlot(slot).filter((oid) => {
            const opt = findOptionRecord(oid)?.option;
            return opt && !isMinorationOption(opt) && isBaseForModel(oid, mid);
        });
    }

    function getAssignedOptionIds(modelId, slot) {
        const mid = String(modelId || '').trim();
        if (!mid || !slot) return [];
        if (runtimeContext?.presetExplicitOnly) {
            return getExplicitPickIds(mid, slot);
        }
        const explicit = getExplicitPickIds(mid, slot);
        if (explicit.length) return explicit;
        const defaults = defaultBaseOptionIdsInSlot(mid, slot);
        if (isMultiChoiceSlot(slot)) return defaults;
        return defaults.length ? [defaults[0]] : [];
    }

    function getAssignedOptionIdAuto(modelId, slot) {
        const ids = getAssignedOptionIds(modelId, slot);
        return ids.length ? ids[0] : '';
    }

    function getAssignedOptionId(modelId, slot) {
        const ids = getAssignedOptionIds(modelId, slot);
        return ids.length ? ids[0] : '';
    }

    /** Picks par défaut configurateur (= getAssignedOptionIds : picks enregistrés ou options taguées base). */
    function getConfiguratorDefaultPickIds(modelId, slot) {
        const mid = String(modelId || '').trim();
        if (!mid || !slot) return [];
        const assigned = getAssignedOptionIds(mid, slot)
            .map((x) => String(x || '').trim())
            .filter(Boolean);
        if (!assigned.length) return [];
        if (isMultiChoiceSlot(slot)) return [...new Set(assigned)];
        return [assigned[0]];
    }

    /** Options proposables : liées au nœud (ou groupe) et compatibles avec le modèle (poste P1, etc.). */
    function canOfferAsChoice(opt, modelId, slot) {
        if (!opt || isMinorationOption(opt)) return false;
        const mid = String(modelId || '').trim();
        if (!mid) return false;
        const oid = String(opt.id || '').trim();
        if (!getGroupOptionIdsForSlot(slot).includes(oid)) return false;
        return isCompatible(opt, mid);
    }

    function isSelectableBaseOption(opt, modelId) {
        if (!opt || typeof opt !== 'object') return false;
        const oid = String(opt.id || '').trim();
        if (isImportGeneratedBaseOption(opt)) return true;
        if (opt.manualBaseOption === true || opt.baseIncluded === true || opt.isBaseOption === true) return true;
        return isBaseForModel(oid, modelId);
    }

    /**
     * @param {{ baseOnly?: boolean }} [options] — parametrage : baseOnly true ; configurateur : false (toutes options du nœud).
     */
    function getChoiceRows(model, slot, options) {
        const modelId = String(model?.id || '').trim();
        const baseOnly = options && typeof options === 'object' ? options.baseOnly === true : false;
        const ids = new Set();
        getGroupOptionIdsForSlot(slot).forEach((oid) => {
            const opt = findOptionRecord(oid)?.option;
            if (!opt || !canOfferAsChoice(opt, modelId, slot)) return;
            if (baseOnly && !isSelectableBaseOption(opt, modelId)) return;
            ids.add(oid);
        });
        const baseIds = new Set(defaultBaseOptionIdsInSlot(modelId, slot));
        const models = Array.isArray(getData()?.models) ? getData().models : [];
        const ODN = global.UgapOptionDisplayName;
        return Array.from(ids).map((oid) => {
            const rec = findOptionRecord(oid)?.option || {};
            const displayName = ODN?.resolveOptionDisplayName
                ? ODN.resolveOptionDisplayName(rec, { models, modelId })
                : String(rec.name || oid).trim();
            const details = ODN?.resolveOptionDisplayDetails
                ? ODN.resolveOptionDisplayDetails(rec, displayName)
                : String(rec.details || '').trim();
            return {
                id: oid,
                name: String(displayName || rec.name || oid).trim(),
                refUgap: String(rec.baseRefUgap || rec.refUgap || '').trim(),
                details,
                isBaseOption: baseIds.has(oid),
            };
        }).sort((a, b) => {
            const aBase = a.isBaseOption ? 0 : 1;
            const bBase = b.isBaseOption ? 0 : 1;
            if (aBase !== bBase) return aBase - bBase;
            return a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' });
        });
    }

    function getOrderedCatalogSiblingIds(parentCatalogId, catalogNodes, orderMap) {
        const Core = global.UgapCatalogueNodesCore;
        const pid = String(parentCatalogId || '').trim();
        const defaultIds = (Core?.getChildren?.(catalogNodes, pid) || [])
            .map((n) => String(n.id || '').trim())
            .filter(Boolean);
        const order = orderMap && typeof orderMap === 'object' ? orderMap : {};
        const stored = Array.isArray(order[pid]) ? order[pid].map((x) => String(x || '').trim()).filter(Boolean) : [];
        if (!stored.length) return defaultIds;
        const valid = new Set(defaultIds);
        const out = [];
        stored.forEach((id) => {
            if (valid.has(id)) out.push(id);
        });
        defaultIds.forEach((id) => {
            if (!out.includes(id)) out.push(id);
        });
        return out;
    }

    function getTemplateCatalogParcours(tpl) {
        const snap = tpl?.snapshot && typeof tpl.snapshot === 'object' ? tpl.snapshot : {};
        const catalogNodes = resolveCatalogNodesForRuntime();
        const Tree = global.UgapBoatTemplateTree;
        let order = Tree?.normalizeCatalogNodeOrder?.(snap.catalogNodeOrder) || {};
        if (!Object.keys(order).length && Tree?.defaultCatalogNodeOrder) {
            order = Tree.defaultCatalogNodeOrder(catalogNodes);
        } else if (Tree?.mergeCatalogNodeOrder) {
            order = Tree.mergeCatalogNodeOrder(catalogNodes, order);
        }
        return { catalogNodes, order };
    }

    function resolveParcoursOrderForModel(model, tpl) {
        const mid = String(model?.id || '').trim();
        if (presetEditModelId && presetEditConfigId && mid === presetEditModelId) {
            return getConfigurationCatalogParcoursOrder(model, presetEditConfigId, tpl);
        }
        return getTemplateCatalogParcours(tpl).order;
    }

    /** Ordre parcours d’un parcours personnalisé (configuration) : template de base + surcharge utilisateur. */
    function getConfigurationCatalogParcoursOrder(model, configId, tpl) {
        const St = global.UgapBateauBaseLcState;
        const mid = String(model?.id || '').trim();
        const cid = String(configId || '').trim();
        if (mid && cid && St?.getMergedConfigurationCatalogNodeOrder) {
            const merged = St.getMergedConfigurationCatalogNodeOrder(mid, cid);
            if (merged?.order) return merged.order;
        }
        const baseOrder = getTemplateCatalogParcours(tpl).order;
        const cfg = resolveConfigurationById(mid, cid);
        const override = cfg?.catalogNodeOrder;
        if (!override || typeof override !== 'object' || !Object.keys(override).length) {
            return baseOrder;
        }
        const Tree = global.UgapBoatTemplateTree;
        let order = Tree?.normalizeCatalogNodeOrder?.({ ...baseOrder }) || { ...baseOrder };
        Object.keys(override).forEach((pid) => {
            if (Array.isArray(override[pid]) && override[pid].length) {
                order[pid] = override[pid].slice();
            }
        });
        if (Tree?.mergeCatalogNodeOrder) {
            const { catalogNodes } = getTemplateCatalogParcours(tpl);
            order = Tree.mergeCatalogNodeOrder(catalogNodes, order);
        }
        return order;
    }

    /**
     * Arbre parcours = miroir onglet Ordre des options (catalogNodeOrder + nœuds catalogue).
     * Réutilisable par le configurateur (même structure, choix différents).
     */
    function buildModelBaseEditorTree(model) {
        const status = getStatus(model);
        const slots = Array.isArray(status.slots) ? status.slots : [];
        const templateId = resolveBoatTemplateIdForModel(model);
        const tpl = getTemplateById(templateId);
        if (!tpl || !slots.length) {
            return { roots: [], orphanSlots: slots };
        }

        const slotsByCatalogId = new Map();
        const orphans = [];
        slots.forEach((slot) => {
            const cnId = catalogNodeIdFromSlot(slot);
            if (!cnId) {
                orphans.push(slot);
                return;
            }
            if (!slotsByCatalogId.has(cnId)) slotsByCatalogId.set(cnId, []);
            slotsByCatalogId.get(cnId).push(slot);
        });

        const { catalogNodes, order } = getTemplateCatalogParcours(tpl);
        const Core = global.UgapCatalogueNodesCore;
        if (!Core?.getChildren) {
            return { roots: [], orphanSlots: [...orphans, ...slots] };
        }
        if (!catalogNodes.length) {
            return { roots: [], orphanSlots: [...orphans, ...slots] };
        }

        function visitCatalogNode(catalogNodeId, depth) {
            const cnId = String(catalogNodeId || '').trim();
            if (!cnId) return null;
            const nodeSlots = slotsByCatalogId.get(cnId) || [];
            slotsByCatalogId.delete(cnId);

            const childIds = getOrderedCatalogSiblingIds(cnId, catalogNodes, order);
            const children = childIds
                .map((cid) => visitCatalogNode(cid, depth + 1))
                .filter(Boolean);

            if (!nodeSlots.length && !children.length) return null;

            const label = Core.nodeBreadcrumb?.(catalogNodes, cnId)
                || String(Core.getNodeById?.(catalogNodes, cnId)?.label || cnId).trim();
            return {
                nodeId: cnId,
                catalogNodeId: cnId,
                label,
                depth,
                slots: nodeSlots,
                children,
            };
        }

        let rootIds = getOrderedCatalogSiblingIds('', catalogNodes, order);
        if (!rootIds.length) {
            rootIds = (Core.getRootNodes?.(catalogNodes) || Core.getChildren?.(catalogNodes, '') || [])
                .map((n) => String(n.id || '').trim())
                .filter(Boolean);
        }

        const roots = rootIds.map((id) => visitCatalogNode(id, 0)).filter(Boolean);
        slotsByCatalogId.forEach((arr) => orphans.push(...arr));
        return { roots, orphanSlots: orphans };
    }

    function getStatus(model) {
        const modelId = String(model?.id || '').trim();
        const templateId = resolveBoatTemplateIdForModel(model, { userOnly: false });
        if (!templateId) {
            return { hasTemplate: false, isComplete: true, missingCount: 0, slots: [] };
        }
        const tpl = getTemplateById(templateId);
        const slots = getTemplateDecisionSlots(tpl).map((s, idx) => ({ ...s, __idx: idx }));
        let missingCount = 0;
        slots.forEach((slot) => {
            if (!getAssignedOptionIds(modelId, slot).length) missingCount += 1;
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

    function groupSlotsByComponent(slots) {
        const list = Array.isArray(slots) ? slots : [];
        return new Map([['', list]]);
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

    function stripOptionFromFamiliesList(families, optionId) {
        const oid = String(optionId || '').trim();
        return (Array.isArray(families) ? families : []).map((raw) => {
            const f = raw && typeof raw === 'object' ? { ...raw } : raw;
            if (!f || typeof f !== 'object') return raw;
            f.optionIds = (Array.isArray(f.optionIds) ? f.optionIds : [])
                .map((x) => String(x || '').trim())
                .filter((x) => x && x !== oid);
            const groups = normalizeGroups(f.decisionGroups || f.groups);
            if (groups.length) {
                f.decisionGroups = groups.map((g) => ({
                    ...g,
                    optionIds: (Array.isArray(g.optionIds) ? g.optionIds : [])
                        .map((x) => String(x || '').trim())
                        .filter((x) => x && x !== oid),
                }));
                delete f.components;
                return f;
            }
            return f;
        });
    }

    function addOptionToFamilyGroupFlat(family, optionId, groupId) {
        const oid = String(optionId || '').trim();
        const gid = String(groupId || '').trim();
        const f = family && typeof family === 'object' ? { ...family } : {};
        if (!oid || !gid) return f;
        f.optionIds = [...new Set([
            ...(Array.isArray(f.optionIds) ? f.optionIds : []).map((x) => String(x || '').trim()).filter(Boolean),
            oid,
        ])];
        const groups = normalizeGroups(f.decisionGroups || f.groups);
        f.decisionGroups = groups.map((g) => {
            const id = String(g?.id || g?.groupId || '').trim();
            if (id !== gid) return g;
            return {
                ...g,
                optionIds: [...new Set([
                    ...(Array.isArray(g.optionIds) ? g.optionIds : []).map((x) => String(x || '').trim()).filter(Boolean),
                    oid,
                ])],
            };
        });
        delete f.components;
        return f;
    }

    async function assignOptionToFamilyGroup(optionId, familyLabel, groupId, sourceIndex) {
        const oid = String(optionId || '').trim();
        const famLabel = String(familyLabel || '').trim();
        const gid = String(groupId || '').trim();
        if (!oid || !famLabel || !gid) return;
        let families = JSON.parse(JSON.stringify(global.UgapFamilleLcState?.getFamilies?.() || []));
        families = stripOptionFromFamiliesList(families, oid);
        const idx = Number(sourceIndex);
        let targetIdx = families.findIndex((f) => Number.isInteger(idx) && Number(f.__idx) === idx);
        if (targetIdx < 0) {
            targetIdx = families.findIndex((f) => {
                const root = familyRootLabel(f).toLowerCase();
                const lbl = String(f?.familyLabel || '').trim().toLowerCase();
                return root === famLabel.toLowerCase() || lbl === famLabel.toLowerCase();
            });
        }
        if (targetIdx < 0) return;
        const target = repairFamilyFlatGroups(families[targetIdx]);
        families[targetIdx] = addOptionToFamilyGroupFlat(target, oid, gid);
        const payload = families.map((f) => {
            const row = { ...f };
            delete row.__idx;
            delete row.components;
            return row;
        });
        const lc = global.UgapFamilleLcState;
        lc?.cancelScheduledPersist?.();
        if (lc?.replaceFamiliesOnServer) {
            await lc.replaceFamiliesOnServer(payload);
            return;
        }
        await lc?.waitForPersistIdle?.();
        lc?.setFamilies?.(families, { persist: false });
        await global.apiCall('/ui-state', {
            method: 'PUT',
            body: JSON.stringify({
                families: payload,
                familyGroupTypes: lc?.getCustomGroupTypes?.() || [],
                boatTemplates: getTemplates(),
                modelBaseSlotPicks: global.UgapBateauBaseLcState?.getModelBaseSlotPicks?.() || {},
            }),
        });
    }

    async function linkBaseOption(optionId, modelId, slot) {
        const rec = findOptionRecord(optionId)?.option;
        if (!rec) throw new Error('Option introuvable.');
        const mid = String(modelId || '').trim();
        const alreadyBase = !!rec.baseIncluded && isCompatible(rec, mid);
        let needFullUiPersist = false;
        const compatible = [...new Set([...(Array.isArray(rec.compatibleModels) ? rec.compatibleModels.map(String) : []), mid])];
        if (!alreadyBase || compatible.length !== (rec.compatibleModels || []).length) {
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
            needFullUiPersist = true;
        }
        const catalogNodeId = catalogNodeIdFromSlot(slot);
        if (catalogNodeId) {
            if (String(rec.catalogObjectId || '').trim() !== catalogNodeId) {
                const lc = global.UgapCatalogueLcState;
                if (lc?.updateOptionFields) {
                    await lc.updateOptionFields(optionId, { catalogObjectId: catalogNodeId });
                } else {
                    await global.apiCall(`/options/${encodeURIComponent(optionId)}`, {
                        method: 'PUT',
                        body: JSON.stringify({ catalogObjectId: catalogNodeId }),
                    });
                }
                rec.catalogObjectId = catalogNodeId;
                needFullUiPersist = true;
            }
        } else {
            const famLabel = String(slot?.familyLabel || '').trim();
            const fullFamily = slot?.groupLabel
                ? `${familyRootLabel(findFamilyForTemplateLabel(famLabel) || { familyLabel: famLabel })} / ${slot.groupLabel}`
                : famLabel;
            if (fullFamily && String(rec.familyLabel || '').trim() !== fullFamily) {
                await global.apiCall('/options/assign-families-bulk', {
                    method: 'POST',
                    body: JSON.stringify({ assignments: [{ optionId, familyLabel: fullFamily }] }),
                });
                rec.familyLabel = fullFamily;
                needFullUiPersist = true;
            }
            await assignOptionToFamilyGroup(
                optionId,
                famLabel,
                slot?.groupId,
                slot?.sourceIndex
            );
            needFullUiPersist = true;
        }
        return needFullUiPersist;
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

    function resolveConfigurationById(modelId, configId) {
        const mid = String(modelId || '').trim();
        const cid = String(configId || '').trim();
        if (!mid || !cid) return null;
        const fromState = global.UgapBateauBaseLcState?.getConfigurationById?.(mid, cid);
        if (fromState) return fromState;
        const data = getData();
        const list = data?.uiState?.modelConfigurations?.[mid];
        if (!Array.isArray(list)) return null;
        const hit = list.find((c) => String(c?.id || '').trim() === cid);
        if (!hit) return null;
        return {
            id: cid,
            label: String(hit.label || 'Configuration').trim() || 'Configuration',
            isDefault: hit.isDefault === true,
            slotPicks: hit.slotPicks && typeof hit.slotPicks === 'object' ? hit.slotPicks : {},
            catalogNodeOrder: hit.catalogNodeOrder && typeof hit.catalogNodeOrder === 'object' ? hit.catalogNodeOrder : {},
        };
    }

    function setPresetEditContext(modelId, configId) {
        const mid = String(modelId || '').trim();
        const cid = String(configId || '').trim();
        if (!mid || !cid) {
            clearConfiguratorContext();
            return;
        }
        presetEditModelId = mid;
        presetEditConfigId = cid;
        runtimeContext = mergePresetEditLayer(runtimeContext) || {
            presetExplicitOnly: true,
            getModelBaseSlotPicks: () => {
                const cfg = resolveConfigurationById(mid, cid);
                const picks = cfg?.slotPicks && typeof cfg.slotPicks === 'object' ? cfg.slotPicks : {};
                return { [mid]: { ...picks } };
            },
        };
    }

    function getConfigurationStatus(model, configId) {
        const modelId = String(model?.id || '').trim();
        const status = getStatus(model);
        const cfg = resolveConfigurationById(modelId, configId);
        if (!cfg) {
            return { filledCount: 0, totalSlots: status.slots.length, label: '' };
        }
        setPresetEditContext(modelId, configId);
        let filledCount = 0;
        status.slots.forEach((slot) => {
            if (getExplicitPickIds(modelId, slot).length) filledCount += 1;
        });
        clearConfiguratorContext();
        return {
            filledCount,
            totalSlots: status.slots.length,
            label: cfg.label,
            isDefault: cfg.isDefault === true,
        };
    }

    async function pickPresetOption(modelId, configId, slotIdx, optionId) {
        const st = global.UgapBateauBaseLcState;
        const mid = String(modelId || '').trim();
        const cid = String(configId || '').trim();
        const data = getData();
        const model = (Array.isArray(data?.models) ? data.models : []).find((m) => String(m?.id) === mid);
        const status = getStatus(model);
        const slot = status.slots[Number(slotIdx)];
        const oid = String(optionId || '').trim();
        if (!model || !slot || !oid || !cid) return;

        setPresetEditContext(mid, cid);
        if (isMultiChoiceSlot(slot)) {
            let current = getExplicitPickIds(mid, slot);
            if (current.includes(oid)) return;
            st?.setConfigurationSlotPick?.(mid, cid, getSlotKey(slot), [...current, oid]);
        } else {
            st?.setConfigurationSlotPick?.(mid, cid, getSlotKey(slot), oid);
        }
        if (st?.persistModelConfigurationsOnly) {
            const ok = await st.persistModelConfigurationsOnly();
            if (!ok) throw new Error('Les choix n’ont pas pu être enregistrés.');
        }
    }

    async function togglePresetOption(modelId, configId, slotIdx, optionId, selected) {
        const st = global.UgapBateauBaseLcState;
        const mid = String(modelId || '').trim();
        const cid = String(configId || '').trim();
        const data = getData();
        const model = (Array.isArray(data?.models) ? data.models : []).find((m) => String(m?.id) === mid);
        const status = getStatus(model);
        const slot = status.slots[Number(slotIdx)];
        const oid = String(optionId || '').trim();
        if (!model || !slot || !oid || !cid || !isMultiChoiceSlot(slot)) return;

        setPresetEditContext(mid, cid);
        let current = getExplicitPickIds(mid, slot);
        if (selected) {
            if (current.includes(oid)) return;
            st?.setConfigurationSlotPick?.(mid, cid, getSlotKey(slot), [...current, oid]);
        } else {
            st?.setConfigurationSlotPick?.(mid, cid, getSlotKey(slot), current.filter((id) => id !== oid));
        }
        if (st?.persistModelConfigurationsOnly) {
            const ok = await st.persistModelConfigurationsOnly();
            if (!ok) throw new Error('Les choix n’ont pas pu être enregistrés.');
        }
    }

    async function clearPresetSlotPick(modelId, configId, slot) {
        const st = global.UgapBateauBaseLcState;
        const mid = String(modelId || '').trim();
        const cid = String(configId || '').trim();
        const key = getSlotKey(slot);
        if (!mid || !cid || !key) return;
        st?.setConfigurationSlotPick?.(mid, cid, key, []);
        if (st?.persistModelConfigurationsOnly) {
            const ok = await st.persistModelConfigurationsOnly();
            if (!ok) throw new Error('Les choix n’ont pas pu être enregistrés.');
        }
    }

    async function pickBaseOption(modelId, slotIdx, optionId) {
        const st = global.UgapBateauBaseLcState;
        let needFullUiPersist = false;
        if (st?.setSuppressPersist) st.setSuppressPersist(true);
        try {
            const data = getData();
            const model = (Array.isArray(data?.models) ? data.models : []).find((m) => String(m?.id) === String(modelId));
            const status = getStatus(model);
            const slot = status.slots[Number(slotIdx)];
            const oid = String(optionId || '').trim();
            if (!model || !slot || !oid) return;
            if (isMultiChoiceSlot(slot)) {
                let current = getExplicitPickIds(modelId, slot);
                if (!current.length) current = getAssignedOptionIds(modelId, slot);
                if (current.includes(oid)) return;
                needFullUiPersist = await linkBaseOption(oid, modelId, slot) === true;
                persistSlotPicks(modelId, slot, [...current, oid]);
                return;
            }
            await clearCompeting(modelId, slot, oid);
            needFullUiPersist = await linkBaseOption(oid, modelId, slot) === true;
            persistSlotPicks(modelId, slot, oid);
        } finally {
            if (st?.setSuppressPersist) st.setSuppressPersist(false);
            if (needFullUiPersist && st?.persistToServer) {
                await st.persistToServer();
            } else if (st?.persistModelBaseSlotPicksOnly) {
                const ok = await st.persistModelBaseSlotPicksOnly();
                if (!ok) throw new Error('Les choix n’ont pas pu être enregistrés.');
            }
        }
    }

    async function toggleBaseOption(modelId, slotIdx, optionId, selected) {
        const st = global.UgapBateauBaseLcState;
        let needFullUiPersist = false;
        if (st?.setSuppressPersist) st.setSuppressPersist(true);
        try {
            const data = getData();
            const model = (Array.isArray(data?.models) ? data.models : []).find((m) => String(m?.id) === String(modelId));
            const status = getStatus(model);
            const slot = status.slots[Number(slotIdx)];
            const oid = String(optionId || '').trim();
            if (!model || !slot || !oid || !isMultiChoiceSlot(slot)) return;

            let current = getExplicitPickIds(modelId, slot);
            if (!current.length) {
                const seeded = getAssignedOptionIds(modelId, slot);
                if (seeded.length) {
                    current = seeded;
                    persistSlotPicks(modelId, slot, seeded);
                }
            }

            if (selected) {
                if (current.includes(oid)) return;
                needFullUiPersist = await linkBaseOption(oid, modelId, slot) === true;
                persistSlotPicks(modelId, slot, [...current, oid]);
                return;
            }
            persistSlotPicks(modelId, slot, current.filter((id) => id !== oid));
        } finally {
            if (st?.setSuppressPersist) st.setSuppressPersist(false);
            if (needFullUiPersist && st?.persistToServer) {
                await st.persistToServer();
            } else if (st?.persistModelBaseSlotPicksOnly) {
                const ok = await st.persistModelBaseSlotPicksOnly();
                if (!ok) throw new Error('Les choix n’ont pas pu être enregistrés.');
            }
        }
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
        const details = String(payload?.details || '').trim();
        const priceN = Number(String(payload?.price ?? '').replace(',', '.'));
        const baseIncludedPrice = Number.isFinite(priceN) ? priceN : 0;
        if (!model || !slot || !name) throw new Error('Données invalides.');
        const catalogNodeId = catalogNodeIdFromSlot(slot);
        if (!catalogNodeId) {
            throw new Error('Groupe non lié au catalogue — enregistrez l’ordre des options (parcours catalogue).');
        }
        const categoryId = String(data?.categories?.[0]?.id || '').trim();
        if (!categoryId) throw new Error('Aucune catégorie import (données /data).');
        const nodeLabel = String(slot.catalogNodeLabel || slot.groupLabel || '').trim();
        const id = nextManualOptionId();
        const mid = String(modelId || '').trim();
        const rawCompatible = Array.isArray(payload?.compatibleModelIds) ? payload.compatibleModelIds : [];
        const compatibleModels = rawCompatible.map((x) => String(x || '').trim()).filter(Boolean);
        if (!compatibleModels.length && mid) compatibleModels.push(mid);
        const pricesRaw = payload?.pricesByModelId && typeof payload.pricesByModelId === 'object'
            ? payload.pricesByModelId
            : {};
        const importBaseProductPricesByModelId = {};
        compatibleModels.forEach((cid) => {
            const v = Number(pricesRaw[cid]);
            importBaseProductPricesByModelId[cid] = Number.isFinite(v) ? v : baseIncludedPrice;
        });
        const priceVals = compatibleModels
            .map((cid) => importBaseProductPricesByModelId[cid])
            .filter((v) => Number.isFinite(v));
        const distinct = [...new Set(priceVals.map((v) => Number(v.toFixed(2))))];
        const pricingMode = String(payload?.pricingMode || '').trim() === 'per_model'
            || (distinct.length > 1)
            ? 'per_model'
            : 'fixed';
        const body = {
            id,
            categoryId,
            name,
            refUgap,
            baseRefUgap: refUgap,
            compatibleModels,
            catalogObjectId: catalogNodeId,
            manualBaseOption: true,
            baseIncluded: true,
            isBaseOption: true,
            baseIncludedPrice: distinct.length === 1 ? distinct[0] : baseIncludedPrice,
            priceUgap: distinct.length === 1 ? distinct[0] : baseIncludedPrice,
            priceClient: 0,
            importBaseProductPricingMode: pricingMode,
        };
        if (nodeLabel) body.importOptionLabel = nodeLabel;
        if (details) {
            body.details = details;
            body.importExcelLabel = details;
        }
        if (pricingMode === 'per_model' && Object.keys(importBaseProductPricesByModelId).length) {
            body.importBaseProductPricesByModelId = importBaseProductPricesByModelId;
        }
        await global.apiCall('/options', {
            method: 'POST',
            body: JSON.stringify(body),
        });
        await reloadData();
        if (isMultiChoiceSlot(slot)) {
            let current = getExplicitPickIds(modelId, slot);
            if (!current.length) current = getAssignedOptionIds(modelId, slot);
            await linkBaseOption(id, modelId, slot);
            persistSlotPicks(modelId, slot, [...current, id]);
        } else {
            await clearCompeting(modelId, slot, id);
            await linkBaseOption(id, modelId, slot);
            persistSlotPicks(modelId, slot, id);
        }
        return id;
    }

    global.UgapModelBaseOptions = {
        getData,
        getCatalogNodesForRuntime: resolveCatalogNodesForRuntime,
        getTemplates,
        getTemplateLabel,
        getTemplateById,
        resolveBoatTemplateIdForModel,
        resolveBoatTemplateForModel,
        getAssignableGroupsForFamily,
        getStatus,
        getConfigurationStatus,
        getChoiceRows,
        getAssignedOptionId,
        getAssignedOptionIds,
        getExplicitPickIds,
        getConfiguratorDefaultPickIds,
        isMultiChoiceSlot,
        groupSlotsByFamily,
        groupSlotsByComponent,
        buildModelBaseEditorTree,
        enumerateCatalogParcoursSlots,
        getTemplateCatalogParcours,
        getConfigurationCatalogParcoursOrder,
        resolveParcoursOrderForModel,
        getOrderedCatalogSiblingIds,
        assignBoatTemplate,
        pickBaseOption,
        pickPresetOption,
        togglePresetOption,
        clearPresetSlotPick,
        toggleBaseOption,
        createBaseOption,
        reloadData,
        getSlotKey,
        formatSlotTitle,
        setConfiguratorContext,
        setPresetEditContext,
        clearConfiguratorContext,
        isMotorTarifName,
        isImportGeneratedBaseOption,
        isBaseForModel,
        optionMatchesSlot,
        findOptionRecord,
    };
})(window);
