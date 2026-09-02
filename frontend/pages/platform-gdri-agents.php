<?php
/**
 * Console plateforme — Agents GDRI officiels (importables comme sous-agents).
 */

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../auth/session.php';
require_once __DIR__ . '/../includes/functions.php';
require_once __DIR__ . '/../includes/entity-console-nav.php';

requirePlatformConsoleAccess();

$page_title = 'Agents GDRI';
require_once __DIR__ . '/../includes/header.php';
renderConsoleLayoutStart(
    'Agents GDRI',
    'Agents officiels de la plateforme. Ce ne sont pas des briques cachées : chaque agent a un flux visible. On les crée / ouvre en console entité, puis on les importe comme sous-agent.',
    ['narrow' => false]
);
renderConsoleBackLink('Agents IA', url('pages/platform-agents.php'));

$entityAgentsUrl = url('pages/entity-agents.php');
$entityModeUrl = url('auth/set-nav-mode.php?mode=entity');
$createDesignUrl = url('pages/entity-agents.php?create=agent-design-page-web');
?>

<div class="card" style="margin-bottom:1.25rem;">
    <div class="card-body">
        <h2 style="margin:0 0 8px; font-size:1.1rem;">Design page web</h2>
        <p class="text-muted" style="margin:0 0 12px;">
            Couleurs, logo, zones (header, nav, main, footer). Aucun champ métier.
            Flux : déclencher → collection → champs → IA chrome → sauver → accrocher (onglet).
            Importable dans un autre agent via le bloc <strong>Sous-agent</strong>.
        </p>
        <p>
            <a class="btn btn-primary" href="<?= htmlspecialchars($createDesignUrl) ?>">Créer / ouvrir dans la console entité</a>
            <a class="btn btn-outline" href="<?= htmlspecialchars($entityModeUrl) ?>">Passer en console entité</a>
        </p>
        <p class="text-muted small" style="margin:8px 0 0;">
            Ensuite : <a href="<?= htmlspecialchars($entityAgentsUrl) ?>">Agents IA</a> → carte « Design page web ».
        </p>
    </div>
</div>

<?php
renderConsoleLayoutEnd();
require_once __DIR__ . '/../includes/footer.php';
