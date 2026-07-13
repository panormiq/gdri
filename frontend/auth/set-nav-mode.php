<?php
/**
 * Bascule mode navigation sidebar : entité ↔ plateforme (ADMIN_GDRI).
 */

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/session.php';
require_once __DIR__ . '/../includes/functions.php';

if (!isLoggedIn() || !hasRole(ROLE_ADMIN_GDRI)) {
    redirect(url('pages/dashboard.php'));
}

$mode = strtolower(trim((string) ($_GET['mode'] ?? '')));
if ($mode !== 'entity' && $mode !== 'platform') {
    redirect(url('pages/dashboard.php'));
}

$_SESSION['gdri_admin_nav_mode'] = $mode;

if ($mode === 'platform') {
    redirect(url('pages/entities.php'));
}

redirect(url('pages/dashboard.php'));
