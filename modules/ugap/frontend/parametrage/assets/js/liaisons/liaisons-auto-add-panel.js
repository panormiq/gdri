/**
 * FICHIER : parametrage/assets/js/liaisons/liaisons-auto-add-panel.js
 * RÔLE : Sous-onglet Ajouts auto — dependencyRules (trigger → ajouter au clic).
 */
(function initUgapLiaisonsAutoAddPanel(global) {
    'use strict';

    const S = () => global.UgapLiaisonsShared;
    const manualPick = { trigger: '', target: '' };

    function dependencyRules() {
        return Array.isArray(S().store.data?.dependencyRules) ? S().store.data.dependencyRules : [];
    }

    function openOptionPicker(ctx) {
        const Picker = global.UgapLiaisonsOptionPicker;
        if (!Picker?.open) {
            global.showAlert?.('Picker options indisponible.', 'error');
            return;
        }
        Picker.open({
            title: ctx?.title || 'Choisir une option',
            data: S().store.data,
            excludeOptionIds: ctx?.excludeOptionIds || [],
            onPick: ctx?.onPick,
        });
    }

    function openPick(slot) {
        const key = slot === 'target' ? 'target' : 'trigger';
        openOptionPicker({
            title: key === 'trigger' ? 'Choisir le déclencheur' : 'Choisir l\'option à ajouter',
            excludeOptionIds: key === 'trigger' && manualPick.target ? [manualPick.target]
                : (key === 'target' && manualPick.trigger ? [manualPick.trigger] : []),
            onPick: (optionId) => {
                manualPick[key] = String(optionId || '').trim();
                updateManualPickLabels();
            },
        });
    }

    function updateManualPickLabels() {
        const labelTrigger = S().byId('ugap-liaisons-auto-pick-trigger-label');
        const labelTarget = S().byId('ugap-liaisons-auto-pick-target-label');
        if (labelTrigger) {
            labelTrigger.textContent = manualPick.trigger
                ? S().optionLabel(manualPick.trigger)
                : '— non choisie —';
        }
        if (labelTarget) {
            labelTarget.textContent = manualPick.target
                ? S().optionLabel(manualPick.target)
                : '— non choisie —';
        }
    }

    function render(mount) {
        if (!mount) return;
        const rules = dependencyRules();
        const body = rules.length
            ? rules.map((rule, index) => {
                const trigger = String(rule?.triggerOptionId || '').trim();
                const targets = (Array.isArray(rule?.autoSelectOptionIds) ? rule.autoSelectOptionIds : [])
                    .map((id) => S().optionLabel(id))
                    .join(', ');
                return `
                    <tr data-dep-index="${index}">
                        <td>${S().esc(S().optionLabel(trigger))}</td>
                        <td>${S().esc(targets || '—')}</td>
                        <td>${S().esc(rule?.message || '—')}</td>
                        <td style="text-align:right;">
                            <button type="button" class="btn btn-outline btn-sm ugap-liaisons-delete-dep-btn" data-dep-index="${index}">Supprimer</button>
                        </td>
                    </tr>
                `;
            }).join('')
            : `<tr><td colspan="4"><p class="ugap-param-placeholder" style="margin:8px 0;">Aucune règle d'ajout automatique.</p></td></tr>`;

        mount.innerHTML = `
            <p class="ugap-param-lead" style="font-size:13px;margin:0 0 12px;">
                Si l'option <strong>déclencheur</strong> est sélectionnée dans le configurateur, les options cibles sont
                <strong>ajoutées automatiquement</strong> au devis
                (ex. remplacement moteur catalogue → MINO « non fourniture moteur de base »).
                Pour la relation « si A absent → B requis », voir l'onglet <strong>Complémentaire</strong>.
            </p>
            <div class="ugap-liaisons-manual-add card" style="padding:12px;margin-bottom:12px;">
                <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end;">
                    <div class="ugap-liaisons-pick-field">
                        <span class="ugap-liaisons-pick-field__label">Déclencheur (si sélectionné…)</span>
                        <span id="ugap-liaisons-auto-pick-trigger-label" class="ugap-liaisons-pick-field__value">${manualPick.trigger ? S().esc(S().optionLabel(manualPick.trigger)) : '— non choisie —'}</span>
                        <button type="button" id="ugap-liaisons-auto-pick-trigger" class="btn btn-outline btn-sm" title="Choisir le déclencheur">+ Option</button>
                    </div>
                    <div class="ugap-liaisons-pick-field">
                        <span class="ugap-liaisons-pick-field__label">…ajouter automatiquement</span>
                        <span id="ugap-liaisons-auto-pick-target-label" class="ugap-liaisons-pick-field__value">${manualPick.target ? S().esc(S().optionLabel(manualPick.target)) : '— non choisie —'}</span>
                        <button type="button" id="ugap-liaisons-auto-pick-target" class="btn btn-outline btn-sm" title="Choisir l'option à ajouter">+ Option</button>
                    </div>
                    <button type="button" id="ugap-liaisons-auto-add" class="btn btn-primary">+ Ajouter</button>
                </div>
            </div>
            <table class="ugap-detect-table">
                <thead>
                    <tr>
                        <th>Déclencheur</th>
                        <th>Ajouter</th>
                        <th>Message</th>
                        <th></th>
                    </tr>
                </thead>
                <tbody>${body}</tbody>
            </table>
        `;
    }

    async function persistRules(rules) {
        await global.apiCall('/liaisons/rules', {
            method: 'PUT',
            body: JSON.stringify({ dependencyRules: rules }),
        });
    }

    async function addRule() {
        const trigger = String(manualPick.trigger || '').trim();
        const target = String(manualPick.target || '').trim();
        if (!trigger || !target) {
            global.showAlert?.('Choisissez un déclencheur et une option à ajouter.', 'warning');
            return;
        }
        const rules = [...dependencyRules()];
        const existing = rules.find((r) => String(r.triggerOptionId || '') === trigger);
        if (existing) {
            const set = new Set(existing.autoSelectOptionIds || []);
            set.add(target);
            existing.autoSelectOptionIds = [...set];
        } else {
            rules.push({ triggerOptionId: trigger, autoSelectOptionIds: [target], message: '' });
        }
        await persistRules(rules);
        manualPick.trigger = '';
        manualPick.target = '';
    }

    async function deleteRule(index) {
        const idx = Number(index);
        const rules = dependencyRules().filter((_, i) => i !== idx);
        await persistRules(rules);
    }

    function bindPanelEvents(root, rerender) {
        root.addEventListener('click', (event) => {
            const target = event.target instanceof Element ? event.target : null;
            if (!target) return;
            if (target.closest('#ugap-liaisons-auto-pick-trigger')) {
                openPick('trigger');
                return;
            }
            if (target.closest('#ugap-liaisons-auto-pick-target')) {
                openPick('target');
                return;
            }
            if (target.closest('#ugap-liaisons-auto-add')) {
                void addRule().then(rerender).catch((err) => {
                    S().showSectionStatus(err?.message || 'Erreur ajout auto', 'error');
                });
                return;
            }
            const delBtn = target.closest('.ugap-liaisons-delete-dep-btn');
            if (delBtn) {
                void deleteRule(delBtn.getAttribute('data-dep-index')).then(rerender).catch((err) => {
                    S().showSectionStatus(err?.message || 'Erreur suppression', 'error');
                });
            }
        });
    }

    global.UgapLiaisonsAutoAddPanel = { render, bindPanelEvents };
})(typeof window !== 'undefined' ? window : globalThis);
