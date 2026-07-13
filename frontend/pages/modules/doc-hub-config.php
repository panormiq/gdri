<?php
require_once '../../config/config.php';
require_once '../../auth/session.php';
require_once '../../includes/functions.php';

if (!isLoggedIn()) {
    redirect(url('pages/dashboard.php'));
}

$page_title = 'Doc-Hub — configuration';
require_once '../../includes/header.php';
?>

<div class="container" style="margin: 2rem auto; max-width: 720px;">
    <h1>Doc-Hub — configuration</h1>
    <p class="text-muted">
        Paramétrage des types de pièces et liaison aux collections doc-template (à venir).
    </p>
    <a href="<?= url('pages/modules/doc-hub.php') ?>" class="btn btn-primary">Ouvrir Doc-Hub</a>
    <a href="<?= url('pages/modules.php') ?>" class="btn btn-outline">← Applications</a>
</div>

<?php require_once '../../includes/footer.php'; ?>
