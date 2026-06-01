/**
 * Section Parametrage > Options
 * Assignation famille/groupe + filtres + auto-assign mots-cles.
 */
(function initUgapOptionsTab(global) {
    'use strict';

    const state = {
        data: null,
        uiState: null,
        rows: [],
        visibleRows: [],
        selectedIds: new Set(),
        filterFamily: '',
        filterModel: '',
        filterQuery: '',
        filterStatus: 'all',
        filterTag: 'all',
    };

    function esc(v) {
        if (typeof global.escapeHtml === 'function') return global.escapeHtml(v);
        return String(v ?? '');
    }

    function fmtMoney(value) {
        const n = Number(value);
        if (!Number.isFinite(n)) return '—';
        return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n);
    }

    function isImportGeneratedBaseOption(opt) {
        if (!opt || typeof opt !== 'object') return false;
        if (opt.importGeneratedFromBaseProduct === true || opt.importBaseProductId) return true;
        const id = String(opt?.id || '').trim();
        if (id.startsWith('opt_ibp_')) return true;
        return String(opt.refUgap || '').trim().toUpperCase().startsWith('IBP-');
    }

    function inferPublishedOptionLineKind(opt) {
        const OLK = global.UgapOptionLineKind;
        if (OLK?.inferOptionLineKind) return OLK.inferOptionLineKind(opt);
        return 'option';
    }

    function resolveOptionTypeMeta(opt) {
        const lineKind = inferPublishedOptionLineKind(opt);

        // IBP synthétique (opt_ibp_*) uniquement — pas une ligne catalogue Excel réutilisée.
        if (isImportGeneratedBaseOption(opt)) {
            return { key: 'base', label: 'Base', className: 'ugap-option-tag--base' };
        }
        if (lineKind === 'minoration') return { key: 'mino', label: 'MINO', className: 'ugap-option-tag--mino' };
        if (lineKind === 'majoration') return { key: 'majo', label: 'MAJO', className: 'ugap-option-tag--majo' };
        if (lineKind === 'pr') return { key: 'pr', label: 'PR', className: 'ugap-option-tag--pr' };
        if (opt?.isBaseOption === true || opt?.baseIncluded === true || opt?.manualBaseOption === true) {
            return { key: 'base', label: 'Base', className: 'ugap-option-tag--base' };
        }
        return { key: 'catalogue', label: 'Catalogue', className: 'ugap-option-tag--catalogue' };
    }

    function findRawOptionById(optionId) {
        const oid = String(optionId || '').trim();
        if (!oid) return null;
        for (const cat of Array.isArray(state.data?.categories) ? state.data.categories : []) {
            const hit = (Array.isArray(cat?.options) ? cat.options : [])
                .find((o) => String(o?.id || '').trim() === oid);
            if (hit) return hit;
        }
        return null;
    }

    function byId(id) {
        return document.getElementById(id);
    }

    function getFamilies() {
        return Array.isArray(state.uiState?.families) ? state.uiState.families : [];
    }

    function getFamilyByLabel(label) {
        const key = String(label || '').trim().toLowerCase();
        return getFamilies().find((f) => String(f?.familyLabel || '').trim().toLowerCase() === key) || null;
    }

    function findFamilyInList(families, label) {
        const key = String(label || '').trim().toLowerCase();
        if (!key) return null;
        return (Array.isArray(families) ? families : []).find(
            (f) => String(f?.familyLabel || '').trim().toLowerCase() === key
        ) || null;
    }

    function getDecisionGroups(family) {
        if (Array.isArray(family?.decisionGroups) && family.decisionGroups.length) {
            return family.decisionGroups;
        }
        if (Array.isArray(family?.groups) && family.groups.length) {
            return family.groups;
        }
        return [];
    }

    function getAssignFamilyLabel() {
        const assign = String(byId('ugap-options-assign-family')?.value || '').trim();
        if (assign) return assign;
        return String(byId('ugap-options-filter-family')?.value || '').trim();
    }

    function showOptionsStatus(message, type = 'info') {
        const el = byId('ugap-options-action-status');
        if (el) {
            el.textContent = String(message || '');
            el.dataset.statusType = type;
            el.hidden = !message;
        }
        global.showAlert?.(message, type);
    }

    function flattenOptions(data) {
        return (Array.isArray(data?.categories) ? data.categories : []).flatMap((cat) => {
            const categoryName = String(cat?.name || '').trim();
            return (Array.isArray(cat?.options) ? cat.options : [])
                .filter((opt) => {
                    const name = String(opt?.name || '').trim();
                    if (opt?.isSparePart === true) return false;
                    if (/^PR\s/i.test(name)) return false;
                    return true;
                })
                .map((opt) => ({
                    ...opt,
                    __categoryName: categoryName
                }));
        });
    }

    function getCatalogModels() {
        return Array.isArray(state.data?.models) ? state.data.models : [];
    }

    function formatCatalogModelLabel(model) {
        const m = model && typeof model === 'object' ? model : {};
        const id = String(m?.id || '').trim();
        const name = String(m?.name || '').trim();
        const pn = m?.posteNumber;
        const poste = pn != null && pn !== '' && Number.isFinite(Number(pn)) ? `P${pn}` : '';
        if (poste && name) return `${poste} — ${name}`;
        if (poste) return poste;
        if (name) return name;
        return id || '—';
    }

    function compareCatalogModelsByPoste(a, b) {
        const na = Number(a?.posteNumber);
        const nb = Number(b?.posteNumber);
        const aOk = Number.isFinite(na);
        const bOk = Number.isFinite(nb);
        if (aOk && bOk && na !== nb) return na - nb;
        if (aOk && !bOk) return -1;
        if (!aOk && bOk) return 1;
        return formatCatalogModelLabel(a).localeCompare(formatCatalogModelLabel(b), 'fr', { sensitivity: 'base' });
    }

    function getExplicitPosteSetFromLabel(label) {
        const raw = String(label || '');
        if (!raw.trim()) return null;
        const set = new Set();
        let found = false;
        let m;
        const rangeRe = /\bpostes?\s+(\d+)\s*(?:à|a|-|–|—)\s*(\d+)\b/gi;
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
        if (!found) return null;
        return set;
    }

    function getSortedExplicitPosteNumbersFromLabel(label) {
        const set = getExplicitPosteSetFromLabel(label);
        if (!set || set.size === 0) return [];
        return [...set].filter(Number.isFinite).sort((a, b) => a - b);
    }

    function formatAssignedPostes(opt) {
        const explicit = getSortedExplicitPosteNumbersFromLabel(opt?.name);
        if (explicit.length) return explicit.join(', ');

        const models = getCatalogModels();
        const modelById = new Map(
            models.map((m) => [String(m?.id || '').trim(), m]).filter(([id]) => id)
        );
        const cm = (Array.isArray(opt?.compatibleModels) ? opt.compatibleModels : [])
            .map((id) => String(id || '').trim())
            .filter(Boolean);

        if (!cm.length) {
            if (opt?.isDivers === true) return 'Tous';
            return '—';
        }

        const postes = cm
            .map((id) => modelById.get(id))
            .map((m) => Number(m?.posteNumber))
            .filter(Number.isFinite);
        const unique = [...new Set(postes)].sort((a, b) => a - b);
        if (unique.length) return unique.join(', ');

        if (cm.length === models.length && models.length > 0) return 'Tous';
        return `${cm.length} modèle(s)`;
    }

    function buildLinksByOptionId(uiState) {
        const map = new Map();
        getFamilies(uiState).forEach((family) => {
            const familyLabel = String(family?.familyLabel || '').trim();
            const famOptionIds = Array.isArray(family?.optionIds) ? family.optionIds : [];
            famOptionIds.forEach((idRaw) => {
                const id = String(idRaw || '').trim();
                if (!id) return;
                if (!map.has(id)) {
                    map.set(id, { familyLabel: '', groupIds: new Set(), groupLabels: new Set() });
                }
                if (familyLabel) map.get(id).familyLabel = familyLabel;
            });
            (Array.isArray(family?.decisionGroups) ? family.decisionGroups : []).forEach((group) => {
                const gid = String(group?.id || '').trim();
                const glabel = String(group?.label || gid || '').trim();
                const optionIds = Array.isArray(group?.optionIds) ? group.optionIds : [];
                optionIds.forEach((idRaw) => {
                    const id = String(idRaw || '').trim();
                    if (!id) return;
                    if (!map.has(id)) {
                        map.set(id, { familyLabel: familyLabel || '', groupIds: new Set(), groupLabels: new Set() });
                    }
                    if (familyLabel && !map.get(id).familyLabel) map.get(id).familyLabel = familyLabel;
                    if (gid) map.get(id).groupIds.add(gid);
                    if (glabel) map.get(id).groupLabels.add(glabel);
                });
            });
        });
        return map;
    }

    function getBaseAdjLinksApi() {
        return global.UgapBaseAdjLinks || null;
    }

    function resolveSourceAdjIdsForBaseRow(baseCatalogId) {
        const BAL = getBaseAdjLinksApi();
        if (!BAL?.resolveSourceAdjOptionIdsForBase) return [];
        return BAL.resolveSourceAdjOptionIdsForBase(
            baseCatalogId,
            state.data?.categories,
            state.data?.importBaseProducts
        );
    }

    function resolveExcelSourceLabelForBaseRow(row) {
        if (!row?.isImportBase) return '';
        const fromIbp = String(row.importExcelLabel || '').trim();
        if (fromIbp) return fromIbp;
        const sourceId = String((Array.isArray(row.sourceAdjIds) ? row.sourceAdjIds[0] : '') || '').trim();
        const sourceOpt = sourceId ? findRawOptionById(sourceId) : null;
        return String(sourceOpt?.name || '').trim();
    }

    function resolveExcelSourceLabelForRow(row) {
        if (!row || typeof row !== 'object') return '';
        if (row.isImportBase) return resolveExcelSourceLabelForBaseRow(row);
        return String(row.importExcelLabel || '').trim();
    }

    function resolveSourceOptionIdForBaseRow(row) {
        const excelLabel = resolveExcelSourceLabelForBaseRow(row);
        if (!excelLabel) return '';
        const BAL = getBaseAdjLinksApi();
        if (BAL?.findAdjByExcelLabel) {
            return BAL.findAdjByExcelLabel(state.data?.categories, excelLabel);
        }
        return '';
    }

    function isBaseRowSourceLinked(row) {
        const sourceOptionId = String(row?.sourceOptionId || resolveSourceOptionIdForBaseRow(row) || '').trim();
        if (!sourceOptionId) return false;
        return (Array.isArray(row?.sourceAdjIds) ? row.sourceAdjIds : [])
            .map((x) => String(x || '').trim())
            .includes(sourceOptionId);
    }

    function normalizeRows() {
        const optionLinks = buildLinksByOptionId(state.uiState);
        const rows = flattenOptions(state.data).map((opt, idx) => {
            const id = String(opt?.id || '').trim();
            const link = optionLinks.get(id);
            const typeMeta = resolveOptionTypeMeta(opt);
            const isImportBase = isImportGeneratedBaseOption(opt);
            const sourceAdjIds = isImportBase ? resolveSourceAdjIdsForBaseRow(id) : [];
            const excelLabel = String(opt?.importExcelLabel || opt?.details || '').trim();
            const rowDraft = {
                isImportBase,
                importExcelLabel: excelLabel,
                sourceAdjIds,
            };
            const sourceOptionId = isImportBase ? resolveSourceOptionIdForBaseRow(rowDraft) : '';
            return {
                id,
                name: String(opt?.name || id || `Option ${idx + 1}`).trim(),
                category: String(opt?.__categoryName || '—'),
                pricePublic: Number.isFinite(Number(opt?.priceClient)) ? Number(opt.priceClient) : null,
                priceUgap: Number.isFinite(Number(opt?.priceUgap)) ? Number(opt.priceUgap) : null,
                baseIncluded: opt?.baseIncluded === true,
                assignedPostes: formatAssignedPostes(opt),
                familyLabel: String(link?.familyLabel || opt?.familyLabel || '').trim(),
                groupIds: link ? Array.from(link.groupIds) : [],
                groups: link ? Array.from(link.groupLabels) : [],
                isImportBase,
                importExcelLabel: excelLabel,
                sourceAdjIds,
                sourceOptionId,
                sourceLinked: isImportBase && sourceOptionId
                    ? sourceAdjIds.map((x) => String(x || '').trim()).includes(sourceOptionId)
                    : false,
                compatibleModelIds: (Array.isArray(opt?.compatibleModels) ? opt.compatibleModels : [])
                    .map((mid) => String(mid || '').trim())
                    .filter(Boolean),
                optionType: typeMeta.key,
                optionTypeLabel: typeMeta.label,
                optionTypeClassName: typeMeta.className,
            };
        });

        rows.sort((a, b) => {
            const fa = String(a.familyLabel || '');
            const fb = String(b.familyLabel || '');
            if (fa !== fb) return fa.localeCompare(fb, 'fr');
            return String(a.name || '').localeCompare(String(b.name || ''), 'fr');
        });
        return rows;
    }

    function filteredRows() {
        const familyFilter = String(state.filterFamily || '').trim().toLowerCase();
        const modelFilter = String(state.filterModel || '').trim();
        const query = normalizeText(state.filterQuery || '');
        const statusFilter = String(state.filterStatus || 'all');
        const tagFilter = String(state.filterTag || 'all').trim().toLowerCase();
        return state.rows.filter((row) => {
            const hasFamily = !!String(row.familyLabel || '').trim();
            const haystack = normalizeText([
                row.name,
                row.familyLabel,
                row.groups.join(' '),
                row.category,
                row.optionTypeLabel,
                row.optionType,
                row.assignedPostes
            ].join(' '));
            if (query && !haystack.includes(query)) return false;
            const familyOk = !familyFilter || String(row.familyLabel || '').trim().toLowerCase() === familyFilter;
            if (!familyOk) return false;
            if (modelFilter) {
                const cm = Array.isArray(row.compatibleModelIds) ? row.compatibleModelIds : [];
                if (!cm.includes(modelFilter)) return false;
            }
            if (tagFilter !== 'all' && String(row.optionType || '').toLowerCase() !== tagFilter) return false;
            if (statusFilter === 'unassigned') {
                return !hasFamily;
            }
            if (statusFilter === 'catalogue') {
                return row.optionType === 'catalogue';
            }
            if (statusFilter === 'mino') {
                return row.optionType === 'mino';
            }
            if (statusFilter === 'majo') {
                return row.optionType === 'majo';
            }
            if (statusFilter === 'base_only') {
                return row.isImportBase === true
                    || row.baseIncluded === true
                    || row.optionType === 'base';
            }
            return true;
        });
    }

    function renderFamilySelectCell(row) {
        const current = String(row?.familyLabel || '').trim();
        const placeholder = current
            ? ''
            : '<option value="" selected disabled>Choisir une famille…</option>';
        const options = getFamilies().map((family) => {
            const label = String(family?.familyLabel || '').trim();
            if (!label) return '';
            const selected = label === current ? 'selected' : '';
            return `<option value="${esc(label)}" ${selected}>${esc(label)}</option>`;
        }).join('');
        return `
            <select
                data-row-family-option-id="${esc(row.id)}"
                style="min-width:180px;padding:4px 6px;border:1px solid #d1d5db;border-radius:6px;background:#fff;"
            >
                ${placeholder}
                ${options}
            </select>
        `;
    }

    function renderGroupSelectCell(row) {
        const family = getFamilyByLabel(row?.familyLabel);
        const groups = getDecisionGroups(family);
        const currentGroup = String((Array.isArray(row?.groupIds) ? row.groupIds[0] : '') || '').trim();
        const options = groups.map((group) => {
            const gid = String(group?.id || '').trim();
            if (!gid) return '';
            const glabel = String(group?.label || gid).trim();
            const selected = gid === currentGroup ? 'selected' : '';
            return `<option value="${esc(gid)}" ${selected}>${esc(glabel)}</option>`;
        }).join('');
        const disabled = row?.familyLabel ? '' : 'disabled';
        return `
            <select
                data-row-group-option-id="${esc(row.id)}"
                ${disabled}
                style="min-width:180px;padding:4px 6px;border:1px solid #d1d5db;border-radius:6px;background:#fff;"
            >
                <option value="">Sans groupe</option>
                ${options}
            </select>
        `;
    }

    function updateSelectVisibleButton() {
        const btn = byId('ugap-options-select-visible');
        if (!btn) return;
        const visibleIds = (state.visibleRows.length ? state.visibleRows : state.rows)
            .map((row) => row.id)
            .filter(Boolean);
        const allSelected = visibleIds.length > 0 && visibleIds.every((id) => state.selectedIds.has(id));
        btn.textContent = allSelected ? 'Désélectionner la vue' : 'Sélectionner la vue';
    }

    function fillFamilySelects() {
        const families = getFamilies();
        const familyFilter = byId('ugap-options-filter-family');
        const familyAssign = byId('ugap-options-assign-family');
        if (!familyFilter || !familyAssign) return;

        const opts = families.map((f) => {
            const label = String(f?.familyLabel || '').trim();
            if (!label) return '';
            return `<option value="${esc(label)}">${esc(label)}</option>`;
        }).join('');

        const curFilter = state.filterFamily;
        const curAssign = familyAssign.value;
        familyFilter.innerHTML = `<option value="">Toutes les familles</option>${opts}`;
        familyAssign.innerHTML = `<option value="">Choisir une famille…</option>${opts}`;
        if (curFilter) familyFilter.value = curFilter;
        if (curAssign) familyAssign.value = curAssign;
        fillModelSelect();
        fillGroupAssignSelect();
        updateReassignGroupsButton();
    }

    function fillModelSelect() {
        const select = byId('ugap-options-filter-model');
        if (!select) return;
        const models = getCatalogModels().slice().sort(compareCatalogModelsByPoste);
        const opts = models.map((m) => {
            const id = String(m?.id || '').trim();
            if (!id) return '';
            return `<option value="${esc(id)}">${esc(formatCatalogModelLabel(m))}</option>`;
        }).join('');
        const cur = state.filterModel;
        select.innerHTML = `<option value="">Tous les modèles</option>${opts}`;
        if (cur) select.value = cur;
    }

    function resolveDefaultGroupId(family) {
        const groups = getDecisionGroups(family);
        const preferred = String(family?.defaultDecisionGroupId || '').trim();
        if (global.UgapFamilleLcState?.resolveDefaultDecisionGroupId) {
            const resolved = global.UgapFamilleLcState.resolveDefaultDecisionGroupId(groups, preferred);
            if (resolved) return String(resolved).trim();
        }
        return preferred
            || String(groups.find((g) => String(g?.id || '').trim() === 'option_catalogue')?.id || '').trim()
            || String(groups[0]?.id || '').trim();
    }

    function suggestGroupIdForOptionInFamily(row, family) {
        const name = String(row?.name || '').trim();
        const groups = getDecisionGroups(family);
        let bestGroupId = '';
        let bestScore = 0;
        groups.forEach((group) => {
            const gid = String(group?.id || '').trim();
            if (!gid) return;
            const hits = tokenizeKeywords(group?.keywords).filter((kw) => matchKeyword(name, kw)).length;
            if (hits > bestScore) {
                bestScore = hits;
                bestGroupId = gid;
            }
        });
        if (bestGroupId) return bestGroupId;
        return resolveDefaultGroupId(family);
    }

    function collectOptionIdsForFamily(family) {
        const ids = new Set();
        const labelKey = String(family?.familyLabel || '').trim().toLowerCase();
        if (!labelKey) return [];

        (Array.isArray(family?.optionIds) ? family.optionIds : []).forEach((id) => {
            const s = String(id || '').trim();
            if (s) ids.add(s);
        });
            (Array.isArray(family?.decisionGroups) ? family.decisionGroups : []).forEach((group) => {
            (Array.isArray(group?.optionIds) ? group.optionIds : []).forEach((id) => {
                const s = String(id || '').trim();
                if (s) ids.add(s);
            });
        });
        state.rows.forEach((row) => {
            if (String(row.familyLabel || '').trim().toLowerCase() === labelKey && row.id) {
                ids.add(row.id);
            }
        });
        return Array.from(ids);
    }

    function reassignGroupsInFamily(families, familyLabel, optionIds) {
        const next = Array.isArray(families) ? families : [];
        const target = findFamilyInList(next, familyLabel);
        if (!target) return { families: next, count: 0, reason: 'family_not_found' };

        const groups = getDecisionGroups(target);
        if (!groups.length) {
            return { families: next, count: 0, reason: 'no_groups' };
        }
        if (!target.decisionGroups?.length && groups.length) {
            target.decisionGroups = groups;
        }

        const familyOptionIds = collectOptionIdsForFamily(target);
        const familySet = new Set(familyOptionIds);
        let toProcess = (Array.isArray(optionIds) ? optionIds : [])
            .map((id) => String(id || '').trim())
            .filter((id) => familySet.has(id));
        if (!toProcess.length) toProcess = familyOptionIds;
        if (!toProcess.length) return { families: next, count: 0, reason: 'no_options' };

        const processSet = new Set(toProcess);
        groups.forEach((group) => {
            group.optionIds = (Array.isArray(group.optionIds) ? group.optionIds : [])
                .filter((id) => !processSet.has(String(id || '').trim()));
        });

        let count = 0;
        toProcess.forEach((optionId) => {
            const row = state.rows.find((r) => r.id === optionId) || { id: optionId, name: '' };
            const groupId = suggestGroupIdForOptionInFamily(row, target);
            const group = groups.find((g) => String(g?.id || '').trim() === groupId);
            if (!group) return;
            group.optionIds = uniquePush(Array.isArray(group.optionIds) ? group.optionIds : [], optionId);
            target.optionIds = uniquePush(Array.isArray(target.optionIds) ? target.optionIds : [], optionId);
            count += 1;
        });
        return { families: next, count, reason: count ? 'ok' : 'no_groups' };
    }

    function fillGroupAssignSelect() {
        const familyLabel = String(byId('ugap-options-assign-family')?.value || '').trim();
        const groupSelect = byId('ugap-options-assign-group');
        if (!groupSelect) return;
        const family = getFamilyByLabel(familyLabel);
        const groups = getDecisionGroups(family);
        const defaultGroupId = family ? resolveDefaultGroupId(family) : '';
        const opts = groups.map((g) => {
            const id = String(g?.id || '').trim();
            const label = String(g?.label || id || '').trim();
            if (!id) return '';
            const suffix = id === defaultGroupId ? ' (défaut)' : '';
            return `<option value="${esc(id)}">${esc(label || id)}${esc(suffix)}</option>`;
        }).join('');
        groupSelect.innerHTML = `<option value="">Groupe par défaut si vide</option>${opts}`;
        updateReassignGroupsButton();
    }

    function updateReassignGroupsButton() {
        const btn = byId('ugap-options-reassign-groups');
        if (!btn) return;
        const familyLabel = getAssignFamilyLabel();
        btn.hidden = !familyLabel;
        btn.disabled = false;
    }

    function renderSourceAdjCell(row) {
        const label = resolveExcelSourceLabelForRow(row);
        if (!label) return '<span style="color:#94a3b8;">—</span>';
        return `<span class="ugap-options-source-excel">${esc(label)}</span>`;
    }

    function getDecisionGroupInFamily(familyLabel, groupId) {
        const family = getFamilyByLabel(familyLabel);
        const gid = String(groupId || '').trim();
        if (!family || !gid) return null;
        return getDecisionGroups(family).find((g) => String(g?.id || '').trim() === gid) || null;
    }

    function isAdjPricingGroup(group) {
        const BAL = getBaseAdjLinksApi();
        if (BAL?.isAdjPricingGroup) return BAL.isAdjPricingGroup(group);
        const mode = String(group?.priceMode || group?.pricingMode || '').trim().toLowerCase();
        return mode === 'minoration' || mode === 'majoration';
    }

    const baseAdjSaveInFlight = new Map();

    /** Persiste les liens IBP ↔ source quand le groupe famille est en prix mino/majo. */
    async function autoPersistAdjLinksForIbp(optionId, familyLabel, groupId) {
        const baseId = String(optionId || '').trim();
        if (!baseId || !isImportGeneratedBaseOption(findRawOptionById(baseId))) return;

        const group = getDecisionGroupInFamily(familyLabel, groupId || resolveDefaultGroupId(getFamilyByLabel(familyLabel)));
        if (!isAdjPricingGroup(group)) return;

        const linked = resolveSourceAdjIdsForBaseRow(baseId);
        if (!linked.length) return;
        if (baseAdjSaveInFlight.get(baseId)) return baseAdjSaveInFlight.get(baseId);

        const promise = (async () => {
            await global.apiCall(`/base-products/${encodeURIComponent(baseId)}/adj-links`, {
                method: 'POST',
                body: JSON.stringify({ linkedOptionIds: linked }),
            });
            const row = state.rows.find((r) => r.id === baseId);
            if (row) {
                row.sourceAdjIds = linked;
                row.sourceLinked = linked.length > 0;
            }
        })().catch((err) => {
            console.warn('UGAP autoPersistAdjLinksForIbp:', err?.message || err);
        }).finally(() => {
            baseAdjSaveInFlight.delete(baseId);
        });

        baseAdjSaveInFlight.set(baseId, promise);
        return promise;
    }

    function applyFamiliesToLocalState(nextFamilies) {
        state.uiState = { ...(state.uiState || {}), families: nextFamilies };
        const links = buildLinksByOptionId(state.uiState);
        state.rows.forEach((row) => {
            const link = links.get(String(row?.id || '').trim());
            if (!link) return;
            row.familyLabel = String(link.familyLabel || '').trim();
            row.groupIds = Array.from(link.groupIds);
            row.groups = Array.from(link.groupLabels);
        });
    }

    function resolveGroupIdForFamilyChange(row, familyLabel) {
        const previousGroupId = String((Array.isArray(row?.groupIds) ? row.groupIds[0] : '') || '').trim();
        if (!previousGroupId) return '';
        const groups = getDecisionGroups(getFamilyByLabel(familyLabel));
        const ok = groups.some((g) => String(g?.id || '').trim() === previousGroupId);
        return ok ? previousGroupId : '';
    }

    function focusOptionRow(mount, optionId) {
        const oid = String(optionId || '').trim();
        if (!mount || !oid) return;
        requestAnimationFrame(() => {
            const row = mount.querySelector(`tr[data-option-row-id="${oid}"]`);
            row?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        });
    }

    function renderRows(focusOptionId) {
        const mount = byId('ugap-options-table-wrap');
        if (!mount) return;
        const scrollParent = mount.closest('.ugap-param-section-panel')
            || mount.parentElement
            || document.documentElement;
        const scrollTop = scrollParent.scrollTop;
        state.visibleRows = filteredRows();
        if (!state.visibleRows.length) {
            mount.innerHTML = '<p class="ugap-param-placeholder">Aucune option pour ce filtre.</p>';
            updateSelectVisibleButton();
            return;
        }
        const body = state.visibleRows.map((r) => {
            const checked = state.selectedIds.has(r.id) ? 'checked' : '';
            const ibp = r.isImportBase
                ? ' <span style="font-size:11px;color:#059669;">IBP</span>'
                : '';
            const idHint = r.id
                ? `<div style="margin-top:2px;font-size:11px;color:#64748b;">ID: ${esc(r.id)}</div>`
                : '';
            const optionNameCell = `<span class="ugap-options-edit-name" data-option-id="${esc(r.id)}" title="Double-clic pour renommer">${esc(r.name)}</span>`;
            const postesCell = `<span class="ugap-options-edit-postes" data-option-id="${esc(r.id)}" title="Double-clic pour modifier les postes">${esc(r.assignedPostes || '—')}</span>`;
            return `
                <tr data-option-row-id="${esc(r.id)}">
                    <td style="width:34px;text-align:center;">
                        <input type="checkbox" data-option-id="${esc(r.id)}" ${checked}>
                    </td>
                    <td>${optionNameCell}${ibp}${idHint}</td>
                    <td><span class="ugap-option-tag ${esc(r.optionTypeClassName || '')}">${esc(r.optionTypeLabel || 'Catalogue')}</span></td>
                    <td class="num">${esc(fmtMoney(r.pricePublic))}</td>
                    <td class="num">${esc(fmtMoney(r.priceUgap))}</td>
                    <td>${postesCell}</td>
                    <td class="ugap-options-adj-cell">${renderSourceAdjCell(r)}</td>
                    <td>${renderFamilySelectCell(r)}</td>
                    <td>${renderGroupSelectCell(r)}</td>
                    <td style="width:42px;text-align:center;">
                        <button type="button" class="ugap-options-row-delete" data-option-id="${esc(r.id)}"
                            title="Supprimer cette option du catalogue"
                            style="border:none;background:#fee2e2;color:#b91c1c;border-radius:4px;width:28px;height:28px;cursor:pointer;font-size:16px;line-height:1;">×</button>
                    </td>
                </tr>
            `;
        }).join('');

        mount.innerHTML = `
            <table class="ugap-detect-table">
                <thead>
                    <tr>
                        <th style="width:34px;"></th>
                        <th>Option</th>
                        <th>Tag</th>
                        <th class="num">Prix public</th>
                        <th class="num">Prix UGAP</th>
                        <th>Postes assignés</th>
                        <th>Libellé Excel source</th>
                        <th>Famille</th>
                        <th>Groupes</th>
                        <th style="width:42px;"></th>
                    </tr>
                </thead>
                <tbody>${body}</tbody>
            </table>
        `;
        if (scrollParent) scrollParent.scrollTop = scrollTop;
        updateSelectVisibleButton();
        if (focusOptionId) focusOptionRow(mount, focusOptionId);
    }

    function deepCloneFamilies() {
        return JSON.parse(JSON.stringify(getFamilies()));
    }

    function uniquePush(list, value) {
        const set = new Set(Array.isArray(list) ? list : []);
        if (value) set.add(value);
        return Array.from(set);
    }

    function tokenizeKeywords(raw) {
        return String(raw || '')
            .split(/[;,|]/g)
            .map((x) => x.trim().toLowerCase())
            .filter(Boolean);
    }

    function normalizeText(value) {
        return String(value || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase();
    }

    function matchKeyword(optionName, keyword) {
        const n = normalizeText(optionName);
        const k = normalizeText(keyword);
        return !!k && n.includes(k);
    }

    function applyAssignmentToFamilies(families, optionIds, familyLabel, groupId) {
        const ids = new Set((optionIds || []).map((x) => String(x || '').trim()).filter(Boolean));
        if (!ids.size) return families;
        const next = Array.isArray(families) ? families : [];

        // Retrait de toutes les familles/groupes existants.
        next.forEach((family) => {
            family.optionIds = (Array.isArray(family.optionIds) ? family.optionIds : [])
                .filter((id) => !ids.has(String(id || '').trim()));
            getDecisionGroups(family).forEach((group) => {
                group.optionIds = (Array.isArray(group.optionIds) ? group.optionIds : [])
                    .filter((id) => !ids.has(String(id || '').trim()));
            });
        });

        const target = findFamilyInList(next, familyLabel);
        if (!target) return next;
        target.optionIds = (Array.isArray(target.optionIds) ? target.optionIds : []);
        ids.forEach((id) => {
            target.optionIds = uniquePush(target.optionIds, id);
        });

        const groups = getDecisionGroups(target);
        if (!target.decisionGroups?.length && groups.length) {
            target.decisionGroups = groups;
        }
        const preferred = String(groupId || '').trim();
        const resolvedGroupId = preferred || resolveDefaultGroupId(target);

        groups.forEach((group) => {
            const gid = String(group?.id || '').trim();
            group.optionIds = Array.isArray(group.optionIds) ? group.optionIds : [];
            if (gid && gid === resolvedGroupId) {
                ids.forEach((id) => {
                    group.optionIds = uniquePush(group.optionIds, id);
                });
            } else {
                group.optionIds = group.optionIds.filter((id) => !ids.has(String(id || '').trim()));
            }
        });

        return next;
    }

    async function saveFamilies(nextFamilies) {
        await global.apiCall('/ui-state', {
            method: 'PUT',
            body: JSON.stringify({
                families: nextFamilies,
                familyGroupTypes: Array.isArray(state.uiState?.familyGroupTypes) ? state.uiState.familyGroupTypes : []
            })
        });
    }

    /** Met à jour les lignes visibles sans recharger tout le catalogue (filtres / scroll conservés). */
    function syncRowsFromFamilies(nextFamilies) {
        state.uiState = { ...(state.uiState || {}), families: nextFamilies };
        const links = buildLinksByOptionId(state.uiState);
        state.rows.forEach((row) => {
            const link = links.get(row.id);
            if (!link) {
                row.familyLabel = '';
                row.groupIds = [];
                row.groups = [];
                return;
            }
            row.familyLabel = String(link.familyLabel || '').trim();
            row.groupIds = Array.from(link.groupIds);
            row.groups = Array.from(link.groupLabels);
        });
        renderRows();
    }

    function resolveGroupIdForFamilyChange(row, familyLabel) {
        const previousGroupId = String((Array.isArray(row?.groupIds) ? row.groupIds[0] : '') || '').trim();
        if (!previousGroupId) return '';
        const family = getFamilyByLabel(familyLabel);
        const groups = getDecisionGroups(family);
        const stillValid = groups.some((g) => String(g?.id || '').trim() === previousGroupId);
        return stillValid ? previousGroupId : '';
    }

    async function saveFamilyLabelsInCatalog(optionIds, familyLabel) {
        const assignments = optionIds.map((id) => ({ optionId: id, familyLabel }));
        if (!assignments.length) return;
        await global.apiCall('/options/assign-families-bulk', {
            method: 'POST',
            body: JSON.stringify({ assignments })
        });
    }

    function selectedOptionIds() {
        return Array.from(state.selectedIds).filter(Boolean);
    }

    function buildDeleteConfirmMessage(optionIds) {
        const ids = Array.isArray(optionIds) ? optionIds : [];
        const ibpCount = ids.filter((id) => isImportGeneratedBaseOption(findRawOptionById(id))).length;
        let msg = ids.length === 1
            ? `Supprimer définitivement cette option du catalogue ?\n\nLes références (familles, groupes, picks de base) seront nettoyées.`
            : `Supprimer définitivement ${ids.length} option(s) du catalogue ?\n\nLes références (familles, groupes, picks de base) seront nettoyées.`;
        if (ibpCount) {
            msg += `\n\nAttention : ${ibpCount} option(s) de base (IBP) — ne supprimez que si vous êtes sûr.`;
        }
        return msg;
    }

    async function deleteOptionsByIds(optionIds) {
        const ids = [...new Set((optionIds || []).map((x) => String(x || '').trim()).filter(Boolean))];
        if (!ids.length) {
            showOptionsStatus('Sélectionner au moins une option.', 'warning');
            return;
        }
        if (!global.confirm?.(buildDeleteConfirmMessage(ids))) return;

        const btn = byId('ugap-options-delete-selected');
        if (btn) {
            btn.disabled = true;
            btn.textContent = 'Suppression…';
        }
        try {
            const res = await global.apiCall('/options/delete-bulk', {
                method: 'POST',
                body: JSON.stringify({ optionIds: ids }),
            });
            const deleted = Number(res?.data?.deletedCount) || ids.length;
            const notFound = Array.isArray(res?.data?.notFoundIds) ? res.data.notFoundIds.length : 0;
            showOptionsStatus(
                notFound
                    ? `${deleted} supprimée(s), ${notFound} introuvable(s).`
                    : `${deleted} option(s) supprimée(s).`,
                'success'
            );
            await loadOptions();
            global.UgapFamilleLcState?.loadFromServer?.();
        } catch (err) {
            showOptionsStatus(err?.message || 'Erreur suppression', 'error');
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.textContent = 'Supprimer la sélection';
            }
        }
    }

    async function applyManualAssign() {
        const familyLabel = String(byId('ugap-options-assign-family')?.value || '').trim();
        const groupId = String(byId('ugap-options-assign-group')?.value || '').trim();
        const optionIds = selectedOptionIds();
        if (!familyLabel) {
            global.showAlert?.('Choisir une famille.', 'warning');
            return;
        }
        if (!optionIds.length) {
            global.showAlert?.('Sélectionner au moins une option.', 'warning');
            return;
        }
        const nextFamilies = applyAssignmentToFamilies(deepCloneFamilies(), optionIds, familyLabel, groupId);
        await saveFamilies(nextFamilies);
        await saveFamilyLabelsInCatalog(optionIds, familyLabel);
        applyFamiliesToLocalState(nextFamilies);
        const resolvedGroupId = groupId || resolveDefaultGroupId(getFamilyByLabel(familyLabel));
        await Promise.all(optionIds.map((id) => autoPersistAdjLinksForIbp(id, familyLabel, resolvedGroupId)));
        renderRows(optionIds[0]);
        global.showAlert?.(`${optionIds.length} option(s) assignée(s).`, 'success');
    }

    async function assignSingleOption(optionId, familyLabel, groupId) {
        const optionIds = [String(optionId || '').trim()].filter(Boolean);
        if (!optionIds.length) return;
        if (!familyLabel) return;
        const nextFamilies = applyAssignmentToFamilies(deepCloneFamilies(), optionIds, familyLabel, groupId || '');
        await saveFamilies(nextFamilies);
        await saveFamilyLabelsInCatalog(optionIds, familyLabel);
        applyFamiliesToLocalState(nextFamilies);
        const resolvedGroupId = groupId || resolveDefaultGroupId(getFamilyByLabel(familyLabel));
        await autoPersistAdjLinksForIbp(optionIds[0], familyLabel, resolvedGroupId);
        renderRows(optionIds[0]);
        showOptionsStatus('Enregistré.', 'success');
    }

    async function updateOptionWithPatch(optionId, patch) {
        const id = String(optionId || '').trim();
        if (!id || !patch || typeof patch !== 'object') return;
        const current = findRawOptionById(id);
        if (!current) throw new Error('Option introuvable.');
        await global.apiCall(`/options/${encodeURIComponent(id)}`, {
            method: 'PUT',
            body: JSON.stringify({ ...current, ...patch, id }),
        });
    }

    function showOptionsStatusInline(message, type = 'info') {
        const el = byId('ugap-options-action-status');
        if (!el) return;
        el.textContent = String(message || '');
        el.dataset.statusType = type;
        el.hidden = !message;
    }

    function ensureOptionEditModals() {
        if (byId('ugap-options-rename-modal') && byId('ugap-options-postes-modal')) return;
        const wrap = document.createElement('div');
        wrap.innerHTML = `
            <div id="ugap-options-rename-modal" hidden class="ugap-model-base-modal">
                <div class="ugap-model-base-modal__panel card">
                    <div class="ugap-model-base-modal__head">
                        <strong>Renommer l'option</strong>
                        <button type="button" class="btn btn-outline" id="ugap-options-rename-close">×</button>
                    </div>
                    <div style="padding:14px;">
                        <div id="ugap-options-rename-option-id" style="margin-bottom:8px;font-size:12px;color:#64748b;"></div>
                        <label style="display:block;font-size:12px;margin-bottom:4px;">Nom de l'option</label>
                        <textarea id="ugap-options-rename-input" rows="4" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:6px;resize:vertical;"></textarea>
                        <div style="margin-top:14px;display:flex;gap:8px;justify-content:flex-end;">
                            <button type="button" class="btn btn-outline" id="ugap-options-rename-cancel">Annuler</button>
                            <button type="button" class="btn btn-primary" id="ugap-options-rename-save">Enregistrer</button>
                        </div>
                    </div>
                </div>
            </div>
            <div id="ugap-options-postes-modal" hidden class="ugap-model-base-modal">
                <div class="ugap-model-base-modal__panel card" style="width:min(640px,96vw);">
                    <div class="ugap-model-base-modal__head">
                        <strong>Modifier les postes assignés</strong>
                        <button type="button" class="btn btn-outline" id="ugap-options-postes-close">×</button>
                    </div>
                    <div style="padding:14px;">
                        <div id="ugap-options-postes-option-id" style="margin-bottom:10px;font-size:12px;color:#64748b;"></div>
                        <div style="margin-bottom:10px;display:flex;gap:8px;flex-wrap:wrap;">
                            <button type="button" class="btn btn-outline" id="ugap-options-postes-select-all">Tout cocher</button>
                            <button type="button" class="btn btn-outline" id="ugap-options-postes-clear-all">Tout décocher</button>
                        </div>
                        <div id="ugap-options-postes-list" style="max-height:320px;overflow:auto;border:1px solid #e5e7eb;border-radius:6px;padding:8px;"></div>
                        <div style="margin-top:14px;display:flex;gap:8px;justify-content:flex-end;">
                            <button type="button" class="btn btn-outline" id="ugap-options-postes-cancel">Annuler</button>
                            <button type="button" class="btn btn-primary" id="ugap-options-postes-save">Enregistrer</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        Array.from(wrap.children).forEach((el) => document.body.appendChild(el));
    }

    function closeRenameModal() {
        const modal = byId('ugap-options-rename-modal');
        if (modal) modal.hidden = true;
    }

    function closePostesModal() {
        const modal = byId('ugap-options-postes-modal');
        if (modal) modal.hidden = true;
    }

    function openRenameModal(optionId) {
        const id = String(optionId || '').trim();
        const row = state.rows.find((r) => r.id === id);
        if (!row) return;
        ensureOptionEditModals();
        const modal = byId('ugap-options-rename-modal');
        const hint = byId('ugap-options-rename-option-id');
        const input = byId('ugap-options-rename-input');
        if (!modal || !(input instanceof HTMLTextAreaElement)) return;
        modal.dataset.optionId = id;
        if (hint) hint.textContent = `ID: ${id}`;
        input.value = String(row.name || '');
        modal.hidden = false;
        requestAnimationFrame(() => input.focus());
    }

    async function saveRenameModal() {
        const modal = byId('ugap-options-rename-modal');
        const input = byId('ugap-options-rename-input');
        if (!modal || !(input instanceof HTMLTextAreaElement)) return;
        const optionId = String(modal.dataset.optionId || '').trim();
        const row = state.rows.find((r) => r.id === optionId);
        if (!row) return closeRenameModal();
        const nextName = String(input.value || '').trim();
        const currentName = String(row.name || '').trim();
        if (!nextName) {
            showOptionsStatusInline('Le nom de l’option est obligatoire.', 'warning');
            return;
        }
        if (nextName === currentName) return closeRenameModal();
        await updateOptionWithPatch(optionId, { name: nextName });
        closeRenameModal();
        await loadOptions();
        showOptionsStatusInline('Nom de l’option mis à jour.', 'success');
    }

    function openPostesModal(optionId) {
        const id = String(optionId || '').trim();
        const row = state.rows.find((r) => r.id === id);
        if (!row) return;
        ensureOptionEditModals();
        const modal = byId('ugap-options-postes-modal');
        const hint = byId('ugap-options-postes-option-id');
        const list = byId('ugap-options-postes-list');
        if (!modal || !list) return;
        modal.dataset.optionId = id;
        const models = getCatalogModels().slice().sort(compareCatalogModelsByPoste);
        list.innerHTML = models.map((m) => {
            const mid = String(m?.id || '').trim();
            if (!mid) return '';
            const checked = 'checked';
            return `
                <label style="display:flex;align-items:center;gap:8px;padding:6px 4px;border-bottom:1px solid #f1f5f9;">
                    <input type="checkbox" data-poste-model-id="${esc(mid)}" ${checked}>
                    <span>${esc(formatCatalogModelLabel(m))}</span>
                </label>
            `;
        }).join('');
        if (hint) hint.textContent = `Option: ${row.name || id}`;
        modal.hidden = false;
    }

    function getCheckedModelIdsFromPostesModal() {
        const list = byId('ugap-options-postes-list');
        if (!list) return [];
        return Array.from(list.querySelectorAll('input[type="checkbox"][data-poste-model-id]:checked'))
            .map((el) => String(el.getAttribute('data-poste-model-id') || '').trim())
            .filter(Boolean);
    }

    async function savePostesModal() {
        const modal = byId('ugap-options-postes-modal');
        if (!modal) return;
        const optionId = String(modal.dataset.optionId || '').trim();
        if (!optionId) return closePostesModal();
        const selectedModelIds = getCheckedModelIdsFromPostesModal();
        await updateOptionWithPatch(optionId, { compatibleModels: selectedModelIds });
        closePostesModal();
        await loadOptions();
        showOptionsStatusInline('Postes assignés mis à jour.', 'success');
    }

    function bindOptionEditModalEvents() {
        if (document.body.dataset.ugapOptionsModalBound === '1') return;
        document.body.dataset.ugapOptionsModalBound = '1';
        document.addEventListener('click', (event) => {
            const target = event.target instanceof Element ? event.target : null;
            if (!target) return;
            if (target.id === 'ugap-options-rename-cancel' || target.id === 'ugap-options-rename-close') {
                closeRenameModal();
                return;
            }
            if (target.id === 'ugap-options-postes-cancel' || target.id === 'ugap-options-postes-close') {
                closePostesModal();
                return;
            }
            if (target.id === 'ugap-options-rename-save') {
                void saveRenameModal().catch((err) => {
                    showOptionsStatusInline(err?.message || 'Erreur renommage option', 'error');
                });
                return;
            }
            if (target.id === 'ugap-options-postes-save') {
                void savePostesModal().catch((err) => {
                    showOptionsStatusInline(err?.message || 'Erreur mise à jour postes', 'error');
                });
                return;
            }
            if (target.id === 'ugap-options-postes-select-all') {
                byId('ugap-options-postes-list')?.querySelectorAll('input[type="checkbox"][data-poste-model-id]')
                    .forEach((el) => { el.checked = true; });
                return;
            }
            if (target.id === 'ugap-options-postes-clear-all') {
                byId('ugap-options-postes-list')?.querySelectorAll('input[type="checkbox"][data-poste-model-id]')
                    .forEach((el) => { el.checked = false; });
                return;
            }
            const renameModal = byId('ugap-options-rename-modal');
            if (renameModal && target === renameModal) {
                closeRenameModal();
                return;
            }
            const postesModal = byId('ugap-options-postes-modal');
            if (postesModal && target === postesModal) {
                closePostesModal();
            }
        });

        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') {
                closeRenameModal();
                closePostesModal();
                return;
            }
            if (event.key === 'Enter') {
                const renameModal = byId('ugap-options-rename-modal');
                if (renameModal && renameModal.hidden === false) {
                    event.preventDefault();
                    void saveRenameModal().catch((err) => {
                        showOptionsStatusInline(err?.message || 'Erreur renommage option', 'error');
                    });
                }
            }
        });
    }

    async function renameOptionById(optionId) {
        openRenameModal(optionId);
    }

    async function updateOptionPostesById(optionId) {
        openPostesModal(optionId);
    }

    function suggestByKeywordsForRow(row) {
        const name = String(row?.name || '').trim();
        if (!name) return null;
        const families = getFamilies();
        let best = null;
        families.forEach((family) => {
            const familyLabel = String(family?.familyLabel || '').trim();
            if (!familyLabel) return;
            const familyKeyword = String(family?.familyKeyword || '').trim();
            let score = 0;
            if (familyKeyword && matchKeyword(name, familyKeyword)) score += 4;
            let bestGroupId = '';
            (Array.isArray(family?.decisionGroups) ? family.decisionGroups : []).forEach((group) => {
                const gKeywords = tokenizeKeywords(group?.keywords);
                const hits = gKeywords.filter((kw) => matchKeyword(name, kw)).length;
                if (hits > 0) {
                    score += hits;
                    if (!bestGroupId) bestGroupId = String(group?.id || '').trim();
                }
            });
            if (score <= 0) return;
            if (!best || score > best.score) {
                best = { familyLabel, groupId: bestGroupId, score };
            }
        });
        if (!best) return null;
        const family = getFamilyByLabel(best.familyLabel);
        if (family && !best.groupId) {
            best.groupId = suggestGroupIdForOptionInFamily(row, family);
        }
        return best;
    }

    async function reassignGroupsForSelectedFamily() {
        const btn = byId('ugap-options-reassign-groups');
        const family = getFamilyByLabel(getAssignFamilyLabel());
        const familyLabel = String(family?.familyLabel || getAssignFamilyLabel() || '').trim();
        if (!familyLabel) {
            showOptionsStatus('Choisir une famille (filtre ou affectation).', 'warning');
            return;
        }
        if (btn) {
            btn.disabled = true;
            btn.textContent = 'Réassignation…';
        }
        try {
            const labelKey = familyLabel.toLowerCase();
            const selectedInFamily = selectedOptionIds().filter((id) => {
                const row = state.rows.find((r) => r.id === id);
                return String(row?.familyLabel || '').trim().toLowerCase() === labelKey;
            });
            const scopeIds = selectedInFamily.length ? selectedInFamily : null;
            const result = reassignGroupsInFamily(deepCloneFamilies(), familyLabel, scopeIds);
            if (result.reason === 'family_not_found') {
                showOptionsStatus(`Famille « ${familyLabel} » introuvable.`, 'warning');
                return;
            }
            if (result.reason === 'no_groups') {
                showOptionsStatus(`La famille « ${familyLabel} » n'a aucun groupe configuré.`, 'warning');
                return;
            }
            if (!result.count) {
                showOptionsStatus(`Aucune option à réassigner pour « ${familyLabel} ».`, 'info');
                return;
            }
            await saveFamilies(result.families);
            applyFamiliesToLocalState(result.families);
            renderRows(scopeIds?.[0] || null);
            showOptionsStatus(
                `${result.count} option(s) réassignée(s) (mot-clé groupe ou groupe par défaut).`,
                'success'
            );
        } catch (err) {
            showOptionsStatus(err?.message || 'Erreur réassignation groupes', 'error');
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.textContent = 'Réassigner groupes';
            }
        }
    }

    async function autoAssignByKeywords() {
        const pool = state.visibleRows.filter((row) => !String(row.familyLabel || '').trim());
        if (!pool.length) {
            global.showAlert?.('Aucune option non assignée dans ce filtre.', 'info');
            return;
        }
        let nextFamilies = deepCloneFamilies();
        const familyBuckets = new Map();
        let touched = 0;
        pool.forEach((row) => {
            const suggestion = suggestByKeywordsForRow(row);
            if (!suggestion?.familyLabel) return;
            touched += 1;
            nextFamilies = applyAssignmentToFamilies(nextFamilies, [row.id], suggestion.familyLabel, suggestion.groupId);
            if (!familyBuckets.has(suggestion.familyLabel)) familyBuckets.set(suggestion.familyLabel, []);
            familyBuckets.get(suggestion.familyLabel).push(row.id);
        });
        if (!touched) {
            global.showAlert?.('Aucune correspondance mot-clé trouvée.', 'warning');
            return;
        }
        await saveFamilies(nextFamilies);
        const bulk = [];
        familyBuckets.forEach((optionIds, familyLabel) => {
            optionIds.forEach((id) => bulk.push({ optionId: id, familyLabel }));
        });
        if (bulk.length) {
            await global.apiCall('/options/assign-families-bulk', {
                method: 'POST',
                body: JSON.stringify({ assignments: bulk })
            });
        }
        applyFamiliesToLocalState(nextFamilies);
        let firstAssignedId = null;
        familyBuckets.forEach((ids) => {
            if (!firstAssignedId && ids.length) firstAssignedId = ids[0];
        });
        renderRows(firstAssignedId);
        global.showAlert?.(`Auto-assignation terminée (${touched} option(s)).`, 'success');
    }

    async function loadOptions() {
        const mount = byId('ugap-options-table-wrap');
        if (!mount) return;
        mount.innerHTML = '<p class="ugap-param-placeholder">Chargement des options…</p>';
        try {
            const [dataRes, uiStateRes] = await Promise.all([
                global.apiCall('/data', { method: 'GET' }),
                global.apiCall('/ui-state', { method: 'GET' }),
            ]);
            state.data = dataRes?.data || {};
            state.uiState = uiStateRes?.data || {};
            state.rows = normalizeRows();
            state.selectedIds.clear();
            fillFamilySelects();
            const searchInput = byId('ugap-options-filter-search');
            if (searchInput) searchInput.value = state.filterQuery;
            renderRows();
        } catch (e) {
            mount.innerHTML = '';
            global.showAlert?.(e?.message || 'Erreur chargement options', 'error');
        }
    }

    function bindEvents() {
        const root = byId('ugap-section-options');
        if (!root || root.dataset.optionsBound === '1') return;
        root.dataset.optionsBound = '1';
        ensureOptionEditModals();
        bindOptionEditModalEvents();

        root.addEventListener('click', (event) => {
            const target = event.target instanceof Element ? event.target : null;
            if (!target) return;

            if (target.closest('#ugap-options-refresh')) {
                void loadOptions();
                return;
            }
            if (target.closest('#ugap-options-reassign-groups')) {
                void reassignGroupsForSelectedFamily();
                return;
            }
            if (target.closest('#ugap-options-apply-manual')) {
                void applyManualAssign().catch((err) => {
                    showOptionsStatus(err?.message || 'Erreur assignation manuelle', 'error');
                });
                return;
            }
            if (target.closest('#ugap-options-auto-assign')) {
                void autoAssignByKeywords().catch((err) => {
                    showOptionsStatus(err?.message || 'Erreur auto-assignation', 'error');
                });
                return;
            }
            if (target.closest('#ugap-options-select-visible')) {
                const visibleIds = state.visibleRows.map((row) => row.id).filter(Boolean);
                const allSelected = visibleIds.length > 0 && visibleIds.every((id) => state.selectedIds.has(id));
                if (allSelected) {
                    visibleIds.forEach((id) => state.selectedIds.delete(id));
                } else {
                    visibleIds.forEach((id) => state.selectedIds.add(id));
                }
                renderRows();
                return;
            }
            if (target.closest('#ugap-options-delete-selected')) {
                void deleteOptionsByIds(selectedOptionIds());
                return;
            }
            const rowDelete = target.closest('.ugap-options-row-delete');
            if (rowDelete) {
                const optionId = String(rowDelete.getAttribute('data-option-id') || '').trim();
                if (optionId) void deleteOptionsByIds([optionId]);
            }
        });

        root.addEventListener('dblclick', (event) => {
            const target = event.target instanceof Element ? event.target : null;
            if (!target) return;
            const nameEl = target.closest('.ugap-options-edit-name');
            if (nameEl) {
                const optionId = String(nameEl.getAttribute('data-option-id') || '').trim();
                if (optionId) {
                    void renameOptionById(optionId).catch((err) => {
                        showOptionsStatus(err?.message || 'Erreur renommage option', 'error');
                    });
                }
                return;
            }
            const postesEl = target.closest('.ugap-options-edit-postes');
            if (postesEl) {
                const optionId = String(postesEl.getAttribute('data-option-id') || '').trim();
                if (optionId) {
                    void updateOptionPostesById(optionId).catch((err) => {
                        showOptionsStatus(err?.message || 'Erreur mise à jour postes', 'error');
                    });
                }
            }
        });

        byId('ugap-options-filter-family')?.addEventListener('change', (e) => {
            state.filterFamily = String(e.target?.value || '');
            updateReassignGroupsButton();
            renderRows();
        });
        byId('ugap-options-filter-model')?.addEventListener('change', (e) => {
            state.filterModel = String(e.target?.value || '').trim();
            renderRows();
        });
        byId('ugap-options-filter-search')?.addEventListener('input', (e) => {
            state.filterQuery = String(e.target?.value || '');
            renderRows();
        });
        byId('ugap-options-filter-status')?.addEventListener('change', (e) => {
            state.filterStatus = String(e.target?.value || 'all');
            renderRows();
        });
        byId('ugap-options-filter-tag')?.addEventListener('change', (e) => {
            state.filterTag = String(e.target?.value || 'all');
            renderRows();
        });
        byId('ugap-options-assign-family')?.addEventListener('change', () => {
            fillGroupAssignSelect();
            updateReassignGroupsButton();
        });

        document.addEventListener('change', (event) => {
            const input = event.target;
            if (!(input instanceof HTMLInputElement)) return;
            if (input.matches('#ugap-options-table-wrap input[type="checkbox"][data-option-id]')) {
                const id = String(input.getAttribute('data-option-id') || '').trim();
                if (!id) return;
                if (input.checked) state.selectedIds.add(id);
                else state.selectedIds.delete(id);
                updateSelectVisibleButton();
                return;
            }
        });

        document.addEventListener('change', (event) => {
            const target = event.target;
            if (!(target instanceof HTMLSelectElement)) return;
            if (target.matches('#ugap-options-table-wrap select[data-row-family-option-id]')) {
                const optionId = String(target.getAttribute('data-row-family-option-id') || '').trim();
                const familyLabel = String(target.value || '').trim();
                const row = state.rows.find((r) => r.id === optionId);
                const groupId = row ? resolveGroupIdForFamilyChange(row, familyLabel) : '';
                void assignSingleOption(optionId, familyLabel, groupId).catch((err) => {
                    showOptionsStatus(err?.message || 'Erreur affectation famille', 'error');
                });
                return;
            }
            if (target.matches('#ugap-options-table-wrap select[data-row-group-option-id]')) {
                const optionId = String(target.getAttribute('data-row-group-option-id') || '').trim();
                const row = state.rows.find((r) => r.id === optionId);
                const familyLabel = String(row?.familyLabel || '').trim();
                const groupId = String(target.value || '').trim();
                if (!familyLabel) return;
                void assignSingleOption(optionId, familyLabel, groupId).catch((err) => {
                    showOptionsStatus(err?.message || 'Erreur affectation groupe', 'error');
                });
            }
        });
    }

    function mountOptionsSection() {
        bindEvents();
        updateReassignGroupsButton();
        void loadOptions();
    }

    global.UgapOptionsTab = { mount: mountOptionsSection, refresh: loadOptions };

    if (byId('ugap-section-options')) {
        bindEvents();
    }
})(window);

