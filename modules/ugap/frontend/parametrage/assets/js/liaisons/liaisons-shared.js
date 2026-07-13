/**
 * FICHIER : parametrage/assets/js/liaisons/liaisons-shared.js
 * RÔLE : Utilitaires partagés onglet Liaisons (options, libellés, état).
 */
(function initUgapLiaisonsShared(global) {
    'use strict';

    const store = {
        data: null,
        subTab: 'incompatibility',
        filterQuery: '',
        filterCatalogNode: '',
        filterModel: '',
        filterTag: 'all',
        filterStatus: 'all',
    };

    function byId(id) {
        return document.getElementById(id);
    }

    function esc(v) {
        if (typeof global.escapeHtml === 'function') return global.escapeHtml(v);
        return String(v ?? '');
    }

    function normalizeText(value) {
        return String(value || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase();
    }

    function flattenOptions(data) {
        const out = [];
        (Array.isArray(data?.categories) ? data.categories : []).forEach((cat) => {
            (Array.isArray(cat?.options) ? cat.options : []).forEach((opt) => {
                if (opt && typeof opt === 'object') {
                    out.push({ ...opt, __categoryName: cat?.name || '' });
                }
            });
        });
        return out;
    }

    function findOptionById(optionId, data) {
        const payload = data || store.data;
        const oid = String(optionId || '').trim();
        if (!oid) return null;
        return flattenOptions(payload).find((opt) => String(opt?.id || '').trim() === oid) || null;
    }

    function optionLabel(optionId, data) {
        const opt = findOptionById(optionId, data);
        return String(opt?.name || optionId || '').trim() || '—';
    }

    function inferAdjKind(opt) {
        const B = global.UgapBaseAdjLinks;
        if (B?.inferAdjLineKind) return B.inferAdjLineKind(opt);
        return 'option';
    }

    function isIbp(opt) {
        const B = global.UgapBaseAdjLinks;
        if (B?.isImportGeneratedBaseOption) return B.isImportGeneratedBaseOption(opt);
        return false;
    }

    function bal() {
        return global.UgapBaseAdjLinks || null;
    }

    function showSectionStatus(message, type) {
        const el = byId('ugap-liaisons-status');
        if (!el) return;
        if (!message) {
            el.hidden = true;
            el.textContent = '';
            return;
        }
        el.hidden = false;
        el.className = `ugap-liaisons-status alert alert-${type || 'info'}`;
        el.textContent = message;
    }

    function buildOptionSelectOptions(data, selectedId) {
        const cur = String(selectedId || '').trim();
        return flattenOptions(data)
            .slice()
            .sort((a, b) => String(a?.name || '').localeCompare(String(b?.name || ''), 'fr'))
            .map((opt) => {
                const id = String(opt?.id || '').trim();
                if (!id) return '';
                const sel = id === cur ? ' selected' : '';
                return `<option value="${esc(id)}"${sel}>${esc(String(opt.name || id).trim())}</option>`;
            })
            .join('');
    }

    function typeLabel(type) {
        const map = {
            incompatibility: 'Incompatibilité',
            complementary: 'Complémentaire',
            auto_add: 'Ajout auto',
            requires: 'Prérequis',
            variant_fit: 'Variante recommandée',
            equivalent_base: 'Base équivalente',
        };
        return map[String(type || '').trim()] || String(type || '—');
    }

    function normalizeIbpGroupKey(name) {
        return normalizeText(name)
            .replace(/\btubulaire\b/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function equivalentBaseRules(data) {
        return (Array.isArray((data || store.data)?.optionLinkRules) ? (data || store.data).optionLinkRules : [])
            .filter((rule) => String(rule?.type || '') === 'equivalent_base');
    }

    function buildEquivalentBaseClusters(data) {
        const parent = new Map();
        const find = (id) => {
            const cur = String(id || '').trim();
            if (!cur) return '';
            if (!parent.has(cur)) parent.set(cur, cur);
            if (parent.get(cur) !== cur) parent.set(cur, find(parent.get(cur)));
            return parent.get(cur);
        };
        const union = (a, b) => {
            const ra = find(a);
            const rb = find(b);
            if (ra && rb && ra !== rb) parent.set(rb, ra);
        };

        equivalentBaseRules(data).forEach((rule) => {
            const members = [
                ...(Array.isArray(rule.sourceOptionIds) ? rule.sourceOptionIds : []),
                ...(Array.isArray(rule.targetOptionIds) ? rule.targetOptionIds : []),
            ].map((x) => String(x || '').trim()).filter(Boolean);
            members.forEach((id) => find(id));
            members.forEach((id, idx) => { if (idx > 0) union(members[0], id); });
        });

        const importBaseProducts = Array.isArray((data || store.data)?.importBaseProducts)
            ? (data || store.data).importBaseProducts
            : [];
        importBaseProducts.forEach((bp) => {
            const primary = String(bp?.catalogOptionId || '').trim();
            if (!primary) return;
            find(primary);
            (Array.isArray(bp.mergedCatalogOptionIds) ? bp.mergedCatalogOptionIds : []).forEach((mid) => {
                const mergedId = String(mid || '').trim();
                if (mergedId) union(primary, mergedId);
            });
        });

        const ibpByImportBp = new Map();
        flattenOptions(data || store.data)
            .filter(isIbp)
            .forEach((opt) => {
                const id = String(opt?.id || '').trim();
                const bpId = String(opt?.importBaseProductId || '').trim();
                if (!id) return;
                find(id);
                if (!bpId) return;
                if (!ibpByImportBp.has(bpId)) ibpByImportBp.set(bpId, []);
                ibpByImportBp.get(bpId).push(id);
            });
        ibpByImportBp.forEach((ids) => {
            ids.forEach((id, idx) => { if (idx > 0) union(ids[0], id); });
        });

        flattenOptions(data || store.data)
            .filter(isIbp)
            .forEach((opt) => {
                const id = String(opt?.id || '').trim();
                if (id) find(id);
            });

        const clusters = new Map();
        parent.forEach((_root, id) => {
            const root = find(id);
            if (!root) return;
            if (!clusters.has(root)) clusters.set(root, new Set());
            clusters.get(root).add(id);
        });
        flattenOptions(data || store.data)
            .filter(isIbp)
            .forEach((opt) => {
                const id = String(opt?.id || '').trim();
                if (!id) return;
                const root = find(id) || id;
                if (!clusters.has(root)) clusters.set(root, new Set());
                clusters.get(root).add(id);
            });
        return { find, union, clusters };
    }

    function optionRoleLabel(opt) {
        if (isIbp(opt)) return 'Base';
        const kind = inferAdjKind(opt);
        if (kind === 'minoration') return 'MINO';
        if (kind === 'majoration') return 'MAJO';
        return 'Option';
    }

    function optionRoleClass(opt) {
        if (isIbp(opt)) return 'ugap-liaisons-role--ibp';
        const kind = inferAdjKind(opt);
        if (kind === 'minoration') return 'ugap-liaisons-role--mino';
        if (kind === 'majoration') return 'ugap-liaisons-role--majo';
        return 'ugap-liaisons-role--opt';
    }

    function typeBadgeClass(type) {
        const map = {
            incompatibility: 'ugap-liaisons-type--incompatibility',
            complementary: 'ugap-liaisons-type--complementary',
            auto_add: 'ugap-liaisons-type--auto-add',
            requires: 'ugap-liaisons-type--requires',
            variant_fit: 'ugap-liaisons-type--variant-fit',
        };
        return map[String(type || '').trim()] || '';
    }

    function resolveOptionTypeKey(opt) {
        if (!opt || typeof opt !== 'object') return 'catalogue';
        if (isIbp(opt)) return 'base';
        const OLK = global.UgapOptionLineKind;
        const lineKind = OLK?.inferOptionLineKind ? OLK.inferOptionLineKind(opt) : inferAdjKind(opt);
        if (lineKind === 'minoration') return 'mino';
        if (lineKind === 'majoration') return 'majo';
        if (lineKind === 'pr') return 'pr';
        if (opt.isBaseOption === true || opt.baseIncluded === true || opt.manualBaseOption === true) {
            return 'base';
        }
        return 'catalogue';
    }

    function optionTypeMeta(opt) {
        const key = resolveOptionTypeKey(opt);
        const map = {
            base: { label: 'Base', className: 'ugap-option-tag--base' },
            mino: { label: 'MINO', className: 'ugap-option-tag--mino' },
            majo: { label: 'MAJO', className: 'ugap-option-tag--majo' },
            pr: { label: 'PR', className: 'ugap-option-tag--pr' },
            catalogue: { label: 'Catalogue', className: 'ugap-option-tag--catalogue' },
        };
        const hit = map[key] || map.catalogue;
        return { key, label: hit.label, className: hit.className };
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
        if (fournisseur) push(fournisseur, 'Fournisseur');
        return entries;
    }

    function renderRefCellHtml(opt) {
        const entries = collectRefEntriesForOption(opt);
        if (!entries.length) return '<span style="color:#94a3b8;">—</span>';
        const lines = entries.map((entry) => (
            `<div class="ugap-options-ref-line">`
            + `<code class="ugap-options-ref-code">${esc(entry.ref)}</code>`
            + `<span class="ugap-options-ref-label">${esc(entry.label)}</span>`
            + `</div>`
        )).join('');
        return `<div class="ugap-options-ref-stack">${lines}</div>`;
    }

    function formatAssignedPostes(opt) {
        const models = global.UgapCatalogueLcState?.getCatalogModels?.() || [];
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

    function buildMemberDisplayRow(optionId, data) {
        const opt = findOptionById(optionId, data);
        if (!opt) return null;
        const filterRow = buildOptionFilterRow(opt, data);
        const type = optionTypeMeta(opt);
        const excelLabel = String(filterRow.importExcelLabel || '').trim();
        return {
            id: String(optionId || '').trim(),
            name: String(filterRow.name || optionId).trim(),
            importExcelLabel: excelLabel,
            optionType: type.key,
            optionTypeLabel: type.label,
            optionTypeClassName: type.className,
            assignedPostes: formatAssignedPostes(opt),
        };
    }

    function renderMemberTableHeadHtml() {
        return `
            <thead>
                <tr>
                    <th style="width:28px;"></th>
                    <th>Option</th>
                    <th>Références</th>
                    <th>Type</th>
                    <th>Postes assignés</th>
                    <th>Libellé Excel source</th>
                </tr>
            </thead>
        `;
    }

    function renderMemberTableRowHtml(row, options = {}) {
        const opts = options && typeof options === 'object' ? options : {};
        const groupId = String(opts.groupId || '').trim();
        const selectable = opts.selectable !== false;
        const selected = opts.selected === true;
        const opt = findOptionById(row?.id);
        const excel = row?.importExcelLabel
            ? `<span class="ugap-liaisons-cell-excel" title="${esc(row.importExcelLabel)}">${esc(row.importExcelLabel)}</span>`
            : '<span style="color:#94a3b8;">—</span>';
        const rowClass = [
            'ugap-liaisons-member-row',
            selectable ? '' : 'ugap-liaisons-member-row--readonly',
            selected ? 'is-selected' : '',
        ].filter(Boolean).join(' ');
        return `
            <tr class="${rowClass}"
                ${groupId ? `data-group-id="${esc(groupId)}"` : ''}
                data-option-id="${esc(row.id)}"
                ${selectable ? 'role="button" tabindex="0" title="Sélectionner pour retirer du groupe"' : ''}>
                <td class="ugap-liaisons-member-row__pick">${selected ? '●' : ''}</td>
                <td class="ugap-liaisons-member-row__name"><strong>${esc(row.name || row.id)}</strong></td>
                <td class="ugap-options-ref-cell">${renderRefCellHtml(opt)}</td>
                <td class="ugap-options-type-cell"><span class="ugap-option-tag ugap-option-tag--kind ${esc(row.optionTypeClassName || '')}">${esc(row.optionTypeLabel || 'Catalogue')}</span></td>
                <td>${esc(row.assignedPostes || '—')}</td>
                <td>${excel}</td>
            </tr>
        `;
    }

    function renderMembersTableHtml(memberIds, options = {}) {
        const opts = options && typeof options === 'object' ? options : {};
        const data = store.data;
        const body = (Array.isArray(memberIds) ? memberIds : [])
            .map((optionId) => {
                const row = buildMemberDisplayRow(optionId, data);
                if (!row) return '';
                const selected = opts.selectedOptionId === optionId;
                return renderMemberTableRowHtml(row, {
                    groupId: opts.groupId,
                    selectable: opts.selectable !== false,
                    selected,
                });
            })
            .join('');
        return `
            <div class="ugap-liaisons-members-table-wrap">
                <table class="ugap-detect-table ugap-liaisons-members-table">
                    ${renderMemberTableHeadHtml()}
                    <tbody>${body || '<tr><td colspan="6"><span style="color:#94a3b8;">Aucune option</span></td></tr>'}</tbody>
                </table>
            </div>
        `;
    }

    function resolveCatalogNodeLabel(nodeId, data) {
        const id = String(nodeId || '').trim();
        if (!id) return '';
        const Cat = global.UgapCatalogueLcState;
        const Nodes = global.UgapCatalogueNodesCore;
        const nodes = Cat?.getCatalog?.()?.nodes || [];
        return Nodes?.nodeBreadcrumb?.(nodes, id)
            || Cat?.getNodeById?.(id)?.label
            || id;
    }

    function isMotorBaseNonSupplyOption(opt) {
        if (!opt || typeof opt !== 'object') return false;
        const B = bal();
        const label = String(opt?.name || '').trim();
        if (B?.isMotorBaseNonSupplyLabel && !B.isMotorBaseNonSupplyLabel(label)) return false;
        if (B?.isMotorBaseNonSupplyLabel) {
            return inferAdjKind(opt) === 'minoration' || String(opt?.importOptionLineKind || '') === 'minoration';
        }
        return /\bnon\s+fourniture\b/i.test(label) && /\bmoteurs?\s+de\s+base\b/i.test(label);
    }

    function isBaseChoiceCatalogOption(opt) {
        const MBO = global.UgapModelBaseOptions;
        const B = bal();
        if (!opt || typeof opt !== 'object') return false;
        if (B?.isImportGeneratedBaseOption?.(opt) || MBO?.isImportGeneratedBaseOption?.(opt)) return true;
        if (opt.manualBaseOption === true || opt.isBaseOption === true) return true;
        return opt.baseIncluded === true;
    }

    function isImportMotorBaseProductLabel(label) {
        const MBO = global.UgapModelBaseOptions;
        const n = String(label || '').replace(/\s+/g, ' ').trim();
        if (!n) return false;
        if (MBO?.isMotorTarifName?.(n)) return false;
        if (n.length > 80) return false;
        return (
            /\b(moteurs?|motorisation|suzuki|mercury|yamaha|honda|evinrude|tohatsu|yanmar|volvo)\b/i.test(n)
            || /\b\d{2,4}\s*cv\b/i.test(n)
            || /\bdf\s*\d{2,4}\b/i.test(n)
        );
    }

    function isImportMotorBaseProductRow(bp) {
        if (!bp || typeof bp !== 'object') return false;
        if (isImportMotorBaseProductLabel(bp.label)) return true;
        const key = String(bp.key || '');
        return /__p\d+$/i.test(key) || /__model_\d+$/i.test(key) || /__[a-f0-9]{6,}$/i.test(key);
    }

    function isMotorTarifCatalogOption(opt) {
        const MBO = global.UgapModelBaseOptions;
        if (!MBO?.isMotorTarifCatalogOption) return false;
        try {
            return MBO.isMotorTarifCatalogOption(opt);
        } catch (_) {
            return false;
        }
    }

    function modelsOverlap(baseOpt, adjOpt) {
        const a = new Set(
            (Array.isArray(baseOpt?.compatibleModels) ? baseOpt.compatibleModels : [])
                .map((x) => String(x || '').trim())
                .filter(Boolean)
        );
        const b = (Array.isArray(adjOpt?.compatibleModels) ? adjOpt.compatibleModels : [])
            .map((x) => String(x || '').trim())
            .filter(Boolean);
        if (!a.size || !b.length) return true;
        return b.some((id) => a.has(id));
    }

    function isMotorBaseCatalogOption(opt, data) {
        if (!opt || typeof opt !== 'object') return false;
        if (!isBaseChoiceCatalogOption(opt)) return false;
        if (isMotorTarifCatalogOption(opt)) return false;
        const payload = data || store.data;
        if (isImportMotorBaseProductLabel(opt.name)) return true;
        const bpId = String(opt?.importBaseProductId || '').trim();
        const cid = String(opt?.id || '').trim();
        const bps = Array.isArray(payload?.importBaseProducts) ? payload.importBaseProducts : [];
        const bp = bps.find((row) => {
            const id = String(row?.id || '').trim();
            const catalogId = String(row?.catalogOptionId || '').trim();
            return (bpId && id === bpId) || (cid && catalogId === cid);
        });
        if (bp && isImportMotorBaseProductRow(bp)) return true;
        const linked = Array.isArray(opt?.linkedMinorationOptions) ? opt.linkedMinorationOptions : [];
        const B = bal();
        if (linked.some((row) => {
            const label = String(row?.name || row?.label || '').trim();
            return B?.isMotorBaseNonSupplyLabel
                ? B.isMotorBaseNonSupplyLabel(label)
                : /\bnon\s+fourniture\b/i.test(label) && /\bmoteurs?\s+de\s+base\b/i.test(label);
        })) return true;
        if (B?.findMotorNonSupplyAdjOptionIds) {
            const linkedIds = B.findMotorNonSupplyAdjOptionIds(opt, payload?.categories);
            if (linkedIds.length) return true;
        }
        return false;
    }

    function collectMotorBaseCatalogOptions(data) {
        const payload = data || store.data;
        const byId = new Map();
        flattenOptions(payload).forEach((opt) => {
            if (!isMotorBaseCatalogOption(opt, payload)) return;
            const id = String(opt?.id || '').trim();
            if (id) byId.set(id, opt);
        });
        (Array.isArray(payload?.importBaseProducts) ? payload.importBaseProducts : []).forEach((bp) => {
            if (!isImportMotorBaseProductRow(bp)) return;
            const cid = String(bp?.catalogOptionId || '').trim();
            if (!cid || byId.has(cid)) return;
            const opt = findOptionById(cid, payload);
            if (opt && isMotorBaseCatalogOption(opt, payload)) byId.set(cid, opt);
        });
        return [...byId.values()];
    }

    function resolveComplementIdsForMotorBase(baseOpt, data) {
        const payload = data || store.data;
        const baseId = String(baseOpt?.id || '').trim();
        if (!baseId) return [];
        const out = new Set();
        const B = bal();
        const categories = payload?.categories;
        if (B?.findMotorNonSupplyAdjOptionIds) {
            B.findMotorNonSupplyAdjOptionIds(baseOpt, categories).forEach((id) => out.add(id));
        }
        (Array.isArray(baseOpt?.linkedMinorationOptions) ? baseOpt.linkedMinorationOptions : []).forEach((row) => {
            const direct = String(row?.catalogOptionId || row?.id || '').trim();
            if (!direct) return;
            const opt = findOptionById(direct, payload);
            if (opt && isMotorBaseNonSupplyOption(opt)) out.add(direct);
        });
        flattenOptions(payload).forEach((opt) => {
            if (!isMotorBaseNonSupplyOption(opt)) return;
            const oid = String(opt?.id || '').trim();
            if (!oid) return;
            const linkedBase = String(opt?.linkedBaseCatalogOptionId || '').trim();
            if (linkedBase) {
                if (linkedBase === baseId) out.add(oid);
                return;
            }
            if (isBaseChoiceCatalogOption(baseOpt) && modelsOverlap(baseOpt, opt)) out.add(oid);
        });
        return [...out];
    }

    function pickCanonicalMotorBaseId(baseIds, complementId, data) {
        const payload = data || store.data;
        const ids = [...new Set(
            (Array.isArray(baseIds) ? baseIds : [])
                .map((x) => String(x || '').trim())
                .filter(Boolean)
        )];
        if (!ids.length) return '';
        if (ids.length === 1) return ids[0];

        const mino = findOptionById(complementId, payload);
        const linked = String(mino?.linkedBaseCatalogOptionId || '').trim();
        if (linked && ids.includes(linked)) return linked;

        const { find } = buildEquivalentBaseClusters(payload);
        const byRoot = new Map();
        ids.forEach((id) => {
            const root = find(id) || id;
            if (!byRoot.has(root)) byRoot.set(root, id);
        });
        if (byRoot.size === 1) return [...byRoot.values()][0];

        const byImportBp = new Map();
        ids.forEach((id) => {
            const opt = findOptionById(id, payload);
            const bpId = String(opt?.importBaseProductId || '').trim();
            const key = bpId || `name:${normalizeText(opt?.name || id)}`;
            if (!byImportBp.has(key)) byImportBp.set(key, id);
        });
        return [...byImportBp.values()].sort()[0];
    }

    function complementarySemanticKey(sourceId, targetId, data) {
        const payload = data || store.data;
        const src = findOptionById(sourceId, payload);
        const tgtId = String(targetId || '').trim();
        const srcPart = String(src?.importBaseProductId || '').trim()
            || normalizeText(src?.name || sourceId);
        return `${srcPart}|${tgtId}`;
    }

    function splitMutexAndComplementaryAdjIds(baseIds, adjIds, data) {
        const payload = data || store.data;
        const complementary = [];
        const mutex = [];
        (Array.isArray(adjIds) ? adjIds : []).forEach((id) => {
            const oid = String(id || '').trim();
            if (!oid) return;
            const opt = findOptionById(oid, payload);
            if (isMotorBaseNonSupplyOption(opt)) {
                complementary.push(oid);
                return;
            }
            mutex.push(oid);
        });
        const bases = (Array.isArray(baseIds) ? baseIds : [])
            .map((id) => findOptionById(id, payload))
            .filter(Boolean);
        const motorBaseOnly = bases.length > 0 && bases.every((opt) => isMotorBaseCatalogOption(opt, payload));
        return { complementary, mutex, motorBaseOnly };
    }

    function collectMotorComplementaryPairs(data) {
        const payload = data || store.data;
        const basesByComplement = new Map();

        const link = (baseId, complementId) => {
            const b = String(baseId || '').trim();
            const c = String(complementId || '').trim();
            if (!b || !c || b === c) return;
            if (!basesByComplement.has(c)) basesByComplement.set(c, new Set());
            basesByComplement.get(c).add(b);
        };

        const motorBases = collectMotorBaseCatalogOptions(payload);
        motorBases.forEach((baseOpt) => {
            const baseId = String(baseOpt?.id || '').trim();
            resolveComplementIdsForMotorBase(baseOpt, payload).forEach((complementId) => {
                link(baseId, complementId);
            });
        });
        flattenOptions(payload).forEach((minoOpt) => {
            if (!isMotorBaseNonSupplyOption(minoOpt)) return;
            const complementId = String(minoOpt?.id || '').trim();
            const linkedBase = String(minoOpt?.linkedBaseCatalogOptionId || '').trim();
            if (linkedBase) {
                const base = findOptionById(linkedBase, payload);
                if (base && isMotorBaseCatalogOption(base, payload)) link(linkedBase, complementId);
                return;
            }
            motorBases.forEach((baseOpt) => {
                if (modelsOverlap(baseOpt, minoOpt)) link(baseOpt.id, complementId);
            });
        });

        const pairs = [];
        basesByComplement.forEach((baseSet, complementId) => {
            const baseId = pickCanonicalMotorBaseId([...baseSet], complementId, payload);
            if (baseId) pairs.push({ baseId, complementId, kind: 'motor_non_supply' });
        });
        return pairs;
    }

    function complementaryRules(data) {
        const payload = data || store.data;
        return (Array.isArray(payload?.optionLinkRules) ? payload.optionLinkRules : [])
            .filter((rule) => String(rule?.type || '') === 'complementary');
    }

    function complementaryPairKey(sourceId, targetId) {
        return [String(sourceId || '').trim(), String(targetId || '').trim()].sort().join('|');
    }

    function buildComplementaryRows(data) {
        const payload = data || store.data;
        const storedKeys = new Set();
        const semanticKeys = new Set();
        const rows = [];
        complementaryRules(payload).forEach((rule) => {
            const sourceId = String(rule?.sourceOptionIds?.[0] || '').trim();
            const targetId = String(rule?.targetOptionIds?.[0] || '').trim();
            if (!sourceId || !targetId) return;
            const key = complementaryPairKey(sourceId, targetId);
            const semanticKey = complementarySemanticKey(sourceId, targetId, payload);
            if (storedKeys.has(key) || semanticKeys.has(semanticKey)) return;
            storedKeys.add(key);
            semanticKeys.add(semanticKey);
            rows.push({
                id: String(rule?.id || '').trim(),
                sourceId,
                targetId,
                label: String(rule?.label || rule?.message || '').trim(),
                source: String(rule?.source || 'manual'),
                persisted: true,
            });
        });
        collectMotorComplementaryPairs(payload).forEach((pair) => {
            const key = complementaryPairKey(pair.baseId, pair.complementId);
            const semanticKey = complementarySemanticKey(pair.baseId, pair.complementId, payload);
            if (storedKeys.has(key) || semanticKeys.has(semanticKey)) return;
            semanticKeys.add(semanticKey);
            storedKeys.add(key);
            rows.push({
                id: '',
                sourceId: pair.baseId,
                targetId: pair.complementId,
                label: 'Moteur de base ↔ non-fourniture (détecté)',
                source: 'system',
                persisted: false,
            });
        });
        return rows.sort((a, b) => {
            const la = optionLabel(a.sourceId, payload);
            const lb = optionLabel(b.sourceId, payload);
            return la.localeCompare(lb, 'fr');
        });
    }

    function buildOptionFilterRow(opt, data) {
        const catalogObjectId = String(opt?.catalogObjectId || '').trim();
        const typeKey = resolveOptionTypeKey(opt);
        const typeLabels = {
            base: 'Base',
            mino: 'MINO',
            majo: 'MAJO',
            pr: 'PR',
            catalogue: 'Catalogue',
        };
        return {
            name: String(opt?.name || '').trim(),
            details: String(opt?.importExcelLabel || opt?.details || '').trim(),
            importExcelLabel: String(opt?.importExcelLabel || opt?.details || '').trim(),
            importOptionLabel: String(opt?.importOptionLabel || '').trim(),
            refUgap: String(opt?.refUgap || '').trim(),
            refFournisseur: String(opt?.refFournisseur || '').trim(),
            baseRefUgap: String(opt?.baseRefUgap || '').trim(),
            familyLabel: String(opt?.familyLabel || '').trim(),
            catalogNodeLabel: resolveCatalogNodeLabel(catalogObjectId, data),
            category: String(opt?.__categoryName || '').trim(),
            optionType: typeKey,
            optionTypeLabel: typeLabels[typeKey] || typeKey,
            catalogObjectId,
            compatibleModelIds: (Array.isArray(opt?.compatibleModels) ? opt.compatibleModels : [])
                .map((x) => String(x || '').trim())
                .filter(Boolean),
        };
    }

    function hasMemberFiltersActive() {
        return !!(
            String(store.filterQuery || '').trim()
            || String(store.filterCatalogNode || '').trim()
            || String(store.filterModel || '').trim()
            || String(store.filterTag || 'all').trim().toLowerCase() !== 'all'
        );
    }

    function memberMatchesFilters(optionId, data) {
        const opt = findOptionById(optionId, data);
        if (!opt) return false;
        const row = buildOptionFilterRow(opt, data);
        const query = String(store.filterQuery || '').trim();
        if (query) {
            const TM = global.UgapOptionTextMatch;
            if (TM?.rowMatchesOptionsFilter) {
                if (!TM.rowMatchesOptionsFilter(row, query)) return false;
            } else if (!normalizeText([
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
            ].join(' ')).includes(normalizeText(query))) {
                return false;
            }
        }
        const nodeFilter = String(store.filterCatalogNode || '').trim();
        if (nodeFilter && row.catalogObjectId !== nodeFilter) return false;
        const modelFilter = String(store.filterModel || '').trim();
        if (modelFilter && !row.compatibleModelIds.includes(modelFilter)) return false;
        const tagFilter = String(store.filterTag || 'all').trim().toLowerCase();
        if (tagFilter !== 'all' && String(row.optionType || '').toLowerCase() !== tagFilter) return false;
        return true;
    }

    function groupMatchesLinkStatus(group) {
        const status = String(store.filterStatus || 'all');
        if (status === 'linked' && !group?.hasLink) return false;
        if (status === 'unlinked' && group?.hasLink) return false;
        if (status === 'implicit' && !group?.isImplicit) return false;
        if (status === 'explicit' && !group?.isExplicit) return false;
        return true;
    }

    function groupMatchesMemberFilters(group, data) {
        if (!hasMemberFiltersActive()) return true;
        const memberIds = Array.isArray(group?.memberIds) ? group.memberIds : [];
        return memberIds.some((id) => memberMatchesFilters(id, data));
    }

    function ruleMatchesFilters(rule, data) {
        const status = String(store.filterStatus || 'all');
        if (status === 'unlinked' || status === 'implicit') return false;
        if (!hasMemberFiltersActive()) return true;
        const ids = [
            ...(Array.isArray(rule?.sourceOptionIds) ? rule.sourceOptionIds : []),
            ...(Array.isArray(rule?.targetOptionIds) ? rule.targetOptionIds : []),
        ].map((x) => String(x || '').trim()).filter(Boolean);
        return ids.some((id) => memberMatchesFilters(id, data));
    }

    function buildNodeSelectOptions() {
        const Cat = global.UgapCatalogueLcState;
        const Nodes = global.UgapCatalogueNodesCore;
        const nodes = Cat?.getCatalog?.()?.nodes || [];
        const options = [];
        const walk = (parentId, depth) => {
            (Nodes?.getChildren?.(nodes, parentId) || []).forEach((node) => {
                const path = Nodes?.nodeBreadcrumb?.(nodes, node.id) || node.label;
                const prefix = depth > 0 ? `${'　'.repeat(depth)}└ ` : '';
                options.push({ value: node.id, label: `${prefix}${path}` });
                walk(node.id, depth + 1);
            });
        };
        walk('', 0);
        return options;
    }

    function fillFilterSelects() {
        const nodeSelect = byId('ugap-liaisons-filter-node');
        if (nodeSelect) {
            const cur = String(store.filterCatalogNode || '').trim();
            const opts = buildNodeSelectOptions().map((opt) =>
                `<option value="${esc(opt.value)}">${esc(opt.label)}</option>`
            ).join('');
            nodeSelect.innerHTML = `<option value="">Tous les nœuds</option>${opts}`;
            if (cur) nodeSelect.value = cur;
        }

        const modelSelect = byId('ugap-liaisons-filter-model');
        if (modelSelect) {
            const Cat = global.UgapCatalogueLcState;
            const models = (Cat?.getCatalogModels?.() || []).slice().sort(
                Cat?.compareCatalogModelsByPoste || (() => 0)
            );
            const cur = String(store.filterModel || '').trim();
            const opts = models.map((m) => {
                const id = String(m?.id || '').trim();
                if (!id) return '';
                const label = Cat?.formatCatalogModelLabel
                    ? Cat.formatCatalogModelLabel(m)
                    : String(m?.name || id).trim();
                return `<option value="${esc(id)}">${esc(label)}</option>`;
            }).join('');
            modelSelect.innerHTML = `<option value="">Tous les modèles</option>${opts}`;
            if (cur) modelSelect.value = cur;
        }
    }

    global.UgapLiaisonsShared = {
        store,
        byId,
        esc,
        normalizeText,
        flattenOptions,
        findOptionById,
        optionLabel,
        inferAdjKind,
        isIbp,
        bal,
        showSectionStatus,
        buildOptionSelectOptions,
        typeLabel,
        typeBadgeClass,
        normalizeIbpGroupKey,
        equivalentBaseRules,
        buildEquivalentBaseClusters,
        optionRoleLabel,
        optionRoleClass,
        resolveOptionTypeKey,
        optionTypeMeta,
        buildMemberDisplayRow,
        renderMembersTableHtml,
        buildOptionFilterRow,
        hasMemberFiltersActive,
        memberMatchesFilters,
        groupMatchesLinkStatus,
        groupMatchesMemberFilters,
        ruleMatchesFilters,
        fillFilterSelects,
        isMotorBaseNonSupplyOption,
        isMotorBaseCatalogOption,
        splitMutexAndComplementaryAdjIds,
        collectMotorComplementaryPairs,
        complementaryRules,
        buildComplementaryRows,
        complementaryPairKey,
        complementarySemanticKey,
    };
})(typeof window !== 'undefined' ? window : globalThis);
