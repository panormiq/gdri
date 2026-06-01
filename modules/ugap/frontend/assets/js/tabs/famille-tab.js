/**
 * FICHIER : modules/ugap/frontend/assets/js/tabs/famille-tab.js
 * RÔLE : Rendu workspace Famille (cartes, drag-drop, onglet inner HTML).
 * NE PAS : état persistant (famille-state.js), gabarits (famille-gabarits.js), traitement IA (admin legacy).
 */
(function initUgapFamilleTabModule() {
    'use strict';

    if (!window.UgapFamilleTab) window.UgapFamilleTab = {};

    window.UgapFamilleTab.renderFamilleTabInner = function renderFamilleTabInner(splitOptions) {
        if (typeof window.__legacyRenderFamilleTabInner === 'function') {
            return window.__legacyRenderFamilleTabInner(splitOptions);
        }
        if (typeof window.pruneFamilleMergePick === 'function') window.pruneFamilleMergePick();
        if (!window.__ugapFamilleRepassIndices) window.__ugapFamilleRepassIndices = new Set();

        const combined = typeof window.buildFamilleCombinedRows === 'function'
            ? window.buildFamilleCombinedRows(splitOptions)
            : [];
        if (typeof window.upsertFamilleOptionLabelCache === 'function') {
            window.upsertFamilleOptionLabelCache(combined.map((r) => ({ id: r.id, name: r.name })));
        }
        const byId = new Map(combined.map((r) => [r.id, r]));
        const iaData = window.__ugapFamilleIa || null;
        const renderIa = window.renderFamilleIaGroupCards;
        const iaBlock = iaData && typeof renderIa === 'function'
            ? renderIa(iaData, byId)
            : '<p style="color:#666; margin:0;">Aucun regroupement encore : lancez <strong>Détecter familles (IA)</strong> (config IA entreprise).</p>';

        const review = window.__ugapFamilleReview || null;
        const editFamilies = Array.isArray(review?.editFamilies) ? review.editFamilies : [];
        const cardsFn = window.UgapFamilleTab.renderFamilyCardsList;
        const reviewCardsHtml = editFamilies.length && typeof cardsFn === 'function'
            ? `<div style="margin-top:20px; border-top:1px solid #e5e7eb; padding-top:14px;">
                    <div style="font-weight:600; margin-bottom:8px;">Relecture / édition des familles</div>
                    ${cardsFn(editFamilies, byId, 'review', editFamilies)}
                   </div>`
            : '';

        return `
                <div class="famille-tab-root" style="padding-bottom:32px;">
                <div style="margin-top:14px;">${iaBlock}</div>
                ${reviewCardsHtml}
                </div>
            `;
    };



    window.UgapFamilleTab.runFamilleTraitement = async function runFamilleTraitement() {

        if (typeof window.__legacyRunFamilleTraitement === 'function') {

            return window.__legacyRunFamilleTraitement();

        }

        return null;

    };



    window.UgapFamilleTab.renderFamilyCardsList = function renderFamilyCardsList(families, byId, sourceKey, allFamilies) {

        if (!Array.isArray(families) || families.length === 0) {

            return '<p style="color:#666; margin:0;">Aucune famille.</p>';

        }

        const ui = window.getFamilleUiState();

        if (!ui.collapsedFamilyIds || typeof ui.collapsedFamilyIds !== 'object') {

            ui.collapsedFamilyIds = {};

        }

        const familyStageValidated = true;

        const review = window.__ugapFamilleReview || {};

        const allNames = Array.from(new Set((review.editFamilies || []).map((x) => String(x.familyLabel || '').trim()).filter(Boolean)));

        const allList = Array.isArray(allFamilies) && allFamilies.length ? allFamilies : families;

        const byParent = new Map();

        allList.forEach((f) => {

            const parentId = String(f?.parentReviewId || '').trim();

            const key = parentId || '__root__';

            if (!byParent.has(key)) byParent.set(key, []);

            byParent.get(key).push(f);

        });



        const renderCard = (f, depth) => {

            if ((ui.hiddenIds || []).includes(f.reviewId)) return '';

            const label = f.familyLabel || 'Famille';

            const lockBadge = window.isFamNameOptionsLocked(f)

                ? '<span style="display:inline-block; padding:2px 6px; border-radius:999px; background:#fff3cd; color:#856404; font-size:9px; font-weight:700; border:1px solid #ffe69c;">Verrouillée</span>'

                : '';

            const ids = Array.isArray(f.optionIds) ? f.optionIds : [];

            const defId = f.defaultOptionId != null && String(f.defaultOptionId).trim() !== '' ? String(f.defaultOptionId).trim() : null;

            const rows = ids.map((id) => byId.get(id)).filter(Boolean);

            const hasParent = !!f.parentReviewId;

            const childOffset = hasParent ? `margin-left:${Math.min(depth * 18, 90)}px;` : '';

            const childList = byParent.get(String(f.reviewId || '')) || [];

            const hasChildren = childList.length > 0;

            const isCollapsed = !!ui.collapsedFamilyIds[String(f.reviewId || '')];

            const existingSubs = Array.from(new Set(Object.values(f.optionSubFamilies || {}).map((x) => String(x || '').trim()).filter(Boolean)));

            const subChoices = Array.from(new Set([...allNames, ...existingSubs])).sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' }));

            const rowsHtml = rows.map((row) => {

                const curSub = String((f.optionSubFamilies && f.optionSubFamilies[row.id]) || '').trim();

                return `

                <tr style="white-space:nowrap;">

                    <td style="padding:4px 6px; border-bottom:1px solid #eee; font-size:11px; width:26px; text-align:center; vertical-align:middle;">

                        ${familyStageValidated ? `<input type="checkbox" class="fam-option-cb" data-review-id="${window.escapeHtml(f.reviewId || '')}" data-option-id="${window.escapeHtml(row.id || '')}" ${(Array.isArray(f.selectedOptionIds) ? f.selectedOptionIds : []).includes(row.id) ? 'checked' : ''}>` : ''}

                    </td>

                    <td style="padding:4px 6px; border-bottom:1px solid #eee; font-size:11px; overflow:hidden; text-overflow:ellipsis; max-width:min(380px,50vw); vertical-align:middle;" draggable="${familyStageValidated ? 'true' : 'false'}" data-option-drag-id="${window.escapeHtml(row.id || '')}" data-option-from-family="${window.escapeHtml(f.reviewId || '')}" title="${window.escapeHtml(row.name || '')}">${window.escapeHtml(row.lineKindLabel || '')} · ${window.escapeHtml(row.name || '—')}${defId === row.id ? ' <span style="font-size:10px; color:#664d03;">(défaut)</span>' : ''}</td>

                    <td style="padding:4px 6px; border-bottom:1px solid #eee; font-size:11px; width:130px; vertical-align:middle;">

                        <select class="fam-card-sub-select" data-review-id="${window.escapeHtml(f.reviewId || '')}" data-option-id="${window.escapeHtml(row.id || '')}" style="width:100%; max-width:124px; padding:3px 4px; font-size:11px; border:1px solid #ddd; border-radius:4px; box-sizing:border-box;">

                            <option value="">Aucune</option>

                            ${subChoices.map((s) => `<option value="${window.escapeHtml(s)}" ${curSub === s ? 'selected' : ''}>${window.escapeHtml(s)}</option>`).join('')}

                        </select>

                    </td>

                </tr>`;

            }).join('');

            const labelReadonly = f.source === 'ia' ? '' : 'readonly';

            const levelColor = hasParent ? '#f8fbff' : '#f8f9fa';

            const borderColor = hasParent ? '#d9e5f4' : '#dee2e6';

            const childrenHtml = hasChildren && !isCollapsed

                ? childList.map((child) => renderCard(child, depth + 1)).join('')

                : '';

            return `

                <div>

                <div class="fam-review-card" draggable="true" data-review-id="${window.escapeHtml(f.reviewId || '')}" style="margin-bottom:8px; border:1px solid ${borderColor}; border-radius:8px; overflow:hidden; background:#fff; box-shadow:0 1px 4px rgba(15, 76, 129, 0.08); ${childOffset}">

                    <div class="fam-card-header" style="padding:7px 9px; background:${levelColor}; border-bottom:1px solid ${borderColor}; display:flex; justify-content:space-between; align-items:center; gap:6px; flex-wrap:wrap;">

                        <label style="display:flex; align-items:center; gap:6px; margin:0; cursor:pointer; flex-shrink:0;" title="Fusion">

                            <input type="checkbox" class="fam-col-merge-cb" data-merge-col="${window.escapeHtml(sourceKey)}" data-review-id="${window.escapeHtml(f.reviewId || '')}" value="${window.escapeHtml(f.reviewId || '')}">

                        </label>

                        <div style="display:flex; align-items:center; gap:6px; margin:0; flex:1; flex-wrap:wrap; min-width:0;">

                            ${hasChildren ? `<button type="button" class="btn btn-outline fam-tree-toggle" data-review-id="${window.escapeHtml(f.reviewId || '')}" style="padding:2px 6px; font-size:10px;">${isCollapsed ? '▸' : '▾'}</button>` : `<span style="width:22px;"></span>`}

                            <span class="fam-card-drag-handle" draggable="true" data-review-id="${window.escapeHtml(f.reviewId || '')}" title="Glisser pour déplacer sous une autre famille" style="display:inline-flex; align-items:center; justify-content:center; width:22px; height:20px; border:1px solid #d1d5db; border-radius:4px; cursor:grab; color:#6b7280; user-select:none;">⋮⋮</span>

                            <strong style="font-size:11px; flex-shrink:0;">Famille</strong>

                            ${lockBadge}

                            <input type="text" class="fam-label-input" data-review-id="${window.escapeHtml(f.reviewId || '')}" value="${window.escapeHtml(label)}" style="padding:3px 6px; border:1px solid #ddd; border-radius:4px; font-size:11px; min-width:120px; flex:1;" ${labelReadonly}>

                        </div>

                        <span style="font-size:10px; color:#0f4c81; white-space:nowrap; font-weight:600;">${ids.length} ligne(s)${hasChildren ? ` · ${childList.length} sous-famille(s)` : ''}</span>

                    </div>

                    <div style="padding:6px 8px; max-height:26vh; overflow:auto;">

                        <table style="width:100%; border-collapse:collapse;"><tbody>${rowsHtml || '<tr><td colspan="3" style="padding:6px; color:#999;">Aucune ligne</td></tr>'}</tbody></table>

                    </div>

                    <p style="margin:0; padding:3px 8px 5px; font-size:9px; color:#4b5563;">Glisser carte sur carte: sous-famille · double-clic: panneau d’édition</p>

                </div>

                ${childrenHtml}

                </div>

            `;

        };



        const roots = byParent.get('__root__') || [];

        const rootsSafe = roots.length ? roots : allList;

        return rootsSafe.map((f) => renderCard(f, 0)).join('');

    };



    window.UgapFamilleTab.ensureFamilleCardGlobalInteractions = function ensureFamilleCardGlobalInteractions() {

        if (window.__familleCardGlobalInteractionsBound) return;

        window.__familleCardGlobalInteractionsBound = true;



        document.addEventListener('dragstart', (e) => {

            const card = e.target?.closest?.('.fam-name-card, .fam-review-card, .fam-validated-card');

            if (!card) return;

            let reviewId = card.getAttribute('data-review-id');

            if (!reviewId && card.classList.contains('fam-validated-card')) {

                const savedIdx = card.getAttribute('data-validated-index');

                const fam = window.ensureReviewFamilyFromSavedIndex(savedIdx);

                reviewId = fam?.reviewId || '';

            }

            if (!reviewId || !e.dataTransfer) return;

            e.dataTransfer.effectAllowed = 'move';

            e.dataTransfer.setData('text/family-review-id', reviewId);

        }, true);



        document.addEventListener('dblclick', (e) => {

            const card = e.target?.closest?.('.fam-name-card, .fam-review-card, .fam-validated-card');

            if (!card) return;

            const mainTab = document.querySelector('.tab.active')?.getAttribute('data-tab');

            if (mainTab !== 'famille') return;

            if (e.target?.closest?.('button, input, select, textarea, label')) return;

            let reviewId = card.getAttribute('data-review-id');

            if (!reviewId && card.classList.contains('fam-validated-card')) {

                const savedIdx = card.getAttribute('data-validated-index');

                const fam = window.ensureReviewFamilyFromSavedIndex(savedIdx);

                reviewId = fam?.reviewId || '';

            }

            if (!reviewId) return;

            const byId = window.buildFamilleModalByIdMap();

            window.mountFamilleInlineEditor(reviewId, byId);

        }, true);



        document.addEventListener('dragover', (e) => {

            if (e.target?.closest?.('.fam-review-card, .fam-modal-col-right-drop')) {

                e.preventDefault();

            }

        }, true);



        document.addEventListener('drop', (e) => {

            const mainTab = document.querySelector('.tab.active')?.getAttribute('data-tab');

            if (mainTab !== 'famille') return;



            const state = window.__ugapFamilleReview;

            const fams = Array.isArray(state?.editFamilies) ? state.editFamilies : [];

            if (fams.length === 0) return;



            const familyDraggedId = String(e.dataTransfer?.getData('text/family-review-id') || '').trim();

            const optionId = String(e.dataTransfer?.getData('text/option-id') || '').trim();

            const optionFromFamily = String(e.dataTransfer?.getData('text/option-from-family') || '').trim();

            const dropOnCard = e.target?.closest?.('.fam-review-card');



            if (familyDraggedId && dropOnCard) {

                e.preventDefault();

                const targetId = dropOnCard.getAttribute('data-review-id');

                if (!targetId || targetId === familyDraggedId) return;

                const dragged = fams.find((x) => x.reviewId === familyDraggedId);

                if (!dragged) return;

                dragged.parentReviewId = targetId;

                window.syncReviewStateIntoIaResult();

                window.renderExtractionInsights();

                return;

            }



            if (optionId && optionFromFamily && dropOnCard) {

                e.preventDefault();

                const targetFamily = dropOnCard.getAttribute('data-review-id');

                if (!targetFamily || targetFamily === optionFromFamily) return;

                const from = fams.find((x) => x.reviewId === optionFromFamily);

                const to = fams.find((x) => x.reviewId === targetFamily);

                if (!from || !to) return;

                if (window.isFamNameOptionsLocked(from)) {

                    const locked = new Set((Array.isArray(from.lockedOptionIds) ? from.lockedOptionIds : []).map((id) => String(id)));

                    if (locked.has(optionId)) {

                        window.showAlert('Option verrouillée: déplacement interdit depuis cette famille.', 'warning');

                        return;

                    }

                }

                from.optionIds = (from.optionIds || []).filter((id) => id !== optionId);

                from.selectedOptionIds = (from.selectedOptionIds || []).filter((id) => id !== optionId);

                if (!to.optionIds.includes(optionId)) to.optionIds.push(optionId);

                if (!to.selectedOptionIds.includes(optionId)) to.selectedOptionIds.push(optionId);

                window.syncReviewStateIntoIaResult();

                window.renderExtractionInsights();

            }

        }, true);

    };



    window.UgapFamilleTab.bindPostRenderInteractions = function bindPostRenderInteractions() {

        document.querySelectorAll('.fam-unassigned-row').forEach((row) => {

            row.addEventListener('dragstart', (e) => {

                if (!e.dataTransfer) return;

                const optionId = String(row.getAttribute('data-option-id') || '').trim();

                if (!optionId) return;

                e.dataTransfer.effectAllowed = 'copyMove';

                e.dataTransfer.setData('text/fam-unassigned-option-id', optionId);

                row.style.opacity = '0.6';

            });

            row.addEventListener('dragend', () => {

                row.style.opacity = '';

            });

        });



        document.querySelectorAll('.fam-card-drag-handle').forEach((handle) => {

            handle.addEventListener('dragstart', (e) => {

                e.stopPropagation();

                if (!e.dataTransfer) return;

                e.dataTransfer.setData('text/family-review-id', handle.getAttribute('data-review-id'));

                e.dataTransfer.effectAllowed = 'move';

            });

        });



        document.querySelectorAll('[data-option-drag-id]').forEach((cell) => {

            cell.addEventListener('dragstart', (e) => {

                if (!e.dataTransfer) return;

                e.dataTransfer.setData('text/option-id', cell.getAttribute('data-option-drag-id'));

                e.dataTransfer.setData('text/option-from-family', cell.getAttribute('data-option-from-family'));

            });

        });



        document.querySelectorAll('.fam-tree-toggle').forEach((btn) => {

            btn.onclick = null;

            btn.addEventListener('click', (e) => {

                e.preventDefault();

                e.stopPropagation();

                const reviewId = String(btn.getAttribute('data-review-id') || '').trim();

                if (!reviewId || typeof window.getFamilleUiState !== 'function') return;

                const ui = window.getFamilleUiState();

                if (!ui.collapsedFamilyIds || typeof ui.collapsedFamilyIds !== 'object') ui.collapsedFamilyIds = {};

                ui.collapsedFamilyIds[reviewId] = !ui.collapsedFamilyIds[reviewId];

                if (typeof window.renderExtractionInsights === 'function') {

                    window.renderExtractionInsights();

                }

            }, { once: false });

        });



        document.querySelectorAll('.fam-card-sub-select').forEach((sel) => {

            sel.addEventListener('change', () => {

                const rid = sel.getAttribute('data-review-id');

                const oid = sel.getAttribute('data-option-id');

                const v = String(sel.value || '').trim();

                const state = window.__ugapFamilleReview;

                const fam = state?.editFamilies?.find((x) => x.reviewId === rid);

                if (!fam || !oid) return;

                if (!fam.optionSubFamilies) fam.optionSubFamilies = {};

                if (v) fam.optionSubFamilies[oid] = v;

                else delete fam.optionSubFamilies[oid];

                if (typeof window.syncReviewStateIntoIaResult === 'function') {

                    window.syncReviewStateIntoIaResult();

                }

            });

        });

    };

})();

