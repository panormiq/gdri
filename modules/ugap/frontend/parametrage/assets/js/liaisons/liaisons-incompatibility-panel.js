/**
 * FICHIER : parametrage/assets/js/liaisons/liaisons-incompatibility-panel.js
 * RÔLE : Sous-onglet Incompatibilités — groupes mutex (Base + MINO/MAJO) + règles manuelles.
 */
(function initUgapLiaisonsIncompatibilityPanel(global) {
    'use strict';

    const S = () => global.UgapLiaisonsShared;
    const manualPick = { a: '', b: '' };
    /** @type {Map<string, string>} groupId → optionId sélectionnée */
    const groupMemberSelection = new Map();

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

    function openAddToGroupPicker(groupId) {
        const group = findGroupById(groupId);
        if (!group) return;
        openOptionPicker({
            title: 'Ajouter une option au groupe',
            excludeOptionIds: group.memberIds,
            onPick: async (optionId) => {
                await addMemberToGroup(groupId, optionId);
                if (global.UgapLiaisonsTab?.loadLiaisons) {
                    await global.UgapLiaisonsTab.loadLiaisons();
                }
            },
        });
    }

    function openManualPick(slot) {
        const key = slot === 'b' ? 'b' : 'a';
        openOptionPicker({
            title: key === 'a' ? 'Choisir option A' : 'Choisir option B',
            excludeOptionIds: key === 'a' && manualPick.b ? [manualPick.b] : (key === 'b' && manualPick.a ? [manualPick.a] : []),
            onPick: (optionId) => {
                manualPick[key] = String(optionId || '').trim();
                updateManualPickLabels();
            },
        });
    }

    function updateManualPickLabels() {
        const labelA = S().byId('ugap-liaisons-pick-a-label');
        const labelB = S().byId('ugap-liaisons-pick-b-label');
        if (labelA) {
            labelA.textContent = manualPick.a ? S().optionLabel(manualPick.a) : '— non choisie —';
        }
        if (labelB) {
            labelB.textContent = manualPick.b ? S().optionLabel(manualPick.b) : '— non choisie —';
        }
    }

    function resolvePersistedAdjIds(baseOpt, importBaseProducts) {
        const baseId = String(baseOpt?.id || '').trim();
        const fromSource = (Array.isArray(baseOpt?.importBaseProductSourceOptionIds)
            ? baseOpt.importBaseProductSourceOptionIds
            : [])
            .map((x) => String(x || '').trim())
            .filter(Boolean);
        if (fromSource.length) return fromSource;

        const bp = (Array.isArray(importBaseProducts) ? importBaseProducts : [])
            .find((row) => String(row?.catalogOptionId || '').trim() === baseId);
        if (bp && Array.isArray(bp.optionIds) && bp.optionIds.length) {
            return bp.optionIds.map((x) => String(x || '').trim()).filter(Boolean);
        }
        return [];
    }

    function resolveIbpRow(baseOpt) {
        const data = S().store.data;
        const baseId = String(baseOpt?.id || '').trim();
        const linkedIds = S().bal()?.resolveSourceAdjOptionIdsForBase
            ? S().bal().resolveSourceAdjOptionIdsForBase(baseId, data?.categories, data?.importBaseProducts)
            : [];
        const persistedIds = resolvePersistedAdjIds(baseOpt, data?.importBaseProducts);
        const isExplicit = persistedIds.length > 0;
        const isImplicit = linkedIds.length > 0 && !isExplicit;
        return {
            baseId,
            baseName: String(baseOpt?.name || baseId).trim(),
            excelLabel: String(baseOpt?.importExcelLabel || baseOpt?.details || '').trim(),
            linkedIds,
            persistedIds,
            hasLink: linkedIds.length > 0,
            isExplicit,
            isImplicit,
        };
    }

    function buildIbpRows() {
        return S().flattenOptions(S().store.data)
            .filter(S().isIbp)
            .map(resolveIbpRow)
            .sort((a, b) => String(a.baseName || '').localeCompare(String(b.baseName || ''), 'fr'));
    }

    function manualIncompatibilityRules() {
        return (Array.isArray(S().store.data?.optionLinkRules) ? S().store.data.optionLinkRules : [])
            .filter((rule) => String(rule?.type || '') === 'incompatibility'
                && String(rule?.source || '') !== 'import_ibp');
    }

    function buildIncompatibilityGroups() {
        const ibpRows = buildIbpRows();
        const { find, clusters } = S().buildEquivalentBaseClusters(S().store.data);
        const rowById = new Map(ibpRows.map((row) => [row.baseId, row]));
        const seenRoots = new Set();
        const groups = [];

        ibpRows.forEach((row) => {
            const root = find(row.baseId) || row.baseId;
            if (seenRoots.has(root)) return;
            seenRoots.add(root);

            const clusterIds = clusters.get(root) || new Set([row.baseId]);
            const baseIds = [...clusterIds].filter((id) => rowById.has(id));
            if (!baseIds.length) baseIds.push(row.baseId);

            const adjIdSet = new Set();
            let isExplicit = false;
            let isImplicit = false;
            const resolveBaseIds = new Set(baseIds);
            const importBaseProducts = Array.isArray(S().store.data?.importBaseProducts)
                ? S().store.data.importBaseProducts
                : [];
            baseIds.forEach((bid) => {
                const bp = importBaseProducts.find((row) => String(row?.catalogOptionId || '').trim() === bid);
                (Array.isArray(bp?.mergedCatalogOptionIds) ? bp.mergedCatalogOptionIds : []).forEach((mid) => {
                    const mergedId = String(mid || '').trim();
                    if (mergedId) resolveBaseIds.add(mergedId);
                });
            });
            const data = S().store.data;
            resolveBaseIds.forEach((bid) => {
                const r = rowById.get(bid);
                if (r) {
                    (r.linkedIds || []).forEach((id) => adjIdSet.add(id));
                    (r.persistedIds || []).forEach((id) => adjIdSet.add(id));
                    if (r.isExplicit) isExplicit = true;
                    if (r.isImplicit) isImplicit = true;
                    return;
                }
                const linked = S().bal()?.resolveSourceAdjOptionIdsForBase
                    ? S().bal().resolveSourceAdjOptionIdsForBase(bid, data?.categories, data?.importBaseProducts)
                    : [];
                linked.forEach((id) => adjIdSet.add(id));
            });

            const baseOptions = baseIds.map((id) => S().findOptionById(id)).filter(Boolean);

            const primaryBaseId = baseIds.find((id) => rowById.get(id)?.isExplicit)
                || baseIds.find((id) => (rowById.get(id)?.linkedIds || []).length)
                || baseIds[0];

            const { complementary, mutex, motorBaseOnly } = S().splitMutexAndComplementaryAdjIds(
                baseIds,
                [...adjIdSet],
                data
            );
            if (motorBaseOnly && mutex.length === 0) return;

            groups.push({
                id: root,
                primaryBaseId,
                baseIds,
                adjIds: mutex,
                complementaryAdjIds: complementary,
                memberIds: [...new Set([...baseIds, ...mutex])],
                baseOptions,
                isExplicit,
                isImplicit: isImplicit && !isExplicit,
                hasLink: mutex.length > 0 || baseIds.some((id) => rowById.get(id)?.hasLink),
                title: baseOptions.map((o) => String(o?.name || '').trim()).filter(Boolean).join(' / ')
                    || S().optionLabel(primaryBaseId),
            });
        });

        return groups.sort((a, b) => String(a.title || '').localeCompare(String(b.title || ''), 'fr'));
    }

    function filteredGroups(groups) {
        const data = S().store.data;
        return groups.filter((group) => {
            if (!S().groupMatchesLinkStatus(group)) return false;
            return S().groupMatchesMemberFilters(group, data);
        });
    }

    function filteredManualRules(rules) {
        const data = S().store.data;
        return rules.filter((rule) => S().ruleMatchesFilters(rule, data));
    }

    function renderMutexCard(group) {
        const statusClass = group.hasLink
            ? (group.isExplicit ? 'ugap-liaisons-status--explicit' : 'ugap-liaisons-status--implicit')
            : 'ugap-liaisons-status--missing';
        const statusLabel = group.hasLink
            ? (group.isExplicit ? 'Enregistré' : 'Détecté auto.')
            : 'Sans remplacement';
        const memberCount = group.memberIds.length;
        const selectedId = groupMemberSelection.get(group.id) || '';
        const hasSelection = selectedId && group.memberIds.includes(selectedId);
        const membersTable = S().renderMembersTableHtml(group.memberIds, {
            groupId: group.id,
            selectable: true,
            selectedOptionId: selectedId,
        });

        return `
            <article class="ugap-liaisons-mutex-card" data-group-id="${S().esc(group.id)}">
                <header class="ugap-liaisons-mutex-card__head">
                    <span class="ugap-liaisons-mutex-card__title">
                        Groupe incompatible
                        <span class="ugap-liaisons-mutex-card__count">${memberCount} option${memberCount > 1 ? 's' : ''}</span>
                    </span>
                    <span class="ugap-liaisons-badge ${statusClass}">${S().esc(statusLabel)}</span>
                </header>
                ${membersTable}
                <footer class="ugap-liaisons-mutex-card__foot">
                    <button type="button" class="btn btn-outline btn-sm ugap-liaisons-card-add-open" data-group-id="${S().esc(group.id)}" title="Ajouter MINO/MAJO ou option">+ Option</button>
                    <button type="button" class="btn btn-outline btn-sm ugap-liaisons-card-remove-member"
                        data-group-id="${S().esc(group.id)}"
                        ${hasSelection ? '' : 'disabled'}
                        style="border-color:#dc3545;color:#b91c1c;">Supprimer</button>
                </footer>
            </article>
        `;
    }

    function renderManualCard(rule) {
        const ids = [
            ...(Array.isArray(rule.sourceOptionIds) ? rule.sourceOptionIds : []),
            ...(Array.isArray(rule.targetOptionIds) ? rule.targetOptionIds : []),
        ].map((x) => String(x || '').trim()).filter(Boolean);
        const uniqueIds = [...new Set(ids)];
        const membersTable = S().renderMembersTableHtml(uniqueIds, { selectable: false });
        return `
            <article class="ugap-liaisons-mutex-card ugap-liaisons-mutex-card--manual" data-rule-id="${S().esc(rule.id)}">
                <header class="ugap-liaisons-mutex-card__head">
                    <span class="ugap-liaisons-mutex-card__title">Incompatibilité manuelle</span>
                </header>
                ${membersTable}
                <p class="ugap-liaisons-mutex-card__meta">${S().esc(rule.label || rule.message || '—')}</p>
                <footer class="ugap-liaisons-mutex-card__foot">
                    <button type="button" class="btn btn-outline btn-sm ugap-liaisons-delete-rule-btn" data-rule-id="${S().esc(rule.id)}">Supprimer</button>
                </footer>
            </article>
        `;
    }

    function render(mount) {
        if (!mount) return;
        const groups = filteredGroups(buildIncompatibilityGroups());
        const manualRules = filteredManualRules(manualIncompatibilityRules());

        const groupsHtml = groups.length
            ? `<div class="ugap-liaisons-mutex-grid">${groups.map(renderMutexCard).join('')}</div>`
            : '<p class="ugap-param-placeholder">Aucun groupe base pour ce filtre.</p>';

        const manualHtml = manualRules.length
            ? `<div class="ugap-liaisons-mutex-grid">${manualRules.map(renderManualCard).join('')}</div>`
            : '<p class="ugap-param-placeholder" style="margin:8px 0;">Aucune incompatibilité manuelle.</p>';

        mount.innerHTML = `
            <p class="ugap-param-lead" style="font-size:13px;margin:0 0 12px;">
                Chaque carte liste les options <strong>mutuellement incompatibles</strong> (Base et remplacements MINO/MAJO).
                Les <strong>moteurs de base</strong> et leurs minorations « non fourniture » sont dans l'onglet <strong>Complémentaire</strong>.
                Pour fusionner deux options de base, utilisez l'onglet <strong>Options</strong>.
            </p>
            <h3 style="margin:0 0 10px;font-size:15px;">Groupes Base / MINO / MAJO</h3>
            ${groupsHtml}
            <h3 style="margin:22px 0 10px;font-size:15px;">Incompatibilités manuelles</h3>
            <div class="ugap-liaisons-manual-add card" style="padding:12px;margin-bottom:12px;">
                <p style="margin:0 0 10px;font-size:13px;color:#64748b;">Ajouter une paire incompatible ou compléter un groupe non détecté.</p>
                <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end;">
                    <div class="ugap-liaisons-pick-field">
                        <span class="ugap-liaisons-pick-field__label">Option A</span>
                        <span id="ugap-liaisons-pick-a-label" class="ugap-liaisons-pick-field__value">${manualPick.a ? S().esc(S().optionLabel(manualPick.a)) : '— non choisie —'}</span>
                        <button type="button" id="ugap-liaisons-pick-a" class="btn btn-outline btn-sm">Choisir…</button>
                    </div>
                    <div class="ugap-liaisons-pick-field">
                        <span class="ugap-liaisons-pick-field__label">Option B</span>
                        <span id="ugap-liaisons-pick-b-label" class="ugap-liaisons-pick-field__value">${manualPick.b ? S().esc(S().optionLabel(manualPick.b)) : '— non choisie —'}</span>
                        <button type="button" id="ugap-liaisons-pick-b" class="btn btn-outline btn-sm">Choisir…</button>
                    </div>
                    <button type="button" id="ugap-liaisons-incomp-add" class="btn btn-primary">+ Ajouter</button>
                </div>
            </div>
            ${manualHtml}
        `;
    }

    function findGroupById(groupId) {
        return buildIncompatibilityGroups().find((g) => g.id === groupId) || null;
    }

    function selectGroupMember(root, groupId, optionId) {
        const gid = String(groupId || '').trim();
        const oid = String(optionId || '').trim();
        if (!gid || !oid) return;
        groupMemberSelection.set(gid, oid);
        const card = root?.querySelector(`.ugap-liaisons-mutex-card[data-group-id="${gid}"]`);
        if (!card) return;
        card.querySelectorAll('.ugap-liaisons-member-row:not(.ugap-liaisons-member-row--readonly)').forEach((tr) => {
            const rowOid = tr.getAttribute('data-option-id');
            const isSelected = rowOid === oid;
            tr.classList.toggle('is-selected', isSelected);
            const pick = tr.querySelector('.ugap-liaisons-member-row__pick');
            if (pick) pick.textContent = isSelected ? '●' : '';
        });
        const delBtn = card.querySelector('.ugap-liaisons-card-remove-member');
        if (delBtn) delBtn.disabled = false;
    }

    async function removeMemberFromGroup(groupId, optionId) {
        const gid = String(groupId || '').trim();
        const oid = String(optionId || '').trim();
        const group = findGroupById(gid);
        if (!group || !oid) return;

        if ((group.baseIds || []).includes(oid)) {
            global.showAlert?.('Une option de base ne peut pas être retirée du groupe.', 'warning');
            return;
        }

        const label = S().optionLabel(oid);
        if (!global.confirm?.(`Retirer « ${label} » de ce groupe incompatible ?`)) return;

        const primaryId = group.primaryBaseId;
        const opt = S().findOptionById(oid);
        const B = S().bal();

        if ((group.adjIds || []).includes(oid) || B?.isAdjOptionForBaseLink?.(opt)) {
            const nextAdj = (group.adjIds || []).filter((id) => id !== oid);
            await global.apiCall(`/base-products/${encodeURIComponent(primaryId)}/adj-links`, {
                method: 'POST',
                body: JSON.stringify({ linkedOptionIds: nextAdj }),
            });
        }

        let rules = Array.isArray(S().store.data?.optionLinkRules) ? [...S().store.data.optionLinkRules] : [];
        const memberSet = new Set(group.memberIds || []);
        const before = rules.length;
        rules = rules.filter((rule) => {
            if (String(rule?.type || '') !== 'incompatibility') return true;
            const ids = [
                ...(rule.sourceOptionIds || []),
                ...(rule.targetOptionIds || []),
            ].map((x) => String(x || '').trim());
            if (!ids.includes(oid)) return true;
            const other = ids.find((id) => id !== oid);
            return !(other && memberSet.has(other));
        });
        if (rules.length !== before) {
            await global.apiCall('/liaisons/rules', {
                method: 'PUT',
                body: JSON.stringify({ optionLinkRules: rules }),
            });
        }

        groupMemberSelection.delete(gid);
    }

    async function addMemberToGroup(groupId, optionId) {
        const oid = String(optionId || '').trim();
        const group = findGroupById(groupId);
        if (!group || !oid) return;
        if (group.memberIds.includes(oid)) {
            global.showAlert?.('Cette option est déjà dans le groupe.', 'warning');
            return;
        }

        const opt = S().findOptionById(oid);
        const primaryId = group.primaryBaseId;

        if (S().isIbp(opt)) {
            global.showAlert?.('Pour fusionner deux options de base, utilisez l’onglet Options (sélectionnez 2 lignes Base).', 'warning');
            return;
        }

        const B = S().bal();
        if (B?.isAdjOptionForBaseLink?.(opt)) {
            const nextAdj = [...new Set([...(group.adjIds || []), oid])];
            await global.apiCall(`/base-products/${encodeURIComponent(primaryId)}/adj-links`, {
                method: 'POST',
                body: JSON.stringify({ linkedOptionIds: nextAdj }),
            });
            return;
        }

        const rules = Array.isArray(S().store.data?.optionLinkRules) ? [...S().store.data.optionLinkRules] : [];
        group.memberIds.forEach((memberId) => {
            if (memberId === oid) return;
            const key = [memberId, oid].sort().join('|');
            const dup = rules.some((rule) => {
                if (String(rule?.type || '') !== 'incompatibility') return false;
                const m = [
                    ...(rule.sourceOptionIds || []),
                    ...(rule.targetOptionIds || []),
                ].map((x) => String(x || '').trim()).sort().join('|');
                return m === key;
            });
            if (dup) return;
            rules.push({
                id: `link_incomp_${Date.now()}_${memberId}`,
                type: 'incompatibility',
                sourceOptionIds: [memberId],
                targetOptionIds: [oid],
                label: `${S().optionLabel(memberId)} ⊕ ${S().optionLabel(oid)}`,
                source: 'manual',
            });
        });
        await global.apiCall('/liaisons/rules', {
            method: 'PUT',
            body: JSON.stringify({ optionLinkRules: rules }),
        });
    }

    async function addManualIncompatibility() {
        const a = String(manualPick.a || '').trim();
        const b = String(manualPick.b || '').trim();
        if (!a || !b || a === b) {
            global.showAlert?.('Choisissez deux options distinctes.', 'warning');
            return;
        }
        const rules = Array.isArray(S().store.data?.optionLinkRules) ? [...S().store.data.optionLinkRules] : [];
        rules.push({
            id: `link_incomp_${Date.now()}`,
            type: 'incompatibility',
            sourceOptionIds: [a],
            targetOptionIds: [b],
            label: `${S().optionLabel(a)} ⊕ ${S().optionLabel(b)}`,
            source: 'manual',
        });
        await global.apiCall('/liaisons/rules', {
            method: 'PUT',
            body: JSON.stringify({ optionLinkRules: rules }),
        });
        manualPick.a = '';
        manualPick.b = '';
    }

    async function deleteRule(ruleId) {
        const rid = String(ruleId || '').trim();
        if (!rid) return;
        const rules = (Array.isArray(S().store.data?.optionLinkRules) ? S().store.data.optionLinkRules : [])
            .filter((rule) => String(rule?.id || '') !== rid);
        await global.apiCall('/liaisons/rules', {
            method: 'PUT',
            body: JSON.stringify({ optionLinkRules: rules }),
        });
    }

    function bindPanelEvents(root, rerender) {
        root.addEventListener('click', (event) => {
            const target = event.target instanceof Element ? event.target : null;
            if (!target) return;

            const addOpen = target.closest('.ugap-liaisons-card-add-open');
            if (addOpen) {
                openAddToGroupPicker(addOpen.getAttribute('data-group-id'));
                return;
            }

            const memberRow = target.closest('.ugap-liaisons-member-row:not(.ugap-liaisons-member-row--readonly)');
            if (memberRow) {
                selectGroupMember(
                    root,
                    memberRow.getAttribute('data-group-id'),
                    memberRow.getAttribute('data-option-id')
                );
                return;
            }

            const removeMemberBtn = target.closest('.ugap-liaisons-card-remove-member');
            if (removeMemberBtn && !removeMemberBtn.disabled) {
                const gid = removeMemberBtn.getAttribute('data-group-id');
                const oid = groupMemberSelection.get(gid);
                if (!oid) return;
                void removeMemberFromGroup(gid, oid).then(rerender).catch((err) => {
                    S().showSectionStatus(err?.message || 'Erreur suppression', 'error');
                });
                return;
            }

            if (target.closest('#ugap-liaisons-pick-a')) {
                openManualPick('a');
                return;
            }
            if (target.closest('#ugap-liaisons-pick-b')) {
                openManualPick('b');
                return;
            }

            if (target.closest('#ugap-liaisons-incomp-add')) {
                void addManualIncompatibility().then(rerender).catch((err) => {
                    S().showSectionStatus(err?.message || 'Erreur ajout incompatibilité', 'error');
                });
                return;
            }

            const delBtn = target.closest('.ugap-liaisons-delete-rule-btn');
            if (delBtn) {
                void deleteRule(delBtn.getAttribute('data-rule-id')).then(rerender).catch((err) => {
                    S().showSectionStatus(err?.message || 'Erreur suppression', 'error');
                });
            }
        });

        root.addEventListener('keydown', (event) => {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            const target = event.target instanceof Element ? event.target : null;
            const memberRow = target?.closest('.ugap-liaisons-member-row:not(.ugap-liaisons-member-row--readonly)');
            if (!memberRow) return;
            event.preventDefault();
            selectGroupMember(
                root,
                memberRow.getAttribute('data-group-id'),
                memberRow.getAttribute('data-option-id')
            );
        });
    }

    global.UgapLiaisonsIncompatibilityPanel = {
        render,
        bindPanelEvents,
    };
})(typeof window !== 'undefined' ? window : globalThis);
