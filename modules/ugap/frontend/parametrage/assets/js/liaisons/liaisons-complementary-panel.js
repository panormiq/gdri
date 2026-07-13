/**
 * FICHIER : parametrage/assets/js/liaisons/liaisons-complementary-panel.js
 * RÔLE : Sous-onglet Complémentaire — paires liées (ex. moteur base ↔ non-fourniture).
 */
(function initUgapLiaisonsComplementaryPanel(global) {
    'use strict';

    const S = () => global.UgapLiaisonsShared;
    const manualPick = { optionA: '', optionB: '' };

    function openPick(slot) {
        const key = slot === 'b' ? 'optionB' : 'optionA';
        const Picker = global.UgapLiaisonsOptionPicker;
        if (!Picker?.open) {
            global.showAlert?.('Picker options indisponible.', 'error');
            return;
        }
        Picker.open({
            title: key === 'optionA' ? 'Option A de la paire' : 'Option B de la paire',
            data: S().store.data,
            excludeOptionIds: key === 'optionA' && manualPick.optionB ? [manualPick.optionB]
                : (key === 'optionB' && manualPick.optionA ? [manualPick.optionA] : []),
            onPick: (optionId) => {
                manualPick[key] = String(optionId || '').trim();
                updateManualPickLabels();
            },
        });
    }

    function updateManualPickLabels() {
        const labelA = S().byId('ugap-liaisons-comp-pick-a-label');
        const labelB = S().byId('ugap-liaisons-comp-pick-b-label');
        if (labelA) {
            labelA.textContent = manualPick.optionA
                ? S().optionLabel(manualPick.optionA)
                : '— non choisie —';
        }
        if (labelB) {
            labelB.textContent = manualPick.optionB
                ? S().optionLabel(manualPick.optionB)
                : '— non choisie —';
        }
    }

    function formatPairLabel(optionIdA, optionIdB) {
        return `${S().optionLabel(optionIdA)} ↔ ${S().optionLabel(optionIdB)}`;
    }

    function allOptionLinkRules() {
        return Array.isArray(S().store.data?.optionLinkRules) ? [...S().store.data.optionLinkRules] : [];
    }

    async function persistOptionLinkRules(rules) {
        await global.apiCall('/liaisons/rules', {
            method: 'PUT',
            body: JSON.stringify({ optionLinkRules: rules }),
        });
    }

    async function addManualPair() {
        const optionA = String(manualPick.optionA || '').trim();
        const optionB = String(manualPick.optionB || '').trim();
        if (!optionA || !optionB || optionA === optionB) {
            global.showAlert?.('Choisissez deux options distinctes.', 'warning');
            return;
        }
        const rules = allOptionLinkRules();
        const dup = rules.some((rule) => {
            if (String(rule?.type || '') !== 'complementary') return false;
            const key = S().complementaryPairKey?.(
                rule?.sourceOptionIds?.[0],
                rule?.targetOptionIds?.[0]
            ) || '';
            return key === S().complementaryPairKey(optionA, optionB);
        });
        if (dup) {
            global.showAlert?.('Cette paire complémentaire existe déjà.', 'warning');
            return;
        }
        rules.push({
            id: `link_comp_${Date.now()}`,
            type: 'complementary',
            sourceOptionIds: [optionA],
            targetOptionIds: [optionB],
            label: formatPairLabel(optionA, optionB),
            message: 'Si l\'une des options est absente du devis, l\'autre doit y figurer.',
            source: 'manual',
        });
        await persistOptionLinkRules(rules);
        manualPick.optionA = '';
        manualPick.optionB = '';
    }

    async function syncDetectedMotorPairs() {
        const detected = S().collectMotorComplementaryPairs(S().store.data);
        if (!detected.length) {
            global.showAlert?.('Aucune paire moteur détectée dans le catalogue.', 'info');
            return;
        }
        const rules = allOptionLinkRules();
        const data = S().store.data;
        const existingSemantic = new Set(
            rules
                .filter((rule) => String(rule?.type || '') === 'complementary')
                .map((rule) => S().complementarySemanticKey?.(
                    rule?.sourceOptionIds?.[0],
                    rule?.targetOptionIds?.[0],
                    data
                ) || S().complementaryPairKey(rule?.sourceOptionIds?.[0], rule?.targetOptionIds?.[0]))
                .filter(Boolean)
        );
        let added = 0;
        detected.forEach((pair) => {
            const key = S().complementaryPairKey(pair.baseId, pair.complementId);
            const semanticKey = S().complementarySemanticKey?.(pair.baseId, pair.complementId, data) || key;
            const dup = rules.some((rule) => {
                if (String(rule?.type || '') !== 'complementary') return false;
                return S().complementaryPairKey(rule?.sourceOptionIds?.[0], rule?.targetOptionIds?.[0]) === key;
            });
            if (dup || existingSemantic.has(semanticKey)) return;
            existingSemantic.add(semanticKey);
            rules.push({
                id: `link_comp_motor_${Date.now()}_${added}`,
                type: 'complementary',
                sourceOptionIds: [pair.baseId],
                targetOptionIds: [pair.complementId],
                label: `${S().optionLabel(pair.baseId)} ↔ ${S().optionLabel(pair.complementId)}`,
                message: 'Paire moteur de base / non-fourniture.',
                source: 'system',
            });
            added += 1;
        });
        if (!added) {
            global.showAlert?.('Toutes les paires moteur détectées sont déjà enregistrées.', 'info');
            return;
        }
        await persistOptionLinkRules(rules);
        global.showAlert?.(`${added} paire(s) complémentaire(s) enregistrée(s).`, 'success');
    }

    async function deleteRule(ruleId) {
        const rid = String(ruleId || '').trim();
        if (!rid) return;
        const rules = allOptionLinkRules().filter((rule) => String(rule?.id || '') !== rid);
        await persistOptionLinkRules(rules);
    }

    function render(mount) {
        if (!mount) return;
        const rows = S().buildComplementaryRows(S().store.data);
        const body = rows.length
            ? rows.map((row) => `
                <tr data-comp-rule-id="${S().esc(row.id)}" data-comp-detected="${row.persisted ? '0' : '1'}">
                    <td class="ugap-liaisons-comp-pair">${S().esc(formatPairLabel(row.sourceId, row.targetId))}</td>
                    <td>${S().esc(row.label || '—')}</td>
                    <td>${row.persisted
                        ? S().esc(row.source || 'manual')
                        : '<span class="ugap-liaisons-badge ugap-liaisons-status--implicit">Détecté</span>'}</td>
                    <td style="text-align:right;">
                        ${row.persisted
                            ? `<button type="button" class="btn btn-outline btn-sm ugap-liaisons-delete-comp-btn" data-rule-id="${S().esc(row.id)}">Supprimer</button>`
                            : ''}
                    </td>
                </tr>
            `).join('')
            : `<tr><td colspan="4"><p class="ugap-param-placeholder" style="margin:8px 0;">Aucune paire complémentaire.</p></td></tr>`;

        mount.innerHTML = `
            <p class="ugap-param-lead" style="font-size:13px;margin:0 0 12px;">
                Une liaison <strong>complémentaire</strong> lie deux options qui ne se remplacent pas comme un mutex Base/MINO/MAJO :
                <strong>si l'une est absente du devis, l'autre doit y figurer — et réciproquement</strong>
                (ex. moteur de base ↔ minoration « non fourniture du moteur de base »).
                L'ordre des options n'a pas d'importance.
                Ce n'est pas un ajout automatique au clic : voir l'onglet <strong>Ajouts auto</strong> pour les déclencheurs.
            </p>
            <div style="margin-bottom:12px;display:flex;gap:8px;flex-wrap:wrap;">
                <button type="button" id="ugap-liaisons-comp-sync-motor" class="btn btn-outline">
                    Enregistrer les paires moteur détectées
                </button>
            </div>
            <table class="ugap-detect-table ugap-liaisons-comp-table">
                <thead>
                    <tr>
                        <th>Paire complémentaire</th>
                        <th>Libellé</th>
                        <th>Source</th>
                        <th></th>
                    </tr>
                </thead>
                <tbody>${body}</tbody>
            </table>
            <h3 style="margin:22px 0 10px;font-size:15px;">Ajouter une paire</h3>
            <p class="ugap-param-lead" style="font-size:12px;margin:0 0 10px;color:#64748b;">Choisissez deux options — l'ordre A / B est indifférent.</p>
            <div class="ugap-liaisons-manual-add card" style="padding:12px;">
                <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end;">
                    <div class="ugap-liaisons-pick-field">
                        <span class="ugap-liaisons-pick-field__label">Option A</span>
                        <span id="ugap-liaisons-comp-pick-a-label" class="ugap-liaisons-pick-field__value">${manualPick.optionA ? S().esc(S().optionLabel(manualPick.optionA)) : '— non choisie —'}</span>
                        <button type="button" id="ugap-liaisons-comp-pick-a" class="btn btn-outline btn-sm">Choisir…</button>
                    </div>
                    <div class="ugap-liaisons-pick-field">
                        <span class="ugap-liaisons-pick-field__label">Option B</span>
                        <span id="ugap-liaisons-comp-pick-b-label" class="ugap-liaisons-pick-field__value">${manualPick.optionB ? S().esc(S().optionLabel(manualPick.optionB)) : '— non choisie —'}</span>
                        <button type="button" id="ugap-liaisons-comp-pick-b" class="btn btn-outline btn-sm">Choisir…</button>
                    </div>
                    <button type="button" id="ugap-liaisons-comp-add" class="btn btn-primary">+ Ajouter</button>
                </div>
            </div>
        `;
    }

    function bindPanelEvents(root, rerender) {
        root.addEventListener('click', (event) => {
            const target = event.target instanceof Element ? event.target : null;
            if (!target) return;

            if (target.closest('#ugap-liaisons-comp-pick-a')) {
                openPick('a');
                return;
            }
            if (target.closest('#ugap-liaisons-comp-pick-b')) {
                openPick('b');
                return;
            }
            if (target.closest('#ugap-liaisons-comp-add')) {
                void addManualPair().then(rerender).catch((err) => {
                    S().showSectionStatus(err?.message || 'Erreur ajout complémentaire', 'error');
                });
                return;
            }
            if (target.closest('#ugap-liaisons-comp-sync-motor')) {
                void syncDetectedMotorPairs().then(rerender).catch((err) => {
                    S().showSectionStatus(err?.message || 'Erreur synchronisation', 'error');
                });
                return;
            }
            const delBtn = target.closest('.ugap-liaisons-delete-comp-btn');
            if (delBtn) {
                void deleteRule(delBtn.getAttribute('data-rule-id')).then(rerender).catch((err) => {
                    S().showSectionStatus(err?.message || 'Erreur suppression', 'error');
                });
            }
        });
    }

    global.UgapLiaisonsComplementaryPanel = { render, bindPanelEvents };
})(typeof window !== 'undefined' ? window : globalThis);
