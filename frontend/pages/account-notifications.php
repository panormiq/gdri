<?php
/**
 * Mon compte – Mes notifications
 */

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../auth/session.php';
require_once __DIR__ . '/../includes/functions.php';
require_once __DIR__ . '/../includes/entity-console-nav.php';

if (!isLoggedIn()) {
    redirect(url('index.php'));
}

$page_title = 'Mes notifications';
require_once __DIR__ . '/../includes/header.php';
renderConsoleLayoutStart(
    'Mes notifications',
    'Configurez comment vous souhaitez être averti (emails, alertes, fréquence, etc.).',
    ['compact' => true]
);
?>

    <div class="alert alert-info">
        Les paramètres de notifications seront configurables ici (canaux, fréquence, préférences).
    </div>

<?php
renderConsoleLayoutEnd();
require_once __DIR__ . '/../includes/footer.php';
