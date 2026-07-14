<?php
/**
 * Instances d'un connecteur (http-generic, facebook, …)
 */

require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../auth/session.php';
require_once __DIR__ . '/../../includes/functions.php';
require_once __DIR__ . '/../../includes/jwt-helper.php';
require_once __DIR__ . '/../../includes/entity-console-nav.php';

if (!hasRole(ROLE_ADMIN_GDRI) && !hasRole(ROLE_ADMIN_ENTITY)) {
    redirect(url('pages/dashboard.php'));
}

$connectorId = preg_replace('/[^a-z0-9_-]/i', '', (string) ($_GET['connector'] ?? ''));
if ($connectorId === '') {
    redirect(url('pages/entity-config.php?tab=connecteurs'));
}
if (in_array($connectorId, ['mail-in', 'mail-out'], true)) {
    redirect(url('pages/modules/mail-config.php?module=mail'));
}

$page_title = 'Connecteur — ' . ucfirst($connectorId);
$jwt_token = getJWTToken();
$api_base_url = rtrim(getApiBaseUrl(), '/');
$webhook_base = preg_replace('#/api/?$#', '', $api_base_url);

require_once __DIR__ . '/../../includes/header.php';
renderConsoleLayoutStart(
    'Connecteur',
    'Instances et paramètres du connecteur.',
    ['narrow' => true]
);
renderConsoleBackLink('Connecteurs', url('pages/entity-connecteurs.php'));
?>

    <div id="connectorMsg" class="alert alert-info small" style="display:none;"></div>
    <h2 id="connectorTitle" class="console-page__subtitle" style="margin:0 0 0.35rem;font-size:1.15rem;">🔌 Connecteur</h2>
    <p id="connectorDescription" class="text-muted" style="margin-top: 0; margin-bottom: 1rem;">Chargement…</p>

    <div class="section-actions" style="margin-bottom: 1rem;">
        <button type="button" class="btn btn-primary" id="btnAddInstance">+ Nouvelle instance</button>
    </div>

    <div id="instancesList" class="connector-instances-list">
        <p class="text-muted">Chargement…</p>
    </div>

<?php renderConsoleLayoutEnd(); ?>

<div class="modal-overlay" id="instanceModal" style="display:none;">
    <div class="modal-content" style="max-width: 620px;">
        <button type="button" class="modal-close" id="closeInstanceModal">×</button>
        <div class="modal-header"><h2 id="instanceModalTitle">Nouvelle instance</h2></div>
        <div class="modal-body">
            <form id="instanceForm">
                <input type="hidden" id="instanceId" value="">
                <div class="form-group" id="presetGroup">
                    <label for="instancePreset">Modèle</label>
                    <select id="instancePreset" class="form-control"></select>
                    <p class="text-muted small" id="presetDescription" style="margin-top:0.35rem;"></p>
                </div>
                <div class="form-group">
                    <label for="instanceName">Nom *</label>
                    <input type="text" id="instanceName" class="form-control" required placeholder="Ex: Support client">
                </div>
                <div id="dynamicSettings"></div>
                <div class="form-group">
                    <label for="instanceMapping">Mapping (JSON)</label>
                    <textarea id="instanceMapping" class="form-control" rows="5" placeholder='{"text":"body","author.name":"contact.name"}'></textarea>
                    <p class="text-muted small" style="margin-top:0.35rem;">Traduction format externe → message canonique.</p>
                </div>
                <div class="form-group">
                    <label><input type="checkbox" id="instanceEnabled" checked> Activé</label>
                </div>
                <div class="modal-actions">
                    <button type="button" class="btn btn-secondary" id="cancelInstanceModal">Annuler</button>
                    <button type="submit" class="btn btn-primary">Enregistrer</button>
                </div>
                <div class="form-error" id="instanceFormError"></div>
            </form>
        </div>
    </div>
</div>

<style>
.connector-instance-card {
    border: 1px solid #e9ecef;
    border-radius: 10px;
    padding: 1rem 1.15rem;
    margin-bottom: 0.75rem;
    background: #fff;
}
.connector-instance-card__head {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 10px;
    flex-wrap: wrap;
}
.connector-instance-card__meta {
    margin-top: 0.45rem;
    font-size: 0.82rem;
    color: #6c757d;
    word-break: break-all;
}
.connector-instance-card__actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    margin-top: 0.65rem;
}
.badge-enabled { background: #d4edda; color: #155724; padding: 2px 8px; border-radius: 999px; font-size: 0.75rem; }
.badge-disabled { background: #f8d7da; color: #721c24; padding: 2px 8px; border-radius: 999px; font-size: 0.75rem; }
.badge-mode { background: #e7f1ff; color: #0d47a1; padding: 2px 8px; border-radius: 999px; font-size: 0.72rem; margin-right: 4px; }
</style>

<script>
(function() {
    const CONNECTOR_ID = <?= json_encode($connectorId) ?>;
    const API = <?= json_encode($api_base_url) ?>;
    const WEBHOOK_BASE = <?= json_encode($webhook_base) ?>;
    const JWT = <?= json_encode($jwt_token) ?>;
    const headers = () => ({ 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + JWT });

    let manifest = null;
    let presets = [];
    let currentTemplate = null;
    let instances = [];

    function setMsg(text, isError) {
        const el = document.getElementById('connectorMsg');
        if (!el) return;
        el.textContent = text || '';
        el.style.display = text ? 'block' : 'none';
        el.className = 'alert small ' + (isError ? 'alert-error' : 'alert-success');
    }

    function escapeHtml(s) {
        return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    }

    function webhookUrl(instanceId) {
        return WEBHOOK_BASE + '/api/connectors/webhook/' + encodeURIComponent(instanceId);
    }

    function loadManifest() {
        return fetch(API + '/connectors/' + encodeURIComponent(CONNECTOR_ID), { headers: headers() })
            .then(r => r.json())
            .then(data => {
                if (!data.success || !data.data) throw new Error(data.message || 'Connecteur introuvable');
                manifest = data.data;
                presets = Array.isArray(manifest.presets) ? manifest.presets : [];
                document.getElementById('connectorTitle').textContent = '🔌 ' + (manifest.name || CONNECTOR_ID);
                document.getElementById('connectorDescription').textContent = manifest.description || '';
                renderPresetSelect();
                return loadTemplate(presets[0]?.id || 'default');
            });
    }

    function renderPresetSelect() {
        const sel = document.getElementById('instancePreset');
        const group = document.getElementById('presetGroup');
        if (!sel || !group) return;

        if (!presets.length) {
            group.style.display = 'none';
            return;
        }

        group.style.display = 'block';
        sel.innerHTML = '';
        presets.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p.id;
            opt.textContent = p.name || p.id;
            sel.appendChild(opt);
        });
    }

    function loadTemplate(presetId) {
        const q = presetId ? '?presetId=' + encodeURIComponent(presetId) : '';
        return fetch(API + '/connectors/' + encodeURIComponent(CONNECTOR_ID) + '/template' + q, { headers: headers() })
            .then(r => r.json())
            .then(data => {
                if (!data.success) throw new Error(data.message || 'Template introuvable');
                currentTemplate = data.data.template;
                if (!presets.length && data.data.presets?.length) {
                    presets = data.data.presets;
                    renderPresetSelect();
                }
                return currentTemplate;
            });
    }

    function renderDynamicSettings(settings, schema) {
        const container = document.getElementById('dynamicSettings');
        if (!container) return;
        container.innerHTML = '';

        const props = schema?.properties || {};
        const skipKeys = new Set(['webhookVerify']);
        Object.entries(props).forEach(([key, field]) => {
            if (skipKeys.has(key)) return;
            const value = settings?.[key];
            const title = field.title || key;
            const group = document.createElement('div');
            group.className = 'form-group';
            group.dataset.settingKey = key;

            if (field.type === 'boolean') {
                group.innerHTML = '<label><input type="checkbox" data-setting="' + key + '"' + (value !== false ? ' checked' : '') + '> ' + escapeHtml(title) + '</label>';
            } else if (field.enum) {
                let html = '<label for="setting_' + key + '">' + escapeHtml(title) + '</label><select id="setting_' + key + '" class="form-control" data-setting="' + key + '">';
                field.enum.forEach(opt => {
                    html += '<option value="' + escapeHtml(opt) + '"' + (String(value) === String(opt) ? ' selected' : '') + '>' + escapeHtml(opt) + '</option>';
                });
                html += '</select>';
                group.innerHTML = html;
            } else if (field.type === 'number') {
                group.innerHTML = '<label for="setting_' + key + '">' + escapeHtml(title) + '</label>' +
                    '<input type="number" id="setting_' + key + '" class="form-control" data-setting="' + key + '" value="' + escapeHtml(value ?? field.default ?? '') + '"' +
                    (field.minimum != null ? ' min="' + field.minimum + '"' : '') + '>';
            } else {
                group.innerHTML = '<label for="setting_' + key + '">' + escapeHtml(title) + '</label>' +
                    '<input type="text" id="setting_' + key + '" class="form-control" data-setting="' + key + '" value="' + escapeHtml(value ?? field.default ?? '') + '">';
            }
            container.appendChild(group);
        });
    }

    function collectSettings() {
        const settings = {};
        document.querySelectorAll('[data-setting]').forEach(el => {
            const key = el.getAttribute('data-setting');
            if (!key) return;
            if (el.type === 'checkbox') settings[key] = el.checked;
            else if (el.type === 'number') settings[key] = Number(el.value) || 0;
            else settings[key] = el.value.trim();
        });
        return settings;
    }

    function loadInstances() {
        const list = document.getElementById('instancesList');
        return fetch(API + '/connectors/instances/list/all?connectorId=' + encodeURIComponent(CONNECTOR_ID), { headers: headers() })
            .then(r => r.json())
            .then(data => {
                instances = (data && data.success && Array.isArray(data.data)) ? data.data : [];
                if (!instances.length) {
                    list.innerHTML = '<p class="text-muted">Aucune instance. Créez-en une pour brancher ce connecteur.</p>';
                    return;
                }
                list.innerHTML = '';
                instances.forEach(inst => {
                    const modes = Array.isArray(inst.ingestModes) ? inst.ingestModes : [];
                    const hasPush = modes.includes('push');
                    const hasPoll = modes.includes('poll');
                    const div = document.createElement('div');
                    div.className = 'connector-instance-card';
                    let meta = '';
                    if (inst.presetId) meta += 'Modèle: ' + escapeHtml(inst.presetId) + '<br>';
                    modes.forEach(m => { meta += '<span class="badge-mode">' + escapeHtml(m) + '</span>'; });
                    if (hasPush) meta += '<br>Webhook: <code>' + escapeHtml(webhookUrl(inst._id)) + '</code>';
                    const settings = inst.settings || {};
                    if (settings.pollUrl) meta += '<br>Poll: ' + escapeHtml(settings.pollUrl);
                    if (settings.emitUrl) meta += '<br>Emit: ' + escapeHtml(settings.emitUrl);

                    div.innerHTML =
                        '<div class="connector-instance-card__head">' +
                        '<div><strong>' + escapeHtml(inst.name || inst._id) + '</strong>' +
                        '<div class="connector-instance-card__meta">' + meta + '</div></div>' +
                        '<span class="' + (inst.enabled ? 'badge-enabled' : 'badge-disabled') + '">' + (inst.enabled ? 'Actif' : 'Inactif') + '</span>' +
                        '</div>' +
                        '<div class="connector-instance-card__actions">' +
                        '<button type="button" class="btn btn-outline btn-sm" data-action="test" data-id="' + inst._id + '">Tester</button>' +
                        (hasPoll ? '<button type="button" class="btn btn-outline btn-sm" data-action="poll" data-id="' + inst._id + '">Poll manuel</button>' : '') +
                        (hasPush ? '<button type="button" class="btn btn-outline btn-sm" data-action="copy-webhook" data-id="' + inst._id + '">Copier webhook</button>' : '') +
                        '<button type="button" class="btn btn-outline btn-sm" data-action="edit" data-id="' + inst._id + '">Modifier</button>' +
                        '<button type="button" class="btn btn-danger btn-sm" data-action="delete" data-id="' + inst._id + '">Supprimer</button>' +
                        '</div>';
                    list.appendChild(div);
                });
                bindInstanceActions();
            })
            .catch(e => {
                list.innerHTML = '<p class="text-muted">Erreur chargement.</p>';
                setMsg(e.message, true);
            });
    }

    function bindInstanceActions() {
        document.querySelectorAll('[data-action]').forEach(btn => {
            btn.onclick = function() {
                const id = btn.getAttribute('data-id');
                const action = btn.getAttribute('data-action');
                const inst = instances.find(x => String(x._id) === String(id));
                if (action === 'test') testInstance(id);
                else if (action === 'poll') pollInstance(id);
                else if (action === 'copy-webhook') copyWebhook(id);
                else if (action === 'edit') openModal(inst);
                else if (action === 'delete') deleteInstance(id);
            };
        });
    }

    function copyWebhook(id) {
        const url = webhookUrl(id);
        navigator.clipboard.writeText(url).then(() => setMsg('URL webhook copiée', false)).catch(() => setMsg(url, false));
    }

    function testInstance(id) {
        setMsg('Test en cours…', false);
        fetch(API + '/connectors/instances/' + encodeURIComponent(id) + '/test', { method: 'POST', headers: headers() })
            .then(r => r.json())
            .then(data => setMsg((data.data && data.data.message) || data.message || (data.success ? 'OK' : 'Échec'), !data.success))
            .catch(e => setMsg(e.message, true));
    }

    function pollInstance(id) {
        setMsg('Poll en cours…', false);
        fetch(API + '/connectors/instances/' + encodeURIComponent(id) + '/poll', { method: 'POST', headers: headers() })
            .then(r => r.json())
            .then(data => {
                const n = (data.data && data.data.messages) ? data.data.messages.length : 0;
                setMsg('Poll terminé — ' + n + ' message(s)', false);
            })
            .catch(e => setMsg(e.message, true));
    }

    function deleteInstance(id) {
        if (!confirm('Supprimer cette instance ?')) return;
        fetch(API + '/connectors/instances/' + encodeURIComponent(id), { method: 'DELETE', headers: headers() })
            .then(r => r.json())
            .then(() => { setMsg('Instance supprimée', false); loadInstances(); })
            .catch(e => setMsg(e.message, true));
    }

    const modal = document.getElementById('instanceModal');

    function applyTemplateToForm(template, inst) {
        const settings = inst?.settings || template?.settings || {};
        renderDynamicSettings(settings, manifest?.configSchema);
        document.getElementById('instanceMapping').value = JSON.stringify(
            inst?.mapping || template?.mapping || {},
            null,
            2
        );
    }

    function openModal(inst) {
        const isEdit = !!inst;
        document.getElementById('instanceModalTitle').textContent = isEdit ? 'Modifier l\'instance' : 'Nouvelle instance';
        document.getElementById('instanceId').value = inst ? inst._id : '';
        document.getElementById('instanceName').value = inst ? (inst.name || '') : '';
        document.getElementById('instanceEnabled').checked = inst ? !!inst.enabled : true;
        document.getElementById('instanceFormError').textContent = '';

        const presetGroup = document.getElementById('presetGroup');
        if (presetGroup) presetGroup.style.display = isEdit ? 'none' : (presets.length ? 'block' : 'none');

        if (isEdit) {
            applyTemplateToForm({ settings: inst.settings, mapping: inst.mapping }, inst);
            modal.style.display = 'flex';
            return;
        }

        const presetId = document.getElementById('instancePreset').value || presets[0]?.id || 'default';
        loadTemplate(presetId).then(template => {
            const preset = presets.find(p => p.id === presetId);
            document.getElementById('presetDescription').textContent = preset?.description || '';
            document.getElementById('instanceName').value = preset?.name ? (preset.name + ' — ') : '';
            applyTemplateToForm(template, null);
            modal.style.display = 'flex';
        }).catch(err => setMsg(err.message, true));
    }

    function closeModal() { modal.style.display = 'none'; }

    document.getElementById('instancePreset').onchange = function() {
        const presetId = this.value;
        const preset = presets.find(p => p.id === presetId);
        document.getElementById('presetDescription').textContent = preset?.description || '';
        loadTemplate(presetId).then(template => applyTemplateToForm(template, null));
    };

    document.getElementById('btnAddInstance').onclick = () => openModal(null);
    document.getElementById('closeInstanceModal').onclick = closeModal;
    document.getElementById('cancelInstanceModal').onclick = closeModal;

    document.getElementById('instanceForm').onsubmit = function(e) {
        e.preventDefault();
        const id = document.getElementById('instanceId').value.trim();
        let mapping = {};
        try {
            const raw = document.getElementById('instanceMapping').value.trim();
            mapping = raw ? JSON.parse(raw) : {};
        } catch (_) {
            document.getElementById('instanceFormError').textContent = 'Mapping JSON invalide';
            return;
        }

        const payload = {
            connectorId: CONNECTOR_ID,
            name: document.getElementById('instanceName').value.trim(),
            enabled: document.getElementById('instanceEnabled').checked,
            settings: collectSettings(),
            mapping
        };

        if (!id) {
            payload.presetId = document.getElementById('instancePreset').value || null;
        }

        const url = id
            ? API + '/connectors/instances/' + encodeURIComponent(id)
            : API + '/connectors/instances';
        const method = id ? 'PUT' : 'POST';

        fetch(url, { method, headers: headers(), body: JSON.stringify(payload) })
            .then(r => r.json().then(j => ({ ok: r.ok, j })))
            .then(({ ok, j }) => {
                if (!ok) throw new Error(j.message || 'Erreur enregistrement');
                closeModal();
                setMsg('Instance enregistrée', false);
                loadInstances();
            })
            .catch(err => {
                document.getElementById('instanceFormError').textContent = err.message;
            });
    };

    loadManifest().then(loadInstances).catch(err => setMsg(err.message, true));
})();
</script>

<?php require_once __DIR__ . '/../../includes/footer.php'; ?>
