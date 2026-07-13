/**
 * FICHIER : parametrage/assets/js/liaisons/liaisons-option-picker.js
 * RÔLE : Modal recherche option (nom, Excel, réf. UGAP…) — sélection unique.
 */
(function initUgapLiaisonsOptionPicker(global) {
    'use strict';

    const MODAL_ID = 'ugap-liaisons-option-picker-modal';
    let activeContext = null;

    function esc(v) {
        if (typeof global.escapeHtml === 'function') return global.escapeHtml(v);
        return String(v ?? '');
    }

    function TextMatch() {
        return global.UgapOptionTextMatch || null;
    }

    function normalizeText(value) {
        const TM = TextMatch();
        if (TM?.normalizeText) return TM.normalizeText(value);
        return String(value || '').toLowerCase();
    }

    function buildPickerRow(opt, categoryName) {
        const id = String(opt?.id || '').trim();
        const OLK = global.UgapOptionLineKind;
        const kind = OLK?.inferOptionLineKind ? OLK.inferOptionLineKind(opt) : 'option';
        const BAL = global.UgapBaseAdjLinks;
        let typeLabel = 'Catalogue';
        if (BAL?.isImportGeneratedBaseOption?.(opt)) typeLabel = 'Base';
        else if (kind === 'minoration') typeLabel = 'MINO';
        else if (kind === 'majoration') typeLabel = 'MAJO';
        else if (kind === 'pr') typeLabel = 'PR';
        else if (opt?.isBaseOption || opt?.baseIncluded) typeLabel = 'Base';

        return {
            id,
            name: String(opt?.name || id).trim(),
            importExcelLabel: String(opt?.importExcelLabel || opt?.details || '').trim(),
            refUgap: String(opt?.refUgap || '').trim(),
            refFournisseur: String(opt?.refFournisseur || '').trim(),
            baseRefUgap: String(opt?.baseRefUgap || '').trim(),
            categoryName: String(categoryName || opt?.__categoryName || '').trim(),
            optionType: kind,
            optionTypeLabel: typeLabel,
            familyLabel: String(opt?.familyLabel || '').trim(),
        };
    }

    function collectAllOptionRows(data) {
        const categories = Array.isArray(data?.categories) ? data.categories : [];
        const rows = [];
        categories.forEach((cat) => {
            const categoryName = String(cat?.name || '').trim();
            (Array.isArray(cat?.options) ? cat.options : []).forEach((opt) => {
                if (!opt || typeof opt !== 'object') return;
                const row = buildPickerRow(opt, categoryName);
                if (row.id) rows.push(row);
            });
        });
        rows.sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'fr'));
        return rows;
    }

    function rowMatchesFilter(row, query) {
        const TM = TextMatch();
        if (TM?.rowMatchesOptionsFilter) return TM.rowMatchesOptionsFilter(row, query);
        const q = normalizeText(query);
        if (!q) return true;
        const hay = normalizeText([
            row.name,
            row.importExcelLabel,
            row.refUgap,
            row.refFournisseur,
            row.baseRefUgap,
            row.categoryName,
            row.optionTypeLabel,
            row.familyLabel,
        ].join(' '));
        return hay.includes(q);
    }

    function ensureModal() {
        if (global.document.getElementById(MODAL_ID)) return;
        const wrap = global.document.createElement('div');
        wrap.innerHTML = `
            <div id="${MODAL_ID}" class="ugap-catalog-opt-modal" hidden role="dialog" aria-modal="true" aria-labelledby="ugap-liaisons-option-picker-title">
                <div class="ugap-catalog-opt-modal__backdrop" data-liaisons-opt-picker-close></div>
                <div class="ugap-catalog-opt-modal__panel">
                    <header class="ugap-catalog-opt-modal__head">
                        <h3 id="ugap-liaisons-option-picker-title">Choisir une option</h3>
                        <button type="button" class="ugap-catalog-opt-modal__close" data-liaisons-opt-picker-close aria-label="Fermer">×</button>
                    </header>
                    <div class="ugap-catalog-opt-modal__filters">
                        <input type="search" id="ugap-liaisons-option-picker-search" class="ugap-catalog-opt-modal__search"
                            placeholder="Nom, libellé Excel, réf. UGAP, fournisseur…" autocomplete="off">
                    </div>
                    <p class="ugap-catalog-opt-modal__hint" id="ugap-liaisons-option-picker-hint"></p>
                    <div class="ugap-liaisons-option-picker-table-wrap">
                        <table class="ugap-detect-table ugap-liaisons-option-picker-table">
                            <thead>
                                <tr>
                                    <th>Option</th>
                                    <th>Type</th>
                                    <th>Libellé Excel</th>
                                    <th>Réf. UGAP</th>
                                </tr>
                            </thead>
                            <tbody id="ugap-liaisons-option-picker-tbody"></tbody>
                        </table>
                    </div>
                    <footer class="ugap-catalog-opt-modal__foot">
                        <button type="button" class="btn btn-outline" data-liaisons-opt-picker-close>Fermer</button>
                    </footer>
                </div>
            </div>
        `;
        const modal = wrap.firstElementChild;
        global.document.body.appendChild(modal);
        modal.querySelectorAll('[data-liaisons-opt-picker-close]').forEach((el) => {
            el.addEventListener('click', close);
        });
        const search = global.document.getElementById('ugap-liaisons-option-picker-search');
        if (search) {
            search.addEventListener('input', () => renderList());
            search.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') close();
            });
        }
    }

    function renderList() {
        const tbody = global.document.getElementById('ugap-liaisons-option-picker-tbody');
        const hint = global.document.getElementById('ugap-liaisons-option-picker-hint');
        if (!tbody || !activeContext) return;

        const query = String(global.document.getElementById('ugap-liaisons-option-picker-search')?.value || '').trim();
        const exclude = new Set(
            (Array.isArray(activeContext.excludeOptionIds) ? activeContext.excludeOptionIds : [])
                .map((x) => String(x || '').trim())
                .filter(Boolean)
        );

        const filtered = (activeContext.rows || []).filter((row) => {
            if (exclude.has(row.id)) return false;
            return rowMatchesFilter(row, query);
        });

        if (hint) {
            hint.textContent = `${filtered.length} option(s) affichée(s) sur ${(activeContext.rows || []).length}`;
        }

        if (!filtered.length) {
            tbody.innerHTML = '<tr><td colspan="4"><p class="ugap-catalog-opt-modal__empty">Aucune option pour ce filtre.</p></td></tr>';
            return;
        }

        tbody.innerHTML = filtered.map((row) => `
            <tr class="ugap-liaisons-option-picker-row" data-option-id="${esc(row.id)}" tabindex="0" role="button">
                <td><strong>${esc(row.name || row.id)}</strong></td>
                <td><span class="ugap-option-tag ugap-option-tag--kind">${esc(row.optionTypeLabel)}</span></td>
                <td style="font-size:12px;color:#64748b;">${row.importExcelLabel ? esc(row.importExcelLabel) : '—'}</td>
                <td style="font-size:12px;"><code>${row.refUgap ? esc(row.refUgap) : '—'}</code></td>
            </tr>
        `).join('');

        tbody.querySelectorAll('.ugap-liaisons-option-picker-row').forEach((tr) => {
            const pick = () => {
                const oid = String(tr.getAttribute('data-option-id') || '').trim();
                if (!oid || !activeContext?.onPick) return;
                void Promise.resolve(activeContext.onPick(oid))
                    .then(() => close())
                    .catch((err) => {
                        global.showAlert?.(err?.message || String(err), 'error');
                    });
            };
            tr.addEventListener('click', pick);
            tr.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    pick();
                }
            });
        });
    }

    function close() {
        const modal = global.document.getElementById(MODAL_ID);
        if (modal) modal.setAttribute('hidden', '');
        activeContext = null;
    }

    function open(context) {
        const ctx = context && typeof context === 'object' ? context : {};
        if (typeof ctx.onPick !== 'function') {
            global.showAlert?.('Picker liaisons : handler manquant.', 'error');
            return;
        }
        const data = ctx.data;
        const rows = Array.isArray(ctx.rows) && ctx.rows.length
            ? ctx.rows
            : collectAllOptionRows(data);
        if (!rows.length) {
            global.showAlert?.('Aucune option disponible.', 'warning');
            return;
        }

        ensureModal();
        activeContext = {
            ...ctx,
            rows,
        };

        const title = global.document.getElementById('ugap-liaisons-option-picker-title');
        if (title) title.textContent = String(ctx.title || 'Choisir une option');

        const search = global.document.getElementById('ugap-liaisons-option-picker-search');
        if (search) {
            search.value = String(ctx.initialQuery || '');
        }

        const modal = global.document.getElementById(MODAL_ID);
        modal?.removeAttribute('hidden');
        renderList();
        search?.focus();
        if (typeof global.scheduleParentEmbedResize === 'function') global.scheduleParentEmbedResize();
    }

    global.UgapLiaisonsOptionPicker = {
        open,
        close,
        collectAllOptionRows,
    };
})(typeof window !== 'undefined' ? window : globalThis);
