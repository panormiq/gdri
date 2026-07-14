<?php
/**
 * Configuration Facebook - Connexion simple
 */

require_once '../../config/config.php';
require_once '../../auth/session.php';
require_once '../../includes/functions.php';
require_once '../../includes/jwt-helper.php';
require_once '../../includes/entity-console-nav.php';

function apiGetNoAuth($url)
{
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 20);
    $raw = curl_exec($ch);
    $err = curl_error($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    if ($err || $code < 200 || $code >= 300) {
        return null;
    }
    $decoded = json_decode((string) $raw, true);
    return is_array($decoded) ? $decoded : null;
}

function hasFacebookServiceAccessViaApi()
{
    if (hasRole(ROLE_ADMIN_GDRI) || hasRole(ROLE_ADMIN_ENTITY)) {
        return true;
    }
    if (!hasRole(ROLE_USER_ENTITY)) {
        return false;
    }
    $token = getJWTToken();
    $apiBase = rtrim(getApiBaseUrl(), '/');
    if (!$token || !$apiBase) {
        return false;
    }
    $ch = curl_init($apiBase . '/users/me/services-context');
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Authorization: Bearer ' . $token,
        'Content-Type: application/json'
    ]);
    curl_setopt($ch, CURLOPT_TIMEOUT, 20);
    $raw = curl_exec($ch);
    $err = curl_error($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    if ($err || $code < 200 || $code >= 300) {
        return false;
    }
    $decoded = json_decode((string) $raw, true);
    $services = is_array($decoded['data']['services'] ?? null) ? $decoded['data']['services'] : [];
    foreach ($services as $service) {
        $slug = strtolower(trim((string) ($service['slug'] ?? '')));
        $name = strtolower(trim((string) ($service['name'] ?? '')));
        if ($slug === 'facebook' || strpos($name, 'facebook') !== false) {
            return true;
        }
    }
    return false;
}

// Vérifier si l'utilisateur est toujours connecté après la redirection OAuth
if (!isLoggedIn()) {
    // Vérifier si un token de réauthentification est présent dans l'URL
    $reauthToken = $_GET['reauth'] ?? null;
    
    if ($reauthToken) {
        $apiBase = rtrim(getApiBaseUrl(), '/');
        $reauthUrl = $apiBase . '/facebook/oauth/reauth?token=' . urlencode($reauthToken);
        $reauth = apiGetNoAuth($reauthUrl);
        if (!empty($reauth['success']) && !empty($reauth['data'])) {
            $data = $reauth['data'];
            $_SESSION['user_id'] = (string) ($data['userId'] ?? '');
            $_SESSION['user_role'] = (string) ($data['role'] ?? 'USER_ENTITY');
            $_SESSION['user_email'] = (string) ($data['email'] ?? '');
            $sessionEntrepriseId = (string) ($data['entrepriseId'] ?? '');
            if ($sessionEntrepriseId !== '') {
                $_SESSION['entrepriseId'] = $sessionEntrepriseId;
                $_SESSION['currentEntrepriseId'] = $sessionEntrepriseId;
            }

            // Recharger la page sans le token pour éviter sa réutilisation
            $cleanUrl = strtok($_SERVER['REQUEST_URI'], '?');
            $params = $_GET;
            unset($params['reauth']);
            if (!empty($params)) {
                $cleanUrl .= '?' . http_build_query($params);
            }
            redirect($cleanUrl);
        }
    }
    
    // Si pas de token valide, rediriger vers le dashboard
    $_SESSION['oauth_redirect_message'] = 'Votre session a expiré pendant la connexion Facebook. Veuillez vous reconnecter et réessayer.';
    redirect(url('pages/dashboard.php'));
}

// Vérifier les droits une fois la session active
$hasAccess = hasFacebookServiceAccessViaApi();

if (!$hasAccess) {
    redirect(url('pages/dashboard.php'));
}

$jwt_token = getJWTToken();
$api_base_url = getApiBaseUrl();

$error = $_GET['error'] ?? null;
$success = $_GET['success'] ?? null;
$state = $_GET['state'] ?? null;
$step = $_GET['step'] ?? null;

$page_title = 'Configuration Facebook';
require_once '../../includes/header.php';
renderConsoleLayoutStart(
    'Configuration Facebook',
    'Connexion OAuth et gestion des pages Facebook de l\'entité.',
    ['narrow' => true]
);
?>

    <!-- Messages -->
    <?php if ($error): ?>
    <div class="alert <?= in_array($error, ['all_pages_already_connected'], true) ? 'alert-info' : 'alert-danger' ?>">
        <?php if ($error === 'all_pages_already_connected'): ?>
            <strong>ℹ️ Toutes vos pages sont déjà connectées.</strong><br>
            Vous pouvez les gérer ci-dessous (webhooks, publication, messages).
        <?php elseif ($error === 'no_pages'): ?>
            <strong>❌ Aucune page Facebook trouvée.</strong><br>
            Le compte Facebook connecté ne gère aucune page, ou vous n’avez pas le rôle nécessaire. Pour utiliser ce module, connectez-vous avec un compte qui est <strong>administrateur</strong> ou <strong>éditeur</strong> d’au moins une page Facebook. Si vous n’avez pas encore de page, créez-en une sur <a href="https://www.facebook.com/pages/creation/" target="_blank" rel="noopener">facebook.com/pages/creation</a>.
        <?php elseif ($error === 'missing_params'): ?>
            <strong>Connexion annulée ou incomplète.</strong><br>
            Facebook n'a pas renvoyé les informations attendues. Recommencez en cliquant sur « Se connecter avec Facebook ».
        <?php elseif ($error === 'invalid_state'): ?>
            <strong>Session de connexion invalide.</strong><br>
            Le lien de retour ne correspond plus à la demande. Recommencez en cliquant sur « Se connecter avec Facebook ».
        <?php elseif ($error === 'expired_state'): ?>
            <strong>Connexion expirée.</strong><br>
            La demande a pris trop de temps. Recliquez sur « Se connecter avec Facebook ».
        <?php elseif ($error === 'no_token_received'): ?>
            <strong>Facebook n'a pas autorisé l'accès.</strong><br>
            Aucun jeton reçu. Vérifiez d'avoir accepté toutes les autorisations, puis réessayez.
        <?php else: ?>
            <strong>Erreur lors de la connexion Facebook.</strong><br>
            <?= htmlspecialchars($error) ?>. Réessayez ou contactez le support si le problème persiste.
        <?php endif; ?>
    </div>
    <?php endif; ?>
    
    <?php if ($success === 'connected'): ?>
    <div class="alert alert-success">
        ✅ Connexion réussie !
    </div>
    <?php endif; ?>

    <!-- Configuration des Webhooks (si connecté) -->
    <div id="webhookConfigSection" class="card" style="display: none; margin-bottom: 2rem;">
        <div class="card-header">
            <h2>📡 Configuration des Webhooks</h2>
            <div id="tokenHealthBanner" style="display:none; margin-top: 0.75rem;"></div>
            <p style="margin: 0.5rem 0 0 0; font-size: 0.9em; color: #666;">
                Sélectionnez les types d'événements Facebook que vous souhaitez recevoir pour chaque page
            </p>
        </div>
        <div class="card-body">
            <!-- Message si aucune page -->
            <div id="noPagesMessage" class="alert alert-info" style="display: none;">
                Vous n'avez pas encore connecté de pages Facebook. Veuillez vous connecter ci-dessus.
            </div>
            
            <!-- Onglets pour les pages -->
            <div id="pagesTabs" style="display: none; margin-bottom: 1.5rem;">
                <div style="display: flex; gap: 0.5rem; border-bottom: 2px solid #e0e0e0; flex-wrap: wrap; margin-bottom: 1.5rem;">
                    <!-- Les onglets seront générés dynamiquement -->
                </div>
            </div>
            
            <style>
                .page-tab {
                    padding: 0.75rem 1.5rem;
                    border: none;
                    background: transparent;
                    border-bottom: 3px solid transparent;
                    cursor: pointer;
                    font-weight: 500;
                    color: #666;
                    transition: all 0.2s;
                    border-radius: 4px 4px 0 0;
                }
                .page-tab:hover {
                    color: #1877f2;
                    background-color: #f0f8ff;
                }
                .page-tab.active {
                    border-bottom-color: #1877f2;
                    color: #1877f2;
                }
                .webhook-tab-content {
                    animation: fadeIn 0.3s ease-in;
                }
                .token-status-badge {
                    font-size: 11px;
                    padding: 2px 8px;
                    border-radius: 999px;
                    margin-left: 6px;
                    vertical-align: middle;
                    display: inline-block;
                }
                .token-status-ok {
                    background: #e8f5e9;
                    color: #1b5e20;
                    border: 1px solid #c8e6c9;
                }
                .token-status-reauth {
                    background: #fdecea;
                    color: #842029;
                    border: 1px solid #f5c2c7;
                }
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            </style>
            
            <!-- Contenu des onglets (webhooks par page) -->
            <div id="webhookTabsContent">
                <!-- Le contenu sera généré dynamiquement -->
            </div>
            
            <!-- Formulaire de webhooks (template caché) -->
            <form id="webhookConfigForm" style="display: none;">
                <div style="margin-bottom: 1.5rem;">
                    <h3 style="margin-bottom: 1rem;">Événements disponibles</h3>
                    
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1rem;">
                        <!-- Feed (Posts et commentaires) -->
                        <label style="display: flex; align-items: start; padding: 1rem; border: 2px solid #e0e0e0; border-radius: 8px; cursor: pointer; transition: all 0.2s;" 
                               onmouseover="this.style.borderColor='#1877f2'; this.style.backgroundColor='#f0f8ff';" 
                               onmouseout="this.style.borderColor='#e0e0e0'; this.style.backgroundColor='transparent';">
                            <input type="checkbox" name="webhooks[]" value="feed" id="webhook_feed" style="margin-right: 0.75rem; margin-top: 0.25rem; cursor: pointer;">
                            <div>
                                <strong style="display: block; margin-bottom: 0.25rem;">📝 Feed</strong>
                                <span style="font-size: 0.9em; color: #666;">Posts et commentaires sur la page</span>
                            </div>
                        </label>
                        
                        <!-- Mentions -->
                        <label style="display: flex; align-items: start; padding: 1rem; border: 2px solid #e0e0e0; border-radius: 8px; cursor: pointer; transition: all 0.2s;" 
                               onmouseover="this.style.borderColor='#1877f2'; this.style.backgroundColor='#f0f8ff';" 
                               onmouseout="this.style.borderColor='#e0e0e0'; this.style.backgroundColor='transparent';">
                            <input type="checkbox" name="webhooks[]" value="mention" id="webhook_mention" style="margin-right: 0.75rem; margin-top: 0.25rem; cursor: pointer;">
                            <div>
                                <strong style="display: block; margin-bottom: 0.25rem;">🏷️ Mentions</strong>
                                <span style="font-size: 0.9em; color: #666;">Mentions de la page dans des posts/commentaires</span>
                            </div>
                        </label>
                        
                        <!-- Messages privés -->
                        <label style="display: flex; align-items: start; padding: 1rem; border: 2px solid #e0e0e0; border-radius: 8px; cursor: pointer; transition: all 0.2s;" 
                               onmouseover="this.style.borderColor='#1877f2'; this.style.backgroundColor='#f0f8ff';" 
                               onmouseout="this.style.borderColor='#e0e0e0'; this.style.backgroundColor='transparent';">
                            <input type="checkbox" name="webhooks[]" value="messages" id="webhook_messages" style="margin-right: 0.75rem; margin-top: 0.25rem; cursor: pointer;">
                            <div>
                                <strong style="display: block; margin-bottom: 0.25rem;">💬 Messages</strong>
                                <span style="font-size: 0.9em; color: #666;">Messages privés reçus sur la page</span>
                                <div style="margin-top: 0.5rem; padding: 0.75rem; background-color: #fff3cd; border-radius: 4px; font-size: 0.85em; color: #856404; border-left: 3px solid #ffc107;">
                                    <strong>⚠️ Permission avancée</strong><br>
                                    <span style="display: block; margin-top: 0.25rem;">
                                        La permission <code>pages_messaging</code> nécessite une révision d'app par Facebook.<br>
                                        <strong style="color: #1877f2;">Si cette permission n'est pas encore disponible, contactez votre administrateur.</strong>
                                    </span>
                                </div>
                            </div>
                        </label>
                    </div>
                    
                    <!-- Webhooks supplémentaires (pour l'avenir) -->
                    <details style="margin-top: 1.5rem; padding: 1rem; background-color: #f8f9fa; border-radius: 8px;">
                        <summary style="cursor: pointer; font-weight: bold; color: #666; user-select: none;">
                            📋 Autres webhooks disponibles (optionnels)
                        </summary>
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1rem; margin-top: 1rem;">
                            <label style="display: flex; align-items: start; padding: 0.75rem; border: 1px solid #ddd; border-radius: 6px; cursor: pointer;">
                                <input type="checkbox" name="webhooks[]" value="messaging_postbacks" id="webhook_messaging_postbacks" style="margin-right: 0.5rem; margin-top: 0.25rem;">
                                <div>
                                    <strong style="display: block; font-size: 0.9em;">Postbacks</strong>
                                    <span style="font-size: 0.85em; color: #666;">Postbacks de messages</span>
                                </div>
                            </label>
                            <label style="display: flex; align-items: start; padding: 0.75rem; border: 1px solid #ddd; border-radius: 6px; cursor: pointer;">
                                <input type="checkbox" name="webhooks[]" value="messaging_referrals" id="webhook_messaging_referrals" style="margin-right: 0.5rem; margin-top: 0.25rem;">
                                <div>
                                    <strong style="display: block; font-size: 0.9em;">Références</strong>
                                    <span style="font-size: 0.85em; color: #666;">Références de messages</span>
                                </div>
                            </label>
                            <label style="display: flex; align-items: start; padding: 0.75rem; border: 1px solid #ddd; border-radius: 6px; cursor: pointer;">
                                <input type="checkbox" name="webhooks[]" value="messaging_reactions" id="webhook_messaging_reactions" style="margin-right: 0.5rem; margin-top: 0.25rem;">
                                <div>
                                    <strong style="display: block; font-size: 0.9em;">Réactions</strong>
                                    <span style="font-size: 0.85em; color: #666;">Réactions aux messages</span>
                                </div>
                            </label>
                        </div>
                    </details>
                </div>
                
                <div style="padding: 1rem; background-color: #e7f3ff; border-left: 4px solid #2196F3; border-radius: 4px; margin-bottom: 1.5rem;">
                    <p style="margin: 0; font-size: 0.9em;">
                        <strong>ℹ️ Note :</strong> Les webhooks sélectionnés seront automatiquement activés pour votre page Facebook connectée.
                    </p>
                </div>
                
                <button type="submit" class="btn btn-primary" id="saveWebhooksBtn">
                    💾 Enregistrer les préférences
                </button>
                <div id="webhookSaveStatus" style="margin-top: 1rem;"></div>
            </form>
        </div>
    </div>

    <!-- Connexion Facebook / Module principal -->
    <div class="card">
        <div class="card-header">
            <h2>Connexion Facebook</h2>
        </div>
        <div class="card-body">
            <p style="margin-bottom: 1rem; font-size: 0.95em; color: #555;">
                Avec ce module, vous pouvez :
            </p>
            <ul style="margin-top: 0; margin-bottom: 1.5rem; padding-left: 1.25rem; font-size: 0.95em; color: #555;">
                <li>Connecter votre compte et vos pages Facebook</li>
                <li>Configurer l'agent IA pour analyser les messages et commentaires</li>
                <li>Publier un post sur votre page pour valider la permission <code>pages_manage_posts</code></li>
            </ul>
            
            <!-- État actuel -->
            <div id="currentConfig" style="display: none;">
                <p><strong>Page connectée :</strong> <span id="currentPageName">-</span></p>
                <p><strong>Page ID :</strong> <span id="currentPageId">-</span></p>
                <button type="button" class="btn btn-outline btn-sm" id="disconnectBtn">Déconnecter</button>
            </div>

            <!-- Bouton connexion -->
            <div id="connectSection">
                <p id="connectSectionText">Connectez votre compte Facebook pour autoriser l'accès à vos pages.</p>
                <div id="appIdNotConfigured" style="display: none; padding: 1rem; background-color: #fff3cd; border: 1px solid #ffc107; border-radius: 4px; margin-bottom: 1rem;">
                    <strong>⚠️ Configuration requise</strong>
                    <p style="margin: 0.5rem 0 0 0; font-size: 0.9em;">
                        <?php if (hasRole(ROLE_ADMIN_GDRI)): ?>
                            L'App ID Facebook n'est pas configuré. <strong>En tant qu'administrateur GDRI</strong>, veuillez 
                            <a href="<?= url('pages/modules/facebook-app-config.php') ?>" style="color: #007bff; text-decoration: underline;">configurer l'application Facebook</a> 
                            (configuration globale).
                        <?php else: ?>
                            L'App ID Facebook n'est pas configuré. <strong>Seul un administrateur GDRI</strong> peut configurer l'application Facebook. 
                            Veuillez contacter un administrateur GDRI pour configurer l'App ID et l'App Secret.
                        <?php endif; ?>
                    </p>
                </div>
                <div style="display: flex; gap: 1rem; flex-wrap: wrap;">
                    <button type="button" class="btn btn-primary btn-lg" id="connectBtn">
                        Se connecter avec Facebook
                    </button>
                    <button type="button" class="btn btn-outline btn-lg" id="refreshPagesBtn" style="display: none;">
                        🔄 Actualiser les pages disponibles
                    </button>
                    <button type="button" class="btn btn-outline btn-lg" onclick="window.location.href='<?= url('pages/modules/analyse-intention-config.php') ?>'">
                        🤖 Configurer l'agent IA
                    </button>
                </div>
                <p style="margin-top: 1rem; font-size: 0.9em; color: #666;">
                    ⚠️ Vous serez redirigé vers Facebook pour vous connecter avec votre compte Facebook personnel.
                </p>
            </div>

            <!-- Configuration des pages après OAuth -->
            <div id="pagesConfiguration" style="display: none;">
                <div class="card">
                    <div class="card-header">
                        <h2>📘 Configuration des Pages Facebook</h2>
                        <p style="margin: 0.5rem 0 0 0; font-size: 0.9em; color: #666;">
                            Sélectionnez les webhooks pour chaque page que vous souhaitez connecter
                        </p>
                    </div>
                    <div class="card-body">
                        <!-- Onglets pour les pages -->
                        <div id="oauthPagesTabs" style="margin-bottom: 1.5rem;">
                            <div style="display: flex; gap: 0.5rem; border-bottom: 2px solid #e0e0e0; flex-wrap: wrap; margin-bottom: 1.5rem;">
                                <!-- Les onglets seront générés dynamiquement -->
                            </div>
                        </div>
                        
                        <!-- Contenu des onglets -->
                        <div id="oauthPagesContent">
                            <!-- Le contenu sera généré dynamiquement -->
                        </div>
                        
                        <div style="margin-top: 2rem; padding-top: 2rem; border-top: 2px solid #e0e0e0;">
                            <button type="button" class="btn btn-primary btn-lg" id="saveAllPagesBtn">
                                💾 Sauvegarder toutes les pages sélectionnées
                            </button>
                            <div id="saveAllPagesStatus" style="margin-top: 1rem;"></div>
                        </div>
                    </div>
                </div>
            </div>


        </div>
    </div>

<?php renderConsoleLayoutEnd(); ?>

<script>
const API_BASE = '<?= $api_base_url ?>';
const JWT = '<?= $jwt_token ?>';

function getTokenStatusBadge(page) {
    const status = page && page.tokenStatus ? String(page.tokenStatus) : 'active';
    if (status === 'reauth_required') {
        const err = page && page.tokenLastError ? `<div style="font-size:12px;color:#842029;margin-top:4px;">${escapeHtml(page.tokenLastError)}</div>` : '';
        return `<span class="token-status-badge token-status-reauth">🔒 Reconnexion requise</span>${err}`;
    }
    return `<span class="token-status-badge token-status-ok">✅ Token actif</span>`;
}

function pageTitleWithTokenStatus(page) {
    const name = escapeHtml(page.pageName || page.pageId || 'Page');
    return `${name} ${getTokenStatusBadge(page)}`;
}

// Petite fonction utilitaire pour échapper le HTML dans les messages
function escapeHtml(str) {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// Messages (alert uniquement pour les erreurs non déjà explicitées dans le bloc HTML)
<?php if ($error && $error !== 'no_pages' && $error !== 'all_pages_already_connected'): ?>
alert('Erreur : <?= addslashes($error) ?>');
<?php endif; ?>

// Vérifier si App ID est configuré
async function checkAppConfig() {
    try {
        const res = await fetch(`${API_BASE}/facebook/oauth/login`, {
            headers: { 'Authorization': `Bearer ${JWT}` }
        });
        const data = await res.json();
        
        if (!data.success && data.message && data.message.includes('FACEBOOK_APP_ID non configuré')) {
            const msgDiv = document.getElementById('appIdNotConfigured');
            if (msgDiv) {
                msgDiv.style.display = 'block';
            }
            const btn = document.getElementById('connectBtn');
            if (btn) {
                btn.disabled = true;
                btn.style.opacity = '0.5';
                btn.style.cursor = 'not-allowed';
            }
        } else {
            const msgDiv = document.getElementById('appIdNotConfigured');
            if (msgDiv) {
                msgDiv.style.display = 'none';
            }
            const btn = document.getElementById('connectBtn');
            if (btn) {
                btn.disabled = false;
                btn.style.opacity = '1';
                btn.style.cursor = 'pointer';
            }
        }
    } catch (e) {
        console.error('Erreur vérification App ID:', e);
    }
}

// Charger config actuelle
async function loadConfig() {
    try {
        const res = await fetch(`${API_BASE}/facebook/config`, {
            headers: { 'Authorization': `Bearer ${JWT}` }
        });
        const data = await res.json();
        
        console.log('📊 loadConfig() - Réponse API:', data);
        
        // Vérifier si des pages sont connectées
        const hasPages = data.success && data.pages && data.pages.length > 0;
        
        console.log('📊 loadConfig() - hasPages:', hasPages, 'pages:', data.pages);
        
        if (hasPages) {
            // Pages connectées : afficher la configuration des webhooks
            // Mais garder le bouton de connexion visible pour ajouter d'autres pages
            document.getElementById('connectSection').style.display = 'block';
            const connectText = document.getElementById('connectSectionText');
            if (connectText) {
                connectText.textContent = `📘 ${data.pages.length} page(s) connectée(s). Vous pouvez ajouter d'autres pages.`;
            }
            // Afficher le bouton "Actualiser" si des pages sont déjà connectées
            const refreshBtn = document.getElementById('refreshPagesBtn');
            if (refreshBtn) {
                refreshBtn.style.display = 'inline-block';
            }
            document.getElementById('pagesConfiguration').style.display = 'none'; // Section OAuth uniquement
            document.getElementById('webhookConfigSection').style.display = 'block';
            
            // Mettre à jour les infos de la page principale si disponible
            if (data.data && data.data.pageId) {
                document.getElementById('currentPageId').textContent = data.data.pageId;
                document.getElementById('currentPageName').textContent = data.data.pageName || '-';
                document.getElementById('currentConfig').style.display = 'block';
            } else {
                document.getElementById('currentConfig').style.display = 'none';
            }
            
            // Créer les onglets et formulaires pour les pages déjà connectées
            await loadPagesWithWebhooks(data.pages);
            const tokenBanner = document.getElementById('tokenHealthBanner');
            const reauthPages = (data.pages || []).filter(p => p.tokenStatus === 'reauth_required');
            if (tokenBanner) {
                if (reauthPages.length > 0) {
                    tokenBanner.style.display = 'block';
                    tokenBanner.innerHTML = `<div class="alert alert-danger" style="margin-bottom:0;">
                        ⚠️ ${reauthPages.length} page(s) nécessite(nt) une reconnexion Facebook. Cliquez sur <strong>Se connecter avec Facebook</strong> pour réactiver les tokens.
                    </div>`;
                } else {
                    tokenBanner.style.display = 'none';
                    tokenBanner.innerHTML = '';
                }
            }
        } else {
            // Aucune page connectée : afficher la section de connexion
            document.getElementById('connectSection').style.display = 'block';
            document.getElementById('pagesConfiguration').style.display = 'none';
            document.getElementById('webhookConfigSection').style.display = 'none';
            document.getElementById('currentConfig').style.display = 'none';
            const tokenBanner = document.getElementById('tokenHealthBanner');
            if (tokenBanner) {
                tokenBanner.style.display = 'none';
                tokenBanner.innerHTML = '';
            }
            
            // Vérifier si App ID est configuré
            await checkAppConfig();
        }
    } catch (e) {
        console.error('Erreur:', e);
        // En cas d'erreur, afficher la section de connexion
        document.getElementById('connectSection').style.display = 'block';
        document.getElementById('pagesConfiguration').style.display = 'none';
        document.getElementById('webhookConfigSection').style.display = 'none';
    }
}

// Charger les pages avec leurs webhooks et créer les onglets
async function loadPagesWithWebhooks(pages) {
    // Vérifier que les éléments nécessaires existent
    const noPagesMessage = document.getElementById('noPagesMessage');
    const pagesTabs = document.getElementById('pagesTabs');
    const tabsContainer = document.querySelector('#pagesTabs > div');
    const contentContainer = document.getElementById('webhookTabsContent');
    
    if (!pagesTabs || !contentContainer) {
        console.error('❌ Éléments DOM manquants pour loadPagesWithWebhooks');
        return;
    }
    
    if (!pages || pages.length === 0) {
        if (noPagesMessage) {
            noPagesMessage.style.display = 'block';
        }
        return;
    }
    
    if (noPagesMessage) {
        noPagesMessage.style.display = 'none';
    }
    
    // Si une seule page, pas besoin d'onglets
    if (pages.length === 1) {
        if (pagesTabs) {
            pagesTabs.style.display = 'none';
        }
        // Vérifier si le formulaire existe déjà
        const existingForm = contentContainer.querySelector(`form[data-page-id="${pages[0].pageId}"]`);
        if (!existingForm) {
            contentContainer.innerHTML = '';
            await createWebhookFormForPage(pages[0], contentContainer, true);
        } else {
            // Mettre à jour les webhooks sélectionnés
            await loadWebhooksForPage(pages[0].pageId);
        }
    } else {
        // Plusieurs pages : créer des onglets
        if (pagesTabs) {
            pagesTabs.style.display = 'block';
        }
        
        if (!tabsContainer) {
            console.error('❌ tabsContainer non trouvé');
            return;
        }
        
        // Ne réinitialiser que si les onglets n'existent pas encore
        const existingTabs = tabsContainer.querySelectorAll('.page-tab');
        const shouldRecreate = existingTabs.length === 0;
        
        if (shouldRecreate) {
            // Première création : créer tous les onglets
            pages.forEach((page, index) => {
                const pageId = page.pageId;
                
                // Créer l'onglet
                const tab = document.createElement('button');
                tab.type = 'button';
                tab.className = 'page-tab';
                tab.dataset.pageId = pageId;
                tab.innerHTML = pageTitleWithTokenStatus(page);
                
                if (index === 0) {
                    tab.classList.add('active');
                }
                
                tab.addEventListener('click', () => {
                    // Activer l'onglet
                    document.querySelectorAll('#pagesTabs .page-tab').forEach(t => {
                        t.classList.remove('active');
                    });
                    tab.classList.add('active');
                    
                    // Afficher le contenu correspondant
                    document.querySelectorAll('.webhook-tab-content').forEach(c => {
                        c.style.display = 'none';
                    });
                    const content = document.getElementById(`webhook-content-${pageId}`);
                    if (content) content.style.display = 'block';
                });
                
                tabsContainer.appendChild(tab);
                
                // Créer le contenu de l'onglet
                const contentDiv = document.createElement('div');
                contentDiv.id = `webhook-content-${pageId}`;
                contentDiv.className = 'webhook-tab-content';
                contentDiv.style.display = index === 0 ? 'block' : 'none';
                contentContainer.appendChild(contentDiv);
                
                createWebhookFormForPage(page, contentDiv, false);
            });
        } else {
            // Les onglets existent déjà : juste mettre à jour les webhooks pour chaque page
            pages.forEach((page) => {
                const pageId = page.pageId;
                const existingTab = tabsContainer.querySelector(`.page-tab[data-page-id="${pageId}"]`);
                const existingContent = document.getElementById(`webhook-content-${pageId}`);
                
                // Si l'onglet n'existe pas, le créer
                if (!existingTab || !existingContent) {
                    // Créer l'onglet manquant
                    const tab = document.createElement('button');
                    tab.type = 'button';
                    tab.className = 'page-tab';
                    tab.dataset.pageId = pageId;
                    tab.textContent = page.pageName || page.pageId;
                    
                    tab.addEventListener('click', () => {
                        document.querySelectorAll('#pagesTabs .page-tab').forEach(t => {
                            t.classList.remove('active');
                        });
                        tab.classList.add('active');
                        document.querySelectorAll('.webhook-tab-content').forEach(c => {
                            c.style.display = 'none';
                        });
                        const content = document.getElementById(`webhook-content-${pageId}`);
                        if (content) content.style.display = 'block';
                    });
                    
                    tabsContainer.appendChild(tab);
                    
                    const contentDiv = document.createElement('div');
                    contentDiv.id = `webhook-content-${pageId}`;
                    contentDiv.className = 'webhook-tab-content';
                    contentDiv.style.display = 'none';
                    contentContainer.appendChild(contentDiv);
                    
                    createWebhookFormForPage(page, contentDiv, false);
                } else {
                    // Mettre à jour le texte de l'onglet si nécessaire
                    const desired = pageTitleWithTokenStatus(page);
                    if (existingTab.innerHTML !== desired) {
                        existingTab.innerHTML = desired;
                    }
                    // Mettre à jour les webhooks sélectionnés (sans recréer le formulaire)
                    loadWebhooksForPage(pageId);
                }
            });
            
            // Supprimer uniquement les onglets qui n'existent plus
            const currentPageIds = new Set(pages.map(p => p.pageId));
            tabsContainer.querySelectorAll('.page-tab').forEach(tab => {
                if (!currentPageIds.has(tab.dataset.pageId)) {
                    tab.remove();
                    const content = document.getElementById(`webhook-content-${tab.dataset.pageId}`);
                    if (content) content.remove();
                }
            });
        }
    }
}

// Créer le formulaire de webhooks pour une page
async function createWebhookFormForPage(page, container, isSinglePage) {
    const form = document.createElement('form');
    form.className = 'webhook-page-form';
    form.dataset.pageId = page.pageId;
    
    const webhooksList = [
        { value: 'feed', label: '📝 Feed', desc: 'Posts et commentaires sur la page' },
        { value: 'mention', label: '🏷️ Mentions', desc: 'Mentions de la page dans des posts/commentaires' },
        { value: 'messages', label: '💬 Messages', desc: 'Messages privés reçus sur la page' }
    ];
    
    form.innerHTML = `
        <div style="margin-bottom: 1.5rem;">
            <h3 style="margin-bottom: 1rem;">${isSinglePage ? 'Événements disponibles' : `Événements pour ${pageTitleWithTokenStatus(page)}`}</h3>
            
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1rem;">
                ${webhooksList.map(wh => `
                    <label style="display: flex; align-items: start; padding: 1rem; border: 2px solid #e0e0e0; border-radius: 8px; cursor: pointer; transition: all 0.2s;" 
                           onmouseover="this.style.borderColor='#1877f2'; this.style.backgroundColor='#f0f8ff';" 
                           onmouseout="this.style.borderColor='#e0e0e0'; this.style.backgroundColor='transparent';">
                        <input type="checkbox" name="webhooks[]" value="${wh.value}" class="webhook-checkbox" data-webhook="${wh.value}" style="margin-right: 0.75rem; margin-top: 0.25rem; cursor: pointer;">
                        <div>
                            <strong style="display: block; margin-bottom: 0.25rem;">${wh.label}</strong>
                            <span style="font-size: 0.9em; color: #666;">${wh.desc}</span>
                            ${wh.warning ? `<div style="margin-top: 0.5rem; padding: 0.5rem; background-color: #fff3cd; border-radius: 4px; font-size: 0.85em; color: #856404;">
                                ⚠️ ${wh.warning}
                            </div>` : ''}
                        </div>
                    </label>
                `).join('')}
            </div>
        </div>
        
        <div style="padding: 1rem; background-color: #e7f3ff; border-left: 4px solid #2196F3; border-radius: 4px; margin-bottom: 1.5rem;">
            <p style="margin: 0; font-size: 0.9em;">
                <strong>ℹ️ Note :</strong> Les webhooks sélectionnés seront automatiquement activés pour cette page Facebook.
            </p>
        </div>
        
        <button type="submit" class="btn btn-primary save-webhooks-btn" data-page-id="${page.pageId}">
            💾 Enregistrer les préférences pour cette page
        </button>
        <div class="webhook-save-status" data-page-id="${page.pageId}" style="margin-top: 1rem;"></div>
    `;
    
    container.appendChild(form);
    
    // Charger les webhooks existants pour cette page
    await loadWebhooksForPage(page.pageId);
    
    // Ajouter l'événement submit
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        await saveWebhooksForPage(page.pageId, form);
    });
}

// Charger les webhooks pour une page spécifique depuis Facebook
async function loadWebhooksForPage(pageId) {
    try {
        // Récupérer les webhooks souscrits depuis Facebook (GET /subscribed_apps)
        const res = await fetch(`${API_BASE}/facebook/pages/${encodeURIComponent(pageId)}/subscriptions`, {
            headers: { 'Authorization': `Bearer ${JWT}` }
        });
        const data = await res.json();
        
        if (data.success && Array.isArray(data.subscribedFields)) {
            const form = document.querySelector(`form[data-page-id="${pageId}"]`);
            if (form) {
                // Décocher toutes les cases d'abord
                form.querySelectorAll('input[type="checkbox"][name="webhooks[]"]').forEach(checkbox => {
                    checkbox.checked = false;
                });
                
                // Cocher les webhooks déjà souscrits
                data.subscribedFields.forEach(webhook => {
                    // Normaliser : Facebook retourne "mention" mais notre interface utilise "mention"
                    const webhookId = webhook === 'mentions' ? 'mention' : webhook;
                    const checkbox = form.querySelector(`input[type="checkbox"][name="webhooks[]"][value="${webhookId}"]`);
                    if (checkbox) {
                        checkbox.checked = true;
                        console.log(`✅ Webhook "${webhookId}" déjà souscrit, case cochée`);
                    } else {
                        console.warn(`⚠️  Webhook "${webhookId}" souscrit mais case non trouvée dans le formulaire`);
                    }
                });
                
                console.log(`📋 ${data.subscribedFields.length} webhook(s) déjà souscrit(s) pour la page ${pageId}:`, data.subscribedFields);
            } else {
                console.warn(`⚠️  Formulaire non trouvé pour la page ${pageId}`);
            }
        } else if (data.fromDatabase && Array.isArray(data.subscribedFields)) {
            // Fallback : utiliser les webhooks stockés en base si l'appel Facebook échoue
            console.log(`📋 Utilisation des webhooks stockés en base (fallback) pour la page ${pageId}`);
            const form = document.querySelector(`form[data-page-id="${pageId}"]`);
            if (form) {
                form.querySelectorAll('input[type="checkbox"][name="webhooks[]"]').forEach(checkbox => {
                    checkbox.checked = false;
                });
                
                data.subscribedFields.forEach(webhook => {
                    const webhookId = webhook === 'mentions' ? 'mention' : webhook;
                    const checkbox = form.querySelector(`input[type="checkbox"][name="webhooks[]"][value="${webhookId}"]`);
                    if (checkbox) {
                        checkbox.checked = true;
                    }
                });
            }
        }
    } catch (e) {
        console.error('Erreur chargement webhooks pour page:', e);
    }
}

// Sauvegarder les webhooks pour une page spécifique
async function saveWebhooksForPage(pageId, form) {
    const formData = new FormData(form);
    const webhooks = formData.getAll('webhooks[]');
    
    if (webhooks.length === 0) {
        alert('Veuillez sélectionner au moins un type de webhook');
        return;
    }
    
    const btn = form.querySelector('.save-webhooks-btn');
    const statusDiv = form.querySelector('.webhook-save-status');
    
    btn.disabled = true;
    btn.textContent = 'Enregistrement...';
    statusDiv.innerHTML = '';
    
    try {
        const res = await fetch(`${API_BASE}/facebook/webhooks/subscribe`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${JWT}`
            },
            body: JSON.stringify({ webhooks, pageId })
        });
        
        // Vérifier le Content-Type avant de parser
        const contentType = res.headers.get('content-type');
        let data;
        
        if (!contentType || !contentType.includes('application/json')) {
            const text = await res.text();
            console.error('Réponse non-JSON reçue:', text);
            throw new Error(`Erreur serveur (${res.status}): ${text.substring(0, 200)}`);
        }
        
        try {
            data = await res.json();
        } catch (parseError) {
            const text = await res.text();
            console.error('Erreur parsing JSON:', parseError, 'Réponse:', text);
            throw new Error(`Erreur parsing JSON: ${parseError.message}. Réponse: ${text.substring(0, 200)}`);
        }
        
        // Afficher le message principal
        if (data.success && data.successCount === webhooks.length) {
            statusDiv.innerHTML = `<div class="alert alert-success">✅ ${data.message || 'Webhooks enregistrés avec succès !'}</div>`;
        } else if (data.successCount > 0) {
            statusDiv.innerHTML = `<div class="alert alert-warning" style="background-color: #fff3cd; border-color: #ffc107; color: #856404;">⚠️ ${data.message || 'Certains webhooks n\'ont pas pu être abonnés'}</div>`;
        } else {
            statusDiv.innerHTML = `<div class="alert alert-danger">❌ ${data.message || 'Aucun webhook n\'a pu être abonné'}</div>`;
        }
        
        // Afficher les résultats détaillés
        if (data.results && data.results.length > 0) {
            const resultsHtml = data.results.map(r => {
                const icon = r.success ? '✅' : '❌';
                const color = r.success ? '#28a745' : '#dc3545';
                const message = r.success 
                    ? `Abonné à "${r.event}"` 
                    : `Erreur "${r.event}": ${r.error || 'Erreur inconnue'}`;
                return `<div style="font-size: 0.9em; margin-top: 0.5rem; color: ${color}; padding: 0.5rem; background-color: ${r.success ? '#d4edda' : '#f8d7da'}; border-radius: 4px;">${icon} ${message}</div>`;
            }).join('');
            statusDiv.innerHTML += resultsHtml;
        }
        
        // IMPORTANT : Ne pas recharger la configuration, les onglets restent intacts
        // Juste mettre à jour les checkboxes pour refléter l'état sauvegardé
        await loadWebhooksForPage(pageId);
    } catch (e) {
        console.error('Erreur sauvegarde webhooks:', e);
        statusDiv.innerHTML = `<div class="alert alert-danger">❌ Erreur : ${e.message}<br><small style="font-size: 0.85em; color: #666;">Vérifiez la console (F12) pour plus de détails</small></div>`;
    } finally {
        btn.disabled = false;
        btn.textContent = '💾 Enregistrer les préférences pour cette page';
    }
}

// Charger les webhooks actuellement sélectionnés
async function loadWebhooks() {
    try {
        const res = await fetch(`${API_BASE}/facebook/webhooks/subscribed`, {
            headers: { 'Authorization': `Bearer ${JWT}` }
        });
        const data = await res.json();
        
        if (data.success && Array.isArray(data.webhooks)) {
            // Cocher les webhooks déjà sélectionnés
            data.webhooks.forEach(webhook => {
                // Gérer la compatibilité : "mentions" (ancien) -> "mention" (nouveau)
                const webhookId = webhook === 'mentions' ? 'mention' : webhook;
                const checkbox = document.getElementById(`webhook_${webhookId}`);
                if (checkbox) {
                    checkbox.checked = true;
                }
            });
        }
    } catch (e) {
        console.error('Erreur chargement webhooks:', e);
    }
}

// Sauvegarder les webhooks sélectionnés
document.getElementById('webhookConfigForm')?.addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const formData = new FormData(this);
    const webhooks = formData.getAll('webhooks[]');
    
    if (webhooks.length === 0) {
        alert('Veuillez sélectionner au moins un type de webhook');
        return;
    }
    
    const btn = document.getElementById('saveWebhooksBtn');
    const statusDiv = document.getElementById('webhookSaveStatus');
    
    btn.disabled = true;
    btn.textContent = 'Enregistrement...';
    statusDiv.innerHTML = '';
    
    try {
        const res = await fetch(`${API_BASE}/facebook/webhooks/subscribe`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${JWT}`
            },
            body: JSON.stringify({ webhooks })
        });
        
        const data = await res.json();
        
        // Afficher le message principal
        if (data.success && data.successCount === webhooks.length) {
            statusDiv.innerHTML = `<div class="alert alert-success">✅ ${data.message || 'Webhooks enregistrés avec succès !'}</div>`;
        } else if (data.successCount > 0) {
            statusDiv.innerHTML = `<div class="alert alert-warning" style="background-color: #fff3cd; border-color: #ffc107; color: #856404;">⚠️ ${data.message || 'Certains webhooks n\'ont pas pu être abonnés'}</div>`;
        } else {
            statusDiv.innerHTML = `<div class="alert alert-danger">❌ ${data.message || 'Aucun webhook n\'a pu être abonné'}</div>`;
        }
        
        // Afficher les résultats détaillés
        if (data.results && data.results.length > 0) {
            const resultsHtml = data.results.map(r => {
                const icon = r.success ? '✅' : '❌';
                const color = r.success ? '#28a745' : '#dc3545';
                const message = r.success 
                    ? `Abonné à "${r.event}"` 
                    : `Erreur "${r.event}": ${r.error || 'Erreur inconnue'}`;
                return `<div style="font-size: 0.9em; margin-top: 0.5rem; color: ${color}; padding: 0.5rem; background-color: ${r.success ? '#d4edda' : '#f8d7da'}; border-radius: 4px;">${icon} ${message}</div>`;
            }).join('');
            statusDiv.innerHTML += resultsHtml;
            
            // Afficher un message d'aide si des erreurs
            if (data.failCount > 0) {
                statusDiv.innerHTML += `
                    <div style="margin-top: 1rem; padding: 1rem; background-color: #e7f3ff; border-left: 4px solid #2196F3; border-radius: 4px;">
                        <strong>💡 Aide :</strong>
                        <ul style="margin: 0.5rem 0 0 1.5rem; font-size: 0.9em;">
                            <li>Vérifiez que le webhook est configuré dans Facebook Developer</li>
                            <li>Vérifiez que les permissions nécessaires sont accordées :
                                <ul style="margin-top: 0.25rem;">
                                    <li><code>feed</code> et <code>mention</code> : nécessitent <code>pages_read_engagement</code></li>
                                    <li><code>messages</code> : nécessite <code>pages_messaging</code> (permission avancée, nécessite une révision d'app)</li>
                                </ul>
                            </li>
                            <li>Pour activer <code>messages</code>, vous devez demander la permission <code>pages_messaging</code> dans Facebook Developer et soumettre votre app pour révision</li>
                            <li>Consultez les logs Node.js pour plus de détails</li>
                        </ul>
                    </div>
                `;
            }
        }
    } catch (e) {
        statusDiv.innerHTML = `<div class="alert alert-danger">❌ Erreur : ${e.message}</div>`;
    } finally {
        btn.disabled = false;
        btn.textContent = '💾 Enregistrer les préférences';
    }
});

// Connexion
document.getElementById('connectBtn')?.addEventListener('click', async function() {
    this.disabled = true;
    this.textContent = 'Redirection...';
    
    try {
        const res = await fetch(`${API_BASE}/facebook/oauth/login`, {
            headers: { 'Authorization': `Bearer ${JWT}` }
        });
        const data = await res.json();
        
        if (data.success && data.authUrl) {
            // Facebook OAuth refuse l'affichage en iframe (X-Frame-Options: deny).
            if (window.top && window.top !== window) {
                window.top.location.href = data.authUrl;
            } else {
                window.location.href = data.authUrl;
            }
        } else {
            alert('Erreur : ' + (data.message || 'Impossible de se connecter'));
            this.disabled = false;
            this.textContent = 'Se connecter avec Facebook';
        }
    } catch (e) {
        alert('Erreur : ' + e.message);
        this.disabled = false;
        this.textContent = 'Se connecter avec Facebook';
    }
});

// Actualiser les pages disponibles (sans refaire OAuth)
document.getElementById('refreshPagesBtn')?.addEventListener('click', async function() {
    this.disabled = true;
    this.textContent = '🔄 Actualisation...';
    
    try {
        const res = await fetch(`${API_BASE}/facebook/pages/refresh`, {
            headers: { 'Authorization': `Bearer ${JWT}` }
        });
        const data = await res.json();
        
        if (data.success) {
            if (data.newPages && data.newPages.length > 0) {
                // Il y a de nouvelles pages disponibles
                // Utiliser la même logique que loadOAuthPages pour les afficher
                document.getElementById('pagesConfiguration').style.display = 'block';
                document.getElementById('connectSection').style.display = 'none';
                
                const tabsContainer = document.querySelector('#oauthPagesTabs > div');
                const contentContainer = document.getElementById('oauthPagesContent');
                
                tabsContainer.innerHTML = '';
                contentContainer.innerHTML = '';
                
                // Réinitialiser selectedPagesConfig
                if (typeof selectedPagesConfig !== 'undefined') {
                    Object.keys(selectedPagesConfig).forEach(key => delete selectedPagesConfig[key]);
                } else {
                    window.selectedPagesConfig = {};
                }
                
                data.pages.forEach((page, index) => {
                    selectedPagesConfig[page.id] = { webhooks: [] };
                    
                    // Créer l'onglet
                    const tab = document.createElement('button');
                    tab.type = 'button';
                    tab.className = 'page-tab';
                    tab.dataset.pageId = page.id;
                    tab.textContent = page.name || page.id;
                    
                    if (index === 0) {
                        tab.classList.add('active');
                    }
                    
                    tab.addEventListener('click', () => {
                        document.querySelectorAll('#oauthPagesTabs .page-tab').forEach(t => {
                            t.classList.remove('active');
                        });
                        tab.classList.add('active');
                        document.querySelectorAll('#oauthPagesContent .oauth-page-content').forEach(c => {
                            c.style.display = 'none';
                        });
                        const content = document.getElementById(`oauth-content-${page.id}`);
                        if (content) content.style.display = 'block';
                    });
                    
                    tabsContainer.appendChild(tab);
                    
                    // Créer le contenu de l'onglet
                    const contentDiv = document.createElement('div');
                    contentDiv.id = `oauth-content-${page.id}`;
                    contentDiv.className = 'oauth-page-content';
                    contentDiv.style.display = index === 0 ? 'block' : 'none';
                    contentContainer.appendChild(contentDiv);
                    
                    createOAuthPageForm({ id: page.id, name: page.name }, contentDiv);
                });
                
                alert(`✅ ${data.newPages.length} nouvelle(s) page(s) trouvée(s) ! Configurez les webhooks ci-dessous.`);
            } else {
                alert('ℹ️ Toutes vos pages Facebook sont déjà connectées.');
            }
        } else {
            alert('Erreur : ' + (data.message || 'Impossible d\'actualiser les pages'));
        }
    } catch (e) {
        alert('Erreur : ' + e.message);
    } finally {
        this.disabled = false;
        this.textContent = '🔄 Actualiser les pages disponibles';
    }
});

// Déconnexion
document.getElementById('disconnectBtn')?.addEventListener('click', async function() {
    if (!confirm('Déconnecter Facebook ?')) return;
    
    try {
        const res = await fetch(`${API_BASE}/facebook/config`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${JWT}` }
        });
        const data = await res.json();
        
        if (data.success) {
            location.reload();
        } else {
            alert('Erreur : ' + (data.message || 'Impossible de déconnecter'));
        }
    } catch (e) {
        alert('Erreur : ' + e.message);
    }
});

// Configuration des pages après OAuth
<?php if ($step === 'configure_pages' && $state): ?>
const oauthState = '<?= addslashes($state) ?>';
const selectedPagesConfig = {}; // { pageId: { webhooks: [...] } }

async function loadOAuthPages() {
    try {
        const res = await fetch(`${API_BASE}/facebook/oauth/pages?state=${encodeURIComponent(oauthState)}`, {
            headers: { 'Authorization': `Bearer ${JWT}` }
        });
        const data = await res.json();
        
        if (data.success && data.pages) {
            document.getElementById('pagesConfiguration').style.display = 'block';
            document.getElementById('connectSection').style.display = 'none';
            
            const tabsContainer = document.querySelector('#oauthPagesTabs > div');
            const contentContainer = document.getElementById('oauthPagesContent');
            
            tabsContainer.innerHTML = '';
            contentContainer.innerHTML = '';
            
            data.pages.forEach((page, index) => {
                // Initialiser la config pour cette page
                selectedPagesConfig[page.id] = { webhooks: [] };
                
                // Créer l'onglet
                const tab = document.createElement('button');
                tab.type = 'button';
                tab.className = 'page-tab';
                tab.dataset.pageId = page.id;
                tab.textContent = page.name || page.id;
                
                if (index === 0) {
                    tab.classList.add('active');
                }
                
                tab.addEventListener('click', () => {
                    document.querySelectorAll('#oauthPagesTabs .page-tab').forEach(t => {
                        t.classList.remove('active');
                    });
                    tab.classList.add('active');
                    
                    document.querySelectorAll('#oauthPagesContent .oauth-page-content').forEach(c => {
                        c.style.display = 'none';
                    });
                    const content = document.getElementById(`oauth-content-${page.id}`);
                    if (content) content.style.display = 'block';
                });
                
                tabsContainer.appendChild(tab);
                
                // Créer le contenu de l'onglet
                const contentDiv = document.createElement('div');
                contentDiv.id = `oauth-content-${page.id}`;
                contentDiv.className = 'oauth-page-content';
                contentDiv.style.display = index === 0 ? 'block' : 'none';
                contentContainer.appendChild(contentDiv);
                
                createOAuthPageForm(page, contentDiv);
            });
        }
    } catch (e) {
        alert('Erreur : ' + e.message);
    }
}

function createOAuthPageForm(page, container) {
    const webhooksList = [
        { value: 'feed', label: '📝 Feed', desc: 'Posts et commentaires sur la page' },
        { value: 'mention', label: '🏷️ Mentions', desc: 'Mentions de la page dans des posts/commentaires' },
        { value: 'messages', label: '💬 Messages', desc: 'Messages privés reçus sur la page' }
    ];
    
    const form = document.createElement('div');
    form.className = 'oauth-page-form';
    form.dataset.pageId = page.id;
    
    form.innerHTML = `
        <div style="margin-bottom: 1.5rem;">
            <h3 style="margin-bottom: 1rem;">Webhooks pour "${page.name || page.id}"</h3>
            <p style="margin-bottom: 1rem; color: #666; font-size: 0.9em;">
                Cochez les événements que vous souhaitez recevoir pour cette page
            </p>
            
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1rem;">
                ${webhooksList.map(wh => `
                    <label style="display: flex; align-items: start; padding: 1rem; border: 2px solid #e0e0e0; border-radius: 8px; cursor: pointer; transition: all 0.2s;" 
                           onmouseover="this.style.borderColor='#1877f2'; this.style.backgroundColor='#f0f8ff';" 
                           onmouseout="this.style.borderColor='#e0e0e0'; this.style.backgroundColor='transparent';">
                        <input type="checkbox" class="oauth-webhook-checkbox" data-page-id="${page.id}" data-webhook="${wh.value}" style="margin-right: 0.75rem; margin-top: 0.25rem; cursor: pointer;">
                        <div>
                            <strong style="display: block; margin-bottom: 0.25rem;">${wh.label}</strong>
                            <span style="font-size: 0.9em; color: #666;">${wh.desc}</span>
                        </div>
                    </label>
                `).join('')}
            </div>
        </div>
        
        <div style="padding: 1rem; background-color: #e7f3ff; border-left: 4px solid #2196F3; border-radius: 4px;">
            <p style="margin: 0; font-size: 0.9em;">
                <strong>ℹ️ Note :</strong> Cette page sera connectée avec les webhooks sélectionnés.
            </p>
        </div>
    `;
    
    container.appendChild(form);
    
    // Écouter les changements de checkboxes
    form.querySelectorAll('.oauth-webhook-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', () => {
            updateSelectedPagesConfig();
        });
    });
}

function updateSelectedPagesConfig() {
    document.querySelectorAll('.oauth-page-form').forEach(form => {
        const pageId = form.dataset.pageId;
        const checkboxes = form.querySelectorAll(`.oauth-webhook-checkbox[data-page-id="${pageId}"]:checked`);
        const webhooks = Array.from(checkboxes).map(cb => cb.dataset.webhook);
        selectedPagesConfig[pageId] = { webhooks: webhooks };
    });
}

// Sauvegarder toutes les pages
document.getElementById('saveAllPagesBtn')?.addEventListener('click', async () => {
    updateSelectedPagesConfig();
    
    // Filtrer seulement les pages avec au moins un webhook sélectionné
    const pagesToSave = Object.entries(selectedPagesConfig)
        .filter(([pageId, config]) => config.webhooks.length > 0)
        .map(([pageId, config]) => ({
            pageId: pageId,
            webhooks: config.webhooks
        }));
    
    if (pagesToSave.length === 0) {
        alert('Veuillez sélectionner au moins un webhook pour au moins une page');
        return;
    }
    
    const btn = document.getElementById('saveAllPagesBtn');
    const statusDiv = document.getElementById('saveAllPagesStatus');
    
    btn.disabled = true;
    btn.textContent = 'Sauvegarde...';
    statusDiv.innerHTML = '';
    
    try {
        // Utiliser la nouvelle route qui supporte refresh et OAuth
        const res = await fetch(`${API_BASE}/facebook/pages/save`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${JWT}`
            },
            body: JSON.stringify({
                state: oauthState,
                pages: pagesToSave
            })
        });
        
        // Vérifier le Content-Type avant de parser
        const contentType = res.headers.get('content-type');
        let data;
        
        if (!contentType || !contentType.includes('application/json')) {
            const text = await res.text();
            console.error('Réponse non-JSON reçue:', text);
            throw new Error(`Erreur serveur (${res.status}): ${text.substring(0, 200)}`);
        }
        
        try {
            data = await res.json();
        } catch (parseError) {
            const text = await res.text();
            console.error('Erreur parsing JSON:', parseError, 'Réponse:', text);
            throw new Error(`Erreur parsing JSON: ${parseError.message}. Réponse: ${text.substring(0, 200)}`);
        }
        
        if (data.success) {
            statusDiv.innerHTML = `<div class="alert alert-success">
                ✅ ${data.message || 'Pages sauvegardées avec succès !'}
            </div>`;
            
            // Masquer la section OAuth et afficher la section de configuration normale
            document.getElementById('pagesConfiguration').style.display = 'none';
            document.getElementById('connectSection').style.display = 'none';
            document.getElementById('webhookConfigSection').style.display = 'block';
            
            // Recharger la configuration pour afficher les pages connectées avec leurs onglets
            setTimeout(async () => {
                await loadConfig();
            }, 500);
        } else {
            statusDiv.innerHTML = `<div class="alert alert-danger">❌ Erreur : ${data.message || 'Impossible de sauvegarder les pages'}</div>`;
            btn.disabled = false;
            btn.textContent = '💾 Sauvegarder toutes les pages sélectionnées';
        }
    } catch (e) {
        console.error('Erreur sauvegarde pages:', e);
        statusDiv.innerHTML = `<div class="alert alert-danger">❌ Erreur : ${e.message}<br><small style="font-size: 0.85em; color: #666;">Vérifiez la console (F12) pour plus de détails</small></div>`;
        btn.disabled = false;
        btn.textContent = '💾 Sauvegarder toutes les pages sélectionnées';
    }
});

loadOAuthPages();
<?php endif; ?>


// ===== FONCTIONS POUR PUBLIER UN POST =====
// (Déplacées dans facebook-publish.php)

// Charger au démarrage
// Si on n'est pas en mode configure_pages, charger la config normale
<?php if ($step !== 'configure_pages'): ?>
loadConfig();
<?php endif; ?>
// Vérifier aussi la config App au démarrage
checkAppConfig();

// Fermer modal entreprise
document.addEventListener('DOMContentLoaded', () => {
    const modal = document.getElementById('entrepriseModal');
    if (modal) {
        modal.classList.remove('active');
        modal.style.display = 'none';
    }
});
</script>

<?php require_once '../../includes/footer.php'; ?>
