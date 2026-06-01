/**
 * Formulaire création famille (panneau LC masqué jusqu’au clic).
 */
(function initUgapFamilleLcForm(global) {
    'use strict';

    const NS = 'UgapFamilleLcForm';

    function esc(value) {
        if (typeof global.escapeHtml === 'function') return global.escapeHtml(value);
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function state() {
        return global.UgapFamilleLcState;
    }

    function fdg() {
        return global.UgapFamilyDecisionGroup;
    }

    function slugifyTypeId(input) {
        return String(input || '')
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]+/g, '_')
            .replace(/^_+|_+$/g, '');
    }

    function getBuiltinTypeIds() {
        const FDG = fdg();
        return new Set((Array.isArray(FDG?.BUILTIN_GROUP_TYPES) ? FDG.BUILTIN_GROUP_TYPES : [])
            .map((t) => slugifyTypeId(t?.value))
            .filter(Boolean));
    }

    function normalizeCustomTypeRow(raw) {
        const row = raw && typeof raw === 'object' ? raw : {};
        const label = String(row.label || row.title || '').trim();
        const value = slugifyTypeId(row.value || row.id || label);
        const defaultDecisionMode = String(row.defaultDecisionMode || '').trim();
        const defaultPriceMode = String(row.defaultPriceMode || '').trim();
        return {
            value,
            id: value,
            label: label || value,
            title: label || value,
            defaultDecisionMode: defaultDecisionMode || undefined,
            defaultPriceMode: defaultPriceMode || undefined,
        };
    }

    function normalizeGroups(raw) {
        const FDG = fdg();
        return FDG?.normalizeList ? FDG.normalizeList(raw) : (Array.isArray(raw) ? raw : []);
    }

    function normalizeFamilyPriceMode(value) {
        return String(value || '').trim().toLowerCase() === 'minoration' ? 'minoration' : 'option';
    }

    function renderFamilyPriceModeSelectInline(selectedValue, onchangeHandler) {
        const selected = normalizeFamilyPriceMode(selectedValue);
        const mk = (value, label) => `<option value="${esc(value)}"${selected === value ? ' selected' : ''}>${esc(label)}</option>`;
        return `
            <select onchange="${onchangeHandler}" style="width:100%;padding:4px;font-size:12px;">
                ${mk('option', 'Standard')}
                ${mk('minoration', 'Minoration')}
            </select>
        `;
    }

    function renderCreateFormHtml() {
        return `
            <div class="ugap-famille-create-form" data-ugap-famille-create-form>
                <div class="ugap-famille-create-form__row ugap-famille-create-form__row--inline">
                    <div class="ugap-famille-create-form__field">
                        <label for="ugap-famille-label">Nom famille</label>
                        <input id="ugap-famille-label" type="text" data-field="familyLabel" placeholder="Ex. Moteur" autocomplete="off">
                    </div>
                    <div class="ugap-famille-create-form__field">
                        <label for="ugap-famille-keyword">Mot clé</label>
                        <input id="ugap-famille-keyword" type="text" data-field="familyKeyword"
                            placeholder="Ex. moteur, motorisation"
                            autocomplete="off"
                            title="Heuristique famille — affectation auto des options plus tard">
                    </div>
                </div>
                <p class="ugap-famille-create-form__hint ugap-famille-create-form__hint--inline">
                    Le mot clé sert à la recherche heuristique (try automatique des options).
                </p>
                <div class="ugap-famille-create-form__groups-head">
                    <strong>Groupes de décision</strong>
                    <span class="ugap-famille-create-form__hint">Par défaut : Modèle + Option catalogue de base — cochez le groupe « défaut options » de la famille</span>
                </div>
                <div id="ugap-famille-groups-preview" class="ugap-famille-groups-preview"></div>
                <div class="ugap-famille-create-form__actions">
                    <button type="button" class="btn btn-outline" data-action="add-group">+ Ajouter un groupe</button>
                    <button type="button" class="btn btn-success" data-action="submit-family" data-submit-family-btn>Enregistrer la famille</button>
                </div>
            </div>
        `;
    }

    function renderTypesManagerHtml() {
        return `
            <button type="button" class="btn btn-outline" data-action="toggle-types" style="font-size:12px;">
                Types de groupe
            </button>
            <div class="ugap-famille-types-panel" data-ugap-famille-types-panel hidden>
                <p class="ugap-famille-create-form__hint" style="margin:0 0 8px;">
                    Types intégrés : Modèle, Option catalogue, Statique, Garantie, Personnalisé.
                    Ajoutez des types métier pour les groupes.
                </p>
                <div data-ugap-famille-types-list></div>
                <div class="ugap-famille-types-add">
                    <input type="text" data-types-field="label" placeholder="Libellé (ex. Extension garantie)" style="flex:1;">
                    <input type="text" data-types-field="value" placeholder="Code (auto si vide)" style="min-width:190px;">
                    <select data-types-field="decision" style="min-width:170px;">
                        <option value="">Décision par défaut (optionnel)</option>
                        <option value="single_choice">Choix unique</option>
                        <option value="multi_choice">Choix multiple</option>
                    </select>
                    <select data-types-field="price" style="min-width:220px;">
                        <option value="">Prix par défaut (optionnel)</option>
                        <option value="option">Standard</option>
                        <option value="minoration">Minoration</option>
                    </select>
                    <button type="button" class="btn btn-primary" data-action="add-type" style="font-size:12px;">Ajouter</button>
                </div>
            </div>
        `;
    }

    function refreshGroupsPreview(root) {
        const mount = root?.querySelector('#ugap-famille-groups-preview');
        if (!mount || !state()) return;

        const draft = state().getCreateDraft();
        const groups = normalizeGroups(draft.groups);
        const defaultId = state().resolveDefaultDecisionGroupId(groups, draft.defaultDecisionGroupId);
        draft.defaultDecisionGroupId = defaultId;
        const FDG = fdg();
        const headers = `
            <th>Id</th><th>Libellé</th><th>Type</th><th>Prix</th><th>Décision</th>
            <th>Mots-clés heuristiques</th>
            <th class="ugap-famille-th-default" title="Options non assignées → ce groupe">Défaut options</th>
            <th></th>
        `;

        const rowsHtml = groups.length
            ? groups.map((g) => {
                const gid = esc(String(g.id || ''));
                const isDefault = defaultId && String(g.id) === String(defaultId);
                const typeSel = FDG?.renderTypeSelectInline
                    ? FDG.renderTypeSelectInline(g.type, `window.${NS}.onGroupField('${gid}', 'type', this.value)`)
                    : '';
                const priceSel = renderFamilyPriceModeSelectInline(
                    g.priceMode,
                    `window.${NS}.onGroupField('${gid}', 'priceMode', this.value)`
                );
                const decSel = FDG?.renderDecisionModeSelectInline
                    ? FDG.renderDecisionModeSelectInline(g.decisionMode, `window.${NS}.onGroupField('${gid}', 'decisionMode', this.value)`)
                    : '';
                return `
                    <tr data-group-id="${gid}">
                        <td><input value="${gid}" readonly tabindex="-1" class="ugap-famille-input ugap-famille-input--readonly"></td>
                        <td><input value="${esc(g.label)}" class="ugap-famille-input" data-group-label="${gid}"></td>
                        <td>${typeSel}</td>
                        <td>${priceSel}</td>
                        <td>${decSel}</td>
                        <td><input value="${esc(g.keywords || '')}" class="ugap-famille-input" placeholder="Ex. coloris, finition" data-group-keywords="${gid}"></td>
                        <td class="ugap-famille-td-default">
                            <input type="checkbox" class="ugap-famille-default-group" data-group-default="${gid}"
                                ${isDefault ? 'checked' : ''}
                                aria-label="Groupe par défaut pour les options">
                        </td>
                        <td><button type="button" class="btn btn-outline" style="font-size:11px;" data-action="remove-group" data-group-id="${gid}">Supprimer</button></td>
                    </tr>
                `;
            }).join('')
            : '<tr><td colspan="8" class="ugap-famille-empty-cell">Aucun groupe.</td></tr>';

        mount.innerHTML = `
            <table class="ugap-famille-groups-table">
                <thead><tr>${headers}</tr></thead>
                <tbody>${rowsHtml}</tbody>
            </table>
        `;

        mount.querySelectorAll('[data-group-label]').forEach((input) => {
            input.addEventListener('change', () => {
                onGroupField(input.getAttribute('data-group-label'), 'label', input.value);
            });
        });
        mount.querySelectorAll('[data-group-keywords]').forEach((input) => {
            input.addEventListener('change', () => {
                onGroupField(input.getAttribute('data-group-keywords'), 'keywords', input.value);
            });
        });
        mount.querySelectorAll('[data-action="remove-group"]').forEach((btn) => {
            btn.addEventListener('click', () => {
                removeGroup(btn.getAttribute('data-group-id'));
                refreshGroupsPreview(root);
            });
        });
        mount.querySelectorAll('[data-group-default]').forEach((input) => {
            input.addEventListener('change', () => {
                if (input.checked) {
                    setDefaultDecisionGroup(input.getAttribute('data-group-default'));
                } else {
                    const draft = state().getCreateDraft();
                    if (String(draft.defaultDecisionGroupId) === String(input.getAttribute('data-group-default'))) {
                        input.checked = true;
                    }
                }
                refreshGroupsPreview(root);
            });
        });
    }

    function setDefaultDecisionGroup(groupId) {
        const draft = state().getCreateDraft();
        const gid = String(groupId || '').trim();
        const groups = normalizeGroups(draft.groups);
        if (!groups.some((g) => String(g.id) === gid)) return;
        draft.defaultDecisionGroupId = gid;
    }

    function refreshTypesList(root) {
        const listEl = root?.querySelector('[data-ugap-famille-types-list]');
        if (!listEl || !state()) return;
        const custom = state().getCustomGroupTypes().map(normalizeCustomTypeRow).filter((t) => t.value);
        const FDG = fdg();
        const builtin = Array.isArray(FDG?.BUILTIN_GROUP_TYPES) ? FDG.BUILTIN_GROUP_TYPES : [];
        const builtinHtml = builtin.length
            ? builtin.map((t) => `<li><code>${esc(t.value)}</code> — ${esc(t.label)} <em>(intégré)</em></li>`).join('')
            : '<li class="ugap-famille-muted">Aucun type intégré.</li>';
        const customRows = custom.length
            ? custom.map((t, i) => `
                <tr>
                    <td><input class="ugap-famille-input" data-type-row="${i}" data-type-field="label" value="${esc(t.label || '')}" placeholder="Libellé"></td>
                    <td><input class="ugap-famille-input" data-type-row="${i}" data-type-field="value" value="${esc(t.value || '')}" placeholder="code_normalise"></td>
                    <td>
                        <select class="ugap-famille-input" data-type-row="${i}" data-type-field="defaultDecisionMode">
                            <option value="" ${!t.defaultDecisionMode ? 'selected' : ''}>—</option>
                            <option value="single_choice" ${t.defaultDecisionMode === 'single_choice' ? 'selected' : ''}>Choix unique</option>
                            <option value="multi_choice" ${t.defaultDecisionMode === 'multi_choice' ? 'selected' : ''}>Choix multiple</option>
                        </select>
                    </td>
                    <td>
                        <select class="ugap-famille-input" data-type-row="${i}" data-type-field="defaultPriceMode">
                            <option value="" ${!t.defaultPriceMode ? 'selected' : ''}>—</option>
                            <option value="option" ${t.defaultPriceMode === 'option' ? 'selected' : ''}>Standard</option>
                            <option value="minoration" ${t.defaultPriceMode === 'minoration' ? 'selected' : ''}>Minoration</option>
                        </select>
                    </td>
                    <td class="ugap-famille-types-actions">
                        <button type="button" class="btn btn-outline" style="font-size:11px;padding:3px 7px;" data-save-type="${i}">Enregistrer</button>
                        <button type="button" class="btn btn-outline" style="font-size:11px;padding:3px 7px;" data-remove-type="${i}">Supprimer</button>
                    </td>
                </tr>
            `).join('')
            : '<tr><td colspan="5" class="ugap-famille-muted" style="padding:8px;">Aucun type personnalisé.</td></tr>';
        listEl.innerHTML = `
            <ul class="ugap-famille-types-ul"><strong>Intégrés</strong>${builtinHtml}</ul>
            <div class="ugap-famille-types-custom-wrap">
                <strong>Personnalisés</strong>
                <table class="ugap-famille-types-table">
                    <thead>
                        <tr>
                            <th>Libellé</th>
                            <th>Code</th>
                            <th>Décision défaut</th>
                            <th>Prix défaut</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>${customRows}</tbody>
                </table>
            </div>
        `;
        listEl.querySelectorAll('[data-remove-type]').forEach((btn) => {
            btn.addEventListener('click', () => {
                const idx = Number(btn.getAttribute('data-remove-type'));
                removeCustomGroupType(root, idx);
                refreshTypesList(root);
            });
        });
        listEl.querySelectorAll('[data-save-type]').forEach((btn) => {
            btn.addEventListener('click', () => {
                const idx = Number(btn.getAttribute('data-save-type'));
                saveCustomGroupType(root, idx);
                refreshTypesList(root);
            });
        });
    }

    function readTypeRowValues(root, idx) {
        const pick = (field) => root.querySelector(`[data-type-row="${idx}"][data-type-field="${field}"]`);
        const label = String(pick('label')?.value || '').trim();
        const valueRaw = String(pick('value')?.value || '').trim();
        const value = slugifyTypeId(valueRaw || label);
        const defaultDecisionMode = String(pick('defaultDecisionMode')?.value || '').trim();
        const defaultPriceMode = normalizeFamilyPriceMode(pick('defaultPriceMode')?.value || '');
        return {
            label,
            value,
            id: value,
            title: label || value,
            defaultDecisionMode: defaultDecisionMode || undefined,
            defaultPriceMode: defaultPriceMode || undefined,
        };
    }

    function remapGroupTypeInFamilies(oldType, nextType) {
        const from = slugifyTypeId(oldType);
        const to = slugifyTypeId(nextType || 'option') || 'option';
        if (!from || from === to) return;
        const list = state().getFamilies().map((family) => {
            const next = { ...(family || {}) };
            next.decisionGroups = normalizeGroups(family?.decisionGroups).map((group) => {
                if (slugifyTypeId(group?.type) !== from) return group;
                return { ...group, type: to };
            });
            return next;
        });
        state().setFamilies(list);
        const draft = state().getCreateDraft();
        draft.groups = normalizeGroups(draft.groups).map((group) => {
            if (slugifyTypeId(group?.type) !== from) return group;
            return { ...group, type: to };
        });
    }

    function saveCustomGroupType(root, idx) {
        const types = state().getCustomGroupTypes().map(normalizeCustomTypeRow);
        if (!Number.isInteger(idx) || idx < 0 || idx >= types.length) return;
        const current = types[idx];
        const nextRow = readTypeRowValues(root, idx);
        if (!nextRow.label) {
            global.showAlert?.('Libellé du type requis.', 'warning');
            return;
        }
        if (!nextRow.value) {
            global.showAlert?.('Code du type invalide.', 'warning');
            return;
        }
        if (getBuiltinTypeIds().has(nextRow.value)) {
            global.showAlert?.('Code reserve a un type integre.', 'warning');
            return;
        }
        const duplicate = types.some((t, i) => i !== idx && slugifyTypeId(t.value) === nextRow.value);
        if (duplicate) {
            global.showAlert?.('Ce code de type existe deja.', 'warning');
            return;
        }
        types[idx] = nextRow;
        state().setCustomGroupTypes(types);
        if (slugifyTypeId(current?.value) !== nextRow.value) {
            remapGroupTypeInFamilies(current?.value, nextRow.value);
        }
        refreshGroupsPreview(root);
        global.showAlert?.('Type de groupe mis a jour.', 'success');
    }

    function removeCustomGroupType(root, idx) {
        const types = state().getCustomGroupTypes().map(normalizeCustomTypeRow);
        if (!Number.isInteger(idx) || idx < 0 || idx >= types.length) return;
        const row = types[idx];
        const label = String(row?.label || row?.value || '').trim();
        if (!global.confirm?.(`Supprimer le type "${label}" ?\n\nLes groupes utilisant ce type seront remappes sur "option".`)) {
            return;
        }
        const next = types.filter((_, i) => i !== idx);
        state().setCustomGroupTypes(next);
        remapGroupTypeInFamilies(row?.value, 'option');
        refreshGroupsPreview(root);
        global.showAlert?.('Type de groupe supprime.', 'success');
    }

    function syncDraftFromInputs(root) {
        const draft = state().getCreateDraft();
        const label = root.querySelector('[data-field="familyLabel"]');
        const kw = root.querySelector('[data-field="familyKeyword"]');
        if (label) draft.familyLabel = label.value;
        if (kw) draft.familyKeyword = kw.value;
    }

    function fillDraftInputs(root) {
        const draft = state().getCreateDraft();
        const label = root.querySelector('[data-field="familyLabel"]');
        const kw = root.querySelector('[data-field="familyKeyword"]');
        if (label) label.value = draft.familyLabel || '';
        if (kw) {
            kw.value = draft.familyKeyword
                || draft.objectName
                || draft.familyKeywords
                || '';
        }
    }

    function onGroupField(groupId, field, value) {
        const draft = state().getCreateDraft();
        const FDG = fdg();
        const gid = String(groupId || '').trim();
        const groups = normalizeGroups(draft.groups);
        const idx = groups.findIndex((g) => String(g.id) === gid);
        if (idx < 0) return;
        const row = { ...groups[idx] };
        if (field === 'type' && FDG?.applyTypeDefaults) {
            Object.assign(row, FDG.applyTypeDefaults(row, value));
        } else if (field === 'type') {
            row.type = value;
        } else if (field === 'decisionMode' && FDG?.normalizeDecisionMode) {
            row.decisionMode = FDG.normalizeDecisionMode(value);
        } else if (field === 'priceMode' && FDG?.normalizePriceMode) {
            row.priceMode = FDG.normalizePriceMode({ priceMode: normalizeFamilyPriceMode(value) }, row.type);
        } else {
            row[field] = String(value || '').trim();
        }
        groups[idx] = FDG?.normalizeGroup ? FDG.normalizeGroup(row, idx) : row;
        draft.groups = groups.filter(Boolean);
        const lcRoot = global.document.getElementById('ugap-famille-lc-mount');
        if (lcRoot) refreshGroupsPreview(lcRoot);
    }

    function removeGroup(groupId) {
        const gid = String(groupId || '').trim();
        const draft = state().getCreateDraft();
        draft.groups = normalizeGroups(draft.groups).filter((g) => String(g.id) !== gid);
        draft.defaultDecisionGroupId = state().resolveDefaultDecisionGroupId(
            draft.groups,
            String(draft.defaultDecisionGroupId) === gid ? null : draft.defaultDecisionGroupId
        );
    }

    function addGroupRow(root) {
        const draft = state().getCreateDraft();
        const groups = normalizeGroups(draft.groups);
        const ids = groups.map((g) => g.id);
        const id = state().generateGroupId(ids);
        const FDG = fdg();
        const row = FDG?.newGroupWithTypeDefaults
            ? FDG.newGroupWithTypeDefaults({ id, label: 'Nouveau groupe' })
            : { id, label: 'Nouveau groupe', type: 'option', decisionMode: 'multi_choice', priceMode: 'option', keywords: '' };
        groups.push(row);
        draft.groups = groups;
        refreshGroupsPreview(root);
    }

    function addCustomGroupType(root) {
        const labelInput = root.querySelector('[data-types-field="label"]');
        const valueInput = root.querySelector('[data-types-field="value"]');
        const decisionSelect = root.querySelector('[data-types-field="decision"]');
        const priceSelect = root.querySelector('[data-types-field="price"]');
        const label = String(labelInput?.value || '').trim();
        if (!label) {
            global.showAlert?.('Libellé du type requis.', 'warning');
            return;
        }
        const valueRaw = String(valueInput?.value || '').trim();
        const value = slugifyTypeId(valueRaw || label);
        const defaultDecisionMode = String(decisionSelect?.value || '').trim();
        const defaultPriceMode = normalizeFamilyPriceMode(priceSelect?.value || '');
        const types = state().getCustomGroupTypes().map(normalizeCustomTypeRow);
        if (!value) {
            global.showAlert?.('Code du type invalide.', 'warning');
            return;
        }
        if (getBuiltinTypeIds().has(value)) {
            global.showAlert?.('Code reserve a un type integre.', 'warning');
            return;
        }
        if (types.some((t) => slugifyTypeId(t.value) === value)) {
            global.showAlert?.('Ce type existe déjà.', 'warning');
            return;
        }
        types.push({
            value,
            id: value,
            label,
            title: label,
            defaultDecisionMode: defaultDecisionMode || undefined,
            defaultPriceMode: defaultPriceMode || undefined,
        });
        state().setCustomGroupTypes(types);
        if (labelInput) labelInput.value = '';
        if (valueInput) valueInput.value = '';
        if (decisionSelect) decisionSelect.value = '';
        if (priceSelect) priceSelect.value = '';
        refreshTypesList(root);
        refreshGroupsPreview(root);
        global.showAlert?.('Type de groupe ajouté.', 'success');
    }

    function submitFamily(root) {
        const formRoot = root?.querySelector?.('[data-ugap-famille-create-form]');
        if (formRoot?.dataset.submitting === '1') return;
        if (formRoot) formRoot.dataset.submitting = '1';
        syncDraftFromInputs(root);
        const draft = state().getCreateDraft();
        const familyLabel = String(draft.familyLabel || '').trim();
        if (!familyLabel) {
            global.showAlert?.('Nom de famille requis.', 'warning');
            if (formRoot) formRoot.dataset.submitting = '0';
            return;
        }
        const groups = normalizeGroups(draft.groups);
        if (!groups.length) {
            global.showAlert?.('Ajoutez au moins un groupe.', 'warning');
            if (formRoot) formRoot.dataset.submitting = '0';
            return;
        }
        const keyword = String(draft.familyKeyword || '').trim();
        const defaultDecisionGroupId = state().resolveDefaultDecisionGroupId(
            groups,
            draft.defaultDecisionGroupId
        );
        const payload = {
            familyLabel,
            familyKeyword: keyword,
            objectName: keyword,
            defaultDecisionGroupId,
            decisionGroups: groups,
            optionIds: [],
        };
        const editIndex = Number(draft.editIndex);
        const isEdit = Number.isInteger(editIndex) && editIndex >= 0;
        if (isEdit) {
            state().updateFamily(editIndex, payload);
        } else {
            state().addFamily(payload);
        }
        state().resetCreateDraft();
        closeCreatePanel(root);
        global.UgapFamilleLcTab?.refresh?.();
        global.showAlert?.(isEdit
            ? 'Famille modifiée (brouillon local).'
            : 'Famille ajoutée et enregistrée.', 'success');
        if (formRoot) {
            setTimeout(() => { formRoot.dataset.submitting = '0'; }, 250);
        }
    }

    function closeCreatePanel(root) {
        const formRoot = root?.querySelector?.('[data-ugap-famille-create-form]') || root;
        const panel = formRoot?.closest('[data-ugap-vue-lc]')?.querySelector('[data-ugap-lc-create-panel="famille"]');
        const btn = formRoot?.closest('[data-ugap-vue-lc]')?.querySelector('[data-ugap-lc-create="famille"]');
        if (panel) panel.setAttribute('hidden', '');
        if (btn) btn.setAttribute('aria-expanded', 'false');
    }

    function openEditFamily(lcRoot, index) {
        const list = state().getFamilies();
        const idx = Number(index);
        if (!Number.isInteger(idx) || idx < 0 || idx >= list.length) return;
        const family = list[idx] || {};
        const draft = state().getCreateDraft();
        draft.editIndex = idx;
        draft.familyLabel = String(family.familyLabel || '').trim();
        draft.familyKeyword = String(family.familyKeyword || family.objectName || '').trim();
        draft.groups = normalizeGroups(family.decisionGroups);
        draft.defaultDecisionGroupId = state().resolveDefaultDecisionGroupId(
            draft.groups,
            family.defaultDecisionGroupId
        );

        const formRoot = lcRoot?.querySelector('[data-ugap-famille-create-form]');
        const panel = lcRoot?.querySelector('[data-ugap-lc-create-panel="famille"]');
        const btn = lcRoot?.querySelector('[data-ugap-lc-create="famille"]');
        if (panel) panel.removeAttribute('hidden');
        if (btn) btn.setAttribute('aria-expanded', 'true');
        if (formRoot) {
            const submitBtn = formRoot.querySelector('[data-submit-family-btn]');
            if (submitBtn) submitBtn.textContent = 'Enregistrer les modifications';
            fillDraftInputs(formRoot);
            refreshGroupsPreview(lcRoot);
            formRoot.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' });
        }
    }

    function bindCreateForm(lcRoot) {
        const formRoot = lcRoot.querySelector('[data-ugap-famille-create-form]');
        if (!formRoot || formRoot.dataset.bound === '1') return;
        formRoot.dataset.bound = '1';

        state()?.syncGroupTypesCatalog();
        fillDraftInputs(formRoot);
        refreshGroupsPreview(lcRoot);
        refreshTypesList(lcRoot);

        formRoot.querySelectorAll('[data-field]').forEach((el) => {
            el.addEventListener('input', () => syncDraftFromInputs(formRoot));
        });

        formRoot.addEventListener('click', (ev) => {
            const btn = ev.target.closest('[data-action]');
            if (!btn) return;
            const action = btn.getAttribute('data-action');
            if (action === 'add-group') addGroupRow(lcRoot);
            if (action === 'submit-family') submitFamily(lcRoot);
        });

        lcRoot.querySelector('[data-action="toggle-types"]')?.addEventListener('click', () => {
            const panel = lcRoot.querySelector('[data-ugap-famille-types-panel]');
            if (!panel) return;
            const hidden = panel.hasAttribute('hidden');
            if (hidden) panel.removeAttribute('hidden');
            else panel.setAttribute('hidden', '');
            refreshTypesList(lcRoot);
        });

        lcRoot.querySelector('[data-action="add-type"]')?.addEventListener('click', () => {
            addCustomGroupType(lcRoot);
        });
    }

    function onCreatePanelOpen(lcRoot) {
        state()?.resetCreateDraft();
        const formRoot = lcRoot?.querySelector('[data-ugap-famille-create-form]');
        if (formRoot) {
            const submitBtn = formRoot.querySelector('[data-submit-family-btn]');
            if (submitBtn) submitBtn.textContent = 'Enregistrer la famille';
            fillDraftInputs(formRoot);
            refreshGroupsPreview(lcRoot);
        }
    }

    global[NS] = {
        renderCreateFormHtml,
        renderTypesManagerHtml,
        bindCreateForm,
        onCreatePanelOpen,
        openEditFamily,
        onGroupField,
        refreshGroupsPreview,
    };
})(window);
