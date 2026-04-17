<?php
/**
 * Wrapper PHP du module Chat
 * - Utilise le header/footer global GDRI
 * - Embarque l'UI chat (HTML autonome) en mode embedded
 */

require_once '../../config/config.php';
require_once '../../auth/session.php';
require_once '../../includes/functions.php';

if (!hasRole(ROLE_ADMIN_GDRI) && !hasRole(ROLE_ADMIN_ENTITY) && !hasRole(ROLE_USER_ENTITY)) {
    redirect(url('pages/dashboard.php'));
}

$page_title = 'Chat IA';
require_once '../../includes/header.php';
?>

<section class="section">
    <div class="container">
        <div class="section-title" style="display:flex; justify-content:space-between; align-items:center; gap:10px; margin-bottom:14px;">
            <h2 style="margin:0;">Assistant IA</h2>
            <a class="btn btn-secondary" href="<?= url('pages/modules.php') ?>">Retour modules</a>
        </div>

        <div style="background:#fff; border-radius:10px; box-shadow:0 2px 8px rgba(0,0,0,.06); overflow:hidden;">
            <iframe
                src="/modules/chat/frontend/index.html?embedded=1"
                title="Module Chat IA"
                style="width:100%; height:calc(100vh - 260px); min-height:620px; border:0; display:block;"
                loading="eager"
                referrerpolicy="strict-origin-when-cross-origin"
            ></iframe>
        </div>
    </div>
</section>

<?php require_once '../../includes/footer.php'; ?>
