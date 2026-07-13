/**

 * FICHIER : parametrage/assets/js/liaisons/liaisons-requires-panel.js

 * RÔLE : Sous-onglet Prérequis — requires + variant_fit + heuristique libellés.

 */

(function initUgapLiaisonsRequiresPanel(global) {

    'use strict';



    const S = () => global.UgapLiaisonsShared;

    const PREREQ_TYPES = new Set(['requires', 'variant_fit']);

    const manualPick = { parent: '', child: '' };

    let pendingSuggestions = [];



    function prerequisiteRules() {

        return (Array.isArray(S().store.data?.optionLinkRules) ? S().store.data.optionLinkRules : [])

            .filter((rule) => PREREQ_TYPES.has(String(rule?.type || '')));

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

        const key = slot === 'child' ? 'child' : 'parent';

        openOptionPicker({

            title: key === 'parent' ? 'Choisir le parent / slot' : 'Choisir l\'enfant / variante',

            excludeOptionIds: key === 'parent' && manualPick.child ? [manualPick.child]

                : (key === 'child' && manualPick.parent ? [manualPick.parent] : []),

            onPick: (optionId) => {

                manualPick[key] = String(optionId || '').trim();

                updateManualPickLabels();

            },

        });

    }



    function updateManualPickLabels() {

        const labelParent = S().byId('ugap-liaisons-req-pick-parent-label');

        const labelChild = S().byId('ugap-liaisons-req-pick-child-label');

        if (labelParent) {

            labelParent.textContent = manualPick.parent

                ? S().optionLabel(manualPick.parent)

                : '— non choisie —';

        }

        if (labelChild) {

            labelChild.textContent = manualPick.child

                ? S().optionLabel(manualPick.child)

                : '— non choisie —';

        }

    }



    function render(mount) {

        if (!mount) return;

        const rules = prerequisiteRules();

        const body = rules.length

            ? rules.map((rule) => `

                <tr data-rule-id="${S().esc(rule.id)}">

                    <td><span class="ugap-liaisons-type-badge ${S().esc(S().typeBadgeClass(rule.type))}">${S().esc(S().typeLabel(rule.type))}</span></td>

                    <td>${S().esc(S().optionLabel(rule.sourceOptionIds?.[0]))}</td>

                    <td>${S().esc(S().optionLabel(rule.targetOptionIds?.[0]))}</td>

                    <td>${S().esc(rule.label || rule.message || '—')}</td>

                    <td>${S().esc(rule.source || 'manual')}</td>

                    <td style="text-align:right;">

                        <button type="button" class="btn btn-outline btn-sm ugap-liaisons-delete-req-btn" data-rule-id="${S().esc(rule.id)}">Supprimer</button>

                    </td>

                </tr>

            `).join('')

            : `<tr><td colspan="6"><p class="ugap-param-placeholder" style="margin:8px 0;">Aucun prérequis ou variante recommandée.</p></td></tr>`;



        mount.innerHTML = `

            <p class="ugap-param-lead" style="font-size:13px;margin:0 0 12px;">

                <strong>Prérequis</strong> : l'accessoire n'est compatible que si le parent est sur le devis (VHF portative ↔ VHF fixe).

                <strong>Variante recommandée</strong> : une option est la version conseillée pour un autre choix (ex. T-top C800 pour console C800).

                Le configurateur affiche tout ; en cas de conflit → modal avec alternatives.

            </p>

            <div style="margin-bottom:10px;display:flex;gap:8px;flex-wrap:wrap;">

                <button type="button" id="ugap-liaisons-suggest-heuristic" class="btn btn-outline">Proposer depuis libellés Excel</button>

            </div>

            <div class="ugap-liaisons-manual-add card" style="padding:12px;margin-bottom:12px;">

                <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end;">

                    <label style="display:flex;flex-direction:column;gap:4px;min-width:160px;">

                        <span style="font-size:12px;color:#64748b;">Type</span>

                        <select id="ugap-liaisons-req-type">

                            <option value="requires">Prérequis</option>

                            <option value="variant_fit">Variante recommandée</option>

                        </select>

                    </label>

                    <div class="ugap-liaisons-pick-field">

                        <span class="ugap-liaisons-pick-field__label">Parent / slot (requis pour enfant)</span>

                        <span id="ugap-liaisons-req-pick-parent-label" class="ugap-liaisons-pick-field__value">${manualPick.parent ? S().esc(S().optionLabel(manualPick.parent)) : '— non choisie —'}</span>

                        <button type="button" id="ugap-liaisons-req-pick-parent" class="btn btn-outline btn-sm" title="Choisir le parent">+ Option</button>

                    </div>

                    <div class="ugap-liaisons-pick-field">

                        <span class="ugap-liaisons-pick-field__label">Enfant / variante</span>

                        <span id="ugap-liaisons-req-pick-child-label" class="ugap-liaisons-pick-field__value">${manualPick.child ? S().esc(S().optionLabel(manualPick.child)) : '— non choisie —'}</span>

                        <button type="button" id="ugap-liaisons-req-pick-child" class="btn btn-outline btn-sm" title="Choisir l'enfant">+ Option</button>

                    </div>

                    <button type="button" id="ugap-liaisons-req-add" class="btn btn-primary">+ Ajouter</button>

                </div>

            </div>

            <div id="ugap-liaisons-suggest-wrap" hidden class="card" style="padding:12px;margin-bottom:12px;"></div>

            <table class="ugap-detect-table">

                <thead>

                    <tr>

                        <th>Type</th>

                        <th>Parent</th>

                        <th>Enfant</th>

                        <th>Libellé</th>

                        <th>Source</th>

                        <th></th>

                    </tr>

                </thead>

                <tbody>${body}</tbody>

            </table>

        `;

    }



    async function persistOptionLinkRules(rules) {

        await global.apiCall('/liaisons/rules', {

            method: 'PUT',

            body: JSON.stringify({ optionLinkRules: rules }),

        });

    }



    async function addRule() {

        const type = String(S().byId('ugap-liaisons-req-type')?.value || 'requires').trim();

        const parent = String(manualPick.parent || '').trim();

        const child = String(manualPick.child || '').trim();

        if (!parent || !child || parent === child) {

            global.showAlert?.('Choisissez un parent et un enfant distincts.', 'warning');

            return;

        }

        const rules = Array.isArray(S().store.data?.optionLinkRules) ? [...S().store.data.optionLinkRules] : [];

        rules.push({

            id: `link_${type}_${Date.now()}`,

            type,

            sourceOptionIds: [parent],

            targetOptionIds: [child],

            label: type === 'variant_fit'

                ? `${S().optionLabel(child)} → variante recommandée pour ${S().optionLabel(parent)}`

                : `${S().optionLabel(child)} → requiert ${S().optionLabel(parent)}`,

            message: '',

            source: 'manual',

        });

        await persistOptionLinkRules(rules);

        manualPick.parent = '';

        manualPick.child = '';

    }



    async function deleteRule(ruleId) {

        const rid = String(ruleId || '').trim();

        const rules = (Array.isArray(S().store.data?.optionLinkRules) ? S().store.data.optionLinkRules : [])

            .filter((rule) => String(rule?.id || '') !== rid);

        await persistOptionLinkRules(rules);

    }



    async function loadSuggestions() {

        const wrap = S().byId('ugap-liaisons-suggest-wrap');

        if (!wrap) return;

        wrap.hidden = false;

        wrap.innerHTML = '<p class="ugap-param-placeholder">Analyse des libellés…</p>';

        const res = await global.apiCall('/liaisons/suggest-heuristic', { method: 'POST' });

        pendingSuggestions = Array.isArray(res?.data?.suggestions) ? res.data.suggestions : [];

        if (!pendingSuggestions.length) {

            wrap.innerHTML = '<p class="ugap-param-placeholder">Aucune proposition (motifs « reliée à », « pour VHF », « console »…).</p>';

            return;

        }

        wrap.innerHTML = `

            <strong style="display:block;margin-bottom:8px;">Propositions (${pendingSuggestions.length})</strong>

            ${pendingSuggestions.map((rule, index) => `

                <label class="ugap-liaisons-edit-row">

                    <input type="checkbox" class="ugap-liaisons-suggest-pick" value="${index}">

                    <span class="ugap-liaisons-type-badge ${S().esc(S().typeBadgeClass(rule.type))}">${S().esc(S().typeLabel(rule.type))}</span>

                    <span>${S().esc(rule.label || '')}</span>

                </label>

            `).join('')}

            <div style="margin-top:10px;text-align:right;">

                <button type="button" id="ugap-liaisons-suggest-merge" class="btn btn-primary">Ajouter la sélection</button>

            </div>

        `;

    }



    async function mergeSuggestions() {

        const picks = Array.from(document.querySelectorAll('.ugap-liaisons-suggest-pick:checked'));

        if (!picks.length) {

            global.showAlert?.('Sélectionnez au moins une proposition.', 'info');

            return;

        }

        const existing = Array.isArray(S().store.data?.optionLinkRules) ? [...S().store.data.optionLinkRules] : [];

        const toAdd = picks.map((el) => pendingSuggestions[Number(el.value)]).filter(Boolean);

        await persistOptionLinkRules([...existing, ...toAdd]);

        pendingSuggestions = [];

        const wrap = S().byId('ugap-liaisons-suggest-wrap');

        if (wrap) wrap.hidden = true;

    }



    function bindPanelEvents(root, rerender) {

        root.addEventListener('click', (event) => {

            const target = event.target instanceof Element ? event.target : null;

            if (!target) return;

            if (target.closest('#ugap-liaisons-req-pick-parent')) {

                openPick('parent');

                return;

            }

            if (target.closest('#ugap-liaisons-req-pick-child')) {

                openPick('child');

                return;

            }

            if (target.closest('#ugap-liaisons-req-add')) {

                void addRule().then(rerender).catch((err) => {

                    S().showSectionStatus(err?.message || 'Erreur ajout prérequis', 'error');

                });

                return;

            }

            if (target.closest('#ugap-liaisons-suggest-heuristic')) {

                void loadSuggestions().catch((err) => {

                    S().showSectionStatus(err?.message || 'Erreur heuristique', 'error');

                });

                return;

            }

            if (target.closest('#ugap-liaisons-suggest-merge')) {

                void mergeSuggestions().then(rerender).catch((err) => {

                    S().showSectionStatus(err?.message || 'Erreur fusion propositions', 'error');

                });

                return;

            }

            const delBtn = target.closest('.ugap-liaisons-delete-req-btn');

            if (delBtn) {

                void deleteRule(delBtn.getAttribute('data-rule-id')).then(rerender).catch((err) => {

                    S().showSectionStatus(err?.message || 'Erreur suppression', 'error');

                });

            }

        });

    }



    global.UgapLiaisonsRequiresPanel = { render, bindPanelEvents };

})(typeof window !== 'undefined' ? window : globalThis);

