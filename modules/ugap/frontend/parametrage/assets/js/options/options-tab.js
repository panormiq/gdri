/**
 * Section Parametrage > Options
 * Liaison option ↔ nœud catalogue (catalogObjectId) + filtres + auto-assign mots-clés nœuds.
 */
(function initUgapOptionsTab(global) {
    'use strict';

    const state = {
        data: null,
        uiState: null,
        rows: [],
        visibleRows: [],
        selectedIds: new Set(),
        filterCatalogNode: '',
        filterModel: '',
        filterQuery: '',
        filterStatus: 'all',
        filterTag: 'all',
    };

    const CatalogState = () => global.UgapCatalogueLcState;
    const NodesCore = () => global.UgapCatalogueNodesCore;
    const LinkHeur = () => global.UgapCatalogueOptionLinkHeuristic;

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

    function isCatalogMotorTarifOption(opt) {
        if (!opt || typeof opt !== 'object') return false;
        if (isImportGeneratedBaseOption(opt)) return false;
        const MBO = global.UgapModelBaseOptions;
        if (MBO?.isMotorTarifName) return MBO.isMotorTarifName(opt.name);
        const name = String(opt.name || '').replace(/\s+/g, ' ').trim();
        if (!name || /\ben\s+remplacement\b/i.test(name) || /\blieu\s+et\s+place\b/i.test(name)) return false;
        if (!/\b(moteur|motorisation)\b/i.test(name)) return false;
        if (name.length < 55) return false;
        return (
            /\b(hors-bord|essence|diesel|démarrage|direction|hélice|helice|arbre)\b/i.test(name)
            || (/\bDF\d{2,4}/i.test(name) && /\bsuzuki|mercury|yamaha|honda|oxe\b/i.test(name))
        );
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

    function resolveUiTypeKey(opt) {
        return resolveOptionTypeMeta(opt).key;
    }

    /** Patch catalogue pour le type affiché (MINO / MAJO / Base / Catalogue / PR). */
    function buildPatchForUiTypeKey(uiKey) {
        const k = String(uiKey || '').trim().toLowerCase();
        if (k === 'mino') {
            return {
                importOptionLineKind: 'minoration',
                isMinoration: true,
                isSparePart: false,
                manualMinorationAssignment: true,
                manualMajorationAssignment: false,
                manualBaseOption: false,
                baseIncluded: false,
                isBaseOption: false,
            };
        }
        if (k === 'majo') {
            return {
                importOptionLineKind: 'majoration',
                isMinoration: false,
                isSparePart: false,
                manualMajorationAssignment: true,
                manualMinorationAssignment: false,
                manualBaseOption: false,
                baseIncluded: false,
                isBaseOption: false,
            };
        }
        if (k === 'pr') {
            return {
                importOptionLineKind: 'pr',
                isMinoration: false,
                isSparePart: true,
                manualMajorationAssignment: false,
                manualMinorationAssignment: false,
                manualBaseOption: false,
                baseIncluded: false,
                isBaseOption: false,
            };
        }
        if (k === 'base') {
            return {
                importOptionLineKind: 'option',
                isMinoration: false,
                isSparePart: false,
                manualMajorationAssignment: false,
                manualMinorationAssignment: false,
                manualBaseOption: true,
                baseIncluded: true,
                isBaseOption: true,
            };
        }
        return {
            importOptionLineKind: 'option',
            isMinoration: false,
            isSparePart: false,
            manualMajorationAssignment: false,
            manualMinorationAssignment: false,
            manualBaseOption: false,
            baseIncluded: false,
            isBaseOption: false,
        };
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

    function getCatalogNodes() {
        return CatalogState()?.getCatalog?.()?.nodes || [];
    }

    function resolveCatalogNodeLabel(nodeId) {
        const id = String(nodeId || '').trim();
        if (!id) return '';
        const nodes = getCatalogNodes();
        return NodesCore()?.nodeBreadcrumb?.(nodes, id)
            || CatalogState()?.getNodeById?.(id)?.label
            || id;
    }

    function buildNodeSelectOptions() {
        const nodes = getCatalogNodes();
        const options = [];
        const walk = (parentId, depth) => {
            (NodesCore()?.getChildren?.(nodes, parentId) || []).forEach((node) => {
                const path = NodesCore()?.nodeBreadcrumb?.(nodes, node.id) || node.label;
                const prefix = depth > 0 ? `${'　'.repeat(depth)}└ ` : '';
                options.push({ value: node.id, label: `${prefix}${path}` });
                walk(node.id, depth + 1);
            });
        };
        walk('', 0);
        return options;
    }

    function getAssignCatalogNodeId() {
        const assign = String(byId('ugap-options-assign-node')?.value || '').trim();
        if (assign) return assign;
        return String(byId('ugap-options-filter-node')?.value || '').trim();
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
        return String(row.importExcelLabel || row.details || row.name || '').trim();
    }

    function resolveStoredExcelSourceLabel(opt) {
        if (!opt || typeof opt !== 'object') return '';
        return String(opt.importExcelLabel || opt.details || opt.name || '').trim();
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

    function sanitizeRef(ref) {
        return global.UgapRefDisplay?.sanitizeUgapRefForDisplay
            ? global.UgapRefDisplay.sanitizeUgapRefForDisplay(ref)
            : String(ref || '').trim();
    }

    function collectRefEntriesForOption(opt) {
        const o = opt && typeof opt === 'object' ? opt : {};
        const entries = [];
        const seen = new Set();
        const push = (ref, label) => {
            const code = sanitizeRef(ref);
            if (!code) return;
            const key = `${label}:${code.toUpperCase()}`;
            if (seen.has(key)) return;
            seen.add(key);
            entries.push({ ref: code, label: String(label || '').trim() || 'UGAP' });
        };
        push(o.refUgap, 'UGAP');
        const baseRef = sanitizeRef(o.baseRefUgap);
        const mainRef = sanitizeRef(o.refUgap);
        if (baseRef && baseRef.toUpperCase() !== (mainRef || '').toUpperCase()) {
            push(o.baseRefUgap, 'Base');
        }
        const fournisseur = String(o.refFournisseur || '').trim();
        if (fournisseur) {
            const key = `Fournisseur:${fournisseur.toUpperCase()}`;
            if (!seen.has(key)) {
                seen.add(key);
                entries.push({ ref: fournisseur, label: 'Fournisseur' });
            }
        }
        return entries;
    }

    function renderRefUgapCell(row) {
        const opt = findRawOptionById(row.id) || row;
        const entries = collectRefEntriesForOption(opt);
        if (!entries.length) {
            return '<span style="color:#94a3b8;">—</span>';
        }
        const lines = entries.map((entry) => (
            `<div class="ugap-options-ref-line">`
            + `<code class="ugap-options-ref-code">${esc(entry.ref)}</code>`
            + `<span class="ugap-options-ref-label">${esc(entry.label)}</span>`
            + `</div>`
        )).join('');
        return `<div class="ugap-options-ref-stack">${lines}</div>`;
    }

    function normalizeRows() {
        const rows = flattenOptions(state.data).map((opt, idx) => {
            const id = String(opt?.id || '').trim();
            const typeMeta = resolveOptionTypeMeta(opt);
            const isImportBase = isImportGeneratedBaseOption(opt);
            const sourceAdjIds = isImportBase ? resolveSourceAdjIdsForBaseRow(id) : [];
            const excelLabel = String(opt?.importExcelLabel || opt?.details || opt?.name || '').trim();
            const rowDraft = {
                isImportBase,
                importExcelLabel: excelLabel,
                sourceAdjIds,
            };
            const sourceOptionId = isImportBase ? resolveSourceOptionIdForBaseRow(rowDraft) : '';
            const catalogObjectId = String(opt?.catalogObjectId || '').trim();
            const catalogNodeLabel = resolveCatalogNodeLabel(catalogObjectId);
            return {
                id,
                name: String(opt?.name || id || `Option ${idx + 1}`).trim(),
                details: excelLabel,
                importExcelLabel: excelLabel,
                refUgap: String(opt?.refUgap || '').trim(),
                refFournisseur: String(opt?.refFournisseur || '').trim(),
                baseRefUgap: String(opt?.baseRefUgap || '').trim(),
                familyLabel: String(opt?.familyLabel || '').trim(),
                category: String(opt?.__categoryName || '—'),
                pricePublic: Number.isFinite(Number(opt?.priceClient)) ? Number(opt.priceClient) : null,
                priceUgap: Number.isFinite(Number(opt?.priceUgap)) ? Number(opt.priceUgap) : null,
                baseIncluded: opt?.baseIncluded === true,
                assignedPostes: formatAssignedPostes(opt),
                catalogObjectId,
                catalogNodeLabel,
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
                catalogTags: (Array.isArray(opt?.tags) ? opt.tags : [])
                    .map((x) => String(x || '').trim())
                    .filter(Boolean),
                optionType: typeMeta.key,
                optionTypeLabel: typeMeta.label,
                optionTypeClassName: typeMeta.className,
            };
        });

        rows.sort((a, b) => {
            const na = String(a.catalogNodeLabel || '');
            const nb = String(b.catalogNodeLabel || '');
            if (na !== nb) return na.localeCompare(nb, 'fr');
            return String(a.name || '').localeCompare(String(b.name || ''), 'fr');
        });
        return rows;
    }

    function filteredRows() {
        const nodeFilter = String(state.filterCatalogNode || '').trim();
        const modelFilter = String(state.filterModel || '').trim();
        const filterQuery = String(state.filterQuery || '');
        const statusFilter = String(state.filterStatus || 'all');
        const tagFilter = String(state.filterTag || 'all').trim().toLowerCase();
        const Text = () => global.UgapOptionTextMatch;
        return state.rows.filter((row) => {
            const hasNode = !!String(row.catalogObjectId || '').trim();
            if (filterQuery && Text()?.rowMatchesOptionsFilter) {
                if (!Text().rowMatchesOptionsFilter(row, filterQuery)) return false;
            } else if (filterQuery) {
                const query = normalizeText(filterQuery);
                const haystack = normalizeText([
                    row.name,
                    row.details,
                    row.importExcelLabel,
                    row.refUgap,
                    row.refFournisseur,
                    row.baseRefUgap,
                    row.familyLabel,
                    row.catalogNodeLabel,
                    row.category,
                    row.optionTypeLabel,
                    row.optionType,
                    row.assignedPostes,
                ].join(' '));
                if (!haystack.includes(query)) return false;
            }
            const nodeOk = !nodeFilter || String(row.catalogObjectId || '').trim() === nodeFilter;
            if (!nodeOk) return false;
            if (modelFilter) {
                const cm = Array.isArray(row.compatibleModelIds) ? row.compatibleModelIds : [];
                if (!cm.includes(modelFilter)) return false;
            }
            if (tagFilter !== 'all') {
                if (String(row.optionType || '').toLowerCase() !== tagFilter) return false;
            }
            if (statusFilter === 'unassigned') {
                return !hasNode;
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

    function renderNodeSelectCell(row) {
        const current = String(row?.catalogObjectId || '').trim();
        const options = buildNodeSelectOptions().map((opt) => {
            const selected = opt.value === current ? 'selected' : '';
            return `<option value="${esc(opt.value)}" ${selected}>${esc(opt.label)}</option>`;
        }).join('');
        const emptySelected = current ? '' : ' selected';
        return `
            <select
                data-row-node-option-id="${esc(row.id)}"
                style="min-width:220px;padding:4px 6px;border:1px solid #d1d5db;border-radius:6px;background:#fff;"
            >
                <option value=""${emptySelected}>— non lié —</option>
                ${options}
            </select>
        `;
    }

    function getVisibleRowIds() {
        return state.visibleRows.map((row) => row.id).filter(Boolean);
    }

    /** Retire de la sélection les lignes masquées par le filtre courant. */
    function pruneSelectionToVisibleRows() {
        const visible = new Set(getVisibleRowIds());
        Array.from(state.selectedIds).forEach((id) => {
            if (!visible.has(id)) state.selectedIds.delete(id);
        });
    }

    function getSelectedBaseOptionIds() {
        return selectedOptionIds().filter((id) => isImportGeneratedBaseOption(findRawOptionById(id)));
    }

    function updateSelectionActionButtons() {
        updateSelectVisibleButton();
        const mergeBtn = byId('ugap-options-merge-base');
        if (!mergeBtn) return;
        const baseIds = getSelectedBaseOptionIds();
        const canMerge = baseIds.length === 2 && selectedOptionIds().length === 2;
        mergeBtn.disabled = !canMerge;
        mergeBtn.title = canMerge
            ? 'Fusionner les deux options de base sélectionnées'
            : 'Sélectionnez exactement 2 options de type Base';
    }

    function updateSelectVisibleButton() {
        const btn = byId('ugap-options-select-visible');
        if (!btn) return;
        const visibleIds = getVisibleRowIds();
        const allSelected = visibleIds.length > 0 && visibleIds.every((id) => state.selectedIds.has(id));
        btn.textContent = allSelected ? 'Désélectionner la vue' : 'Sélectionner la vue';
    }

    function fillNodeSelects() {
        const nodeFilter = byId('ugap-options-filter-node');
        const nodeAssign = byId('ugap-options-assign-node');
        if (!nodeFilter || !nodeAssign) return;

        const opts = buildNodeSelectOptions().map((opt) =>
            `<option value="${esc(opt.value)}">${esc(opt.label)}</option>`
        ).join('');

        const curFilter = state.filterCatalogNode;
        const curAssign = nodeAssign.value;
        nodeFilter.innerHTML = `<option value="">Tous les nœuds</option>${opts}`;
        nodeAssign.innerHTML = `<option value="">— Retirer le lien —</option>${opts}`;
        if (curFilter) nodeFilter.value = curFilter;
        if (curAssign) nodeAssign.value = curAssign;
        fillModelSelect();
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

    function applyCatalogNodeToLocalRows(optionIds, catalogObjectId) {
        const ids = new Set((optionIds || []).map((x) => String(x || '').trim()).filter(Boolean));
        const nodeId = String(catalogObjectId || '').trim();
        const label = resolveCatalogNodeLabel(nodeId);
        state.rows.forEach((row) => {
            if (!ids.has(row.id)) return;
            row.catalogObjectId = nodeId;
            row.catalogNodeLabel = label;
            const raw = findRawOptionById(row.id);
            if (raw) raw.catalogObjectId = nodeId;
        });
    }

    function renderSourceAdjCell(row) {
        const label = resolveExcelSourceLabelForRow(row);
        const title = 'Cliquer pour modifier le libellé Excel source';
        if (!label) {
            return `<button type="button" class="ugap-options-edit-excel-source ugap-options-edit-excel-source--empty" data-option-id="${esc(row.id)}" title="${title}">Renseigner…</button>`;
        }
        return `<button type="button" class="ugap-options-edit-excel-source" data-option-id="${esc(row.id)}" title="${title}">${esc(label)}</button>`;
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
        pruneSelectionToVisibleRows();
        if (!state.visibleRows.length) {
            mount.innerHTML = '<p class="ugap-param-placeholder">Aucune option pour ce filtre.</p>';
            updateSelectionActionButtons();
            return;
        }
        const body = state.visibleRows.map((r) => {
            const checked = state.selectedIds.has(r.id) ? 'checked' : '';
            const ibp = r.isImportBase
                ? ' <span style="font-size:11px;color:#059669;">Base</span>'
                : '';
            const idHint = r.id
                ? `<div style="margin-top:2px;font-size:11px;color:#64748b;">ID: ${esc(r.id)}</div>`
                : '';
            return `
                <tr data-option-row-id="${esc(r.id)}">
                    <td style="width:34px;text-align:center;">
                        <input type="checkbox" data-option-id="${esc(r.id)}" ${checked}>
                    </td>
                    <td><span class="ugap-options-edit-name" data-option-id="${esc(r.id)}" title="Double-clic pour renommer">${esc(r.name)}</span>${ibp}${idHint}</td>
                    <td class="ugap-options-ref-cell">${renderRefUgapCell(r)}</td>
                    <td class="ugap-options-type-cell"><span class="ugap-option-tag ugap-option-tag--kind ugap-options-edit-type ${esc(r.optionTypeClassName || '')}" data-option-id="${esc(r.id)}" role="button" tabindex="0" title="Cliquer pour modifier le type (MINO, MAJO, Base, Catalogue, PR)">${esc(r.optionTypeLabel || 'Catalogue')}</span></td>
                    <td class="num">${esc(fmtMoney(r.pricePublic))}</td>
                    <td class="num">${esc(fmtMoney(r.priceUgap))}</td>
                    <td><span class="ugap-options-edit-postes" data-option-id="${esc(r.id)}" title="Double-clic pour modifier les postes">${esc(r.assignedPostes || '—')}</span></td>
                    <td class="ugap-options-adj-cell">${renderSourceAdjCell(r)}</td>
                    <td>${renderNodeSelectCell(r)}</td>
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
                        <th>Références</th>
                        <th>Type</th>
                        <th class="num">Prix public</th>
                        <th class="num">Prix UGAP</th>
                        <th>Postes assignés</th>
                        <th>Libellé Excel source</th>
                        <th>Nœud catalogue</th>
                        <th style="width:42px;"></th>
                    </tr>
                </thead>
                <tbody>${body}</tbody>
            </table>
        `;
        if (scrollParent) scrollParent.scrollTop = scrollTop;
        updateSelectionActionButtons();
        if (focusOptionId) focusOptionRow(mount, focusOptionId);
    }

    function normalizeText(value) {
        if (global.UgapOptionTextMatch?.normalizeText) {
            return global.UgapOptionTextMatch.normalizeText(value);
        }
        return String(value || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase();
    }

    async function persistCatalogNodeForOptions(optionIds, catalogObjectId) {
        const Cat = CatalogState();
        if (!Cat?.updateOptionFields) throw new Error('État catalogue indisponible.');
        const nodeId = String(catalogObjectId || '').trim();
        if (nodeId && !Cat.getNodeById?.(nodeId)) {
            throw new Error('Nœud catalogue introuvable.');
        }
        const assignments = optionIds.map((id) => ({ optionId: id, catalogObjectId: nodeId }));
        if (Cat.updateOptionFieldsBulk) {
            await Cat.updateOptionFieldsBulk(assignments);
        } else {
            for (const id of optionIds) {
                await Cat.updateOptionFields(id, { catalogObjectId: nodeId });
            }
        }
        applyCatalogNodeToLocalRows(optionIds, nodeId);
    }

    function selectedOptionIds() {
        return Array.from(state.selectedIds).filter(Boolean);
    }

    function buildDeleteConfirmMessage(optionIds) {
        const ids = Array.isArray(optionIds) ? optionIds : [];
        const ibpCount = ids.filter((id) => isImportGeneratedBaseOption(findRawOptionById(id))).length;
        let msg = ids.length === 1
            ? `Supprimer définitivement cette option du catalogue ?\n\nLes liens nœud catalogue et picks de base seront nettoyés.`
            : `Supprimer définitivement ${ids.length} option(s) du catalogue ?\n\nLes liens nœud catalogue et picks de base seront nettoyés.`;
        if (ibpCount) {
            msg += `\n\nAttention : ${ibpCount} option(s) de base — ne supprimez que si vous êtes sûr.`;
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
            await CatalogState()?.loadFromServer?.(true);
            await loadOptions();
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
        const catalogObjectId = String(byId('ugap-options-assign-node')?.value || '').trim();
        const optionIds = selectedOptionIds();
        if (!optionIds.length) {
            global.showAlert?.('Sélectionner au moins une option.', 'warning');
            return;
        }
        await persistCatalogNodeForOptions(optionIds, catalogObjectId);
        renderRows(optionIds[0]);
        const label = catalogObjectId ? resolveCatalogNodeLabel(catalogObjectId) : 'aucun nœud';
        global.showAlert?.(
            catalogObjectId
                ? `${optionIds.length} option(s) liée(s) à « ${label} ».`
                : `${optionIds.length} option(s) : lien catalogue retiré.`,
            'success'
        );
    }

    async function assignSingleOption(optionId, catalogObjectId) {
        const optionIds = [String(optionId || '').trim()].filter(Boolean);
        if (!optionIds.length) return;
        await persistCatalogNodeForOptions(optionIds, catalogObjectId);
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
        const wrap = document.createElement('div');
        const parts = [];
        if (!byId('ugap-options-rename-modal')) parts.push(`
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
            </div>`);
        if (!byId('ugap-options-postes-modal')) parts.push(`
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
            </div>`);
        if (!byId('ugap-options-type-modal')) parts.push(`
            <div id="ugap-options-type-modal" hidden class="ugap-model-base-modal">
                <div class="ugap-model-base-modal__panel card" style="width:min(420px,96vw);">
                    <div class="ugap-model-base-modal__head">
                        <strong>Modifier le type de ligne</strong>
                        <button type="button" class="btn btn-outline" id="ugap-options-type-close">×</button>
                    </div>
                    <div style="padding:14px;">
                        <div id="ugap-options-type-option-id" style="margin-bottom:10px;font-size:12px;color:#64748b;"></div>
                        <label style="display:block;font-size:12px;margin-bottom:4px;">Type</label>
                        <select id="ugap-options-type-select" style="width:100%;padding:8px;border:1px solid #d1d5db;border-radius:6px;">
                            <option value="catalogue">Catalogue</option>
                            <option value="mino">MINO</option>
                            <option value="majo">MAJO</option>
                            <option value="base">Base</option>
                            <option value="pr">PR</option>
                        </select>
                        <p style="margin:10px 0 0;font-size:12px;color:#64748b;">Correction manuelle si l’import a classé la ligne incorrectement. Les tags catalogue se gèrent sur les nœuds (onglet Catalogue).</p>
                        <div style="margin-top:14px;display:flex;gap:8px;justify-content:flex-end;">
                            <button type="button" class="btn btn-outline" id="ugap-options-type-cancel">Annuler</button>
                            <button type="button" class="btn btn-primary" id="ugap-options-type-save">Enregistrer</button>
                        </div>
                    </div>
                </div>
            </div>`);
        if (!byId('ugap-options-excel-source-modal')) parts.push(`
            <div id="ugap-options-excel-source-modal" hidden class="ugap-model-base-modal">
                <div class="ugap-model-base-modal__panel card" style="width:min(640px,96vw);">
                    <div class="ugap-model-base-modal__head">
                        <strong>Libellé Excel source</strong>
                        <button type="button" class="btn btn-outline" id="ugap-options-excel-source-close">×</button>
                    </div>
                    <div style="padding:14px;">
                        <div id="ugap-options-excel-source-option-id" style="margin-bottom:8px;font-size:12px;color:#64748b;"></div>
                        <label style="display:block;font-size:12px;margin-bottom:4px;">Texte d’origine (fichier Excel)</label>
                        <textarea id="ugap-options-excel-source-input" rows="4" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:6px;resize:vertical;" placeholder="Libellé tel qu’il apparaît dans le tableau Excel…"></textarea>
                        <p style="margin:10px 0 0;font-size:12px;color:#64748b;">Conservé même si le <strong>nom affiché</strong> de l’option est modifié. Laissez vide pour effacer.</p>
                        <div style="margin-top:14px;display:flex;gap:8px;justify-content:flex-end;">
                            <button type="button" class="btn btn-outline" id="ugap-options-excel-source-cancel">Annuler</button>
                            <button type="button" class="btn btn-primary" id="ugap-options-excel-source-save">Enregistrer</button>
                        </div>
                    </div>
                </div>
            </div>`);
        if (!byId('ugap-options-merge-base-modal')) parts.push(`
            <div id="ugap-options-merge-base-modal" hidden class="ugap-model-base-modal">
                <div class="ugap-model-base-modal__panel card" style="width:min(640px,96vw);">
                    <div class="ugap-model-base-modal__head">
                        <strong>Fusionner deux options de base</strong>
                        <button type="button" class="btn btn-outline" id="ugap-options-merge-base-close">×</button>
                    </div>
                    <div style="padding:14px;">
                        <p class="ugap-param-lead" style="margin:0 0 12px;font-size:13px;">
                            Les deux libellés seront conservés comme alias pour le ré-import.
                            Une seule option de base restera dans le catalogue.
                        </p>
                        <div id="ugap-options-merge-base-summary" style="margin-bottom:12px;font-size:12px;color:#64748b;"></div>
                        <fieldset id="ugap-options-merge-base-names" style="border:1px solid #e5e7eb;border-radius:8px;padding:10px 12px;margin:0;">
                            <legend style="font-size:12px;font-weight:600;padding:0 4px;">Nom principal à conserver</legend>
                        </fieldset>
                        <div style="margin-top:14px;display:flex;gap:8px;justify-content:flex-end;">
                            <button type="button" class="btn btn-outline" id="ugap-options-merge-base-cancel">Annuler</button>
                            <button type="button" class="btn btn-primary" id="ugap-options-merge-base-save">Fusionner</button>
                        </div>
                    </div>
                </div>
            </div>`);
        if (!parts.length) return;
        wrap.innerHTML = parts.join('');
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

    function closeTypeModal() {
        const modal = byId('ugap-options-type-modal');
        if (modal) modal.hidden = true;
    }

    function closeExcelSourceModal() {
        const modal = byId('ugap-options-excel-source-modal');
        if (modal) modal.hidden = true;
    }

    function closeExcelSourceModal() {
        const modal = byId('ugap-options-excel-source-modal');
        if (modal) modal.hidden = true;
    }

    function closeMergeBaseModal() {
        const modal = byId('ugap-options-merge-base-modal');
        if (modal) modal.hidden = true;
    }

    function openMergeBaseModal() {
        const baseIds = getSelectedBaseOptionIds();
        if (baseIds.length !== 2 || selectedOptionIds().length !== 2) {
            global.showAlert?.('Sélectionnez exactement 2 options de type Base.', 'warning');
            return;
        }
        ensureOptionEditModals();
        const modal = byId('ugap-options-merge-base-modal');
        const summary = byId('ugap-options-merge-base-summary');
        const fieldset = byId('ugap-options-merge-base-names');
        if (!modal || !fieldset) return;

        const rows = baseIds.map((id) => state.rows.find((r) => r.id === id)).filter(Boolean);
        if (rows.length !== 2) return;

        modal.dataset.optionIdA = rows[0].id;
        modal.dataset.optionIdB = rows[1].id;
        if (summary) {
            summary.innerHTML = rows.map((r) => `<div><code>${esc(r.id)}</code> — ${esc(r.name)}</div>`).join('');
        }
        fieldset.innerHTML = `<legend style="font-size:12px;font-weight:600;padding:0 4px;">Nom principal à conserver</legend>`
            + rows.map((r, index) => `
                <label style="display:flex;align-items:flex-start;gap:8px;padding:8px 4px;cursor:pointer;font-size:13px;">
                    <input type="radio" name="ugap-merge-base-name" value="${esc(r.id)}" ${index === 0 ? 'checked' : ''}>
                    <span>${esc(String(r.name || r.id).trim())}</span>
                </label>
            `).join('');

        modal.hidden = false;
    }

    async function saveMergeBaseModal() {
        const modal = byId('ugap-options-merge-base-modal');
        if (!modal) return;
        const idA = String(modal.dataset.optionIdA || '').trim();
        const idB = String(modal.dataset.optionIdB || '').trim();
        const picked = modal.querySelector('input[name="ugap-merge-base-name"]:checked');
        const primaryOptionId = String(picked?.value || '').trim();
        if (!idA || !idB || !primaryOptionId) return;
        const secondaryOptionId = primaryOptionId === idA ? idB : idA;
        const primaryRow = state.rows.find((r) => r.id === primaryOptionId);
        const primaryName = String(primaryRow?.name || '').trim();
        if (!primaryName) {
            showOptionsStatusInline('Nom principal invalide.', 'warning');
            return;
        }
        if (!global.confirm?.(
            `Fusionner ces deux options de base ?\n\nNom conservé : ${primaryName}\n\nL'autre libellé sera gardé en alias pour le ré-import.`
        )) return;

        await global.apiCall('/options/merge-base', {
            method: 'POST',
            body: JSON.stringify({ primaryOptionId, secondaryOptionId, primaryName }),
        });
        closeMergeBaseModal();
        state.selectedIds.clear();
        await CatalogState()?.loadFromServer?.(true);
        await loadOptions();
        if (global.UgapLiaisonsTab?.loadLiaisons) {
            await global.UgapLiaisonsTab.loadLiaisons();
        }
        showOptionsStatusInline('Options de base fusionnées.', 'success');
        global.showAlert?.('Options de base fusionnées.', 'success');
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
        const opt = findRawOptionById(optionId);
        const patch = { name: nextName };
        if (opt && !resolveStoredExcelSourceLabel(opt) && currentName) {
            patch.importExcelLabel = currentName;
            patch.details = currentName;
        }
        await updateOptionWithPatch(optionId, patch);
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
        const assigned = new Set(
            (Array.isArray(row.compatibleModelIds) ? row.compatibleModelIds : [])
                .map((x) => String(x || '').trim())
                .filter(Boolean)
        );
        list.innerHTML = models.map((m) => {
            const mid = String(m?.id || '').trim();
            if (!mid) return '';
            const checked = assigned.has(mid) ? ' checked' : '';
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
            if (target.id === 'ugap-options-type-cancel' || target.id === 'ugap-options-type-close') {
                closeTypeModal();
                return;
            }
            if (target.id === 'ugap-options-type-save') {
                void saveTypeModal().catch((err) => {
                    showOptionsStatusInline(err?.message || 'Erreur mise à jour type', 'error');
                });
                return;
            }
            if (target.id === 'ugap-options-excel-source-cancel' || target.id === 'ugap-options-excel-source-close') {
                closeExcelSourceModal();
                return;
            }
            if (target.id === 'ugap-options-excel-source-save') {
                void saveExcelSourceModal().catch((err) => {
                    showOptionsStatusInline(err?.message || 'Erreur mise à jour libellé Excel', 'error');
                });
                return;
            }
            if (target.id === 'ugap-options-merge-base-cancel' || target.id === 'ugap-options-merge-base-close') {
                closeMergeBaseModal();
                return;
            }
            if (target.id === 'ugap-options-merge-base-save') {
                void saveMergeBaseModal().catch((err) => {
                    showOptionsStatusInline(err?.message || 'Erreur fusion options de base', 'error');
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
                return;
            }
            const typeModal = byId('ugap-options-type-modal');
            if (typeModal && target === typeModal) {
                closeTypeModal();
                return;
            }
            const excelModal = byId('ugap-options-excel-source-modal');
            if (excelModal && target === excelModal) {
                closeExcelSourceModal();
                return;
            }
            const mergeModal = byId('ugap-options-merge-base-modal');
            if (mergeModal && target === mergeModal) {
                closeMergeBaseModal();
                return;
            }
        });

        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') {
                closeRenameModal();
                closePostesModal();
                closeTypeModal();
                closeExcelSourceModal();
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

    function openTypeModal(optionId) {
        const id = String(optionId || '').trim();
        const row = state.rows.find((r) => r.id === id);
        const opt = findRawOptionById(id);
        if (!row || !opt) return;
        if (row.isImportBase || isImportGeneratedBaseOption(opt)) {
            showOptionsStatusInline('Le type des options de base (import) n’est pas modifiable ici.', 'warning');
            return;
        }
        ensureOptionEditModals();
        const modal = byId('ugap-options-type-modal');
        const hint = byId('ugap-options-type-option-id');
        const select = byId('ugap-options-type-select');
        if (!modal || !(select instanceof HTMLSelectElement)) return;
        modal.dataset.optionId = id;
        select.value = resolveUiTypeKey(opt);
        const baseOpt = select.querySelector('option[value="base"]');
        const motorTarif = isCatalogMotorTarifOption(opt);
        if (baseOpt) {
            baseOpt.disabled = motorTarif;
            baseOpt.title = motorTarif
                ? 'Ligne tarif moteur catalogue : utiliser une option de base (import), pas une MAJO'
                : '';
        }
        if (hint) {
            hint.textContent = motorTarif
                ? `Option: ${row.name || id} — tarif moteur : type Base indisponible (option de base à l’import).`
                : `Option: ${row.name || id}`;
        }
        modal.hidden = false;
        requestAnimationFrame(() => select.focus());
    }

    async function saveTypeModal() {
        const modal = byId('ugap-options-type-modal');
        const select = byId('ugap-options-type-select');
        if (!modal || !(select instanceof HTMLSelectElement)) return;
        const optionId = String(modal.dataset.optionId || '').trim();
        const opt = findRawOptionById(optionId);
        if (!opt) return closeTypeModal();
        const nextKey = String(select.value || '').trim().toLowerCase();
        const currentKey = resolveUiTypeKey(opt);
        if (nextKey === currentKey) return closeTypeModal();
        const patch = buildPatchForUiTypeKey(nextKey);
        if (nextKey !== 'base' && isImportGeneratedBaseOption(opt)) {
            patch.importGeneratedFromBaseProduct = false;
            patch.isBaseOption = false;
            delete patch.importBaseProductId;
        }
        await updateOptionWithPatch(optionId, patch);
        closeTypeModal();
        await loadOptions();
        showOptionsStatusInline('Type de ligne mis à jour.', 'success');
    }

    async function updateOptionTypeById(optionId) {
        openTypeModal(optionId);
    }

    function openExcelSourceModal(optionId) {
        const id = String(optionId || '').trim();
        const row = state.rows.find((r) => r.id === id);
        const opt = findRawOptionById(id);
        if (!row || !opt) return;
        ensureOptionEditModals();
        const modal = byId('ugap-options-excel-source-modal');
        const hint = byId('ugap-options-excel-source-option-id');
        const input = byId('ugap-options-excel-source-input');
        if (!modal || !(input instanceof HTMLTextAreaElement)) return;
        modal.dataset.optionId = id;
        const stored = resolveStoredExcelSourceLabel(opt);
        input.value = stored || String(row.name || '').trim();
        if (hint) {
            hint.textContent = stored
                ? `Option: ${row.name || id}`
                : `Option: ${row.name || id} — libellé non enregistré (nom affiché proposé par défaut)`;
        }
        modal.hidden = false;
        requestAnimationFrame(() => input.focus());
    }

    async function saveExcelSourceModal() {
        const modal = byId('ugap-options-excel-source-modal');
        const input = byId('ugap-options-excel-source-input');
        if (!modal || !(input instanceof HTMLTextAreaElement)) return;
        const optionId = String(modal.dataset.optionId || '').trim();
        const opt = findRawOptionById(optionId);
        if (!opt) return closeExcelSourceModal();
        const nextLabel = String(input.value || '').trim();
        const currentLabel = resolveStoredExcelSourceLabel(opt);
        if (nextLabel === currentLabel) return closeExcelSourceModal();
        await updateOptionWithPatch(optionId, {
            importExcelLabel: nextLabel,
            details: nextLabel,
        });
        closeExcelSourceModal();
        await loadOptions();
        showOptionsStatusInline('Libellé Excel source mis à jour.', 'success');
    }

    async function updateExcelSourceById(optionId) {
        openExcelSourceModal(optionId);
    }

    function syncTagFilterSelectOptions() {
        const sel = byId('ugap-options-filter-tag');
        if (!sel) return;
        const current = String(state.filterTag || 'all');
        const types = [
            { value: 'all', label: 'Tous les types' },
            { value: 'catalogue', label: 'Catalogue' },
            { value: 'mino', label: 'MINO' },
            { value: 'majo', label: 'MAJO' },
            { value: 'base', label: 'Base' },
            { value: 'pr', label: 'PR' },
        ];
        sel.innerHTML = types.map((o) =>
            `<option value="${esc(o.value)}"${o.value === current ? ' selected' : ''}>${esc(o.label)}</option>`
        ).join('');
    }

    function suggestCatalogNodeForRow(row) {
        const opt = findRawOptionById(row?.id);
        if (!opt) return null;
        const Heur = LinkHeur();
        if (!Heur?.scoreOptionForCatalogObject) return null;

        const nodes = getCatalogNodes().filter((n) => String(n?.keywords || '').trim());
        let best = null;
        nodes.forEach((node) => {
            const hit = Heur.scoreOptionForCatalogObject(opt, node);
            if (!hit?.score) return;
            if (!best || hit.score > best.score) {
                best = { catalogObjectId: String(node.id || '').trim(), score: hit.score };
            }
        });
        return best;
    }

    async function autoAssignByKeywords() {
        const pool = state.visibleRows.filter((row) => !String(row.catalogObjectId || '').trim());
        if (!pool.length) {
            global.showAlert?.('Aucune option sans nœud catalogue dans ce filtre.', 'info');
            return;
        }
        const nodesWithKw = getCatalogNodes().filter((n) => String(n?.keywords || '').trim());
        if (!nodesWithKw.length) {
            global.showAlert?.('Aucun nœud catalogue avec mots-clés — configurez-les dans l’onglet Catalogue.', 'warning');
            return;
        }

        const updates = [];
        pool.forEach((row) => {
            const suggestion = suggestCatalogNodeForRow(row);
            if (!suggestion?.catalogObjectId) return;
            updates.push({ optionId: row.id, catalogObjectId: suggestion.catalogObjectId });
        });
        if (!updates.length) {
            global.showAlert?.('Aucune correspondance mot-clé trouvée (même règle que les liaisons Catalogue).', 'warning');
            return;
        }

        const Cat = CatalogState();
        if (Cat?.updateOptionFieldsBulk) {
            await Cat.updateOptionFieldsBulk(
                updates.map((item) => ({
                    optionId: item.optionId,
                    catalogObjectId: item.catalogObjectId,
                }))
            );
            updates.forEach((item) => {
                applyCatalogNodeToLocalRows([item.optionId], item.catalogObjectId);
            });
        } else {
            for (const item of updates) {
                await persistCatalogNodeForOptions([item.optionId], item.catalogObjectId);
            }
        }
        renderRows(updates[0]?.optionId || null);
        global.showAlert?.(`Auto-assignation terminée (${updates.length} option(s) liée(s) à un nœud).`, 'success');
    }

    async function resetAllOptionAssignments() {
        const msg = [
            'Réinitialiser tous les liens option → nœud catalogue ?',
            '',
            'Conservé : les options, l’arbre catalogue et les mots-clés des nœuds.',
            'Retiré : catalogObjectId sur chaque option liée.',
        ].join('\n');
        const ok = typeof global.confirm === 'function' ? global.confirm(msg) : window.confirm(msg);
        if (!ok) return;

        const btn = byId('ugap-options-reset-assignments');
        if (btn) {
            btn.disabled = true;
            btn.textContent = 'Réinitialisation…';
        }
        try {
            const res = await global.apiCall('/options/reset-family-assignments', { method: 'POST' });
            const n = Number(res?.data?.catalogClearedCount || 0);
            await CatalogState()?.loadFromServer?.(true);
            await loadOptions();
            const text = `Liens catalogue réinitialisés (${n} option(s) déliée(s)).`;
            showOptionsStatus(text, 'success');
            global.showAlert?.(text, 'success');
        } catch (err) {
            showOptionsStatus(err?.message || 'Erreur réinitialisation assignations', 'error');
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.textContent = 'Réinitialiser assignations';
            }
        }
    }

    async function loadOptions() {
        const mount = byId('ugap-options-table-wrap');
        if (!mount) return;
        mount.innerHTML = '<p class="ugap-param-placeholder">Chargement des options…</p>';
        try {
            await CatalogState()?.loadFromServer?.();
            const [dataRes, uiStateRes] = await Promise.all([
                global.apiCall('/data', { method: 'GET' }),
                global.apiCall('/ui-state', { method: 'GET' }),
            ]);
            state.data = dataRes?.data || {};
            state.uiState = uiStateRes?.data || {};
            CatalogState()?.syncOptionsIndexFromPayload?.(state.data);
            state.rows = normalizeRows();
            state.selectedIds.clear();
            fillNodeSelects();
            syncTagFilterSelectOptions();
            const searchInput = byId('ugap-options-filter-search');
            if (searchInput) searchInput.value = state.filterQuery;
            renderRows();
            try {
                await global.UgapBateauBaseLcState?.loadFromServer?.(true);
            } catch (_e) { /* templates optionnels */ }
            const runtimeData = typeof global.getUgapCurrentData === 'function'
                ? global.getUgapCurrentData()
                : state.data;
            global.UgapOptionsCreateModal?.syncContext?.(runtimeData || state.data, state.uiState);
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
            if (target.closest('#ugap-options-reset-assignments')) {
                void resetAllOptionAssignments().catch((err) => {
                    showOptionsStatus(err?.message || 'Erreur réinitialisation assignations', 'error');
                });
                return;
            }
            if (target.closest('#ugap-options-select-visible')) {
                const visibleIds = getVisibleRowIds();
                const allSelected = visibleIds.length > 0 && visibleIds.every((id) => state.selectedIds.has(id));
                if (allSelected) {
                    visibleIds.forEach((id) => state.selectedIds.delete(id));
                } else {
                    state.selectedIds.clear();
                    visibleIds.forEach((id) => state.selectedIds.add(id));
                }
                renderRows();
                return;
            }
            if (target.closest('#ugap-options-delete-selected')) {
                void deleteOptionsByIds(selectedOptionIds());
                return;
            }
            if (target.closest('#ugap-options-merge-base')) {
                openMergeBaseModal();
                return;
            }
            const rowDelete = target.closest('.ugap-options-row-delete');
            if (rowDelete) {
                const optionId = String(rowDelete.getAttribute('data-option-id') || '').trim();
                if (optionId) void deleteOptionsByIds([optionId]);
            }
        });

        root.addEventListener('click', (event) => {
            const target = event.target instanceof Element ? event.target : null;
            if (!target) return;
            const excelEl = target.closest('.ugap-options-edit-excel-source');
            if (excelEl) {
                const optionId = String(excelEl.getAttribute('data-option-id') || '').trim();
                if (optionId) {
                    event.preventDefault();
                    void updateExcelSourceById(optionId).catch((err) => {
                        showOptionsStatus(err?.message || 'Erreur libellé Excel source', 'error');
                    });
                }
                return;
            }
            const typeEl = target.closest('.ugap-options-edit-type');
            if (typeEl) {
                const optionId = String(typeEl.getAttribute('data-option-id') || '').trim();
                if (optionId) {
                    event.preventDefault();
                    void updateOptionTypeById(optionId).catch((err) => {
                        showOptionsStatus(err?.message || 'Erreur mise à jour type', 'error');
                    });
                }
                return;
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

        byId('ugap-options-filter-node')?.addEventListener('change', (e) => {
            state.filterCatalogNode = String(e.target?.value || '').trim();
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
        document.addEventListener('change', (event) => {
            const input = event.target;
            if (!(input instanceof HTMLInputElement)) return;
            if (input.matches('#ugap-options-table-wrap input[type="checkbox"][data-option-id]')) {
                const id = String(input.getAttribute('data-option-id') || '').trim();
                if (!id) return;
                if (input.checked) state.selectedIds.add(id);
                else state.selectedIds.delete(id);
                updateSelectionActionButtons();
                return;
            }
        });

        document.addEventListener('change', (event) => {
            const target = event.target;
            if (!(target instanceof HTMLSelectElement)) return;
            if (target.matches('#ugap-options-table-wrap select[data-row-node-option-id]')) {
                const optionId = String(target.getAttribute('data-row-node-option-id') || '').trim();
                const catalogObjectId = String(target.value || '').trim();
                void assignSingleOption(optionId, catalogObjectId).catch((err) => {
                    showOptionsStatus(err?.message || 'Erreur liaison nœud catalogue', 'error');
                });
            }
        });
    }

    function mountOptionsSection() {
        global.UgapOptionsCreateModal?.mount?.();
        bindEvents();
        void loadOptions();
    }

    global.UgapOptionsTab = { mount: mountOptionsSection, refresh: loadOptions };

    if (byId('ugap-section-options')) {
        global.UgapOptionsCreateModal?.mount?.();
        bindEvents();
    }
})(window);

