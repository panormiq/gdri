<?php
/**
 * Page d'administration UGAP
 * Wrapper PHP pour vérifier l'authentification et les permissions
 * Les cookies JWT sont gérés par le système GDRI central, pas ici
 */

require_once '../../../config/config.php';
require_once '../../../auth/session.php';
require_once '../../../includes/functions.php';

// Vérifier que l'utilisateur est connecté
if (!isLoggedIn()) {
    redirect(url('auth/login-process.php'));
}

// Vérifier les permissions (ADMIN_GDRI ou ADMIN_ENTITY)
if (!hasRole(ROLE_ADMIN_GDRI) && !hasRole(ROLE_ADMIN_ENTITY)) {
    redirect(url('pages/dashboard.php'));
}

// Lire et afficher le contenu HTML
// Les cookies sont gérés automatiquement par le système GDRI via les middlewares d'authentification
readfile(__DIR__ . '/admin.html');
?>
