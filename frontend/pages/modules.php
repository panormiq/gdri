<?php
/**
 * Applications — apps migrées depuis Legacy.
 */

require_once '../config/config.php';
require_once '../auth/session.php';
require_once '../includes/functions.php';

if (!hasRole(ROLE_ADMIN_GDRI) && !hasRole(ROLE_ADMIN_ENTITY) && !hasRole(ROLE_USER_ENTITY)) {
    redirect(url('pages/dashboard.php'));
}

$canManageEntity = hasRole(ROLE_ADMIN_GDRI) || hasRole(ROLE_ADMIN_ENTITY);
$application_items = buildApplicationHubItems($canManageEntity);

$page_title = 'Applications';
require_once '../includes/header.php';
?>

<section class="hero">
    <div class="container">
        <div class="hero-content">
            <h1>Applications</h1>
            <p class="hero-description">
                Outils métier de votre entité. Le reste est encore accessible via
                <a href="<?= url('pages/entity-legacy.php') ?>">Legacy</a>.
            </p>
        </div>
    </div>
</section>

<section class="section">
    <div class="container" style="max-width: 1200px;">
        <?php if (empty($application_items)): ?>
            <div class="applications-empty">
                <p>Aucune application disponible pour cette entité.</p>
                <p class="text-muted small">Consultez <a href="<?= url('pages/entity-legacy.php') ?>">Legacy</a> pour l'ensemble des modules.</p>
            </div>
        <?php else: ?>
            <div class="form-group" style="margin-bottom: 1.5rem; max-width: 400px;">
                <label for="applicationsSearch" class="small" style="display: block; margin-bottom: 0.25rem;">Rechercher</label>
                <input type="text" id="applicationsSearch" class="form-control" placeholder="UGAP, GDERPI, Workflow…" autocomplete="off" />
            </div>

            <div id="applicationsList" class="hub-cards-grid applications-grid">
                <?php foreach ($application_items as $item): ?>
                <?php
                    $links = is_array($item['links'] ?? null) ? $item['links'] : [];
                    $hasMultipleLinks = count($links) > 1;
                    $searchText = mb_strtolower($item['title'] . ' ' . $item['description']);
                ?>
                <div class="card application-card"
                     data-search="<?= htmlspecialchars($searchText) ?>"
                     data-url="<?= htmlspecialchars($item['url']) ?>"
                     data-multi="<?= $hasMultipleLinks ? '1' : '0' ?>">
                    <div class="application-card__inner">
                        <div class="application-card__head">
                            <span class="application-card__icon"><?= $item['icon'] ?></span>
                            <div>
                                <h2 class="application-card__title"><?= htmlspecialchars($item['title']) ?></h2>
                                <?php if (($item['status'] ?? '') === 'inactive'): ?>
                                    <span class="application-card__status application-card__status--inactive">Inactif</span>
                                <?php endif; ?>
                            </div>
                        </div>
                        <p class="application-card__description"><?= htmlspecialchars($item['description']) ?></p>

                        <?php if ($hasMultipleLinks): ?>
                            <div class="application-card__actions">
                                <?php foreach ($links as $link): ?>
                                    <a href="<?= htmlspecialchars($link['url']) ?>"
                                       class="btn <?= !empty($link['primary']) ? 'btn-primary' : 'btn-outline' ?> btn-sm"
                                       onclick="event.stopPropagation();">
                                        <?= htmlspecialchars($link['label']) ?>
                                    </a>
                                <?php endforeach; ?>
                            </div>
                        <?php else: ?>
                            <p class="application-card__hint text-muted small">Cliquer pour ouvrir</p>
                        <?php endif; ?>
                    </div>
                </div>
                <?php endforeach; ?>
            </div>

            <div id="applicationsNoResult" class="applications-empty" style="display: none;">
                <p>Aucune application ne correspond à votre recherche.</p>
            </div>
        <?php endif; ?>
    </div>
</section>

<style>
.applications-empty {
    padding: 2.5rem 1.5rem;
    text-align: center;
    background: #f8f9fa;
    border: 1px dashed #ced4da;
    border-radius: 10px;
    color: #495057;
}
.applications-empty p { margin: 0 0 0.75rem; }
.application-card {
    border-radius: 10px;
    overflow: hidden;
    min-height: 180px;
    cursor: pointer;
    transition: box-shadow 0.2s ease, transform 0.15s ease;
}
.application-card:hover {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
    transform: translateY(-2px);
}
.application-card[data-multi="1"] {
    cursor: default;
}
.application-card[data-multi="1"]:hover {
    transform: none;
}
.application-card__inner {
    background: #fff;
    border: 1px solid #e9ecef;
    border-bottom: 3px solid #0d6efd;
    padding: 1.1rem 1.25rem;
    height: 100%;
    display: flex;
    flex-direction: column;
}
.application-card__head {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    margin-bottom: 0.5rem;
}
.application-card__icon {
    font-size: 2.2rem;
    line-height: 1;
}
.application-card__title {
    margin: 0;
    font-size: 1.25rem;
    color: var(--color-primary, #0d6efd);
}
.application-card__status {
    display: inline-block;
    margin-top: 0.35rem;
    padding: 2px 8px;
    border-radius: 999px;
    font-size: 0.72rem;
    font-weight: 600;
}
.application-card__status--inactive {
    background: #f8d7da;
    color: #721c24;
}
.application-card__description {
    margin: 0;
    font-size: 0.9em;
    color: #666;
    line-height: 1.35;
    flex: 1;
}
.application-card__hint {
    margin: 0.85rem 0 0;
}
.application-card__actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-top: 0.85rem;
}
</style>

<script>
(function() {
    var searchEl = document.getElementById('applicationsSearch');
    var cards = document.querySelectorAll('.application-card');
    var noResult = document.getElementById('applicationsNoResult');

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
            if (card.getAttribute('data-multi') === '1') {
                return;
            }
            var url = card.getAttribute('data-url');
            if (url && url !== '#') {
                window.location.href = url;
            }
        });
    });

    if (searchEl) {
        searchEl.addEventListener('input', filter);
        searchEl.addEventListener('keyup', filter);
    }
})();
</script>

<?php require_once '../includes/footer.php'; ?>
