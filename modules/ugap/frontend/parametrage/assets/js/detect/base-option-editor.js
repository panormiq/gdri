/**
 * Édition options de base — onglet Paramétrage → Importation → Options de base.
 * Filtre sans poste, fusion doublons, suppression, double-clic nom.
 */
(function initUgapBaseOptionEditor(global) {
    'use strict';

    const MOUNT_SELECTOR = '[data-detect-kind="base_option"]';

    function esc(s) {
        if (typeof global.escapeHtml === 'function') return global.escapeHtml(s);
        return String(s ?? '');
    }

    function formatPrice(line) {
        if (global.UgapDetectFormat?.formatPriceEur) {
            return global.UgapDetectFormat.formatPriceEur(line.priceClient);
        }
        return line.priceClient == null ? '—' : String(line.priceClient);
    }

    function normalizeBaseNameKey(text) {
        return String(text || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/\s+/g, ' ')
            .trim()
            .toLowerCase()
            .replace(/[^\w\s-]/gi, '')
            .trim();
    }

    /** Clé produit : corrige l'artefact « lhds » issu de l'HDS dans les libellés Excel. */
    function normalizeProductKey(text) {
        let key = normalizeBaseNameKey(stripPostesFromText(text));
        if (/^l[a-z0-9]/.test(key)) key = key.slice(1).trim();
        return key;
    }

    function isGenericBasePlaceholderLabel(label) {
        if (global.UgapOptionDisplayName?.isGenericBasePlaceholderLabel) {
            return global.UgapOptionDisplayName.isGenericBasePlaceholderLabel(label);
        }
        const n = normalizeBaseNameKey(label);
        if (!n || n === 'de base' || n === 'produit de base') return true;
        if (n === 'moteur choisi' || n === 'moteur de base') return true;
        if (/^(\d+\s+)?moteurs?\s+de\s+base$/.test(n)) return true;
        if (/^ce(lui|lle|ux)\s+de\s+base$/.test(n)) return true;
        return false;
    }

    function parseReplacementFromLabel(label) {
        if (global.UgapOptionDisplayName?.parseReplacementFromLabel) {
            return global.UgapOptionDisplayName.parseReplacementFromLabel(label);
        }
        return { newObject: '', replacedObject: '' };
    }

    function stripPostesFromText(text) {
        return String(text || '')
            .replace(/\s*-\s*postes?\s+[\d\s,etàa\-–—]+$/i, '')
            .replace(/\s+postes?\s+[\d\s,etàa\-–—]+$/i, '')
            .trim();
    }

    /** Regroupement / fusion manuelle : nom d'option uniquement (pas le libellé Excel). */
    function mergeKeyForBaseOption(row) {
        const name = stripPostesFromText(row.baseOptionName);
        if (!name || isGenericBasePlaceholderLabel(name)) return '';
        return normalizeProductKey(name);
    }

    const MERGE_HINT_COLORS = 6;

    /** idx visible → teinte (0..n) si 2+ lignes partagent le même nom d'option. */
    function buildMergeHintByVisibleIndex(visible) {
        const groups = new Map();
        (Array.isArray(visible) ? visible : []).forEach((row, idx) => {
            const mk = mergeKeyForBaseOption(row);
            if (!mk) return;
            if (!groups.has(mk)) groups.set(mk, []);
            groups.get(mk).push(idx);
        });
        const hintByIdx = new Map();
        let colorIdx = 0;
        groups.forEach((indices) => {
            if (indices.length < 2) return;
            const ci = colorIdx % MERGE_HINT_COLORS;
            colorIdx += 1;
            indices.forEach((idx) => hintByIdx.set(idx, ci));
        });
        return hintByIdx;
    }

    /** Identifiant stable par ligne (ne pas utiliser _bpKey seul : collisions après fusion même nom). */
    function rowKey(line) {
        const id = String(line._bpId || line.id || '').trim();
        if (id) return id;
        const key = String(line._bpKey || '').trim();
        if (key) return key;
        return `${line.sourceKind}_${line.sourceRowIndex}`;
    }

    function getKnownModels() {
        const fromReport = Array.isArray(global.__ugapDetectionReport?.models)
            ? global.__ugapDetectionReport.models
            : [];
        const fromStaging = Array.isArray(global.currentImportStaging?.models)
            ? global.currentImportStaging.models
            : [];
        return fromReport.length ? fromReport : fromStaging;
    }

    function buildPosteByModelIdMap() {
        const map = new Map();
        getKnownModels().forEach((m) => {
            const mid = String(m?.id || '').trim();
            const poste = Number(m?.posteNumber);
            if (!mid || !Number.isFinite(poste)) return;
            map.set(mid, poste);
        });
        return map;
    }

    function formatPostesFromModelIds(modelIds) {
        const mids = (Array.isArray(modelIds) ? modelIds : [])
            .map((x) => String(x || '').trim())
            .filter(Boolean);
        if (!mids.length) return '';
        const posteByModelId = buildPosteByModelIdMap();
        const postes = mids
            .map((mid) => posteByModelId.get(mid))
            .filter((p) => Number.isFinite(p))
            .sort((a, b) => a - b);
        if (postes.length) return postes.join(', ');
        return '';
    }

    function postesTextForRow(row) {
        const fromDisplay = String(row?.displayPostes || '').trim();
        if (fromDisplay) return fromDisplay;
        return formatPostesFromModelIds(row?.compatibleModelIds);
    }

    function labelHasExplicitPostes(text) {
        if (global.UgapPosteFromLabel?.getSortedExplicitPosteNumbersFromLabel) {
            return global.UgapPosteFromLabel.getSortedExplicitPosteNumbersFromLabel(text).length > 0;
        }
        if (typeof global.getExplicitPosteSetFromLabel === 'function') {
            const set = global.getExplicitPosteSetFromLabel(text);
            return !!(set && set.size);
        }
        return false;
    }

    function resolveCompatibleModelIdsForRow(row) {
        const models = getKnownModels();
        let mids = (row?.compatibleModelIds || []).map((x) => String(x || '').trim()).filter(Boolean);
        if (!mids.length && global.UgapPosteFromLabel?.modelIdsFromExplicitLabelPostes) {
            mids = global.UgapPosteFromLabel.modelIdsFromExplicitLabelPostes(row?.label, models);
        }
        if (!mids.length) {
            const dp = String(row?.displayPostes || '').trim();
            const nums = dp.match(/\d+/g);
            if (nums && nums.length) {
                const set = new Set(nums.map((n) => parseInt(n, 10)).filter(Number.isFinite));
                mids = models
                    .filter((m) => set.has(Number(m?.posteNumber)))
                    .map((m) => String(m?.id || '').trim())
                    .filter(Boolean);
            }
        }
        const allModelIds = models.map((m) => String(m?.id || '').trim()).filter(Boolean);
        if (mids.length && allModelIds.length && mids.length >= allModelIds.length) {
            const labels = [row?.label, row?.baseOptionName, row?.excelLabel].filter(Boolean);
            const hasPosteHint = labels.some((lab) => labelHasExplicitPostes(lab));
            if (!hasPosteHint) mids = [];
        }
        return mids;
    }

    function rowHasKnownPostes(row) {
        const mids = (row.compatibleModelIds || []).map((x) => String(x || '').trim()).filter(Boolean);
        if (mids.length) return true;
        const dp = String(row.displayPostes || '').trim();
        return dp.length > 0 && /\d/.test(dp);
    }

    function lineFromDetectionRow(line, index) {
        const srcIdx = Number(line.sourceRowIndex);
        const optId = Number.isFinite(srcIdx) && srcIdx > 0 ? `opt_${srcIdx}` : '';
        const key = optId ? `src_${optId}` : String(line.id || `base_${index}`);
        const excelLabel = String(line.label || '').trim();
        const name = String(line.baseOptionName || line.label || '').trim() || 'de base';
        const draft = {
            label: excelLabel,
            displayPostes: line.displayPostes,
            compatibleModelIds: (line.compatibleModelIds || []).map((x) => String(x || '').trim()).filter(Boolean),
        };
        const mids = resolveCompatibleModelIdsForRow(draft);
        const displayPostes = String(line.displayPostes || '').trim()
            || (global.UgapPosteFromLabel?.getSortedExplicitPosteNumbersFromLabel
                ? global.UgapPosteFromLabel.getSortedExplicitPosteNumbersFromLabel(excelLabel).join(', ')
                : '')
            || formatPostesFromModelIds(mids);
        return {
            _bpKey: key,
            _bpId: `bp_${key.replace(/[^a-zA-Z0-9_]+/g, '_').slice(0, 48)}`,
            _optIds: optId ? [optId] : [],
            sourceRowIndex: line.sourceRowIndex,
            sourceKind: line.sourceKind,
            baseOptionName: name,
            label: excelLabel,
            priceClient: line.priceClient,
            priceUgap: line.priceUgap,
            displayPostes,
            compatibleModelIds: mids,
            labelCustomized: line.labelCustomized === true,
            pricingMode: 'fixed',
            pricesByModelId: {},
            aliases: []
        };
    }

    function lineFromStagingBp(bp) {
        const key = String(bp.key || bp.id || '').trim();
        const name = String(bp.label || bp.baseOptionName || '').trim() || 'de base';
        const optIds = Array.isArray(bp.optionIds) ? bp.optionIds : [];
        const srcIdx = optIds.length ? Number(String(optIds[0] || '').replace(/^opt_/, '')) : NaN;
        const pricesByModelId = bp.pricesByModelId && typeof bp.pricesByModelId === 'object'
            ? { ...bp.pricesByModelId }
            : {};
        const excelLabel = String(bp.excelLabel || '').trim();
        const resolved = resolveCompatibleModelIdsForRow({
            label: excelLabel,
            baseOptionName: name,
            displayPostes: formatPostesFromModelIds(bp.modelIds),
            compatibleModelIds: [...(bp.modelIds || [])],
        });
        const displayPostes = formatPostesFromModelIds(resolved)
            || (global.UgapPosteFromLabel?.getSortedExplicitPosteNumbersFromLabel
                ? global.UgapPosteFromLabel.getSortedExplicitPosteNumbersFromLabel(excelLabel).join(', ')
                : '');
        return {
            _bpKey: key,
            _bpId: String(bp.id || key),
            _optIds: [...optIds],
            sourceRowIndex: Number.isFinite(srcIdx) ? srcIdx : '',
            sourceKind: 'staging',
            baseOptionName: name,
            label: excelLabel,
            priceClient: bp.priceClient,
            priceUgap: bp.priceUgap,
            displayPostes,
            compatibleModelIds: resolved,
            labelCustomized: bp.labelCustomized === true,
            pricingMode: bp.pricingMode === 'per_model' ? 'per_model' : 'fixed',
            pricesByModelId,
            aliases: Array.isArray(bp.aliases) ? [...bp.aliases] : [],
            _fromStaging: true
        };
    }

    function applyRowPricesFromFields(row) {
        const pricesByModelId = { ...(row.pricesByModelId || {}) };
        const pc = Number(row.priceClient);
        const pu = Number(row.priceUgap);
        const price = Number.isFinite(pc) ? pc : (Number.isFinite(pu) ? pu : null);
        (row.compatibleModelIds || []).forEach((mid) => {
            const k = String(mid || '').trim();
            if (!k || pricesByModelId[k] != null) return;
            if (Number.isFinite(price)) pricesByModelId[k] = price;
        });
        row.pricesByModelId = pricesByModelId;
        const vals = Object.values(pricesByModelId).filter(Number.isFinite);
        const distinct = [...new Set(vals.map((v) => Number(v.toFixed(2))))];
        if (distinct.length > 1) {
            row.pricingMode = 'per_model';
            row.priceClient = null;
            row.priceUgap = null;
        } else if (distinct.length === 1) {
            row.pricingMode = 'fixed';
            row.priceClient = distinct[0];
            row.priceUgap = distinct[0];
        }
    }

    function inferBaseNameFromExcel(row) {
        let excel = stripPostesFromText(row.label);
        const repIdx = excel.search(/\ben\s+remplacement\b|\blieu\s+et\s+place\b/i);
        if (repIdx > 0) excel = excel.slice(0, repIdx).trim();
        excel = excel.replace(/^(moins-value|plus-value|plus\s+value)\s+/i, '').trim();
        if (excel && !isGenericBasePlaceholderLabel(excel)) return excel;
        return '';
    }

    function mergeRowsInto(keeper, source) {
        if (!keeper || !source || keeper === source) return keeper;
        const optSet = new Set([...(keeper._optIds || []), ...(source._optIds || [])]);
        const midSet = new Set([
            ...(keeper.compatibleModelIds || []),
            ...(source.compatibleModelIds || [])
        ].map((x) => String(x || '').trim()).filter(Boolean));
        const aliases = new Set([...(keeper.aliases || []), ...(source.aliases || [])]);
        [keeper.label, source.label].forEach((lab) => {
            const s = String(lab || '').trim();
            if (s && s !== String(keeper.baseOptionName || '').trim()) aliases.add(s);
        });
        keeper._optIds = [...optSet].sort();
        keeper.compatibleModelIds = [...midSet];
        keeper.aliases = [...aliases];
        if (source.labelCustomized) keeper.labelCustomized = true;
        if (!keeper.label && source.label) keeper.label = source.label;
        applyRowPricesFromFields(source);
        Object.assign(keeper.pricesByModelId || {}, source.pricesByModelId || {});
        applyRowPricesFromFields(keeper);
        if (isGenericBasePlaceholderLabel(keeper.baseOptionName)) {
            const fromName = stripPostesFromText(source.baseOptionName);
            if (fromName && !isGenericBasePlaceholderLabel(fromName)) {
                keeper.baseOptionName = fromName;
            }
        }
        return keeper;
    }

    function sortWorkingLines(lines) {
        return [...lines].sort((a, b) => {
            const na = Number(a.sourceRowIndex);
            const nb = Number(b.sourceRowIndex);
            if (Number.isFinite(na) && Number.isFinite(nb) && na !== nb) return na - nb;
            return String(a.baseOptionName || '').localeCompare(String(b.baseOptionName || ''), 'fr');
        });
    }

    function getBaseOptionNameSortDir() {
        const dir = String(global.__ugapBaseOptionNameSortDir || '').trim().toLowerCase();
        return dir === 'asc' || dir === 'desc' ? dir : '';
    }

    function compareBaseOptionNames(a, b, dir) {
        const cmp = normalizeBaseNameKey(a?.baseOptionName)
            .localeCompare(normalizeBaseNameKey(b?.baseOptionName), 'fr', { sensitivity: 'base' });
        if (cmp !== 0) return dir === 'desc' ? -cmp : cmp;
        const na = Number(a?.sourceRowIndex);
        const nb = Number(b?.sourceRowIndex);
        if (Number.isFinite(na) && Number.isFinite(nb) && na !== nb) return na - nb;
        return 0;
    }

    function sortVisibleByName(visible) {
        const dir = getBaseOptionNameSortDir();
        if (!dir) return visible;
        return [...visible].sort((a, b) => compareBaseOptionNames(a, b, dir));
    }

    function applyCustomNamesFromOverrides(lines) {
        const overrides = global.__ugapBaseOptionNameOverrides;
        if (!(overrides instanceof Map) || !overrides.size) return lines;
        return lines.map((row) => {
            const hit = overrides.get(rowKey(row));
            if (!hit?.name) return row;
            return { ...row, baseOptionName: String(hit.name).trim() || row.baseOptionName, labelCustomized: true };
        });
    }

    /** Réapplique les noms personnalisés après rechargement staging / API. */
    function applyCustomNamesFromSource(lines, sourceRows) {
        const byKey = new Map();
        const byOptId = new Map();
        (Array.isArray(sourceRows) ? sourceRows : []).forEach((row) => {
            if (row?.labelCustomized !== true) return;
            const name = String(row.baseOptionName || '').trim();
            if (!name) return;
            byKey.set(rowKey(row), name);
            (row._optIds || []).forEach((oid) => {
                const id = String(oid || '').trim();
                if (id) byOptId.set(id, name);
            });
        });
        if (!byKey.size && !byOptId.size) return lines;
        return lines.map((row) => {
            let name = byKey.get(rowKey(row));
            if (!name) {
                const oid = String((row._optIds || [])[0] || '').trim();
                if (oid) name = byOptId.get(oid);
            }
            if (!name) return row;
            return { ...row, baseOptionName: name, labelCustomized: true };
        });
    }

    function buildDetByOptId(detectionLines) {
        const map = new Map();
        (Array.isArray(detectionLines) ? detectionLines : []).forEach((line, index) => {
            const row = lineFromDetectionRow(line, index);
            (row._optIds || []).forEach((oid) => {
                if (oid) map.set(String(oid), row);
            });
        });
        return map;
    }

    function enrichStagingRowFromDetection(row, detByOptId) {
        (row._optIds || []).forEach((optId) => {
            const det = detByOptId.get(String(optId));
            if (!det) return;
            if (!String(row.label || '').trim() && det.label) row.label = det.label;
            applyRowPricesFromFields(det);
            Object.entries(det.pricesByModelId || {}).forEach(([mid, price]) => {
                if (row.pricesByModelId[mid] == null && Number.isFinite(Number(price))) {
                    row.pricesByModelId[mid] = Number(price);
                }
            });
            if (row.priceClient == null && det.priceClient != null) row.priceClient = det.priceClient;
            if (row.priceUgap == null && det.priceUgap != null) row.priceUgap = det.priceUgap;
        });
        applyRowPricesFromFields(row);
        return row;
    }

    /**
     * Staging enregistré = source de vérité après fusion.
     * Les lignes détection déjà couvertes par optionIds d'une IBP ne sont pas ré-affichées.
     */
    function buildWorkingLines(detectionLines, stagingProducts) {
        const saved = Array.isArray(stagingProducts) ? stagingProducts : [];
        const det = Array.isArray(detectionLines) ? detectionLines : [];
        const detByOptId = buildDetByOptId(det);

        if (saved.length > 0) {
            const coveredOptIds = new Set();
            saved.forEach((bp) => {
                (bp.optionIds || []).forEach((oid) => {
                    const id = String(oid || '').trim();
                    if (id) coveredOptIds.add(id);
                });
            });
            const lines = saved.map((bp) => enrichStagingRowFromDetection(lineFromStagingBp(bp), detByOptId));
            det.forEach((line, index) => {
                const row = lineFromDetectionRow(line, index);
                const optId = String((row._optIds || [])[0] || '').trim();
                if (optId && coveredOptIds.has(optId)) return;
                applyRowPricesFromFields(row);
                lines.push(row);
            });
            return applyCustomNamesFromOverrides(sortWorkingLines(lines));
        }

        return applyCustomNamesFromOverrides(sortWorkingLines(det.map((line, index) => {
            const row = lineFromDetectionRow(line, index);
            applyRowPricesFromFields(row);
            return row;
        })));
    }

    function getAllLines() {
        if (Array.isArray(global.__ugapBaseOptionCustomLines)) {
            return applyCustomNamesFromOverrides(global.__ugapBaseOptionCustomLines);
        }
        return applyCustomNamesFromOverrides(buildWorkingLines(
            global.__ugapDetectionReport?.linesByKind?.base_option,
            global.currentImportStaging?.importBaseProducts
        ));
    }

    function setAllLines(lines) {
        global.__ugapBaseOptionCustomLines = Array.isArray(lines) ? lines : [];
    }

    function linesForDisplay(allLines) {
        const all = Array.isArray(allLines) ? allLines : getAllLines();
        const visible = sortVisibleByName(all.filter((row) => rowHasKnownPostes(row)));
        return { all, visible, hiddenCount: all.length - visible.length };
    }

    function linesToPayload(lines) {
        return lines
            .filter((row) => rowHasKnownPostes(row))
            .map((row) => {
                applyRowPricesFromFields(row);
                const label = String(row.baseOptionName || '').trim() || 'de base';
                const modelIds = resolveCompatibleModelIdsForRow(row);
                row.compatibleModelIds = modelIds;
                const pricesByModelId = { ...(row.pricesByModelId || {}) };
                const priceVals = Object.values(pricesByModelId).filter(Number.isFinite);
                const distinct = [...new Set(priceVals.map((v) => Number(v.toFixed(2))))];
                const perModel = row.pricingMode === 'per_model' && distinct.length > 1;
                let priceClient = row.priceClient == null ? null : Number(row.priceClient);
                let priceUgap = row.priceUgap == null ? null : Number(row.priceUgap);
                if (perModel && distinct.length === 1) {
                    priceClient = distinct[0];
                    priceUgap = distinct[0];
                }
                return {
                    id: row._bpId,
                    key: row._bpKey,
                    label,
                    baseOptionName: label,
                    labelCustomized: row.labelCustomized === true,
                    excelLabel: String(row.label || '').trim(),
                    priceClient: Number.isFinite(priceClient) ? priceClient : null,
                    priceUgap: Number.isFinite(priceUgap) ? priceUgap : null,
                    pricingMode: perModel ? 'per_model' : 'fixed',
                    price: perModel ? null : (Number.isFinite(priceClient) ? priceClient : null),
                    pricesByModelId,
                    optionIds: [...(row._optIds || [])],
                    modelIds: [...modelIds],
                    aliases: Array.isArray(row.aliases) ? row.aliases.map((a) => String(a || '').trim()).filter(Boolean) : [],
                    catalogOptionId: String(row.catalogOptionId || '').trim()
                };
            });
    }

    async function persistLines(lines) {
        const toSave = Array.isArray(lines) ? lines : getAllLines();
        setAllLines(toSave);
        if (!(global.__ugapBaseOptionNameOverrides instanceof Map)) {
            global.__ugapBaseOptionNameOverrides = new Map();
        }
        toSave.forEach((row) => {
            if (row.labelCustomized) {
                global.__ugapBaseOptionNameOverrides.set(rowKey(row), { name: row.baseOptionName });
            }
        });
        syncDetectionReportBaseOptions(toSave);

        const importId = String(global.currentImportId || global.currentImportStaging?._id || '').trim();
        if (!importId || typeof global.apiCall !== 'function') {
            return { ok: false, reason: 'no_staging' };
        }
        const payload = linesToPayload(toSave);
        const res = await global.apiCall(`/imports/staging/${encodeURIComponent(importId)}/base-products`, {
            method: 'POST',
            body: JSON.stringify({ baseProducts: payload })
        });
        if (res?.data) {
            global.currentImportStaging = res.data;
            global.currentImportId = String(res.data._id || importId);
            const det = global.__ugapDetectionReport?.linesByKind?.base_option;
            let rebuilt = buildWorkingLines(det, res.data.importBaseProducts);
            rebuilt = applyCustomNamesFromSource(rebuilt, toSave);
            syncDetectionReportBaseOptions(rebuilt);
            setAllLines(rebuilt);
        }
        return { ok: true, savedCount: payload.length };
    }

    /** Rapport détection : une entrée par optionId couvert (évite la réapparition des doublons). */
    function syncDetectionReportBaseOptions(lines) {
        if (!global.__ugapDetectionReport?.linesByKind) return;
        const out = [];
        (Array.isArray(lines) ? lines : []).forEach((row) => {
            const optIds = (row._optIds || []).map((x) => String(x || '').trim()).filter(Boolean);
            const targets = optIds.length ? optIds : [''];
            targets.forEach((optId, idx) => {
                const srcIdx = optId ? Number(optId.replace(/^opt_/, '')) : Number(row.sourceRowIndex);
                out.push({
                    id: optId ? `src_${optId}` : row._bpKey,
                    sourceKind: row.sourceKind,
                    sourceRowIndex: Number.isFinite(srcIdx) ? srcIdx : row.sourceRowIndex,
                    baseOptionName: row.baseOptionName,
                    label: idx === 0 ? row.label : (row.aliases || [])[idx - 1] || row.label,
                    priceClient: row.priceClient,
                    priceUgap: row.priceUgap,
                    displayPostes: row.displayPostes,
                    compatibleModelIds: row.compatibleModelIds,
                    labelCustomized: row.labelCustomized
                });
            });
        });
        global.__ugapDetectionReport.linesByKind.base_option = out;
    }

    function getSelectedIndices(mount) {
        return [...mount.querySelectorAll('[data-bp-row-select]:checked')]
            .map((el) => Number(el.getAttribute('data-row-index')))
            .filter(Number.isFinite);
    }

    function updateSelectionActionBar(mount) {
        if (!mount) return;
        const bar = mount.querySelector('[data-bp-selection-bar]');
        if (!bar) return;
        const sel = getSelectedIndices(mount);
        const count = sel.length;
        const countEl = bar.querySelector('[data-bp-selection-count]');
        if (countEl) {
            countEl.textContent = count === 1
                ? '1 ligne sélectionnée'
                : `${count} lignes sélectionnées`;
        }
        const mergeBtn = bar.querySelector('[data-bp-action="merge-selected"]');
        if (mergeBtn) {
            mergeBtn.disabled = count < 2;
            mergeBtn.title = count < 2
                ? 'Cochez au moins 2 lignes au même nom d\'option'
                : 'Fusionner les lignes sélectionnées';
        }
        const deleteBtn = bar.querySelector('[data-bp-action="delete-selected"]');
        if (deleteBtn) deleteBtn.disabled = count < 1;
        bar.hidden = count < 1;
    }

    function autoMergeDuplicateRows(allLines) {
        const groups = new Map();
        allLines.forEach((row, idx) => {
            const mk = mergeKeyForBaseOption(row);
            if (!groups.has(mk)) groups.set(mk, []);
            groups.get(mk).push({ row, idx });
        });
        const removeIdx = new Set();
        groups.forEach((items) => {
            if (items.length < 2) return;
            items.sort((a, b) => a.idx - b.idx);
            const keeper = items[0].row;
            for (let i = 1; i < items.length; i += 1) {
                mergeRowsInto(keeper, items[i].row);
                removeIdx.add(items[i].idx);
            }
        });
        return allLines.filter((_, i) => !removeIdx.has(i));
    }

    function mergeSelectedRows(allLines, indices) {
        const sorted = [...new Set(indices)].filter((i) => i >= 0 && i < allLines.length).sort((a, b) => a - b);
        if (sorted.length < 2) return allLines;
        const keeper = allLines[sorted[0]];
        sorted.slice(1).forEach((i) => mergeRowsInto(keeper, allLines[i]));
        const remove = new Set(sorted.slice(1));
        return allLines.filter((_, i) => !remove.has(i));
    }

    function deleteRowsAt(allLines, indices) {
        const remove = new Set(indices);
        return allLines.filter((_, i) => !remove.has(i));
    }

    async function ensureImportStagingLoaded() {
        if (String(global.currentImportId || global.currentImportStaging?._id || '').trim()) return true;
        if (typeof global.apiCall !== 'function') return false;
        try {
            const res = await global.apiCall('/imports/staging');
            if (res?.data?._id) {
                global.currentImportStaging = res.data;
                global.currentImportId = String(res.data._id);
                return true;
            }
        } catch (_e) { /* ignore */ }
        return false;
    }

    async function openEditForRowIndex(mount, rowIndex, visibleLines) {
        const row = visibleLines[rowIndex];
        if (!row) return;
        if (!global.UgapImportBaseOptionModal?.open) {
            global.showAlert?.('Modale de renommage indisponible — rechargez la page (Ctrl+F5).', 'error');
            return;
        }
        const allLines = getAllLines();
        const realIdx = allLines.findIndex((r) => rowKey(r) === rowKey(row));
        if (realIdx < 0) return;

        const newName = await global.UgapImportBaseOptionModal.open({
            title: 'Modifier le nom de l\'option de base',
            name: row.baseOptionName,
            excelLabel: row.label
        });
        if (newName == null) return;

        const trimmed = String(newName).trim() || 'de base';
        allLines[realIdx].baseOptionName = trimmed;
        allLines[realIdx].labelCustomized = true;
        setAllLines(allLines);
        if (!(global.__ugapBaseOptionNameOverrides instanceof Map)) {
            global.__ugapBaseOptionNameOverrides = new Map();
        }
        global.__ugapBaseOptionNameOverrides.set(rowKey(allLines[realIdx]), { name: trimmed });
        try {
            await ensureImportStagingLoaded();
            const result = await persistLines(allLines);
            global.showAlert?.(
                result.ok ? 'Nom enregistré.' : 'Nom mis à jour en session. Importez le fichier Excel (POST /import) pour enregistrer sur le serveur.',
                result.ok ? 'success' : 'warning'
            );
        } catch (err) {
            global.showAlert?.(err?.message || 'Erreur enregistrement', 'error');
        }
        renderBaseOptionTable(mount);
    }

    function bindTableInteractions(mount) {
        if (!mount || mount.dataset.bpEditBound === '1') return;
        mount.dataset.bpEditBound = '1';

        mount.addEventListener('dblclick', (e) => {
            const cell = e.target.closest('.ugap-bp-name-cell');
            if (!cell) return;
            const idx = Number(cell.getAttribute('data-row-index'));
            if (!Number.isFinite(idx)) return;
            const { visible } = linesForDisplay(getAllLines());
            void openEditForRowIndex(mount, idx, visible);
        });

        mount.addEventListener('change', (e) => {
            if (e.target.matches('[data-bp-row-select]')) {
                updateSelectionActionBar(mount);
            }
        });

        mount.addEventListener('click', (e) => {
            const sortBtn = e.target.closest('[data-bp-sort]');
            if (sortBtn && mount.contains(sortBtn)) {
                const current = getBaseOptionNameSortDir();
                global.__ugapBaseOptionNameSortDir = current === 'asc' ? 'desc' : 'asc';
                renderBaseOptionTable(mount);
                return;
            }

            const btn = e.target.closest('[data-bp-action]');
            if (!btn || !mount.contains(btn)) return;
            const action = btn.getAttribute('data-bp-action');
            let allLines = getAllLines();
            const { visible } = linesForDisplay(allLines);

            if (action === 'merge-selected') {
                const sel = getSelectedIndices(mount);
                if (sel.length < 2) {
                    global.showAlert?.('Cochez au moins 2 lignes à fusionner.', 'warning');
                    return;
                }
                const mergeKeys = sel.map((i) => mergeKeyForBaseOption(visible[i]));
                const namedKeys = mergeKeys.filter(Boolean);
                if (namedKeys.length < sel.length) {
                    global.showAlert?.('Certaines lignes n\'ont pas de nom d\'option exploitable — renommez-les avant fusion.', 'warning');
                    return;
                }
                const uniqueMergeKeys = [...new Set(namedKeys)];
                if (uniqueMergeKeys.length > 1) {
                    global.showAlert?.('Fusion sur le nom d\'option uniquement : cochez des lignes au même nom (fond coloré identique).', 'warning');
                    return;
                }
                const keys = sel.map((i) => rowKey(visible[i]));
                const realIndices = keys
                    .map((k) => allLines.findIndex((r) => rowKey(r) === k))
                    .filter((i) => i >= 0);
                if (realIndices.length < 2 || new Set(realIndices).size < 2) {
                    global.showAlert?.('Impossible de fusionner : les lignes sélectionnées ne sont pas distinguables. Rechargez la page (Ctrl+F5) puis réessayez.', 'warning');
                    return;
                }
                const merged = mergeSelectedRows(allLines, realIndices);
                setAllLines(merged);
                void (async () => {
                    try {
                        await ensureImportStagingLoaded();
                        const r = await persistLines(merged);
                        global.showAlert?.(
                            r.ok ? 'Lignes fusionnées et enregistrées.' : 'Lignes fusionnées en session — import staging requis pour enregistrer.',
                            r.ok ? 'success' : 'warning'
                        );
                        renderBaseOptionTable(mount);
                    } catch (err) {
                        global.showAlert?.(err?.message || 'Erreur fusion', 'error');
                    }
                })();
                return;
            }

            if (action === 'delete-selected') {
                const sel = getSelectedIndices(mount);
                if (!sel.length) {
                    global.showAlert?.('Cochez les lignes à supprimer.', 'warning');
                    return;
                }
                if (!global.confirm(`Supprimer ${sel.length} ligne(s) d'options de base ?`)) return;
                const keys = sel.map((i) => rowKey(visible[i]));
                const realIndices = keys.map((k) => allLines.findIndex((r) => rowKey(r) === k)).filter((i) => i >= 0);
                void persistLines(deleteRowsAt(allLines, realIndices)).then(() => {
                    global.showAlert?.('Lignes supprimées.', 'success');
                    renderBaseOptionTable(mount);
                }).catch((err) => global.showAlert?.(err?.message || 'Erreur', 'error'));
                return;
            }

            const editIdx = Number(btn.getAttribute('data-row-index'));
            if (action === 'edit-name' && Number.isFinite(editIdx)) {
                void openEditForRowIndex(mount, editIdx, visible);
                return;
            }

            const delIdx = Number(btn.getAttribute('data-row-index'));
            if (action === 'delete-one' && Number.isFinite(delIdx)) {
                const key = rowKey(visible[delIdx]);
                const realIdx = allLines.findIndex((r) => rowKey(r) === key);
                if (realIdx < 0) return;
                if (!global.confirm('Supprimer cette option de base ?')) return;
                void persistLines(deleteRowsAt(allLines, [realIdx])).then(() => {
                    renderBaseOptionTable(mount);
                }).catch((err) => global.showAlert?.(err?.message || 'Erreur', 'error'));
            }
        });
    }

    function formatPriceModeHint(row) {
        if (row.pricingMode === 'per_model') {
            const n = Object.keys(row.pricesByModelId || {}).length;
            return n ? `par poste (${n})` : 'par poste';
        }
        return 'fixe';
    }

    function renderBaseOptionTable(mount, detectionLines, models) {
        if (!mount) return;
        void models;
        if (detectionLines) {
            const previous = Array.isArray(global.__ugapBaseOptionCustomLines)
                ? global.__ugapBaseOptionCustomLines
                : getAllLines();
            let rebuilt = buildWorkingLines(
                detectionLines,
                global.currentImportStaging?.importBaseProducts
            );
            rebuilt = applyCustomNamesFromSource(rebuilt, previous);
            setAllLines(rebuilt);
        }
        const { all, visible, hiddenCount } = linesForDisplay(getAllLines());

        if (!all.length) {
            mount.innerHTML = `<p class="ugap-param-placeholder">Aucune option de base.
                Lancez la <strong>détection</strong> ou importez un fichier Excel.</p>`;
            return;
        }

        const hasStaging = !!(global.currentImportId || global.currentImportStaging?._id);
        const hiddenNote = hiddenCount
            ? `<span class="ugap-import-mino-hint" style="color:#64748b;"> ${hiddenCount} ligne(s) masquée(s) — poste inconnu (non publiées).</span>`
            : '';

        const mergeHints = buildMergeHintByVisibleIndex(visible);
        const mergeHintCount = new Set(mergeHints.values()).size;
        const mergeHintNote = mergeHintCount
            ? `<span class="ugap-import-mino-hint"> Fond coloré = même <strong>nom d'option</strong> — fusion manuelle.</span>`
            : '';

        const toolbar = `<div class="ugap-bp-editor-toolbar">
            <span class="ugap-import-mino-hint"><strong>Double-clic</strong> sur le nom pour le renommer · tri sur <strong>Nom option de base</strong>.${mergeHintNote}${hiddenNote}</span>
            <div class="ugap-bp-editor-toolbar__actions">
                <button type="button" class="btn btn-outline btn-sm" data-bp-action="merge-selected">Fusionner la sélection</button>
                <button type="button" class="btn btn-outline btn-sm" data-bp-action="delete-selected">Supprimer la sélection</button>
            </div>
            ${hasStaging ? '' : '<span class="ugap-import-mino-hint" style="color:#b45309;">Import staging requis pour enregistrer.</span>'}
        </div>`;
        const selectionBar = `<div class="ugap-bp-editor-selection-bar" data-bp-selection-bar hidden>
            <span class="ugap-bp-editor-selection-bar__count" data-bp-selection-count>0 ligne sélectionnée</span>
            <div class="ugap-bp-editor-selection-bar__actions">
                <button type="button" class="btn btn-primary btn-sm" data-bp-action="merge-selected" disabled>Fusionner</button>
                <button type="button" class="btn btn-outline btn-sm" data-bp-action="delete-selected" disabled>Supprimer</button>
            </div>
        </div>`;

        if (!visible.length) {
            mount.innerHTML = `${toolbar}${selectionBar}<p class="ugap-param-placeholder">Aucune option de base avec poste connu. ${hiddenCount} ligne(s) sans poste masquée(s).</p>`;
            bindTableInteractions(mount);
            updateSelectionActionBar(mount);
            return;
        }

        const nameSortDir = getBaseOptionNameSortDir();
        const nameSortIcon = nameSortDir === 'asc' ? '▲' : nameSortDir === 'desc' ? '▼' : '↕';
        const nameSortClass = nameSortDir ? ` is-active is-${nameSortDir}` : '';

        const body = visible.map((line, idx) => {
            const hintCi = mergeHints.get(idx);
            const rowCls = hintCi != null ? ` class="ugap-bp-merge-hint ugap-bp-merge-hint--${hintCi}"` : '';
            const aliasHint = (line.aliases || []).length
                ? `<div class="ugap-import-mino-hint">${esc((line.aliases || []).join(' · '))}</div>`
                : '';
            return `<tr${rowCls}>
                <td><input type="checkbox" data-bp-row-select data-row-index="${idx}" data-bp-row-id="${esc(rowKey(line))}"></td>
                <td>${esc(line.sourceRowIndex)}</td>
                <td>${esc(line.sourceKind)}</td>
                <td class="ugap-bp-name-cell" data-row-index="${idx}" title="Double-cliquer ou ✎ pour modifier le nom">
                    <div class="ugap-bp-name-cell__row">
                        <span class="ugap-bp-name-cell__text">${esc(line.baseOptionName || '—')}</span>
                        <button type="button" class="btn btn-outline btn-sm ugap-bp-name-edit-btn"
                            data-bp-action="edit-name" data-row-index="${idx}" title="Renommer">✎</button>
                    </div>
                    <span class="ugap-bp-name-cell__hint">double-clic ou ✎</span>
                    ${aliasHint}
                </td>
                <td>${esc(line.label)}</td>
                <td class="num">${esc(formatPrice(line))}</td>
                <td class="num">${esc(global.UgapDetectFormat?.formatPriceEur
                    ? global.UgapDetectFormat.formatPriceEur(line.priceUgap)
                    : line.priceUgap)}</td>
                <td>${esc(formatPriceModeHint(line))}</td>
                <td>${esc(postesTextForRow(line))}</td>
                <td><button type="button" class="btn btn-outline btn-sm" data-bp-action="delete-one" data-row-index="${idx}">Suppr.</button></td>
            </tr>`;
        }).join('');

        mount.innerHTML = `${toolbar}${selectionBar}
            <div class="ugap-bp-editor-table-scroll">
            <table class="ugap-detect-table ugap-bp-editor-table">
                <thead>
                    <tr>
                        <th></th>
                        <th>Ligne</th>
                        <th>Source</th>
                        <th>
                            <button type="button" class="ugap-bp-th-sort${nameSortClass}" data-bp-sort="name"
                                title="Trier par nom (A→Z / Z→A)">
                                Nom option de base <span class="ugap-bp-th-sort-icon" aria-hidden="true">${nameSortIcon}</span>
                            </button>
                        </th>
                        <th>Libellé Excel</th>
                        <th class="num">Prix client</th>
                        <th class="num">Prix UGAP</th>
                        <th>Prix</th>
                        <th>Postes</th>
                        <th></th>
                    </tr>
                </thead>
                <tbody>${body}</tbody>
            </table>
            </div>`;
        bindTableInteractions(mount);
        updateSelectionActionBar(mount);
    }

    async function refreshFromStaging() {
        const mount = document.querySelector(MOUNT_SELECTOR);
        if (!mount) return;
        const previous = getAllLines();
        if (typeof global.apiCall === 'function') {
            try {
                const res = await global.apiCall('/imports/staging');
                if (res?.data) {
                    global.currentImportStaging = res.data;
                    global.currentImportId = String(res.data._id || '');
                }
            } catch (_e) { /* ignore */ }
        }
        const det = global.__ugapDetectionReport?.linesByKind?.base_option;
        const saved = global.currentImportStaging?.importBaseProducts;
        let rebuilt = buildWorkingLines(det, saved);
        rebuilt = applyCustomNamesFromSource(rebuilt, previous);
        syncDetectionReportBaseOptions(rebuilt);
        setAllLines(rebuilt);
        renderBaseOptionTable(mount);
    }

    global.UgapBaseOptionEditor = {
        renderBaseOptionTable,
        refreshFromStaging,
        getWorkingLines: () => linesForDisplay(getAllLines()).visible,
        persistLines,
        mergeKeyForBaseOption,
        autoMergeDuplicateRows
    };
})(window);
