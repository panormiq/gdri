<?php
/**
 * Configuration IA – Entité : entrée unique depuis Configuration > Module IA.
 * Redirige vers Serveurs (onglets Serveurs | LLMs | Droits sur chaque page).
 */
require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../auth/session.php';
require_once __DIR__ . '/../../includes/functions.php';
require_once __DIR__ . '/../../includes/jwt-helper.php';

if (!hasRole(ROLE_ADMIN_GDRI) && !hasRole(ROLE_ADMIN_ENTITY)) {
    redirect(url('pages/dashboard.php'));
}

$currentEntrepriseId = $_SESSION['currentEntrepriseId'] ?? ($_SESSION['entrepriseId'] ?? null);
if (hasRole(ROLE_ADMIN_GDRI) && empty($currentEntrepriseId)) {
    redirect(url('pages/dashboard.php'));
}

redirect(url('pages/modules/ia-entity-servers.php'));
