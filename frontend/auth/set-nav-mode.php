<?php
/**
 * Bascule espace de travail : platform | entity | user
 */

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/session.php';
require_once __DIR__ . '/../includes/functions.php';

if (!isLoggedIn()) {
    redirect(url('index.php'));
}

$mode = strtolower(trim((string) ($_GET['mode'] ?? '')));
if (!in_array($mode, ['platform', 'entity', 'user'], true)) {
    redirect(url('pages/dashboard.php'));
}

if ($mode === 'platform' && !canAccessPlatformConsole()) {
    redirect(url('pages/dashboard.php'));
}

if ($mode === 'entity' && !canAccessEntityConsole()) {
    redirect(url('pages/dashboard.php'));
}

$_SESSION['gdri_workspace_mode'] = $mode;
$_SESSION['gdri_admin_nav_mode'] = $mode === 'platform' ? 'platform' : 'entity';

if ($mode === 'platform') {
    redirect(url('pages/entities.php'));
}

if ($mode === 'entity') {
    redirect(url('pages/entity-applications.php'));
}

redirect(url('pages/dashboard.php'));
