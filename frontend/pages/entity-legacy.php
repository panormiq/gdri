<?php
/**
 * Legacy — hub unique : applications, agents et configuration (migration progressive).
 */

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../auth/session.php';
require_once __DIR__ . '/../includes/functions.php';
require_once __DIR__ . '/../includes/jwt-helper.php';
require_once __DIR__ . '/../includes/entity-config-items.php';
require_once __DIR__ . '/../includes/entity-console-nav.php';

if (!hasRole(ROLE_ADMIN_GDRI) && !hasRole(ROLE_ADMIN_ENTITY) && !hasRole(ROLE_USER_ENTITY)) {
    redirect(url('pages/dashboard.php'));
}

$currentEntrepriseId = $_SESSION['currentEntrepriseId'] ?? ($_SESSION['entrepriseId'] ?? null);
if (hasRole(ROLE_ADMIN_GDRI) && empty($currentEntrepriseId)) {
    redirect(url('pages/dashboard.php'));
}

$canManageEntity = hasRole(ROLE_ADMIN_GDRI) || hasRole(ROLE_ADMIN_ENTITY);
$authorized_service_slugs = $canManageEntity ? fetchAuthorizedServiceSlugsForEntity() : [];
$legacy_items = buildLegacyHubItems($authorized_service_slugs, $canManageEntity);

$page_title = 'Legacy';
require_once __DIR__ . '/../includes/header.php';
renderConsoleLayoutStart(
    'Legacy',
    'Point d\'entrée unique le temps de la migration vers la console entité.'
);
?>

<?php renderConsoleSearchToolbar('App, agent, mail, UGAP…', 'legacySearch'); ?>

    <div id="legacyList" class="hub-cards-grid">
        <?php foreach ($legacy_items as $item): ?>
        <div class="card legacy-card"
             data-kind="<?= htmlspecialchars($item['kind']) ?>"
             data-first-url="<?= htmlspecialchars($item['url']) ?>"
             data-search="<?= htmlspecialchars(mb_strtolower($item['kindLabel'] . ' ' . $item['title'] . ' ' . $item['description'])) ?>">
            <div class="card-header legacy-card__inner legacy-card__inner--<?= htmlspecialchars($item['kind']) ?>">
                <span class="legacy-card__kind"><?= htmlspecialchars($item['kindLabel']) ?></span>
                <div style="display: flex; align-items: center; gap: 12px; margin-top: 0.5rem;">
                    <span style="font-size: 2.2em;"><?= $item['icon'] ?></span>
                    <div>
                        <h2 style="margin: 0; font-size: 1.25rem;"><?= htmlspecialchars($item['title']) ?></h2>
                        <p style="margin: 0.35rem 0 0 0; font-size: 0.9em; color: #666; line-height: 1.3em;">
                            <?= htmlspecialchars($item['description']) ?>
                        </p>
                    </div>
                </div>
            </div>
        </div>
        <?php endforeach; ?>
    </div>

    <div id="legacyNoResult" class="entity-console-empty" style="display: none;">
        <p>Aucun élément ne correspond à votre recherche.</p>
    </div>

<style>
.legacy-card {
    cursor: pointer;
    border-radius: 10px;
    overflow: hidden;
    height: 100%;
}
.legacy-card__inner {
    background-color: #f8f9fa;
    padding: 1rem 1.25rem;
    height: 100%;
    border-bottom: 3px solid #6c757d;
}
.legacy-card__inner--application { border-bottom-color: #0d6efd; }
.legacy-card__inner--agent { border-bottom-color: #3949ab; }
.legacy-card__inner--config { border-bottom-color: #6c757d; }
.legacy-card__kind {
    display: inline-block;
    font-size: 0.68rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: #495057;
    background: #e9ecef;
    border-radius: 999px;
    padding: 0.2rem 0.55rem;
}
</style>

<script>
(function() {
    var searchEl = document.getElementById('legacySearch');
    var cards = document.querySelectorAll('.legacy-card');
    var noResult = document.getElementById('legacyNoResult');

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
            var url = card.getAttribute('data-first-url');
            if (url && url !== '#') window.location.href = url;
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
require_once __DIR__ . '/../includes/footer.php'; ?>
