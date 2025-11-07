<?php
require_once '../../../config/config.php';
require_once '../../../auth/session.php';
require_once '../../../includes/functions.php';

if (!hasRole(ROLE_ADMIN_GDRI) && !hasRole(ROLE_ADMIN_ENTITY)) {
    redirect(url('pages/dashboard.php'));
}

$page_title = 'Agent Documentaire — Éditeur';

require_once '../../../includes/header.php';
?>

<section class="hero">
    <div class="container">
        <div class="hero-content">
            <h1>Éditeur de modèle documentaire</h1>
            <p class="hero-description">
                Importez un document Word et préparez votre modèle technique.
            </p>
        </div>
    </div>
</section>

<section class="section">
    <div class="container">
        <div class="card">
            <div class="card-body">
                <p>
                    L'éditeur complet arrive bientôt. Vous pourrez :
                </p>
                <ul>
                    <li>📤 Importer un document Word (.docx)</li>
                    <li>🧠 Visualiser la structure extraite (titres, paragraphes, images)</li>
                    <li>🛠️ Ajuster les styles et la mise en page</li>
                    <li>🎯 Générer un modèle réutilisable</li>
                </ul>
                <p>
                    Contactez-nous pour être notifié du lancement ou pour une démonstration privée.
                </p>
                <a class="btn btn-primary" href="<?= url('pages/modules/document-agent/index.php'); ?>">⬅️ Retour au module</a>
            </div>
        </div>
    </div>
</section>

<?php require_once '../../../includes/footer.php'; ?>
