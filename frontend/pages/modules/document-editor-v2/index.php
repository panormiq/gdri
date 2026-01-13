<?php
require_once '../../../config/config.php';
require_once '../../../auth/session.php';
require_once '../../../includes/functions.php';

// Vérifier que l'utilisateur est connecté via GDR
if (!isLoggedIn()) {
    // Rediriger vers la page de login GDR
    redirect(url('auth/login-process.php'));
}

$page_title = 'Document Editor V2';

// Récupérer les données de session GDR
$gdriUserId = $_SESSION['user_id'] ?? null;
$gdriEmail = $_SESSION['user_email'] ?? null;
$gdriRole = $_SESSION['user_role'] ?? null;
$gdriEntrepriseId = $_SESSION['entrepriseId'] ?? null;

require_once '../../../includes/header.php';
?>

<!-- Styles du module -->
<link rel="stylesheet" href="<?= url('pages/modules/document-editor-v2/styles/styles.css'); ?>">
<link rel="stylesheet" href="<?= url('pages/modules/document-editor-v2/styles/responsive.css'); ?>">

<div class="document-editor-v2-container">
    <div id="app"></div>
</div>

<!-- Configuration de l'API backend -->
<script type="module">
    // Configuration de l'API backend pour document-editor-v2
    window.API_BASE_URL = 'http://localhost:5005/api';
    console.log('🔧 API Base URL configurée:', window.API_BASE_URL);
    
    // Données de session GDR pour générer le token JWT
    const gdrSession = {
        userId: <?= json_encode($gdriUserId) ?>,
        email: <?= json_encode($gdriEmail) ?>,
        role: <?= json_encode($gdriRole) ?>,
        entrepriseId: <?= json_encode($gdriEntrepriseId) ?>
    };
    
    // Fonction pour générer le token JWT depuis la session GDR
    async function generateJwtFromGdrSession() {
        try {
            const response = await fetch(`${window.API_BASE_URL}/auth/login-from-gdr`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify(gdrSession)
            });
            
            const data = await response.json();
            
            if (data.success) {
                console.log('✅ Token JWT généré depuis session GDR');
                
                // Stocker le token dans localStorage pour utilisation via header Authorization
                // (plus fiable que les cookies en cross-origin)
                if (data.token) {
                    localStorage.setItem('doc_template_token', data.token);
                    console.log('✅ Token stocké dans localStorage');
                }
                
                return true;
            } else {
                console.error('❌ Erreur génération token:', data.error);
                alert('Erreur d\'authentification: ' + (data.error || 'Erreur inconnue'));
                return false;
            }
        } catch (error) {
            console.error('❌ Erreur réseau lors de la génération du token:', error);
            alert('Erreur réseau lors de l\'authentification. Vérifiez que le backend doc_template est démarré.');
            return false;
        }
    }
    
    // Démarrer l'application
    (async function() {
        // Générer le token JWT depuis la session GDR
        const tokenGenerated = await generateJwtFromGdrSession();
        
        if (tokenGenerated) {
            // Démarrer l'application SPA
            import('./src/app/app.js')
                .then(module => {
                    module.default.start();
                })
                .catch(error => {
                    console.error('Erreur de chargement de l\'application SPA:', error);
                });
        }
    })();
</script>

<style>
.document-editor-v2-container {
    width: 100%;
    height: 100vh;
    overflow: hidden;
}

#app {
    width: 100%;
    height: 100%;
}
</style>

<?php require_once '../../../includes/footer.php'; ?>
