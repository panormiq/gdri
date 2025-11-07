<?php
require_once '../../../config/config.php';
require_once '../../../auth/session.php';
require_once '../../../includes/functions.php';

if (!hasRole(ROLE_ADMIN_GDRI) && !hasRole(ROLE_ADMIN_ENTITY)) {
    redirect(url('pages/dashboard.php'));
}

$page_title = 'Agent Documentaire';

require_once '../../../includes/header.php';
?>

<section class="hero">
    <div class="container">
        <div class="hero-content">
            <h1>Agent Documentaire</h1>
            <p class="hero-description">
                Centralisez vos modèles de dossiers techniques.
            </p>
        </div>
    </div>
</section>

<section class="section">
    <div class="container">
        <div class="card">
            <div class="card-body">
                <div class="agent-actions">
                    <a class="btn btn-primary" href="<?= url('pages/modules/document-agent/editor.php'); ?>">
                        ✏️ Créer un modèle
                    </a>
                    <a class="btn btn-outline" href="#" onclick="alert('La bibliothèque de modèles arrive bientôt.'); return false;">
                        📂 Utiliser un modèle
                    </a>
                </div>
            </div>
        </div>
    </div>
</section>

<style>
.agent-actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--spacing-sm);
    justify-content: center;
}

.agent-actions .btn {
    min-width: 200px;
}
</style>

<?php require_once '../../../includes/footer.php'; ?>
