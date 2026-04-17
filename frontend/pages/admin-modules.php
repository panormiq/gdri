<?php
/**
 * Administration des Modules - ADMIN_GDRI uniquement
 * Liste des modules avec lien "Configurer" vers la page dédiée à chaque module
 */

require_once '../config/config.php';
require_once '../config/database.php';
require_once '../auth/session.php';
require_once '../includes/functions.php';
require_once '../includes/jwt-helper.php';

if (!hasRole(ROLE_ADMIN_GDRI)) {
    redirect(url('pages/dashboard.php'));
}

$page_title = 'Administration des Modules';
require_once '../includes/header.php';

// Liste des modules administrables (id, titre, description, icône, url config) – réservé ADMIN_GDRI
$admin_modules = [
    [
        'id' => 'ia',
        'title' => 'Module IA – Serveurs',
        'description' => 'Serveurs IA (backendIA, Ollama, OpenAI...).',
        'icon' => '🤖',
        'configUrl' => url('pages/modules/ia-config.php'),
        'configLabel' => 'Gérer les serveurs IA',
    ],
    [
        'id' => 'facebook',
        'title' => 'Module Facebook',
        'description' => 'Application Facebook, OAuth et pages liées.',
        'icon' => '📘',
        'configUrl' => url('pages/modules/facebook-app-config.php'),
        'configLabel' => 'Configurer le module Facebook',
    ],
    [
        'id' => 'mail',
        'title' => 'Module Mail',
        'description' => 'Fournisseurs mail IMAP/SMTP pour les presets.',
        'icon' => '📧',
        'configUrl' => url('pages/admin-modules-mail.php'),
        'configLabel' => 'Configurer les fournisseurs mail',
    ],
];
?>

<div class="container" style="max-width: 1200px; margin: 2rem auto; padding: 0 1rem;">
    <div style="margin-bottom: 2rem;">
        <h1>Administration des Modules</h1>
        <p style="color: #666; font-size: 1.1em;">
            Choisissez un module pour accéder à sa configuration
        </p>
    </div>

    <div class="form-group" style="margin-bottom: 1.5rem; max-width: 400px;">
        <label for="adminModulesSearch" class="small" style="display: block; margin-bottom: 0.25rem;">Rechercher un module</label>
        <input type="text" id="adminModulesSearch" class="form-control" placeholder="Ex. mail, facebook..." autocomplete="off" />
    </div>

    <div id="adminModulesList"
         style="
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
            gap: 1.2rem;
         ">
        <?php foreach ($admin_modules as $mod): ?>
        <div class="card admin-module-card"
             style="cursor: pointer; border-radius: 10px; overflow: hidden; height: 100%;"
             data-module-id="<?= htmlspecialchars($mod['id']) ?>"
             data-config-url="<?= htmlspecialchars($mod['configUrl']) ?>"
             data-search="<?= htmlspecialchars(mb_strtolower($mod['title'] . ' ' . $mod['description'])) ?>">
            <div class="card-header"
                 style="background-color: #f8f9fa; border-bottom: 2px solid #0d6efd; padding: 1rem 1.25rem; height: 100%;">
                <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.75rem;">
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <span style="font-size: 2.2em;"><?= $mod['icon'] ?></span>
                        <div>
                            <h2 style="margin: 0; font-size: 1.25rem;"><?= htmlspecialchars($mod['title']) ?></h2>
                            <p style="margin: 0.35rem 0 0 0; font-size: 0.9em; color: #666; line-height:1.3em; max-height:2.6em; overflow:hidden;">
                                <?= htmlspecialchars($mod['description']) ?>
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        <?php endforeach; ?>
    </div>

    <div id="adminModulesNoResult" style="display: none; padding: 2rem; text-align: center; color: #666;">
        Aucun module ne correspond à votre recherche.
    </div>
</div>

<script>
(function() {
    var searchEl = document.getElementById('adminModulesSearch');
    var cards = document.querySelectorAll('.admin-module-card');
    var noResult = document.getElementById('adminModulesNoResult');

    function filterModules() {
        var q = (searchEl && searchEl.value || '').trim().toLowerCase();
        var visible = 0;
        cards.forEach(function(card) {
            var text = (card.getAttribute('data-search') || '').toLowerCase();
            var show = !q || text.indexOf(q) !== -1;
            card.style.display = show ? '' : 'none';
            if (show) visible++;
        });
        if (noResult) noResult.style.display = visible === 0 ? 'block' : 'none';
    }

    // Navigation au clic sur la card
    cards.forEach(function(card) {
        card.addEventListener('click', function() {
            var url = card.getAttribute('data-config-url');
            if (url) {
                window.location.href = url;
            }
        });
    });

    if (searchEl) {
        searchEl.addEventListener('input', filterModules);
        searchEl.addEventListener('keyup', filterModules);
    }
})();
</script>

<?php require_once '../includes/footer.php'; ?>
