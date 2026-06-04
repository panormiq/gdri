/**
 * Famille → Composant(s) → Groupes de décision.
 * Normalisation ui-state et helpers d’affectation options.
 */
(function initUgapFamilyComponents(global) {
    'use strict';

    const DEFAULT_COMPONENT_ID = 'principal';
    const DEFAULT_COMPONENT_LABEL = 'Principal';

    function slugify(input) {
        return String(input || '')
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]+/g, '_')
            .replace(/^_+|_+$/g, '');
    }

    function parseIdVersion(id) {
        const full = String(id || '').trim();
        const m = full.match(/^(.*)_(\d+)$/);
        if (m && m[1]) {
            return { full, base: m[1], version: parseInt(m[2], 10) || 0 };
        }
        return { full, base: full, version: 0 };
    }

    function idVersionRank(id) {
        return parseIdVersion(id).version;
    }

    function pickLatestId(ids) {
        const list = (Array.isArray(ids) ? ids : [])
            .map((x) => String(x || '').trim())
            .filter(Boolean);
        if (!list.length) return '';
        return list.reduce((best, cur) => (idVersionRank(cur) >= idVersionRank(best) ? cur : best));
    }

    function idBase(id) {
        return parseIdVersion(id).base;
    }

    /** Ancien id composant (principal, template) — ne plus exiger une correspondance exacte. */
    function isLegacyComponentHint(componentIdHint) {
        const c = slugify(String(componentIdHint || '').trim());
        return !c || c === 'principal' || c === 'composant' || c === 'default' || c === 'main';
    }

    function flatGroupMatchesGidHint(flatGroup, groupIdHint) {
        const gid = String(groupIdHint || '').trim();
        if (!gid) return false;
        const gId = String(flatGroup?.groupId || flatGroup?.id || '').trim();
        if (!gId) return false;
        if (gId === gid) return true;
        if (idBase(gId) === idBase(gid)) return true;
        if (['model', 'garantie', 'option_catalogue', 'static'].includes(gid)
            && normalizeGroupType(flatGroup?.type) === normalizeGroupType(gid)) {
            return true;
        }
        return false;
    }

    function pickBestFlatGroup(family, candidates, componentIdHint) {
        let list = Array.isArray(candidates) ? candidates.slice() : [];
        if (!list.length) return null;
        const cid = String(componentIdHint || '').trim();
        if (cid && !isLegacyComponentHint(cid)) {
            const comp = findComponent(family, cid);
            const wantId = comp ? String(comp.id || '').trim() : cid;
            const filtered = list.filter((g) => String(g.componentId || '').trim() === wantId);
            if (filtered.length) list = filtered;
        } else if (isLegacyComponentHint(cid)) {
            const comps = getComponents(family);
            if (comps.length === 1) {
                const only = String(comps[0].id || '').trim();
                list = list.filter((g) => String(g.componentId || '').trim() === only);
            }
        }
        if (!list.length) return null;
        if (list.length === 1) return list[0];
        return list.reduce((best, g) => (
            idVersionRank(String(g.groupId || g.id || ''))
                >= idVersionRank(String(best.groupId || best.id || ''))
                ? g
                : best
        ));
    }

    function flatHitToResolved(family, hit) {
        const gid = String(hit?.groupId || hit?.id || '').trim();
        const cid = String(hit?.componentId || '').trim();
        const comp = findComponent(family, cid);
        const group = comp
            ? normalizeGroups(comp.decisionGroups).find((g) => String(g.id || g.groupId) === gid)
            : null;
        return {
            component: comp,
            group: group || hit,
            componentId: cid,
            groupId: gid
        };
    }

    function tokenizeKeywords(raw) {
        return String(raw || '')
            .split(/[,;|]+/)
            .map((s) => String(s || '').trim())
            .filter(Boolean);
    }

    function nameMatchesKeyword(name, keyword) {
        const n = slugify(name);
        const k = slugify(keyword);
        return !!k && n.includes(k);
    }

    function normalizeGroups(raw) {
        const FDG = global.UgapFamilyDecisionGroup;
        if (FDG?.normalizeList) return FDG.normalizeList(raw);
        if (typeof global.normalizeFamilyDecisionGroups === 'function') {
            return global.normalizeFamilyDecisionGroups(raw);
        }
        return Array.isArray(raw) ? raw : [];
    }

    function defaultGroupsForComponent() {
        const FDG = global.UgapFamilyDecisionGroup;
        if (FDG?.defaultCreateGroups) return FDG.defaultCreateGroups();
        return [
            { id: 'model', label: 'Modèle', type: 'model', decisionMode: 'single_choice', priceMode: 'option', keywords: '' },
            { id: 'option_catalogue', label: 'Option catalogue', type: 'option', decisionMode: 'multi_choice', priceMode: 'option', keywords: '' },
            { id: 'garantie', label: 'Garantie', type: 'garantie', decisionMode: 'single_choice', priceMode: 'option', keywords: '' }
        ];
    }

    function resolveDefaultDecisionGroupId(groups, preferredId) {
        const list = normalizeGroups(groups);
        const ids = list.map((g) => String(g?.id || '').trim()).filter(Boolean);
        const pref = String(preferredId || '').trim();
        if (pref && ids.includes(pref)) return pref;
        const optionGroup = list.find((g) => String(g?.type || '') === 'option');
        if (optionGroup?.id) return String(optionGroup.id).trim();
        return ids[0] || null;
    }

    function generateId(prefix, existingIds) {
        const set = new Set((existingIds || []).map((x) => String(x).trim()).filter(Boolean));
        let n = 1;
        while (set.has(`${prefix}_${n}`)) n += 1;
        return `${prefix}_${n}`;
    }

    function newComponent({ label, keyword, id } = {}) {
        const groups = defaultGroupsForComponent();
        const compId = String(id || '').trim() || slugify(label) || DEFAULT_COMPONENT_ID;
        return {
            id: compId,
            label: String(label || DEFAULT_COMPONENT_LABEL).trim() || DEFAULT_COMPONENT_LABEL,
            keyword: String(keyword || '').trim(),
            defaultDecisionGroupId: resolveDefaultDecisionGroupId(groups, 'option_catalogue'),
            decisionGroups: groups
        };
    }

    function normalizeComponent(raw, index) {
        const row = raw && typeof raw === 'object' ? raw : {};
        const label = String(row.label || row.name || '').trim()
            || (index === 0 ? DEFAULT_COMPONENT_LABEL : `Composant ${index + 1}`);
        const id = String(row.id || '').trim() || slugify(label) || generateId('composant', []);
        let groups = normalizeGroups(row.decisionGroups);
        if (!groups.length) groups = defaultGroupsForComponent();
        const defaultDecisionGroupId = resolveDefaultDecisionGroupId(
            groups,
            row.defaultDecisionGroupId
        );
        return {
            id,
            label,
            keyword: String(row.keyword || row.componentKeyword || '').trim(),
            defaultDecisionGroupId,
            decisionGroups: groups
        };
    }

    /** Pousse decisionGroups racine vers un composant unique si besoin. */
    function ensureComponentsArray(family) {
        const f = family && typeof family === 'object' ? { ...family } : {};
        let components = Array.isArray(f.components) ? f.components.map(normalizeComponent) : [];
        if (!components.length) {
            const legacyGroups = normalizeGroups(f.decisionGroups);
            const legacyKeyword = String(f.componentKeyword || '').trim();
            if (legacyGroups.length) {
                components = [normalizeComponent({
                    id: DEFAULT_COMPONENT_ID,
                    label: DEFAULT_COMPONENT_LABEL,
                    keyword: legacyKeyword,
                    defaultDecisionGroupId: f.defaultDecisionGroupId,
                    decisionGroups: legacyGroups
                }, 0)];
            } else {
                components = [newComponent({ id: DEFAULT_COMPONENT_ID, label: DEFAULT_COMPONENT_LABEL })];
            }
        }
        f.components = components;
        delete f.decisionGroups;
        delete f.defaultDecisionGroupId;
        return f;
    }

    function syncOptionsToComponents(family) {
        const f = ensureComponentsArray(family);
        const idsFromGroups = new Set();
        f.components.forEach((comp) => {
            normalizeGroups(comp.decisionGroups).forEach((g) => {
                (Array.isArray(g.optionIds) ? g.optionIds : []).forEach((x) => {
                    const id = String(x || '').trim();
                    if (id) idsFromGroups.add(id);
                });
            });
        });
        const familyOptionIds = [...new Set([
            ...(Array.isArray(f.optionIds) ? f.optionIds : [])
                .map((x) => String(x || '').trim())
                .filter(Boolean),
            ...idsFromGroups
        ])];
        const familyOptionSet = new Set(familyOptionIds);

        f.components = f.components.map((comp) => {
            const c = { ...comp };
            let groups = normalizeGroups(c.decisionGroups);
            groups = groups.map((g) => {
                const rawIds = (Array.isArray(g.optionIds) ? g.optionIds : [])
                    .map((x) => String(x || '').trim())
                    .filter(Boolean);
                const ids = familyOptionSet.size
                    ? rawIds.filter((x) => familyOptionSet.has(x))
                    : rawIds;
                return { ...g, optionIds: ids };
            });
            c.decisionGroups = groups;
            c.defaultDecisionGroupId = resolveDefaultDecisionGroupId(groups, c.defaultDecisionGroupId);
            return c;
        });
        f.optionIds = familyOptionIds;
        return f;
    }

    function componentMergeKey(comp) {
        const lab = slugify(comp?.label);
        if (lab && lab !== 'principal' && lab !== 'composant') return `lab:${lab}`;
        return `id:${idBase(String(comp?.id || ''))}`;
    }

    function groupMergeKey(group) {
        const type = normalizeGroupType(group?.type);
        if (type === 'model' || type === 'garantie' || type === 'static') return `type:${type}`;
        const gid = String(group?.id || group?.groupId || '').trim();
        if (gid === 'option_catalogue') return 'type:option_catalogue';
        const lab = slugify(group?.label);
        if (lab) return `lab:${lab}`;
        return `id:${idBase(gid)}`;
    }

    /**
     * Fusionne composants / groupes en double (ex. model + model_8) : conserve l’id le plus récent (_N le plus élevé).
     */
    function dedupeFamilyStructure(family) {
        const warnings = [];
        let changed = false;
        const f = ensureComponentsArray(family);

        const compBuckets = new Map();
        f.components.forEach((comp) => {
            const key = componentMergeKey(comp);
            if (!compBuckets.has(key)) compBuckets.set(key, []);
            compBuckets.get(key).push(comp);
        });

        const mergedComponents = [];
        compBuckets.forEach((list) => {
            const keptId = pickLatestId(list.map((c) => String(c.id || '')));
            if (list.length > 1) {
                const dropped = list
                    .map((c) => String(c.id || '').trim())
                    .filter((id) => id && id !== keptId);
                warnings.push(
                    `Composants dupliqués fusionnés → « ${keptId} » (retirés : ${dropped.join(', ')})`
                );
                changed = true;
            }
            const base = list.find((c) => String(c.id) === keptId) || list[0];
            const merged = { ...base, id: keptId };
            let allGroups = [];
            list.forEach((c) => {
                allGroups = allGroups.concat(normalizeGroups(c.decisionGroups));
            });
            merged.decisionGroups = allGroups;
            mergedComponents.push(merged);
        });

        mergedComponents.forEach((comp) => {
            const buckets = new Map();
            normalizeGroups(comp.decisionGroups).forEach((g) => {
                const key = groupMergeKey(g);
                if (!buckets.has(key)) buckets.set(key, []);
                buckets.get(key).push(g);
            });
            const newGroups = [];
            buckets.forEach((list, key) => {
                const keptId = pickLatestId(list.map((g) => String(g.id || g.groupId || '')));
                const unionIds = new Set();
                list.forEach((g) => {
                    (Array.isArray(g.optionIds) ? g.optionIds : []).forEach((id) => {
                        const s = String(id || '').trim();
                        if (s) unionIds.add(s);
                    });
                });
                if (list.length > 1) {
                    const dropped = list
                        .map((g) => String(g.id || g.groupId || '').trim())
                        .filter((id) => id && id !== keptId);
                    warnings.push(
                        `Groupes dupliqués [${comp.label || comp.id}] (${key}) → « ${keptId} » (retirés : ${dropped.join(', ')})`
                    );
                    changed = true;
                }
                const kept = list.find((g) => String(g.id || g.groupId) === keptId) || list[0];
                newGroups.push({
                    ...kept,
                    id: keptId,
                    groupId: keptId,
                    optionIds: Array.from(unionIds)
                });
            });
            comp.decisionGroups = newGroups;
            const def = String(comp.defaultDecisionGroupId || '').trim();
            if (def && !newGroups.some((g) => String(g.id) === def)) {
                const fallback = String(newGroups[0]?.id || '').trim();
                if (fallback) {
                    comp.defaultDecisionGroupId = fallback;
                    warnings.push(
                        `Groupe par défaut du composant « ${comp.label || comp.id} » réaligné sur « ${fallback} ».`
                    );
                    changed = true;
                }
            }
        });

        f.components = mergedComponents;
        const synced = syncOptionsToComponents(f);
        if (warnings.length) synced.structureWarnings = warnings;
        return { family: synced, warnings, changed };
    }

    function normalizeFamily(raw, index) {
        const row = raw && typeof raw === 'object' ? { ...raw } : {};
        const familyLabel = String(row.familyLabel || '').trim();
        if (!familyLabel) return null;
        row.__idx = Number.isInteger(row.__idx) ? row.__idx : index;
        const { family: deduped, warnings } = dedupeFamilyStructure(row);
        const out = {
            familyLabel,
            familyKeyword: String(row.familyKeyword || row.objectName || row.familyKeywords || '').trim(),
            objectName: String(row.objectName || row.familyKeyword || '').trim(),
            optionIds: Array.isArray(deduped.optionIds) ? deduped.optionIds : [],
            components: deduped.components,
            defaultOptionId: row.defaultOptionId != null ? String(row.defaultOptionId).trim() : undefined,
            __idx: deduped.__idx
        };
        if (warnings.length) out.structureWarnings = warnings;
        return out;
    }

    function normalizeFamilyList(list) {
        return (Array.isArray(list) ? list : [])
            .map((f, i) => normalizeFamily(f, i))
            .filter(Boolean);
    }

    /** Clé select (componentId::groupId) pour une option déjà placée dans un groupe. */
    function findOptionSelectionKeyInFamily(optionId, family) {
        const oid = String(optionId || '').trim();
        if (!oid || !family) return '';
        const flat = flattenDecisionGroups(family);
        const hit = flat.find((g) =>
            (Array.isArray(g.optionIds) ? g.optionIds : []).some((id) => String(id) === oid)
        );
        return hit ? groupSelectionKey(hit) : '';
    }

    function flattenDecisionGroups(family) {
        const f = ensureComponentsArray(family);
        const out = [];
        f.components.forEach((comp) => {
            normalizeGroups(comp.decisionGroups).forEach((g) => {
                const groupId = String(g?.id || g?.groupId || '').trim();
                if (!groupId) return;
                const optionIds = (Array.isArray(g.optionIds) ? g.optionIds : [])
                    .map((x) => String(x || '').trim())
                    .filter(Boolean);
                const preservedCompLabel = String(g.componentLabel || '').trim();
                out.push({
                    ...g,
                    componentId: String(comp.id || '').trim(),
                    componentLabel: preservedCompLabel || comp.label,
                    componentKeyword: String(g.componentKeyword || comp.keyword || '').trim(),
                    familyLabel: String(f.familyLabel || '').trim(),
                    groupId,
                    label: String(g.label || groupId).trim()
                });
            });
        });
        return out;
    }

    function getComponents(family) {
        return ensureComponentsArray(family).components;
    }

    function findComponent(family, componentId) {
        const id = String(componentId || '').trim();
        const components = getComponents(family);
        if (!id) return null;
        let hit = components.find((c) => String(c.id) === id);
        if (hit) return hit;
        const want = slugify(id);
        if (!want) return null;
        return components.find((c) => {
            const cid = slugify(c.id);
            const clab = slugify(c.label);
            return cid === want || clab === want;
        }) || null;
    }

    function findGroupInFamily(family, componentId, groupId) {
        const comp = findComponent(family, componentId);
        if (!comp) return null;
        const gid = String(groupId || '').trim();
        const group = normalizeGroups(comp.decisionGroups).find((g) => {
            const gId = String(g?.id || g?.groupId || '').trim();
            return gId === gid;
        });
        if (!group) return null;
        return { component: comp, group };
    }

    function groupRefKey(ref) {
        const fam = String(ref?.familyLabel || '').trim().toLowerCase();
        const comp = String(ref?.componentId || '').trim().toLowerCase();
        const grp = String(ref?.groupId || '').trim().toLowerCase();
        return comp ? `${fam}::${comp}::${grp}` : `${fam}::${grp}`;
    }

    function slotKeyFromGroup(group) {
        const g = group && typeof group === 'object' ? group : {};
        const cat = String(g.categoryName || '').trim().toLowerCase();
        const fam = String(g.familyLabel || '').trim().toLowerCase();
        const comp = String(g.componentId || '').trim().toLowerCase();
        const grp = String(g.groupId || g.id || '').trim().toLowerCase();
        const base = comp ? `${fam}::${comp}::${grp}` : `${fam}::${grp}`;
        return cat ? `${cat}::${base}` : base;
    }

    function parseSlotKey(key) {
        const parts = String(key || '').split('::').map((p) => p.trim()).filter(Boolean);
        if (parts.length >= 4) {
            return {
                categoryName: parts[0],
                familyLabel: parts[1],
                componentId: parts[2],
                groupId: parts[3]
            };
        }
        if (parts.length >= 3) {
            return { categoryName: '', familyLabel: parts[0], componentId: parts[1], groupId: parts[2] };
        }
        if (parts.length === 2) {
            return { categoryName: '', familyLabel: parts[0], componentId: '', groupId: parts[1] };
        }
        return { categoryName: '', familyLabel: '', componentId: '', groupId: '' };
    }

    /** Clé de sélection catégorie / template (évite collision option_catalogue entre composants). */
    function groupSelectionKey(group) {
        const g = group && typeof group === 'object' ? group : {};
        const groupId = String(g.groupId || g.id || '').trim();
        const componentId = String(g.componentId || '').trim();
        if (!groupId) return '';
        return componentId ? `${componentId}::${groupId}` : groupId;
    }

    function parseGroupSelectionKey(key) {
        const raw = String(key || '').trim();
        if (!raw) return { componentId: '', groupId: '' };
        const parts = raw.split('::').map((p) => p.trim()).filter(Boolean);
        if (parts.length >= 2) {
            return { componentId: parts[0], groupId: parts.slice(1).join('::') };
        }
        return { componentId: '', groupId: raw };
    }

    function normalizeGroupType(raw) {
        const FDG = global.UgapFamilyDecisionGroup;
        if (FDG?.normalizeType) return FDG.normalizeType(raw);
        const t = slugify(String(raw || ''));
        if (t === 'model' || t === 'modele') return 'model';
        if (t === 'garantie' || t === 'garanties') return 'garantie';
        if (t === 'static') return 'static';
        return t || 'option';
    }

    function componentIdsMatch(family, idA, idB) {
        const a = String(idA || '').trim();
        const b = String(idB || '').trim();
        if (!a || !b) return !a && !b;
        return a === b;
    }

    /** Compare une clé select (UI) à un groupe aplati (ids stockés). */
    function groupMatchesSelectionKey(group, selectedKey) {
        const sel = String(selectedKey || '').trim();
        if (!sel) return false;
        if (groupSelectionKey(group) === sel) return true;
        const parsed = parseGroupSelectionKey(sel);
        const cid = String(group?.componentId || '').trim();
        if (parsed.groupId && flatGroupMatchesGidHint(group, parsed.groupId)) {
            if (!parsed.componentId) return true;
            if (cid === parsed.componentId) return true;
            if (slugify(cid) === slugify(parsed.componentId)) return true;
            if (isLegacyComponentHint(parsed.componentId)) return true;
        }
        if (!sel.includes('::') && flatGroupMatchesGidHint(group, sel)) return true;
        return false;
    }

    function selectionKeyMatchesGroup(selectedKey, group) {
        return groupMatchesSelectionKey(group, selectedKey);
    }

    /**
     * Normalise une valeur de liste déroulante vers la clé canonique componentId::groupId.
     */
    function resolveSelectionKeyForFamily(family, selectionKey) {
        const raw = String(selectionKey || '').trim();
        if (!raw) {
            return { ok: true, key: '', componentId: '', groupId: '', groupMeta: null };
        }
        const flat = flattenDecisionGroups(family);
        const parsed = parseGroupSelectionKey(raw);
        let hit = flat.find((g) => groupSelectionKey(g) === raw);
        if (!hit) {
            const candidates = flat.filter((g) => groupMatchesSelectionKey(g, raw));
            hit = pickBestFlatGroup(family, candidates, parsed.componentId);
        }
        if (!hit) {
            const resolved = resolveGroupInFamily(family, parsed.componentId, parsed.groupId);
            if (resolved?.componentId && resolved?.groupId) {
                hit = flat.find(
                    (g) => String(g.componentId || '') === resolved.componentId
                        && String(g.groupId || g.id || '') === resolved.groupId
                ) || {
                    componentId: resolved.componentId,
                    groupId: resolved.groupId,
                    id: resolved.groupId,
                    label: String(resolved.group?.label || resolved.groupId).trim(),
                    type: resolved.group?.type,
                    decisionMode: resolved.group?.decisionMode
                };
            }
        }
        if (!hit) return { ok: false, key: raw, reason: 'unresolved_group' };
        const key = groupSelectionKey(hit);
        return {
            ok: true,
            key,
            componentId: String(hit.componentId || '').trim(),
            groupId: String(hit.groupId || hit.id || '').trim(),
            groupMeta: hit
        };
    }

    function findFamilyContainingOption(families, optionId) {
        const oid = String(optionId || '').trim();
        if (!oid) return null;
        const list = Array.isArray(families) ? families : [];
        for (const family of list) {
            if (findOptionSelectionKeyInFamily(oid, family)) return family;
        }
        for (const family of list) {
            const f = ensureComponentsArray(family);
            const ids = Array.isArray(f.optionIds) ? f.optionIds : [];
            if (ids.some((id) => String(id || '').trim() === oid)) return family;
        }
        return null;
    }

    /**
     * Résout composant + groupe par ids stockés (après déduplication).
     */
    function resolveGroupInFamily(family, componentIdHint, groupIdHint) {
        const gid = String(groupIdHint || '').trim();
        const cid = String(componentIdHint || '').trim();
        if (!gid) return null;
        const flat = flattenDecisionGroups(family);

        if (cid && !isLegacyComponentHint(cid)) {
            const comp = findComponent(family, cid);
            const wantId = comp ? String(comp.id || '').trim() : cid;
            const exact = flat.find(
                (g) => String(g.componentId || '') === wantId && flatGroupMatchesGidHint(g, gid)
            );
            if (exact) return flatHitToResolved(family, exact);
            if (comp) {
                const ghit = normalizeGroups(comp.decisionGroups).find((g) =>
                    flatGroupMatchesGidHint({ ...g, componentId: wantId }, gid)
                );
                if (ghit) {
                    return flatHitToResolved(family, {
                        ...ghit,
                        componentId: wantId,
                        groupId: String(ghit.id || ghit.groupId || gid).trim()
                    });
                }
            }
        }

        const matches = flat.filter((g) => flatGroupMatchesGidHint(g, gid));
        const hit = pickBestFlatGroup(family, matches, cid);
        if (hit) return flatHitToResolved(family, hit);
        return null;
    }

    /** Vérifie qu’une clé select peut être résolue (sans modifier la famille). */
    function previewAssignTarget(family, selectionKey) {
        const norm = resolveSelectionKeyForFamily(family, selectionKey);
        if (!norm.ok) {
            return {
                ok: false,
                reason: norm.reason || 'unresolved_group',
                parsed: parseGroupSelectionKey(selectionKey)
            };
        }
        if (!norm.key) {
            return { ok: true, componentId: '', groupId: '', assignKey: '' };
        }
        return {
            ok: true,
            componentId: norm.componentId,
            groupId: norm.groupId,
            assignKey: norm.key
        };
    }

    /**
     * Même règle que l’onglet Options : option ∈ groupe du composant (pas de champ composant sur l’option).
     */
    function getOptionIdsForComponentGroup(family, componentId, groupId) {
        const resolved = resolveGroupInFamily(family, componentId, groupId);
        const cid = String(resolved?.componentId || componentId || '').trim();
        const gid = String(resolved?.groupId || groupId || '').trim();
        const hit = resolved?.group
            ? { component: resolved.component, group: resolved.group }
            : findGroupInFamily(family, cid, gid);
        if (!hit?.group) return [];
        return (Array.isArray(hit.group.optionIds) ? hit.group.optionIds : [])
            .map((x) => String(x || '').trim())
            .filter(Boolean);
    }

    function optionBelongsToComponentGroup(optionId, family, componentId, groupId) {
        const oid = String(optionId || '').trim();
        if (!oid) return false;
        return getOptionIdsForComponentGroup(family, componentId, groupId).includes(oid);
    }

    function resolveComponentIdForGroupAssignment(family, groupId, componentIdHint) {
        const gid = String(groupId || '').trim();
        const hint = String(componentIdHint || '').trim();
        if (!gid) {
            if (!hint) return '';
            const compOnly = findComponent(ensureComponentsArray(family), hint);
            return compOnly ? String(compOnly.id || '').trim() : '';
        }
        const f = ensureComponentsArray(family);
        if (hint) {
            const hit = findGroupInFamily(f, hint, gid);
            if (hit) return String(hit.component.id || '').trim();
            const comp = findComponent(f, hint);
            if (comp) return String(comp.id || '').trim();
            return '';
        }
        const comps = getComponents(f);
        const matches = comps.filter((comp) =>
            normalizeGroups(comp.decisionGroups).some((g) => String(g?.id || g?.groupId || '').trim() === gid)
        );
        if (matches.length === 1) return String(matches[0].id || '').trim();
        if (matches.length > 1) return '';
        if (comps.length === 1) return String(comps[0].id || '').trim();
        const fallback = findComponent(f, DEFAULT_COMPONENT_ID);
        return fallback ? String(fallback.id || '').trim() : DEFAULT_COMPONENT_ID;
    }

    /**
     * Affecte des options au groupe d’un composant (onglet Options, assignation manuelle).
     * Retire les ids des autres groupes de la même famille.
     */
    function ensureGroupOnComponent(comp, groupId, groupMeta) {
        const gid = String(groupId || '').trim();
        if (!gid || !comp) return comp;
        let groups = normalizeGroups(comp.decisionGroups);
        const exists = groups.some((g) => String(g?.id || g?.groupId || '').trim() === gid);
        if (exists) return comp;
        const meta = groupMeta && typeof groupMeta === 'object' ? groupMeta : {};
        groups = [...groups, {
            id: gid,
            label: String(meta.label || gid).trim(),
            type: String(meta.type || 'option').trim() || 'option',
            decisionMode: String(meta.decisionMode || 'single_choice').trim() || 'single_choice',
            priceMode: 'option',
            keywords: String(meta.keywords || '').trim(),
            optionIds: []
        }];
        return { ...comp, decisionGroups: groups };
    }

    /**
     * Affecte des options à une famille (clé select = componentId::groupId).
     * @returns {{ ok: boolean, assignKey: string, componentId: string, groupId: string, reason?: string }}
     */
    function assignFamilyOptions(family, optionIds, opts = {}) {
        const ids = (Array.isArray(optionIds) ? optionIds : [])
            .map((x) => String(x || '').trim())
            .filter(Boolean);
        const fail = (reason) => ({
            ok: false,
            assignKey: '',
            componentId: '',
            groupId: '',
            reason
        });
        if (!ids.length) return fail('no_option_ids');

        const rawKey = String(opts.selectionKey || '').trim();
        let groupMeta = opts.groupMeta && typeof opts.groupMeta === 'object' ? opts.groupMeta : null;
        let selectionKey = rawKey;
        if (rawKey) {
            const norm = resolveSelectionKeyForFamily(family, rawKey);
            if (!norm.ok) return fail('unresolved_group');
            selectionKey = norm.key;
            if (!groupMeta) groupMeta = norm.groupMeta;
        }
        const parsed = selectionKey
            ? parseGroupSelectionKey(selectionKey)
            : { componentId: String(opts.componentId || '').trim(), groupId: String(opts.groupId || '').trim() };
        const hintCid = String(parsed.componentId || '').trim();
        const hintGid = String(parsed.groupId || '').trim();
        const wantGroup = !!(selectionKey || hintGid);

        let f = ensureComponentsArray(family);
        Object.assign(family, f);

        const idSet = new Set(ids);

        if (!wantGroup) {
            family.optionIds = [...new Set([
                ...(Array.isArray(family.optionIds) ? family.optionIds : []).map((x) => String(x || '').trim()).filter(Boolean),
                ...ids
            ])];
            Object.assign(family, syncOptionsToComponents(family));
            return { ok: true, assignKey: '', componentId: '', groupId: '' };
        }

        const resolved = resolveGroupInFamily(
            family,
            hintCid || groupMeta?.componentId,
            hintGid || groupMeta?.groupId
        );
        const cid = String(resolved?.componentId || '').trim();
        const gid = String(resolved?.groupId || '').trim();
        if (!cid || !gid) return fail('unresolved_group');

        const comps = getComponents(family);
        const compIdx = comps.findIndex((c) => String(c.id) === cid);
        if (compIdx < 0) return fail('no_component');

        let comp = comps[compIdx];
        comp = ensureGroupOnComponent(comp, gid, groupMeta || resolved?.group);
        family.components[compIdx] = comp;
        f.components[compIdx] = comp;

        const multi = String(
            (resolved?.group?.decisionMode || groupMeta?.decisionMode || '')
        ).trim().toLowerCase() === 'multi_choice';

        const targetGroup = normalizeGroups(comp.decisionGroups).find((g) =>
            String(g?.id || g?.groupId || '').trim() === gid
        );
        if (!targetGroup) return fail('unresolved_group');

        getComponents(family).forEach((c) => {
            (Array.isArray(c.decisionGroups) ? c.decisionGroups : []).forEach((g) => {
                const gId = String(g?.id || g?.groupId || '').trim();
                if (!gId) return;
                if (!g.id) g.id = gId;
                if (!g.groupId) g.groupId = gId;
                let list = (Array.isArray(g.optionIds) ? g.optionIds : [])
                    .map((x) => String(x || '').trim())
                    .filter(Boolean);
                if (String(c.id) === cid && gId === gid) {
                    list = multi ? [...new Set([...list, ...ids])] : [...ids];
                } else {
                    list = list.filter((x) => !idSet.has(x));
                }
                g.optionIds = list;
            });
        });

        family.optionIds = [...new Set([
            ...(Array.isArray(family.optionIds) ? family.optionIds : []).map((x) => String(x || '').trim()).filter(Boolean),
            ...ids
        ])];
        Object.assign(family, syncOptionsToComponents(family));

        return {
            ok: true,
            assignKey: groupSelectionKey({ componentId: cid, id: gid, groupId: gid }),
            componentId: cid,
            groupId: gid
        };
    }

    function assignOptionsToFamilyGroup(family, optionIds, options = {}) {
        const selectionKey = String(options.selectionKey || '').trim()
            || (options.componentId || options.groupId
                ? groupSelectionKey({
                    componentId: options.componentId,
                    id: options.groupId,
                    groupId: options.groupId
                })
                : '');
        const result = assignFamilyOptions(family, optionIds, {
            selectionKey,
            componentId: options.componentId,
            groupId: options.groupId,
            groupMeta: options.groupMeta
        });
        return result.ok ? family : ensureComponentsArray(family);
    }

    /** Tous les groupes d’une famille (y compris Modèle vide) — listes d’affectation onglet Options. */
    function listAssignableDecisionGroups(family) {
        const f = ensureComponentsArray(family);
        const out = [];
        f.components.forEach((comp) => {
            normalizeGroups(comp.decisionGroups).forEach((g) => {
                const groupId = String(g?.id || g?.groupId || '').trim();
                if (!groupId) return;
                out.push({
                    ...g,
                    id: groupId,
                    componentId: String(comp.id || '').trim(),
                    componentLabel: String(g.componentLabel || comp.label || '').trim(),
                    componentKeyword: String(g.componentKeyword || comp.keyword || '').trim(),
                    familyLabel: String(f.familyLabel || '').trim(),
                    groupId,
                    label: String(g.label || groupId).trim()
                });
            });
        });
        return out;
    }

    function collectFamilyOptionIds(family) {
        const ids = new Set();
        const f = ensureComponentsArray(family);
        (Array.isArray(f.optionIds) ? f.optionIds : []).forEach((id) => {
            const s = String(id || '').trim();
            if (s) ids.add(s);
        });
        flattenDecisionGroups(f).forEach((g) => {
            (Array.isArray(g.optionIds) ? g.optionIds : []).forEach((id) => {
                const s = String(id || '').trim();
                if (s) ids.add(s);
            });
        });
        return Array.from(ids);
    }

    /** Retire toutes les options des groupes (conserve composants / groupes / mots-clés). */
    function clearAllOptionAssignmentsFromFamily(family) {
        const f = ensureComponentsArray(family);
        f.optionIds = [];
        delete f.defaultOptionId;
        delete f.structureWarnings;
        f.components = (Array.isArray(f.components) ? f.components : []).map((comp) => {
            const c = { ...comp };
            c.decisionGroups = normalizeGroups(c.decisionGroups).map((g) => ({
                ...g,
                optionIds: []
            }));
            return c;
        });
        return syncOptionsToComponents(f);
    }

    function clearAllOptionAssignmentsFromFamilies(families) {
        return (Array.isArray(families) ? families : []).map((f) =>
            clearAllOptionAssignmentsFromFamily(f)
        );
    }

    function stripOptionsFromFamilyGroups(family, idSet) {
        const f = ensureComponentsArray(family);
        const drop = idSet instanceof Set ? idSet : new Set(
            (Array.isArray(idSet) ? idSet : []).map((x) => String(x || '').trim()).filter(Boolean)
        );
        f.components.forEach((comp) => {
            (Array.isArray(comp.decisionGroups) ? comp.decisionGroups : []).forEach((group) => {
                group.optionIds = (Array.isArray(group.optionIds) ? group.optionIds : [])
                    .map((x) => String(x || '').trim())
                    .filter((x) => x && !drop.has(x));
            });
        });
        f.optionIds = (Array.isArray(f.optionIds) ? f.optionIds : [])
            .map((x) => String(x || '').trim())
            .filter((x) => x && !drop.has(x));
        Object.assign(family, syncOptionsToComponents(f));
        return family;
    }

    function suggestGroupSelectionKey(ctx, family) {
        const name = String(ctx?.name || '').trim();
        const groups = flattenDecisionGroups(family);
        if (!groups.length) return '';

        let bestKey = '';
        let bestScore = 0;
        const comps = getComponents(family);
        groups.forEach((group) => {
            let score = 0;
            const comp = comps.find((c) => String(c.id) === String(group.componentId || ''));
            tokenizeKeywords(comp?.keyword).forEach((kw) => {
                if (nameMatchesKeyword(name, kw)) score += 3;
            });
            tokenizeKeywords(group.componentKeyword).forEach((kw) => {
                if (nameMatchesKeyword(name, kw)) score += 3;
            });
            tokenizeKeywords(group.keywords).forEach((kw) => {
                if (nameMatchesKeyword(name, kw)) score += 2;
            });
            if (score > bestScore) {
                bestScore = score;
                bestKey = groupSelectionKey(group);
            }
        });
        if (bestKey) return bestKey;

        const defId = resolveDefaultDecisionGroupId(
            groups,
            comps[0]?.defaultDecisionGroupId
        );
        const defGroup = groups.find((g) => String(g.groupId || g.id) === String(defId || '')) || groups[0];
        return defGroup ? groupSelectionKey(defGroup) : '';
    }

    function scoreFamilyForOption(ctx, family) {
        const name = String(ctx?.name || '').trim();
        if (!name) return 0;
        let score = 0;
        const fkw = String(family?.familyKeyword || family?.objectName || family?.familyKeywords || '').trim();
        const familyHits = tokenizeKeywords(fkw).filter((kw) => nameMatchesKeyword(name, kw)).length;
        if (familyHits > 0) score += 4 + (familyHits - 1);
        getComponents(family).forEach((comp) => {
            if (nameMatchesKeyword(name, comp?.keyword)) score += 3;
        });
        const key = suggestGroupSelectionKey(ctx, family);
        if (key) score += 2;
        return score;
    }

    /**
     * Réassigne les options d’une famille aux groupes (mots-clés + groupe par défaut).
     * Utilise uniquement les ids stockés après déduplication.
     */
    function reassignFamilyOptions(family, optionIds, ctxById) {
        const deduped = dedupeFamilyStructure(family);
        const warnings = [...(deduped.warnings || [])];
        Object.assign(family, deduped.family);
        let f = family;
        const map = ctxById && typeof ctxById === 'object' ? ctxById : {};

        let toProcess = (Array.isArray(optionIds) ? optionIds : [])
            .map((x) => String(x || '').trim())
            .filter(Boolean);
        if (!toProcess.length) toProcess = collectFamilyOptionIds(f);
        if (!toProcess.length) {
            return { family: f, count: 0, warnings, reason: 'no_options' };
        }
        if (!flattenDecisionGroups(f).length) {
            return { family: f, count: 0, warnings, reason: 'no_groups' };
        }

        const idSet = new Set(toProcess);
        f = stripOptionsFromFamilyGroups(f, idSet);

        let count = 0;
        toProcess.forEach((oid) => {
            const row = map[oid] || { id: oid, name: '' };
            const selectionKey = suggestGroupSelectionKey(row, f);
            if (!selectionKey) return;
            let result = assignFamilyOptions(f, [oid], { selectionKey });
            if (!result.ok || !result.assignKey) {
                const retryKey = findOptionSelectionKeyInFamily(oid, f)
                    || suggestGroupSelectionKey(row, f);
                if (retryKey && retryKey !== selectionKey) {
                    result = assignFamilyOptions(f, [oid], { selectionKey: retryKey });
                }
            }
            if (result.ok && result.assignKey) count += 1;
            else if (result.ok && !result.assignKey) {
                warnings.push(`Option ${oid} : affectée à la famille sans groupe explicite.`);
            }
        });
        Object.assign(f, syncOptionsToComponents(f));
        if (warnings.length) f.structureWarnings = warnings;
        return {
            family: f,
            count,
            warnings,
            reason: count ? 'ok' : 'no_match'
        };
    }

    /**
     * Auto-assignation : options sans famille → meilleure famille + groupe (mots-clés).
     */
    function autoAssignOptionsByKeywords(rows, families) {
        const warnings = [];
        const next = (Array.isArray(families) ? families : []).map((raw) => {
            const { family, warnings: w } = dedupeFamilyStructure(raw);
            if (w.length) warnings.push(...w.map((msg) => `${family.familyLabel}: ${msg}`));
            return family;
        });
        const assignments = [];
        let count = 0;

        (Array.isArray(rows) ? rows : []).forEach((row) => {
            const oid = String(row?.id || '').trim();
            if (!oid || String(row?.familyLabel || '').trim()) return;
            const name = String(row?.name || '').trim();
            if (!name) return;

            let bestIdx = -1;
            let bestScore = 0;
            let bestKey = '';
            next.forEach((family, idx) => {
                const score = scoreFamilyForOption(row, family);
                if (score <= 0 || score <= bestScore) return;
                const key = suggestGroupSelectionKey(row, family);
                if (!key) return;
                bestScore = score;
                bestIdx = idx;
                bestKey = key;
            });
            if (bestIdx < 0 || !bestKey) return;

            const family = next[bestIdx];
            const result = assignFamilyOptions(family, [oid], { selectionKey: bestKey });
            if (!result.ok) return;
            count += 1;
            assignments.push({
                optionId: oid,
                familyLabel: String(family.familyLabel || '').trim(),
                selectionKey: bestKey
            });
        });

        return { families: next, assignments, count, warnings };
    }

    function countGroupsWithId(family, groupId) {
        const gid = String(groupId || '').trim();
        if (!gid) return 0;
        let count = 0;
        getComponents(ensureComponentsArray(family)).forEach((comp) => {
            if (normalizeGroups(comp.decisionGroups).some(
                (g) => String(g?.id || g?.groupId || '').trim() === gid
            )) {
                count += 1;
            }
        });
        return count;
    }

    global.UgapFamilyComponents = {
        DEFAULT_COMPONENT_ID,
        DEFAULT_COMPONENT_LABEL,
        slugify,
        parseIdVersion,
        pickLatestId,
        dedupeFamilyStructure,
        defaultGroupsForComponent,
        newComponent,
        normalizeComponent,
        normalizeFamily,
        normalizeFamilyList,
        ensureComponentsArray,
        syncOptionsToComponents,
        flattenDecisionGroups,
        listAssignableDecisionGroups,
        getComponents,
        findComponent,
        findGroupInFamily,
        resolveGroupInFamily,
        normalizeGroupType,
        componentIdsMatch,
        getOptionIdsForComponentGroup,
        optionBelongsToComponentGroup,
        resolveComponentIdForGroupAssignment,
        assignOptionsToFamilyGroup,
        assignFamilyOptions,
        previewAssignTarget,
        collectFamilyOptionIds,
        clearAllOptionAssignmentsFromFamily,
        clearAllOptionAssignmentsFromFamilies,
        stripOptionsFromFamilyGroups,
        findOptionSelectionKeyInFamily,
        suggestGroupSelectionKey,
        scoreFamilyForOption,
        reassignFamilyOptions,
        autoAssignOptionsByKeywords,
        tokenizeKeywords,
        nameMatchesKeyword,
        countGroupsWithId,
        resolveDefaultDecisionGroupId,
        generateComponentId: (existing) => generateId('composant', existing),
        generateGroupId: (existing) => generateId('groupe', existing),
        groupRefKey,
        slotKeyFromGroup,
        parseSlotKey,
        groupSelectionKey,
        parseGroupSelectionKey,
        groupMatchesSelectionKey,
        selectionKeyMatchesGroup,
        resolveSelectionKeyForFamily,
        findFamilyContainingOption,
        normalizeGroups
    };

    global.normalizeFamilyWithComponents = normalizeFamily;
    global.normalizeFamiliesWithComponents = normalizeFamilyList;
    global.flattenFamilyDecisionGroups = flattenDecisionGroups;
})(window);
