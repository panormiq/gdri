<?php
/**
 * Mon compte – Mes notifications
 */

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../auth/session.php';
require_once __DIR__ . '/../includes/functions.php';

if (!isLoggedIn()) {
    redirect(url('index.php'));
}

$page_title = 'Mes notifications';
require_once __DIR__ . '/../includes/header.php';

?>

<div class="container" style="max-width: 800px; margin: 2rem auto; padding: 0 1rem;">
    <div style="margin-bottom: 2rem;">
        <h1>Mes notifications</h1>
        <p style="color:#666;font-size:1.05em;">
            Configurez comment vous souhaitez être averti (emails, alertes, fréquence, etc.).
            Les options détaillées seront ajoutées progressivement.
        </p>
    </div>

    <div class="alert alert-info">
        Les paramètres de notifications seront configurables ici (canaux, fréquence, préférences).
    </div>
</div>

<?php require_once __DIR__ . '/../includes/footer.php'; ?>

