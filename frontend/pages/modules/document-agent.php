<?php
require_once '../../config/config.php';
require_once '../../auth/session.php';
require_once '../../includes/functions.php';

if (!hasRole(ROLE_ADMIN_GDRI) && !hasRole(ROLE_ADMIN_ENTITY)) {
    redirect(url('pages/dashboard.php'));
}

$page_title = 'Agent Documentaire';

require_once '../../includes/header.php';
?>

<section class="hero">
    <div class="container">
        <div class="hero-content">
            <h1>Agent Documentaire</h1>
            <p class="hero-description">
                Centralisez la préparation des dossiers techniques et la génération de modèles à partir de vos documents.
            </p>
        </div>
    </div>
</section>

<section class="section">
    <div class="container">
        <div class="card">
            <div class="card-body">
                <h2>Module en cours d'intégration</h2>
                <p>
                    L'agent documentaire est en cours de finalisation. Il permettra bientôt :
                </p>
                <ul>
                    <li>📄 L'import de documents Word (.docx)</li>
                    <li>🧠 L'extraction automatique de la structure et des styles</li>
                    <li>🧱 La génération de modèles personnalisés pour vos dossiers techniques</li>
                    <li>📤 L'export vers des formats prêts à l'usage</li>
                </ul>
                <p>
                    Vous serez notifié dès que le module sera totalement opérationnel. En attendant, contactez-nous pour configurer votre flux documentaire.
                </p>
                <a class="btn btn-primary" href="<?= url('pages/contact.php'); ?>">Nous contacter</a>
            </div>
        </div>
    </div>
</section>

<?php require_once '../../includes/footer.php'; ?>
