<?php
require_once '../../../config/config.php';
require_once '../../../auth/session.php';
require_once '../../../includes/functions.php';
require_once '../../../includes/jwt-helper.php';

// Vérifier que l'utilisateur est connecté via GDR
if (!isLoggedIn()) {
    // Rediriger vers la page de login GDR
    redirect(url('auth/login-process.php'));
}

$page_title = 'Documents';

// Token JWT pour les appels API (généré depuis la session GDRI)
$jwt_token = getJWTToken();
$api_base_url = getApiBaseUrl();

// Scripts JS à charger (chemins relatifs depuis le module)
$extra_scripts = [
    url('pages/modules/doc-template-v3/app/app.js') . '?v=tpl-loop-4'
];

require_once '../../../includes/header.php';
?>

<div id="app"></div>

<script>
    window.CANVAS_EDITOR_URL = <?= json_encode(url('pages/modules/document-agent-v2/editor.php'), JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT) ?>;
</script>

<!-- Configuration de l'API backend -->
<script type="module">
    // Configuration de l'API backend pour doc-template-v3
    // Utiliser l'API GDRI avec le module doc-template
    window.API_BASE_URL = <?= json_encode($api_base_url, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT) ?>;
    window.DOC_TEMPLATE_API_BASE = window.API_BASE_URL + '/doc-template';
    
    console.log('🔧 API Base URL configurée:', window.API_BASE_URL);
    console.log('🔧 Doc-Template API Base:', window.DOC_TEMPLATE_API_BASE);
    
    // Définir le cookie HttpOnly depuis le token JWT PHP
    // C'est plus sécurisé que de stocker le token dans localStorage
    (async function() {
        const jwtToken = <?= json_encode($jwt_token, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT) ?>;
        
        if (jwtToken) {
            try {
                const response = await fetch(window.API_BASE_URL + '/auth/set-cookie-from-gdr', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    credentials: 'include', // Important pour les cookies
                    body: JSON.stringify({ token: jwtToken })
                });
                
                const data = await response.json();
                
                if (data.success) {
                    console.log('✅ Cookie HttpOnly défini avec succès pour:', data.user?.email);
                } else {
                    console.error('❌ Erreur lors de la définition du cookie:', data.message);
                }
            } catch (error) {
                console.error('❌ Erreur réseau lors de la définition du cookie:', error);
            }
        } else {
            console.warn('⚠️ Aucun token JWT disponible');
        }
        
        // L'application sera chargée via le script dans $extra_scripts
        console.log('✅ Application prête à démarrer');
    })();
</script>

<style>
#app {
    width: 100%;
    min-height: calc(100vh - var(--header-height-minimal, var(--header-height, 140px)) - 20px);
}

footer.footer {
    display: none !important;
}

.template-builder-page-footer {
    height: 20px;
    width: 100%;
    background-color: var(--color-light);
    flex-shrink: 0;
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 50;
}
</style>

<!-- Footer personnalisé remplaçant le footer du template -->
<div class="template-builder-page-footer"></div>

<?php require_once '../../../includes/footer.php'; ?>
