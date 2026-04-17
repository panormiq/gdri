<?php
/**
 * Mon compte – Mes données (profil)
 */

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../auth/session.php';
require_once __DIR__ . '/../includes/functions.php';

if (!isLoggedIn()) {
    redirect(url('index.php'));
}

$page_title = 'Mes données';
require_once __DIR__ . '/../includes/header.php';

?>

<div class="container" style="max-width: 800px; margin: 2rem auto; padding: 0 1rem;">
    <div style="margin-bottom: 2rem;">
        <h1>Mes données</h1>
        <p style="color:#666;font-size:1.05em;">
            Gérez vos informations personnelles (email, mot de passe, etc.). Le formulaire complet
            sera implémenté ici par la suite.
        </p>
    </div>

    <div class="alert alert-info">
        Le formulaire de mise à jour du profil (email, mot de passe, autres données) sera ajouté ici.
    </div>
</div>

<?php require_once __DIR__ . '/../includes/footer.php'; ?>

