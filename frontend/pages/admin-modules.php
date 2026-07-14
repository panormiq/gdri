<?php
/**
 * Console plateforme — Extensions.
 */

require_once '../config/config.php';
require_once '../config/database.php';
require_once '../auth/session.php';
require_once '../includes/functions.php';
require_once '../includes/jwt-helper.php';
require_once '../includes/entity-console-nav.php';

if (!hasRole(ROLE_ADMIN_GDRI)) {
    redirect(url('pages/dashboard.php'));
}

$admin_modules = [
    [
        'id' => 'ia',
        'title' => 'Console GDRI – Serveurs IA',
        'description' => 'Infra IA distribuée : création, presets, entités autorisées.',
        'icon' => '🤖',
        'url' => url('pages/modules/ia-config.php'),
    ],
    [
        'id' => 'facebook',
        'title' => 'Module Facebook',
        'description' => 'Application Facebook, OAuth et pages liées.',
        'icon' => '📘',
        'url' => url('pages/modules/facebook-app-config.php'),
    ],
    [
        'id' => 'mail',
        'title' => 'Module Mail',
        'description' => 'Fournisseurs mail IMAP/SMTP pour les presets.',
        'icon' => '📧',
        'url' => url('pages/admin-modules-mail.php'),
    ],
    [
        'id' => 'data-backup',
        'title' => 'Sauvegarde des bases client',
        'description' => 'Destinations, politiques globales et supervision des backups entités.',
        'icon' => '💾',
        'url' => url('pages/admin-modules-backup.php'),
    ],
];

$page_title = 'Extensions';
require_once '../includes/header.php';
renderConsolePageOpen(
    'Extensions',
    'Configuration technique des extensions et services partagés (IA, mail, Facebook…).'
);
?>

<?php renderConsoleSearchToolbar('IA, mail, facebook…'); ?>

<?php renderEntityConsoleHubCards($admin_modules, 'platform'); ?>

<div id="entityConsoleNoResult" class="entity-console-empty" style="display: none; margin-top: 1rem;">
    <p>Aucune extension ne correspond à votre recherche.</p>
</div>

<?php
renderConsolePageClose();
renderEntityConsoleCardScript();
require_once '../includes/footer.php';
