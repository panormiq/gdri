/**
 * FICHIER : parametrage/assets/js/import/modeles-import-tab.js
 * RÔLE : Onglet Importation > Modèles — tableau unique détection + validation.
 */
(function bindParamImportModelesTab(global) {
    'use strict';

    function mountEl() {
        return document.getElementById('ugap-import-models-validate-mount');
    }

    function escapeHtml(value) {
        if (typeof global.escapeHtml === 'function') return global.escapeHtml(value);
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function formatPrice(value) {
        if (global.UgapDetectFormat?.formatPriceEur) {
            return global.UgapDetectFormat.formatPriceEur(value);
        }
        const n = Number(value);
        return Number.isFinite(n) ? `${n.toFixed(2)} €` : '—';
    }

    async function apiCall(endpoint, options) {
        if (typeof global.apiCall !== 'function') {
            throw new Error('apiCall indisponible.');
        }
        return global.apiCall(endpoint, options);
    }

    function showAlert(message, type) {
        if (typeof global.showAlert === 'function') global.showAlert(message, type);
    }

    function detectionModels() {
        const report = global.__ugapDetectionReport;
        return Array.isArray(report?.models) ? report.models : [];
    }

    function mergeDetectionIntoStagingModels(stagingModels, detected) {
        const staging = Array.isArray(stagingModels) ? stagingModels : [];
        const detect = Array.isArray(detected) ? detected : [];
        if (!detect.length) return staging;

        const byId = new Map(detect.map((m) => [String(m?.id || '').trim(), m]).filter(([id]) => id));
        const byCol = new Map(
            detect
                .filter((m) => Number.isFinite(Number(m?.colIndex)))
                .map((m) => [Number(m.colIndex), m])
        );
        const byPoste = new Map(
            detect
                .filter((m) => Number.isFinite(Number(m?.posteNumber)))
                .map((m) => [Number(m.posteNumber), m])
        );

        const pickDetect = (model) => {
            const id = String(model?.id || '').trim();
            const col = Number(model?.colIndex);
            const poste = Number(model?.posteNumber);
            return byId.get(id)
                || (Number.isFinite(col) ? byCol.get(col) : null)
                || (id.match(/^model_(\d+)$/) ? byCol.get(Number(id.replace('model_', ''))) : null)
                || (Number.isFinite(poste) ? byPoste.get(poste) : null);
        };

        const mergeRow = (model, det) => {
            const next = { ...(model || {}) };
            if (!det) return next;
            if (String(det.refUgap || '').trim()) next.refUgap = String(det.refUgap).trim();
            const price = Number(det.priceClient ?? det.basePrice);
            if (Number.isFinite(price) && price > 0) {
                next.basePrice = price;
                next.priceClient = price;
            }
            const priceUgap = Number(det.priceUgap);
            if (Number.isFinite(priceUgap) && priceUgap > 0) next.priceUgap = priceUgap;
            if (String(det.motorizationBase || '').trim()) next.motorizationBase = String(det.motorizationBase).trim();
            if (Number.isFinite(Number(det.posteNumber))) next.posteNumber = Number(det.posteNumber);
            if (det.colIndex != null && next.colIndex == null) next.colIndex = det.colIndex;
            if (String(det.name || '').trim() && !String(next.name || '').trim()) next.name = String(det.name).trim();
            if (!String(next.id || '').trim() && String(det.id || '').trim()) next.id = String(det.id).trim();
            return next;
        };

        if (!staging.length) {
            return detect.map((m) => mergeRow({ id: m.id }, m));
        }

        return staging.map((model) => mergeRow(model, pickDetect(model)));
    }

    function isModelValidated(modelId, staging) {
        const id = String(modelId || '').trim();
        const validated = new Set((staging?.progress?.validatedModelIds || []).map((x) => String(x)));
        if (typeof global.importModelRowDisplayValidated === 'function') {
            return global.importModelRowDisplayValidated(id, validated);
        }
        return validated.has(id);
    }

    function renderUnifiedModelsTable(staging, models) {
        const validatedIds = new Set((staging?.progress?.validatedModelIds || []).map((x) => String(x)));
        const pending = models.filter((m) => !isModelValidated(String(m?.id || ''), staging));
        const refsFound = models.filter((m) => String(m?.refUgap || '').trim()).length;

        const rows = models.map((m) => {
            const id = String(m?.id || '').trim();
            const encodedId = encodeURIComponent(id);
            const validated = isModelValidated(id, staging);
            const price = Number(m?.basePrice ?? m?.priceClient);
            const safePrice = Number.isFinite(price) ? price : 0;
            return `<tr>
                <td style="padding:8px;border-bottom:1px solid #f1f5f9;text-align:center;">
                    <input type="checkbox" data-import-model-id="${encodedId}" ${validated ? 'checked disabled' : 'checked'}
                        onchange="toggleImportModelSelection(decodeURIComponent('${encodedId}'), this.checked)">
                </td>
                <td style="padding:8px;border-bottom:1px solid #f1f5f9;">${escapeHtml(String(m?.name || id || '—'))}</td>
                <td style="padding:8px;border-bottom:1px solid #f1f5f9;"><code>${escapeHtml(String(m?.refUgap || '—'))}</code></td>
                <td style="padding:8px;border-bottom:1px solid #f1f5f9;">${escapeHtml(String(m?.motorizationBase || '—'))}</td>
                <td style="padding:8px;border-bottom:1px solid #f1f5f9;">${escapeHtml(String(m?.posteNumber ?? '—'))}</td>
                <td style="padding:8px;border-bottom:1px solid #f1f5f9;" class="num">${escapeHtml(formatPrice(safePrice))}</td>
                <td style="padding:8px;border-bottom:1px solid #f1f5f9;" class="num">${escapeHtml(formatPrice(m?.priceUgap))}</td>
                <td style="padding:8px;border-bottom:1px solid #f1f5f9;">
                    ${validated
                        ? '<span style="color:#16a34a;font-weight:600;">Validé</span>'
                        : '<span style="color:#b45309;">À valider</span>'}
                </td>
            </tr>`;
        }).join('');

        return `
            ${refsFound < models.length && models.length ? `
            <div style="margin-bottom:10px;padding:8px 10px;background:#eff6ff;border:1px solid #93c5fd;border-radius:6px;color:#1e40af;font-size:12px;">
                Complément des données depuis la détection Excel (${refsFound}/${models.length} réfs déjà présentes).
            </div>` : ''}
            <table class="ugap-detect-table" style="width:100%;border-collapse:collapse;font-size:13px;">
                <thead>
                    <tr style="background:#f8fafc;">
                        <th style="padding:8px;border-bottom:1px solid #e5e7eb;width:52px;text-align:center;">OK</th>
                        <th style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:left;">Modèle</th>
                        <th style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:left;">Réf. UGAP</th>
                        <th style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:left;">Motorisation</th>
                        <th style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:left;">Poste</th>
                        <th style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:left;" class="num">Prix client</th>
                        <th style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:left;" class="num">Prix UGAP</th>
                        <th style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:left;">État</th>
                    </tr>
                </thead>
                <tbody>${rows || '<tr><td colspan="8" style="padding:12px;color:#6b7280;">Aucun modèle.</td></tr>'}</tbody>
            </table>
            <div style="margin-top:12px;display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;">
                <span style="font-size:13px;color:#4b5563;">
                    <strong>${validatedIds.size}/${models.length}</strong> validé(s)
                    ${pending.length ? ` — <strong>${pending.length}</strong> en attente` : ''}
                </span>
                <div style="display:flex;gap:8px;flex-wrap:wrap;">
                    ${pending.length ? `<button type="button" class="btn btn-success" id="ugap-modeles-validate-all">Valider ${pending.length} modèle(s)</button>` : ''}
                    ${pending.length < models.length && pending.length ? '' : (pending.length === 0 && models.length ? '<span style="color:#16a34a;font-weight:600;">Tous les modèles sont validés.</span>' : '')}
                </div>
            </div>`;
    }

    async function ensureDetectionReport() {
        if (global.__ugapDetectionReport?.models?.length) return global.__ugapDetectionReport;
        if (!global.UgapDetectFetch?.fetchDetectionReport) return null;
        try {
            const report = await global.UgapDetectFetch.fetchDetectionReport();
            if (global.UgapDetectPaint?.paintDetectionReport) {
                global.UgapDetectPaint.paintDetectionReport(report);
            } else {
                global.__ugapDetectionReport = report;
            }
            return report;
        } catch (_err) {
            return null;
        }
    }

    async function validateAllPending() {
        if (typeof global.validateImportModelsStep === 'function') {
            await global.validateImportModelsStep();
            await refreshAndRender();
            if (typeof global.UgapImportValiderTab?.refreshStaging === 'function') {
                void global.UgapImportValiderTab.refreshStaging();
            }
            return;
        }
        showAlert('Module validation indisponible.', 'error');
    }

    function bindMountEvents() {
        const el = mountEl();
        if (!el || el.dataset.bound === '1') return;
        el.dataset.bound = '1';
        el.addEventListener('click', (event) => {
            const target = event.target;
            if (!(target instanceof HTMLElement)) return;
            if (target.id === 'ugap-modeles-validate-all') {
                void validateAllPending();
            }
        });
    }

    async function refreshAndRender() {
        const el = mountEl();
        if (!el) return;

        el.innerHTML = '<p style="margin:0;color:#64748b;">Chargement…</p>';
        try {
            const [stagingRes] = await Promise.all([
                apiCall('/imports/staging'),
                ensureDetectionReport()
            ]);
            const staging = stagingRes?.data || null;
            if (!staging) {
                const detected = detectionModels();
                if (detected.length) {
                    el.innerHTML = `
                        <div style="padding:12px;background:#fff7ed;border:1px solid #fdba74;border-radius:8px;color:#9a3412;font-size:13px;margin-bottom:12px;">
                            Détection OK (${detected.length} modèles) mais aucun staging.
                            Cliquez <strong>Importer</strong> dans l'onglet Détection pour créer le staging, puis revenez ici.
                        </div>`;
                    return;
                }
                el.innerHTML = `
                    <div style="padding:12px;background:#fff7ed;border:1px solid #fdba74;border-radius:8px;color:#9a3412;font-size:13px;">
                        Aucun modèle. Lancez la <strong>détection</strong> puis l'<strong>import</strong> depuis l'onglet Détection.
                    </div>`;
                return;
            }

            const mergedModels = mergeDetectionIntoStagingModels(staging.models, detectionModels());
            const nextStaging = { ...staging, models: mergedModels };
            global.currentImportStaging = nextStaging;
            global.currentImportId = String(staging._id || '');
            if (!global.importWorkflowState) {
                global.importWorkflowState = { step: 'models', modelStatusFilter: 'all' };
            }

            el.innerHTML = renderUnifiedModelsTable(nextStaging, mergedModels);
            bindMountEvents();
        } catch (err) {
            el.innerHTML = `<p style="color:#b91c1c;">${escapeHtml(err?.message || 'Erreur chargement.')}</p>`;
        }
    }

    global.UgapImportModelesTab = {
        refreshAndRender,
        mergeDetectionIntoStagingModels
    };
})(window);
