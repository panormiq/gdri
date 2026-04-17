<?php
/**
 * Configuration Application Facebook - ADMIN_GDRI uniquement
 * Fichier : pages/modules/facebook-app-config.php
 * 
 * Configuration globale de l'application Facebook (App ID, App Secret)
 * Cette page est réservée aux administrateurs GDRI
 */

require_once '../../config/config.php';
require_once '../../config/database.php';
require_once '../../auth/session.php';
require_once '../../includes/functions.php';
require_once '../../includes/jwt-helper.php';

// Seuls ADMIN_GDRI peuvent accéder
if (!hasRole(ROLE_ADMIN_GDRI)) {
    redirect(url('pages/dashboard.php'));
}

$page_title = 'Configuration Application Facebook';
require_once '../../includes/header.php';

$jwt_token = getJWTToken();
$api_base_url = getApiBaseUrl();
?>

<div class="container" style="max-width: 800px; margin: 2rem auto; padding: 0 1rem;">
    
    <div class="card">
        <div class="card-header">
            <h1>Configuration Application Facebook</h1>
            <p style="margin: 0.5rem 0 0 0; font-size: 0.9em; color: #666;">
                Configurez les identifiants de l'application Facebook pour permettre aux utilisateurs de se connecter à leurs pages Facebook.
            </p>
        </div>
        <div class="card-body">
            
            <div style="padding: 1rem; background-color: #e7f3ff; border-left: 4px solid #2196F3; border-radius: 4px; margin-bottom: 1.5rem;">
                <p style="margin: 0; font-size: 0.9em;">
                    <strong>ℹ️ Configuration globale :</strong> Cette configuration s'applique à toute l'application. 
                    Une fois configurée, tous les utilisateurs autorisés pourront se connecter à leurs pages Facebook.
                </p>
            </div>

            <form id="appConfigForm">
                <div class="form-group">
                    <label for="appId">App ID Facebook <span style="color: red;">*</span></label>
                    <input type="text" class="form-control" id="appId" name="appId" required 
                           placeholder="Votre App ID Facebook" />
                    <small class="form-text text-muted">
                        L'App ID de votre application Facebook. Vous le trouvez dans 
                        <a href="https://developers.facebook.com/apps/" target="_blank">Facebook Developers</a> 
                        → Votre App → Paramètres → De base
                    </small>
                </div>

                <div class="form-group">
                    <label for="appSecret">App Secret Facebook <span style="color: red;">*</span></label>
                    <input type="password" class="form-control" id="appSecret" name="appSecret" required 
                           placeholder="Votre App Secret Facebook" />
                    <small class="form-text text-muted">
                        L'App Secret de votre application Facebook. Vous le trouvez dans 
                        <a href="https://developers.facebook.com/apps/" target="_blank">Facebook Developers</a> 
                        → Votre App → Paramètres → De base → Afficher l'App Secret
                    </small>
                </div>

                <div class="form-group">
                    <label for="redirectUri">Redirect URI</label>
                    <input type="text" class="form-control" id="redirectUri" name="redirectUri" 
                           value="https://www.gdr-innovation.fr/api/facebook/oauth/callback" 
                           readonly style="background-color: #f5f5f5;" />
                    <small class="form-text text-muted">
                        URL de redirection OAuth. Cette URL doit être configurée dans 
                        Facebook Developers → Produits → Facebook Login → Paramètres → URL de redirection OAuth valides
                    </small>
                </div>

                <div class="form-actions" style="margin-top: 1.5rem;">
                    <button type="submit" class="btn btn-primary">
                        💾 Sauvegarder la configuration
                    </button>
                    <button type="button" class="btn btn-outline" id="loadAppConfigBtn">
                        📥 Charger la configuration actuelle
                    </button>
                </div>

                <div id="appConfigMessage" style="margin-top: 1rem;"></div>
            </form>

            <!-- Section Validation des Permissions -->
            <div style="margin-top: 2rem; padding-top: 2rem; border-top: 2px solid #ddd;">
                <h3>🔐 Validation des Permissions Facebook</h3>
                <p style="color: #666; font-size: 0.9em; margin-bottom: 1rem;">
                    Pour que Facebook valide l'utilisation des permissions <code>pages_manage_posts</code> et <code>pages_messaging</code>, 
                    il faut effectuer au moins un appel API utilisant ces permissions.
                </p>
                
                <div style="padding: 1rem; background-color: #e7f3ff; border-left: 4px solid #2196F3; border-radius: 4px; margin-bottom: 1rem;">
                    <p style="margin: 0; font-size: 0.9em;">
                        <strong>ℹ️ Note importante :</strong> Les utilisateurs finaux n'ont <strong>PAS besoin</strong> d'aller sur Facebook Developer.<br>
                        La révision d'app est faite <strong>une seule fois</strong> par l'administrateur. Une fois approuvée, les utilisateurs peuvent autoriser 
                        <code>pages_messaging</code> via OAuth normalement.
                    </p>
                </div>
                
                <button id="validatePermissionsBtn" type="button" class="btn btn-primary" style="margin-bottom: 1rem;">
                    ✅ Valider les permissions pour toutes les pages connectées
                </button>
                
                <div id="validatePermissionsStatus" style="margin-top: 1rem;"></div>
                
                <div style="margin-top: 1.5rem; padding: 1rem; background-color: #fff3cd; border-left: 3px solid #ffc107; border-radius: 4px;">
                    <h4 style="margin: 0 0 0.5rem 0; font-size: 1em;">📋 Comment obtenir la permission pages_messaging</h4>
                    <ol style="margin: 0.5rem 0 0 0; padding-left: 1.5rem; font-size: 0.9em;">
                        <li>Allez sur <a href="https://developers.facebook.com/apps" target="_blank">Facebook Developers</a></li>
                        <li>Allez dans <strong>App Review</strong> → <strong>Permissions and Features</strong></li>
                        <li>Cliquez sur <strong>"Add a Permission"</strong> et recherchez <code>pages_messaging</code></li>
                        <li>Cliquez sur <strong>"Request"</strong> et remplissez le formulaire de demande</li>
                        <li>Attendez l'approbation de Facebook (plusieurs jours à semaines)</li>
                        <li>Une fois approuvée, les utilisateurs pourront autoriser cette permission via OAuth</li>
                    </ol>
                    <p style="margin: 0.5rem 0 0 0; font-size: 0.85em; color: #666;">
                        📖 Guide complet : <code>install/OBTENIR-PERMISSION-PAGES-MESSAGING.md</code>
                    </p>
                </div>
            </div>

            <div style="margin-top: 2rem; padding-top: 2rem; border-top: 1px solid #ddd;">
                <h3>Guide de configuration</h3>
                <ol>
                    <li>Allez sur <a href="https://developers.facebook.com/apps/" target="_blank">Facebook Developers</a></li>
                    <li>Créez une nouvelle application ou sélectionnez une application existante</li>
                    <li>Allez dans <strong>Paramètres</strong> → <strong>De base</strong></li>
                    <li>Copiez l'<strong>App ID</strong> et l'<strong>App Secret</strong></li>
                    <li>Allez dans <strong>Produits</strong> → <strong>Facebook Login</strong> → <strong>Paramètres</strong></li>
                    <li>Ajoutez l'URL de redirection OAuth valide : <code>https://www.gdr-innovation.fr/api/facebook/oauth/callback</code></li>
                    <li>Dans <strong>Autorisations et fonctionnalités</strong>, activez :
                        <ul>
                            <li><code>pages_show_list</code> : Pour lister les pages</li>
                            <li><code>pages_read_engagement</code> : Pour lire les posts et commentaires</li>
                            <li><code>pages_messaging</code> : Pour les messages privés (optionnel, nécessite révision d'app)</li>
                        </ul>
                    </li>
                    <li><strong>Pour activer <code>pages_messaging</code> :</strong>
                        <ul>
                            <li>Allez dans <strong>App Review</strong> → <strong>Permissions and Features</strong></li>
                            <li>Demandez la permission <code>pages_messaging</code></li>
                            <li>Une fois approuvée, mettez à jour les scopes OAuth dans le code (voir <code>backend/modules/facebook/routes.js</code>)</li>
                        </ul>
                    </li>
                    <li>Sauvegardez la configuration ci-dessus</li>
                </ol>
            </div>

        </div>
    </div>

</div>

<script>
const API_BASE = '<?= $api_base_url ?>';
const JWT = '<?= $jwt_token ?>';

// Charger la configuration
async function loadAppConfig() {
    try {
        const res = await fetch(`${API_BASE}/facebook/app-config`, {
            headers: { 'Authorization': `Bearer ${JWT}` }
        });
        const data = await res.json();
        
        if (data.success && data.config) {
            document.getElementById('appId').value = data.config.appId || '';
            document.getElementById('appSecret').value = '';
            if (data.config.appSecret && data.config.appSecret.startsWith('***')) {
                document.getElementById('appSecret').placeholder = 'App Secret déjà configuré (masqué)';
            }
            document.getElementById('redirectUri').value = data.config.redirectUri || 'https://www.gdr-innovation.fr/api/facebook/oauth/callback';
            
            if (data.configured) {
                showMessage('✅ Configuration chargée. Le secret est masqué pour des raisons de sécurité.', 'success');
            }
        }
    } catch (e) {
        console.error('Erreur:', e);
        showMessage('❌ Erreur lors du chargement de la configuration', 'error');
    }
}

// Sauvegarder la configuration
document.getElementById('appConfigForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const appId = document.getElementById('appId').value.trim();
    const appSecret = document.getElementById('appSecret').value.trim();
    const redirectUri = document.getElementById('redirectUri').value.trim();
    
    if (!appId || !appSecret) {
        showMessage('❌ Veuillez remplir l\'App ID et l\'App Secret', 'error');
        return;
    }
    
    showMessage('💾 Sauvegarde en cours...', 'info');
    
    try {
        const res = await fetch(`${API_BASE}/facebook/app-config`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${JWT}`
            },
            body: JSON.stringify({
                appId: appId,
                appSecret: appSecret,
                redirectUri: redirectUri || 'https://www.gdr-innovation.fr/api/facebook/oauth/callback'
            })
        });
        
        const data = await res.json();
        
        if (data.success) {
            showMessage('✅ Configuration sauvegardée avec succès !', 'success');
            document.getElementById('appSecret').value = '';
            document.getElementById('appSecret').placeholder = 'App Secret sauvegardé (masqué)';
        } else {
            showMessage('❌ Erreur : ' + (data.message || 'Impossible de sauvegarder la configuration'), 'error');
        }
    } catch (e) {
        showMessage('❌ Erreur : ' + e.message, 'error');
    }
});

// Afficher un message
function showMessage(text, type) {
    const msgDiv = document.getElementById('appConfigMessage');
    msgDiv.textContent = text;
    msgDiv.style.display = 'block';
    
    if (type === 'success') {
        msgDiv.style.color = '#28a745';
        msgDiv.style.backgroundColor = '#d4edda';
        msgDiv.style.border = '1px solid #28a745';
    } else if (type === 'error') {
        msgDiv.style.color = '#dc3545';
        msgDiv.style.backgroundColor = '#f8d7da';
        msgDiv.style.border = '1px solid #dc3545';
    } else {
        msgDiv.style.color = '#666';
        msgDiv.style.backgroundColor = '#f8f9fa';
        msgDiv.style.border = '1px solid #ddd';
    }
    
    msgDiv.style.padding = '12px';
    msgDiv.style.borderRadius = '4px';
    msgDiv.style.marginTop = '1rem';
}

// Bouton charger
document.getElementById('loadAppConfigBtn').addEventListener('click', loadAppConfig);

// Valider les permissions Facebook (déclencher les appels API)
document.getElementById('validatePermissionsBtn')?.addEventListener('click', async function() {
    this.disabled = true;
    this.textContent = '⏳ Validation en cours...';
    const statusDiv = document.getElementById('validatePermissionsStatus');
    statusDiv.innerHTML = '<div style="padding: 1rem; background-color: #e7f3ff; border-radius: 4px;">⏳ Validation des permissions en cours...</div>';
    
    try {
        const res = await fetch(`${API_BASE}/facebook/pages/validate-permissions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${JWT}`
            },
            body: JSON.stringify({}) // Valider toutes les pages
        });
        
        const contentType = res.headers.get('content-type');
        let data;
        if (contentType && contentType.includes('application/json')) {
            data = await res.json();
        } else {
            const text = await res.text();
            throw new Error(`Réponse non-JSON: ${text.substring(0, 200)}`);
        }
        
        if (data.success) {
            let html = `<div style="padding: 1rem; background-color: #d4edda; border: 1px solid #28a745; border-radius: 4px; margin-bottom: 1rem;">
                <strong>✅ ${data.message}</strong>
            </div>`;
            html += '<div style="margin-top: 1rem;"><strong>Détails par page :</strong><ul style="margin-top: 0.5rem; list-style: none; padding: 0;">';
            
            data.results.forEach(result => {
                const managePostsStatus = result.pages_manage_posts.success ? '✅' : '❌';
                const messagingStatus = result.pages_messaging.success ? '✅' : '⚠️';
                const pageStatus = result.success ? '✅' : '⚠️';
                
                // Gérer le cas spécial de pages_messaging qui nécessite une révision
                let messagingMessage = '';
                if (result.pages_messaging.success) {
                    messagingMessage = '✅ OK';
                } else if (result.pages_messaging.requiresReview) {
                    messagingMessage = `<span style="color: #856404;">
                        ⚠️ Permission non approuvée - Nécessite une révision d'app par Facebook<br>
                        <small style="margin-left: 1.5rem; display: block; margin-top: 0.25rem;">
                            📋 <a href="https://developers.facebook.com/apps" target="_blank" style="color: #1877f2;">Demander la permission dans Facebook Developer</a>
                        </small>
                    </span>`;
                } else {
                    messagingMessage = '❌ ' + (result.pages_messaging.error || 'Échec');
                }
                
                html += `<li style="margin-bottom: 0.75rem; padding: 0.75rem; background-color: #f8f9fa; border-radius: 4px;">
                    <strong>${result.pageName || result.pageId}</strong> ${pageStatus}<br>
                    <span style="margin-left: 1rem; font-size: 0.9em; display: block; margin-top: 0.5rem;">
                        ${managePostsStatus} <strong>pages_manage_posts</strong>: ${result.pages_manage_posts.success ? '✅ OK' : '❌ ' + (result.pages_manage_posts.error || 'Échec')}<br>
                        ${messagingStatus} <strong>pages_messaging</strong>: ${messagingMessage}
                    </span>
                </li>`;
            });
            
            html += '</ul></div>';
            statusDiv.innerHTML = html;
        } else {
            statusDiv.innerHTML = `<div style="padding: 1rem; background-color: #f8d7da; border: 1px solid #dc3545; border-radius: 4px;">
                ❌ Erreur : ${data.message || 'Erreur lors de la validation'}
            </div>`;
        }
    } catch (e) {
        console.error('Erreur validation permissions:', e);
        statusDiv.innerHTML = `<div style="padding: 1rem; background-color: #f8d7da; border: 1px solid #dc3545; border-radius: 4px;">
            ❌ Erreur : ${e.message}
        </div>`;
    } finally {
        this.disabled = false;
        this.textContent = '✅ Valider les permissions pour toutes les pages connectées';
    }
});

// Charger au démarrage
loadAppConfig();
</script>

<?php require_once '../../includes/footer.php'; ?>
