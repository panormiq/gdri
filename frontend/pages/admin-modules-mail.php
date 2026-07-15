<?php
/**
 * Administration Module Mail – Fournisseurs (ADMIN_GDRI)
 * Liste et gestion des fournisseurs mail (presets IMAP/SMTP) en base GDRI
 */

require_once '../config/config.php';
require_once '../config/database.php';
require_once '../auth/session.php';
require_once '../includes/functions.php';
require_once '../includes/jwt-helper.php';
require_once '../includes/entity-console-nav.php';

if (!hasRole(ROLE_ADMIN_GDRI)) {
    redirect(url('pages/dashboard.php'));
}

$page_title = 'Connecteur Mail – Presets fournisseurs';
require_once '../includes/header.php';
renderConsoleLayoutStart(
    'Connecteur Mail – Presets fournisseurs',
    'Presets IMAP/SMTP globaux. Les comptes mail des entités se créent en console entité → Connecteurs.',
    ['narrow' => true]
);
renderConsoleBackLink('Connecteurs', url('pages/platform-connecteurs.php'));
?>

    <div class="card" style="margin-bottom: 1.5rem;">
        <div class="card-header" style="background-color: #f8f9fa; border-bottom: 2px solid #0d6efd;">
            <div style="display: flex; align-items: center; justify-content: space-between;">
                <h2 style="margin: 0;">Fournisseurs</h2>
                <button type="button" class="btn btn-primary" id="mailProviderAddBtn">+ Ajouter un fournisseur</button>
            </div>
        </div>
        <div class="card-body">
            <div id="mailProvidersStatus" style="padding: 0.5rem 0; color: #666; font-size: 0.9em;">Chargement...</div>
            <div id="mailProvidersTableWrap" style="overflow-x: auto; margin-top: 1rem; display: none;">
                <table class="table table-bordered" id="mailProvidersTable">
                    <thead>
                        <tr>
                            <th>Id</th>
                            <th>Nom</th>
                            <th>IMAP (host:port)</th>
                            <th>SMTP (host:port)</th>
                            <th style="width: 140px;">Actions</th>
                        </tr>
                    </thead>
                    <tbody id="mailProvidersTbody"></tbody>
                </table>
            </div>
        </div>
    </div>

<?php renderConsoleLayoutEnd(); ?>

    <div class="modal-overlay" id="mailProviderModal" style="display: none;">
        <div class="modal" style="max-width: 560px;">
            <div class="modal-header">
                <h3 class="modal-title" id="mailProviderModalTitle">Ajouter un fournisseur</h3>
                <button type="button" class="modal-close" id="mailProviderModalClose" aria-label="Fermer">&times;</button>
            </div>
            <div class="modal-body">
                <input type="hidden" id="mailProviderEditId" value="" />
                <div class="form-group" style="margin-bottom: 1rem;">
                    <label for="mailProviderId">Id (slug)</label>
                    <input type="text" class="form-control" id="mailProviderId" placeholder="ovh-emailpro" />
                    <small class="text-muted">Non modifiable après création</small>
                </div>
                <div class="form-group" style="margin-bottom: 1rem;">
                    <label for="mailProviderName">Nom affiché</label>
                    <input type="text" class="form-control" id="mailProviderName" placeholder="OVH Email Pro" />
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem;">
                    <div>
                        <h6 style="margin-bottom: 0.5rem;">IMAP (réception)</h6>
                        <div class="form-group" style="margin-bottom: 0.5rem;">
                            <label class="small">Host</label>
                            <input type="text" class="form-control" id="mailProviderImapHost" placeholder="pro1.mail.ovh.net" />
                        </div>
                        <div class="form-group" style="margin-bottom: 0.5rem;">
                            <label class="small">Port</label>
                            <input type="number" class="form-control" id="mailProviderImapPort" value="993" />
                        </div>
                        <div class="form-group">
                            <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                                <input type="checkbox" id="mailProviderImapSecure" checked /> SSL/TLS
                            </label>
                        </div>
                    </div>
                    <div>
                        <h6 style="margin-bottom: 0.5rem;">SMTP (envoi)</h6>
                        <div class="form-group" style="margin-bottom: 0.5rem;">
                            <label class="small">Host</label>
                            <input type="text" class="form-control" id="mailProviderSmtpHost" placeholder="pro1.mail.ovh.net" />
                        </div>
                        <div class="form-group" style="margin-bottom: 0.5rem;">
                            <label class="small">Port</label>
                            <input type="number" class="form-control" id="mailProviderSmtpPort" value="587" />
                        </div>
                        <div class="form-group">
                            <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                                <input type="checkbox" id="mailProviderSmtpSecure" /> SSL/TLS
                            </label>
                        </div>
                    </div>
                </div>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-outline" id="mailProviderModalCancel">Annuler</button>
                <button type="button" class="btn btn-primary" id="mailProviderSaveBtn">Enregistrer</button>
            </div>
        </div>
    </div>

<script>
(function() {
    var API_BASE = <?= json_encode(getApiBaseUrl()) ?>;
    var JWT = <?= json_encode(getJWTToken()) ?>;
    var MAIL_API = API_BASE + '/mail';
    var mailProvidersList = [];

    function parseJsonResponse(res) {
        var ct = (res.headers.get('content-type') || '').toLowerCase();
        if (ct.indexOf('application/json') === -1) {
            return res.text().then(function(text) {
                var msg = 'Réponse non-JSON (status ' + res.status + '). ';
                if (res.status === 404) {
                    msg += 'Vérifiez que le backend Node est démarré (npm start dans backend/) et que l\'API est joignable. ';
                    msg += 'Si vous accédez au site via un vhost (ex. gdri.local), copiez frontend/config/config.local.php.example en config.local.php et définissez BACKEND_API_URL sur http://localhost:3000/api.';
                } else {
                    msg += 'Vérifiez que l\'API backend est démarrée et accessible.';
                }
                throw new Error(msg);
            });
        }
        return res.json();
    }

    function loadMailProviders() {
        var statusEl = document.getElementById('mailProvidersStatus');
        var wrapEl = document.getElementById('mailProvidersTableWrap');
        var tbody = document.getElementById('mailProvidersTbody');
        if (!statusEl || !tbody) return;
        statusEl.textContent = 'Chargement...';
        statusEl.style.color = '#666';
        fetch(MAIL_API + '/admin/providers', { headers: { 'Authorization': 'Bearer ' + JWT } })
            .then(function(res) { return parseJsonResponse(res); })
            .then(function(data) {
                if (!data.success) throw new Error(data.message || 'Erreur');
                mailProvidersList = data.providers || [];
                if (mailProvidersList.length === 0) {
                    statusEl.textContent = 'Aucun fournisseur. Cliquez sur "Ajouter un fournisseur" pour en créer.';
                    wrapEl.style.display = 'none';
                    return;
                }
                statusEl.textContent = mailProvidersList.length + ' fournisseur(s).';
                wrapEl.style.display = 'block';
                tbody.innerHTML = mailProvidersList.map(function(p) {
                    var imap = p.imap || {};
                    var smtp = p.smtp || {};
                    return '<tr><td><code>' + (p.id || '') + '</code></td><td>' + (p.name || '') + '</td><td>' + (imap.host || '') + ':' + (imap.port || 993) + '</td><td>' + (smtp.host || '') + ':' + (smtp.port || 587) + '</td><td><button type="button" class="btn btn-outline btn-sm mail-provider-edit" data-id="' + (p.id || '') + '">Modifier</button> <button type="button" class="btn btn-outline btn-sm btn-danger mail-provider-delete" data-id="' + (p.id || '') + '">Supprimer</button></td></tr>';
                }).join('');
                tbody.querySelectorAll('.mail-provider-edit').forEach(function(btn) {
                    btn.addEventListener('click', function() { openModal(this.getAttribute('data-id')); });
                });
                tbody.querySelectorAll('.mail-provider-delete').forEach(function(btn) {
                    btn.addEventListener('click', function() { deleteProvider(this.getAttribute('data-id')); });
                });
            })
            .catch(function(e) {
                statusEl.textContent = 'Erreur : ' + (e.message || 'chargement impossible');
                statusEl.style.color = '#c00';
                wrapEl.style.display = 'none';
            });
    }

    function openModal(editId) {
        var modal = document.getElementById('mailProviderModal');
        var title = document.getElementById('mailProviderModalTitle');
        var editIdEl = document.getElementById('mailProviderEditId');
        var idEl = document.getElementById('mailProviderId');
        var nameEl = document.getElementById('mailProviderName');
        var imapHost = document.getElementById('mailProviderImapHost');
        var imapPort = document.getElementById('mailProviderImapPort');
        var imapSecure = document.getElementById('mailProviderImapSecure');
        var smtpHost = document.getElementById('mailProviderSmtpHost');
        var smtpPort = document.getElementById('mailProviderSmtpPort');
        var smtpSecure = document.getElementById('mailProviderSmtpSecure');
        if (!modal) return;
        if (editId) {
            title.textContent = 'Modifier le fournisseur';
            editIdEl.value = editId;
            idEl.disabled = true;
            idEl.value = editId;
            var p = mailProvidersList.find(function(x) { return x.id === editId; });
            if (p) {
                nameEl.value = p.name || '';
                imapHost.value = (p.imap && p.imap.host) || '';
                imapPort.value = (p.imap && p.imap.port) || 993;
                imapSecure.checked = (p.imap && p.imap.secure) !== false;
                smtpHost.value = (p.smtp && p.smtp.host) || '';
                smtpPort.value = (p.smtp && p.smtp.port) || 587;
                smtpSecure.checked = (p.smtp && p.smtp.secure) === true;
            }
        } else {
            title.textContent = 'Ajouter un fournisseur';
            editIdEl.value = '';
            idEl.disabled = false;
            idEl.value = '';
            nameEl.value = '';
            imapHost.value = '';
            imapPort.value = 993;
            imapSecure.checked = true;
            smtpHost.value = '';
            smtpPort.value = 587;
            smtpSecure.checked = false;
        }
        modal.style.display = 'flex';
        modal.classList.add('active');
    }

    function closeModal() {
        var modal = document.getElementById('mailProviderModal');
        if (modal) { modal.style.display = 'none'; modal.classList.remove('active'); }
    }

    function saveProvider() {
        var editIdEl = document.getElementById('mailProviderEditId');
        var idEl = document.getElementById('mailProviderId');
        var nameEl = document.getElementById('mailProviderName');
        var imapHost = document.getElementById('mailProviderImapHost');
        var imapPort = document.getElementById('mailProviderImapPort');
        var imapSecure = document.getElementById('mailProviderImapSecure');
        var smtpHost = document.getElementById('mailProviderSmtpHost');
        var smtpPort = document.getElementById('mailProviderSmtpPort');
        var smtpSecure = document.getElementById('mailProviderSmtpSecure');
        var id = (idEl.value || '').trim();
        var name = (nameEl.value || '').trim();
        if (!id || !name) { alert('Id et nom sont requis.'); return; }
        var payload = {
            id: id,
            name: name,
            imap: { host: (imapHost.value || '').trim(), port: parseInt(imapPort.value, 10) || 993, secure: imapSecure.checked },
            smtp: { host: (smtpHost.value || '').trim(), port: parseInt(smtpPort.value, 10) || 587, secure: smtpSecure.checked }
        };
        var url = MAIL_API + '/admin/providers';
        var method = 'POST';
        if (editIdEl.value) {
            url = MAIL_API + '/admin/providers/' + encodeURIComponent(editIdEl.value);
            method = 'PUT';
            delete payload.id;
        }
        fetch(url, { method: method, headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + JWT }, body: JSON.stringify(payload) })
            .then(function(res) { return parseJsonResponse(res); })
            .then(function(data) {
                if (!data.success) throw new Error(data.message || 'Erreur');
                closeModal();
                loadMailProviders();
            })
            .catch(function(e) { alert('Erreur : ' + (e.message || 'enregistrement impossible')); });
    }

    function deleteProvider(id) {
        if (!id || !confirm('Supprimer le fournisseur "' + id + '" ?')) return;
        fetch(MAIL_API + '/admin/providers/' + encodeURIComponent(id), { method: 'DELETE', headers: { 'Authorization': 'Bearer ' + JWT } })
            .then(function(res) { return parseJsonResponse(res); })
            .then(function(data) {
                if (!data.success) throw new Error(data.message || 'Erreur');
                loadMailProviders();
            })
            .catch(function(e) { alert('Erreur : ' + (e.message || 'suppression impossible')); });
    }

    document.getElementById('mailProviderAddBtn').addEventListener('click', function() { openModal(null); });
    document.getElementById('mailProviderModalClose').addEventListener('click', closeModal);
    document.getElementById('mailProviderModalCancel').addEventListener('click', closeModal);
    document.getElementById('mailProviderSaveBtn').addEventListener('click', saveProvider);
    document.getElementById('mailProviderModal').addEventListener('click', function(ev) { if (ev.target === this) closeModal(); });
    loadMailProviders();
})();
</script>

<?php require_once '../includes/footer.php'; ?>
