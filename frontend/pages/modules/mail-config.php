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

$module_name = 'mail';
if (!empty($_GET['module'])) {
    $m = preg_replace('/[^a-z0-9_-]/i', '', (string) $_GET['module']);
    if ($m !== '') {
        $module_name = $m;
    }
}
$module_labels = [
    'mail' => 'Mail',
    'gderpi' => 'GDERPI',
];
$module_label = $module_labels[$module_name] ?? strtoupper($module_name);
$page_title = $module_name === 'mail'
    ? 'Connecteur Mail'
    : 'Configuration mail — ' . $module_label;
$is_gderpi_mail = ($module_name === 'gderpi');
$is_entity_mail_connector = ($module_name === 'mail');

require_once '../../includes/header.php';

// Token JWT pour les appels API
$jwt_token = getJWTToken();
?>

<!-- Section Hero -->
<section class="hero">
    <div class="container">
        <?php if ($is_entity_mail_connector): ?>
        <p style="margin-bottom: 0.75rem;">
            <a class="btn btn-outline btn-sm" href="<?= url('pages/entity-connecteurs.php') ?>">← Connecteurs</a>
        </p>
        <?php endif; ?>
        <div class="hero-content">
            <h1><?= $is_gderpi_mail ? 'Configuration mail — GDERPI' : ($is_entity_mail_connector ? 'Connecteur Mail' : 'Configuration du module Mail') ?></h1>
            <p class="hero-description">
                <?php if ($is_gderpi_mail): ?>
                    Comptes SMTP utilisés par GDERPI (hérités du connecteur Mail si aucune config dédiée).
                    Les associations contacts boutique se gèrent dans GDERPI → Configuration → Mail → Comptes.
                <?php elseif ($is_entity_mail_connector): ?>
                    Un compte = adresse email + mot de passe + serveurs <strong>IMAP</strong> (courrier entrant) et <strong>SMTP</strong> (courrier sortant).
                    Les connecteurs entrant/sortant sont activés automatiquement pour chaque compte enregistré.
                <?php else: ?>
                    Configurez les comptes mail de l'entité : adresse, identifiants, serveurs SMTP (envoi) et IMAP (réception).
                <?php endif; ?>
            </p>
            <?php if ($is_gderpi_mail): ?>
            <p class="hero-description" style="margin-top:.5rem;">
                <a href="mail-config.php?module=mail" class="btn btn-outline btn-sm">Configurer le module Mail (comptes SMTP de l'entité)</a>
                <a href="gderpi.php" class="btn btn-outline btn-sm" style="margin-left:.5rem;">Retour GDERPI</a>
            </p>
            <?php endif; ?>
        </div>
    </div>
</section>

<!-- Section Configuration -->
<section class="section">
    <div class="container">
        <!-- Mode Liste -->
        <div id="listMode">
            <div class="section-title">
                <h2>Comptes mail</h2>
            </div>
            <div class="section-actions" style="margin-bottom: 1rem;">
                <button class="btn btn-primary" id="addNewConfigBtn">
                    + Ajouter un compte
                </button>
            </div>

            <div id="configList" class="config-list">
                <div class="loading-state">
                    <p>Chargement de la configuration...</p>
                </div>
            </div>
            <div id="listTestResults" class="mail-test-results" hidden></div>
        </div>

        <!-- Mode Formulaire -->
        <div id="formMode" style="display: none;">
            <div class="form-header">
                <button class="btn btn-outline" onclick="showListMode()">
                    ← Retour à la liste
                </button>
                <h2 id="formTitle">Ajouter un compte</h2>
            </div>

            <form id="mailConfigForm">
                <div class="form-section provider-help">
                    <h2 id="formSectionTitle">Compte mail</h2>
                    <p class="text-muted" id="formSectionHint">Renseignez les informations du compte puis enregistrez.</p>
                    <div id="comptesContainer" class="profiles-container"></div>
                    <div id="imapProfilesContainer" hidden></div>
                    <div id="smtpProfilesContainer" hidden></div>
                </div>

                <div class="form-actions">
                    <button type="submit" class="btn btn-primary" id="saveAccountBtn">
                        Enregistrer ce compte
                    </button>
                    <button type="button" class="btn btn-outline" id="testConnectionBtn">
                        Tester ce compte
                    </button>
                    <button type="button" class="btn btn-outline btn-danger-outline" id="deleteAccountBtn" style="display: none;">
                        Supprimer ce compte
                    </button>
                    <div id="smtpTestResults" style="margin-top: 8px; color: #666;"></div>
                </div>

                <div class="form-section form-section--advanced">
                    <h2>Options avancées</h2>
                    <div class="form-group">
                        <label for="collectionName">Nom de collection personnalisé (optionnel)</label>
                        <input type="text" id="collectionName" name="collection_name" class="form-control" placeholder="emails" />
                        <small class="text-muted">Par défaut : emails</small>
                    </div>
                    <details class="advanced-routing">
                        <summary>Règles de routing (modules automatisés)</summary>
                        <p class="text-muted">
                            Réservé aux envois programmatiques (alertes, modules avec contexte).
                            Inutile pour la configuration courante des comptes.
                        </p>
                        <div id="routingRulesContainer"></div>
                        <button type="button" class="btn btn-outline" id="addRuleBtn">+ Ajouter une règle</button>
                    </details>
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
.btn-danger-outline { color: #dc3545; border-color: #dc3545; }
.btn-danger-outline:hover { background: #dc3545; color: #fff; }
.compte-row { background: var(--color-light); border-radius: 6px; padding: 1rem; margin-bottom: 0.75rem; display: grid; grid-template-columns: 1fr; gap: 0.5rem; }
.compte-row .fields { grid-column: 1; }
.compte-row__header { display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; margin-bottom: 0.75rem; flex-wrap: wrap; }
.compte-row__header .compte-row__title { margin: 0; font-size: 1.05rem; color: var(--color-primary); }
.mail-list-summary { margin: 0 0 1rem; font-size: 1.05rem; color: var(--color-gray); }
.mail-test-results { margin-top: 1rem; padding: 1rem; border-radius: 8px; background: var(--color-light); font-size: 0.95rem; white-space: pre-wrap; }
.mail-test-results--ok { border-left: 4px solid #28a745; }
.mail-test-results--err { border-left: 4px solid #dc3545; }
.compte-server-block { margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px dashed #ccc; }
.compte-server-block h4 { margin: 0 0 0.5rem; font-size: 0.95rem; color: var(--color-gray); }
.compte-server-fields { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 0.5rem; }
.advanced-routing { margin-top: 1rem; }
.advanced-routing summary { cursor: pointer; font-weight: 600; color: var(--color-gray); }
.module-info { margin: 0 0 1rem; padding: .75rem 1rem; border-radius: 8px; font-size: .95rem; }
.module-info--inherited { background: #fffbeb; border: 1px solid #fcd34d; color: #92400e; }
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
let currentEffectiveConfig = null;
let currentInheritedFrom = null;

let formEditMode = 'create';
let formOriginalAccountId = null;
let formOriginalPassword = null;

document.addEventListener('DOMContentLoaded', function() {
    const boot = () => {
        loadPresets();
        loadConfigList();
    };
    if (window.gdriJwtReady && typeof window.gdriJwtReady.then === 'function') {
        window.gdriJwtReady.finally(boot);
    } else {
        boot();
    }
    document.getElementById('addNewConfigBtn').addEventListener('click', () => openAccountForm({ mode: 'create' }));
    document.getElementById('addRuleBtn').addEventListener('click', addRuleForm);
    document.getElementById('mailConfigForm').addEventListener('submit', saveConfig);
    document.getElementById('testConnectionBtn')?.addEventListener('click', testCurrentAccount);
    document.getElementById('deleteAccountBtn')?.addEventListener('click', deleteCurrentAccount);
});

window.addEventListener('pageshow', function(event) {
    if (event.persisted) {
        if (window.gdriJwtReady && typeof window.gdriJwtReady.then === 'function') {
            window.gdriJwtReady.finally(loadConfigList);
        } else {
            loadConfigList();
        }
    }
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
    /* presets charges pour applyPresetToCompte */
}

function escAttr(v) {
    return String(v ?? '').replace(/"/g, '&quot;');
}

function showListMode() {
    document.getElementById('listMode').style.display = 'block';
    document.getElementById('formMode').style.display = 'none';
    loadConfigList();
}

function openAccountForm({ mode = 'create', accountId = null } = {}) {
    formEditMode = mode;
    formOriginalAccountId = mode === 'edit' ? accountId : null;
    formOriginalPassword = null;

    document.getElementById('listMode').style.display = 'none';
    document.getElementById('formMode').style.display = 'block';
    document.getElementById('comptesContainer').innerHTML = '';
    document.getElementById('routingRulesContainer').innerHTML = '';
    document.getElementById('collectionName').value = '';
    document.getElementById('smtpTestResults').textContent = '';

    const titles = {
        create: 'Ajouter un compte',
        edit: 'Modifier le compte',
        duplicate: 'Nouveau compte (serveurs copiés)'
    };
    const hints = {
        create: 'Renseignez les informations du compte puis enregistrez.',
        edit: 'Modifiez ce compte uniquement. Les autres comptes ne sont pas affichés.',
        duplicate: 'Serveurs SMTP/IMAP copiés — complétez identifiant, email et mot de passe.'
    };
    document.getElementById('formTitle').textContent = titles[mode] || titles.create;
    document.getElementById('formSectionHint').textContent = hints[mode] || hints.create;
    document.getElementById('deleteAccountBtn').style.display = mode === 'edit' ? '' : 'none';

    if (mode === 'create') {
        addCompte();
        return;
    }

    fetch(`${API_BASE_URL}/config/${MODULE_NAME}`, { headers: { 'Authorization': `Bearer ${JWT_TOKEN}` } })
        .then(r => r.json())
        .then(data => {
            if (!data.success) return;
            const cfg = data.config || data.effective_config;
            const accounts = normalizeAccountsFromConfig(cfg);
            const a = accounts.find(x => String(x.id) === String(accountId));
            if (!a) return;

            if (mode === 'duplicate') {
                addCompte({ smtp: a.smtp, imap: a.imap || {} });
                return;
            }

            const stored = ensureNewFormatConfig(cfg);
            const c = stored.comptes.find(x => String(x.id) === String(accountId));
            formOriginalPassword = c?.password || cfg.smtp_profiles?.[accountId]?.smtp?.auth?.pass || null;
            document.getElementById('collectionName').value = cfg.collection_name || '';
            addCompte({
                id: a.id,
                email: a.email,
                type: a.type,
                from_name: a.from_name,
                imap_mailbox: c?.imap_mailbox || 'INBOX',
                smtp: a.smtp,
                imap: a.imap || {},
                password: formOriginalPassword ? '••••••••' : ''
            });
        })
        .catch(err => console.error(err));
}

function ensureNewFormatConfig(config) {
    const base = {
        profils_imap: [],
        profils_smtp: [],
        comptes: [],
        routing_rules: config?.routing_rules || [],
        collection_name: config?.collection_name || null
    };
    if (!config) return base;
    if (Array.isArray(config.comptes) && config.comptes.length) {
        return {
            ...base,
            profils_imap: (config.profils_imap || []).map(p => ({ ...p })),
            profils_smtp: (config.profils_smtp || []).map(p => ({ ...p })),
            comptes: config.comptes.map(c => ({ ...c }))
        };
    }
    const profiles = config.smtp_profiles || {};
    Object.keys(profiles).forEach((key) => {
        const p = profiles[key] || {};
        const smtpId = `smtp_${key}`;
        const imap = p.imap || config.imap_config;
        const imapId = imap?.host ? `imap_${key}` : null;
        base.profils_smtp.push({
            id: smtpId, name: key,
            host: p.smtp?.host, port: p.smtp?.port ?? 587, secure: p.smtp?.secure === true
        });
        if (imapId) {
            base.profils_imap.push({
                id: imapId, name: key,
                host: imap.host, port: imap.port ?? 993, secure: imap.secure !== false
            });
        }
        base.comptes.push({
            id: key,
            email: p.smtp?.auth?.user || key,
            password: p.smtp?.auth?.pass,
            profil_smtp_id: smtpId,
            profil_imap_id: imapId,
            type: 'entity',
            from_name: p.from?.name || null,
            imap_mailbox: 'INBOX'
        });
    });
    return base;
}

function removeAccountFromConfig(cfg, accountId) {
    const compte = cfg.comptes.find(c => String(c.id) === String(accountId));
    if (!compte) return;
    cfg.comptes = cfg.comptes.filter(c => String(c.id) !== String(accountId));
    if (compte.profil_smtp_id) {
        cfg.profils_smtp = cfg.profils_smtp.filter(p => p.id !== compte.profil_smtp_id);
    }
    if (compte.profil_imap_id) {
        cfg.profils_imap = cfg.profils_imap.filter(p => p.id !== compte.profil_imap_id);
    }
}

function loadConfigList() {
    const listDiv = document.getElementById('configList');
    const listResults = document.getElementById('listTestResults');
    if (listResults) listResults.hidden = true;
    listDiv.innerHTML = '<div class="loading-state"><p>Chargement de la configuration...</p></div>';

    fetch(`${API_BASE_URL}/config/${MODULE_NAME}`, { headers: { 'Authorization': `Bearer ${JWT_TOKEN}` } })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            const c = data.config;
            const effective = data.effective_config || c;
            currentEffectiveConfig = effective;
            currentInheritedFrom = data.inherited_from || null;
            const hasNew = c && Array.isArray(c.comptes) && c.comptes.length > 0;
            const hasOld = c && c.smtp_profiles && Object.keys(c.smtp_profiles).length > 0;
            const hasImap = c && (c.imap_config || (hasNew && c.comptes.some(x => x.profil_imap_id)));
            const hasEffNew = effective && Array.isArray(effective.comptes) && effective.comptes.length > 0;
            const hasEffOld = effective && effective.smtp_profiles && Object.keys(effective.smtp_profiles).length > 0;
            const hasEffImap = effective && (effective.imap_config || (hasEffNew && effective.comptes.some(x => x.profil_imap_id)));
            if (!effective || (!hasEffNew && !hasEffOld && !hasEffImap)) {
                if (MODULE_NAME === 'gderpi') {
                    listDiv.innerHTML = `
                        <div class="empty-state">
                            <p>Aucun compte mail configuré pour GDERPI.</p>
                            <p class="text-muted">Configurez d'abord les comptes SMTP dans le module Mail de l'entité.</p>
                            <a class="btn btn-primary" href="mail-config.php?module=mail">Configurer le module Mail</a>
                        </div>
                    `;
                } else {
                    listDiv.innerHTML = `
                        <div class="empty-state">
                            <p>Aucune configuration trouvée.</p>
                            <button class="btn btn-primary" onclick="openAccountForm({ mode: 'create' })">Ajouter un compte</button>
                        </div>
                    `;
                }
            } else {
                // Afficher la configuration existante
                displayConfigList(effective, !!c);
            }
        } else {
            listDiv.innerHTML = `
                <div class="error-state">
                    <p>${data.message || 'Erreur lors du chargement'}</p>
                    <button class="btn btn-primary" onclick="openAccountForm({ mode: 'create' })">Ajouter un compte</button>
                </div>
            `;
        }
    })
    .catch(error => {
        listDiv.innerHTML = `
            <div class="error-state">
                <p>Erreur de connexion au serveur</p>
                <button class="btn btn-primary" onclick="openAccountForm({ mode: 'create' })">Ajouter un compte</button>
            </div>
        `;
        console.error(error);
    });
}

function normalizeAccountsFromConfig(config) {
    if (!config) return [];
    if (Array.isArray(config.comptes) && config.comptes.length) {
        const imapById = Object.fromEntries((config.profils_imap || []).map(p => [p.id, p]));
        const smtpById = Object.fromEntries((config.profils_smtp || []).map(p => [p.id, p]));
        return config.comptes.map(c => {
            const smtpP = smtpById[c.profil_smtp_id] || {};
            const imapP = c.profil_imap_id ? (imapById[c.profil_imap_id] || {}) : null;
            return {
                id: c.id || c.email,
                email: c.email,
                type: c.type || 'entity',
                from_name: c.from_name,
                imap_mailbox: c.imap_mailbox,
                smtp: { host: smtpP.host || '', port: smtpP.port ?? 587, secure: smtpP.secure !== false },
                imap: imapP && imapP.host ? { host: imapP.host, port: imapP.port ?? 993, secure: imapP.secure !== false } : null
            };
        });
    }
    const profiles = config.smtp_profiles || {};
    return Object.keys(profiles).map(key => {
        const p = profiles[key] || {};
        const smtp = p.smtp || {};
        const imap = p.imap || config.imap_config || null;
        return {
            id: key,
            email: smtp.auth?.user || key,
            type: 'entity',
            from_name: p.from?.name,
            smtp: { host: smtp.host || '', port: smtp.port ?? 587, secure: smtp.secure === true },
            imap: imap && imap.host ? { host: imap.host, port: imap.port ?? 993, secure: imap.secure !== false } : null
        };
    });
}

function formatMailServer(srv) {
    if (!srv || !srv.host) return '—';
    return `${srv.host}:${srv.port}${srv.secure ? ' SSL' : ''}`;
}

function escJs(s) {
    return String(s ?? '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function displayConfigList(config, hasOwnConfig = true) {
    const listDiv = document.getElementById('configList');
    const accounts = normalizeAccountsFromConfig(config);
    const n = accounts.length;
    const label = n > 1 ? 'comptes mail configurés' : 'compte mail configuré';

    let html = `<p class="mail-list-summary"><strong>${n}</strong> ${label}</p>`;

    if (currentInheritedFrom) {
        const mailLink = 'mail-config.php?module=mail';
        const gderpiBack = 'gderpi.php';
        let msg = `Les comptes proviennent du module <strong>${currentInheritedFrom}</strong>.`;
        if (MODULE_NAME === 'gderpi') {
            msg += ` Pour ajouter ou modifier un compte, utilisez la <a href="${mailLink}">configuration Mail de l'entité</a>.`;
            msg += ` Les associations contacts boutique se gèrent dans <a href="${gderpiBack}">GDERPI → Configuration → Mail → Comptes</a>.`;
        }
        html = `<div class="module-info module-info--inherited">${msg}</div>` + html;
    }

    accounts.forEach(a => {
        const aid = escJs(a.id);
        html += `<div class="config-card">
            <div class="config-card-header">
                <h3>${a.email}</h3>
                <div class="config-actions">
                    <button type="button" class="btn btn-outline btn-sm" onclick="testAccountConnection('${aid}')">Tester</button>
                    <button type="button" class="btn btn-outline btn-sm" onclick="duplicateAccountFromList('${aid}')">Dupliquer</button>
                    <button type="button" class="btn btn-primary btn-sm" onclick="editAccountFromList('${aid}')">Modifier</button>
                </div>
            </div>
            <div class="config-details">
                <div class="config-detail-item"><strong>Identifiant</strong><span>${a.id}</span></div>
                <div class="config-detail-item"><strong>Type</strong><span>${a.type || 'entity'}</span></div>
                <div class="config-detail-item"><strong>Entrant (IMAP)</strong><span>${a.imap && a.imap.host ? formatMailServer(a.imap) : '— non configuré'}</span></div>
                <div class="config-detail-item"><strong>Sortant (SMTP)</strong><span>${formatMailServer(a.smtp)}</span></div>
            </div>
        </div>`;
    });

    if (config.routing_rules && config.routing_rules.length > 0) {
        html += `<div class="config-card"><div class="config-card-header"><h3>Règles de routing (avancé)</h3></div><div class="config-details">`;
        config.routing_rules.forEach((rule, index) => {
            const conditionStr = rule.condition ? Object.entries(rule.condition).map(([k,v]) => `${k}:${v}`).join(', ') : 'Aucune';
            html += `<div class="config-detail-item" style="grid-column: 1 / -1;"><strong>Règle ${index + 1}</strong><span>Si: ${conditionStr} → Compte: ${rule.use_profile}${rule.default_to ? ` → To: ${rule.default_to}` : ''}</span></div>`;
        });
        html += `</div></div>`;
    }

    listDiv.innerHTML = html;
}

function editAccountFromList(accountId) {
    if (MODULE_NAME === 'gderpi' && currentInheritedFrom === 'mail') {
        window.location.href = 'mail-config.php?module=mail';
        return;
    }
    openAccountForm({ mode: 'edit', accountId });
}

function duplicateAccountFromList(accountId) {
    if (MODULE_NAME === 'gderpi' && currentInheritedFrom === 'mail') {
        window.location.href = 'mail-config.php?module=mail';
        return;
    }
    openAccountForm({ mode: 'duplicate', accountId });
}

function testAllConnections() {
    const cfg = currentEffectiveConfig;
    if (!cfg) return;
    const accounts = normalizeAccountsFromConfig(cfg);
    if (!accounts.length) return;
    const profiles = accounts.reduce((o, a) => { o[a.id] = {}; return o; }, {});
    testConnectionsForProfiles(profiles);
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

function presetOptionsHtml() {
    const opt = (p) => `<option value="${p.id}">${p.name}</option>`;
    return '<option value="">— Choisir un fournisseur —</option>' + (presets.map(opt).join(''));
}

function addCompte(data = {}) {
    const id = data.id || `compte_${++compteIdCounter}`;
    const smtp = data.smtp || {};
    const imap = data.imap || {};
    const div = document.createElement('div');
    div.className = 'compte-row';
    div.dataset.compteId = id;
    div.innerHTML = `
        <div class="fields">
            <h3 class="compte-row__title">${escAttr(data.email) || 'Nouveau compte'}</h3>
            <div class="preset-row">
                <select class="form-control preset-select compte-preset-select">${presetOptionsHtml()}</select>
                <button type="button" class="btn btn-outline compte-preset-btn">Appliquer le fournisseur</button>
            </div>
            <p class="text-muted" style="font-size:.9rem;margin:-0.5rem 0 1rem;">Remplit les serveurs SMTP et IMAP uniquement — l'adresse mail reste à saisir manuellement.</p>
            <div class="form-group">
                <label>Identifiant du compte</label>
                <input type="text" class="form-control compte-id" value="${escAttr(data.id || id)}" placeholder="ex. app" required />
            </div>
            <div class="form-group">
                <label>Email</label>
                <input type="email" class="form-control compte-email" value="${escAttr(data.email)}" required />
            </div>
            <div class="form-group">
                <label>Mot de passe</label>
                <input type="password" class="form-control compte-password" value="" placeholder="${data.password ? '••••••••' : ''}" />
            </div>
            <div class="form-group">
                <label>Type</label>
                <select class="form-control compte-type">
                    <option value="entity" ${(data.type || 'entity') === 'entity' ? 'selected' : ''}>Entité (app@, news@…)</option>
                    <option value="user" ${data.type === 'user' ? 'selected' : ''}>Utilisateur</option>
                </select>
            </div>
            <div class="form-group">
                <label>Nom affiché (From)</label>
                <input type="text" class="form-control compte-from-name" value="${escAttr(data.from_name)}" placeholder="Optionnel" />
            </div>
            <div class="compte-server-block">
                <h4>Courrier sortant (SMTP)</h4>
                <div class="compte-server-fields">
                    <div class="form-group"><label>Host</label><input type="text" class="form-control compte-smtp-host" value="${escAttr(smtp.host)}" placeholder="pro1.mail.ovh.net" required /></div>
                    <div class="form-group"><label>Port</label><input type="number" class="form-control compte-smtp-port" value="${smtp.port ?? 587}" required /></div>
                    <div class="form-group"><label>SSL/TLS</label><select class="form-control compte-smtp-secure"><option value="false" ${smtp.secure !== true ? 'selected' : ''}>Non (STARTTLS)</option><option value="true" ${smtp.secure === true ? 'selected' : ''}>Oui</option></select></div>
                </div>
            </div>
            <div class="compte-server-block">
                <h4>Courrier entrant (IMAP, optionnel)</h4>
                <div class="compte-server-fields">
                    <div class="form-group"><label>Host</label><input type="text" class="form-control compte-imap-host" value="${escAttr(imap.host)}" placeholder="pro1.mail.ovh.net" /></div>
                    <div class="form-group"><label>Port</label><input type="number" class="form-control compte-imap-port" value="${imap.port ?? 993}" /></div>
                    <div class="form-group"><label>SSL/TLS</label><select class="form-control compte-imap-secure"><option value="true" ${imap.secure !== false ? 'selected' : ''}>Oui</option><option value="false" ${imap.secure === false ? 'selected' : ''}>Non</option></select></div>
                    <div class="form-group"><label>Dossier (mailbox)</label><input type="text" class="form-control compte-imap-mailbox" value="${escAttr(data.imap_mailbox || 'INBOX')}" placeholder="INBOX" /></div>
                </div>
            </div>
        </div>`;
    const titleEl = div.querySelector('.compte-row__title');
    const emailInput = div.querySelector('.compte-email');
    emailInput?.addEventListener('input', () => {
        titleEl.textContent = emailInput.value.trim() || 'Nouveau compte';
    });
    div.querySelector('.compte-preset-btn').addEventListener('click', () => applyPresetToCompte(div));
    div.querySelector('.compte-preset-select').addEventListener('change', () => applyPresetToCompte(div));
    document.getElementById('comptesContainer').appendChild(div);
}

function applyPresetToCompte(row) {
    const presetId = row.querySelector('.compte-preset-select')?.value;
    if (!presetId) return;
    const p = presets.find(x => x.id === presetId);
    if (!p) return;
    if (p.smtp) {
        row.querySelector('.compte-smtp-host').value = p.smtp.host || '';
        row.querySelector('.compte-smtp-port').value = p.smtp.port ?? 587;
        row.querySelector('.compte-smtp-secure').value = p.smtp.secure === true ? 'true' : 'false';
    }
    if (p.imap) {
        row.querySelector('.compte-imap-host').value = p.imap.host || '';
        row.querySelector('.compte-imap-port').value = p.imap.port ?? 993;
        row.querySelector('.compte-imap-secure').value = p.imap.secure !== false ? 'true' : 'false';
    }
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
function removeCompte(id) {
    document.querySelector(`[data-compte-id="${id}"]`)?.remove();
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

    document.querySelectorAll('#comptesContainer .compte-row').forEach(row => {
        const email = row.querySelector('.compte-email')?.value?.trim();
        const compteId = row.querySelector('.compte-id')?.value?.trim() || row.dataset.compteId;
        const smtpHost = row.querySelector('.compte-smtp-host')?.value?.trim();
        if (!email || !compteId || !smtpHost) return;

        const smtpId = `smtp_${compteId}`;
        const imapHost = row.querySelector('.compte-imap-host')?.value?.trim();
        const imapId = imapHost ? `imap_${compteId}` : null;
        const pwd = row.querySelector('.compte-password')?.value;

        config.profils_smtp.push({
            id: smtpId,
            name: compteId,
            host: smtpHost,
            port: parseInt(row.querySelector('.compte-smtp-port')?.value, 10) || 587,
            secure: row.querySelector('.compte-smtp-secure')?.value === 'true'
        });
        if (imapId) {
            config.profils_imap.push({
                id: imapId,
                name: compteId,
                host: imapHost,
                port: parseInt(row.querySelector('.compte-imap-port')?.value, 10) || 993,
                secure: row.querySelector('.compte-imap-secure')?.value !== 'false'
            });
        }
        config.comptes.push({
            id: compteId,
            email,
            password: pwd || undefined,
            profil_smtp_id: smtpId,
            profil_imap_id: imapId,
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

function testAccountConnection(accountId) {
    testConnectionsForProfiles({ [accountId]: {} });
}

function buildSingleAccountPayload() {
    const single = collectFormData();
    if (!single.comptes.length || !single.profils_smtp.length) return null;
    const newCompte = { ...single.comptes[0] };
    if (!newCompte.password && formOriginalPassword) {
        newCompte.password = formOriginalPassword;
    }
    return { single, newCompte };
}

function mergeSingleAccountIntoConfig(cfg, single, newCompte) {
    if (formEditMode === 'edit' && formOriginalAccountId) {
        removeAccountFromConfig(cfg, formOriginalAccountId);
    }
    const exists = cfg.comptes.some(c => String(c.id) === String(newCompte.id));
    if (exists && formEditMode !== 'edit') {
        return { error: 'Un compte avec cet identifiant existe déjà.' };
    }
    if (formEditMode === 'edit' && formOriginalAccountId && String(formOriginalAccountId) !== String(newCompte.id)) {
        if (cfg.comptes.some(c => String(c.id) === String(newCompte.id))) {
            return { error: 'Un autre compte utilise déjà cet identifiant.' };
        }
    }
    cfg.profils_smtp.push(...single.profils_smtp);
    cfg.profils_imap.push(...single.profils_imap);
    cfg.comptes.push(newCompte);
    const coll = document.getElementById('collectionName').value.trim();
    if (coll) cfg.collection_name = coll;
    return { cfg };
}

function fetchAndMergeSingleAccount() {
    const payload = buildSingleAccountPayload();
    if (!payload) return Promise.reject(new Error('Veuillez renseigner identifiant, email et serveur SMTP.'));

    return fetch(`${API_BASE_URL}/config/${MODULE_NAME}`, { headers: { 'Authorization': `Bearer ${JWT_TOKEN}` } })
        .then(r => r.json())
        .then(data => {
            if (!data.success) throw new Error(data.message || 'Erreur chargement');
            const cfg = ensureNewFormatConfig(data.config || data.effective_config);
            const merged = mergeSingleAccountIntoConfig(cfg, payload.single, payload.newCompte);
            if (merged.error) throw new Error(merged.error);
            return postConfig(merged.cfg);
        });
}

function saveConfig(e) {
    if (e && e.preventDefault) e.preventDefault();

    fetchAndMergeSingleAccount()
        .then(data => {
            if (data.success) {
                alert('Compte enregistré.');
                showListMode();
            } else {
                alert('Erreur : ' + (data.message || 'Erreur inconnue'));
            }
        })
        .catch(err => {
            alert(err.message || 'Erreur de connexion au serveur');
            console.error(err);
        });
}

function deleteCurrentAccount() {
    if (formEditMode !== 'edit' || !formOriginalAccountId) return;
    if (!confirm('Supprimer ce compte mail ?')) return;

    fetch(`${API_BASE_URL}/config/${MODULE_NAME}`, { headers: { 'Authorization': `Bearer ${JWT_TOKEN}` } })
        .then(r => r.json())
        .then(data => {
            if (!data.success) throw new Error(data.message || 'Erreur');
            const cfg = ensureNewFormatConfig(data.config || data.effective_config);
            removeAccountFromConfig(cfg, formOriginalAccountId);
            return postConfig(cfg);
        })
        .then(data => {
            if (data.success) {
                alert('Compte supprimé.');
                showListMode();
            } else {
                alert('Erreur : ' + (data.message || ''));
            }
        })
        .catch(err => alert(err.message || 'Erreur'));
}

function collectAccountTestPayload() {
    const row = document.querySelector('#comptesContainer .compte-row');
    if (!row) return null;
    const email = row.querySelector('.compte-email')?.value?.trim();
    const smtpHost = row.querySelector('.compte-smtp-host')?.value?.trim();
    const pwdField = row.querySelector('.compte-password')?.value;
    const password = pwdField || formOriginalPassword || '';
    if (!email || !smtpHost) return null;
    const imapHost = row.querySelector('.compte-imap-host')?.value?.trim();
    return {
        email,
        password,
        imap_mailbox: row.querySelector('.compte-imap-mailbox')?.value?.trim() || 'INBOX',
        smtp: {
            host: smtpHost,
            port: parseInt(row.querySelector('.compte-smtp-port')?.value, 10) || 587,
            secure: row.querySelector('.compte-smtp-secure')?.value === 'true'
        },
        imap: imapHost ? {
            host: imapHost,
            port: parseInt(row.querySelector('.compte-imap-port')?.value, 10) || 993,
            secure: row.querySelector('.compte-imap-secure')?.value !== 'false'
        } : null
    };
}

function testCurrentAccount() {
    const resultsDiv = document.getElementById('smtpTestResults');
    const payload = collectAccountTestPayload();
    if (!payload) {
        const msg = 'Renseignez email et serveur SMTP avant de tester.';
        if (resultsDiv) resultsDiv.textContent = msg;
        else alert(msg);
        return;
    }
    if (!payload.password) {
        const msg = 'Mot de passe requis pour tester (saisissez-le ou enregistrez d\'abord le compte).';
        if (resultsDiv) resultsDiv.textContent = msg;
        else alert(msg);
        return;
    }
    if (resultsDiv) resultsDiv.textContent = 'Test en cours…';

    fetch(`${API_BASE_URL}/test/account`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${JWT_TOKEN}`
        },
        body: JSON.stringify({ module_name: MODULE_NAME, account: payload })
    })
    .then(r => r.json())
    .then(data => {
        showTestResults([{
            profile: payload.email,
            success: data.success,
            message: data.message || (data.success ? 'OK' : 'Échec')
        }]);
    })
    .catch(() => {
        showTestResults([{ profile: payload.email, success: false, message: 'Erreur de connexion au serveur' }]);
    });
}

function testConnectionsForProfiles(profiles) {
    const profilesArr = Object.keys(profiles);
    if (profilesArr.length === 0) {
        alert('Aucun compte à tester');
        return;
    }

    const listResults = document.getElementById('listTestResults');
    if (listResults) {
        listResults.hidden = false;
        listResults.className = 'mail-test-results';
        listResults.textContent = 'Test en cours…';
    }

    let results = [];
    let completed = 0;

    profilesArr.forEach(profileName => {
        const url = `${API_BASE_URL}/test/verify/${encodeURIComponent(profileName)}?module_name=${encodeURIComponent(MODULE_NAME)}`;
        fetch(url, { headers: { 'Authorization': `Bearer ${JWT_TOKEN}` } })
        .then(response => response.json().then(data => ({ ok: response.ok, data })))
        .then(({ ok, data }) => {
            results.push({
                profile: profileName,
                success: ok && data.success,
                message: data.message || (data.success ? 'OK' : 'Échec')
            });
            completed++;
            if (completed === profilesArr.length) showTestResults(results);
        })
        .catch(() => {
            results.push({ profile: profileName, success: false, message: 'Erreur de connexion au serveur' });
            completed++;
            if (completed === profilesArr.length) showTestResults(results);
        });
    });
}

function showTestResults(results) {
    const message = results.map(r =>
        `${r.profile}: ${r.success ? '✅' : '❌'} ${r.message}`
    ).join('\n');
    const allOk = results.every(r => r.success);

    const listDiv = document.getElementById('listTestResults');
    const formDiv = document.getElementById('smtpTestResults');
    const listVisible = document.getElementById('listMode')?.style.display !== 'none';

    if (listVisible && listDiv) {
        listDiv.hidden = false;
        listDiv.textContent = message;
        listDiv.className = 'mail-test-results ' + (allOk ? 'mail-test-results--ok' : 'mail-test-results--err');
    }
    if (formDiv && document.getElementById('formMode')?.style.display !== 'none') {
        formDiv.textContent = message;
    }
    if (!listVisible && !formDiv) {
        alert(message);
    }
}

// Exposer les fonctions globalement pour les boutons onclick
window.removeImapProfile = removeImapProfile;
window.removeSmtpProfile = removeSmtpProfile;
window.removeRule = removeRule;
window.showTestResults = showTestResults;
window.loadConfigList = loadConfigList;
window.showListMode = showListMode;
window.openAccountForm = openAccountForm;
window.editAccountFromList = editAccountFromList;
window.testAllConnections = testAllConnections;
window.testAccountConnection = testAccountConnection;
window.duplicateAccountFromList = duplicateAccountFromList;
</script>

<?php require_once '../../includes/footer.php'; ?>
