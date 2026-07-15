<?php
/**
 * Console plateforme — Structurel.
 */

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../auth/session.php';
require_once __DIR__ . '/../includes/functions.php';
require_once __DIR__ . '/../includes/entity-console-nav.php';

requirePlatformConsoleAccess();

$structural_items = buildPlatformStructuralHubItems();

$page_title = 'Structurel';
require_once __DIR__ . '/../includes/header.php';
renderConsolePageOpen(
    'Structurel',
    'Infrastructure partagée par toutes les entités (serveurs IA, stockage des sauvegardes…).'
);
?>

<div class="alert alert-light border small" style="margin-bottom: 1.25rem;" role="note">
    <strong>Serveurs IA — qui assigne quoi ?</strong>
    <ul style="margin: 0.5rem 0 0; padding-left: 1.2rem;">
        <li><strong>Plateforme (ici)</strong> → <em>Structurel → Serveurs IA</em> : créer le serveur et cocher <strong>quelles entités</strong> y ont accès.</li>
        <li><strong>Console entité</strong> → <em>Structurel → Serveur IA</em> : clés API, limites et <strong>quels utilisateurs</strong> de la société peuvent l'utiliser.</li>
    </ul>
</div>

<?php renderEntityConsoleHubCards($structural_items, 'structurel'); ?>

<?php
renderConsolePageClose();
renderEntityConsoleCardScript();
require_once __DIR__ . '/../includes/footer.php';
