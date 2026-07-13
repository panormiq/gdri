/**
 * FICHIER : modules/ugap/frontend/assets/js/configurateur/configurateur-client-step.js
 * RÔLE : Étape 1 configurateur — sélection client (liste) + formulaire nouveau client.
 */
(function initUgapConfiguratorClientStep(global) {
    'use strict';

    const CLIENT_FIELDS = [
        'type', 'raisonSociale', 'prenom', 'nom', 'adresse', 'adresseComplement',
        'codePostal', 'ville', 'pays', 'siret', 'tvaIntracommunautaire',
        'telephone', 'email', 'contactNom', 'contactFonction', 'notes'
    ];

    function esc(v) {
        return String(v ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function emptyClientInfo() {
        return {
            type: 'entreprise',
            raisonSociale: '',
            prenom: '',
            nom: '',
            adresse: '',
            adresseComplement: '',
            codePostal: '',
            ville: '',
            pays: 'France',
            siret: '',
            tvaIntracommunautaire: '',
            telephone: '',
            email: '',
            contactNom: '',
            contactFonction: '',
            notes: ''
        };
    }

    function readClientForm(form) {
        const data = emptyClientInfo();
        CLIENT_FIELDS.forEach((field) => {
            const el = form.elements.namedItem(field);
            if (!el) return;
            if (field === 'type') {
                data.type = el.value === 'particulier' ? 'particulier' : 'entreprise';
            } else {
                data[field] = String(el.value || '').trim();
            }
        });
        return data;
    }

    function fillClientForm(form, info) {
        const data = { ...emptyClientInfo(), ...(info || {}) };
        CLIENT_FIELDS.forEach((field) => {
            const el = form.elements.namedItem(field);
            if (!el) return;
            el.value = data[field] != null ? String(data[field]) : '';
        });
        toggleClientTypeFields(form, data.type);
    }

    function toggleClientTypeFields(form, type) {
        const isParticulier = type === 'particulier';
        form.querySelectorAll('[data-client-field-scope]').forEach((el) => {
            const scope = el.getAttribute('data-client-field-scope');
            const show = scope === 'both'
                || (scope === 'entreprise' && !isParticulier)
                || (scope === 'particulier' && isParticulier);
            el.style.display = show ? '' : 'none';
        });
    }

    function clientDisplayName(client) {
        if (!client) return '';
        if (client.displayName) return client.displayName;
        if (client.type === 'particulier') {
            return `${client.prenom || ''} ${client.nom || ''}`.trim() || 'Client particulier';
        }
        return client.raisonSociale || 'Client entreprise';
    }

    function clientSelectLabel(client) {
        const name = clientDisplayName(client);
        const parts = [name];
        if (client.ville) parts.push(client.ville);
        if (client.email) parts.push(client.email);
        return parts.filter(Boolean).join(' — ');
    }

    function validateClientInfo(info) {
        const data = info && typeof info === 'object' ? info : emptyClientInfo();
        if (data.type === 'particulier') {
            if (!data.prenom && !data.nom) {
                return 'Indiquez au moins le prénom ou le nom du client.';
            }
        } else if (!data.raisonSociale) {
            return 'Indiquez la raison sociale du client.';
        }
        return '';
    }

    function isNewClientFormVisible() {
        const panel = document.getElementById('ugap-client-form-panel');
        return !!(panel && !panel.hidden);
    }

    async function apiCall(endpoint, options) {
        if (typeof global.apiCall === 'function') return global.apiCall(endpoint, options);
        throw new Error('API non disponible');
    }

    async function ensureDevisMeta(state) {
        if (state._devisMetaLoaded) return;
        const [ctxRes, clientsRes] = await Promise.all([
            apiCall('/devis-context'),
            apiCall('/clients')
        ]);
        state.devisContext = ctxRes?.data || {};
        state.clients = Array.isArray(clientsRes?.data?.clients) ? clientsRes.data.clients : [];
        if (!state.commercialId && state.devisContext.defaultCommercialId) {
            state.commercialId = state.devisContext.defaultCommercialId;
        }
        if (!state.clientInfo || typeof state.clientInfo !== 'object') {
            state.clientInfo = emptyClientInfo();
        }
        if (state.showNewClientForm == null) {
            state.showNewClientForm = false;
        }
        if (state.clientFormIsEdit == null) {
            state.clientFormIsEdit = false;
        }
        state._devisMetaLoaded = true;
    }

    function renderCommercialSelect(state) {
        const select = document.getElementById('ugap-devis-commercial-select');
        if (!select) return;
        const list = Array.isArray(state.devisContext?.commerciaux) ? state.devisContext.commerciaux : [];
        select.innerHTML = '<option value="">— Sélectionner —</option>';
        list.forEach((c) => {
            const label = `${c.prenom || ''} ${c.nom || ''}`.trim() || c.email || 'Commercial';
            const opt = document.createElement('option');
            opt.value = c.id;
            opt.textContent = c.fonction ? `${label} (${c.fonction})` : label;
            select.appendChild(opt);
        });
        if (state.commercialId) select.value = state.commercialId;
    }

    function renderClientSelect(state) {
        const select = document.getElementById('ugap-devis-client-select');
        if (!select) return;
        select.innerHTML = '<option value="">— Sélectionner —</option>';
        (state.clients || []).forEach((c) => {
            const opt = document.createElement('option');
            opt.value = c.id;
            opt.textContent = clientSelectLabel(c);
            select.appendChild(opt);
        });
        if (state.selectedClientId && !state.showNewClientForm) {
            select.value = state.selectedClientId;
        } else {
            select.value = '';
        }
    }

    function updateClientActionButtons(state) {
        const newBtn = document.getElementById('ugap-client-new-btn');
        const editBtn = document.getElementById('ugap-client-edit-btn');
        const saveBtn = document.getElementById('ugap-client-save-to-directory');
        const formOpen = !!state.showNewClientForm;
        const hasSelection = !!String(state.selectedClientId || '').trim();
        if (newBtn) newBtn.hidden = formOpen;
        if (editBtn) editBtn.hidden = formOpen || !hasSelection;
        if (saveBtn) {
            saveBtn.textContent = state.clientFormIsEdit
                ? 'Enregistrer les modifications'
                : 'Enregistrer dans le répertoire clients';
        }
    }

    function setClientFormVisible(state, visible) {
        state.showNewClientForm = !!visible;
        const panel = document.getElementById('ugap-client-form-panel');
        if (panel) panel.hidden = !state.showNewClientForm;
        if (!visible) state.clientFormIsEdit = false;
        updateClientActionButtons(state);
    }

    function openNewClientForm(state) {
        if (state.showNewClientForm) return;
        const form = document.getElementById('ugap-client-info-form');
        state.clientFormIsEdit = false;
        state.selectedClientId = null;
        state.clientInfo = emptyClientInfo();
        const select = document.getElementById('ugap-devis-client-select');
        if (select) select.value = '';
        if (form) fillClientForm(form, state.clientInfo);
        setClientFormVisible(state, true);
        updateStepWarning(state);
    }

    function openEditClientForm(state) {
        const id = String(state.selectedClientId || '').trim();
        if (!id || state.showNewClientForm) return;
        const client = (state.clients || []).find((c) => c.id === id);
        if (!client) return;
        const form = document.getElementById('ugap-client-info-form');
        state.clientFormIsEdit = true;
        state.clientInfo = { ...emptyClientInfo(), ...client };
        if (form) fillClientForm(form, state.clientInfo);
        setClientFormVisible(state, true);
        updateStepWarning(state);
    }

    function applySelectedClient(state, clientId) {
        const id = String(clientId || '').trim();
        const form = document.getElementById('ugap-client-info-form');
        if (!id) {
            state.selectedClientId = null;
            if (!state.showNewClientForm) {
                state.clientInfo = emptyClientInfo();
            }
            updateClientActionButtons(state);
            updateStepWarning(state);
            return;
        }
        const client = (state.clients || []).find((c) => c.id === id);
        if (!client) return;
        state.selectedClientId = id;
        state.clientInfo = { ...emptyClientInfo(), ...client };
        state.showNewClientForm = false;
        state.clientFormIsEdit = false;
        setClientFormVisible(state, false);
        if (form) fillClientForm(form, state.clientInfo);
        updateStepWarning(state);
    }

    function bindClientFormOnce(state) {
        if (state._clientFormBound) return;
        state._clientFormBound = true;
        const form = document.getElementById('ugap-client-info-form');
        form?.querySelector('[name="type"]')?.addEventListener('change', (e) => {
            toggleClientTypeFields(form, e.target.value);
            syncFromForm(state);
        });
        form?.addEventListener('input', () => {
            if (isNewClientFormVisible()) syncFromForm(state);
        });
        document.getElementById('ugap-devis-client-select')?.addEventListener('change', (e) => {
            const id = String(e.target.value || '').trim();
            if (id) {
                applySelectedClient(state, id);
            } else {
                state.selectedClientId = null;
                state.clientInfo = emptyClientInfo();
                state.clientFormIsEdit = false;
                setClientFormVisible(state, false);
                updateStepWarning(state);
            }
            updateClientActionButtons(state);
        });
        document.getElementById('ugap-devis-commercial-select')?.addEventListener('change', (e) => {
            state.commercialId = String(e.target.value || '').trim() || null;
        });
        document.getElementById('ugap-client-new-btn')?.addEventListener('click', () => {
            openNewClientForm(state);
        });
        document.getElementById('ugap-client-edit-btn')?.addEventListener('click', () => {
            openEditClientForm(state);
        });
        document.getElementById('ugap-client-form-cancel')?.addEventListener('click', () => {
            setClientFormVisible(state, false);
            if (state.selectedClientId) {
                applySelectedClient(state, state.selectedClientId);
            } else {
                state.clientInfo = emptyClientInfo();
            }
            updateStepWarning(state);
        });
        document.getElementById('ugap-client-save-to-directory')?.addEventListener('click', () => {
            void saveClientToDirectory(state);
        });
    }

    async function saveClientToDirectory(state) {
        const form = document.getElementById('ugap-client-info-form');
        if (!form) return;
        syncFromForm(state);
        const err = validateClientInfo(state.clientInfo);
        if (err) {
            alert(err);
            return;
        }
        const info = state.clientInfo;
        try {
            let saved;
            if (state.clientFormIsEdit && state.selectedClientId) {
                const result = await apiCall(`/clients/${encodeURIComponent(state.selectedClientId)}`, {
                    method: 'PUT',
                    body: JSON.stringify(info)
                });
                saved = result?.data?.client;
            } else {
                const result = await apiCall('/clients', {
                    method: 'POST',
                    body: JSON.stringify(info)
                });
                saved = result?.data?.client;
            }
            if (saved?.id) {
                const wasEdit = !!state.clientFormIsEdit;
                const list = Array.isArray(state.clients) ? [...state.clients] : [];
                const idx = list.findIndex((c) => c.id === saved.id);
                if (idx >= 0) list[idx] = saved;
                else list.unshift(saved);
                state.clients = list;
                applySelectedClient(state, saved.id);
                renderClientSelect(state);
                alert(wasEdit ? 'Client mis à jour.' : 'Client enregistré dans le répertoire.');
            }
        } catch (error) {
            alert('Erreur : ' + (error.message || 'enregistrement client'));
        }
    }

    function syncFromForm(state) {
        const form = document.getElementById('ugap-client-info-form');
        if (isNewClientFormVisible() && form) {
            state.clientInfo = readClientForm(form);
            if (!state.clientFormIsEdit) {
                state.selectedClientId = null;
                const select = document.getElementById('ugap-devis-client-select');
                if (select) select.value = '';
            }
        }
        const commercialSelect = document.getElementById('ugap-devis-commercial-select');
        if (commercialSelect) {
            state.commercialId = String(commercialSelect.value || '').trim() || null;
        }
        updateStepWarning(state);
        return state.clientInfo;
    }

    function getValidationWarning(state) {
        if (!state.clientInfo || typeof state.clientInfo !== 'object') {
            return validateClientInfo(emptyClientInfo());
        }
        return validateClientInfo(state.clientInfo);
    }

    function updateStepWarning(state) {
        const badge = document.getElementById('ugap-step-client-warning');
        const stepEl = document.querySelector('.step-indicator .step[data-step="1"]');
        const msg = getValidationWarning(state);
        if (badge) {
            if (msg) {
                badge.hidden = false;
                badge.textContent = 'Incomplet';
                badge.title = msg;
            } else {
                badge.hidden = true;
                badge.textContent = '';
                badge.title = '';
            }
        }
        if (stepEl) {
            stepEl.classList.toggle('has-warning', !!msg);
            stepEl.setAttribute('aria-describedby', msg ? 'ugap-step-client-warning' : '');
        }
    }

    async function render(state) {
        const root = document.getElementById('step-client');
        if (!root) return;
        try {
            await ensureDevisMeta(state);
        } catch (error) {
            root.innerHTML = `<p style="color:#b91c1c;">${esc(error.message)}</p>`;
            return;
        }
        bindClientFormOnce(state);
        renderCommercialSelect(state);
        renderClientSelect(state);
        setClientFormVisible(state, !!state.showNewClientForm);
        const form = document.getElementById('ugap-client-info-form');
        if (form && state.clientInfo && state.showNewClientForm) {
            fillClientForm(form, state.clientInfo);
        }
        updateClientActionButtons(state);
        updateStepWarning(state);
    }

    function collectFromForm(state) {
        syncFromForm(state);
        return '';
    }

    function applyPayload(state, payload) {
        if (!payload || typeof payload !== 'object') return;
        if (payload.clientId) state.selectedClientId = String(payload.clientId).trim() || null;
        if (payload.clientInfo && typeof payload.clientInfo === 'object') {
            state.clientInfo = { ...emptyClientInfo(), ...payload.clientInfo };
        }
        if (payload.commercialId) state.commercialId = String(payload.commercialId).trim() || null;
        state.showNewClientForm = false;
        state.clientFormIsEdit = false;
    }

    function buildSnapshot(state) {
        syncFromForm(state);
        return {
            clientId: state.selectedClientId || null,
            clientInfo: state.clientInfo ? { ...state.clientInfo } : null,
            commercialId: state.commercialId || null
        };
    }

    function reset(state) {
        state.selectedClientId = null;
        state.clientInfo = emptyClientInfo();
        state.commercialId = state.devisContext?.defaultCommercialId || null;
        state.showNewClientForm = false;
        state.clientFormIsEdit = false;
    }

    global.UgapConfiguratorClientStep = {
        render,
        collectFromForm,
        syncFromForm,
        getValidationWarning,
        updateStepWarning,
        applyPayload,
        buildSnapshot,
        reset,
        emptyClientInfo
    };
}(window));
