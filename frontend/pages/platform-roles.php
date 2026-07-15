<?php
/**
 * Alias — rôles métier = console entité uniquement.
 */
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../auth/session.php';
require_once __DIR__ . '/../includes/functions.php';

if (!hasRole(ROLE_ADMIN_GDRI)) {
    redirect(url('pages/dashboard.php'));
}

redirect(url('auth/set-nav-mode.php?mode=entity'));
