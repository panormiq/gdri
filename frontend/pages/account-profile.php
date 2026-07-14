<?php
/**
 * Mon compte – Mes données (profil)
 */

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../auth/session.php';
require_once __DIR__ . '/../includes/functions.php';
require_once __DIR__ . '/../includes/entity-console-nav.php';

if (!isLoggedIn()) {
    redirect(url('index.php'));
}

$page_title = 'Mes données';
require_once __DIR__ . '/../includes/header.php';
renderConsoleLayoutStart(
    'Mes données',
    'Gérez vos informations personnelles (email, mot de passe, etc.).',
    ['compact' => true]
);
?>

    <div class="alert alert-info">
        Le formulaire de mise à jour du profil (email, mot de passe, autres données) sera ajouté ici.
    </div>

<?php
renderConsoleLayoutEnd();
require_once __DIR__ . '/../includes/footer.php';
