<?php
/**
 * Configuration du module Mail
 * Fichier : pages/modules/mail-config.php
 * 
 * Permet de configurer les profils SMTP et règles de routing pour l'entité
 */

require_once '../../config/config.php';
require_once '../../config/database.php';
require_once '../../auth/session.php';
require_once '../../includes/functions.php';
require_once '../../includes/jwt-helper.php';

// Seuls ADMIN_GDRI et ADMIN_ENTITY peuvent accéder
if (!hasRole(ROLE_ADMIN_GDRI) && !hasRole(ROLE_ADMIN_ENTITY)) {
    redirect(url('pages/dashboard.php'));
}

$page_title = 'Configuration Mail';
$module_name = 'mail'; // Module par défaut, peut être passé en paramètre

require_once '../../includes/header.php';

// Token JWT pour les appels API
$jwt_token = getJWTToken();
?>

<!-- Section Hero -->
<section class="hero">
    <div class="container">
        <div class="hero-content">
            <h1>Configuration du module Mail</h1>
            <p class="hero-description">
                Configurez les comptes mail (envoi SMTP et réception IMAP) et les règles de routing
            </p>
        </div>
    </div>
</section>

<!-- Section Configuration -->
<section class="section">
    <div class="container">
        <!-- Mode Liste -->
        <div id="listMode">
            <div class="section-title">
                <h2>Profils mail configurés</h2>
            </div>
            <div class="section-actions" style="margin-bottom: 1rem;">
                <button class="btn btn-primary" id="addNewConfigBtn">
                    + Nouvelle configuration
                </button>
            </div>

            <div id="configList" class="config-list">
                <div class="loading-state">
                    <p>Chargement de la configuration...</p>
                </div>
            </div>
        </div>

        <!-- Mode Formulaire -->
        <div id="formMode" style="display: none;">
            <div class="form-header">
                <button class="btn btn-outline" onclick="showListMode()">
                    ← Retour à la liste
                </button>
                <h2 id="formTitle">Nouvelle configuration</h2>
            </div>

            <form id="mailConfigForm">
                <div class="form-section provider-help">
                    <h2>Modèle : profils serveur + comptes utilisateur</h2>
                    <p class="text-muted">
                        <strong>Profils</strong> = serveur + port + SSL/TLS (sans identifiants).<br>
                        <strong>Comptes</strong> = adresse mail + mot de passe, liés à un profil IMAP et un profil SMTP.<br>
                        Certains comptes sont génériques (app@…, news@…) liés à l’entité ; d’autres seront liés à un utilisateur.
                    </p>
                </div>

                <div class="form-section">
                    <h2>Profils IMAP (courrier entrant)</h2>
                    <p class="text-muted">Adresse serveur, port et SSL/TLS pour la réception. Aucun identifiant ici.</p>
                    <div class="preset-row">
                        <button type="button" class="btn btn-outline" id="addPresetImapBtn">Ajouter depuis un fournisseur</button>
                        <select id="presetImapSelect" class="form-control preset-select">
                            <option value="">— Choisir un fournisseur —</option>
                        </select>
                    </div>
                    <div id="imapProfilesContainer" class="profiles-container"></div>
                </div>

                <div class="form-section">
                    <h2>Profils SMTP (courrier sortant)</h2>
                    <p class="text-muted">Adresse serveur, port et SSL/TLS pour l’envoi. Aucun identifiant ici.</p>
                    <div class="preset-row">
                        <button type="button" class="btn btn-outline" id="addPresetSmtpBtn">Ajouter depuis un fournisseur</button>
                        <select id="presetSmtpSelect" class="form-control preset-select">
                            <option value="">— Choisir un fournisseur —</option>
                        </select>
                    </div>
                    <div id="smtpProfilesContainer" class="profiles-container"></div>
                </div>

                <div class="form-section">
                    <h2>Comptes utilisateur</h2>
                    <p class="text-muted">Adresse mail + mot de passe, reliés à un profil IMAP et un profil SMTP. Type : entité (app@, news@…) ou utilisateur. Ajoutez d’abord au moins un profil SMTP ci-dessus.</p>
                    <div id="comptesContainer" class="profiles-container"></div>
                    <button type="button" class="btn btn-outline" id="addCompteBtn">+ Ajouter un compte</button>
                </div>

                <div class="form-actions">
                    <button type="submit" class="btn btn-primary">
                        Sauvegarder la configuration
                    </button>
                    <button type="button" class="btn btn-outline" id="testConnectionBtn" onclick="testConnections()">
                        Tester les connexions (SMTP et IMAP)
                    </button>
                    <div id="smtpTestResults" style="margin-top: 8px; color: #666;"></div>
                </div>

                <div class="form-section">
                    <h2>Règles de routing (optionnel)</h2>
                    <p class="text-muted">Définissez des règles pour sélectionner automatiquement quel compte mail utiliser selon le contexte.</p>
                    
                    <div id="routingRulesContainer">
                        <!-- Les règles seront ajoutées dynamiquement ici -->
                    </div>

                    <button type="button" class="btn btn-outline" id="addRuleBtn">
                        + Ajouter une règle
                    </button>
                </div>

                <div class="form-section">
                    <h2>Options avancées</h2>
                    
                    <div class="form-group">
                        <label for="collectionName">Nom de collection personnalisé (optionnel)</label>
                        <input type="text" id="collectionName" name="collection_name" class="form-control" placeholder="emails" />
                        <small class="text-muted">Par défaut : emails</small>
                    </div>
                </div>

            </form>

            <div class="error-state" id="errorState" style="display: none;">
                <p id="errorMessage"></p>
                <button class="btn btn-outline" onclick="loadConfig()">Réessayer</button>
            </div>
        </div>
    </div>
</section>

<style>
.form-section {
    background: white;
    border-radius: 8px;
    padding: var(--spacing-lg);
    margin-bottom: var(--spacing-lg);
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.form-section h2 {
    margin-top: 0;
    color: var(--color-primary);
    border-bottom: 2px solid var(--color-light);
    padding-bottom: var(--spacing-sm);
    margin-bottom: var(--spacing-md);
}

.profile-item, .rule-item {
    background: var(--color-light);
    border-radius: 6px;
    padding: var(--spacing-md);
    margin-bottom: var(--spacing-md);
    position: relative;
}

.profile-item-header, .rule-item-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--spacing-sm);
}

.profile-item-header h3, .rule-item-header h3 {
    margin: 0;
    font-size: 1.1rem;
}

.profile-item-actions {
    display: flex;
    gap: var(--spacing-sm);
    margin: 0 0 var(--spacing-md) 0;
    flex-wrap: wrap;
}

.btn-remove {
    background: #dc3545;
    color: white;
    border: none;
    border-radius: 4px;
    padding: 4px 12px;
    cursor: pointer;
    font-size: 0.9rem;
}

.btn-remove:hover {
    background: #c82333;
}

.form-group {
    margin-bottom: var(--spacing-md);
}

.form-group label {
    display: block;
    margin-bottom: var(--spacing-xs);
    font-weight: 600;
    color: var(--color-gray);
}

.form-control {
    width: 100%;
    padding: var(--spacing-sm);
    border: 1px solid var(--color-light);
    border-radius: 4px;
    font-size: 1rem;
}

.form-actions {
    margin-top: var(--spacing-xl);
    display: flex;
    gap: var(--spacing-md);
}

.loading-state, .error-state {
    text-align: center;
    padding: var(--spacing-xl);
}

.config-list {
    margin-top: var(--spacing-lg);
}

.config-card {
    background: white;
    border-radius: 8px;
    padding: var(--spacing-lg);
    margin-bottom: var(--spacing-md);
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    border: 1px solid var(--color-light);
}

.config-card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--spacing-md);
}

.config-card-header h3 {
    margin: 0;
    color: var(--color-primary);
}

.config-details {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: var(--spacing-md);
    margin-bottom: var(--spacing-md);
}

.config-detail-item {
    padding: var(--spacing-sm);
    background: var(--color-light);
    border-radius: 4px;
}

.config-detail-item strong {
    display: block;
    color: var(--color-gray);
    font-size: 0.9rem;
    margin-bottom: 4px;
}

.config-detail-item span {
    display: block;
    font-size: 1rem;
}

.config-actions {
    display: flex;
    gap: var(--spacing-sm);
}

.form-header {
    display: flex;
    align-items: center;
    gap: var(--spacing-md);
    margin-bottom: var(--spacing-lg);
}

.form-header h2 {
    margin: 0;
    flex: 1;
}

.empty-state {
    text-align: center;
    padding: var(--spacing-xxl);
    color: var(--color-gray);
}

.provider-help { border-left: 4px solid var(--color-primary); }
.provider-table-wrap { overflow-x: auto; margin: 0.75rem 0; }
.provider-table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
.provider-table th, .provider-table td { padding: 0.5rem 0.75rem; text-align: left; border: 1px solid var(--color-light); }
.provider-table th { background: var(--color-light); font-weight: 600; }
.provider-table .small { font-size: 0.85rem; margin-top: 0.5rem; }

.profile-imap-block { margin-top: 1rem; padding-top: 1rem; border-top: 1px dashed var(--color-light); }
.profile-imap-block h4 { margin: 0 0 0.5rem 0; font-size: 1rem; color: var(--color-gray); }
.preset-row { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1rem; flex-wrap: wrap; }
.preset-row label { font-weight: 600; min-width: 120px; }
.preset-row .preset-select { max-width: 280px; }
.profiles-container { margin: 1rem 0; }
.profile-row, .compte-row { background: var(--color-light); border-radius: 6px; padding: 1rem; margin-bottom: 0.75rem; display: grid; grid-template-columns: 1fr auto; gap: 0.5rem; align-items: start; }
.profile-row .fields, .compte-row .fields { grid-column: 1; }
.profile-row .btn-remove, .compte-row .btn-remove { grid-column: 2; }
</style>

<script>
const API_BASE_URL = <?php echo json_encode(getApiBaseUrl() . '/mail'); ?>;
const JWT_TOKEN = '<?php echo $jwt_token; ?>';
const MODULE_NAME = '<?php echo $module_name; ?>';

let presets = [];
let imapIdCounter = 0;
let smtpIdCounter = 0;
let compteIdCounter = 0;
let ruleCounter = 0;
let currentConfig = null;

document.addEventListener('DOMContentLoaded', function() {
    loadPresets();
    loadConfigList();
    document.getElementById('addNewConfigBtn').addEventListener('click', () => showFormMode());
    document.getElementById('addCompteBtn').addEventListener('click', () => addCompte());
    document.getElementById('addPresetImapBtn').addEventListener('click', () => addImapFromPreset());
    document.getElementById('addPresetSmtpBtn').addEventListener('click', () => addSmtpFromPreset());
    document.getElementById('addRuleBtn').addEventListener('click', addRuleForm);
    document.getElementById('mailConfigForm').addEventListener('submit', saveConfig);
    document.getElementById('testConnectionBtn')?.addEventListener('click', testConnections);
});

function parseJsonResponse(res) {
    const ct = (res.headers.get('content-type') || '').toLowerCase();
    if (ct.indexOf('application/json') === -1) {
        return res.text().then(() => { throw new Error('Réponse non-JSON'); });
    }
    return res.json();
}

function loadPresets() {
    fetch(`${API_BASE_URL}/presets`, { headers: { 'Authorization': `Bearer ${JWT_TOKEN}` } })
        .then(r => parseJsonResponse(r))
        .then(data => {
            if (data.success && data.presets) {
                presets = data.presets;
                fillPresetDropdowns();
            }
        })
        .catch(() => {});
}

function fillPresetDropdowns() {
    const opt = (p) => `<option value="${p.id}">${p.name}</option>`;
    const sel = '<option value="">— Choisir un fournisseur —</option>' + (presets.map(opt).join(''));
    document.getElementById('presetImapSelect').innerHTML = sel;
    document.getElementById('presetSmtpSelect').innerHTML = sel;
}

function showListMode() {
    document.getElementById('listMode').style.display = 'block';
    document.getElementById('formMode').style.display = 'none';
    loadConfigList();
}

function showFormMode(config = null) {
    currentConfig = config;
    document.getElementById('listMode').style.display = 'none';
    document.getElementById('formMode').style.display = 'block';
    document.getElementById('formTitle').textContent = config ? 'Modifier la configuration' : 'Nouvelle configuration';
    document.getElementById('imapProfilesContainer').innerHTML = '';
    document.getElementById('smtpProfilesContainer').innerHTML = '';
    document.getElementById('comptesContainer').innerHTML = '';
    document.getElementById('routingRulesContainer').innerHTML = '';
    document.getElementById('collectionName').value = config?.collection_name || '';
    if (config) {
        populateForm(config);
    } else {
        // Base manuelle : toujours au moins un profil IMAP et un profil SMTP affichés
        addImapProfile();
        addSmtpProfile();
    }
}

function loadConfigList() {
    const listDiv = document.getElementById('configList');
    listDiv.innerHTML = '<div class="loading-state"><p>Chargement de la configuration...</p></div>';

    fetch(`${API_BASE_URL}/config/${MODULE_NAME}`, { headers: { 'Authorization': `Bearer ${JWT_TOKEN}` } })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            const c = data.config;
            const hasNew = c && Array.isArray(c.comptes) && c.comptes.length > 0;
            const hasOld = c && c.smtp_profiles && Object.keys(c.smtp_profiles).length > 0;
            const hasImap = c && (c.imap_config || (hasNew && c.comptes.some(x => x.profil_imap_id)));
            if (!c || (!hasNew && !hasOld && !hasImap)) {
                // Pas de configuration (ni SMTP ni IMAP)
                listDiv.innerHTML = `
                    <div class="empty-state">
                        <p>Aucune configuration trouvée.</p>
                        <button class="btn btn-primary" onclick="showFormMode()">Créer une configuration</button>
                    </div>
                `;
            } else {
                // Afficher la configuration existante
                displayConfigList(data.config);
            }
        } else {
            listDiv.innerHTML = `
                <div class="error-state">
                    <p>${data.message || 'Erreur lors du chargement'}</p>
                    <button class="btn btn-primary" onclick="showFormMode()">Créer une configuration</button>
                </div>
            `;
        }
    })
    .catch(error => {
        listDiv.innerHTML = `
            <div class="error-state">
                <p>Erreur de connexion au serveur</p>
                <button class="btn btn-primary" onclick="showFormMode()">Créer une configuration</button>
            </div>
        `;
        console.error(error);
    });
}

function displayConfigList(config) {
    const listDiv = document.getElementById('configList');
    const ruleCount = (config.routing_rules || []).length;
    const isNewFormat = Array.isArray(config.profils_imap) && Array.isArray(config.profils_smtp) && Array.isArray(config.comptes);
    const profilsImap = config.profils_imap || [];
    const profilsSmtp = config.profils_smtp || [];
    const comptes = config.comptes || [];
    const profiles = config.smtp_profiles || {};
    const profileCount = isNewFormat ? comptes.length : Object.keys(profiles).length;
    const hasImap = isNewFormat ? comptes.some(c => c.profil_imap_id) : (!!config.imap_config || Object.values(profiles).some(p => p.imap));

    let html = `
        <div class="config-card">
            <div class="config-card-header">
                <h3>Configuration Mail</h3>
                <div class="config-actions">
                    <button class="btn btn-outline" onclick="testAllConnections()">Tester les connexions</button>
                    <button class="btn btn-primary" onclick="editConfig()">✏️ Modifier</button>
                </div>
            </div>
            <div class="config-details">
                <div class="config-detail-item"><strong>Profils IMAP</strong><span>${profilsImap.length}</span></div>
                <div class="config-detail-item"><strong>Profils SMTP</strong><span>${profilsSmtp.length}</span></div>
                <div class="config-detail-item"><strong>Comptes</strong><span>${profileCount}</span></div>
                <div class="config-detail-item"><strong>Règles de routing</strong><span>${ruleCount}</span></div>
                <div class="config-detail-item"><strong>Collection</strong><span>${config.collection_name || 'emails (défaut)'}</span></div>
            </div>
        </div>`;

    if (isNewFormat) {
        profilsImap.forEach(p => {
            html += `<div class="config-card"><div class="config-card-header"><h3>IMAP : ${p.name || p.id}</h3></div><div class="config-details"><div class="config-detail-item"><strong>Serveur</strong><span>${p.host}:${p.port} ${p.secure ? 'SSL' : ''}</span></div></div></div>`;
        });
        profilsSmtp.forEach(p => {
            html += `<div class="config-card"><div class="config-card-header"><h3>SMTP : ${p.name || p.id}</h3></div><div class="config-details"><div class="config-detail-item"><strong>Serveur</strong><span>${p.host}:${p.port} ${p.secure ? 'SSL' : ''}</span></div></div></div>`;
        });
        comptes.forEach(c => {
            const smtpP = profilsSmtp.find(x => x.id === c.profil_smtp_id);
            const imapP = profilsImap.find(x => x.id === c.profil_imap_id);
            html += `<div class="config-card"><div class="config-card-header"><h3>Compte : ${c.email}</h3></div><div class="config-details"><div class="config-detail-item"><strong>Type</strong><span>${c.type || 'entity'}</span></div><div class="config-detail-item"><strong>SMTP</strong><span>${smtpP ? smtpP.host : '-'}</span></div><div class="config-detail-item"><strong>IMAP</strong><span>${imapP ? imapP.host : '-'}</span></div></div></div>`;
        });
    } else {
        Object.keys(profiles).forEach((profileName) => {
            const profile = profiles[profileName];
            const imap = profile.imap;
            html += `<div class="config-card"><div class="config-card-header"><h3>Compte : ${profileName}</h3></div><div class="config-details"><div class="config-detail-item"><strong>SMTP</strong><span>${profile.smtp.host}:${profile.smtp.port}</span></div><div class="config-detail-item"><strong>Email</strong><span>${profile.smtp.auth.user}</span></div>${imap ? `<div class="config-detail-item"><strong>IMAP</strong><span>${imap.host}:${imap.port || 993}</span></div>` : ''}</div></div>`;
        });
        if (config.imap_config && !Object.keys(profiles).some(n => profiles[n].imap)) {
            const imap = config.imap_config;
            html += `<div class="config-card"><div class="config-card-header"><h3>IMAP (réception)</h3></div><div class="config-details"><div class="config-detail-item"><strong>Serveur</strong><span>${imap.host || '-'}:${imap.port || 993}</span></div></div></div>`;
        }
    }

    // Règles de routing
    if (config.routing_rules && config.routing_rules.length > 0) {
        html += `
            <div class="config-card">
                <div class="config-card-header">
                    <h3>Règles de routing</h3>
                </div>
                <div class="config-details">
        `;
        
        config.routing_rules.forEach((rule, index) => {
            const conditionStr = rule.condition ? Object.entries(rule.condition).map(([k,v]) => `${k}:${v}`).join(', ') : 'Aucune';
            html += `
                <div class="config-detail-item" style="grid-column: 1 / -1;">
                    <strong>Règle ${index + 1}</strong>
                    <span>Si: ${conditionStr} → Profil: ${rule.use_profile}${rule.default_to ? ` → To: ${rule.default_to}` : ''}</span>
                </div>
            `;
        });
        
        html += `
                </div>
            </div>
        `;
    }
    
    listDiv.innerHTML = html;
}

function editConfig() {
    fetch(`${API_BASE_URL}/config/${MODULE_NAME}`, {
        headers: {
            'Authorization': `Bearer ${JWT_TOKEN}`
        }
    })
    .then(response => response.json())
    .then(data => {
        if (data.success && data.config) {
            showFormMode(data.config);
        }
    })
    .catch(error => {
        console.error(error);
        alert('Erreur lors du chargement');
    });
}

function testAllConnections() {
    fetch(`${API_BASE_URL}/config/${MODULE_NAME}`, { headers: { 'Authorization': `Bearer ${JWT_TOKEN}` } })
        .then(r => r.json())
        .then(data => {
            if (!data.success || !data.config) return;
            const cfg = data.config;
            if (Array.isArray(cfg.comptes) && cfg.comptes.length > 0) {
                const ids = cfg.comptes.map(c => c.id || c.email);
                testConnectionsForProfiles(ids.reduce((o, id) => { o[id] = {}; return o; }, {}));
            } else if (cfg.smtp_profiles && Object.keys(cfg.smtp_profiles).length > 0) {
                testConnectionsForProfiles(cfg.smtp_profiles);
            }
        });
}

function addImapProfile(data = {}) {
    const id = data.id || `imap_${++imapIdCounter}`;
    const div = document.createElement('div');
    div.className = 'profile-row';
    div.dataset.profileId = id;
    div.innerHTML = `
        <div class="fields">
            <div class="form-group">
                <label>Nom (optionnel)</label>
                <input type="text" class="form-control profile-name" value="${(data.name || '').replace(/"/g, '&quot;')}" placeholder="ex. OVH Pro" />
            </div>
            <div class="form-group">
                <label>Host</label>
                <input type="text" class="form-control profile-host" value="${(data.host || '').replace(/"/g, '&quot;')}" placeholder="ex. pro1.mail.ovh.net" required />
            </div>
            <div class="form-group">
                <label>Port</label>
                <input type="number" class="form-control profile-port" value="${data.port ?? 993}" required />
            </div>
            <div class="form-group">
                <label>SSL/TLS</label>
                <select class="form-control profile-secure"><option value="true" ${data.secure !== false ? 'selected' : ''}>Oui</option><option value="false" ${data.secure === false ? 'selected' : ''}>Non</option></select>
            </div>
        </div>
        <button type="button" class="btn-remove" onclick="removeImapProfile('${id}')">Supprimer</button>`;
    document.getElementById('imapProfilesContainer').appendChild(div);
}

function addSmtpProfile(data = {}) {
    const id = data.id || `smtp_${++smtpIdCounter}`;
    const div = document.createElement('div');
    div.className = 'profile-row';
    div.dataset.profileId = id;
    div.innerHTML = `
        <div class="fields">
            <div class="form-group">
                <label>Nom (optionnel)</label>
                <input type="text" class="form-control profile-name" value="${(data.name || '').replace(/"/g, '&quot;')}" placeholder="ex. OVH Pro" />
            </div>
            <div class="form-group">
                <label>Host</label>
                <input type="text" class="form-control profile-host" value="${(data.host || '').replace(/"/g, '&quot;')}" placeholder="ex. pro1.mail.ovh.net" required />
            </div>
            <div class="form-group">
                <label>Port</label>
                <input type="number" class="form-control profile-port" value="${data.port ?? 587}" required />
            </div>
            <div class="form-group">
                <label>SSL/TLS</label>
                <select class="form-control profile-secure"><option value="true" ${data.secure === true ? 'selected' : ''}>Oui</option><option value="false" ${data.secure !== true ? 'selected' : ''}>Non</option></select>
            </div>
        </div>
        <button type="button" class="btn-remove" onclick="removeSmtpProfile('${id}')">Supprimer</button>`;
    document.getElementById('smtpProfilesContainer').appendChild(div);
}

function addCompte(data = {}) {
    const id = data.id || `compte_${++compteIdCounter}`;
    const imapOpts = (config) => {
        const list = (config && config.profils_imap) ? config.profils_imap : [];
        return list.map(p => `<option value="${p.id}" ${(data.profil_imap_id === p.id) ? 'selected' : ''}>${p.name || p.id} (${p.host})</option>`).join('') || '<option value="">— Aucun —</option>';
    };
    const smtpOpts = (config) => {
        const list = (config && config.profils_smtp) ? config.profils_smtp : [];
        return list.map(p => `<option value="${p.id}" ${(data.profil_smtp_id === p.id) ? 'selected' : ''}>${p.name || p.id} (${p.host})</option>`).join('') || '<option value="">— Choisir un profil SMTP —</option>';
    };
    const imapSel = document.getElementById('imapProfilesContainer');
    const smtpSel = document.getElementById('smtpProfilesContainer');
    const imapIds = [...imapSel.querySelectorAll('[data-profile-id]')].map(el => ({ id: el.dataset.profileId, name: el.querySelector('.profile-name')?.value || el.dataset.profileId, host: el.querySelector('.profile-host')?.value }));
    const smtpIds = [...smtpSel.querySelectorAll('[data-profile-id]')].map(el => ({ id: el.dataset.profileId, name: el.querySelector('.profile-name')?.value || el.dataset.profileId, host: el.querySelector('.profile-host')?.value }));
    const div = document.createElement('div');
    div.className = 'compte-row';
    div.dataset.compteId = id;
    div.innerHTML = `
        <div class="fields">
            <div class="form-group">
                <label>Email</label>
                <input type="email" class="form-control compte-email" value="${(data.email || '').replace(/"/g, '&quot;')}" required />
            </div>
            <div class="form-group">
                <label>Mot de passe</label>
                <input type="password" class="form-control compte-password" value="" placeholder="${data.password ? '••••••••' : ''}" />
            </div>
            <div class="form-group">
                <label>Profil SMTP (courrier sortant)</label>
                <select class="form-control compte-profil-smtp" required>${smtpIds.map(p => `<option value="${p.id}" ${(data.profil_smtp_id === p.id) ? 'selected' : ''}>${p.name || p.id} (${p.host || ''})</option>`).join('') || '<option value="">— Aucun profil —</option>'}</select>
            </div>
            <div class="form-group">
                <label>Profil IMAP (courrier entrant, optionnel)</label>
                <select class="form-control compte-profil-imap"><option value="">— Aucun —</option>${imapIds.map(p => `<option value="${p.id}" ${(data.profil_imap_id === p.id) ? 'selected' : ''}>${p.name || p.id} (${p.host || ''})</option>`).join('')}</select>
            </div>
            <div class="form-group">
                <label>Type</label>
                <select class="form-control compte-type"><option value="entity" ${(data.type || 'entity') === 'entity' ? 'selected' : ''}>Entité (app@, news@…)</option><option value="user" ${data.type === 'user' ? 'selected' : ''}>Utilisateur</option></select>
            </div>
            <div class="form-group">
                <label>Nom affiché (From)</label>
                <input type="text" class="form-control compte-from-name" value="${(data.from_name || '').replace(/"/g, '&quot;')}" placeholder="Optionnel" />
            </div>
            <div class="form-group">
                <label>Dossier IMAP (mailbox)</label>
                <input type="text" class="form-control compte-imap-mailbox" value="${(data.imap_mailbox || 'INBOX').replace(/"/g, '&quot;')}" placeholder="INBOX" />
            </div>
        </div>
        <button type="button" class="btn-remove" onclick="removeCompte('${id}')">Supprimer</button>`;
    document.getElementById('comptesContainer').appendChild(div);
}

function addImapFromPreset() {
    const sel = document.getElementById('presetImapSelect');
    const presetId = sel.value;
    if (!presetId) { alert('Choisissez un fournisseur'); return; }
    const p = presets.find(x => x.id === presetId);
    if (!p || !p.imap) return;
    addImapProfile({ name: p.name, host: p.imap.host, port: p.imap.port, secure: p.imap.secure !== false });
    sel.value = '';
}

function addSmtpFromPreset() {
    const sel = document.getElementById('presetSmtpSelect');
    const presetId = sel.value;
    if (!presetId) { alert('Choisissez un fournisseur'); return; }
    const p = presets.find(x => x.id === presetId);
    if (!p || !p.smtp) return;
    addSmtpProfile({ name: p.name, host: p.smtp.host, port: p.smtp.port, secure: p.smtp.secure === true });
    sel.value = '';
}

function removeImapProfile(id) { document.querySelector(`[data-profile-id="${id}"]`)?.remove(); }
function removeSmtpProfile(id) { document.querySelector(`[data-profile-id="${id}"]`)?.remove(); }
function removeCompte(id) { document.querySelector(`[data-compte-id="${id}"]`)?.remove(); }

function populateForm(config) {
    const migrateOld = config.smtp_profiles && !Array.isArray(config.profils_imap);
    let profilsImap = config.profils_imap || [];
    let profilsSmtp = config.profils_smtp || [];
    let comptes = config.comptes || [];
    if (migrateOld) {
        const smtpProfiles = config.smtp_profiles;
        const smtpIds = Object.keys(smtpProfiles);
        profilsSmtp = smtpIds.map((key, i) => ({ id: `smtp_${i}`, name: key, host: smtpProfiles[key].smtp.host, port: smtpProfiles[key].smtp.port, secure: smtpProfiles[key].smtp.secure }));
        if (config.imap_config) {
            profilsImap = [{ id: 'imap_0', name: 'IMAP', host: config.imap_config.host, port: config.imap_config.port || 993, secure: config.imap_config.secure !== false }];
        }
        comptes = smtpIds.map((key, i) => ({
            id: key,
            email: smtpProfiles[key].smtp.auth.user,
            password: smtpProfiles[key].smtp.auth.pass,
            profil_smtp_id: profilsSmtp[i].id,
            profil_imap_id: profilsImap[0] ? profilsImap[0].id : null,
            type: 'entity',
            from_name: smtpProfiles[key].from && smtpProfiles[key].from.name
        }));
    }
    profilsImap.forEach(p => addImapProfile(p));
    profilsSmtp.forEach(p => addSmtpProfile(p));
    comptes.forEach(c => addCompte({ ...c, password: c.password ? '••••••••' : '' }));
    (config.routing_rules || []).forEach(rule => addRuleForm(rule));
    if (config.collection_name) document.getElementById('collectionName').value = config.collection_name;
}

function addRuleForm(ruleData = null) {
    const container = document.getElementById('routingRulesContainer');
    const ruleId = `rule_${ruleCounter++}`;
    
    const ruleDiv = document.createElement('div');
    ruleDiv.className = 'rule-item';
    ruleDiv.dataset.ruleId = ruleId;
    
    ruleDiv.innerHTML = `
        <div class="rule-item-header">
            <h3>Règle de routing</h3>
            <button type="button" class="btn-remove" onclick="removeRule('${ruleId}')">Supprimer</button>
        </div>
        <div class="form-group">
            <label>Condition (clé:valeur, séparé par virgule)</label>
            <input type="text" class="form-control rule-condition" value="${ruleData ? Object.entries(ruleData.condition || {}).map(([k,v]) => `${k}:${v}`).join(', ') : ''}" placeholder="priority:high, category:alert" />
            <small class="text-muted">Exemple: priority:high, category:alert</small>
        </div>
        <div class="form-group">
            <label>Compte mail à utiliser</label>
            <input type="text" class="form-control rule-profile" value="${ruleData?.use_profile || ''}" placeholder="nom du compte" required />
        </div>
        <div class="form-group">
            <label>Destinataire par défaut (optionnel)</label>
            <input type="email" class="form-control rule-to" value="${ruleData?.default_to || ''}" placeholder="admin@entite.fr" />
        </div>
    `;
    
    container.appendChild(ruleDiv);
}

function removeRule(ruleId) {
    const ruleDiv = document.querySelector(`[data-rule-id="${ruleId}"]`);
    if (ruleDiv) {
        ruleDiv.remove();
    }
}

function collectFormData() {
    const config = {
        profils_imap: [],
        profils_smtp: [],
        comptes: [],
        routing_rules: [],
        collection_name: document.getElementById('collectionName').value.trim() || null
    };

    document.querySelectorAll('#imapProfilesContainer .profile-row').forEach(row => {
        config.profils_imap.push({
            id: row.dataset.profileId,
            name: row.querySelector('.profile-name')?.value?.trim() || null,
            host: row.querySelector('.profile-host')?.value?.trim(),
            port: parseInt(row.querySelector('.profile-port')?.value, 10) || 993,
            secure: row.querySelector('.profile-secure')?.value !== 'false'
        });
    });
    document.querySelectorAll('#smtpProfilesContainer .profile-row').forEach(row => {
        config.profils_smtp.push({
            id: row.dataset.profileId,
            name: row.querySelector('.profile-name')?.value?.trim() || null,
            host: row.querySelector('.profile-host')?.value?.trim(),
            port: parseInt(row.querySelector('.profile-port')?.value, 10) || 587,
            secure: row.querySelector('.profile-secure')?.value === 'true'
        });
    });
    document.querySelectorAll('#comptesContainer .compte-row').forEach(row => {
        const email = row.querySelector('.compte-email')?.value?.trim();
        const profilSmtpId = row.querySelector('.compte-profil-smtp')?.value || null;
        if (!email || !profilSmtpId) return;
        const pwd = row.querySelector('.compte-password')?.value;
        config.comptes.push({
            id: row.dataset.compteId,
            email,
            password: pwd || undefined,
            profil_smtp_id: profilSmtpId,
            profil_imap_id: row.querySelector('.compte-profil-imap')?.value || null,
            type: row.querySelector('.compte-type')?.value || 'entity',
            from_name: row.querySelector('.compte-from-name')?.value?.trim() || null,
            imap_mailbox: row.querySelector('.compte-imap-mailbox')?.value?.trim() || 'INBOX'
        });
    });

    document.querySelectorAll('.rule-item').forEach(ruleDiv => {
        const conditionStr = ruleDiv.querySelector('.rule-condition').value;
        const condition = {};
        if (conditionStr) {
            conditionStr.split(',').forEach(part => {
                const [key, value] = part.trim().split(':');
                if (key && value) {
                    condition[key.trim()] = value.trim();
                }
            });
        }
        
        config.routing_rules.push({
            condition: Object.keys(condition).length > 0 ? condition : null,
            use_profile: ruleDiv.querySelector('.rule-profile').value,
            default_to: ruleDiv.querySelector('.rule-to').value || null
        });
    });

    return config;
}

function postConfig(config) {
    return fetch(`${API_BASE_URL}/config/${MODULE_NAME}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${JWT_TOKEN}`
        },
        body: JSON.stringify({ config })
    }).then(response => response.json());
}

function saveConfig(e) {
    if (e && e.preventDefault) {
        e.preventDefault();
    }
    
    const config = collectFormData();
    
    if (!config.comptes.length || !config.profils_smtp.length) {
        alert('Veuillez ajouter au moins un profil SMTP et un compte utilisateur.');
        return;
    }

    postConfig(config)
        .then(data => {
            if (data.success) {
                alert('Configuration sauvegardée avec succès !');
                showListMode(); // Retourner à la liste
            } else {
                alert('Erreur : ' + (data.message || 'Erreur inconnue'));
            }
        })
        .catch(error => {
            alert('Erreur de connexion au serveur');
            console.error(error);
        });
}

function saveConfigAndTestProfile(compteId) {
    const config = collectFormData();
    if (!config.comptes.length) {
        alert('Veuillez ajouter au moins un compte.');
        return;
    }
    postConfig(config)
        .then(data => {
            if (!data.success) throw new Error(data.message || 'Erreur lors de la sauvegarde');
            testConnectionsForProfiles({ [compteId]: {} });
        })
        .catch(error => alert(error.message || 'Erreur de connexion au serveur'));
}

function testConnections() {
    const resultsDiv = document.getElementById('smtpTestResults');
    if (resultsDiv) resultsDiv.textContent = 'Sauvegarde puis test en cours...';
    const config = collectFormData();
    if (!config.comptes.length) {
        if (resultsDiv) resultsDiv.textContent = 'Ajoutez au moins un compte et sauvegardez.';
        return;
    }
    postConfig(config).then(data => {
        if (!data.success) {
            if (resultsDiv) resultsDiv.textContent = 'Erreur sauvegarde : ' + (data.message || '');
            return;
        }
        testAllConnections();
    }).catch(() => { if (resultsDiv) resultsDiv.textContent = 'Erreur de connexion'; });
}

function testConnectionsForProfiles(profiles) {
    const profilesArr = Object.keys(profiles);
    
    if (profilesArr.length === 0) {
        alert('Veuillez configurer au moins un compte mail');
        return;
    }

    let results = [];
    let completed = 0;

    profilesArr.forEach(profileName => {
        fetch(`${API_BASE_URL}/test/verify/${profileName}?module_name=${MODULE_NAME}`, {
            headers: {
                'Authorization': `Bearer ${JWT_TOKEN}`
            }
        })
        .then(response => response.json())
        .then(data => {
            results.push({
                profile: profileName,
                success: data.success,
                message: data.message
            });
            completed++;
            
            if (completed === profilesArr.length) {
                showTestResults(results);
            }
        })
        .catch(error => {
            results.push({
                profile: profileName,
                success: false,
                message: 'Erreur de connexion'
            });
            completed++;
            
            if (completed === profilesArr.length) {
                showTestResults(results);
            }
        });
    });
}

function showTestResults(results) {
    const message = results.map(r => 
        `Profil "${r.profile}": ${r.success ? '✅ OK' : '❌ Erreur'} - ${r.message}`
    ).join('\n');

    const resultsDiv = document.getElementById('smtpTestResults');
    if (resultsDiv) {
        resultsDiv.textContent = message;
    } else {
        alert(message);
    }
}

// Exposer les fonctions globalement pour les boutons onclick
window.removeImapProfile = removeImapProfile;
window.removeSmtpProfile = removeSmtpProfile;
window.removeCompte = removeCompte;
window.removeRule = removeRule;
window.testConnections = testConnections;
window.showTestResults = showTestResults;
window.loadConfigList = loadConfigList;
window.showListMode = showListMode;
window.showFormMode = showFormMode;
window.editConfig = editConfig;
window.testAllConnections = testAllConnections;
</script>

<?php require_once '../../includes/footer.php'; ?>
