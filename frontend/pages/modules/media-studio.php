<?php
/**
 * Studio Média — chat IA + génération d'images
 */

require_once '../../config/config.php';
require_once '../../auth/session.php';
require_once '../../includes/functions.php';

if (!hasRole(ROLE_ADMIN_GDRI) && !hasRole(ROLE_ADMIN_ENTITY) && !hasRole(ROLE_USER_ENTITY)) {
    redirect(url('pages/dashboard.php'));
}

$page_title = 'Studio Média';
require_once '../../includes/header.php';
?>

<?php
$msIndexPath = dirname(__DIR__, 3) . '/modules/media-studio/frontend/index.html';
$msAssetVer = is_file($msIndexPath) ? (string) filemtime($msIndexPath) : '1';
$msApiBase = function_exists('getApiBaseUrl') ? getApiBaseUrl() : 'http://localhost:3000/api';
$msWebRoot = preg_replace('#/frontend/?$#', '', rtrim(BASE_URL, '/'));
$msIframeSrc = ($msWebRoot !== '' ? $msWebRoot : '') . '/modules/media-studio/frontend/index.html';
$msIframeQuery = http_build_query([
    'embedded' => '1',
    'v' => $msAssetVer,
    'apiBase' => $msApiBase,
]);
?>
<section class="section">
    <div class="container" style="max-width: none; padding: 0 12px;">
        <div style="background:#0f1117; border-radius:10px; overflow:hidden; box-shadow:0 2px 12px rgba(0,0,0,.15);">
            <iframe
                src="<?php echo htmlspecialchars($msIframeSrc . '?' . $msIframeQuery, ENT_QUOTES, 'UTF-8'); ?>"
                title="Studio Média"
                style="width:100%; height:calc(100vh - 200px); min-height:640px; border:0; display:block;"
                loading="eager"
                referrerpolicy="strict-origin-when-cross-origin"
            ></iframe>
        </div>
    </div>
</section>

<?php require_once '../../includes/footer.php'; ?>
