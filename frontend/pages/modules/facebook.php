<?php
/**
 * Hub Module Facebook - navigation par onglets
 */

require_once '../../config/config.php';
require_once '../../auth/session.php';
require_once '../../includes/functions.php';
require_once '../../includes/jwt-helper.php';

function hasFacebookServiceAccessViaApi()
{
    if (hasRole(ROLE_ADMIN_GDRI) || hasRole(ROLE_ADMIN_ENTITY)) {
        return true;
    }
    if (!hasRole(ROLE_USER_ENTITY)) {
        return false;
    }
    $token = getJWTToken();
    $apiBase = rtrim(getApiBaseUrl(), '/');
    if (!$token || !$apiBase) {
        return false;
    }
    $ch = curl_init($apiBase . '/users/me/services-context');
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Authorization: Bearer ' . $token,
        'Content-Type: application/json'
    ]);
    curl_setopt($ch, CURLOPT_TIMEOUT, 20);
    $raw = curl_exec($ch);
    $err = curl_error($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    if ($err || $code < 200 || $code >= 300) {
        return false;
    }
    $decoded = json_decode((string) $raw, true);
    $services = is_array($decoded['data']['services'] ?? null) ? $decoded['data']['services'] : [];
    foreach ($services as $service) {
        $slug = strtolower(trim((string) ($service['slug'] ?? '')));
        $name = strtolower(trim((string) ($service['name'] ?? '')));
        if ($slug === 'facebook' || strpos($name, 'facebook') !== false) {
            return true;
        }
    }
    return false;
}

if (!isLoggedIn() || !hasFacebookServiceAccessViaApi()) {
    redirect(url('pages/dashboard.php'));
}

$page_title = 'Module Facebook';
require_once '../../includes/header.php';

$tabs = [
    'resume' => [
        'label' => 'Resume',
        'url' => url('pages/modules/facebook-resume.php')
    ],
    'config' => [
        'label' => 'Connexion',
        'url' => url('pages/modules/facebook-config.php')
    ],
    'agent' => [
        'label' => 'Agent IA',
        'url' => url('pages/modules/analyse-intention-config.php')
    ],
    'llms' => [
        'label' => 'LLMs',
        'url' => url('pages/modules/ia-llms.php')
    ],
    'publish' => [
        'label' => 'Posts',
        'url' => url('pages/modules/facebook-publish.php')
    ]
];

$activeTab = isset($_GET['tab']) ? strtolower(trim((string) $_GET['tab'])) : 'resume';
if (!isset($tabs[$activeTab])) {
    $activeTab = 'resume';
}

// Reprendre les paramètres OAuth / navigation vers la page chargée dans l’iframe (ex. success, reauth)
$queryForFrame = $_GET;
unset($queryForFrame['tab']);
$frameSrc = $tabs[$activeTab]['url'];
if (!empty($queryForFrame)) {
    $sep = (strpos($frameSrc, '?') !== false) ? '&' : '?';
    $frameSrc .= $sep . http_build_query($queryForFrame);
}
?>

<div class="container" style="max-width: 1200px; margin: 2rem auto; padding: 0 1rem;">
    <div style="display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap; margin-bottom: 1rem;">
        <h1 style="margin: 0;">Module Facebook</h1>
        <a href="<?= url('pages/modules.php') ?>" class="btn btn-outline">← Modules</a>
    </div>

    <p class="text-muted" style="margin-bottom: 1rem;">
        Navigation centralisee du module Facebook.
    </p>

    <div class="fb-module-tabs" role="tablist" aria-label="Navigation module Facebook">
        <?php foreach ($tabs as $tabKey => $tab): ?>
            <button
                type="button"
                class="fb-tab-btn <?= $tabKey === $activeTab ? 'active' : '' ?>"
                data-tab="<?= htmlspecialchars($tabKey) ?>"
                data-url="<?= htmlspecialchars($tab['url']) ?>">
                <?= htmlspecialchars($tab['label']) ?>
            </button>
        <?php endforeach; ?>
    </div>

    <div class="fb-tab-panel">
        <iframe
            id="fb-module-frame"
            src="<?= htmlspecialchars($frameSrc) ?>"
            title="Contenu module Facebook"
            loading="lazy"></iframe>
    </div>
</div>

<style>
.fb-module-tabs {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    border-bottom: 1px solid #dee2e6;
    padding-bottom: 0.75rem;
    margin-bottom: 1rem;
}
.fb-tab-btn {
    border: 1px solid #dee2e6;
    background: #fff;
    color: #495057;
    border-radius: 6px;
    padding: 0.45rem 0.9rem;
    cursor: pointer;
    font-size: 0.95rem;
}
.fb-tab-btn:hover { background: #f8f9fa; }
.fb-tab-btn.active {
    border-color: #0d6efd;
    color: #0d6efd;
    background: #eef5ff;
}
.fb-tab-panel {
    border: 1px solid #dee2e6;
    border-radius: 8px;
    overflow: hidden;
    background: #fff;
}
#fb-module-frame {
    width: 100%;
    min-height: 78vh;
    border: 0;
    display: block;
}
</style>

<script>
(function() {
    var tabs = document.querySelectorAll('.fb-tab-btn');
    var frame = document.getElementById('fb-module-frame');
    if (!tabs.length || !frame) return;

    function hideEmbeddedHeaderFooter() {
        try {
            var doc = frame.contentDocument || (frame.contentWindow && frame.contentWindow.document);
            if (!doc) return;
            var selectors = ['header.header', 'footer.footer', '#header', '#footer', '.header', '.footer'];
            selectors.forEach(function(sel) {
                doc.querySelectorAll(sel).forEach(function(el) {
                    el.style.display = 'none';
                });
            });
            if (doc.body) {
                doc.body.style.paddingTop = '0';
                doc.body.style.marginTop = '0';
            }
        } catch (e) {
            // ignore cross-frame access issues
        }
    }

    frame.addEventListener('load', hideEmbeddedHeaderFooter);

    tabs.forEach(function(tab) {
        tab.addEventListener('click', function() {
            tabs.forEach(function(other) { other.classList.remove('active'); });
            tab.classList.add('active');
            var targetUrl = tab.getAttribute('data-url');
            var tabKey = tab.getAttribute('data-tab');
            if (targetUrl) frame.src = targetUrl;
            if (tabKey) {
                var nextUrl = new URL(window.location.href);
                nextUrl.searchParams.set('tab', tabKey);
                history.replaceState({}, '', nextUrl.toString());
            }
        });
    });
})();
</script>
<?php require_once '../../includes/footer.php'; ?>
