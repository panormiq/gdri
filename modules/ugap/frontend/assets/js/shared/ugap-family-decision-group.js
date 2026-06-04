/**
 * FICHIER : modules/ugap/frontend/assets/js/shared/ugap-family-decision-group.js
 * RÔLE : Schéma des groupes de décision (type, decisionMode, priceMode) — normalisation + selects HTML.
 *
 * ENTRÉES : objets groupe bruts ; catalogue types personnalisés (setCatalogGroupTypes)
 * SORTIES : groupes normalisés ; HTML <select> pour l’onglet Famille
 *
 * DÉPEND DE : —
 * NE PAS : logique UI familles (cartes, drag), persistance API
 *
 * APPELÉ PAR : admin.php, ugap-family-draft-ui.js
 */
(function initUgapFamilyDecisionGroup(global) {
    'use strict';

    const BUILTIN_GROUP_TYPES = [
        { value: 'model', label: 'Modèle' },
        { value: 'option', label: 'Option catalogue' },
        { value: 'static', label: 'Statique' },
        { value: 'garantie', label: 'Garantie' },
        { value: 'personnalise', label: 'Personnalisé' }
    ];

    const PRICE_MODES = [
        { value: 'option', label: 'Prix option (catalogue)' },
        { value: 'minoration', label: 'Minoration' },
        { value: 'majoration', label: 'Majoration' },
        { value: 'static', label: 'Statique / forfait' },
        { value: 'none', label: 'Aucun calcul prix' }
    ];

    const DECISION_MODES = [
        { value: 'single_choice', label: 'Choix unique' },
        { value: 'multi_choice', label: 'Choix multiple' }
    ];

    /** @type {Array<{value:string,label:string,defaultDecisionMode?:string,defaultPriceMode?:string}>} */
    let catalogGroupTypes = null;

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function slugifyTypeId(input) {
        return String(input || '')
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]+/g, '_')
            .replace(/^_+|_+$/g, '');
    }

    function setCatalogGroupTypes(types) {
        catalogGroupTypes = (Array.isArray(types) ? types : [])
            .map((t) => {
                const row = t && typeof t === 'object' ? t : {};
                const value = slugifyTypeId(row.value || row.id || row.title || '');
                const label = String(row.label || row.title || value || '').trim();
                if (!value || !label) return null;
                const defaultDecisionMode = String(row.defaultDecisionMode || '').trim();
                const defaultPriceMode = String(row.defaultPriceMode || '').trim();
                return {
                    value,
                    label,
                    defaultDecisionMode: defaultDecisionMode || undefined,
                    defaultPriceMode: defaultPriceMode || undefined
                };
            })
            .filter(Boolean);
    }

    /** Types intégrés + catalogue personnalisé (+ type courant si absent). */
    function getGroupTypesForSelect(selectedType) {
        const byValue = new Map();
        BUILTIN_GROUP_TYPES.forEach((t) => {
            byValue.set(t.value, { value: t.value, label: t.label });
        });
        (catalogGroupTypes || []).forEach((t) => {
            byValue.set(t.value, { value: t.value, label: t.label });
        });
        const sel = slugifyTypeId(selectedType);
        if (sel && !byValue.has(sel)) {
            byValue.set(sel, { value: sel, label: sel });
        }
        return Array.from(byValue.values());
    }

    function getCatalogTypeEntry(typeId) {
        const id = slugifyTypeId(typeId);
        if (!catalogGroupTypes || !catalogGroupTypes.length) return null;
        return catalogGroupTypes.find((t) => t.value === id) || null;
    }

    function normalizeType(raw) {
        const t = slugifyTypeId(raw);
        if (!t) return 'option';
        if (getCatalogTypeEntry(t)) return t;
        if (t === 'model') return 'model';
        if (t === 'static') return 'static';
        if (t === 'garantie' || t === 'garanties') return 'garantie';
        if (t === 'personnalise' || t === 'custom') return 'personnalise';
        if (catalogGroupTypes && catalogGroupTypes.length) return t;
        return 'option';
    }

    function normalizePriceMode(raw, type) {
        const legacy = String(raw?.priceMode ?? raw?.pricingMode ?? '').trim().toLowerCase();
        if (legacy === 'minoration' || legacy === 'majoration') return legacy;
        if (legacy === 'static') return 'static';
        if (legacy === 'none' || legacy === 'aucun') return 'none';
        if (legacy === 'addition') return 'option';
        if (legacy === 'option') return 'option';
        const t = normalizeType(type);
        if (t === 'static') return 'static';
        if (t === 'model') return 'option';
        return 'option';
    }

    function normalizeDecisionMode(raw) {
        return String(raw || '').trim().toLowerCase() === 'multi_choice' ? 'multi_choice' : 'single_choice';
    }

    function applyTypeDefaults(group, typeId) {
        const src = group && typeof group === 'object' ? { ...group } : {};
        const type = normalizeType(typeId || src.type);
        const entry = getCatalogTypeEntry(type);
        src.type = type;
        if (entry?.defaultDecisionMode) {
            src.decisionMode = normalizeDecisionMode(entry.defaultDecisionMode);
        }
        if (entry?.defaultPriceMode) {
            src.priceMode = normalizePriceMode({ priceMode: entry.defaultPriceMode }, type);
        }
        return src;
    }

    function newGroupWithTypeDefaults(partial) {
        const base = partial && typeof partial === 'object' ? { ...partial } : {};
        const types = getGroupTypesForSelect();
        const first = types[0];
        const type = normalizeType(base.type || first?.value || 'option');
        return normalizeGroup(applyTypeDefaults({ ...base, type }, type), 0) || {
            id: 'group_1',
            label: 'Groupe',
            type,
            decisionMode: 'single_choice',
            priceMode: 'option',
            keywords: '',
            optionIds: []
        };
    }

    function normalizeGroup(g, index) {
        const src = g && typeof g === 'object' ? g : {};
        const id = String(src.id || src.groupId || `group_${(Number(index) || 0) + 1}`).trim();
        const type = normalizeType(src.type);
        const label = String(src.label || id || '').trim();
        const decisionMode = normalizeDecisionMode(src.decisionMode);
        const priceMode = normalizePriceMode(src, type);
        const keywords = String(src.keywords || '').trim();
        const optionIds = (Array.isArray(src.optionIds) ? src.optionIds : [])
            .map((x) => String(x || '').trim())
            .filter(Boolean);
        const fallbackOptionIds = (Array.isArray(src.options) ? src.options : [])
            .map((opt) => {
                if (typeof opt === 'string') return String(opt || '').trim();
                return String(opt?.id || '').trim();
            })
            .filter(Boolean);
        const mergedOptionIds = Array.from(new Set([...(optionIds || []), ...fallbackOptionIds]));
        if (!id || !label) return null;
        const out = {
            id,
            groupId: id,
            label,
            type,
            decisionMode,
            priceMode,
            pricingMode: priceMode,
            keywords,
            optionIds: mergedOptionIds
        };
        const componentId = String(src.componentId || '').trim();
        const componentLabel = String(src.componentLabel || '').trim();
        if (componentId) out.componentId = componentId;
        if (componentLabel) out.componentLabel = componentLabel;
        return out;
    }

    function normalizeList(rawGroups) {
        return (Array.isArray(rawGroups) ? rawGroups : [])
            .map((g, index) => normalizeGroup(g, index))
            .filter(Boolean);
    }

    function renderSelectHtml(options, selected, attrs) {
        const sel = String(selected || '').trim();
        const attr = attrs || '';
        return options.map((o) => {
            const v = String(o.value || '');
            const selectedAttr = v === sel ? ' selected' : '';
            return `<option value="${escapeHtml(v)}"${selectedAttr}>${escapeHtml(o.label)}</option>`;
        }).join('');
    }

    function getTypeLabel(value) {
        const types = getGroupTypesForSelect(value);
        return types.find((o) => o.value === value)?.label || value;
    }

    function getPriceModeLabel(value) {
        return PRICE_MODES.find((o) => o.value === value)?.label || value;
    }

    function getDecisionModeLabel(value) {
        return DECISION_MODES.find((o) => o.value === value)?.label || value;
    }

    function renderTypeSelect(selectId, selected, extraStyle) {
        const style = extraStyle || 'width:100%; padding:6px; border:1px solid #ddd; border-radius:4px;';
        return `<select id="${escapeHtml(selectId)}" style="${style}">${renderSelectHtml(getGroupTypesForSelect(selected), selected)}</select>`;
    }

    function renderPriceModeSelect(selectId, selected, extraStyle) {
        const style = extraStyle || 'width:100%; padding:6px; border:1px solid #ddd; border-radius:4px;';
        return `<select id="${escapeHtml(selectId)}" style="${style}">${renderSelectHtml(PRICE_MODES, selected)}</select>`;
    }

    function renderDecisionModeSelect(selectId, selected, extraStyle) {
        const style = extraStyle || 'width:100%; padding:6px; border:1px solid #ddd; border-radius:4px;';
        return `<select id="${escapeHtml(selectId)}" style="${style}">${renderSelectHtml(DECISION_MODES, selected)}</select>`;
    }

    function renderTypeSelectInline(selected, onchangeHandler) {
        const opts = getGroupTypesForSelect(selected).map((o) => {
            const s = o.value === selected ? ' selected' : '';
            return `<option value="${escapeHtml(o.value)}"${s}>${escapeHtml(o.label)}</option>`;
        }).join('');
        return `<select onchange="${onchangeHandler}" style="width:100%;padding:4px;font-size:12px;">${opts}</select>`;
    }

    function renderPriceModeSelectInline(selected, onchangeHandler) {
        const opts = PRICE_MODES.map((o) => {
            const s = o.value === selected ? ' selected' : '';
            return `<option value="${escapeHtml(o.value)}"${s}>${escapeHtml(o.label)}</option>`;
        }).join('');
        return `<select onchange="${onchangeHandler}" style="width:100%;padding:4px;font-size:12px;">${opts}</select>`;
    }

    function renderDecisionModeSelectInline(selected, onchangeHandler) {
        const opts = DECISION_MODES.map((o) => {
            const s = o.value === selected ? ' selected' : '';
            return `<option value="${escapeHtml(o.value)}"${s}>${escapeHtml(o.label)}</option>`;
        }).join('');
        return `<select onchange="${onchangeHandler}" style="width:100%;padding:4px;font-size:12px;">${opts}</select>`;
    }

    function renderOptionalDecisionModeSelect(selected, onchangeHandler) {
        const opts = [
            { value: '', label: '— (aucun par défaut) —' },
            ...DECISION_MODES
        ];
        return `<select onchange="${onchangeHandler}" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;">${renderSelectHtml(opts, selected || '')}</select>`;
    }

    function renderOptionalPriceModeSelect(selected, onchangeHandler) {
        const opts = [
            { value: '', label: '— (aucun par défaut) —' },
            ...PRICE_MODES
        ];
        return `<select onchange="${onchangeHandler}" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;">${renderSelectHtml(opts, selected || '')}</select>`;
    }

    function renderGroupEditorRowHtml(idPrefix, rowIdx, g, extra) {
        const prefix = String(idPrefix || 'family-group').trim();
        const opts = extra && typeof extra === 'object' ? extra : {};
        const row = normalizeGroup(g, rowIdx) || newGroupWithTypeDefaults({
            id: `group_${rowIdx + 1}`,
            label: 'Groupe'
        });
        const inputStyle = 'width:100%; padding:6px; border:1px solid #ddd; border-radius:4px; font-size:12px;';
        const removeBtn = opts.removeButtonHtml
            || `<button type="button" class="btn btn-outline" style="font-size:12px; padding:4px 8px;">Suppr.</button>`;
        return `<tr>
            <td style="padding:8px; border-bottom:1px solid #eee;">
                <input id="${escapeHtml(prefix)}-id-${rowIdx}" value="${escapeHtml(row.id)}" readonly tabindex="-1" style="${inputStyle} background:#f8f9fa;">
            </td>
            <td style="padding:8px; border-bottom:1px solid #eee;">
                <input id="${escapeHtml(prefix)}-label-${rowIdx}" value="${escapeHtml(row.label)}" style="${inputStyle} background:#fff;">
            </td>
            <td style="padding:8px; border-bottom:1px solid #eee;">
                ${renderTypeSelect(`${prefix}-type-${rowIdx}`, row.type, inputStyle)}
            </td>
            <td style="padding:8px; border-bottom:1px solid #eee;">
                ${renderPriceModeSelect(`${prefix}-price-${rowIdx}`, row.priceMode, inputStyle)}
            </td>
            <td style="padding:8px; border-bottom:1px solid #eee;">
                ${renderDecisionModeSelect(`${prefix}-decision-${rowIdx}`, row.decisionMode, inputStyle)}
            </td>
            <td style="padding:8px; border-bottom:1px solid #eee;">
                <input id="${escapeHtml(prefix)}-keywords-${rowIdx}" value="${escapeHtml(row.keywords)}" placeholder="Ex: coloris, finition" style="${inputStyle} background:#fff;">
            </td>
            <td style="padding:8px; border-bottom:1px solid #eee; text-align:center;">
                ${removeBtn}
            </td>
        </tr>`;
    }

    const GROUP_EDITOR_TABLE_HEADERS = `
        <th style="padding:8px; border-bottom:1px solid #eee; text-align:left;">id</th>
        <th style="padding:8px; border-bottom:1px solid #eee; text-align:left;">label</th>
        <th style="padding:8px; border-bottom:1px solid #eee; text-align:left;">Type</th>
        <th style="padding:8px; border-bottom:1px solid #eee; text-align:left;">Mode prix</th>
        <th style="padding:8px; border-bottom:1px solid #eee; text-align:left;">Décision</th>
        <th style="padding:8px; border-bottom:1px solid #eee; text-align:left;">Mot-clé</th>
        <th style="padding:8px; border-bottom:1px solid #eee; text-align:center;">Action</th>
    `;

    global.UgapFamilyDecisionGroup = {
        BUILTIN_GROUP_TYPES,
        GROUP_TYPES: BUILTIN_GROUP_TYPES,
        PRICE_MODES,
        DECISION_MODES,
        setCatalogGroupTypes,
        getGroupTypesForSelect,
        getCatalogTypeEntry,
        applyTypeDefaults,
        newGroupWithTypeDefaults,
        normalizeType,
        normalizePriceMode,
        normalizeDecisionMode,
        normalizeGroup,
        normalizeList,
        getTypeLabel,
        getPriceModeLabel,
        getDecisionModeLabel,
        renderTypeSelect,
        renderPriceModeSelect,
        renderDecisionModeSelect,
        renderTypeSelectInline,
        renderPriceModeSelectInline,
        renderDecisionModeSelectInline,
        renderOptionalDecisionModeSelect,
        renderOptionalPriceModeSelect,
        renderGroupEditorRowHtml,
        GROUP_EDITOR_TABLE_HEADERS
    };
})(typeof window !== 'undefined' ? window : globalThis);
