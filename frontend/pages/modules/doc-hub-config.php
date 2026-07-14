<?php
require_once '../../config/config.php';
require_once '../../auth/session.php';
require_once '../../includes/functions.php';
require_once '../../includes/entity-console-nav.php';

if (!isLoggedIn()) {
    redirect(url('pages/dashboard.php'));
}

$page_title = 'Doc-Hub — configuration';
require_once '../../includes/header.php';
renderConsoleLayoutStart(
    'Doc-Hub — configuration',
    'Paramétrage des types de pièces et liaison aux collections doc-template (à venir).',
    ['compact' => true]
);
renderConsoleBackLink('Applications', url('pages/modules.php'));
?>

    <p>
        <a href="<?= url('pages/modules/doc-hub.php') ?>" class="btn btn-primary">Ouvrir Doc-Hub</a>
    </p>

<?php
renderConsoleLayoutEnd();
require_once '../../includes/footer.php';
