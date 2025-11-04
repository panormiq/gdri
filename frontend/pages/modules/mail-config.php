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
                Configurez les profils SMTP et règles de routing pour votre entité
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
                <h2>Profils SMTP configurés</h2>
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
                <div class="form-section">
                    <h2>Profils SMTP</h2>
                    <p class="text-muted">Ajoutez un ou plusieurs profils SMTP. Chaque profil peut utiliser une adresse d'envoi différente.</p>
                    
                    <div id="smtpProfilesContainer">
                        <!-- Les profils SMTP seront ajoutés dynamiquement ici -->
                    </div>

                    <button type="button" class="btn btn-outline" id="addProfileBtn">
                        + Ajouter un profil SMTP
                    </button>
                </div>

                <div class="form-section">
                    <h2>Règles de routing (optionnel)</h2>
                    <p class="text-muted">Définissez des règles pour sélectionner automatiquement le profil SMTP selon le contexte.</p>
                    
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

                <div class="form-actions">
                    <button type="submit" class="btn btn-primary">
                        Sauvegarder la configuration
                    </button>
                    <button type="button" class="btn btn-outline" id="testConnectionBtn">
                        Tester les connexions SMTP
                    </button>
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
</style>

<script>
const API_BASE_URL = 'http://localhost:3000/api/mail';
const JWT_TOKEN = '<?php echo $jwt_token; ?>';
const MODULE_NAME = '<?php echo $module_name; ?>';

let profileCounter = 0;
let ruleCounter = 0;
let currentConfig = null;

// Charger la configuration au démarrage
document.addEventListener('DOMContentLoaded', function() {
    loadConfigList();
    
    document.getElementById('addNewConfigBtn').addEventListener('click', showFormMode);
    document.getElementById('addProfileBtn').addEventListener('click', addProfileForm);
    document.getElementById('addRuleBtn').addEventListener('click', addRuleForm);
    document.getElementById('mailConfigForm').addEventListener('submit', saveConfig);
    document.getElementById('testConnectionBtn').addEventListener('click', testConnections);
});

function showListMode() {
    document.getElementById('listMode').style.display = 'block';
    document.getElementById('formMode').style.display = 'none';
    loadConfigList();
}

function showFormMode(config = null) {
    currentConfig = config;
    document.getElementById('listMode').style.display = 'none';
    document.getElementById('formMode').style.display = 'block';
    
    if (config) {
        document.getElementById('formTitle').textContent = 'Modifier la configuration';
        populateForm(config);
    } else {
        document.getElementById('formTitle').textContent = 'Nouvelle configuration';
        // Formulaire vide
        document.getElementById('smtpProfilesContainer').innerHTML = '';
        document.getElementById('routingRulesContainer').innerHTML = '';
        document.getElementById('collectionName').value = '';
        addProfileForm();
    }
}

function loadConfigList() {
    const listDiv = document.getElementById('configList');
    listDiv.innerHTML = '<div class="loading-state"><p>Chargement de la configuration...</p></div>';

    fetch(`${API_BASE_URL}/config/${MODULE_NAME}`, {
        headers: {
            'Authorization': `Bearer ${JWT_TOKEN}`
        }
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            if (!data.config || !data.config.smtp_profiles || Object.keys(data.config.smtp_profiles).length === 0) {
                // Pas de configuration
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
            listDiv.innerHTML = `<div class="error-state"><p>${data.message || 'Erreur lors du chargement'}</p></div>`;
        }
    })
    .catch(error => {
        listDiv.innerHTML = '<div class="error-state"><p>Erreur de connexion au serveur</p></div>';
        console.error(error);
    });
}

function displayConfigList(config) {
    const listDiv = document.getElementById('configList');
    const profiles = config.smtp_profiles || {};
    const profileCount = Object.keys(profiles).length;
    const ruleCount = config.routing_rules ? config.routing_rules.length : 0;
    
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
                <div class="config-detail-item">
                    <strong>Profils SMTP</strong>
                    <span>${profileCount} profil(s) configuré(s)</span>
                </div>
                <div class="config-detail-item">
                    <strong>Règles de routing</strong>
                    <span>${ruleCount} règle(s) définie(s)</span>
                </div>
                <div class="config-detail-item">
                    <strong>Collection</strong>
                    <span>${config.collection_name || 'emails (défaut)'}</span>
                </div>
            </div>
        </div>
    `;
    
    // Afficher les profils
    Object.keys(profiles).forEach((profileName, index) => {
        const profile = profiles[profileName];
        html += `
            <div class="config-card">
                <div class="config-card-header">
                    <h3>Profil: ${profileName}</h3>
                </div>
                <div class="config-details">
                    <div class="config-detail-item">
                        <strong>SMTP Host</strong>
                        <span>${profile.smtp.host}</span>
                    </div>
                    <div class="config-detail-item">
                        <strong>SMTP Port</strong>
                        <span>${profile.smtp.port}</span>
                    </div>
                    <div class="config-detail-item">
                        <strong>Utilisateur</strong>
                        <span>${profile.smtp.auth.user}</span>
                    </div>
                    <div class="config-detail-item">
                        <strong>From</strong>
                        <span>${profile.from.name} &lt;${profile.from.email}&gt;</span>
                    </div>
                </div>
            </div>
        `;
    });
    
    // Afficher les règles de routing
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
    fetch(`${API_BASE_URL}/config/${MODULE_NAME}`, {
        headers: {
            'Authorization': `Bearer ${JWT_TOKEN}`
        }
    })
    .then(response => response.json())
    .then(data => {
        if (data.success && data.config && data.config.smtp_profiles) {
            testConnectionsForProfiles(data.config.smtp_profiles);
        }
    });
}

function populateForm(config) {
    // Vider les containers
    document.getElementById('smtpProfilesContainer').innerHTML = '';
    document.getElementById('routingRulesContainer').innerHTML = '';
    
    // Remplir les profils SMTP
    if (config.smtp_profiles) {
        Object.keys(config.smtp_profiles).forEach(profileName => {
            const profile = config.smtp_profiles[profileName];
            addProfileForm(profileName, profile);
        });
    }

    // Remplir les règles de routing
    if (config.routing_rules && config.routing_rules.length > 0) {
        config.routing_rules.forEach(rule => {
            addRuleForm(rule);
        });
    }

    // Collection name
    if (config.collection_name) {
        document.getElementById('collectionName').value = config.collection_name;
    }
}

function addProfileForm(profileName = null, profileData = null) {
    const container = document.getElementById('smtpProfilesContainer');
    const profileId = profileName || `profile_${profileCounter++}`;
    
    const profileDiv = document.createElement('div');
    profileDiv.className = 'profile-item';
    profileDiv.dataset.profileName = profileId;
    
    profileDiv.innerHTML = `
        <div class="profile-item-header">
            <h3>Profil SMTP: ${profileId}</h3>
            <button type="button" class="btn-remove" onclick="removeProfile('${profileId}')">Supprimer</button>
        </div>
        <div class="form-group">
            <label>Nom du profil</label>
            <input type="text" class="form-control profile-name" value="${profileId}" data-original="${profileId}" />
        </div>
        <div class="form-group">
            <label>SMTP Host</label>
            <input type="text" class="form-control smtp-host" value="${profileData?.smtp?.host || ''}" placeholder="smtp.example.com" required />
        </div>
        <div class="form-group">
            <label>SMTP Port</label>
            <input type="number" class="form-control smtp-port" value="${profileData?.smtp?.port || '587'}" placeholder="587" required />
        </div>
        <div class="form-group">
            <label>SMTP Secure (SSL/TLS)</label>
            <select class="form-control smtp-secure">
                <option value="false" ${!profileData?.smtp?.secure ? 'selected' : ''}>False (TLS)</option>
                <option value="true" ${profileData?.smtp?.secure ? 'selected' : ''}>True (SSL)</option>
            </select>
        </div>
        <div class="form-group">
            <label>SMTP User</label>
            <input type="text" class="form-control smtp-user" value="${profileData?.smtp?.auth?.user || ''}" placeholder="user@example.com" required />
        </div>
        <div class="form-group">
            <label>SMTP Password</label>
            <input type="password" class="form-control smtp-password" value="${profileData?.smtp?.auth?.pass || ''}" placeholder="Mot de passe" required />
        </div>
        <div class="form-group">
            <label>From Name</label>
            <input type="text" class="form-control from-name" value="${profileData?.from?.name || ''}" placeholder="Nom de l'expéditeur" required />
        </div>
        <div class="form-group">
            <label>From Email</label>
            <input type="email" class="form-control from-email" value="${profileData?.from?.email || ''}" placeholder="email@example.com" required />
        </div>
    `;
    
    container.appendChild(profileDiv);
}

function removeProfile(profileName) {
    const profileDiv = document.querySelector(`[data-profile-name="${profileName}"]`);
    if (profileDiv) {
        profileDiv.remove();
    }
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
            <label>Profil SMTP à utiliser</label>
            <input type="text" class="form-control rule-profile" value="${ruleData?.use_profile || ''}" placeholder="alerts" required />
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
        smtp_profiles: {},
        routing_rules: [],
        collection_name: document.getElementById('collectionName').value || null
    };

    // Collecter les profils SMTP
    document.querySelectorAll('.profile-item').forEach(profileDiv => {
        const profileName = profileDiv.querySelector('.profile-name').value;
        config.smtp_profiles[profileName] = {
            smtp: {
                host: profileDiv.querySelector('.smtp-host').value,
                port: parseInt(profileDiv.querySelector('.smtp-port').value),
                secure: profileDiv.querySelector('.smtp-secure').value === 'true',
                auth: {
                    user: profileDiv.querySelector('.smtp-user').value,
                    pass: profileDiv.querySelector('.smtp-password').value
                }
            },
            from: {
                name: profileDiv.querySelector('.from-name').value,
                email: profileDiv.querySelector('.from-email').value
            }
        };
    });

    // Collecter les règles de routing
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

function saveConfig(e) {
    e.preventDefault();
    
    const config = collectFormData();
    
    // Validation
    if (Object.keys(config.smtp_profiles).length === 0) {
        alert('Veuillez ajouter au moins un profil SMTP');
        return;
    }

    fetch(`${API_BASE_URL}/config/${MODULE_NAME}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${JWT_TOKEN}`
        },
        body: JSON.stringify({ config })
    })
    .then(response => response.json())
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

function testConnections() {
    const config = collectFormData();
    testConnectionsForProfiles(config.smtp_profiles);
}

function testConnectionsForProfiles(profiles) {
    const profilesArr = Object.keys(profiles);
    
    if (profilesArr.length === 0) {
        alert('Veuillez configurer au moins un profil SMTP');
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
    alert(message);
}

// Exposer les fonctions globalement pour les boutons onclick
window.removeProfile = removeProfile;
window.removeRule = removeRule;
window.loadConfigList = loadConfigList;
window.showListMode = showListMode;
window.showFormMode = showFormMode;
window.editConfig = editConfig;
window.testAllConnections = testAllConnections;
</script>

<?php require_once '../../includes/footer.php'; ?>
