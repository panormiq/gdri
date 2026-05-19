/**
 * Workflow import — étapes 2 Options de base et 3 Minorations.
 * Dépend des helpers globaux définis dans admin.php (escapeHtml, apiCall, extractBaseReplacementProductsForUi, …).
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
            window.importWorkflowState = { step: 'models', minoAutoSeeded: false, majorationAutoSeeded: false };
        }
        return window.importWorkflowState;
    }

    const IMPORT_MINO_STYLE_ID = 'ugap-import-mino-styles';

    function ensureImportMinoStyles() {
        if (document.getElementById(IMPORT_MINO_STYLE_ID)) return;
        const el = document.createElement('style');
        el.id = IMPORT_MINO_STYLE_ID;
        el.textContent = `
.ugap-import-mino-wrap { font-size: 13px; }
.ugap-import-mino-summary {
    margin-bottom: 12px; padding: 10px 12px; background: #eff6ff; border: 1px solid #bfdbfe;
    border-radius: 8px; color: #1e3a5f; font-size: 13px;
}
.ugap-import-mino-toolbar { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-bottom: 10px; }
.ugap-import-mino-table-scroll { overflow-x: auto; border: 1px solid #e5e7eb; border-radius: 8px; }
.ugap-import-mino-table { width: max-content; min-width: 100%; border-collapse: separate; border-spacing: 0; font-size: 12px; }
.ugap-import-mino-table th, .ugap-import-mino-table td {
    border-bottom: 1px solid #f1f5f9; padding: 8px 10px; vertical-align: top; background: #fff;
}
.ugap-import-mino-table thead th { background: #f8fafc; position: sticky; top: 0; z-index: 3; }
.ugap-import-mino-sticky-detail {
    position: sticky; left: 0; z-index: 4; min-width: 36%; width: 36%; max-width: 640px;
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
    display: flex; flex-wrap: wrap; align-items: center; gap: 10px 16px; margin-bottom: 8px;
}
.ugap-bp-name-type-row .ugap-bp-name-field {
    display: flex; align-items: center; gap: 8px; flex: 1 1 180px; min-width: 0;
}
.ugap-bp-name-type-row .ugap-bp-type-field {
    display: flex; align-items: center; gap: 8px; flex: 0 1 auto;
}
.ugap-bp-name-type-row .ugap-bp-name-input { flex: 1 1 auto; min-width: 120px; width: auto; }
.ugap-bp-name-type-row .ugap-import-bp-select { min-width: 200px; max-width: 280px; }
.ugap-bp-name-input,
.ugap-mino-option-name-input {
    width: 100%; max-width: 100%; box-sizing: border-box; padding: 6px 8px;
    border: 1px solid #cbd5e1; border-radius: 6px; font-size: 13px; font-weight: 600;
}
.ugap-mino-option-name-input { margin-top: 0; font-weight: 500; }
.ugap-mino-option-name-row {
    display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-bottom: 6px;
}
.ugap-mino-option-name-row .ugap-mino-option-name-input { flex: 1 1 180px; min-width: 120px; }
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
`;
        document.head.appendChild(el);
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

    function renderImportOptionPricePartHtml(baseInfo, linePrice) {
        const baseValidated = isImportBaseOptionsValidated(staging());
        if (!baseValidated) {
            return '<span style="color:#94a3b8;">—</span> <span class="ugap-import-mino-hint">(enregistrer options de base — étape 2)</span>';
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
        return `<div class="ugap-bp-type-field"><strong>Type :</strong>
                <select class="ugap-import-adj-select" data-adj-field="pricingMode"
                    data-adj-group-opts="${encGroup}" data-mino-opt-id="${encOptId}">
                    <option value="fixed" ${mode === 'fixed' ? 'selected' : ''}>Fixe — un prix pour tous les postes</option>
                    <option value="per_model" ${mode === 'per_model' ? 'selected' : ''}>Par poste — prix différent par P1, P2…</option>
                </select>
            </div>`;
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

            let initialProduct = replacedBase;
            if (/^celui\s+de\s+base$/i.test(initialProduct)) {
                const head = beforeNoPrefix.match(/\b(flotteur|moteur|combin[ée]|sondeur|module|coque|console)\b/i);
                initialProduct = head ? `${head[1].toLowerCase()} de base` : 'produit de base';
            }

            return { changeType: 'replacement', initialProduct, finalProduct };
        }

        const inPlaceMatch = cleaned.match(/^(.*?)\s+(?:au|en)\s+lieu\s+et\s+place\s+de\s+(?:l['’]|la\s+|le\s+|les\s+)?(.+)$/i);
        if (inPlaceMatch) {
            return {
                changeType: 'replacement',
                initialProduct: String(inPlaceMatch[2] || '').trim(),
                finalProduct: String(inPlaceMatch[1] || '').trim()
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

    /** Une minoration = réf. UGAP contient « MINO » (aligné import backend). */
    function isImportMinorationOption(opt) {
        const ref = String(opt?.refUgap || '').trim().toUpperCase();
        return ref.includes('MINO');
    }

    /** PR : libellé commence par « PR » — exclu des majorations. */
    function isImportPrOption(opt) {
        return /^PR\s/i.test(String(opt?.name || '').replace(/\s+/g, ' ').trim());
    }

    /** Forfait / garantie moteur : hors majorations (ligne administrative, pas un remplacement équipement). */
    function isImportMotorForfaitOrGarantieLabel(name) {
        const n = String(name || '').replace(/\s+/g, ' ').trim();
        if (!n) return false;
        if (!/\b(forfait|garanties?|extension\s+de\s+garantie)\b/i.test(n)) return false;
        return /\b(moteurs?|motorisation|suzuki|mercury|yamaha|honda|evinrude)\b/i.test(n);
    }

    /** Majoration : libellé (en remplacement, en lieu et place, moteur…) — hors MINO et PR. */
    function isImportMajorationLabel(name) {
        const n = String(name || '').replace(/\s+/g, ' ').trim();
        if (!n || isImportPrOption({ name: n })) return false;
        if (isImportMotorForfaitOrGarantieLabel(n)) return false;
        if (/\ben\s+lieux?\s+et\s+place\b/i.test(n)) return true;
        if (/\bau\s+lieu\s+et\s+place\b/i.test(n)) return true;
        if (/\ben\s+remplacement\b/i.test(n)) return true;
        if (isImportMotorNonFournitureLabel(n)) return true;
        if (/\b(non\s+fourniture\s+du\s+moteur|moteurs?|motorisation|suzuki|mercury|yamaha|honda|evinrude|double\s+moteur)\b/i.test(n)) {
            return true;
        }
        const parsed = typeof extractBaseReplacementProductsForUi === 'function'
            ? extractBaseReplacementProductsForUi({ name: n })
            : {};
        if (parsed?.changeType === 'motor_base_non_supply') return true;
        return false;
    }

    function isImportMajorationOption(opt) {
        if (isImportPrOption(opt)) return false;
        if (isImportMinorationOption(opt)) return false;
        return isImportMajorationLabel(opt?.name);
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
        const cats = Array.isArray(staging()?.categories) ? staging().categories : [];
        const out = [];
        cats.forEach((cat) => {
            (Array.isArray(cat?.options) ? cat.options : []).forEach((opt) => {
                out.push(opt);
            });
        });
        return out.sort((a, b) => (Number(a?.rowOrder) || 0) - (Number(b?.rowOrder) || 0));
    }

    function findImportStagingOptionById(optionId) {
        const id = String(optionId || '').trim();
        if (!id) return null;
        const cats = Array.isArray(staging()?.categories) ? staging().categories : [];
        for (const cat of cats) {
            const opts = Array.isArray(cat?.options) ? cat.options : [];
            const found = opts.find((o) => String(o?.id || '').trim() === id);
            if (found) return found;
        }
        return null;
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
        if (/\b(non\s+fourniture\s+du\s+moteur|moteurs?|motorisation|suzuki|mercury|yamaha|honda|evinrude|double\s+moteur)\b/i.test(name)) {
            return true;
        }
        const parsed = typeof extractBaseReplacementProductsForUi === 'function'
            ? extractBaseReplacementProductsForUi(opt)
            : {};
        if (parsed?.changeType === 'motor_base_non_supply') return true;
        const cm = Array.isArray(opt?.compatibleModels) ? opt.compatibleModels : [];
        return cm.length > 0 && /\b(moteurs?|motorisation)\b/i.test(name);
    }

    function normalizeMotorLabelKey(label) {
        return String(label || '')
            .replace(/\s+/g, ' ')
            .trim()
            .toLowerCase();
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

    /** Modèles validés dont la colonne Excel a une croix pour cette ligne MINO. */
    function getImportMinorationModelsWithCross(opt, models) {
        const cm = new Set(
            (Array.isArray(opt?.compatibleModels) ? opt.compatibleModels : [])
                .map((id) => String(id || '').trim())
                .filter(Boolean)
        );
        if (!cm.size) return [];
        return (Array.isArray(models) ? models : []).filter((m) => cm.has(String(m?.id || '').trim()));
    }

    /** Postes ciblés : croix Excel, sinon numéros de poste dans le libellé MINO. */
    function getImportMinorationTargetModelsForMotor(opt, models) {
        const list = Array.isArray(models) ? models : getImportStagingModelsForAssignment();
        const crossed = getImportMinorationModelsWithCross(opt, list);
        if (crossed.length) return crossed;

        const cm = (Array.isArray(opt?.compatibleModels) ? opt.compatibleModels : [])
            .map((id) => String(id || '').trim())
            .filter(Boolean);
        if (cm.length) {
            const fromStored = list.filter((m) => cm.includes(String(m?.id || '').trim()));
            if (fromStored.length) return fromStored;
        }

        if (typeof getExplicitPosteSetFromLabel === 'function') {
            const posteSet = getExplicitPosteSetFromLabel(opt?.name);
            if (posteSet && posteSet.size > 0) {
                const byPoste = list.filter((m) => {
                    const pn = Number(m?.posteNumber);
                    return Number.isFinite(pn) && posteSet.has(pn);
                });
                if (byPoste.length) return byPoste;
            }
        }

        const single = String(opt?.name || '').match(/\bposte\s+(\d+)\b/i);
        if (single) {
            const pn = parseInt(single[1], 10);
            const found = list.filter((m) => Number(m?.posteNumber) === pn);
            if (found.length) return found;
        }

        const refFs = String(opt?.refFournisseur || '').trim();
        if (refFs) {
            const byRef = list.filter((m) => findCatalogMotorOptionByRef(refFs, m?.id));
            if (byRef.length) return byRef;
        }

        if (isImportMotorMinoration(opt)) {
            const withMotor = list.filter((m) => {
                const motor = getMotorLabelForPosteModel(m);
                return !!String(motor || '').trim();
            });
            if (withMotor.length === 1) return withMotor;
        }

        return [];
    }

    /** IDs modèles (postes) à cocher pour une minoration — croix Excel, libellé, moteur. */
    function resolveImportMinorationPosteModelIds(opt, models) {
        const modelList = Array.isArray(models) ? models : getImportStagingModelsForAssignment();
        const ids = new Set();

        const pushModel = (m) => {
            const s = String(m?.id || m || '').trim();
            if (s) ids.add(s);
        };

        if (isImportMotorMinoration(opt)) {
            getImportMinorationTargetModelsForMotor(opt, modelList).forEach(pushModel);
        } else if (typeof getExplicitPosteSetFromLabel === 'function') {
            const explicit = getExplicitPosteSetFromLabel(opt?.name);
            if (explicit && explicit.size > 0) {
                modelList.forEach((m) => {
                    const pn = Number(m?.posteNumber);
                    if (Number.isFinite(pn) && explicit.has(pn)) pushModel(m);
                });
            }
        }

        if (!ids.size) {
            (Array.isArray(opt?.compatibleModels) ? opt.compatibleModels : []).forEach((mid) => {
                const s = String(mid || '').trim();
                if (!s) return;
                const hit = modelList.find((m) => String(m?.id || '').trim() === s);
                if (hit) pushModel(hit);
            });
        }

        return Array.from(ids).filter(Boolean);
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

    /** Libellé Option contenant « base » : une ligne distincte à la 1re passe, pas de fusion auto. */
    function isImportNonMergeableBaseProductLabel(label) {
        const n = String(label || '').replace(/\s+/g, ' ').trim();
        if (!n) return true;
        return /\bbase\b/i.test(n);
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

        const nextStore = store.filter(
            (bp) => filterImportBaseProductAdjOptionIds(bp.optionIds, models).length > 0
        );
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
        const cats = Array.isArray(staging()?.categories) ? staging().categories : [];
        cats.forEach((cat) => {
            (Array.isArray(cat?.options) ? cat.options : []).forEach((opt) => {
                if (isImportMinorationOption(opt) || !isCatalogMotorLikeOption(opt)) return;
                const cm = Array.isArray(opt.compatibleModels) ? opt.compatibleModels.map(String) : [];
                if (cm.length > 0 && !cm.includes(mid)) return;
                candidates.push(opt);
            });
        });

        if (!candidates.length) return null;
        const dedicated = candidates.filter((opt) => {
            const cm = Array.isArray(opt.compatibleModels) ? opt.compatibleModels : [];
            return cm.length === 1 && String(cm[0]) === mid;
        });
        return dedicated[0] || candidates[0];
    }

    /** Nom du moteur = motorisation du bateau (ligne poste Pn), sinon option catalogue moteur du poste. */
    function getMotorLabelForPosteModel(model) {
        let motor = String(model?.motorizationBase || '').trim();
        if (!motor) motor = parseMotorFromBoatModelLabel(model);
        if (motor) return motor;
        const cat = findCatalogMotorOptionForModel(model);
        return cat ? String(cat.name || '').trim() : '';
    }

    function isCatalogMotorLikeOption(opt) {
        if (isImportMinorationOption(opt)) return false;
        const name = String(opt?.name || '').toLowerCase();
        return /\b(moteur|motorisation|suzuki|mercury|yamaha|honda|evinrude|\d+\s*cv)\b/i.test(name);
    }

    function findCatalogMotorOptionByRef(refFournisseur, modelId) {
        const ref = String(refFournisseur || '').trim().toLowerCase();
        if (!ref) return null;
        const cats = Array.isArray(staging()?.categories) ? staging().categories : [];
        for (const cat of cats) {
            for (const opt of Array.isArray(cat?.options) ? cat.options : []) {
                if (isImportMinorationOption(opt)) continue;
                const r1 = String(opt?.refFournisseur || '').trim().toLowerCase();
                const r2 = String(opt?.refUgap || '').trim().toLowerCase();
                if (r1 !== ref && r2 !== ref) continue;
                const cm = Array.isArray(opt?.compatibleModels) ? opt.compatibleModels : [];
                if (modelId && cm.length > 0 && !cm.map(String).includes(String(modelId))) continue;
                return opt;
            }
        }
        return null;
    }

    /** Option catalogue moteur dont le prix client ≈ prix de base du poste. */
    function findCatalogMotorOptionByPostePrice(model) {
        const mid = String(model?.id || '').trim();
        const bp = parseMoney(model?.basePrice);
        if (!mid || !Number.isFinite(bp) || bp <= 0) return null;

        const cats = Array.isArray(staging()?.categories) ? staging().categories : [];
        let best = null;
        let bestDelta = Infinity;

        cats.forEach((cat) => {
            (Array.isArray(cat?.options) ? cat.options : []).forEach((opt) => {
                if (!isCatalogMotorLikeOption(opt)) return;
                const cm = Array.isArray(opt?.compatibleModels) ? opt.compatibleModels : [];
                if (cm.length > 0 && !cm.map(String).includes(mid)) return;
                const p = parseMoney(opt?.priceClient);
                if (!Number.isFinite(p) || p <= 0) return;
                const delta = Math.abs(p - bp);
                if (delta > 0.05) return;
                if (delta < bestDelta) {
                    bestDelta = delta;
                    best = opt;
                }
            });
        });

        return best;
    }

    function findImportMotorBaseProduct(opt, models) {
        const targetModels = getImportMinorationTargetModelsForMotor(opt, models);
        const refFs = String(opt?.refFournisseur || '').trim();

        if (refFs && targetModels.length) {
            for (const model of targetModels) {
                const catOpt = findCatalogMotorOptionByRef(refFs, model?.id);
                if (catOpt) {
                    return {
                        label: String(catOpt.name || refFs).trim(),
                        source: 'ref_fournisseur',
                        model
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
            for (const model of targetModels) {
                const catByPrice = findCatalogMotorOptionForModel(model);
                if (catByPrice) {
                    return {
                        label: String(catByPrice.name || '').trim(),
                        source: 'catalogue_prix',
                        model,
                        catalogOptionId: String(catByPrice.id || '').trim()
                    };
                }
            }
            return null;
        }

        const labelKeys = entries.map((e) => normalizeMotorLabelKey(e.label));
        const uniqueKeys = [...new Set(labelKeys)];
        if (uniqueKeys.length === 1) {
            return {
                label: entries[0].label,
                source: 'motorisation_modele',
                model: entries[0].model
            };
        }

        const parts = entries
            .sort((a, b) => {
                const na = Number(a.pn);
                const nb = Number(b.pn);
                if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
                return 0;
            })
            .map((e) => {
                const tag = e.pn != null && e.pn !== '' ? `P${e.pn}` : '?';
                return `${tag} : ${e.label}`;
            });

        return {
            label: parts.join(' · '),
            source: 'motorisation_multi',
            model: entries[0].model
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

        return {
            initialProduct,
            finalProduct,
            changeType: 'motor',
            sourceHint: formatMotorSourceHint(base?.source || '')
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

    function normalizeBaseProductKey(text) {
        return String(text || '')
            .replace(/\s+/g, ' ')
            .trim()
            .toLowerCase()
            .replace(/[^\wàâäéèêëïîôùûüç\s-]/gi, '')
            .trim();
    }

    /** 1re passe — clé registre : fusion par libellé sauf si « base » → une entrée par ligne. */
    function buildBaseProductRegistryKey(label, opt) {
        const normalized = normalizeBaseProductKey(label);
        if (!normalized) return '';
        if (isImportNonMergeableBaseProductLabel(label)) {
            const oid = String(opt?.id || '').trim() || `row_${Date.now().toString(36)}`;
            return `${normalized}__${oid}`;
        }
        return normalized;
    }

    /** Prix catalogue / base de l'équipement pour un libellé et un poste (modèle). */
    function inferImportBaseProductPriceForModel(label, model) {
        const mid = String(model?.id || '').trim();
        const norm = normalizeBaseProductKey(label);
        if (!mid || !norm) return null;

        const cats = Array.isArray(staging()?.categories) ? staging().categories : [];
        let dedicated = null;
        let fallback = null;

        cats.forEach((cat) => {
            (Array.isArray(cat?.options) ? cat.options : []).forEach((opt) => {
                if (isImportMinorationOption(opt) || isImportMajorationOption(opt) || isImportPrOption(opt)) return;
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
        });

        if (dedicated != null) return dedicated;
        if (fallback != null) return fallback;

        if (/\b(moteurs?|motorisation|suzuki|mercury|yamaha|honda|evinrude)\b/i.test(String(label || ''))) {
            const mp = parseMoney(model?.basePrice);
            if (mp != null) return mp;
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
            const p = inferImportBaseProductPriceForModel(label, m);
            if (p != null) pricesByModelId[id] = p;
        });
        return pricesByModelId;
    }

    function applyImportBaseProductPricingFromHints(bp, priceHints) {
        if (!bp || !priceHints || typeof priceHints !== 'object') return;
        const merged = { ...(bp.pricesByModelId || {}) };
        Object.keys(priceHints).forEach((mid) => {
            const p = parseMoney(priceHints[mid]);
            if (p != null && (merged[mid] == null || merged[mid] === '')) merged[mid] = p;
        });

        const vals = Object.entries(merged)
            .filter(([mid]) => (bp.modelIds || []).map(String).includes(String(mid)))
            .map(([, v]) => parseMoney(v))
            .filter((v) => v != null);
        const distinct = [...new Set(vals.map((v) => Number(v.toFixed(2))))];

        if (distinct.length > 1) {
            bp.pricingMode = 'per_model';
            bp.pricesByModelId = merged;
            bp.price = null;
        } else if (distinct.length === 1) {
            bp.pricingMode = 'fixed';
            bp.price = distinct[0];
            bp.pricesByModelId = merged;
        } else if (Object.keys(merged).length) {
            bp.pricesByModelId = merged;
        }
    }

    /** 2e passe — fusionne les lignes au libellé identique (sans « base »), prix par poste si besoin. */
    function collapseImportBaseProductsSameLabelPerPoste(products, models) {
        const modelById = buildImportModelByIdMap(models);
        const groups = new Map();
        (Array.isArray(products) ? products : []).forEach((bp) => {
            const ln = normalizeBaseProductKey(bp?.label);
            if (!ln || isImportNonMergeableBaseProductLabel(bp?.label)) {
                groups.set(`__solo_${bp?.id || Math.random()}`, [bp]);
                return;
            }
            if (!groups.has(ln)) groups.set(ln, []);
            groups.get(ln).push(bp);
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
            merged.key = normalizeBaseProductKey(merged.label);
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

    /** Libellé de fusion = champ « Option » (renommé ou produit final), pas le libellé Excel ni initialProduct. */
    function getImportAdjOptionFusionLabel(opt, models) {
        const custom = String(opt?.importOptionLabel || '').trim();
        if (custom) return custom;

        const links = resolveImportMinorationOptionLinks(opt, models);
        if (links?.changeType === 'motor') {
            const motorBase = String(links.initialProduct || '').trim();
            if (motorBase && !isGenericMotorPlaceholder(motorBase)) return motorBase;
        }
        const display = getImportMinorationDisplayLabel(opt, links);
        if (display) return display;

        const name = String(opt?.name || '').replace(/\s+/g, ' ').trim();
        if (name && !/\ben\s+remplacement\b/i.test(name) && !/\blieu\s+et\s+place\b/i.test(name) && !/^supp?ress/i.test(name)) {
            return name.replace(/\s*-\s*postes?\s+[\d\s,etàa\-–—]+$/i, '').trim();
        }
        return String(links?.initialProduct || '').trim();
    }

    function findStoreBaseProductForRegistryEntry(entry, store) {
        const key = String(entry?.key || '');
        if (key) {
            const byKeyHit = store.find((bp) => String(bp?.key || '') === key);
            if (byKeyHit) return byKeyHit;
        }
        const oids = new Set((entry?.optionIds || []).map(String).filter(Boolean));
        if (!oids.size) return null;
        return store.find((bp) => (bp?.optionIds || []).some((oid) => oids.has(String(oid)))) || null;
    }

    function refreshImportBaseProductLabelFromLinkedOptions(bp, models) {
        const oids = filterImportBaseProductAdjOptionIds(bp?.optionIds, models);
        if (!oids.length) return;
        const labels = oids.map((oid) => {
            const opt = findImportStagingOptionById(oid);
            return opt ? getImportAdjOptionFusionLabel(opt, models) : '';
        }).filter(Boolean);
        if (!labels.length) return;
        const normSet = new Set(labels.map((l) => normalizeBaseProductKey(l)).filter(Boolean));
        if (normSet.size !== 1) return;
        const canonical = labels[0];
        const sampleOpt = findImportStagingOptionById(oids[0]);
        bp.label = canonical;
        bp.key = buildBaseProductRegistryKey(canonical, sampleOpt || { id: oids[0] });
    }

    function buildImportMinorationBaseProductRegistry(adjRows, models) {
        const registry = new Map();
        (Array.isArray(adjRows) ? adjRows : []).forEach((opt) => {
            const fusionLabel = getImportAdjOptionFusionLabel(opt, models);
            const key = buildBaseProductRegistryKey(fusionLabel, opt);
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
            entry.optionIds.push(String(opt?.id || '').trim());
            resolveImportMinorationPosteModelIds(opt, models).forEach((mid) => {
                const midStr = String(mid || '').trim();
                if (midStr) entry.modelIds.add(midStr);
            });
        });
        return registry;
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
            if (entry.label) bp.label = entry.label;

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
            const prevLabel = String(bp.label || '').trim();
            if (entryLabel && prevLabel && entryLabel.toLowerCase() !== prevLabel.toLowerCase()) {
                if (!Array.isArray(bp.aliases)) bp.aliases = [];
                if (!bp.aliases.some((a) => String(a).toLowerCase() === prevLabel.toLowerCase())) {
                    bp.aliases.push(prevLabel);
                }
            }

            if (options?.applyPricingHints) {
                applyImportBaseProductPricingFromHints(bp, entry.pricesByModelId);
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

        next.forEach((bp) => refreshImportBaseProductLabelFromLinkedOptions(bp, modelList));
        const collapsed = collapseImportBaseProductsSameLabelPerPoste(next, modelList);
        if (staging()) staging().importBaseProducts = collapsed;
        return collapsed;
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
     * Option de base liée à une ligne ou un groupe mino/majo (création locale si besoin).
     * Permet de modifier le type Fixe / Par poste depuis les étapes 3 et 4.
     */
    function ensureImportBaseProductForAdj(opt, group, models) {
        const options = group?.options?.length
            ? group.options
            : (opt ? [opt] : []);
        if (!options.length) return null;

        const sample = options[0];
        let bp = findImportBaseProductForOption(sample);
        if (bp) {
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

        const modelList = Array.isArray(models) ? models : getImportStagingModelsForAssignment();
        const label = getImportAdjOptionFusionLabel(sample, modelList);
        const key = buildBaseProductRegistryKey(label, sample);
        if (!key) return null;

        const optionIds = options.map((o) => String(o?.id || '').trim()).filter(Boolean);
        const modelIds = new Set();
        options.forEach((row) => {
            resolveImportMinorationPosteModelIds(row, modelList).forEach((mid) => {
                const midStr = String(mid || '').trim();
                if (midStr) modelIds.add(midStr);
            });
            (Array.isArray(row?.compatibleModels) ? row.compatibleModels : []).forEach((mid) => {
                const s = String(mid || '').trim();
                if (s) modelIds.add(s);
            });
        });

        const modelById = buildImportModelByIdMap(modelList);
        bp = {
            id: `bp_adj_${key.slice(0, 16)}_${Date.now().toString(36)}`,
            key,
            label,
            pricingMode: 'fixed',
            price: null,
            pricesByModelId: {},
            optionIds,
            modelIds: sortModelIdsByPosteNumber([...modelIds], modelById),
            aliases: []
        };
        getImportBaseProductsStore().push(bp);
        options.forEach((row) => {
            row.baseProductId = bp.id;
            row.baseProductLabel = bp.label;
        });
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
            return '<div class="ugap-import-mino-hint" style="margin-top:4px;">Prix option = option de base + mino/majo Excel — disponible après enregistrement à l\'étape 2.</div>';
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
        return `<div class="ugap-bp-name-type-row" style="margin-bottom:6px;">
            <div class="ugap-bp-name-field ugap-mino-option-name-row" style="margin-bottom:0;">
                <strong>Option :</strong>
                ${inputHtml}
                ${extraHtml}
            </div>
            ${renderImportAdjPricingTypeSelectHtml(sample, group, modelList)}
        </div>`;
    }

    function renderImportMinorationPricesForOpt(opt, models) {
        const lineLabel = 'Prix minoration';
        const linePrice = getImportMinorationExcelPrice(opt);
        const baseInfo = resolveImportBaseProductPriceForMinoration(opt, models);
        const optPart = renderImportOptionPricePartHtml(baseInfo, linePrice);
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
        const optPart = renderImportOptionPricePartHtml(baseInfo, linePrice);
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
            const optPart = renderImportOptionPricePartHtml(baseInfo, linePrice);
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
            const optPart = renderImportOptionPricePartHtml(baseInfo, linePrice);
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
            const optPart = renderImportOptionPricePartHtml(baseInfo, linePrice);
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
            const optPart = renderImportOptionPricePartHtml(baseInfo, linePrice);
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
        const models = getImportStagingModelsForAssignment();
        return getImportBaseProductsStore().map((bp) => ({
            id: bp.id,
            key: bp.key,
            label: String(bp.label || '').trim(),
            pricingMode: bp.pricingMode === 'per_model' ? 'per_model' : 'fixed',
            price: bp.price == null || bp.price === '' ? null : Number(bp.price),
            pricesByModelId: { ...(bp.pricesByModelId || {}) },
            optionIds: filterImportBaseProductAdjOptionIds(bp.optionIds, models),
            modelIds: [...(bp.modelIds || [])],
            aliases: Array.isArray(bp.aliases) ? bp.aliases.map((a) => String(a || '').trim()).filter(Boolean) : []
        }));
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
        if (bp.pricingMode === 'per_model') {
            refreshImportBaseProductPriceDom(id);
        }
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

    function importFamilyTriOptionMatchesPosteFilter(optLite, posteFilter, models) {
        const row = findImportStagingOptionById(optLite?.id);
        if (!row) return true;
        return importOptionMatchesPosteFilter(row, posteFilter, models);
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
        return `<div class="ugap-bp-name-type-row">
            <div class="ugap-bp-name-field"><strong>Nom :</strong>
                <input type="text" class="ugap-bp-name-input" data-bp-id="${encId}" data-bp-field="label"
                    value="${escapeHtml(String(bp.label || ''))}" placeholder="Nom unique (ex. Roll bar)">
            </div>
            <div class="ugap-bp-type-field"><strong>Type :</strong>
                <select class="ugap-import-bp-select" data-bp-id="${encId}" data-bp-field="pricingMode">
                    <option value="fixed" ${mode === 'fixed' ? 'selected' : ''}>Fixe — un prix pour tous les postes</option>
                    <option value="per_model" ${mode === 'per_model' ? 'selected' : ''}>Par poste — prix différent par P1, P2…</option>
                </select>
            </div>
        </div>
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
        const root = document.querySelector('.ugap-import-bp-table-wrap');
        if (!root || root.dataset.bound === '1') return;
        root.dataset.bound = '1';

        root.addEventListener('change', (e) => {
            const el = e.target;
            const bpId = el.getAttribute('data-bp-id');
            if (!bpId) return;
            const field = el.getAttribute('data-bp-field');
            if (field === 'label') {
                const label = String(el.value || '').trim();
                const bp = getImportBaseProductsStore().find((x) => String(x.id) === String(bpId));
                updateImportBaseProductLocal(bpId, {
                    label,
                    key: buildBaseProductRegistryKey(label, bp || { id: bpId })
                });
                return;
            }
            if (field === 'pricingMode') {
                const id = String(bpId || '').trim();
                const bp = getImportBaseProductsStore().find((x) => String(x.id) === id);
                if (!bp) return;
                applyImportBaseProductPricingModeChange(bp, el.value);
                renderImportWorkflow();
            }
        });

        root.addEventListener('input', (e) => {
            const el = e.target;
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

    function syncImportBaseProductsFromAdjRows() {
        const models = getImportStagingModelsForAssignment();
        const rows = getImportRowsForBaseProductRegistry();
        if (!models.length || !rows.length) return [];
        const registry = buildImportMinorationBaseProductRegistry(rows, models);
        return syncImportBaseProductsFromRegistry(registry, models);
    }

    function propagateImportMinorationPostesByBaseProduct() {
        const models = getImportStagingModelsForAssignment();
        const adjRows = getImportRowsForBaseProductRegistry();
        const registry = buildImportMinorationBaseProductRegistry(adjRows, models);
        syncImportBaseProductsFromRegistry(registry, models);
        const products = getImportBaseProductsStore();
        let touched = 0;

        const propagateEntry = (optionIds, modelIds) => {
            if (!optionIds.length || !modelIds.length) return;
            const union = modelIds.filter(Boolean);
            optionIds.forEach((optId) => {
                const opt = findImportStagingOptionById(optId);
                if (!opt) return;
                const prev = (Array.isArray(opt.compatibleModels) ? opt.compatibleModels : []).map(String).sort().join(',');
                opt.compatibleModels = [...union];
                const now = opt.compatibleModels.map(String).sort().join(',');
                if (prev !== now) touched += 1;
            });
        };

        products.forEach((bp) => {
            propagateEntry(bp.optionIds || [], bp.modelIds || []);
        });
        if (!products.length) {
            registry.forEach((entry) => {
                propagateEntry(entry.optionIds, [...entry.modelIds]);
            });
        }

        return touched;
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
                ? `<div class="ugap-import-mino-label-raw"><strong>Libellé Excel :</strong> ${escapeHtml(unique[0])}</div>`
                : '';
        }
        const items = unique.map((l) => `<li>${escapeHtml(l)}</li>`).join('');
        return `<details class="ugap-bp-linked-minos-details" style="margin-top:6px;">
            <summary class="ugap-import-mino-hint">${unique.length} libellé(s) Excel</summary>
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
        const inputHtml = `<input type="text" class="ugap-mino-option-name-input${motorCls}" data-mino-field="importOptionLabelGroup"
                data-adj-group-opts="${encOptIdsAttr}" value="${escapeHtml(label)}"
                placeholder="Nom de l'option (renommer)">`;
        const extraHtml = `<span class="ugap-import-mino-hint">${group.options.length} lignes Excel regroupées</span>`;
        return `${sourceHint}
        ${renderImportAdjOptionNameTypeRowHtml(inputHtml, bp, models, extraHtml, sample, group)}
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
        const inputHtml = `<input type="text" class="ugap-mino-option-name-input${motorCls}" data-mino-opt-id="${encOptId}"
                data-mino-field="importOptionLabel" value="${escapeHtml(displayLabel)}"
                placeholder="Nom de l'option (renommer)">`;
        return `${sourceHint}
            ${renderImportAdjOptionNameTypeRowHtml(inputHtml, bp, modelList, '', opt, null)}
            ${renderImportMinorationPricesBlockHtml(opt, null, modelList, priceKind)}
            <div class="ugap-import-mino-label-raw"><strong>Libellé Excel :</strong> ${raw}</div>
            ${priceKind === 'majoration' ? renderImportDetachFromBaseProductButton(opt) : ''}`;
    }

    function renderImportMinorationRegistrySummary(registry, models) {
        if (!registry || !registry.size) return '';
        const allModels = Array.isArray(models) ? models : getImportStagingModelsForAssignment();
        const posteFilter = getImportPosteFilterValue();
        const modelList = filterImportModelsByPosteFilter(allModels, posteFilter);
        let products = syncImportBaseProductsFromRegistry(registry, allModels);
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
                Nom, type de prix et montants dans la colonne Détail — cochez les postes concernés.
                Fusion sur le champ <strong>Option</strong> (pas le libellé Excel). Libellés Option avec « base » : une ligne par occurrence.
                Même Option sans « base » sur plusieurs postes : fusion auto en « Par poste » si les prix diffèrent.
                Autres doublons : fusion manuelle via « Fusionner cette ligne dans… ».
                « Fixe » : un prix pour tous les postes. « Par poste » : prix différent par P1, P2…
            </div>
            <div class="ugap-import-mino-table-scroll ugap-import-bp-table-wrap" style="margin-top:10px;">
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
        </div>`;
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
        if (typeof isEmbeddedMode !== 'function' || !isEmbeddedMode()) return;
        try {
            if (window.parent && window.parent !== window) {
                window.parent.postMessage(payload, window.location.origin);
            }
        } catch (_e) { /* ignore */ }
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

    function maybeAutoSeedImportMinorationPostes() {
        const models = getImportStagingModelsForAssignment();
        const minos = getImportStagingOptionsFlat().filter(isImportMinorationOption);
        if (!models.length || !minos.length) return 0;
        if (wfState()?.minoAutoSeeded && !importAdjRowsNeverPosteSeeded(isImportMinorationOption)) return 0;
        const n = seedImportMinorationPosteAssignments();
        wfState().minoAutoSeeded = true;
        return n;
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
        if (!isImportBaseOptionsStepDone(staging)) return 'import-base-options';
        if (minoStatus !== 'validated') return 'minorations';
        if (majStatus !== 'validated') return 'majorations';
        if (String(staging?.progress?.optionsCompleted || '') === 'true' || staging?.progress?.optionsCompleted === true) {
            return 'validate';
        }
        return 'families-tri';
    }

    function runCompleteImportBaseOptionsFromAdj() {
        const rows = getImportRowsForBaseProductRegistry();
        const products = syncImportBaseProductsFromAdjRows();
        const majCount = rows.filter(isImportMajorationOption).length;
        const minoCount = rows.filter(isImportMinorationOption).length;
        showAlert(
            `${products.length} option(s) de base (${minoCount} mino + ${majCount} majo). Libellés « base » distincts ; même nom ailleurs fusionné (prix par poste si besoin).`,
            products.length ? 'success' : 'info'
        );
        renderImportWorkflow();
    }

    function renderImportBaseOptionsStepHtml() {
        ensureImportMinoStyles();
        const models = getImportStagingModelsForAssignment();
        const adjRows = getImportRowsForBaseProductRegistry();
        const minoCount = adjRows.filter(isImportMinorationOption).length;
        const majCount = adjRows.filter(isImportMajorationOption).length;

        if (!models.length) {
            return `<div class="ugap-import-mino-wrap">
                <p style="color:#b45309;">Validez d'abord les modèles (étape 1) avant de configurer les options de base.</p>
            </div>`;
        }

        const registry = buildImportMinorationBaseProductRegistry(adjRows, models);
        const registryCount = registry.size;
        const registryHtml = renderImportMinorationRegistrySummary(registry, models);

        if (!registryCount) {
            return `<div class="ugap-import-mino-wrap">
                <div class="ugap-import-mino-summary">
                    <strong>Étape 2 — Options de base</strong> — Aucune option de base détectée pour l'instant.
                </div>
                <p style="color:#6b7280;">Les options de base sont dérivées des minorations (MINO) et majorations (en remplacement, moteur…). Complétez après l'étape Majorations si besoin.</p>
                <div class="ugap-import-mino-toolbar">
                    <button type="button" class="btn btn-outline" onclick="switchImportWorkflowStep('minorations'); renderImportWorkflow();">Étape suivante → Minorations</button>
                </div>
            </div>`;
        }

        const posteFilter = getImportPosteFilterValue();
        const posteFilterHtml = renderImportPosteFilterHtml(models);
        const posteFilterNote = posteFilter
            ? ` <span style="color:#64748b;">(filtre poste P${escapeHtml(posteFilter)})</span>`
            : '';

        return `<div class="ugap-import-mino-wrap">
            <div class="ugap-import-mino-summary">
                <strong>Étape 2 — Options de base</strong> — ${registryCount} option(s) de base, ${models.length} modèle(s) validé(s).${posteFilterNote}
                <span style="color:#64748b;"> (${minoCount} mino, ${majCount} majo)</span>
            </div>
            <div class="ugap-import-mino-toolbar" style="margin-bottom:10px;">
                ${posteFilterHtml}
            </div>
            ${registryHtml}
            <div class="ugap-import-mino-toolbar">
                <button type="button" class="btn btn-outline" onclick="runCompleteImportBaseOptionsFromAdj()">Actualiser depuis mino / majorations</button>
                <button type="button" class="btn btn-outline" onclick="runPropagateImportMinorationPostes()">Compléter les postes (option de base)</button>
                <button type="button" class="btn btn-success" onclick="saveImportBaseOptionsStep()">Enregistrer options de base</button>
                <button type="button" class="btn btn-outline" onclick="switchImportWorkflowStep('minorations'); renderImportWorkflow();">Étape suivante → Minorations</button>
            </div>
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
            ? ` <span style="color:#64748b;">(${rowsForAssignTable.length} lignes Excel regroupées par Option)</span>`
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
                <button type="button" class="btn btn-success" onclick="${saveHandlerName}()">Enregistrer assignations</button>
                <button type="button" class="btn btn-outline" onclick="switchImportWorkflowStep('${escapeHtml(nextStep)}'); renderImportWorkflow();">${escapeHtml(nextLabel)}</button>
            </div>
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
        </div>`;
    }

    function renderImportMinorationsStepHtml() {
        return renderImportAssignStepHtml({
            stepTitle: 'Étape 3 — Minorations',
            filterFn: isImportMinorationOption,
            emptyModelsMsg: 'Validez d\'abord les modèles (étape 1) avant d\'assigner les minorations.',
            emptyRowsMsg: 'Aucune minoration détectée (réf. MINO). Réimportez le fichier Excel si besoin.',
            nextStep: 'majorations',
            nextLabel: 'Étape suivante → Majorations',
            seedHandlerName: 'runSeedImportMinorationPostes',
            saveHandlerName: 'saveImportMinorationsStep',
            priceKind: 'minoration',
            hideSuppressions: true,
            autoSeedFn: maybeAutoSeedImportMinorationPostes
        });
    }

    function renderImportMajorationsStepHtml() {
        return renderImportAssignStepHtml({
            stepTitle: 'Étape 4 — Majorations',
            filterFn: isImportMajorationOption,
            emptyModelsMsg: 'Validez d\'abord les modèles (étape 1) avant d\'assigner les majorations.',
            emptyRowsMsg: 'Aucune majoration détectée (en remplacement, en lieu et place, moteur…). Les PR et lignes MINO sont exclues.',
            nextStep: 'families-tri',
            nextLabel: 'Étape suivante → Options',
            seedHandlerName: 'runSeedImportMajorationPostes',
            saveHandlerName: 'saveImportMajorationsStep',
            priceKind: 'majoration',
            hideSuppressions: true,
            groupByFusionLabel: true,
            autoSeedFn: maybeAutoSeedImportMajorationPostes,
            extraToolbarHtml: '<button type="button" class="btn btn-outline" onclick="runCompleteImportBaseOptionsFromAdj()">Compléter options de base</button>'
        });
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
        if (typeof scheduleParentEmbedResize === 'function') scheduleParentEmbedResize();
        else if (typeof notifyParentEmbedResize === 'function') notifyParentEmbedResize();
    }

    function onImportMinorationsStepRendered() {
        bindImportMinorationAssignEditor();
        syncImportMinorationRecapDock();
        if (typeof scheduleParentEmbedResize === 'function') scheduleParentEmbedResize();
        else if (typeof notifyParentEmbedResize === 'function') notifyParentEmbedResize();
    }

    function onImportMajorationsStepRendered() {
        bindImportMinorationAssignEditor();
        syncImportMinorationRecapDock();
        if (typeof scheduleParentEmbedResize === 'function') scheduleParentEmbedResize();
        else if (typeof notifyParentEmbedResize === 'function') notifyParentEmbedResize();
    }

    function runSeedImportMinorationPostes() {
        const n = seedImportMinorationPosteAssignments();
        showAlert(`${n} ligne(s) mise(s) à jour (postes pré-cochés).`, n ? 'success' : 'info');
        renderImportWorkflow();
    }

    function runSeedImportMajorationPostes() {
        const n = seedImportMajorationPosteAssignments();
        showAlert(`${n} ligne(s) mise(s) à jour (postes pré-cochés).`, n ? 'success' : 'info');
        renderImportWorkflow();
    }

    function runPropagateImportMinorationPostes() {
        const n = propagateImportMinorationPostesByBaseProduct();
        showAlert(`${n} ligne(s) complétée(s) par option de base commune.`, n ? 'success' : 'info');
        renderImportWorkflow();
    }

    async function saveImportBaseOptionsStep() {
        const importId = stagingId();
        if (!staging() || !importId) {
            showAlert('Aucun import en cours.', 'warning');
            return;
        }
        try {
            const result = await apiCall(`/imports/staging/${encodeURIComponent(importId)}/base-products`, {
                method: 'POST',
                body: JSON.stringify({ baseProducts: getImportBaseProductsForSave() })
            });
            if (result?.data) {
                if (typeof window.__ugapSetImportStaging === 'function') {
                    window.__ugapSetImportStaging(result.data, result.data?._id);
                } else {
                    window.currentImportStaging = result.data;
                    window.currentImportId = String(result.data?._id || importId || '');
                }
            }
            showAlert('Options de base enregistrées.', 'success');
            renderImportStagingIndicator(staging());
            renderImportWorkflow();
        } catch (error) {
            showAlert('Erreur enregistrement options de base : ' + error.message, 'error');
        }
    }

    function mapImportAdjUpdateForSave(opt) {
        const row = {
            optionId: String(opt.id || '').trim(),
            compatibleModels: Array.isArray(opt.compatibleModels) ? opt.compatibleModels : [],
            importOptionLabel: String(opt.importOptionLabel || '').trim()
        };
        if (opt?.importExcludeFromBaseProduct) row.importExcludeFromBaseProduct = true;
        return row;
    }

    async function saveImportMinorationsStep() {
        const importId = stagingId();
        if (!staging() || !importId) {
            showAlert('Aucun import en cours.', 'warning');
            return;
        }
        const updates = getImportStagingOptionsFlat()
            .filter(isImportMinorationOption)
            .map(mapImportAdjUpdateForSave)
            .filter((row) => row.optionId);

        try {
            const result = await apiCall(`/imports/staging/${encodeURIComponent(importId)}/minorations`, {
                method: 'POST',
                body: JSON.stringify({ updates })
            });
            if (result?.data) {
                if (typeof window.__ugapSetImportStaging === 'function') {
                    window.__ugapSetImportStaging(result.data, result.data?._id);
                } else {
                    window.currentImportStaging = result.data;
                    window.currentImportId = String(result.data?._id || importId || '');
                }
            }
            showAlert('Assignations minorations enregistrées.', 'success');
            renderImportStagingIndicator(staging());
            renderImportWorkflow();
        } catch (error) {
            showAlert('Erreur enregistrement minorations : ' + error.message, 'error');
        }
    }

    async function saveImportMajorationsStep() {
        const importId = stagingId();
        if (!staging() || !importId) {
            showAlert('Aucun import en cours.', 'warning');
            return;
        }
        const updates = getImportStagingOptionsFlat()
            .filter(isImportMajorationOption)
            .map(mapImportAdjUpdateForSave)
            .filter((row) => row.optionId);

        try {
            const result = await apiCall(`/imports/staging/${encodeURIComponent(importId)}/majorations`, {
                method: 'POST',
                body: JSON.stringify({
                    updates,
                    baseProducts: getImportBaseProductsForSave()
                })
            });
            if (result?.data) {
                if (typeof window.__ugapSetImportStaging === 'function') {
                    window.__ugapSetImportStaging(result.data, result.data?._id);
                } else {
                    window.currentImportStaging = result.data;
                    window.currentImportId = String(result.data?._id || importId || '');
                }
            }
            showAlert('Assignations majorations enregistrées.', 'success');
            renderImportStagingIndicator(staging());
            renderImportWorkflow();
        } catch (error) {
            showAlert('Erreur enregistrement majorations : ' + error.message, 'error');
        }
    }

    window.isImportMinorationOption = isImportMinorationOption;
    window.isImportMajorationOption = isImportMajorationOption;
    window.isImportPrOption = isImportPrOption;
    window.isImportMotorMinoration = isImportMotorMinoration;
    window.getImportStagingOptionsFlat = getImportStagingOptionsFlat;
    window.getImportStagingModelsForAssignment = getImportStagingModelsForAssignment;
    window.findImportMotorBaseProduct = findImportMotorBaseProduct;
    window.resolveImportMinorationOptionLinks = resolveImportMinorationOptionLinks;
    window.seedImportMinorationPosteAssignments = seedImportMinorationPosteAssignments;
    window.propagateImportMinorationPostesByBaseProduct = propagateImportMinorationPostesByBaseProduct;
    window.toggleImportMinorationModelAssignment = toggleImportMinorationModelAssignment;
    window.toggleImportAdjGroupModelAssignment = toggleImportAdjGroupModelAssignment;

    window.toggleImportBaseProductModelAssignment = toggleImportBaseProductModelAssignment;
    window.runMergeImportBaseProduct = runMergeImportBaseProduct;
    window.renderImportBaseOptionsStepHtml = renderImportBaseOptionsStepHtml;
    window.renderImportMinorationsStepHtml = renderImportMinorationsStepHtml;
    window.renderImportMajorationsStepHtml = renderImportMajorationsStepHtml;
    window.syncImportMinorationRecapDock = syncImportMinorationRecapDock;
    window.runSeedImportMinorationPostes = runSeedImportMinorationPostes;
    window.runSeedImportMajorationPostes = runSeedImportMajorationPostes;
    window.runPropagateImportMinorationPostes = runPropagateImportMinorationPostes;
    window.runCompleteImportBaseOptionsFromAdj = runCompleteImportBaseOptionsFromAdj;
    window.saveImportBaseOptionsStep = saveImportBaseOptionsStep;
    window.saveImportMinorationsStep = saveImportMinorationsStep;
    window.saveImportMajorationsStep = saveImportMajorationsStep;
    window.runDetachImportAdjFromBaseProducts = runDetachImportAdjFromBaseProducts;
    window.maybeAutoSeedImportMinorationPostes = maybeAutoSeedImportMinorationPostes;
    window.maybeAutoSeedImportMajorationPostes = maybeAutoSeedImportMajorationPostes;
    window.resolveImportWorkflowResumeStep = resolveImportWorkflowResumeStep;
    window.getImportPosteFilterValue = getImportPosteFilterValue;
    window.renderImportPosteFilterHtml = renderImportPosteFilterHtml;
    window.onImportPosteFilterChange = onImportPosteFilterChange;
    window.importOptionMatchesPosteFilter = importOptionMatchesPosteFilter;
    window.importFamilyTriOptionMatchesPosteFilter = importFamilyTriOptionMatchesPosteFilter;
    window.onImportBaseOptionsStepRendered = onImportBaseOptionsStepRendered;
    window.onImportMinorationsStepRendered = onImportMinorationsStepRendered;
    window.onImportMajorationsStepRendered = onImportMajorationsStepRendered;
    window.formatMotorSourceHint = formatMotorSourceHint;

})();
