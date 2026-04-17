<?php
/**
 * Backoffice IA – Gestion des LLMs par entité
 * Fichier : modules/ia/frontend/backoffice/llms.php
 */
require_once __DIR__ . '/bootstrap.php';

if (!hasRole(ROLE_ADMIN_GDRI) && !hasRole(ROLE_ADMIN_ENTITY)) {
    redirect(url('pages/dashboard.php'));
}

$page_title = 'IA – LLMs de l\'entité';
require_once GDRI_ROOT . '/frontend/includes/header.php';

$jwt_token = getJWTToken();
$api_base_url = rtrim(getApiBaseUrl(), '/');
$is_admin_gdri = hasRole(ROLE_ADMIN_GDRI);

$ia_entity_current_tab = 'llms';
require_once __DIR__ . '/entity-tabs.php';
?>

<section class="section">
    <div class="container">
        <div class="card">
            <div class="card-header d-flex justify-content-between align-items-center">
                <h2 class="mb-0">Nos IA</h2>
                <div class="d-flex gap-2">
                    <button id="btnRefreshIa" class="btn btn-sm btn-outline" type="button">Rafraîchir</button>
                    <button id="btnNewLlm" class="btn btn-sm btn-primary" type="button">+ Ajouter un modèle</button>
                </div>
            </div>
            <div class="card-body">
                <div id="llmMessage" class="mb-2 small" style="min-height:1rem;"></div>
                <div class="table-responsive">
                    <table class="table">
                        <thead>
                            <tr>
                                <th>Nom</th>
                                <th>Fournisseur</th>
                                <th>Modèle</th>
                                <th>Par défaut</th>
                                <th style="width:160px;">Actions</th>
                            </tr>
                        </thead>
                        <tbody id="llmTableBody">
                            <tr><td colspan="5">Chargement…</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>

        <div class="card mt-3">
            <div class="card-header">
                <h3 id="llmFormTitle" class="mb-0 h6">Ajouter un modèle</h3>
            </div>
            <div class="card-body">
                <form id="llmForm">
                    <input type="hidden" id="llmId" value="">

                    <div class="form-group">
                        <label for="llmName">Nom *</label>
                        <input type="text" id="llmName" name="name" class="form-control form-control-sm" style="max-width:320px;" required>
                    </div>

                    <div class="form-group">
                        <label for="llmServer">Serveur IA</label>
                        <select id="llmServer" name="server_id" class="form-control" style="max-width:400px;">
                            <option value="">— Aucun (saisie manuelle fournisseur) —</option>
                        </select>
                        <small class="form-text text-muted">Choisir un serveur déjà configuré (page IA → Serveurs), ou laisser vide pour saisir fournisseur/URL à la main.</small>
                    </div>

                    <div id="manualProviderBlock">
                    <div class="form-group">
                        <label for="llmProvider">Fournisseur IA *</label>
                        <select id="llmProvider" name="provider" class="form-control" style="max-width:400px;">
                            <option value="">— Choisir un fournisseur —</option>
                        </select>
                        <small id="llmProviderDescription" class="form-text text-muted"></small>
                    </div>

                    <div id="fieldServerUrl" class="form-group" style="display:none;">
                        <label for="llmServerUrl">URL du serveur IA (backendIA)</label>
                        <input type="url" id="llmServerUrl" name="serverUrl" class="form-control" style="max-width:400px;" placeholder="http://localhost:8000">
                    </div>

                    <div id="fieldServiceToken" class="form-group" style="display:none;">
                        <label for="llmServiceToken">Token de service (backendIA)</label>
                        <input type="password" id="llmServiceToken" name="serviceToken" class="form-control" style="max-width:400px;" placeholder="ia-service-token-..." autocomplete="off">
                    </div>

                    <div id="fieldOllamaUrl" class="form-group" style="display:none;">
                        <label for="llmOllamaUrl">URL Ollama</label>
                        <input type="url" id="llmOllamaUrl" name="ollamaUrl" class="form-control" style="max-width:400px;" placeholder="http://localhost:11434">
                    </div>

                    <div id="fieldApiKey" class="form-group" style="display:none;">
                        <label for="llmApiKey">Clé API</label>
                        <input type="password" id="llmApiKey" name="apiKey" class="form-control" style="max-width:500px;" placeholder="sk-..." autocomplete="off">
                        <small class="form-text text-muted">Laisser vide pour ne pas modifier la clé existante.</small>
                    </div>
                    </div>

                    <div class="form-group">
                        <label for="llmModel">Modèle *</label>
                        <select id="llmModel" name="model" class="form-control" style="max-width:400px;" required>
                            <option value="">— Choisir un modèle —</option>
                        </select>
                        <input type="text" id="llmModelCustom" name="modelCustom" class="form-control" style="max-width:400px; display:none;" placeholder="Modèle personnalisé">
                        <button type="button" id="btnLoadServerModels" class="btn btn-outline btn-sm mt-2" style="display:none;">Charger les modèles du serveur</button>
                        <button type="button" id="btnLoadServerModelsByServer" class="btn btn-outline btn-sm mt-2" style="display:none;">Charger les modèles du serveur sélectionné</button>
                    </div>

                    <div class="form-group">
                        <label>
                            <input type="checkbox" id="llmIsDefault" name="is_default">
                            Utiliser comme modèle par défaut pour cette entité
                        </label>
                    </div>

                    <div class="form-actions" style="margin-top:1.5rem;">
                        <button type="submit" class="btn btn-primary">Enregistrer</button>
                        <button type="button" class="btn btn-outline" id="btnLlmCancel">Annuler</button>
                    </div>

                    <div id="llmFormMessage" class="mt-3" style="min-height:1.5rem;"></div>
                </form>
            </div>
        </div>
    </div>
</section>

<script>
(function() {
    const API_BASE = '<?= addslashes($api_base_url) ?>/ia';
    const JWT = '<?= addslashes($jwt_token) ?>';
    const headers = () => ({ 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + JWT });

    let providers = [];
    let servers = [];

    function setMessage(id, text, isError) {
        const el = document.getElementById(id);
        if (!el) return;
        el.textContent = text || '';
        el.className = (el.className || '').replace(/\btext-danger\b|\btext-success\b/g, '').trim();
        if (text) {
            el.classList.add(isError ? 'text-danger' : 'text-success');
        }
    }

    function handleIaUnavailable(res) {
        if (res.status === 404 || res.status === 503) {
            return res.json().catch(() => ({ message: 'Module IA non disponible.' })).then(data => {
                setMessage('llmMessage', (data && data.message) || 'Le module IA n\'est pas déployé sur ce serveur.', true);
                return null;
            });
        }
        return res.json();
    }

    function loadProviders() {
        return fetch(API_BASE + '/providers', { headers: headers() })
            .then(r => { if (!r.ok) return handleIaUnavailable(r); return r.json(); })
            .then(data => {
                if (!data || !data.success || !data.providers) return;
                providers = data.providers;
                const sel = document.getElementById('llmProvider');
                sel.innerHTML = '<option value="">— Choisir un fournisseur —</option>';
                providers.forEach(p => {
                    const opt = document.createElement('option');
                    opt.value = p.id;
                    opt.textContent = p.label;
                    sel.appendChild(opt);
                });
            })
            .catch(e => setMessage('llmMessage', 'Erreur chargement fournisseurs: ' + e.message, true));
    }

    function loadServers() {
        return fetch(API_BASE + '/servers', { headers: headers() })
            .then(r => { if (!r.ok) return r.json().then(() => ({})); return r.json(); })
            .then(data => {
                if (!data || !data.success || !data.servers) return;
                servers = data.servers;
                const sel = document.getElementById('llmServer');
                const prev = sel.value;
                sel.innerHTML = '<option value="">— Aucun (saisie manuelle fournisseur) —</option>';
                servers.forEach(s => {
                    const opt = document.createElement('option');
                    opt.value = s._id;
                    const isGlobal = s.scope === 'global';
                    const allowEntities = s.allowEntitiesToAddLlm === true;
                    const isAdmin = <?= $is_admin_gdri ? 'true' : 'false' ?>;
                    if (isGlobal && !allowEntities && !isAdmin) {
                        opt.disabled = true;
                        opt.textContent = (s.name || s.provider || s._id) + ' (bloqué par la plateforme)';
                    } else {
                        opt.textContent = (s.name || s.provider || s._id);
                    }
                    sel.appendChild(opt);
                });
                if (prev) sel.value = prev;
                toggleManualProviderBlock();
            });
    }

    function toggleManualProviderBlock() {
        const serverId = document.getElementById('llmServer').value;
        const manual = document.getElementById('manualProviderBlock');
        const btnByServer = document.getElementById('btnLoadServerModelsByServer');
        const btnGlobal = document.getElementById('btnLoadServerModels');
        const modelCustom = document.getElementById('llmModelCustom');
        if (serverId) {
            if (manual) manual.style.display = 'none';
            if (btnByServer) btnByServer.style.display = 'inline-block';
            if (btnGlobal) btnGlobal.style.display = 'none';
            if (modelCustom) modelCustom.style.display = 'block';
            if (modelCustom) modelCustom.placeholder = 'Ou saisir le nom du modèle (ex. mistral:latest)';
            document.getElementById('llmProvider').removeAttribute('required');
        } else {
            if (manual) manual.style.display = 'block';
            if (btnByServer) btnByServer.style.display = 'none';
            if (btnGlobal) btnGlobal.style.display = 'none';
            if (modelCustom) modelCustom.style.display = 'none';
            document.getElementById('llmProvider').setAttribute('required', 'required');
        }
    }

    function showProviderFields(providerId) {
        const p = providers.find(pr => pr.id === providerId);
        document.getElementById('fieldServerUrl').style.display = p && p.fields.includes('serverUrl') ? 'block' : 'none';
        document.getElementById('fieldServiceToken').style.display = p && p.fields.includes('serviceToken') ? 'block' : 'none';
        document.getElementById('fieldOllamaUrl').style.display = p && p.fields.includes('ollamaUrl') ? 'block' : 'none';
        document.getElementById('fieldApiKey').style.display = p && p.fields.includes('apiKey') ? 'block' : 'none';
        document.getElementById('llmProviderDescription').textContent = p ? (p.description || '') : '';

        const modelSelect = document.getElementById('llmModel');
        const modelCustom = document.getElementById('llmModelCustom');
        const btnLoad = document.getElementById('btnLoadServerModels');
        const isOllama = p && (providerId === 'ollama_server' || providerId === 'ollama_direct');
        btnLoad.style.display = isOllama ? 'inline-block' : 'none';

        modelSelect.innerHTML = '<option value="">— Choisir un modèle —</option>';
        if (p) {
            (p.models || []).forEach(m => {
                const opt = document.createElement('option');
                opt.value = m === 'custom' ? '' : m;
                opt.textContent = m === 'custom' ? '— Personnalisé —' : m;
                modelSelect.appendChild(opt);
            });
            const hasCustom = (p.models || []).includes('custom');
            modelCustom.style.display = hasCustom ? 'block' : 'none';
            modelCustom.placeholder = p.modelLabel || 'Nom du modèle';
        } else {
            modelCustom.style.display = 'none';
        }
    }

    document.getElementById('btnLoadServerModels').addEventListener('click', function() {
        const sel = document.getElementById('llmModel');
        setMessage('llmFormMessage', 'Chargement…');
        fetch(API_BASE + '/models/available', { headers: headers() })
            .then(r => r.json())
            .then(data => {
                if (data.success && data.models && data.models.length) {
                    sel.innerHTML = '<option value="">— Choisir un modèle —</option>';
                    data.models.forEach(m => {
                        const name = typeof m === 'object' ? (m.name || m) : m;
                        if (!name) return;
                        const opt = document.createElement('option');
                        opt.value = name;
                        opt.textContent = name;
                        sel.appendChild(opt);
                    });
                    setMessage('llmFormMessage', data.models.length + ' modèle(s) chargé(s).');
                } else {
                    setMessage('llmFormMessage', (data && data.message) || 'Aucun modèle (vérifiez la config serveur).', true);
                }
            })
            .catch(e => setMessage('llmFormMessage', 'Erreur: ' + e.message, true));
    });

    document.getElementById('btnLoadServerModelsByServer').addEventListener('click', function() {
        const serverId = document.getElementById('llmServer').value;
        if (!serverId) return;
        const sel = document.getElementById('llmModel');
        setMessage('llmFormMessage', 'Chargement…');
        fetch(API_BASE + '/servers/' + encodeURIComponent(serverId) + '/models', { headers: headers() })
            .then(r => r.json())
            .then(data => {
                if (data.success && data.models && data.models.length) {
                    sel.innerHTML = '<option value="">— Choisir un modèle —</option>';
                    data.models.forEach(m => {
                        const name = typeof m === 'object' ? (m.name || m) : m;
                        if (!name) return;
                        const opt = document.createElement('option');
                        opt.value = name;
                        opt.textContent = name;
                        sel.appendChild(opt);
                    });
                    setMessage('llmFormMessage', data.models.length + ' modèle(s) chargé(s).');
                } else {
                    setMessage('llmFormMessage', (data && data.message) || 'Aucun modèle.', true);
                }
            })
            .catch(e => setMessage('llmFormMessage', 'Erreur: ' + e.message, true));
    });

    function loadLlms() {
        setMessage('llmMessage', 'Chargement des LLMs…');
        fetch(API_BASE + '/llms', { headers: headers() })
            .then(r => { if (!r.ok) return handleIaUnavailable(r); return r.json(); })
            .then(data => {
                if (!data || !data.success) return;
                const body = document.getElementById('llmTableBody');
                const llms = data.llms || [];
                if (!llms.length) {
                    body.innerHTML = '<tr><td colspan="5">Aucun LLM déclaré pour cette entité.</td></tr>';
                    setMessage('llmMessage', '');
                    return;
                }
                body.innerHTML = '';
                llms.forEach(llm => {
                    const tr = document.createElement('tr');
                    const serverInfo = llm.server_id ? '(serveur)' : (llm.provider || '');
                    tr.innerHTML = `
                        <td>${(llm.name || '').replace(/</g, '&lt;')}</td>
                        <td>${(serverInfo || '').replace(/</g, '&lt;')}</td>
                        <td>${(llm.model || '').replace(/</g, '&lt;')}</td>
                        <td>${llm.is_default ? 'Oui' : 'Non'}</td>
                        <td>
                            <button type="button" class="btn btn-sm btn-outline" data-action="edit" data-id="${llm._id}">Modifier</button>
                            <button type="button" class="btn btn-sm btn-danger" data-action="delete" data-id="${llm._id}">Supprimer</button>
                        </td>
                    `;
                    body.appendChild(tr);
                });
                setMessage('llmMessage', '');
            })
            .catch(e => setMessage('llmMessage', 'Erreur chargement LLMs: ' + e.message, true));
    }

    function resetForm() {
        document.getElementById('llmId').value = '';
        document.getElementById('llmFormTitle').textContent = 'Ajouter un modèle';
        document.getElementById('llmName').value = '';
        document.getElementById('llmServer').value = '';
        document.getElementById('llmProvider').value = '';
        showProviderFields('');
        toggleManualProviderBlock();
        document.getElementById('llmServerUrl').value = '';
        document.getElementById('llmServiceToken').value = '';
        document.getElementById('llmOllamaUrl').value = '';
        document.getElementById('llmApiKey').value = '';
        document.getElementById('llmModel').value = '';
        document.getElementById('llmModelCustom').value = '';
        document.getElementById('llmIsDefault').checked = false;
        setMessage('llmFormMessage', '');
    }

    function loadLlm(id) {
        setMessage('llmFormMessage', 'Chargement du LLM…');
        fetch(API_BASE + '/llms/' + encodeURIComponent(id), { headers: headers() })
            .then(r => r.json())
            .then(data => {
                if (!data || !data.success || !data.llm) {
                    setMessage('llmFormMessage', data && data.message ? data.message : 'LLM introuvable', true);
                    return;
                }
                const llm = data.llm;
                document.getElementById('llmId').value = llm._id;
                document.getElementById('llmFormTitle').textContent = 'Modifier le modèle';
                document.getElementById('llmName').value = llm.name || '';
                document.getElementById('llmServer').value = llm.server_id || '';
                toggleManualProviderBlock();
                document.getElementById('llmProvider').value = llm.provider || '';
                showProviderFields(llm.provider || '');
                document.getElementById('llmServerUrl').value = llm.serverUrl || '';
                document.getElementById('llmServiceToken').value = '';
                document.getElementById('llmServiceToken').placeholder = llm.serviceToken ? '•••••••• (laisser vide pour ne pas modifier)' : '';
                document.getElementById('llmOllamaUrl').value = llm.ollamaUrl || '';
                document.getElementById('llmApiKey').value = '';
                document.getElementById('llmApiKey').placeholder = llm.apiKey ? '•••••••• (laisser vide pour ne pas modifier)' : '';
                document.getElementById('llmModel').value = llm.model || '';
                document.getElementById('llmModelCustom').value = '';
                document.getElementById('llmIsDefault').checked = !!llm.is_default;
                setMessage('llmFormMessage', '');
            })
            .catch(e => setMessage('llmFormMessage', 'Erreur: ' + e.message, true));
    }

    document.getElementById('llmProvider').addEventListener('change', function() {
        showProviderFields(this.value);
    });
    document.getElementById('llmServer').addEventListener('change', function() {
        toggleManualProviderBlock();
    });

    document.getElementById('btnNewLlm').addEventListener('click', function() {
        resetForm();
    });
    document.getElementById('btnRefreshIa').addEventListener('click', function() {
        loadLlms();
        setMessage('llmMessage', 'Liste rafraîchie.');
    });

    document.getElementById('btnLlmCancel').addEventListener('click', function() {
        resetForm();
    });

    document.getElementById('llmTableBody').addEventListener('click', function(e) {
        const btn = e.target.closest('button[data-action]');
        if (!btn) return;
        const id = btn.getAttribute('data-id');
        const action = btn.getAttribute('data-action');
        if (action === 'edit') {
            loadLlm(id);
        } else if (action === 'delete') {
            if (!confirm('Supprimer ce LLM ?')) return;
            fetch(API_BASE + '/llms/' + encodeURIComponent(id), {
                method: 'DELETE',
                headers: headers()
            })
                .then(r => r.json())
                .then(data => {
                    if (data.success) {
                        setMessage('llmMessage', 'LLM supprimé.');
                        if (document.getElementById('llmId').value === id) resetForm();
                        loadLlms();
                    } else {
                        setMessage('llmMessage', data.message || 'Erreur suppression', true);
                    }
                })
                .catch(err => setMessage('llmMessage', 'Erreur: ' + err.message, true));
        }
    });

    document.getElementById('llmForm').addEventListener('submit', function(e) {
        e.preventDefault();
        const id = document.getElementById('llmId').value || '';
        const serverId = document.getElementById('llmServer').value.trim();
        const provider = document.getElementById('llmProvider').value;
        const model = document.getElementById('llmModel').value;
        const modelCustom = document.getElementById('llmModelCustom').value;
        const finalModel = (model || modelCustom || '').trim();
        if (serverId) {
            if (!finalModel) {
                setMessage('llmFormMessage', 'Veuillez choisir ou saisir un modèle.', true);
                return;
            }
        } else {
            if (!provider || !finalModel) {
                setMessage('llmFormMessage', 'Veuillez choisir un fournisseur et un modèle (ou un serveur IA + modèle).', true);
                return;
            }
        }

        let body;
        if (serverId) {
            body = {
                name: document.getElementById('llmName').value.trim(),
                server_id: serverId,
                model: finalModel,
                is_default: document.getElementById('llmIsDefault').checked
            };
        } else {
            body = {
                name: document.getElementById('llmName').value.trim(),
                provider,
                model: finalModel,
                serverUrl: document.getElementById('llmServerUrl').value.trim() || undefined,
                serviceToken: document.getElementById('llmServiceToken').value.trim() || undefined,
                ollamaUrl: document.getElementById('llmOllamaUrl').value.trim() || undefined,
                apiKey: document.getElementById('llmApiKey').value.trim() || undefined,
                is_default: document.getElementById('llmIsDefault').checked
            };
        }

        const method = id ? 'PUT' : 'POST';
        const url = id ? (API_BASE + '/llms/' + encodeURIComponent(id)) : (API_BASE + '/llms');

        setMessage('llmFormMessage', 'Enregistrement en cours…');
        fetch(url, {
            method,
            headers: headers(),
            body: JSON.stringify(body)
        })
            .then(r => r.json())
            .then(data => {
                if (data.success) {
                    setMessage('llmFormMessage', 'LLM enregistré.');
                    document.getElementById('llmServiceToken').value = '';
                    document.getElementById('llmApiKey').value = '';
                    loadLlms();
                    if (!id) resetForm();
                } else {
                    setMessage('llmFormMessage', data.message || 'Erreur', true);
                }
            })
            .catch(err => setMessage('llmFormMessage', 'Erreur: ' + err.message, true));
    });

    loadProviders().then(loadServers).then(loadLlms);
})();
</script>

<?php require_once GDRI_ROOT . '/frontend/includes/footer.php'; ?>
