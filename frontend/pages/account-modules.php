<?php
/**
 * Mon compte – Configurer mes modules
 * Même logique de cartes que « Configuration de l'entité » (grille cliquable).
 */

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../auth/session.php';
require_once __DIR__ . '/../includes/functions.php';
require_once __DIR__ . '/../includes/entity-console-nav.php';

if (!isLoggedIn()) {
    redirect(url('index.php'));
}

$account_modules = [];
$modules_root = realpath(__DIR__ . '/../../modules');
if ($modules_root && is_dir($modules_root)) {
    foreach (scandir($modules_root) as $module_dir) {
        if ($module_dir === '.' || $module_dir === '..') {
            continue;
        }
        $manifest_path = $modules_root . DIRECTORY_SEPARATOR . $module_dir . DIRECTORY_SEPARATOR . 'module.php';
        if (!file_exists($manifest_path)) {
            continue;
        }
        $manifest = require $manifest_path;
        if (empty($manifest['user']) || empty($manifest['user']['config_url'])) {
            continue;
        }
        $id = $manifest['id'] ?? $module_dir;
        $account_modules[] = [
            'id' => $id,
            'title' => $manifest['name'] ?? ucfirst($id),
            'description' => $manifest['description'] ?? '',
            'icon' => $manifest['icon'] ?? '🧩',
            'url' => url($manifest['user']['config_url']),
        ];
    }
}

$page_title = 'Mes applications';
require_once __DIR__ . '/../includes/header.php';
renderConsoleLayoutStart(
    'Mes applications',
    'Configuration personnelle de vos applications (ex. serveurs IA, presets fournisseurs).'
);
?>

    <?php if (empty($account_modules)): ?>
        <div class="alert alert-info">
            Aucun module n'expose encore de configuration utilisateur.
        </div>
    <?php else: ?>
        <?php renderConsoleSearchToolbar('Ex. IA…', 'accountModulesSearch', 'Rechercher un module'); ?>

        <div id="accountModulesList" class="hub-cards-grid">
            <?php foreach ($account_modules as $mod): ?>
            <div class="card account-module-card"
                 style="cursor: pointer; border-radius: 10px; overflow: hidden; height: 100%;"
                 data-search="<?= htmlspecialchars(mb_strtolower($mod['title'] . ' ' . $mod['description'])) ?>"
                 data-url="<?= htmlspecialchars($mod['url']) ?>">
                <div class="card-header"
                     style="background-color: #f8f9fa; border-bottom: 2px solid #0d6efd; padding: 1rem 1.25rem; height: 100%;">
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <span style="font-size: 2.2em;"><?= $mod['icon'] ?></span>
                        <div>
                            <h2 style="margin: 0; font-size: 1.25rem;"><?= htmlspecialchars($mod['title']) ?></h2>
                            <p style="margin: 0.35rem 0 0 0; font-size: 0.9em; color: #666; line-height: 1.3em; max-height: 2.6em; overflow: hidden;">
                                <?= htmlspecialchars($mod['description']) ?>
                            </p>
                        </div>
                    </div>
                </div>
            </div>
            <?php endforeach; ?>
        </div>

        <div id="accountModulesNoResult" class="entity-console-empty" style="display: none;">
            <p>Aucun module ne correspond à votre recherche.</p>
        </div>
    <?php endif; ?>

<script>
(function() {
    var searchEl = document.getElementById('accountModulesSearch');
    var cards = document.querySelectorAll('.account-module-card');
    var noResult = document.getElementById('accountModulesNoResult');

    function filter() {
        var q = (searchEl && searchEl.value || '').trim().toLowerCase();
        var visible = 0;
        for (var i = 0; i < cards.length; i++) {
            var card = cards[i];
            var text = (card.getAttribute('data-search') || '').toLowerCase();
            var show = !q || text.indexOf(q) !== -1;
            card.style.display = show ? '' : 'none';
            if (show) visible++;
        }
        if (noResult) noResult.style.display = visible === 0 ? 'block' : 'none';
    }

    cards.forEach(function(card) {
        card.addEventListener('click', function() {
            var u = card.getAttribute('data-url');
            if (u) window.location.href = u;
        });
    });

    if (searchEl) {
        searchEl.addEventListener('input', filter);
        searchEl.addEventListener('keyup', filter);
    }
})();
</script>

<?php
renderConsoleLayoutEnd();
require_once __DIR__ . '/../includes/footer.php';
