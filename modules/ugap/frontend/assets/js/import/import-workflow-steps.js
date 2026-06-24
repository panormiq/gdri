/**
 * FICHIER : modules/ugap/frontend/assets/js/import/import-workflow-steps.js
 * RÔLE : Étapes 2–7 du workflow import (minorations, majorations, options de base, options/PR, validation).
 * Règles mino/majo : docs/onglet-import/REGLES-MINO-MAJO.md
 * ENTRÉES : `window.currentImportStaging`, API staging, DOM `#import-workflow-content-families`.
 * SORTIES : HTML par étape ; sauvegardes POST minorations/majorations/tri/base-products ; publish.
 * DÉPEND DE : `window.apiCall`, `import-workflow-shell.js`, `import-models-step.js`, helpers admin.php restants.
 * NE PAS : liste imports (import-list.js), étape 1 modèles (import-models-step.js).
 * APPELÉ PAR : import-workflow-shell.js (`renderImportWorkflow`).
 *
 * TODO : découper majorations, base-options, options-tri, validate (minorations → import-minorations-step.js).
 */
(function () {
    'use strict';

    function staging() {
        return window.currentImportStaging || null;
    }

    function stagingId() {
        return String(window.currentImportId || '').trim();
    }

    function wfState() {
        if (!window.importWorkflowState) {
            window.importWorkflowState = {
                step: 'models',
                minoAutoSeeded: false,
                majorationAutoSeeded: false,
                validateAssignAllPostesToUnassigned: true
            };
        }
        return window.importWorkflowState;
    }

    const IMPORT_MINO_STYLE_ID = 'ugap-import-mino-styles';

    function ensureImportMinoStyles() {
        if (document.getElementById(IMPORT_MINO_STYLE_ID)) return;
        const el = document.createElement('style');
        el.id = IMPORT_MINO_STYLE_ID;
        el.textContent = `
.ugap-import-mino-wrap { font-size: 13px; max-width: 100%; overflow-x: visible; box-sizing: border-box; }
.ugap-import-mino-registry-stack {
    position: relative;
    margin-top: 10px;
}
.ugap-import-mino-registry-stack .ugap-import-mino-table-scroll,
.ugap-import-mino-registry-stack .ugap-import-opt-tri-table-wrap {
    box-sizing: border-box;
}
.ugap-import-workflow-sticky {
    position: sticky;
    top: 0;
    z-index: 200;
    margin-bottom: 0;
    border: 1px solid #eef2f7;
    border-radius: 8px 8px 0 0;
    background: #f9fafb;
    box-shadow: 0 2px 8px rgba(15, 23, 42, 0.08);
}
.ugap-import-workflow-steps {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    padding: 10px;
}
.ugap-import-workflow-actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    align-items: center;
    gap: 10px;
    padding: 8px 10px;
    border-top: 1px solid #eef2f7;
    background: #fff;
}
.ugap-import-workflow-actions[hidden] {
    display: none !important;
}
.ugap-import-workflow-pane {
    padding: 12px;
    border: 1px solid #eef2f7;
    border-top: none;
    border-radius: 0 0 8px 8px;
    background: #fff;
}
.ugap-import-mino-summary {
    margin-bottom: 12px; padding: 10px 12px; background: #eff6ff; border: 1px solid #bfdbfe;
    border-radius: 8px; color: #1e3a5f; font-size: 13px;
}
.ugap-import-mino-toolbar { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-bottom: 10px; }
.ugap-import-mino-table-scroll {
    overflow-x: auto;
    overflow-y: visible;
    max-height: none;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
}
.ugap-import-mino-assign-table-wrap,
.ugap-import-bp-table-wrap {
    overflow-x: auto;
    overflow-y: visible;
    max-height: none;
}
.ugap-import-mino-table { width: max-content; min-width: 100%; border-collapse: separate; border-spacing: 0; font-size: 12px; }
.ugap-import-mino-table th, .ugap-import-mino-table td {
    border-bottom: 1px solid #f1f5f9; padding: 8px 10px; vertical-align: top; background: #fff;
}
.ugap-import-mino-table thead th { background: #f8fafc; position: sticky; top: 0; z-index: 3; }
.ugap-import-mino-sticky-detail {
    position: sticky; left: 0; z-index: 4; min-width: 36%; width: 36%; max-width: min(42rem, 72vw);
    background: #fafbfc; box-shadow: 4px 0 10px -6px rgba(15, 23, 42, 0.12);
}
.ugap-import-mino-table thead .ugap-import-mino-sticky-detail { z-index: 5; background: #f8fafc; }
.ugap-import-mino-label-raw { font-size: 11px; color: #94a3b8; margin-top: 6px; line-height: 1.35; word-break: break-word; }
.ugap-import-mino-ref-tag { font-size: 10px; color: #64748b; font-family: monospace; margin-bottom: 4px; display: block; }
.ugap-import-mino-hint { font-size: 11px; color: #64748b; margin-top: 3px; line-height: 1.35; }
.ugap-import-mino-motor { color: #0f766e; font-weight: 600; }
.ugap-import-mino-registry {
    margin-bottom: 12px; padding: 10px 12px; background: #eff6ff; border: 1px solid #bfdbfe;
    border-radius: 8px; font-size: 12px; color: #1e3a5f;
}
.ugap-import-mino-registry ul { margin: 6px 0 0; padding-left: 18px; }
.ugap-import-bp-table-wrap { margin-top: 8px; }
.ugap-bp-name-type-row {
    display: flex; flex-wrap: wrap; align-items: flex-start; gap: 8px 12px; margin-bottom: 8px;
}
.ugap-bp-name-type-row .ugap-bp-name-field {
    display: flex; flex-direction: column; align-items: stretch; gap: 4px;
    flex: 1 1 58%; min-width: 0;
}
.ugap-bp-name-type-row .ugap-bp-type-field {
    display: flex; flex-direction: column; align-items: stretch; gap: 4px; flex: 0 0 auto;
}
.ugap-bp-name-type-row .ugap-bp-type-field--compact .ugap-import-adj-select {
    width: 5.75rem; min-width: 5.75rem; max-width: 6.25rem; padding: 5px 6px; font-size: 11px;
}
.ugap-adj-field-label { font-size: 11px; font-weight: 600; color: #64748b; line-height: 1.2; }
.ugap-bp-name-type-row .ugap-bp-name-input { flex: 1 1 auto; min-width: 120px; width: auto; }
.ugap-bp-name-type-row .ugap-import-bp-select { min-width: 200px; max-width: 280px; }
.ugap-bp-name-cell {
    cursor: pointer; padding: 6px 8px; border: 1px dashed #cbd5e1; border-radius: 6px;
    background: #f8fafc;
}
.ugap-bp-name-cell:hover { background: #e0f2fe; border-color: #7dd3fc; }
.ugap-bp-name-cell__text { display: block; font-weight: 600; font-size: 12px; color: #0f172a; }
.ugap-bp-name-cell__hint { display: block; font-size: 10px; color: #64748b; margin-top: 2px; }
.ugap-bp-name-input,
.ugap-mino-option-name-input {
    width: 100%; max-width: 100%; box-sizing: border-box; padding: 6px 8px;
    border: 1px solid #cbd5e1; border-radius: 6px; font-size: 12px; font-weight: 600;
}
.ugap-import-bp-modal { position: fixed; inset: 0; z-index: 10050; display: flex; align-items: center; justify-content: center; padding: 16px; }
.ugap-import-bp-modal[hidden] { display: none !important; }
.ugap-import-bp-modal__backdrop { position: absolute; inset: 0; background: rgba(15, 23, 42, 0.45); }
.ugap-import-bp-modal__panel { position: relative; z-index: 1; width: min(480px, 96vw); background: #fff; border-radius: 10px; padding: 18px 20px; box-shadow: 0 12px 40px rgba(15, 23, 42, 0.2); }
.ugap-import-bp-modal__title { margin: 0 0 10px; font-size: 16px; }
.ugap-import-bp-modal__excel { margin: 0 0 12px; font-size: 12px; color: #64748b; line-height: 1.4; }
.ugap-import-bp-modal__label { display: block; font-size: 12px; font-weight: 600; color: #475569; margin-bottom: 6px; }
.ugap-import-bp-modal__input { width: 100%; box-sizing: border-box; padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 14px; }
.ugap-import-bp-modal__actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 16px; }
body.ugap-import-bp-modal-open { overflow: hidden; }
.ugap-mino-option-name-input {
    margin-top: 0; font-weight: 500; resize: vertical; min-height: 2.65em; max-height: 5.5em;
    line-height: 1.35; white-space: pre-wrap; overflow-wrap: anywhere; word-break: break-word;
}
.ugap-mino-option-name-row { display: contents; }
.ugap-import-mino-label-raw--multiline { line-height: 1.35; white-space: pre-wrap; overflow-wrap: anywhere; word-break: break-word; }
.ugap-import-bp-select {
    min-width: 220px; max-width: 100%; padding: 5px 8px;
    border: 1px solid #cbd5e1; border-radius: 6px; font-size: 12px; background: #fff;
}
.ugap-bp-price-input {
    width: 110px; padding: 5px 8px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 12px;
}
.ugap-bp-prices-inline { display: flex; flex-wrap: wrap; gap: 6px 10px; margin-top: 4px; }
.ugap-bp-price-item {
    display: inline-flex; align-items: center; gap: 4px; font-size: 11px;
    padding: 3px 8px; background: #f8fafc; border-radius: 6px; border: 1px solid #e2e8f0;
}
.ugap-bp-price-item input { width: 88px; padding: 4px 6px; font-size: 12px; }
.ugap-import-mino-poste-col { text-align: left; background: #fafbfc; vertical-align: top; }
.ugap-import-mino-poste-group { font-weight: 600; color: #475569; white-space: nowrap; min-width: 98px; width: 11%; }
.ugap-import-mino-postes-cell { padding: 4px 6px !important; min-width: 98px; width: 11%; max-width: 137px; }
.ugap-import-mino-postes-grid {
    display: grid;
    grid-template-columns: repeat(var(--mino-cols, 3), minmax(0, 1fr));
    grid-template-rows: repeat(2, auto);
    gap: 5px 2px;
    width: 100%;
    align-items: center;
    justify-items: center;
}
.ugap-import-mino-poste-cell {
    display: grid;
    grid-template-columns: auto auto;
    align-items: center;
    justify-content: center;
    gap: 2px;
    width: 100%;
    max-width: 3.25rem;
    font-size: 10px;
    font-weight: 600;
    color: #334155;
    cursor: pointer;
    user-select: none;
    line-height: 1;
}
.ugap-import-mino-poste-cell span {
    font-variant-numeric: tabular-nums;
    min-width: 1.15em;
    text-align: left;
}
.ugap-import-mino-poste-cell input { margin: 0; cursor: pointer; flex-shrink: 0; }
.ugap-import-mino-cb-suggested { accent-color: #16a34a; }
.ugap-import-bp-merge-row { margin-top: 8px; padding-top: 8px; border-top: 1px dashed #e2e8f0; }
.ugap-bp-linked-minos { margin-top: 4px; }
.ugap-bp-linked-minos-details { font-size: 11px; color: #64748b; }
.ugap-bp-linked-minos-summary {
    display: inline-flex; align-items: center; gap: 6px; cursor: pointer;
    list-style: none; user-select: none; line-height: 1.4;
}
.ugap-bp-linked-minos-summary::-webkit-details-marker { display: none; }
.ugap-bp-linked-minos-summary::marker { display: none; content: ''; }
.ugap-bp-linked-minos-chevron {
    display: inline-flex; align-items: center; justify-content: center;
    width: 18px; height: 18px; border-radius: 4px; background: #f1f5f9;
    border: 1px solid #e2e8f0; color: #475569; flex-shrink: 0;
    transition: transform 0.15s ease, background 0.15s ease;
}
.ugap-bp-linked-minos-details[open] .ugap-bp-linked-minos-chevron { transform: rotate(180deg); background: #e2e8f0; }
.ugap-bp-linked-minos-summary:hover .ugap-bp-linked-minos-chevron { background: #e2e8f0; }
.ugap-bp-linked-minos-list {
    margin: 6px 0 0; padding: 6px 8px 6px 22px; list-style: disc;
    background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px;
    max-height: 160px; overflow-y: auto;
}
.ugap-bp-linked-minos-list li { margin: 0 0 4px; line-height: 1.35; word-break: break-word; }
.ugap-bp-linked-minos-list li:last-child { margin-bottom: 0; }
.ugap-bp-linked-minos-ref { font-family: monospace; font-size: 10px; color: #94a3b8; margin-right: 4px; }
.ugap-import-opt-tri-table-wrap {
    overflow-x: hidden; overflow-y: visible; width: 100%; max-width: 100%;
    border: 1px solid #e5e7eb; border-radius: 8px; box-sizing: border-box;
}
.ugap-import-opt-tri-table.ugap-import-mino-table {
    width: 100% !important; max-width: 100% !important; min-width: 0 !important;
    table-layout: fixed; border-collapse: collapse;
}
.ugap-import-opt-tri-table thead th { position: sticky; top: 0; z-index: 2; }
.ugap-import-opt-tri-table-wrap .ugap-import-mino-table th,
.ugap-import-opt-tri-table-wrap .ugap-import-mino-table td { overflow-wrap: anywhere; word-break: break-word; }
.ugap-import-opt-tri-table .ugap-import-opt-tri-type-col { width: 100px !important; min-width: 100px !important; max-width: 100px !important; }
.ugap-import-opt-tri-table .ugap-import-opt-tri-label-col { width: auto !important; min-width: 0 !important; }
/* Postes : ~+20 % vs majoration (3.25rem → 3.9rem/cell) + largeur fixe pour 5 colonnes */
.ugap-import-opt-tri-table .ugap-import-mino-poste-group,
.ugap-import-opt-tri-table .ugap-import-mino-postes-cell {
    width: 360px !important; min-width: 360px !important; max-width: 360px !important;
    padding: 6px 8px !important; box-sizing: border-box;
}
.ugap-import-opt-tri-table .ugap-import-mino-postes-grid { gap: 6px 4px !important; width: 100% !important; }
.ugap-import-opt-tri-table .ugap-import-mino-poste-cell {
    max-width: 3.9rem !important; font-size: 12px !important; gap: 4px !important;
}
.ugap-import-opt-tri-table .ugap-import-mino-poste-cell span { min-width: 1.4em !important; font-size: 12px !important; }
.ugap-import-opt-tri-table .ugap-import-mino-poste-cell input {
    width: 15px !important; height: 15px !important; min-width: 15px !important; min-height: 15px !important;
    transform: none !important; margin: 0 !important;
}
.ugap-import-opt-tri-label-main {
    font-weight: 600; overflow: hidden; text-overflow: ellipsis;
    display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
    line-height: 1.3; word-break: break-word;
}
.ugap-import-opt-tri-poste-missing { opacity: 0.45; cursor: not-allowed; }
.ugap-import-opt-tri-type-select { width: 100%; max-width: 100%; min-width: 0; padding: 4px 4px; border: 1px solid #cbd5e1; border-radius: 4px; font-size: 11px; background: #fff; box-sizing: border-box; }
.ugap-import-opt-tri-type-select.kind-option { border-color: #6ee7b7; background: #f0fdf4; }
.ugap-import-opt-tri-type-select.kind-minoration { border-color: #93c5fd; background: #eff6ff; }
.ugap-import-opt-tri-type-select.kind-majoration { border-color: #fcd34d; background: #fffbeb; }
.ugap-import-opt-tri-row--opt td { background: #f0fdf4 !important; }
.ugap-import-opt-tri-row--mino td { background: #eff6ff !important; }
.ugap-import-opt-tri-row--majo td { background: #fffbeb !important; }
.ugap-import-opt-tri-row--opt td.ugap-import-opt-tri-type-col,
.ugap-import-opt-tri-row--mino td.ugap-import-opt-tri-type-col,
.ugap-import-opt-tri-row--majo td.ugap-import-opt-tri-type-col { background: inherit !important; }
.ugap-import-opt-tri-table thead th {
    border-bottom: 2px solid #64748b !important;
    box-shadow: 0 2px 0 0 #e2e8f0;
}
.ugap-import-opt-tri-table tbody tr td {
    padding-top: 10px !important;
    padding-bottom: 10px !important;
    border-bottom: 2px solid #94a3b8 !important;
    box-shadow: inset 0 -1px 0 0 rgba(15, 23, 42, 0.06);
}
.ugap-import-opt-tri-table tbody tr:last-child td { border-bottom: 1px solid #cbd5e1 !important; }
.ugap-import-opt-tri-legend { display: flex; flex-wrap: wrap; gap: 10px 16px; margin-bottom: 10px; font-size: 12px; }
.ugap-import-opt-tri-legend-item { display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 6px; font-weight: 600; }
.ugap-import-opt-tri-legend-item--opt { background: #dcfce7; color: #047857; border: 1px solid #86efac; }
.ugap-import-opt-tri-legend-item--mino { background: #dbeafe; color: #1d4ed8; border: 1px solid #93c5fd; }
.ugap-import-opt-tri-legend-item--majo { background: #fef3c7; color: #b45309; border: 1px solid #fcd34d; }
`;
        document.head.appendChild(el);
    }

    /** @deprecated — barre dans #ugap-import-workflow-actions (sous les onglets). */
    function renderImportStickyActionsHtml() {
        return '';
    }

    function buildImportWorkflowActionsHtml(cfg) {
        if (!cfg) return '';
        const saveFn = String(cfg.saveHandler || '').trim();
        const saveTxt = escapeHtml(String(cfg.saveLabel || 'Enregistrer'));
        const step = escapeHtml(String(cfg.nextStep || ''));
        const nextTxt = escapeHtml(String(cfg.nextLabel || 'Étape suivante'));
        const saveBtn = saveFn
            ? `<button type="button" class="btn btn-success" data-ugap-wf-action="save">${saveTxt}</button>`
            : '';
        const nextBtn = step
            ? `<button type="button" class="btn btn-outline" data-ugap-wf-action="next">${nextTxt}</button>`
            : '';
        return `${saveBtn}${nextBtn}`;
    }

    function bindImportWorkflowActionsBar() {
        const bar = document.getElementById('ugap-import-workflow-actions');
        if (!bar || bar.dataset.bound === '1') return;
        bar.dataset.bound = '1';
        bar.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-ugap-wf-action]');
            if (!btn) return;
            const cfg = getImportActionsDockConfig();
            if (!cfg) return;
            const action = btn.getAttribute('data-ugap-wf-action');
            if (action === 'save') {
                const fn = window[cfg.saveHandler];
                if (typeof fn === 'function') fn();
            } else if (action === 'next' && cfg.nextStep) {
                switchImportWorkflowStep(cfg.nextStep);
                if (typeof renderImportWorkflow === 'function') renderImportWorkflow();
            }
        });
    }

    function parseMoney(value) {
        if (value == null || value === '') return null;
        const n = Number(String(value).replace(/\s/g, '').replace(',', '.').replace(/[^\d.-]/g, ''));
        return Number.isFinite(n) ? n : null;
    }

    function formatImportMinoPriceDisplay(value) {
        const n = parseMoney(value);
        if (n == null) return '—';
        return `${n.toFixed(2)} €`;
    }

    /** Prix ligne MINO issu de l’import Excel (client, sinon UGAP). */
    function getImportMinorationExcelPrice(opt) {
        const pc = parseMoney(opt?.priceClient);
        if (pc != null) return pc;
        return parseMoney(opt?.priceUgap);
    }

    function isImportBaseOptionsValidated(stagingDoc) {
        return String(stagingDoc?.baseOptionsStatus || '').toLowerCase() === 'validated';
    }

    function resolveImportBaseProductPriceForMinoration(opt, models) {
        if (!isImportBaseOptionsValidated(staging())) return null;
        const bp = findImportBaseProductForOption(opt);
        if (!bp) return null;
        const modelById = buildImportModelByIdMap(models);

        if (bp.pricingMode === 'per_model') {
            const optModels = new Set(
                (Array.isArray(opt.compatibleModels) ? opt.compatibleModels : [])
                    .map((x) => String(x || '').trim())
                    .filter(Boolean)
            );
            let candidateIds = (bp.modelIds || []).map(String).filter(Boolean);
            if (optModels.size) {
                const intersect = candidateIds.filter((mid) => optModels.has(mid));
                candidateIds = intersect.length ? intersect : [...optModels];
            }
            const sorted = sortModelIdsByPosteNumber(candidateIds, modelById);
            for (const mid of sorted) {
                const p = parseMoney(bp.pricesByModelId?.[mid]);
                if (p != null) {
                    const m = modelById.get(mid);
                    const posteHint = formatImportPosteColLabel(m);
                    return { price: p, posteHint: posteHint !== '—' ? posteHint : null };
                }
            }
            return null;
        }

        const p = parseMoney(bp.price);
        return p != null ? { price: p, posteHint: null } : null;
    }

    function renderImportOptionPricePartHtml(baseInfo, linePrice, opt) {
        const baseValidated = isImportBaseOptionsValidated(staging());
        if (!baseValidated) {
            return '<span style="color:#94a3b8;">—</span> <span class="ugap-import-mino-hint">(enregistrer options de base — étape 2)</span>';
        }
        if (opt && (isImportMotorMinoration(opt) || isImportCatalogMotorTarifLine(opt))) {
            const modelList = getImportStagingModelsForAssignment();
            const targets = resolveImportMinorationPosteModelIds(opt, modelList);
            const model = targets[0] || modelList.find((m) => {
                const mid = String(m?.id || '').trim();
                const cm = (Array.isArray(opt?.compatibleModels) ? opt.compatibleModels : []).map(String);
                return mid && cm.includes(mid);
            });
            const minoPrice = model
                ? inferImportMotorBaseProductPriceFromMinoration(model, isImportCatalogMotorTarifLine(opt) ? null : opt)
                : null;
            if (minoPrice != null) {
                return formatImportMinoPriceDisplay(minoPrice);
            }
            if (isImportCatalogMotorTarifLine(opt)) {
                return `${formatImportMinoPriceDisplay(null)} <span class="ugap-import-mino-hint">(prix minoration MINO manquant pour ce poste)</span>`;
            }
            if (linePrice == null) {
                return `${formatImportMinoPriceDisplay(null)} <span class="ugap-import-mino-hint">(prix minoration Excel manquant)</span>`;
            }
            return formatImportMinoPriceDisplay(linePrice);
        }
        if (!baseInfo || baseInfo.price == null) {
            return '<span style="color:#94a3b8;">—</span> <span class="ugap-import-mino-hint">(saisir prix option de base)</span>';
        }
        if (linePrice == null) {
            return `${formatImportMinoPriceDisplay(null)} <span class="ugap-import-mino-hint">(prix Excel manquant)</span>`;
        }
        let optPart = formatImportMinoPriceDisplay(baseInfo.price + linePrice);
        if (baseInfo.posteHint) {
            optPart += ` <span class="ugap-import-mino-hint">(base ${escapeHtml(baseInfo.posteHint)})</span>`;
        }
        return optPart;
    }

    function getImportAdjOptionsScope(opt, group) {
        if (group?.options?.length) return group.options;
        return opt ? [opt] : [];
    }

    function setImportOptionPriceClient(opt, price) {
        if (!opt) return;
        const n = parseMoney(price);
        if (n == null) {
            delete opt.priceClient;
        } else {
            opt.priceClient = n;
        }
    }

    function setImportAdjPricingModeOnScope(scope, mode) {
        const m = mode === 'per_model' ? 'per_model' : 'fixed';
        (Array.isArray(scope) ? scope : []).forEach((row) => {
            if (row) row.importAdjPricingMode = m;
        });
    }

    function ensureImportAdjPricingModeInferred(opt, group, models) {
        const scope = getImportAdjOptionsScope(opt, group);
        if (!scope.length) return;
        const stored = scope[0]?.importAdjPricingMode;
        if (stored === 'per_model' || stored === 'fixed') return;
        setImportAdjPricingModeOnScope(scope, inferImportAdjPricingModeFromExcelPrices(opt, group, models));
    }

    function getImportAdjPricingMode(opt, group, models) {
        ensureImportAdjPricingModeInferred(opt, group, models);
        const scope = getImportAdjOptionsScope(opt, group);
        const stored = scope[0]?.importAdjPricingMode;
        if (stored === 'per_model' || stored === 'fixed') return stored;
        return inferImportAdjPricingModeFromExcelPrices(opt, group, models);
    }

    function getImportAdjFixedPrice(scope) {
        const prices = (Array.isArray(scope) ? scope : [])
            .map((row) => getImportMinorationExcelPrice(row))
            .filter((p) => p != null);
        if (!prices.length) return null;
        return prices[0];
    }

    function applyImportAdjPricingModeChange(opt, group, models, nextModeRaw) {
        const scope = getImportAdjOptionsScope(opt, group);
        if (!scope.length) return;
        const prevMode = getImportAdjPricingMode(opt, group, models);
        const nextMode = nextModeRaw === 'per_model' ? 'per_model' : 'fixed';
        setImportAdjPricingModeOnScope(scope, nextMode);
        if (nextMode === 'per_model' && prevMode === 'fixed') {
            const fixed = getImportAdjFixedPrice(scope);
            if (fixed != null) {
                scope.forEach((row) => {
                    if (getImportMinorationExcelPrice(row) == null) {
                        setImportOptionPriceClient(row, fixed);
                    }
                });
            }
        }
    }

    function getImportAdjPriceMountKey(opt, group) {
        if (group?.options?.length) return encodeImportAdjGroupOptIds(group.options);
        return String(opt?.id || '').trim();
    }

    function renderImportAdjPricingTypeSelectHtml(opt, group, models) {
        ensureImportAdjPricingModeInferred(opt, group, models);
        const mode = getImportAdjDisplayPricingMode(opt, group, models);
        const mountKey = escapeHtml(getImportAdjPriceMountKey(opt, group));
        const encGroup = group?.options?.length ? mountKey : '';
        const encOptId = opt && !group?.options?.length ? escapeHtml(String(opt.id || '').trim()) : '';
        return `<div class="ugap-bp-type-field ugap-bp-type-field--compact"><span class="ugap-adj-field-label">Type</span>
                <select class="ugap-import-adj-select" data-adj-field="pricingMode"
                    data-adj-group-opts="${encGroup}" data-mino-opt-id="${encOptId}">
                    <option value="fixed" title="Un même prix pour tous les postes cochés" ${mode === 'fixed' ? 'selected' : ''}>Fixe</option>
                    <option value="per_model" title="Prix Excel distinct par poste P1, P2…" ${mode === 'per_model' ? 'selected' : ''}>Par poste</option>
                </select>
            </div>`;
    }

    function renderImportAdjOptionNameInputHtml(value, attrs, motorCls = '') {
        return `<textarea rows="2" class="ugap-mino-option-name-input${motorCls}" ${attrs}
            placeholder="Nom de l'option (renommer)">${escapeHtml(String(value || ''))}</textarea>`;
    }

    function refreshImportMinorationAssignPricesDom() {
        const models = getImportStagingModelsForAssignment();
        document.querySelectorAll('.ugap-adj-price-mount[data-adj-price-mount]').forEach((mount) => {
            const key = String(mount.getAttribute('data-adj-price-mount') || '').trim();
            if (!key) return;
            const optIds = decodeImportAdjGroupOptIds(key);
            let opt = null;
            let group = null;
            if (optIds.length) {
                const options = optIds.map((id) => findImportStagingOptionById(id)).filter(Boolean);
                if (!options.length) return;
                group = { options, label: getImportAdjOptionFusionLabel(options[0], models) };
            } else {
                opt = findImportStagingOptionById(key);
                if (!opt) return;
            }
            const priceKind = String(mount.getAttribute('data-adj-price-kind') || 'minoration');
            const scope = group ? group.options : [opt];
            const sample = scope[0];
            const mode = getImportAdjDisplayPricingMode(sample, group, models);
            mount.innerHTML = renderImportAdjPriceBlockInner(sample, group, models, priceKind, mode);
        });
        document.querySelectorAll('.ugap-adj-total-hint[data-adj-total-mount]').forEach((mount) => {
            const key = String(mount.getAttribute('data-adj-total-mount') || '').trim();
            const optIds = decodeImportAdjGroupOptIds(key);
            let opt = null;
            let group = null;
            if (optIds.length) {
                const options = optIds.map((id) => findImportStagingOptionById(id)).filter(Boolean);
                if (!options.length) return;
                group = { options };
            } else {
                opt = findImportStagingOptionById(key);
            }
            mount.innerHTML = renderImportAdjTotalOptionHintHtml(opt, group, models);
        });
    }

    function pricesRoughlyEqual(a, b, eps = 0.02) {
        if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
        return Math.abs(a - b) <= eps;
    }

    function tryParseSuppressionMinorationLabel(label) {
        const text = String(label || '').replace(/\s+/g, ' ').trim();
        if (!/^supp?ress(?:ion)?\b/i.test(text)) return null;
        const prevueMatch = text.match(/^supp?ress(?:ion)?\s+(.+?)\s+pr[eéè]v[uue]{1,2}\s+de\s+base\b/i);
        if (prevueMatch) {
            return {
                changeType: 'suppression',
                initialProduct: String(prevueMatch[1] || '').trim(),
                finalProduct: 'Suppression'
            };
        }
        const genericMatch = text.match(/^supp?ress(?:ion)?\s+(.+)$/i);
        if (genericMatch) {
            let initialProduct = String(genericMatch[1] || '').trim();
            initialProduct = initialProduct.replace(/\s+pr[eéè]v[uue]{1,2}\s+de\s+base\s*$/i, '').trim();
            initialProduct = initialProduct.replace(/\s*-\s*sous\s+r[eé]serve\b.*$/i, '').trim();
            return {
                changeType: 'suppression',
                initialProduct,
                finalProduct: 'Suppression'
            };
        }
        return null;
    }

    function extractPriceFromMinorationLabel(label) {
        const raw = String(label || '');
        const patterns = [
            /\b(\d{1,3}(?:\s?\d{3})*(?:[.,]\d{2})?)\s*€/i,
            /€\s*(\d{1,3}(?:\s?\d{3})*(?:[.,]\d{2})?)/i,
            /\b(\d{1,3}(?:[.,]\d{2})?)\s*eur(?:os?)?\b/i
        ];
        for (const re of patterns) {
            const m = raw.match(re);
            if (m) {
                const p = parseMoney(m[1]);
                if (p != null && p > 0) return p;
            }
        }
        return null;
    }

    /** Parsing libellé mino/majoration (aligné UgapExcelService.parseBaseReplacementProducts). */
    function parseImportBaseReplacementProducts(label) {
        const raw = String(label || '').replace(/\s+/g, ' ').trim();
        if (!raw) return { changeType: '', initialProduct: '', finalProduct: '' };

        const cleaned = raw.replace(/\s*-\s*postes?\s+[\d\s,etàa\-–—]+$/i, '').trim();
        const sup = tryParseSuppressionMinorationLabel(cleaned);
        if (sup) return sup;

        if (/\bnon\s+fourniture\s+du\s+moteur\s+de\s+base\b/i.test(cleaned)) {
            return {
                changeType: 'motor_base_non_supply',
                initialProduct: 'moteur de base',
                finalProduct: 'moteur choisi'
            };
        }

        const nonSupplyMatch = cleaned.match(/^non\s+fourniture\s+(?:du|de\s+la|des|de\s+l['’])\s+(.+)$/i);
        if (nonSupplyMatch) {
            return {
                changeType: 'non_supply',
                initialProduct: String(nonSupplyMatch[1] || '')
                    .replace(/\s*-\s*postes?\s+[\d\s,etàa\-–—]+$/i, '')
                    .trim(),
                finalProduct: ''
            };
        }

        const replacementMatch =
            cleaned.match(/^(.*?)\s+en\s+remplacement\s+de\s+(?:l['’]|la\s+|le\s+|les\s+)?(.+?)\s+fourni\s+de\s+base\b/i)
            || cleaned.match(/^(.*?)\s+en\s+remplacement\s+de\s+(?:l['’]|la\s+|le\s+|les\s+)?(.+)$/i)
            || cleaned.match(/^(.*?)\s+en\s+remplacement\s+(?:de\s+)?(?:l['’]|la\s+|le\s+|les\s+)?(.+)$/i);
        if (replacementMatch) {
            const before = String(replacementMatch[1] || '').trim();
            const replacedBase = String(replacementMatch[2] || '')
                .replace(/\s*-\s*postes?\s+[\d\s,etàa\-–—]+$/i, '')
                .trim();
            const beforeNoPrefix = before.replace(/^(moins-value|plus-value|plus\s+value)\s+/i, '').trim();
            let finalProduct = beforeNoPrefix
                .replace(/^(module\s+sondeur|combin[ée]|motorisation|moteur|pack|option)\s+/i, '')
                .trim();
            if (!finalProduct) finalProduct = beforeNoPrefix;

            let initialProduct = inferImportReplacedBaseProductLabel(beforeNoPrefix, replacedBase);

            return { changeType: 'replacement', initialProduct, finalProduct };
        }

        const inPlaceMatch = cleaned.match(/^(.*?)\s+(?:au|en)\s+lieu\s+et\s+place\s+de\s+(?:l['’]|la\s+|le\s+|les\s+)?(.+)$/i);
        if (inPlaceMatch) {
            const before = String(inPlaceMatch[1] || '').trim();
            const replaced = String(inPlaceMatch[2] || '').trim();
            return {
                changeType: 'replacement',
                initialProduct: inferImportReplacedBaseProductLabel(before, replaced),
                finalProduct: before
            };
        }

        return { changeType: '', initialProduct: '', finalProduct: '' };
    }

    function getImportParsedBaseReplacementLinks(opt) {
        const backendInitial = String(opt?.initialProduct || '').trim();
        const backendFinal = String(opt?.finalProduct || '').trim();
        const backendType = String(opt?.changeType || '').trim();
        if (backendInitial || backendFinal || backendType) {
            return {
                changeType: backendType,
                initialProduct: backendInitial,
                finalProduct: backendFinal
            };
        }

        const parsed = parseImportBaseReplacementProducts(opt?.name);
        if (parsed?.initialProduct || parsed?.finalProduct || parsed?.changeType) return parsed;

        if (typeof extractBaseReplacementProductsForUi === 'function') {
            const ui = extractBaseReplacementProductsForUi(opt);
            if (ui?.initialProduct || ui?.finalProduct || ui?.changeType) return ui;
        }

        return parsed;
    }

    /**
     * Type effectif : override manuel (étape Options) ou détection auto.
     * @see modules/ugap/docs/onglet-import/REGLES-MINO-MAJO.md
     */
    function getImportResolvedLineKind(opt) {
        const manual = String(opt?.importOptionLineKind || '').trim().toLowerCase();
        if (manual === 'minoration' || manual === 'majoration' || manual === 'option') return manual;
        if (isImportPrOption(opt)) return 'pr';
        const ref = String(opt?.refUgap || '').trim().toUpperCase();
        if (ref.includes('MINO')) return 'minoration';
        const name = String(opt?.name || '').replace(/\s+/g, ' ').trim();
        if (/^moins-value\b/i.test(name)) return 'minoration';
        if (isImportMajorationLabel(name) || isImportMotorCatalogLine(opt)) return 'majoration';
        return 'option';
    }

    /** Une minoration = réf. UGAP contient « MINO » (aligné import backend). */
    function isImportMinorationOption(opt) {
        return getImportResolvedLineKind(opt) === 'minoration';
    }

    /** PR : libellé commence par « PR » — exclu des majorations. */
    function isImportPrOption(opt) {
        return /^PR\s/i.test(String(opt?.name || '').replace(/\s+/g, ' ').trim());
    }

    /** Forfait / garantie : hors majorations (prestation administrative, pas un remplacement équipement). */
    function isImportExcludedFromMajorationLabel(name) {
        const n = String(name || '').replace(/\s+/g, ' ').trim();
        if (!n) return false;
        return /\b(forfait|garanties?|extension\s+de\s+garantie)\b/i.test(n);
    }

    /** @deprecated Utiliser isImportExcludedFromMajorationLabel */
    function isImportMotorForfaitOrGarantieLabel(name) {
        return isImportExcludedFromMajorationLabel(name);
    }

    /**
     * Ligne catalogue moteur : catégorie Excel « Motorisation » ou libellé type « 150 CV », « DF 140 APX ».
     */
    function isImportMotorCatalogLine(opt) {
        const cat = String(opt?.category || '').trim();
        const n = String(opt?.name || '').replace(/\s+/g, ' ').trim();
        if (!n || isImportExcludedFromMajorationLabel(n)) return false;
        if (/^motorisation$/i.test(cat)) return true;
        if (/\b(moteur|motorisation|suzuki|mercury|yamaha|honda|evinrude|tohatsu|yanmar|volvo)\b/i.test(n)) {
            return true;
        }
        if (/\b\d{2,4}\s*cv\b/i.test(n)) return true;
        if (/\bdf\s*\d{2,4}\b/i.test(n)) return true;
        if (/\b(apx|apt|btx|atl)\b/i.test(n) && /\b\d{2,4}\b/.test(n)) return true;
        if (/\b(2\s+moteurs?|bi-moteur|bimoteur|double\s+moteur|jumelage\s+(?:de\s+)?moteurs?)\b/i.test(n)) {
            return true;
        }
        return false;
    }

    /** Majoration : libellé (en remplacement, en lieu et place, moteur…) — hors MINO et PR. */
    function isImportMajorationLabel(name) {
        const n = String(name || '').replace(/\s+/g, ' ').trim();
        if (!n || isImportPrOption({ name: n })) return false;
        if (/^supp?ress(?:ion)?\b/i.test(n)) return false;
        if (isImportExcludedFromMajorationLabel(n)) return false;
        if (/^(plus-value|plus\s+value)\b/i.test(n)) return true;
        if (/\ben\s+lieux?\s+et\s+place\b/i.test(n)) return true;
        if (/\bau\s+lieu\s+et\s+place\b/i.test(n)) return true;
        if (/\ben\s+remplacement\b/i.test(n)) return true;
        if (/\bnon\s+fourniture\b/i.test(n)) return true;
        if (isImportMotorCatalogLine({ name: n, category: '' })) return true;
        const parsed = typeof extractBaseReplacementProductsForUi === 'function'
            ? extractBaseReplacementProductsForUi({ name: n })
            : {};
        if (parsed?.changeType === 'motor_base_non_supply') return true;
        if (parsed?.changeType === 'non_supply') return true;
        return false;
    }

    function isImportMajorationOption(opt) {
        return getImportResolvedLineKind(opt) === 'majoration';
    }

    function isImportTriEligibleOption(opt) {
        return getImportResolvedLineKind(opt) !== 'pr';
    }

    /** Suppressions : gérées via le tableau « Options de base » (haut), pas le tableau d’assignation (bas). */
    function isImportSuppressionMinoration(opt, models) {
        if (/^supp?ress(?:ion)?\b/i.test(String(opt?.name || '').replace(/\s+/g, ' ').trim())) return true;
        const links = resolveImportMinorationOptionLinks(opt, models);
        if (links?.changeType === 'suppression') return true;
        const final = String(links?.finalProduct || '').trim().toLowerCase();
        return final === 'suppression';
    }

    function getImportStagingOptionsFlat() {
        const st = staging();
        if (Array.isArray(st?.importOptions)) {
            return st.importOptions.slice().sort(
                (a, b) => (Number(a?.rowOrder) || 0) - (Number(b?.rowOrder) || 0)
            );
        }
        const cats = Array.isArray(st?.categories) ? st.categories : [];
        const out = [];
        cats.forEach((cat) => {
            (Array.isArray(cat?.options) ? cat.options : []).forEach((opt) => out.push(opt));
        });
        return out.sort((a, b) => (Number(a?.rowOrder) || 0) - (Number(b?.rowOrder) || 0));
    }

    function findImportStagingOptionById(optionId) {
        const id = String(optionId || '').trim();
        if (!id) return null;
        const flat = getImportStagingOptionsFlat();
        return flat.find((o) => String(o?.id || '').trim() === id) || null;
    }

    function getImportStagingModelsForAssignment() {
        const models = Array.isArray(staging()?.models) ? staging().models : [];
        const validatedIds = new Set(
            (Array.isArray(staging()?.progress?.validatedModelIds)
                ? staging().progress.validatedModelIds
                : []
            ).map((x) => String(x || '').trim()).filter(Boolean)
        );
        return models
            .filter((m) => validatedIds.has(String(m?.id || '').trim()))
            .sort((a, b) => {
                const na = Number(a?.posteNumber);
                const nb = Number(b?.posteNumber);
                const aOk = Number.isFinite(na);
                const bOk = Number.isFinite(nb);
                if (aOk && bOk && na !== nb) return na - nb;
                if (aOk && !bOk) return -1;
                if (!aOk && bOk) return 1;
                return String(a?.name || '').localeCompare(String(b?.name || ''), 'fr', { sensitivity: 'base' });
            });
    }

    function isImportMotorNonFournitureLabel(name) {
        const n = String(name || '');
        return /\bnon\s+fourniture\b/i.test(n) && /\bmoteurs?\b/i.test(n);
    }

    function isImportMotorMinoration(opt) {
        const name = String(opt?.name || '');
        if (isImportMotorNonFournitureLabel(name)) return true;
        if (isImportMotorCatalogLine(opt)) return true;
        const parsed = typeof extractBaseReplacementProductsForUi === 'function'
            ? extractBaseReplacementProductsForUi(opt)
            : {};
        if (parsed?.changeType === 'motor_base_non_supply') return true;
        const cm = Array.isArray(opt?.compatibleModels) ? opt.compatibleModels : [];
        return cm.length > 0 && /\b(moteurs?|motorisation)\b/i.test(name);
    }

    function isImportMotorBaseProductLabel(label) {
        return /\b(moteurs?|motorisation|suzuki|mercury|yamaha|honda|evinrude|tohatsu|yanmar|volvo)\b/i.test(String(label || ''));
    }

    /** Option de base moteur : une ligne liée mino/majo ou libellé motorisation. */
    function isImportMotorBaseProduct(bp) {
        if (!bp) return false;
        if (isImportMotorBaseProductLabel(bp.label)) return true;
        const ids = filterImportBaseProductAdjOptionIds(bp.optionIds, getImportStagingModelsForAssignment());
        return ids.some((oid) => {
            const opt = findImportStagingOptionById(oid);
            return opt && (isImportMotorMinoration(opt) || isImportCatalogMotorTarifLine(opt));
        });
    }

    /** Libellé court moteur (DF150ATX, 150 CV…) — pas la ligne tarif catalogue complète. */
    function extractShortMotorLabelFromText(text) {
        const n = String(text || '').replace(/\s+/g, ' ').trim();
        if (!n) return '';
        const df = n.match(/\b(DF\d{2,4}[A-Z]{0,8})\b/i);
        if (df) return df[1].toUpperCase();
        const cv = n.match(/\b(\d{2,4})\s*ch\b/i);
        if (cv) return `${cv[1]} CV`;
        const brandCv = n.match(/\b(suzuki|mercury|yamaha|honda|evinrude)\b[^]*?\b(\d{2,4})\s*ch\b/i);
        if (brandCv) return `${brandCv[2]} CV`;
        return '';
    }

    /** Ligne MINO moteur (réf. MINO) — pas le tarif catalogue / majoration Suzuki DF150…. */
    function isImportMotorMinorationPriceLine(opt) {
        if (!opt) return false;
        if (isImportCatalogMotorTarifLine(opt)) return false;
        if (isImportMajorationOption(opt)) return false;
        // Prix moteur de base = uniquement lignes MINO moteur,
        // jamais une option catalogue "bateau complet" ni une mino non moteur.
        if (!isImportMinorationOption(opt)) return false;
        return isImportMotorMinoration(opt);
    }

    /** Prix de base moteur = prix Excel de la minoration MINO liée (pas tarif majo ni prix poste). */
    function inferImportMotorBaseProductPriceFromMinoration(model, hintOpt) {
        const mid = String(model?.id || '').trim();
        if (!mid) return null;
        const allModels = getImportStagingModelsForAssignment();
        const modelList = allModels.filter((m) => String(m?.id || '').trim() === mid);

        const pickPrice = (row) => {
            const targets = resolveImportMinorationPosteModelIds(row, allModels);
            if (!targets.includes(mid)) return null;
            const p = getImportMinorationExcelPrice(row);
            return p != null ? Math.abs(p) : null;
        };

        if (hintOpt && !isImportCatalogMotorTarifLine(hintOpt) && isImportMotorMinorationPriceLine(hintOpt)) {
            const p = pickPrice(hintOpt);
            if (p != null) return p;
        }

        let best = null;
        getImportStagingOptionsFlat().forEach((row) => {
            if (!isImportMotorMinorationPriceLine(row)) return;
            const p = pickPrice(row);
            if (p == null) return;
            if (best == null) best = p;
        });
        return best;
    }

    function normalizeMotorLabelKey(label) {
        return String(label || '')
            .replace(/\s+/g, ' ')
            .trim()
            .toLowerCase();
    }

    /** Une option de base moteur = un poste (un bateau). Clé registre inclut le modèle / n° de poste. */
    function buildMotorBaseProductRegistryKey(motorLabel, model) {
        const motorNorm = normalizeMotorLabelKey(motorLabel);
        if (!motorNorm) return '';
        const mid = String(model?.id || '').trim();
        if (mid) return `${motorNorm}__${mid}`;
        const pn = model?.posteNumber;
        if (pn != null && pn !== '') return `${motorNorm}__p${pn}`;
        return `${motorNorm}__unknown`;
    }

    /** Libellé moteur pour un seul poste — jamais « P1 : … · P2 : … ». */
    function resolveImportMotorRegistryLabelForModel(opt, model) {
        const lab = getMotorLabelForPosteModel(model);
        if (lab) return lab;
        return '';
    }

    function isImportMotorAdjForPerPosteRegistry(opt) {
        if (!opt) return false;
        // Tarif catalogue (ligne Excel « Moteur hors-bord… ») = majoration, pas option de base du poste.
        if (isImportCatalogMotorTarifLine(opt)) return false;
        return isImportMotorMinoration(opt) && !/\b(en\s+remplacement|lieu\s+et\s+place)\b/i.test(opt?.name || '');
    }

    function registerImportMotorBaseProductEntry(registry, opt, model, models) {
        const label = resolveImportMotorRegistryLabelForModel(opt, model);
        if (!label) return;
        const key = buildMotorBaseProductRegistryKey(label, model);
        if (!key) return;
        if (!registry.has(key)) {
            registry.set(key, {
                key,
                label,
                optionIds: [],
                modelIds: new Set(),
                pricesByModelId: {}
            });
        }
        const entry = registry.get(key);
        const oid = String(opt?.id || '').trim();
        if (oid && !entry.optionIds.includes(oid)) entry.optionIds.push(oid);
        const midStr = String(model?.id || '').trim();
        if (!midStr) return;
        entry.modelIds.add(midStr);
        const p = inferImportMotorBaseProductPriceFromMinoration(
            model,
            isImportCatalogMotorTarifLine(opt) ? null : opt
        );
        if (p != null && entry.pricesByModelId[midStr] == null) {
            entry.pricesByModelId[midStr] = p;
        }
    }

    function formatMotorSourceHint(source) {
        const map = {
            ref_fournisseur: 'Réf F/seur (poste coché)',
            catalogue_prix: 'Option catalogue du poste',
            motorisation_modele: 'Motorisation du bateau (poste coché)',
            motorisation_multi: 'Plusieurs postes cochés'
        };
        return map[String(source || '')] || String(source || '');
    }

    function minorationLabelHasExplicitPostes(opt) {
        if (window.UgapPosteFromLabel?.getSortedExplicitPosteNumbersFromLabel) {
            return window.UgapPosteFromLabel.getSortedExplicitPosteNumbersFromLabel(opt?.name).length > 0;
        }
        if (typeof getExplicitPosteSetFromLabel === 'function') {
            const set = getExplicitPosteSetFromLabel(opt?.name);
            return !!(set && set.size);
        }
        return false;
    }

    /** Ancien import : tous les postes cochés sans croix ni libellé explicite → ignorer. */
    function isSpuriousAllModelMinorationAssignment(storedIds, models, opt) {
        const list = Array.isArray(models) ? models : getImportStagingModelsForAssignment();
        const allIds = list.map((m) => String(m?.id || '').trim()).filter(Boolean);
        if (!storedIds.length || allIds.length <= 1) return false;
        if (storedIds.length < allIds.length) return false;
        if (minorationLabelHasExplicitPostes(opt)) return false;
        return true;
    }

    /** Postes issus de l’assignation staging (croix Excel à l’import), hors faux « tous les postes ». */
    function getImportMinorationStoredCrossModels(opt, models) {
        const list = Array.isArray(models) ? models : getImportStagingModelsForAssignment();
        const stored = (Array.isArray(opt?.compatibleModels) ? opt.compatibleModels : [])
            .map((id) => String(id || '').trim())
            .filter(Boolean);
        if (!stored.length) return [];
        if (isSpuriousAllModelMinorationAssignment(stored, list, opt)) return [];
        const cm = new Set(stored);
        return list.filter((m) => cm.has(String(m?.id || '').trim()));
    }

    /** Postes explicites dans le libellé MINO (listes, plages, poste N). */
    function getImportMinorationModelsFromLabel(opt, models) {
        const list = Array.isArray(models) ? models : getImportStagingModelsForAssignment();
        if (window.UgapPosteFromLabel?.modelIdsFromExplicitLabelPostes) {
            const mids = window.UgapPosteFromLabel.modelIdsFromExplicitLabelPostes(opt?.name, list);
            const set = new Set(mids.map(String));
            return list.filter((m) => set.has(String(m?.id || '').trim()));
        }
        const ids = new Set();
        const pushModel = (m) => {
            const s = String(m?.id || m || '').trim();
            if (s) ids.add(s);
        };
        if (typeof getExplicitPosteSetFromLabel === 'function') {
            const posteSet = getExplicitPosteSetFromLabel(opt?.name);
            if (posteSet && posteSet.size > 0) {
                list.forEach((m) => {
                    const pn = Number(m?.posteNumber);
                    if (Number.isFinite(pn) && posteSet.has(pn)) pushModel(m);
                });
            }
        }
        if (!ids.size) {
            const single = String(opt?.name || '').match(/\bposte\s+(\d+)\b/i);
            if (single) {
                const pn = parseInt(single[1], 10);
                list.filter((m) => Number(m?.posteNumber) === pn).forEach(pushModel);
            }
        }
        return list.filter((m) => ids.has(String(m?.id || '').trim()));
    }

    /** Postes ciblés moteur : croix Excel ou postes dans le libellé uniquement. */
    function getImportMinorationTargetModelsForMotor(opt, models) {
        const list = Array.isArray(models) ? models : getImportStagingModelsForAssignment();
        const crossed = getImportMinorationStoredCrossModels(opt, list);
        if (crossed.length) return crossed;
        return getImportMinorationModelsFromLabel(opt, list);
    }

    /** IDs modèles (postes) à cocher pour une minoration — croix Excel ou libellé explicite seulement. */
    function resolveImportMinorationPosteModelIds(opt, models) {
        const modelList = Array.isArray(models) ? models : getImportStagingModelsForAssignment();
        const fromLabel = getImportMinorationModelsFromLabel(opt, modelList)
            .map((m) => String(m?.id || '').trim())
            .filter(Boolean);
        const stored = (Array.isArray(opt?.compatibleModels) ? opt.compatibleModels : [])
            .map((id) => String(id || '').trim())
            .filter(Boolean);

        if (isSpuriousAllModelMinorationAssignment(stored, modelList, opt)) {
            return fromLabel;
        }
        if (stored.length && fromLabel.length && stored.length > fromLabel.length && minorationLabelHasExplicitPostes(opt)) {
            return fromLabel;
        }
        if (stored.length) return stored;
        return fromLabel;
    }

    function isGenericMotorPlaceholder(text) {
        const s = String(text || '').trim().toLowerCase();
        if (!s) return true;
        if (/^moteur\s+choisi$/.test(s)) return true;
        if (/^moteurs?\s+de\s+base$/.test(s)) return true;
        if (/^\d+\s+moteurs?\s+de\s+base$/.test(s)) return true;
        if (/^moteur\s+de\s+base$/.test(s)) return true;
        return false;
    }

    /** Placeholders génériques : une ligne par occurrence (pas de fusion auto). */
    function isImportBaseProductLabelCustomized(bp) {
        return !!(bp && bp.labelCustomized === true);
    }

    function markImportBaseProductLabelCustomized(bp, label) {
        if (!bp) return;
        const lab = String(label ?? bp.label ?? '').trim() || 'de base';
        bp.label = lab;
        bp.baseOptionName = lab;
        bp.labelCustomized = true;
    }

    /** Lit les noms saisis (modale / store) avant enregistrement. */
    function flushImportBaseProductsLabelsFromDom() {
        document.querySelectorAll('.ugap-bp-name-input[data-bp-field="label"]').forEach((el) => {
            const bpId = String(el.getAttribute('data-bp-id') || '').trim();
            if (!bpId) return;
            const bp = getImportBaseProductsStore().find((x) => String(x.id) === bpId);
            if (!bp) return;
            markImportBaseProductLabelCustomized(bp, el.value);
            bp.key = buildBaseProductRegistryKey(bp.label, bp);
        });
    }

    async function openImportBaseProductNameModal(bpId) {
        const id = String(bpId || '').trim();
        const bp = getImportBaseProductsStore().find((x) => String(x.id) === id);
        if (!bp) return;
        const Modal = global.UgapImportBaseOptionModal;
        if (!Modal?.open) {
            if (typeof showAlert === 'function') {
                showAlert('Modale de renommage indisponible (rechargez la page).', 'warning');
            }
            return;
        }
        const newName = await Modal.open({
            title: 'Modifier le nom de l\'option de base',
            name: bp.label || bp.baseOptionName,
            excelLabel: bp.excelLabel
        });
        if (newName == null) return;
        updateImportBaseProductLocal(id, {
            label: newName,
            key: buildBaseProductRegistryKey(newName, bp)
        });
        if (typeof renderImportWorkflow === 'function') renderImportWorkflow();
    }

    function isImportGenericBasePlaceholderLabel(label) {
        const n = normalizeBaseProductKey(label);
        if (!n) return true;
        return new Set([
            'celui de base',
            'celle de base',
            'ceux de base',
            'produit de base'
        ]).has(n);
    }

    /** @deprecated — utiliser isImportGenericBasePlaceholderLabel */
    function isImportNonMergeableBaseProductLabel(label) {
        return isImportGenericBasePlaceholderLabel(label);
    }

    /** Mino/majo liées aux options de base — hors suppressions (gérées à part, étape Options de base). */
    function isImportAdjForBaseProductLink(opt, models) {
        const modelList = Array.isArray(models) ? models : getImportStagingModelsForAssignment();
        if (!opt || opt?.importExcludeFromBaseProduct) return false;
        if (isImportSuppressionMinoration(opt, modelList)) return false;
        return isImportMinorationOption(opt) || isImportMajorationOption(opt);
    }

    function filterImportBaseProductAdjOptionIds(optionIds, models) {
        const modelList = Array.isArray(models) ? models : getImportStagingModelsForAssignment();
        return (Array.isArray(optionIds) ? optionIds : [])
            .map((x) => String(x || '').trim())
            .filter((oid) => {
                const opt = findImportStagingOptionById(oid);
                return oid && opt && isImportAdjForBaseProductLink(opt, modelList);
            });
    }

    function getImportRowsForBaseProductRegistry() {
        const models = getImportStagingModelsForAssignment();
        return getImportStagingOptionsFlat().filter((opt) => isImportAdjForBaseProductLink(opt, models));
    }

    function isImportAdjExcludedFromBaseProduct(opt) {
        return !!opt?.importExcludeFromBaseProduct;
    }

    function isImportAdjLinkedToBaseProduct(opt) {
        const oid = String(opt?.id || '').trim();
        if (!oid) return false;
        const models = getImportStagingModelsForAssignment();
        if (!isImportAdjForBaseProductLink(opt, models)) return false;
        return !!findImportBaseProductForOption(opt);
    }

    /** Retire mino/majo des options de base ; supprime l’entrée de base si plus aucune ligne liée. */
    function detachImportAdjOptionsFromBaseProducts(optionIds) {
        const ids = [...new Set((optionIds || []).map((x) => String(x || '').trim()).filter(Boolean))];
        if (!ids.length) return { detached: 0, removedBaseProducts: 0 };

        ids.forEach((oid) => {
            const opt = findImportStagingOptionById(oid);
            if (opt) {
                opt.importExcludeFromBaseProduct = true;
                delete opt.baseProductId;
                delete opt.baseProductLabel;
            }
        });

        const models = getImportStagingModelsForAssignment();
        const store = getImportBaseProductsStore();
        let removedBaseProducts = 0;
        store.forEach((bp) => {
            const beforeAdj = filterImportBaseProductAdjOptionIds(bp.optionIds, models).length;
            bp.optionIds = (bp.optionIds || []).map(String).filter((id) => !ids.includes(id));
            const afterAdj = filterImportBaseProductAdjOptionIds(bp.optionIds, models).length;
            if (beforeAdj > 0 && afterAdj === 0) removedBaseProducts += 1;
        });

        const nextStore = store.filter((bp) => {
            const adjCount = filterImportBaseProductAdjOptionIds(bp.optionIds, models).length;
            if (adjCount > 0) return true;
            const modelIds = Array.isArray(bp?.modelIds)
                ? bp.modelIds.map((x) => String(x || '').trim()).filter(Boolean)
                : [];
            return modelIds.length > 0;
        });
        if (staging()) staging().importBaseProducts = nextStore;

        return { detached: ids.length, removedBaseProducts };
    }

    function runDetachImportAdjFromBaseProducts(encodedOptIds) {
        const ids = decodeImportAdjGroupOptIds(encodedOptIds);
        if (!ids.length) {
            showAlert('Aucune ligne à détacher.', 'warning');
            return;
        }
        const linked = ids.filter((oid) => {
            const opt = findImportStagingOptionById(oid);
            return opt && isImportAdjLinkedToBaseProduct(opt);
        });
        if (!linked.length) {
            showAlert('Cette ligne n’est pas liée à une option de base.', 'info');
            return;
        }
        const { detached, removedBaseProducts } = detachImportAdjOptionsFromBaseProducts(linked);
        const msg = removedBaseProducts
            ? `${detached} ligne(s) détachée(s). ${removedBaseProducts} option(s) de base supprimée(s) (plus de mino/majo liées).`
            : `${detached} ligne(s) détachée(s) des options de base.`;
        showAlert(msg, 'success');
        renderImportWorkflow();
    }

    function renderImportDetachFromBaseProductButton(options) {
        const opts = Array.isArray(options) ? options : [options].filter(Boolean);
        const ids = opts.map((o) => String(o?.id || '').trim()).filter(Boolean);
        if (!ids.some((oid) => isImportAdjLinkedToBaseProduct(findImportStagingOptionById(oid)))) return '';
        const enc = escapeHtml(encodeImportAdjGroupOptIds(ids));
        return `<div class="ugap-import-mino-hint ugap-import-adj-detach-row" style="margin-top:6px;">
            <button type="button" class="btn btn-outline" style="padding:4px 10px;font-size:11px;"
                onclick="runDetachImportAdjFromBaseProducts('${enc}')">Déplacer vers option</button>
            <span style="margin-left:6px;color:#64748b;">Retire la ligne des options de base</span>
        </div>`;
    }

    /** Motorisation extraite de la ligne modèle bateau (libellé Excel du poste). */
    function parseMotorFromBoatModelLabel(model) {
        const raw = String(model?.baseLabel || model?.name || '').replace(/\s+/g, ' ').trim();
        if (!raw) return '';

        const posteMatch = raw.match(/\bposte\s*(\d+)\b/i);
        const beforePoste = posteMatch && posteMatch.index >= 0
            ? raw.slice(0, posteMatch.index).trim().replace(/[-–—]\s*$/, '').trim()
            : raw;

        const dash = beforePoste.indexOf(' - ');
        if (dash > -1) return beforePoste.slice(dash + 3).trim();

        const motorMarker = beforePoste.match(/\b(suzuki|mercury|yamaha|honda|evinrude|double)\b/i);
        if (motorMarker && motorMarker.index > 0) {
            return beforePoste.slice(motorMarker.index).trim();
        }
        return '';
    }

    function findCatalogMotorOptionForModel(model) {
        const byPrice = findCatalogMotorOptionByPostePrice(model);
        if (byPrice) return byPrice;

        const mid = String(model?.id || '').trim();
        if (!mid) return null;

        const candidates = [];
        getImportStagingOptionsFlat().forEach((opt) => {
            if (isImportMinorationOption(opt) || !isCatalogMotorLikeOption(opt)) return;
            const cm = Array.isArray(opt.compatibleModels) ? opt.compatibleModels.map(String) : [];
            if (cm.length > 0 && !cm.includes(mid)) return;
            candidates.push(opt);
        });

        if (!candidates.length) return null;
        const dedicated = candidates.filter((opt) => {
            const cm = Array.isArray(opt.compatibleModels) ? opt.compatibleModels : [];
            return cm.length === 1 && String(cm[0]) === mid;
        });
        return dedicated[0] || candidates[0];
    }

    /** Nom du moteur = motorisation du poste (champ modèle / ligne bateau), jamais le libellé tarif catalogue complet. */
    function getMotorLabelForPosteModel(model) {
        return String(model?.motorizationBase || '').trim();
    }

    function isCatalogMotorLikeOption(opt) {
        if (isImportMinorationOption(opt)) return false;
        return isImportMotorCatalogLine(opt);
    }

    function findCatalogMotorOptionByRef(refFournisseur, modelId) {
        const ref = String(refFournisseur || '').trim().toLowerCase();
        if (!ref) return null;
        for (const opt of getImportStagingOptionsFlat()) {
            if (isImportMinorationOption(opt)) continue;
            const r1 = String(opt?.refFournisseur || '').trim().toLowerCase();
            const r2 = String(opt?.refUgap || '').trim().toLowerCase();
            if (r1 !== ref && r2 !== ref) continue;
            const cm = Array.isArray(opt?.compatibleModels) ? opt.compatibleModels : [];
            if (modelId && cm.length > 0 && !cm.map(String).includes(String(modelId))) continue;
            return opt;
        }
        return null;
    }

    /** Option catalogue moteur dont le prix client ≈ prix de base du poste — seulement si motorisation cohérente. */
    function findCatalogMotorOptionByPostePrice(model) {
        const mid = String(model?.id || '').trim();
        const bp = parseMoney(model?.basePrice);
        if (!mid || !Number.isFinite(bp) || bp <= 0) return null;

        const motorHint = normalizeMotorLabelKey(getMotorLabelForPosteModel(model));
        let best = null;
        let bestDelta = Infinity;

        getImportStagingOptionsFlat().forEach((opt) => {
            if (!isCatalogMotorLikeOption(opt)) return;
            const cm = Array.isArray(opt?.compatibleModels) ? opt.compatibleModels : [];
            if (cm.length > 0 && !cm.map(String).includes(mid)) return;
            const p = parseMoney(opt?.priceClient);
            if (!Number.isFinite(p) || p <= 0) return;
            const delta = Math.abs(p - bp);
            if (delta > 0.05) return;
            if (motorHint) {
                const optMotor = normalizeMotorLabelKey(extractShortMotorLabelFromText(opt?.name) || opt?.name);
                if (optMotor && !optMotor.includes(motorHint) && !motorHint.includes(optMotor)) return;
            }
            if (delta < bestDelta) {
                bestDelta = delta;
                best = opt;
            }
        });

        return best;
    }

    function findImportMotorBaseProduct(opt, models) {
        const targetModels = getImportMinorationTargetModelsForMotor(opt, models);
        const refFs = String(opt?.refFournisseur || '').trim();

        if (refFs && targetModels.length) {
            for (const model of targetModels) {
                const catOpt = findCatalogMotorOptionByRef(refFs, model?.id);
                const label = getMotorLabelForPosteModel(model);
                if (label) {
                    return {
                        label,
                        source: catOpt ? 'ref_fournisseur' : 'motorisation_modele',
                        model,
                        catalogOptionId: catOpt ? String(catOpt.id || '').trim() : ''
                    };
                }
            }
        }

        if (!targetModels.length) {
            return null;
        }

        const entries = targetModels
            .map((model) => ({
                model,
                label: getMotorLabelForPosteModel(model),
                pn: model?.posteNumber
            }))
            .filter((e) => e.label);

        if (!entries.length) {
            return null;
        }

        const labelKeys = entries.map((e) => normalizeMotorLabelKey(e.label));
        const uniqueKeys = [...new Set(labelKeys)];
        const sorted = entries.slice().sort((a, b) => {
            const na = Number(a.pn);
            const nb = Number(b.pn);
            if (Number.isFinite(na) && Number.isFinite(nb) && na !== nb) return na - nb;
            return 0;
        });
        const first = sorted[0];
        const multiHint = sorted.length > 1
            ? sorted.map((e) => {
                const tag = e.pn != null && e.pn !== '' ? `P${e.pn}` : '?';
                return `${tag} : ${e.label}`;
            }).join(' · ')
            : '';
        return {
            label: first.label,
            source: uniqueKeys.length === 1 ? 'motorisation_modele' : 'motorisation_multi',
            model: first.model,
            multiPosteHint: multiHint
        };
    }

    function resolveImportMotorMinorationLinks(opt, models) {
        if (!isImportMotorMinoration(opt)) return null;
        const parsed = getImportParsedBaseReplacementLinks(opt);
        const base = findImportMotorBaseProduct(opt, models);
        const name = String(opt?.name || '').trim();

        let initialProduct = getImportBaseProductLabelForOption(
            opt,
            base?.label || parsed.initialProduct || ''
        );
        if (!initialProduct && parsed.changeType === 'motor_base_non_supply') {
            initialProduct = 'moteur de base';
        }
        if (isGenericMotorPlaceholder(initialProduct) && base?.label) {
            initialProduct = base.label;
        }

        const custom = String(opt?.importOptionLabel || '').trim();
        let finalProduct = custom;
        if (!finalProduct) {
            finalProduct = String(parsed.finalProduct || '').trim();
        }
        if (!finalProduct || isGenericMotorPlaceholder(finalProduct)) {
            finalProduct = name;
        }

        let sourceHint = formatMotorSourceHint(base?.source || '');
        if (base?.multiPosteHint) {
            sourceHint = sourceHint
                ? `${sourceHint} — ${base.multiPosteHint}`
                : base.multiPosteHint;
        }
        return {
            initialProduct,
            finalProduct,
            changeType: 'motor',
            sourceHint
        };
    }

    function resolveImportMinorationOptionLinks(opt, models) {
        const motor = resolveImportMotorMinorationLinks(opt, models);
        if (motor) {
            return {
                initialProduct: getImportBaseProductLabelForOption(opt, motor.initialProduct),
                finalProduct: motor.finalProduct,
                changeType: motor.changeType,
                sourceHint: motor.sourceHint
            };
        }

        let parsed = getImportParsedBaseReplacementLinks(opt);

        if (!parsed.initialProduct && !parsed.finalProduct) {
            const sup = tryParseSuppressionMinorationLabel(opt?.name);
            if (sup) parsed = sup;
        }

        if (parsed.changeType === 'suppression' && !parsed.finalProduct) {
            parsed.finalProduct = 'Suppression';
        }

        let initialProduct = String(parsed.initialProduct || '').trim();
        let finalProduct = String(parsed.finalProduct || '').trim();
        if (isGenericMotorPlaceholder(initialProduct)) initialProduct = '';
        if (isImportMotorNonFournitureLabel(opt?.name)) {
            const motorRetry = resolveImportMotorMinorationLinks(opt, models);
            if (motorRetry) return motorRetry;
            finalProduct = String(opt?.name || '').trim();
        }

        return {
            initialProduct: getImportBaseProductLabelForOption(opt, initialProduct),
            finalProduct,
            changeType: parsed.changeType || '',
            sourceHint: ''
        };
    }

    /**
     * « celle / celui / ceux de base » → type d’équipement déduit du libellé avant remplacement
     * (ex. Sonde Chirp… → sondeur de base, Console alu… → console de base).
     */
    function inferImportReplacedBaseProductLabel(beforeNoPrefix, replacedBase) {
        let initialProduct = String(replacedBase || '').trim();
        const before = String(beforeNoPrefix || '').trim();
        if (!/^cel(le|ui|les)?\s+de\s+base$/i.test(initialProduct) && !/^ceux\s+de\s+base$/i.test(initialProduct)) {
            return initialProduct;
        }
        const head = before.match(/\b(flotteur|moteur|combin[ée]|sondeur|sonde|module|coque|console)\b/i);
        if (!head) return 'produit de base';
        let term = head[1].toLowerCase();
        if (term === 'sonde') term = 'sondeur';
        return `${term} de base`;
    }

    function normalizeBaseProductKey(text) {
        return String(text || '')
            .replace(/\s+/g, ' ')
            .trim()
            .toLowerCase()
            .replace(/[^\wàâäéèêëïîôùûüç\s-]/gi, '')
            .trim();
    }

    /** 1re passe — clé registre : même nom + même produit final → fusion ; placeholder générique → une ligne par id. */
    function buildBaseProductRegistryKey(label, opt, models) {
        const normalized = normalizeBaseProductKey(label);
        if (!normalized) return '';
        if (isImportGenericBasePlaceholderLabel(label)) {
            const oid = String(opt?.id || '').trim() || `row_${Date.now().toString(36)}`;
            return `${normalized}__${oid}`;
        }
        if (isImportCatalogMotorTarifLine(opt)) {
            const modelList = Array.isArray(models) ? models : getImportStagingModelsForAssignment();
            const targets = getImportMinorationTargetModelsForMotor(opt, modelList);
            if (targets.length === 1) {
                const lab = resolveImportMotorRegistryLabelForModel(opt, targets[0]);
                const k = buildMotorBaseProductRegistryKey(lab, targets[0]);
                if (k) return k;
            }
            return `${normalized}__${String(opt?.id || '').trim()}`;
        }
        if (isImportMotorBaseProductLabel(label)) {
            const modelList = Array.isArray(models) ? models : getImportStagingModelsForAssignment();
            const targets = getImportMinorationTargetModelsForMotor(opt, modelList);
            if (targets.length === 1) {
                const lab = resolveImportMotorRegistryLabelForModel(opt, targets[0]);
                const k = buildMotorBaseProductRegistryKey(lab, targets[0]);
                if (k) return k;
            }
            const cm = (Array.isArray(opt?.compatibleModels) ? opt.compatibleModels : [])
                .map((x) => String(x || '').trim())
                .filter(Boolean);
            if (cm.length === 1) {
                const m = modelList.find((x) => String(x?.id || '').trim() === cm[0]);
                if (m) {
                    const k = buildMotorBaseProductRegistryKey(label, m);
                    if (k) return k;
                }
            }
            return `${normalized}__${String(opt?.id || '').trim()}`;
        }
        const parsed = getImportParsedBaseReplacementLinks(opt);
        const finalNorm = normalizeBaseProductKey(parsed?.finalProduct || '');
        if (finalNorm) return `${normalized}__${finalNorm}`;
        return normalized;
    }

    /** Prix catalogue / base de l'équipement pour un libellé et un poste (modèle). */
    function inferImportBaseProductPriceForModel(label, model) {
        const mid = String(model?.id || '').trim();
        const norm = normalizeBaseProductKey(label);
        if (!mid || !norm) return null;
        if (isImportMotorBaseProductLabel(label)) {
            return inferImportMotorBaseProductPriceFromMinoration(model);
        }

        let dedicated = null;
        let fallback = null;

        getImportStagingOptionsFlat().forEach((opt) => {
            if (isImportMinorationOption(opt) || isImportMajorationOption(opt) || isImportPrOption(opt)) return;
            if (isImportCatalogMotorTarifLine(opt)) return;
            const optNorm = normalizeBaseProductKey(opt?.name);
            const cm = (Array.isArray(opt?.compatibleModels) ? opt.compatibleModels : []).map(String).filter(Boolean);
            const onPoste = !cm.length || cm.includes(mid);
            if (!onPoste) return;

            const basePrice = parseMoney(opt?.baseIncludedPrice);
            const clientPrice = parseMoney(opt?.priceClient);
            const ugapPrice = parseMoney(opt?.priceUgap);
            const price = basePrice != null ? basePrice : (clientPrice != null ? clientPrice : ugapPrice);
            if (price == null) return;

            const nameMatch = optNorm === norm;
            const baseFlag = !!opt?.baseIncluded && (nameMatch || optNorm.includes(norm) || norm.includes(optNorm));
            if (!nameMatch && !baseFlag) return;

            if (cm.length === 1 && cm[0] === mid) {
                dedicated = price;
            } else if (fallback == null) {
                fallback = price;
            }
        });

        if (dedicated != null) return dedicated;
        if (fallback != null) return fallback;

        if (isImportMotorBaseProductLabel(label)) {
            return inferImportMotorBaseProductPriceFromMinoration(model);
        }
        return null;
    }

    function collectImportBaseProductPricesByModel(label, modelIds, models) {
        const modelById = buildImportModelByIdMap(models);
        const pricesByModelId = {};
        (modelIds || []).forEach((mid) => {
            const id = String(mid || '').trim();
            if (!id) return;
            const m = modelById.get(id);
            const p = isImportMotorBaseProductLabel(label)
                ? inferImportMotorBaseProductPriceFromMinoration(m)
                : inferImportBaseProductPriceForModel(label, m);
            if (p != null) pricesByModelId[id] = p;
        });
        return pricesByModelId;
    }

    function inferImportBaseProductPriceForBpModel(bp, model) {
        if (isImportMotorBaseProduct(bp)) {
            return inferImportMotorBaseProductPriceFromMinoration(model);
        }
        return inferImportBaseProductPriceForModel(bp?.label, model);
    }

    /** 1 poste coché → Fixe ; 2+ postes → Par poste si prix distincts. Purge les prix orphelins (fusion précédente). */
    function normalizeImportBaseProductPricingForAssignment(bp) {
        if (!bp) return;
        const mids = [...new Set((bp.modelIds || []).map((x) => String(x || '').trim()).filter(Boolean))];
        const prices = { ...(bp.pricesByModelId || {}) };
        Object.keys(prices).forEach((k) => {
            if (!mids.includes(String(k))) delete prices[k];
        });

        if (mids.length <= 1) {
            bp.pricingMode = 'fixed';
            const mid = mids[0] || '';
            let p = mid ? parseMoney(prices[mid]) : null;
            if (p == null) p = parseMoney(bp.price);
            if (p == null && mid) {
                const m = buildImportModelByIdMap().get(mid);
                p = inferImportBaseProductPriceForBpModel(bp, m);
            }
            bp.price = p;
            bp.pricesByModelId = mid && p != null ? { [mid]: p } : (mid ? {} : {});
            return;
        }

        mids.forEach((mid) => {
            if (prices[mid] != null && prices[mid] !== '') return;
            const m = buildImportModelByIdMap().get(mid);
            const p = inferImportBaseProductPriceForBpModel(bp, m);
            if (p != null) prices[mid] = p;
        });

        const vals = mids.map((mid) => parseMoney(prices[mid])).filter((v) => v != null);
        const distinct = [...new Set(vals.map((v) => Number(v.toFixed(2))))];
        bp.pricesByModelId = prices;
        if (distinct.length > 1) {
            bp.pricingMode = 'per_model';
            bp.price = null;
        } else if (distinct.length === 1) {
            bp.pricingMode = 'fixed';
            bp.price = distinct[0];
            mids.forEach((mid) => {
                if (prices[mid] == null) prices[mid] = distinct[0];
            });
            bp.pricesByModelId = prices;
        }
    }

    function applyImportBaseProductPricingFromHints(bp, priceHints) {
        if (!bp || !priceHints || typeof priceHints !== 'object') return;
        const isMotorBp = isImportMotorBaseProduct(bp) || isImportMotorBaseProductLabel(bp?.label);
        const merged = isMotorBp ? {} : { ...(bp.pricesByModelId || {}) };
        Object.keys(priceHints).forEach((mid) => {
            const p = parseMoney(priceHints[mid]);
            if (p == null) return;
            if (isMotorBp || merged[mid] == null || merged[mid] === '') merged[mid] = p;
        });
        if (isMotorBp) bp.price = null;
        bp.pricesByModelId = merged;
        normalizeImportBaseProductPricingForAssignment(bp);
    }

    /** 2e passe — fusionne les lignes au même nom (hors placeholders génériques), type « Par poste » si plusieurs postes. */
    function collapseImportBaseProductsSameLabelPerPoste(products, models) {
        const modelById = buildImportModelByIdMap(models);
        const groups = new Map();
        (Array.isArray(products) ? products : []).forEach((bp) => {
            const ln = normalizeBaseProductKey(bp?.label);
            if (!ln || isImportGenericBasePlaceholderLabel(bp?.label)) {
                groups.set(`__solo_${bp?.id || Math.random()}`, [bp]);
                return;
            }
            if (isImportMotorBaseProduct(bp) || isImportMotorBaseProductLabel(bp?.label)) {
                groups.set(`__motor_${String(bp?.id || bp?.key || Math.random())}`, [bp]);
                return;
            }
            const modelKey = sortModelIdsByPosteNumber(
                [...new Set((bp.modelIds || []).map((x) => String(x || '').trim()).filter(Boolean))],
                modelById
            ).join('|');
            const groupKey = modelKey ? `${ln}::__${modelKey}` : `${ln}::__${String(bp?.id || bp?.key || Math.random())}`;
            if (!groups.has(groupKey)) groups.set(groupKey, []);
            groups.get(groupKey).push(bp);
        });

        const out = [];
        groups.forEach((list) => {
            if (list.length <= 1) {
                out.push(list[0]);
                return;
            }
            const merged = {
                ...list[0],
                optionIds: [],
                modelIds: [],
                aliases: [],
                pricesByModelId: {},
                price: null
            };
            const aliasSet = new Set();
            list.forEach((bp) => {
                (bp.optionIds || []).forEach((oid) => merged.optionIds.push(String(oid)));
                (bp.modelIds || []).forEach((mid) => merged.modelIds.push(String(mid)));
                (Array.isArray(bp.aliases) ? bp.aliases : []).forEach((a) => aliasSet.add(String(a)));
                const lab = String(bp.label || '').trim();
                if (lab) aliasSet.add(lab);
                if (bp.pricingMode === 'per_model' && bp.pricesByModelId) {
                    Object.assign(merged.pricesByModelId, bp.pricesByModelId);
                } else if (bp.price != null && bp.price !== '') {
                    (bp.modelIds || []).forEach((mid) => {
                        const k = String(mid || '').trim();
                        if (k && merged.pricesByModelId[k] == null) merged.pricesByModelId[k] = Number(bp.price);
                    });
                }
            });
            merged.optionIds = [...new Set(merged.optionIds.filter(Boolean))];
            merged.modelIds = sortModelIdsByPosteNumber([...new Set(merged.modelIds.filter(Boolean))], modelById);
            merged.aliases = [...aliasSet].filter((a) => a.toLowerCase() !== String(merged.label || '').trim().toLowerCase());
            merged.key = buildBaseProductRegistryKey(merged.label, { id: merged.id });
            applyImportBaseProductPricingFromHints(merged, merged.pricesByModelId);
            out.push(merged);
        });
        return out;
    }

    function getImportMinorationDisplayLabel(opt, links) {
        const custom = String(opt?.importOptionLabel || '').trim();
        if (custom) return custom;
        return String(links?.finalProduct || '').trim();
    }

    /**
     * Tarif moteur catalogue (ligne Excel complète) — ne pas fusionner sur le moteur de base du poste.
     * Ex. « Moteur hors-bord essence - Mercury 225… » ≠ « Suzuki DF225… » même si le poste a la même motorisation de base.
     */
    function isImportCatalogMotorTarifLine(opt) {
        const name = String(opt?.name || '').replace(/\s+/g, ' ').trim();
        if (!name || /\ben\s+remplacement\b/i.test(name) || /\blieu\s+et\s+place\b/i.test(name)) return false;
        if (isImportExcludedFromMajorationLabel(name)) return false;
        if (String(opt?.refUgap || '').trim().toUpperCase().includes('MINO')) return false;
        return isImportMotorCatalogLine(opt);
    }

    function stripImportExcelPostesSuffix(label) {
        return String(label || '').replace(/\s*-\s*postes?\s+[\d\s,etàa\-–—]+$/i, '').trim();
    }

    /**
     * Étape 2 — nom de l'option de base : texte après « en remplacement de » / « en lieu et place de » (initialProduct).
     * Hors ces formulations : champ Option, puis règles de fusion mino/majo.
     */
    function stripImportLeadingRefFromLabel(text) {
        return String(text || '').replace(/^\d{5,}\s*/, '').replace(/\s+/g, ' ').trim();
    }

    /**
     * Option de base moteur : nom = motorisation du 1er poste avec croix Excel (pas le libellé tarif Mercury/Suzuki).
     */
    function getImportMotorBaseProductLabelForRegistry(opt, models) {
        const modelList = Array.isArray(models) ? models : getImportStagingModelsForAssignment();
        const targets = getImportMinorationTargetModelsForMotor(opt, modelList)
            .slice()
            .sort((a, b) => {
                const na = Number(a?.posteNumber);
                const nb = Number(b?.posteNumber);
                if (Number.isFinite(na) && Number.isFinite(nb) && na !== nb) return na - nb;
                return 0;
            });
        const first = targets[0];
        if (first) {
            const lab = resolveImportMotorRegistryLabelForModel(opt, first);
            if (lab) return lab;
        }
        return '';
    }

    function getImportBaseProductRegistryLabel(opt, models) {
        const modelList = Array.isArray(models) ? models : getImportStagingModelsForAssignment();

        if (isImportMotorAdjForPerPosteRegistry(opt)) {
            const motorLab = getImportMotorBaseProductLabelForRegistry(opt, modelList);
            if (motorLab) return motorLab;
            return '';
        }

        const name = String(opt?.name || '').replace(/\s+/g, ' ').trim();
        if (name && /\b(en\s+remplacement|lieu\s+et\s+place)\b/i.test(name)) {
            const parsed = getImportParsedBaseReplacementLinks(opt);
            const parsedInitial = String(parsed?.initialProduct || '').trim();
            const beforeNoPrefix = String(parsed?.finalProduct || '')
                .replace(/^(moins-value|plus-value|plus\s+value)\s+/i, '')
                .trim();
            if (parsedInitial) {
                if (isImportGenericBasePlaceholderLabel(parsedInitial)) {
                    const inferred = inferImportReplacedBaseProductLabel(beforeNoPrefix, parsedInitial);
                    if (inferred && !isImportGenericBasePlaceholderLabel(inferred)) return inferred;
                }
                return parsedInitial;
            }
        }

        const links = resolveImportMinorationOptionLinks(opt, models);
        const changeType = String(links?.changeType || '').trim();
        const initial = String(links?.initialProduct || '').trim();
        if (initial && changeType) return initial;

        const custom = String(opt?.importOptionLabel || '').trim();
        if (custom) return custom;

        return getImportAdjOptionFusionLabel(opt, models);
    }

    /** Libellé de fusion = champ « Option » (renommé ou produit final), pas le libellé Excel ni initialProduct. */
    function getImportAdjOptionFusionLabel(opt, models) {
        const custom = String(opt?.importOptionLabel || '').trim();
        if (custom) return custom;

        const name = String(opt?.name || '').replace(/\s+/g, ' ').trim();
        if (isImportCatalogMotorTarifLine(opt)) {
            const motorLab = getImportMotorBaseProductLabelForRegistry(opt, models);
            if (motorLab) return motorLab;
            const short = extractShortMotorLabelFromText(name);
            if (short) return short;
            return '';
        }

        const links = resolveImportMinorationOptionLinks(opt, models);
        if (links?.changeType === 'motor') {
            const motorBase = String(links.initialProduct || '').trim();
            if (motorBase && !isGenericMotorPlaceholder(motorBase)) return motorBase;
        }
        const display = getImportMinorationDisplayLabel(opt, links);
        if (display) return display;

        if (name && !/\ben\s+remplacement\b/i.test(name) && !/\blieu\s+et\s+place\b/i.test(name) && !/^supp?ress/i.test(name)) {
            return stripImportExcelPostesSuffix(name);
        }
        return String(links?.initialProduct || '').trim();
    }

    function findStoreBaseProductForRegistryEntry(entry, store) {
        const key = String(entry?.key || '');
        if (key) {
            const byKeyHit = store.find((bp) => String(bp?.key || '') === key);
            if (byKeyHit) return byKeyHit;
        }
        const entryNorm = normalizeBaseProductKey(entry?.label || '');
        const entryModelIds = new Set(
            [...(entry?.modelIds || [])].map((x) => String(x || '').trim()).filter(Boolean)
        );
        if (entryNorm && entryModelIds.size && !isImportGenericBasePlaceholderLabel(entry?.label)) {
            const byMotor = store.find((bp) => {
                if (isImportGenericBasePlaceholderLabel(bp?.label)) return false;
                if (normalizeBaseProductKey(bp?.label || '') !== entryNorm) return false;
                return (bp?.modelIds || []).some((mid) => entryModelIds.has(String(mid || '').trim()));
            });
            if (byMotor) return byMotor;
        }
        const oids = new Set((entry?.optionIds || []).map(String).filter(Boolean));
        if (!oids.size) return null;
        return store.find((bp) => (bp?.optionIds || []).some((oid) => oids.has(String(oid)))) || null;
    }

    function resolveMotorBaseProductLabelFromModels(bp, models) {
        const modelById = buildImportModelByIdMap(models);
        const mids = [...new Set((bp?.modelIds || []).map((x) => String(x || '').trim()).filter(Boolean))];
        if (mids.length === 1) {
            const lab = getMotorLabelForPosteModel(modelById.get(mids[0]));
            if (lab) return lab;
        }
        return '';
    }

    function refreshImportBaseProductLabelFromLinkedOptions(bp, models) {
        if (isImportBaseProductLabelCustomized(bp)) return;
        if (isImportMotorBaseProduct(bp)) {
            const fromModel = resolveMotorBaseProductLabelFromModels(bp, models);
            if (fromModel) {
                bp.label = fromModel;
                const sampleMid = String((bp.modelIds || [])[0] || '').trim();
                const sampleModel = buildImportModelByIdMap(models).get(sampleMid);
                bp.key = buildMotorBaseProductRegistryKey(fromModel, sampleModel || {});
                return;
            }
        }
        const oids = filterImportBaseProductAdjOptionIds(bp?.optionIds, models)
            .filter((oid) => {
                const opt = findImportStagingOptionById(oid);
                return opt && !isImportCatalogMotorTarifLine(opt);
            });
        if (!oids.length) return;
        const labels = oids.map((oid) => {
            const opt = findImportStagingOptionById(oid);
            return opt ? getImportBaseProductRegistryLabel(opt, models) : '';
        }).filter(Boolean);
        if (!labels.length) return;
        const normSet = new Set(labels.map((l) => normalizeBaseProductKey(l)).filter(Boolean));
        if (normSet.size !== 1) return;
        const canonical = labels[0];
        const sampleOpt = findImportStagingOptionById(oids[0]);
        bp.label = canonical;
        bp.key = buildBaseProductRegistryKey(canonical, sampleOpt || { id: oids[0] }, models);
    }

    function buildImportMinorationBaseProductRegistry(adjRows, models) {
        const registry = new Map();
        (Array.isArray(adjRows) ? adjRows : []).forEach((opt) => {
            if (isImportMotorAdjForPerPosteRegistry(opt)) {
                const mids = resolveImportMinorationPosteModelIds(opt, models);
                mids.forEach((mid) => {
                    const midStr = String(mid || '').trim();
                    if (!midStr) return;
                    const m = models.find((x) => String(x?.id || '').trim() === midStr);
                    if (m) registerImportMotorBaseProductEntry(registry, opt, m, models);
                });
                return;
            }

            const fusionLabel = getImportBaseProductRegistryLabel(opt, models);
            const key = buildBaseProductRegistryKey(fusionLabel, opt, models);
            if (!key) return;
            if (!registry.has(key)) {
                registry.set(key, {
                    key,
                    label: fusionLabel,
                    optionIds: [],
                    modelIds: new Set(),
                    pricesByModelId: {}
                });
            }
            const entry = registry.get(key);
            const oid = String(opt?.id || '').trim();
            if (oid) entry.optionIds.push(oid);
            const mids = resolveImportMinorationPosteModelIds(opt, models);
            mids.forEach((mid) => {
                const midStr = String(mid || '').trim();
                if (!midStr) return;
                entry.modelIds.add(midStr);
                const m = models.find((x) => String(x?.id || '').trim() === midStr);
                const p = inferImportBaseProductPriceForModel(fusionLabel, m);
                if (p != null && entry.pricesByModelId[midStr] == null) {
                    entry.pricesByModelId[midStr] = p;
                }
            });
        });
        return registry;
    }

    function findImportMotorMinorationForModel(model, modelList) {
        const mid = String(model?.id || '').trim();
        if (!mid) return null;
        const list = Array.isArray(modelList) ? modelList : getImportStagingModelsForAssignment();
        const candidates = getImportStagingOptionsFlat().filter((opt) => {
            if (!isImportMotorMinoration(opt) || isImportCatalogMotorTarifLine(opt)) return false;
            const cm = (Array.isArray(opt?.compatibleModels) ? opt.compatibleModels : [])
                .map((x) => String(x || '').trim())
                .filter(Boolean);
            if (cm.includes(mid)) return true;
            return getImportMinorationTargetModelsForMotor(opt, list)
                .some((m) => String(m?.id || '').trim() === mid);
        });
        const nonSupply = candidates.filter((opt) => /\bnon\s+fourniture\b/i.test(String(opt?.name || '')));
        return nonSupply[0] || candidates[0] || null;
    }

    /** Motorisation de base par poste + lien vers la minoration moteur correspondante. */
    function appendModelMotorizationEntriesToRegistry(registry, models) {
        const map = registry instanceof Map ? registry : new Map();
        const list = Array.isArray(models) ? models : getImportStagingModelsForAssignment();
        list.forEach((model) => {
            const mino = findImportMotorMinorationForModel(model, list);
            if (mino) {
                registerImportMotorBaseProductEntry(registry, mino, model, list);
                return;
            }
            let motor = String(model?.motorizationBase || '').trim();
            if (!motor) motor = parseMotorFromBoatModelLabel(model);
            if (!motor) return;
            const mid = String(model?.id || '').trim();
            if (!mid) return;
            const key = buildMotorBaseProductRegistryKey(motor, model);
            if (!key) return;
            if (!map.has(key)) {
                map.set(key, {
                    key,
                    label: motor,
                    optionIds: [],
                    modelIds: new Set(),
                    pricesByModelId: {}
                });
            }
            const entry = map.get(key);
            entry.modelIds.add(mid);
            const price = inferImportMotorBaseProductPriceFromMinoration(model);
            if (price != null && Number.isFinite(price)) entry.pricesByModelId[mid] = price;
        });
        return map;
    }

    function getImportBaseProductsStore() {
        const st = staging();
        if (!st) return [];
        if (!Array.isArray(st.importBaseProducts)) st.importBaseProducts = [];
        return st.importBaseProducts;
    }

    /** Par défaut « fixe » ; bascule auto en « par poste » si plusieurs prix distincts par poste. */
    function suggestImportBaseProductPricingMode() {
        return 'fixed';
    }

    function syncImportBaseProductsFromRegistry(registry, models, options = {}) {
        const store = getImportBaseProductsStore();
        const consumedBpIds = new Set();
        const next = [];
        const modelList = Array.isArray(models) ? models : getImportStagingModelsForAssignment();
        const modelByIdSync = buildImportModelByIdMap(modelList);

        registry.forEach((entry) => {
            const key = String(entry.key || '');
            if (!key) return;
            const modelIds = sortModelIdsByPosteNumber([...entry.modelIds].map(String).filter(Boolean), modelByIdSync);
            let bp = findStoreBaseProductForRegistryEntry(entry, store);
            if (!bp) {
                bp = {
                    id: `bp_${key.slice(0, 20)}_${Date.now().toString(36)}`,
                    key,
                    label: entry.label || '',
                    pricingMode: suggestImportBaseProductPricingMode(),
                    price: null,
                    pricesByModelId: {},
                    optionIds: [],
                    modelIds: []
                };
            } else {
                consumedBpIds.add(bp.id);
            }

            bp.key = key;
            const preserveLabel = !!options?.skipLabelRefresh;
            const prevLabel = String(bp.label || bp.baseOptionName || '').trim();
            if (entry.label && !isImportBaseProductLabelCustomized(bp)) {
                if (!preserveLabel || !prevLabel) {
                    bp.label = entry.label;
                    if (!preserveLabel || !String(bp.baseOptionName || '').trim()) {
                        bp.baseOptionName = entry.label;
                    }
                }
            }

            const entryOptIds = filterImportBaseProductAdjOptionIds(entry.optionIds, modelList);
            bp.optionIds = [...new Set([
                ...filterImportBaseProductAdjOptionIds(bp.optionIds, modelList),
                ...entryOptIds
            ])];
            bp.modelIds = sortModelIdsByPosteNumber(
                [...new Set([...(bp.modelIds || []), ...modelIds])],
                modelByIdSync
            );

            const entryLabel = String(entry.label || '').trim();
            const prevLabelForAlias = String(bp.label || '').trim();
            if (entryLabel && prevLabelForAlias && entryLabel.toLowerCase() !== prevLabelForAlias.toLowerCase()) {
                if (!Array.isArray(bp.aliases)) bp.aliases = [];
                if (!bp.aliases.some((a) => String(a).toLowerCase() === prevLabelForAlias.toLowerCase())) {
                    bp.aliases.push(prevLabelForAlias);
                }
            }

            if (options?.applyPricingHints) {
                const hints = {
                    ...collectImportBaseProductPricesByModel(entry.label || bp.label, bp.modelIds, modelList),
                    ...(entry.pricesByModelId || {})
                };
                applyImportBaseProductPricingFromHints(bp, hints);
            }
            next.push(bp);
        });

        const assignedOptionIds = new Set();
        next.forEach((bp) => (bp.optionIds || []).forEach((oid) => assignedOptionIds.add(String(oid))));

        store.forEach((bp) => {
            if (consumedBpIds.has(bp.id)) return;
            const ids = filterImportBaseProductAdjOptionIds(bp.optionIds, modelList);
            if (!ids.length) return;
            bp.optionIds = ids;
            if (ids.every((oid) => assignedOptionIds.has(oid))) return;
            next.push(bp);
        });

        if (!options?.skipLabelRefresh) {
            next.forEach((bp) => {
                refreshImportBaseProductLabelFromLinkedOptions(bp, modelList);
                normalizeImportBaseProductPricingForAssignment(bp);
            });
        } else {
            next.forEach((bp) => normalizeImportBaseProductPricingForAssignment(bp));
        }
        let out = options?.applyAutoCollapse !== false
            ? collapseImportBaseProductsSameLabelPerPoste(next, modelList)
            : next;
        // Pas de fusion par libellé : 1 ligne mino/majo liée = 1 importBaseProducts (aligné onglet Détection).
        if (options?.dedupeByLabel === true) {
            out = dedupeImportBaseProductsByKey(out, modelList);
        }
        out = dedupeImportMotorBaseProductsByModel(out, modelList);
        if (staging()) staging().importBaseProducts = out;
        return out;
    }

    function findImportBaseProductForOption(opt) {
        const oid = String(opt?.id || '').trim();
        if (!oid) return null;
        const store = getImportBaseProductsStore();
        const byId = String(opt?.baseProductId || '').trim();
        if (byId) {
            const hit = store.find((bp) => bp.id === byId);
            if (hit) return hit;
        }
        return store.find((bp) => (bp.optionIds || []).includes(oid)) || null;
    }

    /**
     * Option de base déjà définie à l'étape 4 — pas de création auto depuis mino/majo.
     */
    function ensureImportBaseProductForAdj(opt, group, models) {
        const options = group?.options?.length
            ? group.options
            : (opt ? [opt] : []);
        if (!options.length) return null;

        const sample = options[0];
        const bp = findImportBaseProductForOption(sample);
        if (!bp) return null;

        const oidSet = new Set((bp.optionIds || []).map(String));
        options.forEach((row) => {
            const oid = String(row?.id || '').trim();
            if (oid) oidSet.add(oid);
            row.baseProductId = bp.id;
            row.baseProductLabel = bp.label;
        });
        bp.optionIds = [...oidSet].filter(Boolean);
        return bp;
    }

    function applyImportBaseProductPricingModeChange(bp, nextModeRaw) {
        if (!bp) return;
        const prevMode = bp.pricingMode === 'per_model' ? 'per_model' : 'fixed';
        bp.pricingMode = nextModeRaw === 'per_model' ? 'per_model' : 'fixed';
        if (bp.pricingMode === 'per_model') {
            if (!bp.pricesByModelId || typeof bp.pricesByModelId !== 'object') bp.pricesByModelId = {};
            if (prevMode === 'fixed' && bp.price != null && bp.price !== '' && (bp.modelIds || []).length) {
                const fixed = Number(bp.price);
                if (Number.isFinite(fixed)) {
                    (bp.modelIds || []).forEach((mid) => {
                        const k = String(mid || '').trim();
                        if (k && (bp.pricesByModelId[k] == null || bp.pricesByModelId[k] === '')) {
                            bp.pricesByModelId[k] = fixed;
                        }
                    });
                }
            }
        }
    }

    /** Prix majoration Excel distincts par poste ? → par poste, sinon fixe. */
    function inferImportAdjPricingModeFromExcelPrices(opt, group, models) {
        const modelList = Array.isArray(models) ? models : getImportStagingModelsForAssignment();
        const options = group?.options?.length ? group.options : (opt ? [opt] : []);
        const prices = new Set();

        options.forEach((row) => {
            const p = getImportMinorationExcelPrice(row);
            if (p != null) prices.add(Number(p.toFixed(2)));
        });

        const modelIds = group
            ? getImportAdjGroupRelevantModelIds(group, modelList)
            : resolveImportMinorationPosteModelIds(opt, modelList);
        (modelIds || []).forEach((mid) => {
            const rowOpt = group
                ? findImportAdjGroupOptForModel(group, mid, modelList)
                : opt;
            const p = rowOpt ? getImportMinorationExcelPrice(rowOpt) : null;
            if (p != null) prices.add(Number(p.toFixed(2)));
        });

        if (prices.size <= 1) return 'fixed';
        return 'per_model';
    }

    /**
     * Mode d'affichage des prix mino/majo (fixe vs par poste) :
     * - « par poste » si les prix Excel diffèrent selon les postes OU si l'option de base est « par poste » ;
     * - sinon « fixe ».
     * N'utilise pas ensureImportBaseProductForAdj (évite une option de base auto-créée en « fixe » qui masque l'Excel).
     */
    function getImportAdjDisplayPricingMode(opt, group, models) {
        const modelList = Array.isArray(models) ? models : getImportStagingModelsForAssignment();
        const adjMode = getImportAdjPricingMode(opt, group, modelList);
        const scope = group?.options?.length ? group.options : (opt ? [opt] : []);
        const sample = scope[0];
        if (!sample) return adjMode;
        const bp = findImportBaseProductForOption(sample);
        if (!bp) return adjMode;
        const bpMode = bp.pricingMode === 'per_model' ? 'per_model' : 'fixed';
        return bpMode === 'per_model' || adjMode === 'per_model' ? 'per_model' : 'fixed';
    }

    function renderImportBaseProductPricingTypeSelectHtml(bp) {
        if (!bp) return '';
        const encId = escapeHtml(String(bp.id || ''));
        const mode = bp.pricingMode === 'per_model' ? 'per_model' : 'fixed';
        return `<div class="ugap-bp-type-field"><strong>Type :</strong>
                <select class="ugap-import-bp-select" data-bp-id="${encId}" data-bp-field="pricingMode">
                    <option value="fixed" ${mode === 'fixed' ? 'selected' : ''}>Fixe — un prix pour tous les postes</option>
                    <option value="per_model" ${mode === 'per_model' ? 'selected' : ''}>Par poste — prix différent par P1, P2…</option>
                </select>
            </div>`;
    }

    /** Bloc prix mino/majo : prix Excel + prix option (base + Excel). */
    function renderImportAdjPriceBlockInner(opt, group, models, priceKind, mode) {
        const modelList = Array.isArray(models) ? models : getImportStagingModelsForAssignment();
        const kind = String(priceKind || 'minoration').toLowerCase() === 'majoration' ? 'majoration' : 'minoration';
        const pricingMode = mode || getImportAdjDisplayPricingMode(opt, group, modelList);
        if (group?.options?.length) {
            return kind === 'majoration'
                ? renderImportGroupedMajorationPricesHtml(group, modelList, pricingMode)
                : renderImportGroupedMinorationPricesHtml(group, modelList, pricingMode);
        }
        if (!opt) return '—';
        return kind === 'majoration'
            ? renderImportMajorationPricesForOpt(opt, modelList, pricingMode)
            : renderImportMinorationPricesForOpt(opt, modelList);
    }

    function renderImportAdjTotalOptionHintHtml(opt, group, models) {
        const modelList = Array.isArray(models) ? models : getImportStagingModelsForAssignment();
        const scope = group?.options?.length ? group.options : (opt ? [opt] : []);
        const sample = scope[0];
        if (!sample) return '';
        if (!isImportBaseOptionsValidated(staging())) {
            const pending = sample && isImportMotorMinoration(sample)
                ? 'Prix option (moteur) = prix minoration Excel — disponible après enregistrement à l\'étape 2.'
                : 'Prix option = option de base + mino/majo Excel — disponible après enregistrement à l\'étape 2.';
            return `<div class="ugap-import-mino-hint" style="margin-top:4px;">${pending}</div>`;
        }
        if (sample && isImportMotorMinoration(sample)) {
            return '<div class="ugap-import-mino-hint" style="margin-top:4px;">Prix option (moteur) = prix minoration Excel (sans addition avec le prix de base).</div>';
        }
        const baseInfo = resolveImportBaseProductPriceForMinoration(sample, modelList);
        if (!baseInfo || baseInfo.price == null) {
            return '<div class="ugap-import-mino-hint" style="margin-top:4px;">Prix option = option de base + mino/majo Excel — renseignez le prix de l\'option de base à l\'étape 2.</div>';
        }
        return '';
    }

    function renderImportMinorationPricesBlockHtml(opt, group, models, priceKind) {
        const modelList = Array.isArray(models) ? models : getImportStagingModelsForAssignment();
        const kind = String(priceKind || 'minoration').toLowerCase() === 'majoration' ? 'majoration' : 'minoration';
        const scope = group?.options?.length ? group.options : (opt ? [opt] : []);
        const sample = scope[0];
        if (!sample) return '';
        const mountKey = escapeHtml(getImportAdjPriceMountKey(sample, group));
        const encGroup = group?.options?.length ? mountKey : '';
        const encOptId = opt && !group?.options?.length ? escapeHtml(String(opt.id || '').trim()) : '';
        const mode = getImportAdjDisplayPricingMode(sample, group, modelList);
        const inner = renderImportAdjPriceBlockInner(opt, group, modelList, kind, mode);
        return `<div class="ugap-adj-price-mount" data-adj-price-mount="${mountKey}" data-adj-price-kind="${kind}"
                data-adj-group-opts="${encGroup}" data-mino-opt-id="${encOptId}" style="margin-top:6px;">
                ${inner}
            </div>
            <div class="ugap-adj-total-hint" data-adj-total-mount="${mountKey}" style="margin-top:2px;">
                ${renderImportAdjTotalOptionHintHtml(opt, group, modelList)}
            </div>`;
    }

    function renderImportAdjOptionNameTypeRowHtml(inputHtml, bp, models, extraHtml = '', opt = null, group = null) {
        const modelList = Array.isArray(models) ? models : getImportStagingModelsForAssignment();
        const sample = opt || (group?.options?.[0]) || null;
        const extra = String(extraHtml || '').trim();
        return `<div class="ugap-bp-name-type-row" style="margin-bottom:6px;">
            <div class="ugap-bp-name-field ugap-mino-option-name-row" style="margin-bottom:0;">
                <span class="ugap-adj-field-label">Option</span>
                ${inputHtml}
                ${extra}
            </div>
            ${renderImportAdjPricingTypeSelectHtml(sample, group, modelList)}
        </div>`;
    }

    function renderImportMinorationPricesForOpt(opt, models) {
        const lineLabel = 'Prix minoration';
        const linePrice = getImportMinorationExcelPrice(opt);
        const baseInfo = resolveImportBaseProductPriceForMinoration(opt, models);
        const optPart = renderImportOptionPricePartHtml(baseInfo, linePrice, opt);
        const encOptId = escapeHtml(String(opt?.id || '').trim());
        return `<div class="ugap-import-mino-row-prices ugap-import-mino-hint" data-mino-opt-id="${encOptId}" style="margin-top:6px;">
            <div><strong>${lineLabel} :</strong> ${formatImportMinoPriceDisplay(linePrice)}
            <span style="margin-left:12px;"><strong>Prix option :</strong> ${optPart}</span></div>
        </div>`;
    }

    function renderImportMajorationPricesForOpt(opt, models, mode) {
        const lineLabel = 'Prix majoration';
        const linePrice = getImportMinorationExcelPrice(opt);
        const baseInfo = resolveImportBaseProductPriceForMinoration(opt, models);
        const optPart = renderImportOptionPricePartHtml(baseInfo, linePrice, opt);
        const encOptId = escapeHtml(String(opt?.id || '').trim());
        return `<div class="ugap-import-mino-row-prices ugap-import-mino-hint" data-mino-opt-id="${encOptId}" style="margin-top:6px;">
            <div><strong>${lineLabel} :</strong> ${formatImportMinoPriceDisplay(linePrice)}
            <span style="margin-left:12px;"><strong>Prix option :</strong> ${optPart}</span></div>
        </div>`;
    }

    function renderImportGroupedMinorationPricesHtml(group, models, mode) {
        const modelList = Array.isArray(models) ? models : getImportStagingModelsForAssignment();
        const modelById = buildImportModelByIdMap(modelList);
        const encGroupOpts = escapeHtml(encodeImportAdjGroupOptIds(group.options));
        const lineLabel = 'Prix minoration';
        const baseHint = !isImportBaseOptionsValidated(staging())
            ? '<div class="ugap-import-mino-hint" style="margin-top:4px;">Prix option total : disponible après enregistrement des options de base (étape 2).</div>'
            : '';

        if (mode === 'fixed') {
            const sample = (group.options || [])[0];
            const linePrice = sample ? getImportMinorationExcelPrice(sample) : null;
            const baseInfo = sample ? resolveImportBaseProductPriceForMinoration(sample, modelList) : null;
            const optPart = renderImportOptionPricePartHtml(baseInfo, linePrice, sample);
            return `<div class="ugap-import-mino-row-prices ugap-import-adj-group-prices ugap-import-mino-hint" data-adj-group-opts="${encGroupOpts}" data-adj-group-price-kind="minoration" style="margin-top:6px;">
                <div><strong>${lineLabel} :</strong> ${formatImportMinoPriceDisplay(linePrice)}
                <span style="margin-left:12px;"><strong>Prix option :</strong> ${optPart}</span></div>
                ${baseHint}
            </div>`;
        }

        const modelIds = getImportAdjGroupRelevantModelIds(group, modelList);
        if (!modelIds.length) {
            return `<div class="ugap-import-mino-row-prices ugap-import-adj-group-prices ugap-import-mino-hint" data-adj-group-opts="${encGroupOpts}" data-adj-group-price-kind="minoration">—</div>`;
        }

        const items = modelIds.map((mid) => {
            const m = modelById.get(String(mid));
            const pn = m?.posteNumber != null && m?.posteNumber !== '' ? `P${m.posteNumber}` : String(mid);
            const rowOpt = findImportAdjGroupOptForModel(group, mid, modelList);
            const linePrice = rowOpt ? getImportMinorationExcelPrice(rowOpt) : null;
            const baseInfo = rowOpt ? resolveImportBaseProductPriceForMinoration(rowOpt, modelList) : null;
            const optPart = renderImportOptionPricePartHtml(baseInfo, linePrice, rowOpt);
            return `<span class="ugap-bp-price-item" style="display:inline-flex;align-items:center;gap:4px;margin:0 12px 6px 0;flex-wrap:wrap;">
                <strong>${escapeHtml(String(pn))}</strong>
                <span>${lineLabel} ${formatImportMinoPriceDisplay(linePrice)}</span>
                <span>Option ${optPart}</span>
            </span>`;
        }).join('');

        return `<div class="ugap-import-mino-row-prices ugap-import-adj-group-prices ugap-import-mino-hint" data-adj-group-opts="${encGroupOpts}" data-adj-group-price-kind="minoration" style="margin-top:6px;">
            <div class="ugap-import-mino-hint"><strong>${lineLabel} / Prix option</strong> par poste :</div>
            <div style="margin-top:4px;">${items}</div>
            ${baseHint}
        </div>`;
    }

    function renderImportGroupedMajorationPricesHtml(group, models, mode) {
        const modelList = Array.isArray(models) ? models : getImportStagingModelsForAssignment();
        const modelById = buildImportModelByIdMap(modelList);
        const encGroupOpts = escapeHtml(encodeImportAdjGroupOptIds(group.options));
        const lineLabel = 'Prix majoration';
        const baseHint = !isImportBaseOptionsValidated(staging())
            ? '<div class="ugap-import-mino-hint" style="margin-top:4px;">Prix option total : disponible après enregistrement des options de base (étape 2).</div>'
            : '';

        if (mode === 'fixed') {
            const sample = (group.options || [])[0];
            const linePrice = sample ? getImportMinorationExcelPrice(sample) : null;
            const baseInfo = sample ? resolveImportBaseProductPriceForMinoration(sample, modelList) : null;
            const optPart = renderImportOptionPricePartHtml(baseInfo, linePrice, sample);
            return `<div class="ugap-import-mino-row-prices ugap-import-adj-group-prices ugap-import-mino-hint" data-adj-group-opts="${encGroupOpts}" data-adj-group-price-kind="majoration" style="margin-top:6px;">
                <div><strong>${lineLabel} :</strong> ${formatImportMinoPriceDisplay(linePrice)}
                <span style="margin-left:12px;"><strong>Prix option :</strong> ${optPart}</span></div>
                ${baseHint}
            </div>`;
        }

        const modelIds = getImportAdjGroupRelevantModelIds(group, modelList);
        if (!modelIds.length) {
            return `<div class="ugap-import-mino-row-prices ugap-import-adj-group-prices ugap-import-mino-hint" data-adj-group-opts="${encGroupOpts}" data-adj-group-price-kind="majoration">—</div>`;
        }

        const items = modelIds.map((mid) => {
            const m = modelById.get(String(mid));
            const pn = m?.posteNumber != null && m?.posteNumber !== '' ? `P${m.posteNumber}` : String(mid);
            const rowOpt = findImportAdjGroupOptForModel(group, mid, modelList);
            const linePrice = rowOpt ? getImportMinorationExcelPrice(rowOpt) : null;
            const baseInfo = rowOpt ? resolveImportBaseProductPriceForMinoration(rowOpt, modelList) : null;
            const optPart = renderImportOptionPricePartHtml(baseInfo, linePrice, rowOpt);
            return `<span class="ugap-bp-price-item" style="display:inline-flex;align-items:center;gap:4px;margin:0 12px 6px 0;flex-wrap:wrap;">
                <strong>${escapeHtml(String(pn))}</strong>
                <span>${lineLabel} ${formatImportMinoPriceDisplay(linePrice)}</span>
                <span>Option ${optPart}</span>
            </span>`;
        }).join('');

        return `<div class="ugap-import-mino-row-prices ugap-import-adj-group-prices ugap-import-mino-hint" data-adj-group-opts="${encGroupOpts}" data-adj-group-price-kind="majoration" style="margin-top:6px;">
            <div class="ugap-import-mino-hint"><strong>${lineLabel} / Prix option</strong> par poste :</div>
            <div style="margin-top:4px;">${items}</div>
            ${baseHint}
        </div>`;
    }

    function getImportBaseProductLabelForOption(opt, fallback) {
        const bp = findImportBaseProductForOption(opt);
        const label = String(bp?.label || opt?.baseProductLabel || '').trim();
        if (label) return label;
        return String(fallback || '').trim();
    }

    function getImportBaseProductsForSave() {
        flushImportBaseProductsLabelsFromDom();
        syncImportBaseProductsFromAdjRows({ force: true, skipLabelRefresh: true });
        const models = getImportStagingModelsForAssignment();
        return getImportBaseProductsStore().map((bp) => {
            applyImportBaseProductPostesFromLabels(bp, models);
            const label = String(bp.label || bp.baseOptionName || '').trim() || 'de base';
            const excelLabel = String(bp.excelLabel || '').trim();
            const priceClient = bp.priceClient == null || bp.priceClient === '' ? null : Number(bp.priceClient);
            const priceUgap = bp.priceUgap == null || bp.priceUgap === '' ? null : Number(bp.priceUgap);
            return {
                id: bp.id,
                key: bp.key,
                label,
                baseOptionName: label,
                labelCustomized: bp.labelCustomized === true,
                excelLabel,
                priceClient: Number.isFinite(priceClient) ? priceClient : null,
                priceUgap: Number.isFinite(priceUgap) ? priceUgap : null,
                pricingMode: bp.pricingMode === 'per_model' ? 'per_model' : 'fixed',
                price: bp.price == null || bp.price === '' ? null : Number(bp.price),
                pricesByModelId: { ...(bp.pricesByModelId || {}) },
                optionIds: filterImportBaseProductAdjOptionIds(bp.optionIds, models),
                modelIds: [...(bp.modelIds || [])],
                aliases: Array.isArray(bp.aliases) ? bp.aliases.map((a) => String(a || '').trim()).filter(Boolean) : [],
                catalogOptionId: String(bp.catalogOptionId || '').trim()
            };
        });
    }

    function mergeImportBaseProductRowData(target, source, models) {
        if (!target || !source) return target;
        const modelList = Array.isArray(models) ? models : getImportStagingModelsForAssignment();
        const modelById = buildImportModelByIdMap(modelList);
        const tgtLabel = String(target.label || '').trim();
        const aliases = new Set(
            (Array.isArray(target.aliases) ? target.aliases : []).map((a) => String(a || '').trim()).filter(Boolean)
        );
        const srcLabel = String(source.label || '').trim();
        if (srcLabel && srcLabel.toLowerCase() !== tgtLabel.toLowerCase()) aliases.add(srcLabel);
        (source.aliases || []).forEach((a) => {
            const s = String(a || '').trim();
            if (s && s.toLowerCase() !== tgtLabel.toLowerCase()) aliases.add(s);
        });
        target.aliases = [...aliases];
        target.optionIds = [...new Set([
            ...(target.optionIds || []).map(String),
            ...(source.optionIds || []).map(String)
        ])].filter(Boolean);
        target.modelIds = sortModelIdsByPosteNumber([...new Set([
            ...(target.modelIds || []).map(String),
            ...(source.modelIds || []).map(String)
        ])].filter(Boolean), modelById);
        if (!target.catalogOptionId && source.catalogOptionId) {
            target.catalogOptionId = source.catalogOptionId;
        }
        const mergedHints = { ...(target.pricesByModelId || {}) };
        const absorb = (bp) => {
            if (bp.pricingMode === 'per_model' && bp.pricesByModelId) {
                Object.assign(mergedHints, bp.pricesByModelId);
            } else if (bp.price != null && bp.price !== '') {
                (bp.modelIds || []).forEach((mid) => {
                    const k = String(mid || '').trim();
                    if (k && mergedHints[k] == null) mergedHints[k] = Number(bp.price);
                });
            }
        };
        absorb(target);
        absorb(source);
        applyImportBaseProductPricingFromHints(target, mergedHints);
        return target;
    }

    /** Une entrée par clé registre (évite N articles catalogue pour la même option de base). */
    function dedupeImportBaseProductsByKey(products, models) {
        const modelList = Array.isArray(models) ? models : getImportStagingModelsForAssignment();
        const byKey = new Map();
        (Array.isArray(products) ? products : []).forEach((bp) => {
            const key = String(bp?.key || buildBaseProductRegistryKey(bp?.label, { id: bp?.id })).trim();
            if (!key) return;
            if (!byKey.has(key)) {
                byKey.set(key, bp);
                return;
            }
            mergeImportBaseProductRowData(byKey.get(key), bp, modelList);
        });
        return [...byKey.values()];
    }

    /** Un seul moteur de base par poste (évite doublon tarif catalogue + motorisation modèle). */
    function dedupeImportMotorBaseProductsByModel(products, models) {
        const modelList = Array.isArray(models) ? models : getImportStagingModelsForAssignment();
        const modelById = buildImportModelByIdMap(modelList);
        const keeperByModel = new Map();
        const out = [];

        (Array.isArray(products) ? products : []).forEach((bp) => {
            const isMotor = isImportMotorBaseProduct(bp) || isImportMotorBaseProductLabel(bp?.label);
            const mids = [...new Set((bp.modelIds || []).map((x) => String(x || '').trim()).filter(Boolean))];
            if (!isMotor || mids.length !== 1) {
                out.push(bp);
                return;
            }
            const mid = mids[0];
            const model = modelById.get(mid);
            const keeper = keeperByModel.get(mid);
            if (!keeper) {
                keeperByModel.set(mid, bp);
                out.push(bp);
                return;
            }
            const prefer = String(model?.motorizationBase || '').trim();
            if (prefer && !isImportBaseProductLabelCustomized(keeper) && !isImportBaseProductLabelCustomized(bp)) {
                const keeperOk = normalizeMotorLabelKey(keeper.label) === normalizeMotorLabelKey(prefer);
                const bpOk = normalizeMotorLabelKey(bp.label) === normalizeMotorLabelKey(prefer);
                if (!keeperOk && bpOk) {
                    keeper.label = bp.label;
                    keeper.baseOptionName = bp.label;
                    keeper.key = buildMotorBaseProductRegistryKey(bp.label, model);
                } else if (keeperOk || !bpOk) {
                    keeper.label = prefer;
                    keeper.baseOptionName = prefer;
                    keeper.key = buildMotorBaseProductRegistryKey(prefer, model);
                }
            } else if (isImportBaseProductLabelCustomized(bp) && !isImportBaseProductLabelCustomized(keeper)) {
                keeper.label = bp.label;
                keeper.baseOptionName = bp.baseOptionName || bp.label;
                keeper.labelCustomized = true;
                keeper.key = buildMotorBaseProductRegistryKey(keeper.label, model);
            }
            mergeImportBaseProductRowData(keeper, bp, modelList);
        });
        return out;
    }

    function mergeImportBaseProductIntoTarget(sourceId, targetId) {
        const sid = String(sourceId || '').trim();
        const tid = String(targetId || '').trim();
        if (!sid || !tid || sid === tid) return false;

        const store = getImportBaseProductsStore();
        const source = store.find((x) => String(x.id) === sid);
        const target = store.find((x) => String(x.id) === tid);
        if (!source || !target) return false;

        const tgtLabel = String(target.label || '').trim();
        const aliases = new Set(
            (Array.isArray(target.aliases) ? target.aliases : []).map((a) => String(a || '').trim()).filter(Boolean)
        );
        const srcLabel = String(source.label || '').trim();
        if (srcLabel && srcLabel.toLowerCase() !== tgtLabel.toLowerCase()) aliases.add(srcLabel);
        (source.aliases || []).forEach((a) => {
            const s = String(a || '').trim();
            if (s && s.toLowerCase() !== tgtLabel.toLowerCase()) aliases.add(s);
        });
        target.aliases = [...aliases];

        target.optionIds = [...new Set([
            ...(target.optionIds || []).map(String),
            ...(source.optionIds || []).map(String)
        ])].filter(Boolean);
        const modelByIdMerge = buildImportModelByIdMap();
        target.modelIds = sortModelIdsByPosteNumber([...new Set([
            ...(target.modelIds || []).map(String),
            ...(source.modelIds || []).map(String)
        ])].filter(Boolean), modelByIdMerge);

        const mergedHints = { ...(target.pricesByModelId || {}) };
        const absorbFixed = (bp) => {
            if (bp.pricingMode === 'per_model' && bp.pricesByModelId) {
                Object.keys(bp.pricesByModelId).forEach((mid) => {
                    if (mergedHints[mid] == null || mergedHints[mid] === '') mergedHints[mid] = bp.pricesByModelId[mid];
                });
            } else if (bp.price != null && bp.price !== '') {
                (bp.modelIds || []).forEach((mid) => {
                    const k = String(mid || '').trim();
                    if (k && (mergedHints[k] == null || mergedHints[k] === '')) mergedHints[k] = Number(bp.price);
                });
            }
        };
        absorbFixed(target);
        absorbFixed(source);
        applyImportBaseProductPricingFromHints(target, mergedHints);

        if (staging()) {
            staging().importBaseProducts = store.filter((x) => String(x.id) !== sid);
        }
        return true;
    }

    function runMergeImportBaseProduct(sourceId) {
        const sid = String(sourceId || '').trim();
        const sel = document.querySelector(`.ugap-import-bp-merge-select[data-bp-merge-source="${sid}"]`);
        const targetId = String(sel?.value || '').trim();
        if (!targetId) {
            showAlert('Choisissez la ligne à conserver (objet de base cible).', 'warning');
            return;
        }
        if (!mergeImportBaseProductIntoTarget(sid, targetId)) {
            showAlert('Fusion impossible.', 'error');
            return;
        }
        showAlert('Lignes fusionnées. Vérifiez nom, postes et prix, puis enregistrez.', 'success');
        renderImportWorkflow();
    }

    function updateImportBaseProductLocal(bpId, patch) {
        const bp = getImportBaseProductsStore().find((x) => x.id === bpId);
        if (!bp) return;
        if (patch && Object.prototype.hasOwnProperty.call(patch, 'label')) {
            markImportBaseProductLabelCustomized(bp, patch.label);
            const rest = { ...patch };
            delete rest.label;
            Object.assign(bp, rest);
            return;
        }
        Object.assign(bp, patch);
    }

    function toggleImportBaseProductModelAssignment(bpId, modelId, checked) {
        const id = String(bpId || '').trim();
        const bp = getImportBaseProductsStore().find((x) => String(x.id) === id);
        if (!bp) return;
        const set = new Set((bp.modelIds || []).map(String));
        const mid = String(modelId || '').trim();
        if (!mid) return;
        if (checked) set.add(mid);
        else set.delete(mid);
        const modelById = buildImportModelByIdMap();
        bp.modelIds = sortModelIdsByPosteNumber(Array.from(set), modelById);
        normalizeImportBaseProductPricingForAssignment(bp);
        refreshImportBaseProductPriceDom(id);
        refreshImportMinorationAssignPricesDom();
    }

    /** Rafraîchit les champs prix par poste après ajout/retrait d’un modèle coché (sans re-render complet). */
    function refreshImportBaseProductPriceDom(bpId) {
        const id = String(bpId || '').trim();
        const bp = getImportBaseProductsStore().find((x) => String(x.id) === id);
        if (!bp) return;

        const mounts = document.querySelectorAll('.ugap-bp-price-mount');
        let mount = null;
        mounts.forEach((el) => {
            if (el.getAttribute('data-bp-price-mount') === id) mount = el;
        });
        if (!mount) {
            if (typeof renderImportWorkflow === 'function') renderImportWorkflow();
            return;
        }

        const models = getImportStagingModelsForAssignment();
        const modelById = new Map(models.map((m) => [String(m?.id || '').trim(), m]));
        mount.innerHTML = renderImportBaseProductPriceBlock(bp, modelById, escapeHtml(bp.id));
    }

    function formatImportPosteColLabel(m) {
        const pn = m?.posteNumber;
        return pn != null && pn !== '' ? `P${pn}` : '—';
    }

    function compareImportModelsByPoste(ma, mb) {
        const na = Number(ma?.posteNumber);
        const nb = Number(mb?.posteNumber);
        const aOk = Number.isFinite(na);
        const bOk = Number.isFinite(nb);
        if (aOk && bOk && na !== nb) return na - nb;
        if (aOk && !bOk) return -1;
        if (!aOk && bOk) return 1;
        return String(ma?.name || '').localeCompare(String(mb?.name || ''), 'fr', { sensitivity: 'base' });
    }

    function getImportPosteFilterValue() {
        return String(wfState().posteFilter || '').trim();
    }

    function getImportModelIdsForPosteNumber(models, posteFilter) {
        const pf = String(posteFilter || '').trim();
        if (!pf) return null;
        const pn = Number(pf);
        if (!Number.isFinite(pn)) return new Set();
        const list = Array.isArray(models) ? models : getImportStagingModelsForAssignment();
        return new Set(
            list
                .filter((m) => Number(m?.posteNumber) === pn)
                .map((m) => String(m?.id || '').trim())
                .filter(Boolean)
        );
    }

    function getImportPosteFilterChoices(models) {
        const list = Array.isArray(models) ? models : getImportStagingModelsForAssignment();
        const seen = new Map();
        list.forEach((m) => {
            const pn = m?.posteNumber;
            if (pn == null || pn === '') return;
            const key = String(pn);
            if (seen.has(key)) return;
            const name = String(m?.name || '').trim();
            seen.set(key, { value: key, label: name ? `P${pn} — ${name}` : `P${pn}` });
        });
        return Array.from(seen.values()).sort((a, b) => Number(a.value) - Number(b.value));
    }

    function filterImportModelsByPosteFilter(models, posteFilter) {
        const pf = String(posteFilter || '').trim();
        const list = Array.isArray(models) ? models : getImportStagingModelsForAssignment();
        if (!pf) return list.slice();
        const pn = Number(pf);
        if (!Number.isFinite(pn)) return [];
        return list.filter((m) => Number(m?.posteNumber) === pn);
    }

    function importOptionMatchesPosteFilter(opt, posteFilter, models) {
        const pf = String(posteFilter || '').trim();
        if (!pf) return true;
        const targetIds = getImportModelIdsForPosteNumber(models, pf);
        if (!targetIds || !targetIds.size) return false;
        const modelList = Array.isArray(models) ? models : getImportStagingModelsForAssignment();
        const resolved = resolveImportMinorationPosteModelIds(opt, modelList);
        const checkIds = resolved.length
            ? resolved
            : (Array.isArray(opt?.compatibleModels) ? opt.compatibleModels : []).map((id) => String(id || '').trim());
        return checkIds.some((id) => targetIds.has(String(id || '').trim()));
    }

    function importBaseProductMatchesPosteFilter(bp, posteFilter, models) {
        const pf = String(posteFilter || '').trim();
        if (!pf) return true;
        const targetIds = getImportModelIdsForPosteNumber(models, pf);
        if (!targetIds || !targetIds.size) return false;
        return (bp?.modelIds || []).some((id) => targetIds.has(String(id || '').trim()));
    }

    function importAdjGroupMatchesPosteFilter(group, posteFilter, models) {
        const pf = String(posteFilter || '').trim();
        if (!pf) return true;
        return (group?.options || []).some((opt) => importOptionMatchesPosteFilter(opt, pf, models));
    }

    function renderImportPosteFilterHtml(models) {
        const choices = getImportPosteFilterChoices(models);
        if (!choices.length) return '';
        const current = getImportPosteFilterValue();
        const opts = [
            '<option value="">Tous les postes</option>',
            ...choices.map((c) => {
                const sel = current === c.value ? ' selected' : '';
                return `<option value="${escapeHtml(c.value)}"${sel}>${escapeHtml(c.label)}</option>`;
            })
        ].join('');
        return `<label class="ugap-import-poste-filter" style="display:inline-flex;align-items:center;gap:8px;font-size:13px;margin-right:8px;">
            <span style="color:#475569;">Filtrer par poste</span>
            <select class="ugap-import-poste-filter-select" style="padding:5px 8px;border:1px solid #cbd5e1;border-radius:6px;font-size:12px;min-width:200px;"
                onchange="onImportPosteFilterChange(this.value)">${opts}</select>
        </label>`;
    }

    function onImportPosteFilterChange(value) {
        wfState().posteFilter = String(value || '').trim();
        if (typeof renderImportWorkflow === 'function') renderImportWorkflow();
    }

    function buildImportModelByIdMap(models) {
        const list = Array.isArray(models) ? models : getImportStagingModelsForAssignment();
        return new Map(list.map((m) => [String(m?.id || '').trim(), m]));
    }

    /** P1, P2, P3… pour l’affichage des prix par poste. */
    function sortModelIdsByPosteNumber(modelIds, modelById) {
        const map = modelById instanceof Map ? modelById : buildImportModelByIdMap();
        return [...(modelIds || [])].map((x) => String(x || '').trim()).filter(Boolean).sort((a, b) => {
            return compareImportModelsByPoste(map.get(a), map.get(b));
        });
    }

    function getImportPosteGridCols(modelCount) {
        return Math.max(1, Math.ceil((modelCount || 0) / 2));
    }

    function renderImportBaseProductPriceBlock(bp, modelById, encId) {
        const mode = bp.pricingMode === 'per_model' ? 'per_model' : 'fixed';
        if (mode === 'fixed') {
            const pv = bp.price != null && bp.price !== '' ? Number(bp.price) : '';
            return `<div class="ugap-import-mino-hint"><strong>Prix :</strong>
                <input type="number" step="0.01" min="0" class="ugap-bp-price-input"
                    data-bp-id="${encId}" data-bp-field="price" value="${pv === '' ? '' : escapeHtml(String(pv))}"> €
            </div>`;
        }
        const sortedModelIds = sortModelIdsByPosteNumber(bp.modelIds, modelById);
        const items = sortedModelIds.map((mid) => {
            const midStr = String(mid || '').trim();
            const m = modelById.get(midStr);
            const pnLbl = formatImportPosteColLabel(m);
            const pn = pnLbl !== '—' ? pnLbl : midStr;
            const raw = bp.pricesByModelId && typeof bp.pricesByModelId === 'object' ? bp.pricesByModelId[midStr] : null;
            const pv = raw != null && raw !== '' ? Number(raw) : '';
            return `<span class="ugap-bp-price-item">
                <span>${escapeHtml(String(pn))}</span>
                <input type="number" step="0.01" min="0" data-bp-id="${encId}" data-bp-field="modelPrice"
                    data-bp-model-id="${escapeHtml(midStr)}" value="${pv === '' ? '' : escapeHtml(String(pv))}">
                <span>€</span>
            </span>`;
        }).join('');
        return `<div class="ugap-import-mino-hint"><strong>Prix :</strong></div>
            <div class="ugap-bp-prices-inline">${items || '—'}</div>`;
    }

    function getImportBaseProductLinkedOptionLabels(bp, models) {
        const ids = filterImportBaseProductAdjOptionIds(bp?.optionIds, models);
        return ids.map((oid) => {
            const id = String(oid || '').trim();
            if (!id) return null;
            const opt = findImportStagingOptionById(id);
            if (!opt) return { id, label: id, ref: '' };
            const label = String(opt?.name || id).trim();
            return {
                id,
                label,
                ref: String(opt?.refUgap || '').trim()
            };
        }).filter(Boolean);
    }

    function renderImportBaseProductLinkedOptionsHtml(bp, models) {
        const linked = getImportBaseProductLinkedOptionLabels(bp, models);
        const linkedCount = linked.length;
        if (!linkedCount) {
            return '<div class="ugap-import-mino-hint ugap-bp-linked-minos">0 option(s) liée(s)</div>';
        }
        const items = linked.map((row) => {
            const refPart = row.ref
                ? `<span class="ugap-bp-linked-minos-ref">${escapeHtml(row.ref)}</span>`
                : '';
            return `<li>${refPart}${escapeHtml(row.label)}</li>`;
        }).join('');
        const chevron = `<span class="ugap-bp-linked-minos-chevron" aria-hidden="true"><svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg></span>`;
        return `<div class="ugap-import-mino-hint ugap-bp-linked-minos">
            <details class="ugap-bp-linked-minos-details">
                <summary class="ugap-bp-linked-minos-summary">
                    <span>${linkedCount} option(s) liée(s)</span>
                    ${chevron}
                </summary>
                <ul class="ugap-bp-linked-minos-list">${items}</ul>
            </details>
        </div>`;
    }

    function renderImportBaseProductDetailCell(bp, modelById, allProducts) {
        const encId = escapeHtml(bp.id);
        const mode = bp.pricingMode === 'per_model' ? 'per_model' : 'fixed';
        const models = [...(modelById instanceof Map ? modelById.values() : [])];
        const aliases = Array.isArray(bp.aliases) ? bp.aliases.filter(Boolean) : [];
        const aliasesLine = aliases.length
            ? `<div class="ugap-import-mino-label-raw">Libellés fusionnés : ${escapeHtml(aliases.join(' · '))}</div>`
            : '';
        const excelLabel = String(bp.excelLabel || '').trim();
        const excelLine = excelLabel
            ? `<div class="ugap-import-mino-label-raw"><strong>Libellé Excel :</strong> ${escapeHtml(excelLabel)}</div>`
            : '';
        const displayName = String(bp.label || bp.baseOptionName || '').trim() || 'de base';
        return `<div class="ugap-bp-name-type-row">
            <div class="ugap-bp-name-field"><strong>Nom option de base :</strong>
                <div class="ugap-bp-name-cell" data-bp-id="${encId}" data-bp-field="label" title="Double-cliquer pour modifier">
                    <span class="ugap-bp-name-cell__text">${escapeHtml(displayName)}</span>
                    <span class="ugap-bp-name-cell__hint">Double-clic pour modifier</span>
                </div>
            </div>
            <div class="ugap-bp-type-field"><strong>Type :</strong>
                <select class="ugap-import-bp-select" data-bp-id="${encId}" data-bp-field="pricingMode">
                    <option value="fixed" ${mode === 'fixed' ? 'selected' : ''}>Fixe — un prix pour tous les postes</option>
                    <option value="per_model" ${mode === 'per_model' ? 'selected' : ''}>Par poste — prix différent par P1, P2…</option>
                </select>
            </div>
        </div>
        ${excelLine}
        <div class="ugap-bp-price-mount" data-bp-price-mount="${escapeHtml(String(bp.id || ''))}">
            ${renderImportBaseProductPriceBlock(bp, modelById, encId)}
        </div>
        ${renderImportBaseProductLinkedOptionsHtml(bp, models)}
        ${aliasesLine}
        ${renderImportBaseProductMergeRow(bp, allProducts)}`;
    }

    function renderImportBaseProductMergeRow(bp, allProducts) {
        const list = Array.isArray(allProducts) ? allProducts : getImportBaseProductsStore();
        const others = list.filter((x) => String(x?.id || '').trim() !== String(bp?.id || '').trim());
        if (!others.length) return '';
        const encSource = escapeHtml(String(bp.id || ''));
        const opts = others.map((t) => {
            const lab = String(t.label || t.key || t.id || '').trim();
            const short = lab.length > 52 ? `${lab.slice(0, 49)}…` : lab;
            return `<option value="${escapeHtml(String(t.id))}">${escapeHtml(short)}</option>`;
        }).join('');
        return `<div class="ugap-import-mino-hint ugap-import-bp-merge-row">
            <strong>Fusion :</strong>
            <select class="ugap-import-bp-merge-select ugap-import-bp-select" data-bp-merge-source="${encSource}" style="max-width:240px;margin:0 6px;">
                <option value="">Fusionner cette ligne dans…</option>
                ${opts}
            </select>
            <button type="button" class="btn btn-outline" style="padding:4px 10px;font-size:11px;"
                onclick="runMergeImportBaseProduct('${encSource}')">Fusionner</button>
        </div>`;
    }

    function renderImportBaseProductPostesGrid(bp, models, posteGridCols) {
        const assigned = new Set((bp.modelIds || []).map(String));
        const encBpId = encodeURIComponent(String(bp.id || '').trim());
        const cells = models.map((m) => {
            const mid = String(m.id || '').trim();
            const checked = assigned.has(mid);
            const pn = formatImportPosteColLabel(m);
            return `<label class="ugap-import-mino-poste-cell" title="${escapeHtml(String(m.name || m.id || ''))}">
                <input type="checkbox" data-bp-id="${escapeHtml(bp.id)}" data-bp-model="${encodeURIComponent(mid)}"
                    ${checked ? 'checked' : ''}
                    onchange="toggleImportBaseProductModelAssignment(decodeURIComponent('${encBpId}'), decodeURIComponent('${encodeURIComponent(mid)}'), this.checked)">
                <span>${escapeHtml(pn)}</span>
            </label>`;
        }).join('');
        return `<div class="ugap-import-mino-postes-grid" style="--mino-cols:${posteGridCols}">${cells}</div>`;
    }

    function bindImportBaseProductsEditor() {
        if (window.__ugapImportBpEditorBound) return;
        window.__ugapImportBpEditorBound = true;

        const inBpTable = (el) => el && typeof el.closest === 'function' && el.closest('.ugap-import-bp-table-wrap');

        document.addEventListener('dblclick', (e) => {
            const cell = e.target.closest('.ugap-import-bp-table-wrap .ugap-bp-name-cell[data-bp-id]');
            if (!cell) return;
            void openImportBaseProductNameModal(cell.getAttribute('data-bp-id'));
        });

        document.addEventListener('change', (e) => {
            const el = e.target;
            if (!inBpTable(el)) return;
            const bpId = el.getAttribute('data-bp-id');
            if (!bpId) return;
            const field = el.getAttribute('data-bp-field');
            if (field === 'pricingMode') {
                const id = String(bpId || '').trim();
                const bp = getImportBaseProductsStore().find((x) => String(x.id) === id);
                if (!bp) return;
                applyImportBaseProductPricingModeChange(bp, el.value);
                renderImportWorkflow();
            }
        });

        document.addEventListener('input', (e) => {
            const el = e.target;
            if (!inBpTable(el)) return;
            const bpId = String(el.getAttribute('data-bp-id') || '').trim();
            if (!bpId) return;
            const field = el.getAttribute('data-bp-field');
            if (field === 'price') {
                const v = el.value === '' ? null : Number(el.value);
                updateImportBaseProductLocal(bpId, { price: Number.isFinite(v) ? v : null });
                refreshImportMinorationAssignPricesDom();
                return;
            }
            const modelId = String(el.getAttribute('data-bp-model-id') || '').trim();
            if (field === 'modelPrice' && modelId) {
                const bp = getImportBaseProductsStore().find((x) => String(x.id) === bpId);
                if (!bp) return;
                if (!bp.pricesByModelId || typeof bp.pricesByModelId !== 'object') bp.pricesByModelId = {};
                const v = el.value === '' ? null : Number(el.value);
                bp.pricesByModelId[modelId] = Number.isFinite(v) ? v : null;
                refreshImportMinorationAssignPricesDom();
            }
        });
    }

    function seedImportAssignPosteAssignments(filterFn) {
        const models = getImportStagingModelsForAssignment();
        const rows = getImportStagingOptionsFlat().filter(filterFn);
        let touched = 0;

        rows.forEach((opt) => {
            const resolved = resolveImportMinorationPosteModelIds(opt, models);
            const prev = (Array.isArray(opt.compatibleModels) ? opt.compatibleModels : []).map(String).sort().join(',');
            opt.compatibleModels = resolved;
            const now = opt.compatibleModels.map(String).sort().join(',');
            if (prev !== now) touched += 1;
        });

        return touched;
    }

    function seedImportMinorationPosteAssignments() {
        return seedImportAssignPosteAssignments(isImportMinorationOption);
    }

    function seedImportMajorationPosteAssignments() {
        return seedImportAssignPosteAssignments(isImportMajorationOption);
    }

    function seedImportCatalogOptionPosteAssignments() {
        return seedImportAssignPosteAssignments((opt) => getImportResolvedLineKind(opt) === 'option');
    }

    function runSeedImportOptionsTriPostes() {
        const n = seedImportMinorationPosteAssignments()
            + seedImportMajorationPosteAssignments()
            + seedImportCatalogOptionPosteAssignments();
        showAlert(`${n} ligne(s) mise(s) à jour (postes pré-cochés).`, n ? 'success' : 'info');
        renderImportWorkflow();
    }

    /** Options catalogue sans poste → tous les modèles validés (étape Valider). Pas les mino/majo. */
    function assignAllPostesToUnassignedImportOptions() {
        const models = getImportStagingModelsForAssignment();
        if (!models.length) return 0;
        const allModelIds = models.map((m) => String(m?.id || '').trim()).filter(Boolean);
        let touched = 0;
        getImportStagingOptionsFlat().forEach((opt) => {
            if (!isImportTriEligibleOption(opt)) return;
            if (isImportMinorationOption(opt) || isImportMajorationOption(opt)) return;
            const cm = Array.isArray(opt?.compatibleModels) ? opt.compatibleModels : [];
            if (cm.length > 0) return;
            opt.compatibleModels = allModelIds.slice();
            touched += 1;
        });
        return touched;
    }

    /** Empreinte modèles (motorisation) — sync moteurs de base uniquement, pas les mino/majo. */
    function computeImportBaseProductsSyncFingerprint(models) {
        const modelList = Array.isArray(models) ? models : getImportStagingModelsForAssignment();
        const modelPart = modelList
            .map((m) => `${String(m?.id || '').trim()}:${String(m?.motorizationBase || '').trim()}:${m?.posteNumber ?? ''}`)
            .sort()
            .join(';');
        return [modelPart, String(modelList.length)].join('§');
    }

    /** Postes depuis libellé Excel ; si aucun poste explicite → tous les modèles validés. */
    function applyImportBaseProductPostesFromLabels(bp, models) {
        if (!bp || typeof bp !== 'object') return bp;
        const modelList = Array.isArray(models) ? models : getImportStagingModelsForAssignment();
        const allModelIds = modelList.map((m) => String(m?.id || '').trim()).filter(Boolean);
        const current = [...new Set((bp.modelIds || []).map((x) => String(x || '').trim()).filter(Boolean))];
        if (current.length) {
            bp.modelIds = sortModelIdsByPosteNumber(current, buildImportModelByIdMap(modelList));
            return bp;
        }

        const labels = [
            String(bp.excelLabel || '').trim(),
            String(bp.label || '').trim(),
            ...(Array.isArray(bp.aliases) ? bp.aliases : []).map((a) => String(a || '').trim())
        ].filter(Boolean);
        (bp.optionIds || []).forEach((oid) => {
            const opt = findImportStagingOptionById(oid);
            if (opt?.name) labels.push(String(opt.name).trim());
        });

        const posteNums = new Set();
        labels.forEach((lab) => {
            if (typeof getExplicitPosteSetFromLabel !== 'function') return;
            const explicit = getExplicitPosteSetFromLabel(lab);
            if (explicit && explicit.size) {
                explicit.forEach((pn) => posteNums.add(Number(pn)));
            }
        });
        if (posteNums.size) {
            bp.modelIds = sortModelIdsByPosteNumber(
                modelList
                    .filter((m) => posteNums.has(Number(m?.posteNumber)))
                    .map((m) => String(m?.id || '').trim())
                    .filter(Boolean),
                buildImportModelByIdMap(modelList)
            );
            return bp;
        }

        const fromOpts = new Set();
        (bp.optionIds || []).forEach((oid) => {
            const opt = findImportStagingOptionById(oid);
            (Array.isArray(opt?.compatibleModels) ? opt.compatibleModels : [])
                .map((x) => String(x || '').trim())
                .filter(Boolean)
                .forEach((mid) => fromOpts.add(mid));
        });
        if (fromOpts.size) {
            bp.modelIds = sortModelIdsByPosteNumber([...fromOpts], buildImportModelByIdMap(modelList));
            return bp;
        }

        bp.modelIds = [];
        return bp;
    }

    /** 1 entrée par ligne mino/majo éligible (clé = id option source), sans fusion sur le nom. */
    function buildImportBaseProductsRegistryOnePerSourceLine(adjRows, models) {
        const registry = new Map();
        const modelList = Array.isArray(models) ? models : getImportStagingModelsForAssignment();
        const modelById = buildImportModelByIdMap(modelList);

        (Array.isArray(adjRows) ? adjRows : []).forEach((opt) => {
            if (!isImportAdjForBaseProductLink(opt, modelList)) return;
            const oid = String(opt?.id || '').trim();
            if (!oid) return;
            const key = `src_${oid}`;
            const excelLabel = String(opt?.name || '').trim();
            const label = getImportBaseProductRegistryLabel(opt, modelList) || excelLabel || 'de base';
            const mids = resolveImportMinorationPosteModelIds(opt, modelList)
                .map((x) => String(x || '').trim())
                .filter(Boolean);
            const modelIds = sortModelIdsByPosteNumber(
                mids.length ? mids : [],
                modelById
            );
            const pricesByModelId = collectImportBaseProductPricesByModel(label, modelIds, modelList);
            registry.set(key, {
                key,
                label,
                optionIds: [oid],
                modelIds: new Set(modelIds),
                pricesByModelId
            });
        });
        return registry;
    }

    function enrichImportBaseProductRowFromRegistry(bp, entry, models) {
        if (!bp) return bp;
        const modelList = Array.isArray(models) ? models : getImportStagingModelsForAssignment();
        if (isImportBaseProductLabelCustomized(bp)) {
            const userLabel = String(bp.label || bp.baseOptionName || '').trim() || 'de base';
            bp.label = userLabel;
            bp.baseOptionName = userLabel;
        } else {
            const baseName = String(entry?.label || bp.baseOptionName || '').trim() || 'de base';
            bp.baseOptionName = String(bp.baseOptionName || baseName).trim() || 'de base';
            bp.label = String(bp.label || bp.baseOptionName).trim() || 'de base';
        }

        const oids = filterImportBaseProductAdjOptionIds(entry?.optionIds || bp.optionIds, modelList);
        bp.optionIds = [...new Set([...(bp.optionIds || []), ...oids])];
        oids.forEach((oid) => {
            const opt = findImportStagingOptionById(oid);
            if (!opt) return;
            if (!String(bp.excelLabel || '').trim() && opt.name) {
                bp.excelLabel = String(opt.name).trim();
            }
            if ((bp.priceClient == null || bp.priceClient === '') && Number.isFinite(Number(opt.priceClient))) {
                bp.priceClient = Number(opt.priceClient);
            }
            if ((bp.priceUgap == null || bp.priceUgap === '') && Number.isFinite(Number(opt.priceUgap))) {
                bp.priceUgap = Number(opt.priceUgap);
            }
        });
        if (!String(bp.excelLabel || '').trim()) {
            bp.excelLabel = String(entry?.excelLabel || '').trim();
        }
        if ((bp.priceClient == null || bp.priceClient === '') && Number.isFinite(Number(entry?.priceClient))) {
            bp.priceClient = Number(entry.priceClient);
        }
        if ((bp.priceUgap == null || bp.priceUgap === '') && Number.isFinite(Number(entry?.priceUgap))) {
            bp.priceUgap = Number(entry.priceUgap);
        }

        applyImportBaseProductPostesFromLabels(bp, modelList);
        return bp;
    }

    /**
     * importBaseProducts : 1 ligne = 1 option de base à publier (nom, libellé Excel, prix, postes).
     * Dérivé des mino/majo pour le nom/prix ; les mino/majo restent des options classiques dans importOptions.
     */
    function syncImportBaseProductsFromAdjRows(options = {}) {
        const motorsOnly = options.motorsOnly === true;
        const force = !!options.force;
        const models = getImportStagingModelsForAssignment();
        if (!models.length) return getImportBaseProductsStore();

        const st = staging();
        const fp = computeImportBaseProductsSyncFingerprint(models);
        if (
            !force
            && st
            && Array.isArray(st.importBaseProducts)
            && String(st._importBpSyncFingerprint || '') === fp
        ) {
            return st.importBaseProducts;
        }

        const registry = new Map();
        if (!motorsOnly) {
            const adjRows = getImportRowsForBaseProductRegistry();
            buildImportBaseProductsRegistryOnePerSourceLine(adjRows, models).forEach((entry, key) => {
                registry.set(key, entry);
            });
        }
        appendModelMotorizationEntriesToRegistry(registry, models);

        const out = syncImportBaseProductsFromRegistry(registry, models, {
            applyPricingHints: true,
            applyAutoCollapse: false,
            dedupeByLabel: false,
            skipLabelRefresh: !!options.skipLabelRefresh
        });
        out.forEach((bp) => {
            const entry = registry.get(String(bp.key || '')) || bp;
            enrichImportBaseProductRowFromRegistry(bp, entry, models);
        });
        if (st) {
            st.importBaseProducts = out;
            st._importBpSyncFingerprint = fp;
        }
        return out;
    }

    function toggleImportMinorationModelAssignment(optionId, modelId, checked) {
        const opt = findImportStagingOptionById(optionId);
        if (!opt) return;
        const set = new Set((Array.isArray(opt.compatibleModels) ? opt.compatibleModels : []).map((x) => String(x || '').trim()).filter(Boolean));
        const mid = String(modelId || '').trim();
        if (!mid) return;
        if (checked) set.add(mid);
        else set.delete(mid);
        opt.compatibleModels = Array.from(set);
        syncImportMinorationRecapDock();
        refreshImportMinorationAssignPricesDom();
    }

    function formatPostesListForMinoration(opt) {
        if (typeof getSortedExplicitPosteNumbersFromLabel === 'function') {
            const nums = getSortedExplicitPosteNumbersFromLabel(opt?.name);
            if (nums.length) return nums.join(', ');
        }
        const cm = Array.isArray(opt?.compatibleModels) ? opt.compatibleModels.map(String) : [];
        if (!cm.length) return '—';
        const models = getImportStagingModelsForAssignment();
        const postes = models
            .filter((m) => cm.includes(String(m?.id || '').trim()))
            .map((m) => m?.posteNumber)
            .filter((pn) => pn != null && pn !== '');
        const unique = [...new Set(postes.map((x) => Number(x)))].filter(Number.isFinite).sort((a, b) => a - b);
        return unique.length ? unique.join(', ') : '—';
    }

    function isMinorationCheckboxSuggested(opt, model) {
        if (typeof getExplicitPosteSetFromLabel !== 'function') return false;
        const explicit = getExplicitPosteSetFromLabel(opt?.name);
        if (!explicit || !explicit.size) return false;
        const pn = Number(model?.posteNumber);
        return Number.isFinite(pn) && explicit.has(pn);
    }

    function encodeImportAdjGroupOptIds(options) {
        return encodeURIComponent(JSON.stringify(
            (options || []).map((o) => String(o?.id || '').trim()).filter(Boolean)
        ));
    }

    function decodeImportAdjGroupOptIds(encoded) {
        try {
            return JSON.parse(decodeURIComponent(String(encoded || '')));
        } catch (_e) {
            return [];
        }
    }

    /** Regroupe les lignes mino/majoration par champ Option (même règles que options de base). */
    function buildImportAdjDisplayGroups(rows, models) {
        const mergeable = new Map();
        const singles = [];

        (rows || []).forEach((opt) => {
            const fusionLabel = getImportAdjOptionFusionLabel(opt, models);
            if (!fusionLabel || isImportNonMergeableBaseProductLabel(fusionLabel)) {
                singles.push({
                    key: `solo_${String(opt?.id || '')}`,
                    label: fusionLabel,
                    options: [opt],
                    grouped: false
                });
                return;
            }
            const key = normalizeBaseProductKey(fusionLabel);
            if (!key) {
                singles.push({
                    key: `solo_${String(opt?.id || '')}`,
                    label: fusionLabel,
                    options: [opt],
                    grouped: false
                });
                return;
            }
            if (!mergeable.has(key)) {
                mergeable.set(key, { key, label: fusionLabel, options: [], grouped: true });
            }
            mergeable.get(key).options.push(opt);
        });

        const out = [];
        mergeable.forEach((g) => {
            if (g.options.length > 1) {
                out.push(g);
            } else {
                out.push({
                    ...g,
                    grouped: false,
                    key: `solo_${String(g.options[0]?.id || '')}`
                });
            }
        });
        singles.forEach((s) => out.push(s));
        out.sort((a, b) => {
            const la = String(a.label || '').toLowerCase();
            const lb = String(b.label || '').toLowerCase();
            if (la !== lb) return la.localeCompare(lb, 'fr');
            return (Number(a.options[0]?.rowOrder) || 0) - (Number(b.options[0]?.rowOrder) || 0);
        });
        return out;
    }

    function getImportAdjGroupAssignedModelIds(group) {
        const ids = new Set();
        (group?.options || []).forEach((opt) => {
            (Array.isArray(opt?.compatibleModels) ? opt.compatibleModels : []).forEach((mid) => {
                const s = String(mid || '').trim();
                if (s) ids.add(s);
            });
        });
        return Array.from(ids);
    }

    function getImportAdjGroupRelevantModelIds(group, models) {
        const modelById = buildImportModelByIdMap(models);
        const ids = new Set();
        (group?.options || []).forEach((opt) => {
            (opt.compatibleModels || []).forEach((mid) => {
                const s = String(mid || '').trim();
                if (s) ids.add(s);
            });
            resolveImportMinorationPosteModelIds(opt, models).forEach((mid) => {
                const s = String(mid || '').trim();
                if (s) ids.add(s);
            });
        });
        return sortModelIdsByPosteNumber([...ids], modelById);
    }

    function findImportAdjGroupOptForModel(group, modelId, models) {
        const mid = String(modelId || '').trim();
        if (!mid) return null;
        for (const opt of group?.options || []) {
            if ((opt.compatibleModels || []).map(String).includes(mid)) return opt;
        }
        for (const opt of group?.options || []) {
            if (resolveImportMinorationPosteModelIds(opt, models).includes(mid)) return opt;
        }
        return (group?.options || [])[0] || null;
    }

    function toggleImportAdjGroupModelAssignment(encOptIds, modelId, checked) {
        const optIds = decodeImportAdjGroupOptIds(encOptIds);
        const models = getImportStagingModelsForAssignment();
        const mid = String(modelId || '').trim();
        if (!mid || !optIds.length) return;

        let anyAssigned = false;
        optIds.forEach((oid) => {
            const opt = findImportStagingOptionById(oid);
            if (!opt) return;
            const suggested = resolveImportMinorationPosteModelIds(opt, models).map(String);
            const set = new Set((opt.compatibleModels || []).map(String));
            if (checked) {
                if (suggested.length && !suggested.includes(mid)) return;
                set.add(mid);
                anyAssigned = true;
            } else {
                set.delete(mid);
            }
            opt.compatibleModels = Array.from(set);
        });

        if (checked && !anyAssigned) {
            const opt = findImportStagingOptionById(optIds[0]);
            if (opt) {
                const set = new Set((opt.compatibleModels || []).map(String));
                set.add(mid);
                opt.compatibleModels = Array.from(set);
            }
        }

        syncImportMinorationRecapDock();
        refreshImportMinorationAssignPricesDom();
    }

    function renderImportGroupedAdjPricesBlockHtml(group, models, priceKind) {
        const modelList = Array.isArray(models) ? models : getImportStagingModelsForAssignment();
        const kind = String(priceKind || 'minoration').toLowerCase() === 'majoration' ? 'majoration' : 'minoration';
        if (kind === 'majoration') {
            const mode = getImportAdjDisplayPricingMode(null, group, models);
            return renderImportGroupedMajorationPricesHtml(group, models, mode);
        }
        const mode = getImportAdjDisplayPricingMode(null, group, models);
        return renderImportGroupedMinorationPricesHtml(group, models, mode);
    }

    function renderImportGroupedAdjExcelLabelsHtml(group) {
        const labels = (group.options || []).map((o) => String(o?.name || '').trim()).filter(Boolean);
        const unique = [...new Set(labels)];
        if (unique.length <= 1) {
            return unique[0]
                ? `<div class="ugap-import-mino-label-raw ugap-import-mino-label-raw--multiline"><strong>Excel :</strong> ${escapeHtml(unique[0])}</div>`
                : '';
        }
        const items = unique.map((l) => `<li class="ugap-import-mino-label-raw--multiline">${escapeHtml(l)}</li>`).join('');
        return `<details class="ugap-bp-linked-minos-details" style="margin-top:6px;">
            <summary class="ugap-import-mino-hint">${unique.length} lib. Excel</summary>
            <ul class="ugap-bp-linked-minos-list">${items}</ul>
        </details>`;
    }

    function renderImportGroupedAdjRowDetail(group, models, priceKind) {
        const sample = (group.options || [])[0];
        const links = sample ? resolveImportMinorationOptionLinks(sample, models) : null;
        const label = String(group.label || '').trim()
            || (sample ? getImportAdjOptionFusionLabel(sample, models) : '');
        const encOptIdsAttr = escapeHtml(encodeImportAdjGroupOptIds(group.options));
        const motorCls = links?.changeType === 'motor' ? ' ugap-import-mino-motor' : '';
        const sourceHint = links?.sourceHint
            ? `<div class="ugap-import-mino-hint"><strong>Source moteur :</strong> ${escapeHtml(links.sourceHint)}</div>`
            : '';
        const bp = ensureImportBaseProductForAdj(sample, group, models);
        const inputHtml = renderImportAdjOptionNameInputHtml(
            label,
            `data-mino-field="importOptionLabelGroup" data-adj-group-opts="${encOptIdsAttr}"`,
            motorCls
        );
        return `${sourceHint}
        ${renderImportAdjOptionNameTypeRowHtml(inputHtml, bp, models, '', sample, group)}
        ${renderImportMinorationPricesBlockHtml(null, group, models, priceKind)}
        ${renderImportGroupedAdjExcelLabelsHtml(group)}
        ${priceKind === 'majoration' ? renderImportDetachFromBaseProductButton(group.options) : ''}`;
    }

    function renderImportAdjGroupPostesGrid(group, models, posteGridCols) {
        const assigned = getImportAdjGroupAssignedModelIds(group);
        const optIdsEnc = escapeHtml(encodeImportAdjGroupOptIds(group.options));
        const cells = models.map((m) => {
            const mid = String(m.id || '').trim();
            const checked = assigned.includes(mid);
            const suggested = (group.options || []).some((opt) => isMinorationCheckboxSuggested(opt, m));
            const sugCls = suggested ? 'ugap-import-mino-cb-suggested' : '';
            const pn = m?.posteNumber != null && m?.posteNumber !== '' ? `P${m.posteNumber}` : '—';
            return `<label class="ugap-import-mino-poste-cell" title="${escapeHtml(String(m.name || m.id || ''))}">
                <input type="checkbox" class="${sugCls}" data-adj-group-opts="${optIdsEnc}"
                    data-mino-model="${encodeURIComponent(mid)}" ${checked ? 'checked' : ''}>
                <span>${escapeHtml(String(pn))}</span>
            </label>`;
        }).join('');
        return `<div class="ugap-import-mino-postes-grid" style="--mino-cols:${posteGridCols}">${cells}</div>`;
    }

    function renderImportAssignSingleRowHtml(opt, models, priceKind, posteGridCols) {
        const optId = String(opt.id || '').trim();
        const encodedId = encodeURIComponent(optId);
        const links = resolveImportMinorationOptionLinks(opt, models);
        const assigned = Array.isArray(opt.compatibleModels) ? opt.compatibleModels.map(String) : [];
        const formatPosteColLabel = (m) => {
            const pn = m?.posteNumber;
            return pn != null && pn !== '' ? `P${pn}` : '—';
        };
        const renderPosteCheckbox = (o, encId, m, assign) => {
            const mid = String(m.id || '').trim();
            const checked = assign.includes(mid);
            const suggested = isMinorationCheckboxSuggested(o, m);
            const sugCls = suggested ? 'ugap-import-mino-cb-suggested' : '';
            const pn = formatPosteColLabel(m);
            return `<label class="ugap-import-mino-poste-cell" title="${escapeHtml(String(m.name || m.id || ''))}">
                <input type="checkbox" class="${sugCls}" data-mino-opt="${encId}" data-mino-model="${encodeURIComponent(mid)}"
                    ${checked ? 'checked' : ''}
                    onchange="toggleImportMinorationModelAssignment(decodeURIComponent('${encId}'), decodeURIComponent('${encodeURIComponent(mid)}'), this.checked)">
                <span>${escapeHtml(pn)}</span>
            </label>`;
        };
        const postesGrid = models.length
            ? `<div class="ugap-import-mino-postes-grid" style="--mino-cols:${posteGridCols}">${models.map((m) => renderPosteCheckbox(opt, encodedId, m, assigned)).join('')}</div>`
            : '—';
        return `<tr>
            <td class="ugap-import-mino-sticky-detail">${renderImportMinorationRowDetail(links, opt, models, priceKind)}</td>
            <td class="ugap-import-mino-poste-col ugap-import-mino-postes-cell">${postesGrid}</td>
        </tr>`;
    }


    function renderImportMinorationRowDetail(links, opt, models, priceKind) {
        if (!links) return '—';
        const motorCls = links.changeType === 'motor' ? ' ugap-import-mino-motor' : '';
        const raw = escapeHtml(String(opt?.name || ''));
        const modelList = Array.isArray(models) ? models : getImportStagingModelsForAssignment();
        const displayLabel = getImportMinorationDisplayLabel(opt, links);
        const encOptId = escapeHtml(String(opt?.id || '').trim());
        const sourceHint = links.sourceHint
            ? `<div class="ugap-import-mino-hint"><strong>Source moteur :</strong> ${escapeHtml(links.sourceHint)}</div>`
            : '';
        const bp = ensureImportBaseProductForAdj(opt, null, modelList);
        const inputHtml = renderImportAdjOptionNameInputHtml(
            displayLabel,
            `data-mino-opt-id="${encOptId}" data-mino-field="importOptionLabel"`,
            motorCls
        );
        return `${sourceHint}
            ${renderImportAdjOptionNameTypeRowHtml(inputHtml, bp, modelList, '', opt, null)}
            ${renderImportMinorationPricesBlockHtml(opt, null, modelList, priceKind)}
            <div class="ugap-import-mino-label-raw ugap-import-mino-label-raw--multiline"><strong>Excel :</strong> ${raw}</div>
            ${priceKind === 'majoration' ? renderImportDetachFromBaseProductButton(opt) : ''}`;
    }

    function renderImportMinorationRegistrySummary(registry, models) {
        if (!registry || !registry.size) {
            return '';
        }
        const allModels = Array.isArray(models) ? models : getImportStagingModelsForAssignment();
        const posteFilter = getImportPosteFilterValue();
        const modelList = filterImportModelsByPosteFilter(allModels, posteFilter);
        let products = getImportBaseProductsStore();
        if (!products.length) {
            products = syncImportBaseProductsFromAdjRows({ force: true, skipLabelRefresh: true });
        }
        if (posteFilter) {
            products = products.filter((bp) => importBaseProductMatchesPosteFilter(bp, posteFilter, allModels));
        }
        if (!products.length) {
            const hint = posteFilter
                ? `Aucune option de base pour le poste P${escapeHtml(posteFilter)}.`
                : 'Aucune option de base à afficher.';
            return `<p class="ugap-import-mino-hint" style="display:block;margin-top:8px;">${hint}</p>`;
        }

        const modelById = new Map(allModels.map((m) => [String(m?.id || '').trim(), m]));
        const posteGridCols = getImportPosteGridCols(modelList.length);
        const headerPostes = modelList.length
            ? '<th class="ugap-import-mino-poste-col ugap-import-mino-poste-group">Poste</th>'
            : '';

        const rows = products.map((bp) => `<tr>
            <td class="ugap-import-mino-sticky-detail">${renderImportBaseProductDetailCell(bp, modelById, products)}</td>
            <td class="ugap-import-mino-poste-col ugap-import-mino-postes-cell">${renderImportBaseProductPostesGrid(bp, modelList, posteGridCols)}</td>
        </tr>`).join('');

        return `<div class="ugap-import-mino-registry">
            <strong>Options de base</strong>
            <div class="ugap-import-mino-hint" style="display:block;margin-top:4px;">
                <strong>Double-cliquez</strong> sur le nom pour le modifier (modale).
                Type de prix et montants dans la colonne Détail — cochez les postes concernés, puis enregistrez.
            </div>
            <div class="ugap-import-mino-registry-stack">
                <div class="ugap-import-mino-table-scroll ugap-import-bp-table-wrap">
                    <table class="ugap-import-mino-table">
                        <thead>
                            <tr>
                                <th class="ugap-import-mino-sticky-detail">Détail</th>
                                ${headerPostes}
                            </tr>
                        </thead>
                        <tbody>${rows}</tbody>
                    </table>
                </div>
            </div>
        </div>`;
    }

    function isImportMinorationsStepValidated(stagingDoc) {
        return String(stagingDoc?.minorationsStatus || '').toLowerCase() === 'validated';
    }

    function isImportMajorationsStepValidated(stagingDoc) {
        return String(stagingDoc?.majorationsStatus || '').toLowerCase() === 'validated';
    }

    /** Minorations + majorations enregistrées — requis avant l’étape options de base. */
    function canOpenImportBaseOptionsStep(stagingDoc) {
        return isImportMinorationsStepValidated(stagingDoc) && isImportMajorationsStepValidated(stagingDoc);
    }

    function isImportBaseOptionsStepDone(stagingDoc) {
        const status = String(stagingDoc?.baseOptionsStatus || '').toLowerCase();
        if (status === 'validated') return true;
        if (!stagingDoc?.baseOptionsStatus
            && Array.isArray(stagingDoc?.importBaseProducts)
            && stagingDoc.importBaseProducts.length > 0) {
            return true;
        }
        return false;
    }



    function buildImportMinorationRecapHtml(models, minos) {
        const byPoste = new Map();
        models.forEach((m) => {
            const pn = m?.posteNumber;
            if (pn == null || pn === '') return;
            const key = String(pn);
            if (!byPoste.has(key)) byPoste.set(key, []);
            byPoste.get(key).push(m);
        });

        const posteKeys = [...byPoste.keys()].sort((a, b) => Number(a) - Number(b));
        if (!posteKeys.length) {
            return '<p style="margin:0;color:#64748b;">Validez des modèles avec n° de poste pour le rappel.</p>';
        }

        const blocks = posteKeys.map((pk) => {
            const ms = byPoste.get(pk) || [];
            const assignedCount = minos.filter((opt) => {
                const cm = Array.isArray(opt.compatibleModels) ? opt.compatibleModels : [];
                return ms.some((m) => cm.map(String).includes(String(m.id)));
            }).length;
            const modelLines = ms.map((m) => {
                const checked = minos.filter((o) => {
                    const cm = Array.isArray(o.compatibleModels) ? o.compatibleModels : [];
                    return cm.map(String).includes(String(m.id));
                }).length;
                return `<li style="margin:0 0 4px 16px;">${escapeHtml(String(m.name || m.id))} <span style="color:#64748b;">(${checked} mino)</span></li>`;
            }).join('');
            return `<div style="margin-bottom:12px;">
                <strong class="ugap-mino-recap-poste-title">Poste ${escapeHtml(pk)}</strong>
                <div style="font-size:12px;color:#64748b;margin-bottom:4px;">${assignedCount} minoration(s) liée(s) à ce poste</div>
                <ul style="margin:0;padding:0;list-style:disc;">${modelLines}</ul>
            </div>`;
        }).join('');

        return blocks;
    }

    function postImportMinorationRecapToParent(payload) {
        if (window.UgapGdriHost && typeof window.UgapGdriHost.updateImportMinorationRecap === 'function') {
            window.UgapGdriHost.updateImportMinorationRecap(payload);
            return;
        }
        if (typeof isEmbeddedMode !== 'function' || !isEmbeddedMode()) return;
        try {
            if (window.parent && window.parent !== window) {
                window.parent.postMessage(payload, window.location.origin);
            }
        } catch (_e) { /* ignore */ }
    }

    function getImportActionsDockConfig() {
        if (String(window.importViewMode || 'list') !== 'editor') return null;
        const step = String(wfState()?.step || '');
        const byStep = {
            minorations: {
                saveHandler: 'saveImportMinorationsStep',
                saveLabel: 'Enregistrer assignations',
                nextStep: 'majorations',
                nextLabel: 'Étape suivante → Majorations'
            },
            majorations: {
                saveHandler: 'saveImportMajorationsStep',
                saveLabel: 'Enregistrer assignations',
                nextStep: 'import-base-options',
                nextLabel: 'Étape suivante → Options de base'
            },
            'import-base-options': {
                saveHandler: 'saveImportBaseOptionsStep',
                saveLabel: 'Enregistrer options de base',
                nextStep: 'families-tri',
                nextLabel: 'Étape suivante → Options'
            },
            'families-tri': {
                saveHandler: 'saveImportOptionsTriStep',
                saveLabel: 'Enregistrer',
                nextStep: 'families-unmatched',
                nextLabel: 'Étape suivante → PR'
            }
        };
        return byStep[step] || null;
    }

    function syncImportActionsDock() {
        bindImportWorkflowActionsBar();
        const cfg = getImportActionsDockConfig();
        const bar = document.getElementById('ugap-import-workflow-actions');
        if (!bar) return;
        if (!cfg) {
            bar.hidden = true;
            bar.innerHTML = '';
        } else {
            bar.hidden = false;
            bar.innerHTML = buildImportWorkflowActionsHtml(cfg);
        }
    }

    function bindImportActionsDockInvokeListener() {
        if (window.__ugapImportActionsDockInvokeBound) return;
        window.__ugapImportActionsDockInvokeBound = true;
        window.addEventListener('message', (event) => {
            if (event.origin !== window.location.origin) return;
            const data = event.data;
            if (!data || !data.type) return;
            if (data.type !== 'ugap-import-actions-invoke') return;
            const cfg = getImportActionsDockConfig();
            if (!cfg) return;
            if (data.action === 'save') {
                const fn = window[cfg.saveHandler];
                if (typeof fn === 'function') fn();
            } else if (data.action === 'next' && cfg.nextStep) {
                switchImportWorkflowStep(cfg.nextStep);
                if (typeof renderImportWorkflow === 'function') renderImportWorkflow();
            }
        });
    }

    function syncImportMinorationRecapDock() {
        if (typeof isEmbeddedMode !== 'function' || !isEmbeddedMode()) return;
        if (String(window.importViewMode || 'list') !== 'editor') {
            postImportMinorationRecapToParent({ type: 'ugap-import-mino-recap', visible: false });
            return;
        }
        const step = String(wfState()?.step || '');
        const showRecap = step === 'import-base-options' || step === 'minorations' || step === 'majorations';
        if (!showRecap) {
            postImportMinorationRecapToParent({ type: 'ugap-import-mino-recap', visible: false });
            return;
        }
        const models = getImportStagingModelsForAssignment();
        const filterFn = step === 'majorations' ? isImportMajorationOption : isImportMinorationOption;
        const minos = getImportStagingOptionsFlat().filter(filterFn);
        const body = buildImportMinorationRecapHtml(models, minos);
        const hintMap = {
            'import-base-options': 'Croix = postes concernés par l\'option de base.',
            minorations: 'Croix = postes concernés par la minoration.',
            majorations: 'Croix = postes concernés par la majoration.'
        };
        const hint = hintMap[step] || hintMap.minorations;
        const html = `<div class="ugap-mino-recap-head"><strong>Postes et modèles</strong><div class="ugap-import-mino-hint" style="display:block;margin-top:4px;">${hint}</div></div>
            <div class="ugap-mino-recap-body">${body}</div>`;
        postImportMinorationRecapToParent({ type: 'ugap-import-mino-recap', visible: true, html });
    }

    function importAdjRowsNeverPosteSeeded(filterFn) {
        const rows = getImportStagingOptionsFlat().filter(filterFn);
        if (!rows.length) return false;
        return !rows.some((opt) => (Array.isArray(opt?.compatibleModels) ? opt.compatibleModels : []).length > 0);
    }

    function maybeAutoSeedImportMajorationPostes() {
        const models = getImportStagingModelsForAssignment();
        const rows = getImportStagingOptionsFlat().filter(isImportMajorationOption);
        if (!models.length || !rows.length) return 0;
        if (wfState()?.majorationAutoSeeded && !importAdjRowsNeverPosteSeeded(isImportMajorationOption)) return 0;
        const n = seedImportMajorationPosteAssignments();
        wfState().majorationAutoSeeded = true;
        return n;
    }

    function resolveImportWorkflowResumeStep(staging) {
        const models = Array.isArray(staging?.models) ? staging.models : [];
        const total = models.length;
        const validated = Number(staging?.progress?.validatedModelIds?.length || 0);
        const allModelsValidated = total > 0 && validated >= total;
        const minoStatus = String(staging?.minorationsStatus || '').toLowerCase();
        const majStatus = String(staging?.majorationsStatus || '').toLowerCase();

        if (!allModelsValidated) return 'models';
        if (minoStatus !== 'validated') return 'minorations';
        if (majStatus !== 'validated') return 'majorations';
        if (!isImportBaseOptionsStepDone(staging)) return 'import-base-options';
        if (String(staging?.progress?.optionsCompleted || '') === 'true' || staging?.progress?.optionsCompleted === true) {
            return 'validate';
        }
        return 'families-tri';
    }

    function renderImportBaseOptionsStepHtml() {
        ensureImportMinoStyles();
        const st = staging();
        const models = getImportStagingModelsForAssignment();
        const adjRows = getImportRowsForBaseProductRegistry();
        const minoCount = adjRows.filter(isImportMinorationOption).length;
        const majCount = adjRows.filter(isImportMajorationOption).length;

        if (!models.length) {
            return `<div class="ugap-import-mino-wrap">
                <p style="color:#b45309;">Validez d'abord les modèles (étape 1) avant de configurer les options de base.</p>
            </div>`;
        }

        if (!canOpenImportBaseOptionsStep(st)) {
            const needMino = !isImportMinorationsStepValidated(st);
            const needMaj = !isImportMajorationsStepValidated(st);
            const parts = [];
            if (needMino) parts.push('minorations (étape 2)');
            if (needMaj) parts.push('majorations (étape 3)');
            return `<div class="ugap-import-mino-wrap">
                <p style="color:#b45309;">Enregistrez d'abord les ${escapeHtml(parts.join(' et '))} avant les options de base.</p>
                <p style="color:#6b7280;margin-top:8px;">Règles mino/majo : voir <code>docs/onglet-import/REGLES-MINO-MAJO.md</code>.</p>
            </div>`;
        }

        const savedCount = syncImportBaseProductsFromAdjRows({ skipLabelRefresh: true }).length;

        if (!savedCount) {
            return `<div class="ugap-import-mino-wrap">
                <div class="ugap-import-mino-summary">
                    <strong>Étape 4 — Options de base</strong> — Aucune ligne pour l'instant.
                </div>
                <p style="color:#6b7280;">Enregistrez d'abord les minorations et majorations (étapes 2–3).
                    Chaque ligne ci-dessous sera publiée <strong>telle quelle</strong> dans le catalogue (nom, libellé Excel, prix, postes) en <code>opt_ibp_*</code>.
                    Les mino/majo restent des options classiques séparées.</p>
            </div>`;
        }

        const posteFilter = getImportPosteFilterValue();
        const posteFilterHtml = renderImportPosteFilterHtml(models);
        const posteFilterNote = posteFilter
            ? ` <span style="color:#64748b;">(filtre poste P${escapeHtml(posteFilter)})</span>`
            : '';
        const registryHtml = renderImportMinorationRegistrySummary(null, models);

        return `<div class="ugap-import-mino-wrap">
            <div class="ugap-import-mino-summary">
                <strong>Étape 4 — Options de base</strong> — ${savedCount} option(s) de base, ${models.length} modèle(s) validé(s).${posteFilterNote}
                <span style="color:#64748b;"> (${minoCount} mino, ${majCount} majo — motorisations modèles incluses)</span>
            </div>
            <div class="ugap-import-mino-toolbar" style="margin-bottom:10px;">
                ${posteFilterHtml}
            </div>
            ${registryHtml}
        </div>`;
    }

    function renderImportAssignStepHtml(config) {
        const {
            stepTitle,
            filterFn,
            emptyModelsMsg,
            emptyRowsMsg,
            nextStep,
            nextLabel,
            seedHandlerName,
            saveHandlerName,
            priceKind = 'minoration',
            hideSuppressions = false,
            autoSeedFn,
            extraToolbarHtml = '',
            groupByFusionLabel = false
        } = config;

        ensureImportMinoStyles();
        if (typeof autoSeedFn === 'function') autoSeedFn();
        const allModels = getImportStagingModelsForAssignment();
        const posteFilter = getImportPosteFilterValue();
        const models = filterImportModelsByPosteFilter(allModels, posteFilter);
        const rows = getImportStagingOptionsFlat().filter(filterFn);

        if (!allModels.length) {
            return `<div class="ugap-import-mino-wrap"><p style="color:#b45309;">${escapeHtml(emptyModelsMsg)}</p></div>`;
        }

        if (posteFilter && !models.length) {
            return `<div class="ugap-import-mino-wrap">
                <p style="color:#b45309;">Aucun modèle validé pour le poste P${escapeHtml(posteFilter)}.</p>
                <div class="ugap-import-mino-toolbar" style="margin-top:12px;">${renderImportPosteFilterHtml(allModels)}</div>
            </div>`;
        }

        if (!rows.length) {
            return `<div class="ugap-import-mino-wrap">
                <p style="color:#6b7280;">${escapeHtml(emptyRowsMsg)}</p>
                <div class="ugap-import-mino-toolbar" style="margin-top:12px;">
                    <button type="button" class="btn btn-outline" onclick="switchImportWorkflowStep('${escapeHtml(nextStep)}'); renderImportWorkflow();">${escapeHtml(nextLabel)}</button>
                </div>
            </div>`;
        }

        let rowsForAssignTable = hideSuppressions
            ? rows.filter((opt) => !isImportSuppressionMinoration(opt, allModels))
            : rows.slice();
        const hiddenSuppressionCount = hideSuppressions ? rows.length - rowsForAssignTable.length : 0;

        let displayGroups = groupByFusionLabel
            ? buildImportAdjDisplayGroups(rowsForAssignTable, allModels)
            : null;
        if (posteFilter) {
            if (displayGroups) {
                displayGroups = displayGroups.filter((g) => importAdjGroupMatchesPosteFilter(g, posteFilter, allModels));
            } else {
                rowsForAssignTable = rowsForAssignTable.filter((opt) => importOptionMatchesPosteFilter(opt, posteFilter, allModels));
            }
        }

        const posteGridCols = Math.max(1, Math.ceil(models.length / 2));
        const headerPostes = models.length
            ? '<th class="ugap-import-mino-poste-col ugap-import-mino-poste-group">Poste</th>'
            : '';

        const emptyTableMsg = posteFilter
            ? `Aucune ligne pour le poste P${escapeHtml(posteFilter)}.`
            : (priceKind === 'majoration'
                ? 'Aucune majoration à assigner ici.'
                : 'Aucune minoration à assigner ici.');

        const displayRowCount = displayGroups ? displayGroups.length : rowsForAssignTable.length;
        const posteFilterHtml = renderImportPosteFilterHtml(allModels);
        const posteFilterNote = posteFilter
            ? ` <span style="color:#64748b;">(filtre poste P${escapeHtml(posteFilter)})</span>`
            : '';
        const groupHint = groupByFusionLabel && displayGroups && rowsForAssignTable.length > displayRowCount
            ? ` <span style="color:#64748b;">(${rowsForAssignTable.length} lignes → ${displayRowCount} options)</span>`
            : '';

        let rowsHtml;
        if (displayGroups) {
            rowsHtml = displayGroups.length
                ? displayGroups.map((group) => {
                    if (!group.grouped) {
                        return renderImportAssignSingleRowHtml(group.options[0], models, priceKind, posteGridCols);
                    }
                    return `<tr>
                        <td class="ugap-import-mino-sticky-detail">${renderImportGroupedAdjRowDetail(group, models, priceKind)}</td>
                        <td class="ugap-import-mino-poste-col ugap-import-mino-postes-cell">${renderImportAdjGroupPostesGrid(group, models, posteGridCols)}</td>
                    </tr>`;
                }).join('')
                : `<tr><td colspan="2" style="padding:12px;color:#64748b;">${emptyTableMsg}</td></tr>`;
        } else {
            rowsHtml = rowsForAssignTable.length
                ? rowsForAssignTable.map((opt) => renderImportAssignSingleRowHtml(opt, models, priceKind, posteGridCols)).join('')
                : `<tr><td colspan="2" style="padding:12px;color:#64748b;">${emptyTableMsg}</td></tr>`;
        }

        const suppressionHint = hideSuppressions && hiddenSuppressionCount
            ? ` <span style="color:#64748b;">(${hiddenSuppressionCount} suppression(s) masquée(s) — voir Options de base)</span>`
            : '';

        return `<div class="ugap-import-mino-wrap">
            <div class="ugap-import-mino-summary">
                <strong>${escapeHtml(stepTitle)}</strong> — ${displayRowCount} ligne(s) à assigner, ${models.length} modèle(s) validé(s).${posteFilterNote}${groupHint}${suppressionHint}
            </div>
            <div class="ugap-import-mino-toolbar">
                ${posteFilterHtml}
                ${extraToolbarHtml}
                <button type="button" class="btn btn-outline" onclick="${seedHandlerName}()">Pré-cocher les postes (libellé / croix)</button>
            </div>
            <div class="ugap-import-mino-registry ugap-import-mino-registry-stack">
                <div class="ugap-import-mino-table-scroll ugap-import-mino-assign-table-wrap">
                    <table class="ugap-import-mino-table">
                        <thead>
                            <tr>
                                <th class="ugap-import-mino-sticky-detail">Détail</th>
                                ${headerPostes}
                            </tr>
                        </thead>
                        <tbody>${rowsHtml}</tbody>
                    </table>
                </div>
            </div>
        </div>`;
    }

    /* renderImportMinorationsStepHtml → import-minorations-step.js */

    function renderImportMajorationsStepHtml() {
        return renderImportAssignStepHtml({
            stepTitle: 'Étape 3 — Majorations',
            filterFn: isImportMajorationOption,
            emptyModelsMsg: 'Validez d\'abord les modèles (étape 1) avant d\'assigner les majorations.',
            emptyRowsMsg: 'Aucune majoration détectée (remplacement, motorisation catalogue, 150 CV, DF…). Les PR, MINO et forfaits/garanties sont exclus. Voir REGLES-MINO-MAJO.md.',
            nextStep: 'import-base-options',
            nextLabel: 'Étape suivante → Options de base',
            seedHandlerName: 'runSeedImportMajorationPostes',
            saveHandlerName: 'saveImportMajorationsStep',
            priceKind: 'majoration',
            hideSuppressions: true,
            groupByFusionLabel: true,
            autoSeedFn: maybeAutoSeedImportMajorationPostes
        });
    }

    const IMPORT_OPTIONS_TRI_POSTE_MAX = 10;

    function getImportOptionsTriDisplayLabel(opt, models) {
        const kind = getImportResolvedLineKind(opt);
        if (kind === 'minoration' || kind === 'majoration') {
            return getImportAdjOptionFusionLabel(opt, models);
        }
        const custom = String(opt?.importOptionLabel || '').trim();
        if (custom) return custom;
        return String(opt?.name || opt?.id || '').trim();
    }

    function onImportOptionsTriTypeChange(optionId, newType) {
        const id = String(optionId || '').trim();
        const kind = String(newType || '').trim().toLowerCase();
        const opt = findImportStagingOptionById(id);
        if (!opt) return;
        if (kind !== 'minoration' && kind !== 'majoration' && kind !== 'option') return;
        opt.importOptionLineKind = kind;
        if (kind === 'minoration') {
            opt.isMinoration = true;
            opt.manualMinorationAssignment = true;
            delete opt.manualMajorationAssignment;
        } else if (kind === 'majoration') {
            opt.isMinoration = false;
            opt.manualMajorationAssignment = true;
            delete opt.manualMinorationAssignment;
        } else {
            opt.isMinoration = false;
            delete opt.manualMajorationAssignment;
            delete opt.manualMinorationAssignment;
        }
    }

    function getImportOptionsTriRowKindClass(kind) {
        if (kind === 'minoration') return 'ugap-import-opt-tri-row--mino';
        if (kind === 'majoration') return 'ugap-import-opt-tri-row--majo';
        return 'ugap-import-opt-tri-row--opt';
    }

    function getImportOptionsTriTypeSelectClass(kind) {
        if (kind === 'minoration') return 'kind-minoration';
        if (kind === 'majoration') return 'kind-majoration';
        return 'kind-option';
    }

    function renderImportOptionsTriTypeSelectHtml(opt) {
        const current = getImportResolvedLineKind(opt);
        const encodedId = encodeURIComponent(String(opt?.id || '').trim());
        const selectCls = getImportOptionsTriTypeSelectClass(current);
        const mk = (val, label) => {
            const sel = current === val ? ' selected' : '';
            return `<option value="${val}"${sel}>${escapeHtml(label)}</option>`;
        };
        return `<select class="ugap-import-opt-tri-type-select ${selectCls}"
            onchange="onImportOptionsTriTypeChange(decodeURIComponent('${encodedId}'), this.value); renderImportWorkflow();">
            ${mk('option', 'Option')}
            ${mk('minoration', 'Minoration')}
            ${mk('majoration', 'Majoration')}
        </select>`;
    }

    function buildImportOptionsTriPosteSlots(models) {
        const list = Array.isArray(models) ? models : getImportStagingModelsForAssignment();
        const slots = [];
        for (let pn = 1; pn <= IMPORT_OPTIONS_TRI_POSTE_MAX; pn += 1) {
            const model = list.find((m) => Number(m?.posteNumber) === pn) || null;
            const modelId = model ? String(model.id || '').trim() : '';
            slots.push({ poste: pn, model, modelId });
        }
        return slots;
    }

    function renderImportOptionsTriPostesGridHtml(opt, posteSlots, posteGridCols) {
        const assigned = new Set(
            (Array.isArray(opt?.compatibleModels) ? opt.compatibleModels : [])
                .map((x) => String(x || '').trim())
                .filter(Boolean)
        );
        const encodedOptId = encodeURIComponent(String(opt?.id || '').trim());
        const cells = posteSlots.map((slot) => {
            const pn = `P${slot.poste}`;
            if (!slot.modelId) {
                return `<label class="ugap-import-mino-poste-cell ugap-import-opt-tri-poste-missing" title="Poste ${slot.poste} — aucun modèle validé">
                    <input type="checkbox" disabled>
                    <span>${escapeHtml(pn)}</span>
                </label>`;
            }
            const encodedMid = encodeURIComponent(slot.modelId);
            const checked = assigned.has(slot.modelId);
            const suggested = slot.model && isMinorationCheckboxSuggested(opt, slot.model);
            const sugCls = suggested ? ' ugap-import-mino-cb-suggested' : '';
            return `<label class="ugap-import-mino-poste-cell" title="${escapeHtml(String(slot.model?.name || slot.modelId))}">
                <input type="checkbox" class="ugap-import-opt-tri-poste-cb${sugCls}"
                    data-opt-tri-id="${encodedOptId}"
                    data-opt-tri-model="${encodedMid}"
                    ${checked ? 'checked' : ''}>
                <span>${escapeHtml(pn)}</span>
            </label>`;
        }).join('');
        return `<td class="ugap-import-mino-poste-col ugap-import-mino-postes-cell">
            <div class="ugap-import-mino-postes-grid" style="--mino-cols:${posteGridCols}">${cells}</div>
        </td>`;
    }

    function getImportOptionsTriRows(models) {
        const modelList = Array.isArray(models) ? models : getImportStagingModelsForAssignment();
        const posteFilter = getImportPosteFilterValue();
        let rows = getImportStagingOptionsFlat().filter(isImportTriEligibleOption);
        if (posteFilter) {
            rows = rows.filter((opt) => importOptionMatchesPosteFilter(opt, posteFilter, modelList));
        }
        const kindOrder = { option: 0, minoration: 1, majoration: 2 };
        rows.sort((a, b) => {
            const ka = getImportResolvedLineKind(a);
            const kb = getImportResolvedLineKind(b);
            const oa = kindOrder[ka] ?? 9;
            const ob = kindOrder[kb] ?? 9;
            if (oa !== ob) return oa - ob;
            const la = getImportOptionsTriDisplayLabel(a, modelList).toLowerCase();
            const lb = getImportOptionsTriDisplayLabel(b, modelList).toLowerCase();
            if (la !== lb) return la.localeCompare(lb, 'fr', { sensitivity: 'base' });
            return String(a?.name || '').localeCompare(String(b?.name || ''), 'fr', { sensitivity: 'base' });
        });
        return rows;
    }

    function renderImportOptionsSortStepHtml() {
        ensureImportMinoStyles();
        const allModels = getImportStagingModelsForAssignment();
        if (!allModels.length) {
            return `<div class="ugap-import-mino-wrap"><p style="color:#b45309;">Validez d'abord les modèles (étape 1) avant l'étape Options.</p></div>`;
        }

        const posteFilter = getImportPosteFilterValue();
        const rows = getImportOptionsTriRows(allModels);
        const posteSlots = buildImportOptionsTriPosteSlots(allModels);
        const posteGridCols = getImportPosteGridCols(IMPORT_OPTIONS_TRI_POSTE_MAX);
        const posteFilterHtml = renderImportPosteFilterHtml(allModels);
        const posteFilterNote = posteFilter
            ? ` <span style="color:#64748b;">(filtre poste P${escapeHtml(posteFilter)})</span>`
            : '';

        const tableRows = rows.length
            ? rows.map((opt) => {
                const displayLabel = getImportOptionsTriDisplayLabel(opt, allModels);
                const typeSelect = renderImportOptionsTriTypeSelectHtml(opt);
                const rawName = String(opt?.name || '').trim();
                const kind = getImportResolvedLineKind(opt);
                const rowCls = getImportOptionsTriRowKindClass(kind);
                return `<tr class="${rowCls}">
                    <td class="ugap-import-opt-tri-type-col">${typeSelect}</td>
                    <td class="ugap-import-opt-tri-label-col" title="${escapeHtml(displayLabel)}">
                        <div class="ugap-import-opt-tri-label-main">${escapeHtml(displayLabel)}</div>
                        ${rawName && rawName !== displayLabel
                            ? `<div class="ugap-import-mino-label-raw" style="margin-top:4px;"><strong>Excel :</strong> ${escapeHtml(rawName)}</div>`
                            : ''}
                    </td>
                    ${renderImportOptionsTriPostesGridHtml(opt, posteSlots, posteGridCols)}
                </tr>`;
            }).join('')
            : `<tr><td colspan="3" style="padding:12px;color:#64748b;">Aucune ligne pour ce filtre (hors PR).</td></tr>`;

        return `<div class="ugap-import-mino-wrap">
            <div class="ugap-import-mino-summary">
                <strong>Étape 5 — Options</strong> — ${rows.length} ligne(s) (options catalogue, minorations et majorations ; PR exclues).${posteFilterNote}
            </div>
            <div class="ugap-import-opt-tri-legend">
                <span class="ugap-import-opt-tri-legend-item ugap-import-opt-tri-legend-item--opt">Option</span>
                <span class="ugap-import-opt-tri-legend-item ugap-import-opt-tri-legend-item--mino">Minoration</span>
                <span class="ugap-import-opt-tri-legend-item ugap-import-opt-tri-legend-item--majo">Majoration</span>
            </div>
            <div class="ugap-import-mino-hint" style="display:block;margin-bottom:10px;">
                Choisissez le <strong>type</strong> de chaque ligne, cochez les postes <strong>P1 à P10</strong> concernés, puis enregistrez.
                Les familles catalogue seront traitées ultérieurement.
            </div>
            <div class="ugap-import-mino-toolbar" style="margin-bottom:10px;">
                ${posteFilterHtml}
                <button type="button" class="btn btn-outline" onclick="runSeedImportOptionsTriPostes()">Pré-cocher les postes (libellé / croix)</button>
            </div>
            <div class="ugap-import-mino-registry ugap-import-mino-registry-stack">
                <div class="ugap-import-opt-tri-table-wrap">
                    <table class="ugap-import-mino-table ugap-import-opt-tri-table">
                        <thead>
                            <tr>
                                <th class="ugap-import-opt-tri-type-col">Type</th>
                                <th class="ugap-import-opt-tri-label-col">Libellé</th>
                                <th class="ugap-import-mino-poste-col ugap-import-mino-poste-group">Poste</th>
                            </tr>
                        </thead>
                        <tbody>${tableRows}</tbody>
                    </table>
                </div>
            </div>
        </div>`;
    }

    function bindImportOptionsTriEditor() {
        const wrap = document.querySelector('.ugap-import-opt-tri-table-wrap');
        if (!wrap || wrap.dataset.bound === '1') return;
        wrap.dataset.bound = '1';
        wrap.addEventListener('change', (e) => {
            const el = e.target;
            if (!el?.classList?.contains('ugap-import-opt-tri-poste-cb')) return;
            const encOptId = el.getAttribute('data-opt-tri-id');
            const encModelId = el.getAttribute('data-opt-tri-model');
            if (!encOptId || !encModelId) return;
            let optId = encOptId;
            let modelId = encModelId;
            try { optId = decodeURIComponent(encOptId); } catch (_e) { /* ignore */ }
            try { modelId = decodeURIComponent(encModelId); } catch (_e) { /* ignore */ }
            toggleImportMinorationModelAssignment(optId, modelId, el.checked);
        });
    }

    function scheduleImportOptionsTriEmbedResize() {
        if (typeof scheduleParentEmbedResize !== 'function') return;
        scheduleParentEmbedResize();
        [80, 280, 600, 1000, 1500].forEach((ms) => setTimeout(scheduleParentEmbedResize, ms));
    }

    function getImportPrOptionsForStaging() {
        const rows = [];
        getImportStagingOptionsFlat().forEach((opt) => {
            const id = String(opt?.id || '').trim();
            if (!id) return;
            const name = String(opt?.name || id).trim();
            if (!/^PR\s/i.test(name)) return;
            rows.push({
                id,
                name,
                refUgap: String(opt?.refUgap || '').trim()
            });
        });
        return rows;
    }

    function renderImportPrStepHtml() {
        const prOptions = getImportPrOptionsForStaging();
        const body = prOptions.map((opt) => `<tr>
            <td style="padding:6px 8px; border-bottom:1px solid #eee; font-family:monospace;">${escapeHtml(opt.id)}</td>
            <td style="padding:6px 8px; border-bottom:1px solid #eee;">${escapeHtml(opt.name)}</td>
            <td style="padding:6px 8px; border-bottom:1px solid #eee;">${escapeHtml(opt.refUgap || '—')}</td>
        </tr>`).join('');
        return `<div style="margin-bottom:12px; color:#4b5563;">Étape 6 : pièces détachées PR détectées à l'import.</div>
            <div style="border:1px solid #e5e7eb; border-radius:8px; background:#fff;">
                <div style="padding:10px 12px; border-bottom:1px solid #eef2f7; font-weight:600;">Options PR (${prOptions.length})</div>
                <div style="padding:10px 12px;">
                    <table style="width:100%; border-collapse:collapse; font-size:12px;">
                        <thead>
                            <tr style="background:#f8fafc;">
                                <th style="padding:6px 8px; border-bottom:1px solid #eee; text-align:left;">ID</th>
                                <th style="padding:6px 8px; border-bottom:1px solid #eee; text-align:left;">Option PR</th>
                                <th style="padding:6px 8px; border-bottom:1px solid #eee; text-align:left;">Réf UGAP</th>
                            </tr>
                        </thead>
                        <tbody>${body || '<tr><td colspan="3" style="padding:8px; color:#16a34a;">Aucune option PR détectée.</td></tr>'}</tbody>
                    </table>
                </div>
            </div>`;
    }

    // Étape 7 (validation finale) extraite dans `import-validate-step.js`.

    function onImportOptionsStepRendered() {
        bindImportOptionsTriEditor();
        syncImportMinorationRecapDock();
        syncImportActionsDock();
        scheduleImportOptionsTriEmbedResize();
        const triWrap = document.querySelector('.ugap-import-opt-tri-table-wrap');
        if (triWrap && typeof ResizeObserver !== 'undefined') {
            if (triWrap.__ugapOptTriResizeObs) {
                triWrap.__ugapOptTriResizeObs.disconnect();
            }
            triWrap.__ugapOptTriResizeObs = new ResizeObserver(() => {
                if (typeof scheduleParentEmbedResize === 'function') scheduleParentEmbedResize();
            });
            triWrap.__ugapOptTriResizeObs.observe(triWrap);
            const triTable = triWrap.querySelector('.ugap-import-opt-tri-table');
            if (triTable) triWrap.__ugapOptTriResizeObs.observe(triTable);
        }
    }

    async function saveImportOptionsTriStep(opts = {}) {
        const quiet = !!opts.quiet;
        const importId = stagingId();
        if (!staging() || !importId) {
            if (!quiet) showAlert('Aucun import en cours.', 'warning');
            throw new Error('Aucun import en cours.');
        }
        const updates = getImportStagingOptionsFlat()
            .filter((opt) => !opt?.importGeneratedFromBaseProduct)
            .map(mapImportAdjUpdateForSave)
            .filter((row) => row.optionId);

        const result = await apiCall(`/imports/staging/${encodeURIComponent(importId)}/options-tri`, {
            method: 'POST',
            body: JSON.stringify({ updates })
        });
        applyImportStagingApiResult(result, importId);
        if (!quiet) {
            showAlert('Options enregistrées (types et postes).', 'success');
            renderImportStagingIndicator(staging());
            renderImportWorkflow();
        }
        return result?.data;
    }

    function bindImportMinorationAssignEditor() {
        const root = document.querySelector('.ugap-import-mino-assign-table-wrap');
        if (!root || root.dataset.bound === '1') return;
        root.dataset.bound = '1';
        root.addEventListener('input', (e) => {
            const el = e.target;
            const bpId = String(el.getAttribute('data-bp-id') || '').trim();
            const bpField = el.getAttribute('data-bp-field');
            if (bpId && bpField === 'price') {
                const v = el.value === '' ? null : Number(el.value);
                updateImportBaseProductLocal(bpId, { price: Number.isFinite(v) ? v : null });
                refreshImportMinorationAssignPricesDom();
                return;
            }
            const modelId = String(el.getAttribute('data-bp-model-id') || '').trim();
            if (bpId && bpField === 'modelPrice' && modelId) {
                const bp = getImportBaseProductsStore().find((x) => String(x.id) === bpId);
                if (!bp) return;
                if (!bp.pricesByModelId || typeof bp.pricesByModelId !== 'object') bp.pricesByModelId = {};
                const v = el.value === '' ? null : Number(el.value);
                bp.pricesByModelId[modelId] = Number.isFinite(v) ? v : null;
                refreshImportMinorationAssignPricesDom();
                return;
            }
            const field = el.getAttribute('data-mino-field');
            if (field === 'importOptionLabelGroup') {
                const optIds = decodeImportAdjGroupOptIds(el.getAttribute('data-adj-group-opts'));
                const val = String(el.value || '').trim();
                optIds.forEach((oid) => {
                    const opt = findImportStagingOptionById(oid);
                    if (opt) opt.importOptionLabel = val;
                });
                return;
            }
            if (field !== 'importOptionLabel') return;
            const oid = String(el.getAttribute('data-mino-opt-id') || '').trim();
            const opt = findImportStagingOptionById(oid);
            if (!opt) return;
            opt.importOptionLabel = String(el.value || '').trim();
        });
        root.addEventListener('change', (e) => {
            const el = e.target;
            const bpId = el.getAttribute('data-bp-id');
            const bpField = el.getAttribute('data-bp-field');
            if (bpId && bpField === 'pricingMode') {
                const bp = getImportBaseProductsStore().find((x) => String(x.id) === String(bpId));
                if (!bp) return;
                applyImportBaseProductPricingModeChange(bp, el.value);
                renderImportWorkflow();
                return;
            }
            const adjField = el.getAttribute('data-adj-field');
            if (adjField === 'pricingMode') {
                const models = getImportStagingModelsForAssignment();
                const encGroup = el.getAttribute('data-adj-group-opts');
                const optId = String(el.getAttribute('data-mino-opt-id') || '').trim();
                let opt = null;
                let group = null;
                if (encGroup) {
                    const options = decodeImportAdjGroupOptIds(encGroup)
                        .map((id) => findImportStagingOptionById(id))
                        .filter(Boolean);
                    if (options.length) {
                        group = { options };
                        opt = options[0];
                    }
                } else if (optId) {
                    opt = findImportStagingOptionById(optId);
                }
                applyImportAdjPricingModeChange(opt, group, models, el.value);
                refreshImportMinorationAssignPricesDom();
                return;
            }
            if (el.type !== 'checkbox') return;
            const enc = el.getAttribute('data-adj-group-opts');
            if (!enc) return;
            const mid = decodeURIComponent(String(el.getAttribute('data-mino-model') || ''));
            toggleImportAdjGroupModelAssignment(enc, mid, el.checked);
        });
    }

    function onImportBaseOptionsStepRendered() {
        bindImportBaseProductsEditor();
        syncImportMinorationRecapDock();
        syncImportActionsDock();
        scheduleImportOptionsTriEmbedResize();
    }

    function onImportMinorationsStepRendered() {
        bindImportMinorationAssignEditor();
        syncImportMinorationRecapDock();
        syncImportActionsDock();
        scheduleImportOptionsTriEmbedResize();
    }

    function onImportMajorationsStepRendered() {
        bindImportMinorationAssignEditor();
        syncImportMinorationRecapDock();
        syncImportActionsDock();
        scheduleImportOptionsTriEmbedResize();
    }

    /* runSeedImportMinorationPostes → import-minorations-step.js */

    function runSeedImportMajorationPostes() {
        const n = seedImportMajorationPosteAssignments();
        showAlert(`${n} ligne(s) mise(s) à jour (postes pré-cochés).`, n ? 'success' : 'info');
        renderImportWorkflow();
    }

    function applyImportStagingApiResult(result, importId) {
        if (!result?.data) return;
        if (typeof window.__ugapSetImportStaging === 'function') {
            window.__ugapSetImportStaging(result.data, result.data?._id);
        } else {
            window.currentImportStaging = result.data;
            window.currentImportId = String(result.data?._id || importId || '');
        }
    }

    async function saveImportBaseOptionsStep(opts = {}) {
        const quiet = !!opts.quiet;
        const importId = stagingId();
        if (!staging() || !importId) {
            if (!quiet) showAlert('Aucun import en cours.', 'warning');
            throw new Error('Aucun import en cours.');
        }
        const result = await apiCall(`/imports/staging/${encodeURIComponent(importId)}/base-products`, {
            method: 'POST',
            body: JSON.stringify({ baseProducts: getImportBaseProductsForSave() })
        });
        applyImportStagingApiResult(result, importId);
        if (!quiet) {
            showAlert('Options de base enregistrées.', 'success');
            renderImportStagingIndicator(staging());
            renderImportWorkflow();
        }
        return result?.data;
    }

    function mapImportAdjUpdateForSave(opt) {
        const row = {
            optionId: String(opt.id || '').trim(),
            compatibleModels: Array.isArray(opt.compatibleModels) ? opt.compatibleModels : [],
            importOptionLabel: String(opt.importOptionLabel || '').trim(),
            importOptionLineKind: getImportResolvedLineKind(opt)
        };
        if (opt?.importExcludeFromBaseProduct) row.importExcludeFromBaseProduct = true;
        return row;
    }

    async function saveImportMinorationsStep(opts = {}) {
        const quiet = !!opts.quiet;
        const importId = stagingId();
        if (!staging() || !importId) {
            if (!quiet) showAlert('Aucun import en cours.', 'warning');
            throw new Error('Aucun import en cours.');
        }
        const updates = getImportStagingOptionsFlat()
            .filter(isImportMinorationOption)
            .map(mapImportAdjUpdateForSave)
            .filter((row) => row.optionId);

        const result = await apiCall(`/imports/staging/${encodeURIComponent(importId)}/minorations`, {
            method: 'POST',
            body: JSON.stringify({
                updates,
                baseProducts: getImportBaseProductsForSave()
            })
        });
        applyImportStagingApiResult(result, importId);
        if (!quiet) {
            showAlert('Assignations minorations enregistrées.', 'success');
            renderImportStagingIndicator(staging());
            renderImportWorkflow();
        }
        return result?.data;
    }

    async function saveImportMajorationsStep(opts = {}) {
        const quiet = !!opts.quiet;
        const importId = stagingId();
        if (!staging() || !importId) {
            if (!quiet) showAlert('Aucun import en cours.', 'warning');
            throw new Error('Aucun import en cours.');
        }
        const updates = getImportStagingOptionsFlat()
            .filter(isImportMajorationOption)
            .map(mapImportAdjUpdateForSave)
            .filter((row) => row.optionId);

        const result = await apiCall(`/imports/staging/${encodeURIComponent(importId)}/majorations`, {
            method: 'POST',
            body: JSON.stringify({
                updates,
                baseProducts: getImportBaseProductsForSave()
            })
        });
        applyImportStagingApiResult(result, importId);
        if (!quiet) {
            showAlert('Assignations majorations enregistrées.', 'success');
            renderImportStagingIndicator(staging());
            renderImportWorkflow();
        }
        return result?.data;
    }

    async function saveAllImportWorkflowStepsForPublish() {
        const importId = stagingId();
        if (!staging() || !importId) throw new Error('Aucun import en cours.');
        await saveImportBaseOptionsStep({ quiet: true });
        await saveImportMinorationsStep({ quiet: true });
        await saveImportMajorationsStep({ quiet: true });
        await saveImportOptionsTriStep({ quiet: true });
        return staging();
    }

    window.isImportMinorationOption = isImportMinorationOption;
    window.isImportMajorationOption = isImportMajorationOption;
    window.isImportPrOption = isImportPrOption;
    window.isImportMotorMinoration = isImportMotorMinoration;
    window.isImportMotorCatalogLine = isImportMotorCatalogLine;
    window.getImportStagingOptionsFlat = getImportStagingOptionsFlat;
    window.getImportStagingModelsForAssignment = getImportStagingModelsForAssignment;
    window.findImportMotorBaseProduct = findImportMotorBaseProduct;
    window.resolveImportMinorationOptionLinks = resolveImportMinorationOptionLinks;
    window.seedImportMinorationPosteAssignments = seedImportMinorationPosteAssignments;
    window.toggleImportMinorationModelAssignment = toggleImportMinorationModelAssignment;
    window.toggleImportAdjGroupModelAssignment = toggleImportAdjGroupModelAssignment;

    window.toggleImportBaseProductModelAssignment = toggleImportBaseProductModelAssignment;
    window.runMergeImportBaseProduct = runMergeImportBaseProduct;
    window.openImportBaseProductNameModal = openImportBaseProductNameModal;
    window.__ugapRenderImportAssignStep = renderImportAssignStepHtml;
    window.renderImportBaseOptionsStepHtml = renderImportBaseOptionsStepHtml;
    window.renderImportMajorationsStepHtml = renderImportMajorationsStepHtml;
    window.renderImportOptionsSortStepHtml = renderImportOptionsSortStepHtml;
    window.onImportOptionsTriTypeChange = onImportOptionsTriTypeChange;
    window.getImportResolvedLineKind = getImportResolvedLineKind;
    window.saveImportOptionsTriStep = saveImportOptionsTriStep;
    window.syncImportMinorationRecapDock = syncImportMinorationRecapDock;
    window.syncImportActionsDock = syncImportActionsDock;
    bindImportActionsDockInvokeListener();
    bindImportBaseProductsEditor();
    window.runSeedImportMajorationPostes = runSeedImportMajorationPostes;
    window.runSeedImportOptionsTriPostes = runSeedImportOptionsTriPostes;
    window.assignAllPostesToUnassignedImportOptions = assignAllPostesToUnassignedImportOptions;
    window.saveImportBaseOptionsStep = saveImportBaseOptionsStep;
    window.syncImportBaseProductsFromAdjRows = syncImportBaseProductsFromAdjRows;
    window.saveImportMinorationsStep = saveImportMinorationsStep;
    window.saveImportMajorationsStep = saveImportMajorationsStep;
    window.saveAllImportWorkflowStepsForPublish = saveAllImportWorkflowStepsForPublish;
    window.runDetachImportAdjFromBaseProducts = runDetachImportAdjFromBaseProducts;
    window.maybeAutoSeedImportMajorationPostes = maybeAutoSeedImportMajorationPostes;
    window.resolveImportWorkflowResumeStep = resolveImportWorkflowResumeStep;
    window.canOpenImportBaseOptionsStep = canOpenImportBaseOptionsStep;
    window.isImportMinorationsStepValidated = isImportMinorationsStepValidated;
    window.isImportMajorationsStepValidated = isImportMajorationsStepValidated;
    window.getImportPosteFilterValue = getImportPosteFilterValue;
    window.renderImportPosteFilterHtml = renderImportPosteFilterHtml;
    window.onImportPosteFilterChange = onImportPosteFilterChange;
    window.importOptionMatchesPosteFilter = importOptionMatchesPosteFilter;
    window.renderImportPrStepHtml = renderImportPrStepHtml;
    // window.renderImportValidateStepHtml fourni par `import-validate-step.js`.
    window.onImportBaseOptionsStepRendered = onImportBaseOptionsStepRendered;
    window.onImportMinorationsStepRendered = onImportMinorationsStepRendered;
    window.onImportMajorationsStepRendered = onImportMajorationsStepRendered;
    window.onImportOptionsStepRendered = onImportOptionsStepRendered;
    window.formatMotorSourceHint = formatMotorSourceHint;

})();
