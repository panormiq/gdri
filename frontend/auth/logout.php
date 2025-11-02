<?php
/**
 * Déconnexion utilisateur
 * Fichier : auth/logout.php
 */

require_once '../config/config.php';
require_once '../includes/functions.php';
require_once 'session.php';

// Détruire toutes les variables de session
$_SESSION = array();

// Détruire le cookie de session
if (ini_get("session.use_cookies")) {
    $params = session_get_cookie_params();
    setcookie(
        session_name(),
        '',
        time() - 42000,
        $params["path"],
        $params["domain"],
        $params["secure"],
        $params["httponly"]
    );
}

// Détruire la session
session_destroy();

// Rediriger vers la page d'accueil
redirect(url('index.php'));





