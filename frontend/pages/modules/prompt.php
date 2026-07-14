<?php
/**
 * Module Prompt — fusionné dans Serveur IA (plus de page dédiée).
 */

require_once '../../config/config.php';
require_once '../../auth/session.php';
require_once '../../includes/functions.php';

if (!hasRole(ROLE_ADMIN_GDRI) && !hasRole(ROLE_ADMIN_ENTITY)) {
    redirect(url('pages/dashboard.php'));
}

redirect(url('pages/entity-structurel.php'));
