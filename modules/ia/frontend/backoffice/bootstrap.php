<?php
/**
 * Bootstrap backoffice IA : définit la racine projet et charge config / auth.
 * À inclure en premier dans chaque page du backoffice.
 * Fichier : modules/ia/frontend/backoffice/bootstrap.php
 */
if (!defined('GDRI_ROOT')) {
    define('GDRI_ROOT', realpath(__DIR__ . '/../../../../'));
}
require_once GDRI_ROOT . '/frontend/config/config.php';
require_once GDRI_ROOT . '/frontend/config/database.php';
require_once GDRI_ROOT . '/frontend/auth/session.php';
require_once GDRI_ROOT . '/frontend/includes/functions.php';
require_once GDRI_ROOT . '/frontend/includes/jwt-helper.php';
