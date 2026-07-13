/**
 * FICHIER : modules/ugap/frontend/parametrage/assets/js/devis/info-entreprise-tab.js
 * RÔLE : Onglet paramétrage options devis + commerciaux (identité via Annuaire).
 */
(function initUgapInfoEntrepriseTab(global) {
    'use strict';

    const state = {
        settings: null,
        entityUsers: [],
        mounted: false,
        editingCommercial: null
    };

    const DEVIS_FIELDS = [
        'validiteDevisJours', 'numeroDevisPrefix', 'conditionsPaiement', 'delaiLivraison', 'mentionsLegales'
    ];

    function esc(v) {
        if (typeof global.UgapShared?.escapeHtml === 'function') return global.UgapShared.escapeHtml(v);
        return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    function apiCall(endpoint, options) {
        if (typeof global.UgapShared?.apiCall === 'function') {
            return global.UgapShared.apiCall(endpoint, options);
        }
        return global.apiCall(endpoint, options);
    }

    function showAlert(msg, type) {
        if (typeof global.UgapShared?.showAlert === 'function') {
            global.UgapShared.showAlert(msg, type);
            return;
        }
        alert(msg);
    }

    function byId(id) {
        return document.getElementById(id);
    }

    function annuaireUrl() {
        const section = byId('ugap-section-info-entreprise');
        return section?.getAttribute('data-annuaire-url') || '/frontend/pages/modules/annuaire.php';
    }

    function readDevisForm(form) {
        const data = {};
        DEVIS_FIELDS.forEach((field) => {
            const el = form.elements.namedItem(field);
            if (!el) return;
            data[field] = field === 'validiteDevisJours'
                ? Number(el.value || 30)
                : String(el.value || '').trim();
        });
        return data;
    }

    function fillDevisForm(form, info) {
        const data = info && typeof info === 'object' ? info : {};
        DEVIS_FIELDS.forEach((field) => {
            const el = form.elements.namedItem(field);
            if (!el || data[field] == null) return;
            el.value = String(data[field]);
        });
    }

    function formatAddress(info) {
        const parts = [
            info.adresse,
            info.adresseComplement,
            [info.codePostal, info.ville].filter(Boolean).join(' '),
            info.pays && info.pays !== 'France' ? info.pays : null
        ].map((p) => String(p || '').trim()).filter(Boolean);
        return parts.join(', ') || '—';
    }

    function renderIdentityPreview(info) {
        const wrap = byId('ugap-entreprise-identity-content');
        if (!wrap) return;
        const data = info && typeof info === 'object' ? info : {};
        const rows = [
            ['Raison sociale', data.raisonSociale],
            ['Forme juridique', data.formeJuridique],
            ['SIRET', data.siret],
            ['TVA intracommunautaire', data.tvaIntracommunautaire],
            ['RCS', data.rcs],
            ['Capital social', data.capitalSocial],
            ['Adresse', formatAddress(data)],
            ['Téléphone', data.telephone],
            ['Email', data.email],
            ['Site web', data.siteWeb]
        ];
        wrap.innerHTML = `
            <dl class="ugap-identity-dl" style="display:grid;grid-template-columns:minmax(140px,200px) 1fr;gap:8px 16px;margin:0;">
                ${rows.map(([label, value]) => `
                    <dt style="margin:0;color:#64748b;">${esc(label)}</dt>
                    <dd style="margin:0;">${esc(value || '—')}</dd>
                `).join('')}
            </dl>
            <p style="margin:12px 0 0;font-size:13px;color:#64748b;">
                Pour modifier ces informations, utilisez
                <a href="${esc(annuaireUrl())}" target="_blank" rel="noopener">l'Annuaire</a>.
            </p>`;
    }

    function commercialLabel(c) {
        const name = `${c.prenom || ''} ${c.nom || ''}`.trim();
        return name || c.email || 'Commercial';
    }

    function renderCommerciauxList() {
        const wrap = byId('ugap-commerciaux-list');
        if (!wrap) return;
        const list = Array.isArray(state.settings?.commerciaux) ? state.settings.commerciaux : [];
        if (!list.length) {
            const hasUsers = Array.isArray(state.entityUsers) && state.entityUsers.length > 0;
            wrap.innerHTML = `<p class="ugap-param-placeholder">${hasUsers
                ? 'Aucun commercial configuré. Ajoutez un utilisateur de l\'entreprise.'
                : 'Aucun utilisateur lié à cette entreprise.'}</p>`;
            return;
        }
        wrap.innerHTML = `
            <table class="ugap-devis-table">
                <thead>
                    <tr>
                        <th>Nom</th>
                        <th>Email</th>
                        <th>Téléphone</th>
                        <th>Compte lié</th>
                        <th>Statut</th>
                        <th></th>
                    </tr>
                </thead>
                <tbody>
                    ${list.map((c) => {
                        const user = state.entityUsers.find((u) => u.userId === c.userId);
                        const linked = user
                            ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email
                            : (c.userId ? c.userId : '—');
                        return `<tr>
                            <td>${esc(commercialLabel(c))}${c.fonction ? `<div style="font-size:12px;color:#64748b;">${esc(c.fonction)}</div>` : ''}</td>
                            <td>${esc(c.email || '—')}</td>
                            <td>${esc(c.telephone || '—')}</td>
                            <td>${esc(linked)}</td>
                            <td>${c.actif !== false ? '<span class="ugap-tag ugap-tag--ok">Actif</span>' : '<span class="ugap-tag">Inactif</span>'}</td>
                            <td class="ugap-devis-table-actions">
                                <button type="button" class="btn btn-outline btn-sm" data-edit-commercial="${esc(c.id)}">Modifier</button>
                                <button type="button" class="btn btn-outline btn-sm" data-delete-commercial="${esc(c.id)}" style="color:#b91c1c;border-color:#fca5a5;">Supprimer</button>
                            </td>
                        </tr>`;
                    }).join('')}
                </tbody>
            </table>`;
        wrap.querySelectorAll('[data-edit-commercial]').forEach((btn) => {
            btn.addEventListener('click', () => openCommercialModal(btn.getAttribute('data-edit-commercial')));
        });
        wrap.querySelectorAll('[data-delete-commercial]').forEach((btn) => {
            btn.addEventListener('click', () => void deleteCommercial(btn.getAttribute('data-delete-commercial')));
        });
    }

    function fillUserSelect(editingCommercialId) {
        const select = byId('ugap-commercial-user-select');
        if (!select) return;
        const current = select.value;
        const usedUserIds = new Set(
            (Array.isArray(state.settings?.commerciaux) ? state.settings.commerciaux : [])
                .filter((c) => c.id !== editingCommercialId && c.userId)
                .map((c) => String(c.userId))
        );
        select.innerHTML = '<option value="">— Choisir un utilisateur —</option>';
        const available = state.entityUsers.filter((u) => !usedUserIds.has(String(u.userId)));
        if (!available.length) {
            const opt = document.createElement('option');
            opt.value = '';
            opt.textContent = 'Aucun utilisateur disponible';
            opt.disabled = true;
            select.appendChild(opt);
        }
        available.forEach((u) => {
            const label = `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.username || u.email;
            const opt = document.createElement('option');
            opt.value = u.userId;
            opt.textContent = `${label} (${u.email})`;
            select.appendChild(opt);
        });
        if (current && [...select.options].some((o) => o.value === current)) {
            select.value = current;
        }
    }

    function openCommercialModal(commercialId) {
        const modal = byId('ugap-commercial-modal');
        const form = byId('ugap-commercial-form');
        const title = byId('ugap-commercial-modal-title');
        if (!modal || !form) return;
        const list = Array.isArray(state.settings?.commerciaux) ? state.settings.commerciaux : [];
        const commercial = commercialId
            ? list.find((c) => c.id === commercialId)
            : null;
        fillUserSelect(commercial?.id || null);
        state.editingCommercial = commercial;
        if (title) title.textContent = commercial ? 'Modifier le commercial' : 'Ajouter un commercial';
        form.reset();
        if (commercial) {
            ['id', 'userId', 'prenom', 'nom', 'email', 'telephone', 'fonction'].forEach((field) => {
                const el = form.elements.namedItem(field);
                if (el) el.value = commercial[field] || '';
            });
            const actifEl = form.elements.namedItem('actif');
            if (actifEl) actifEl.checked = commercial.actif !== false;
            if (commercial.userId) applyUserToCommercialForm(commercial.userId, true);
        }
        modal.classList.remove('hidden');
        modal.setAttribute('aria-hidden', 'false');
    }

    function closeCommercialModal() {
        const modal = byId('ugap-commercial-modal');
        if (!modal) return;
        modal.classList.add('hidden');
        modal.setAttribute('aria-hidden', 'true');
        state.editingCommercial = null;
    }

    function applyUserToCommercialForm(userId, force) {
        const user = state.entityUsers.find((u) => u.userId === userId);
        const form = byId('ugap-commercial-form');
        if (!user || !form) return;
        const prenom = form.elements.namedItem('prenom');
        const nom = form.elements.namedItem('nom');
        const email = form.elements.namedItem('email');
        const tel = form.elements.namedItem('telephone');
        if (prenom && (force || !prenom.value)) prenom.value = user.firstName || '';
        if (nom && (force || !nom.value)) nom.value = user.lastName || '';
        if (email && (force || !email.value)) email.value = user.email || '';
        if (tel && (force || !tel.value)) tel.value = user.phone || '';
    }

    async function loadData() {
        const [settingsRes, usersRes] = await Promise.all([
            apiCall('/devis-settings'),
            apiCall('/devis-settings/entity-users').catch(() => ({ data: { users: [] } }))
        ]);
        state.settings = settingsRes?.data || { entrepriseInfo: {}, commerciaux: [] };
        state.entityUsers = Array.isArray(usersRes?.data?.users) ? usersRes.data.users : [];
        const form = byId('ugap-entreprise-info-form');
        if (form) fillDevisForm(form, state.settings.entrepriseInfo);
        renderIdentityPreview(state.settings.entrepriseInfo);
        const status = byId('ugap-entreprise-info-status');
        if (status) status.textContent = '';
        renderCommerciauxList();
    }

    async function saveDevisOptions(event) {
        event.preventDefault();
        const form = byId('ugap-entreprise-info-form');
        const status = byId('ugap-entreprise-info-status');
        if (!form) return;
        try {
            const devisOptions = readDevisForm(form);
            await apiCall('/devis-settings', {
                method: 'PUT',
                body: JSON.stringify({ entrepriseInfo: devisOptions })
            });
            state.settings = {
                ...state.settings,
                entrepriseInfo: { ...(state.settings?.entrepriseInfo || {}), ...devisOptions }
            };
            if (status) status.textContent = 'Options devis enregistrées.';
            showAlert('Options devis enregistrées.', 'success');
        } catch (error) {
            if (status) status.textContent = '';
            showAlert(error.message || 'Erreur enregistrement', 'error');
        }
    }

    async function saveCommercial(event) {
        event.preventDefault();
        const form = byId('ugap-commercial-form');
        if (!form) return;
        const get = (name) => {
            const el = form.elements.namedItem(name);
            if (!el) return '';
            if (el.type === 'checkbox') return el.checked;
            return String(el.value || '').trim();
        };
        const payload = {
            id: get('id') || undefined,
            userId: get('userId') || null,
            prenom: get('prenom'),
            nom: get('nom'),
            email: get('email'),
            telephone: get('telephone'),
            fonction: get('fonction'),
            actif: get('actif')
        };
        if (!payload.userId) {
            showAlert('Sélectionnez un utilisateur lié à l\'entreprise.', 'error');
            return;
        }
        try {
            const result = await apiCall('/devis-settings/commerciaux', {
                method: 'POST',
                body: JSON.stringify(payload)
            });
            const saved = result?.data?.commercial;
            const list = Array.isArray(state.settings?.commerciaux) ? [...state.settings.commerciaux] : [];
            const idx = list.findIndex((c) => c.id === saved?.id);
            if (idx >= 0) list[idx] = saved;
            else if (saved) list.push(saved);
            state.settings = { ...state.settings, commerciaux: list };
            renderCommerciauxList();
            closeCommercialModal();
            showAlert('Commercial enregistré.', 'success');
        } catch (error) {
            showAlert(error.message || 'Erreur enregistrement commercial', 'error');
        }
    }

    async function deleteCommercial(commercialId) {
        const id = String(commercialId || '').trim();
        if (!id) return;
        if (!global.confirm('Supprimer ce commercial ?')) return;
        try {
            await apiCall(`/devis-settings/commerciaux/${encodeURIComponent(id)}`, { method: 'DELETE' });
            const list = (state.settings?.commerciaux || []).filter((c) => c.id !== id);
            state.settings = { ...state.settings, commerciaux: list };
            renderCommerciauxList();
            showAlert('Commercial supprimé.', 'success');
        } catch (error) {
            showAlert(error.message || 'Erreur suppression', 'error');
        }
    }

    function bindEvents() {
        if (state.mounted) return;
        state.mounted = true;
        byId('ugap-entreprise-info-form')?.addEventListener('submit', saveDevisOptions);
        byId('ugap-info-entreprise-refresh')?.addEventListener('click', () => void loadData());
        byId('ugap-commercial-add-btn')?.addEventListener('click', () => openCommercialModal(null));
        byId('ugap-commercial-form')?.addEventListener('submit', saveCommercial);
        byId('ugap-commercial-modal-close')?.addEventListener('click', closeCommercialModal);
        byId('ugap-commercial-modal-cancel')?.addEventListener('click', closeCommercialModal);
        byId('ugap-commercial-user-select')?.addEventListener('change', (e) => {
            const uid = String(e.target?.value || '').trim();
            if (uid) applyUserToCommercialForm(uid, true);
        });
        byId('ugap-commercial-modal')?.addEventListener('click', (e) => {
            if (e.target?.id === 'ugap-commercial-modal') closeCommercialModal();
        });
    }

    async function mount() {
        bindEvents();
        const wrap = byId('ugap-commerciaux-list');
        if (wrap) wrap.innerHTML = '<p class="ugap-param-placeholder">Chargement…</p>';
        try {
            await loadData();
        } catch (error) {
            if (wrap) wrap.innerHTML = `<p class="ugap-param-placeholder" style="color:#b91c1c;">${esc(error.message)}</p>`;
        }
    }

    global.UgapInfoEntrepriseTab = { mount, refresh: loadData };
}(window));
