<?php
/**
 * Alias legacy de l'ancienne page optimisée.
 * Redirige vers la page API-first canonique.
 */
require_once '../config/config.php';
require_once '../auth/session.php';
require_once '../includes/functions.php';

if (!hasRole(ROLE_ADMIN_GDRI)) {
    redirect(url('pages/dashboard.php'));
}

redirect(url('pages/entities.php'));
