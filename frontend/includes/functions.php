<?php
/**
 * Fonctions utilitaires PHP - GDRI
 * Fichier : includes/functions.php
 * 
 * Fonctions liées aux opérations communes du site
 */

/**
 * Échappe les caractères HTML pour éviter les injections XSS
 * @param string $string La chaîne à échapper
 * @return string La chaîne échappée
 */
function escape($string) {
    return htmlspecialchars($string, ENT_QUOTES, 'UTF-8');
}

/**
 * Redirige vers une URL
 * @param string $url L'URL de redirection
 */
function redirect($url) {
    header("Location: $url");
    exit();
}

/**
 * Vérifie si l'utilisateur est connecté
 * @return bool True si connecté, false sinon
 */
function isLoggedIn() {
    return isset($_SESSION['user_id']) && !empty($_SESSION['user_id']);
}

/**
 * Récupère le rôle de l'utilisateur connecté
 * @return string|null Le rôle ou null si non connecté
 */
function getUserRole() {
    return $_SESSION['user_role'] ?? null;
}

/**
 * Vérifie si l'utilisateur a un rôle spécifique
 * @param string $role Le rôle à vérifier
 * @return bool True si l'utilisateur a ce rôle
 */
function hasRole($role) {
    return isLoggedIn() && getUserRole() === $role;
}

/**
 * Retourne le chemin racine du site
 * @return string Le chemin racine
 */
function getRootPath() {
    return defined('BASE_URL') ? BASE_URL : '/';
}

/**
 * Génère une URL complète à partir d'un chemin relatif
 * @param string $path Le chemin relatif
 * @return string L'URL complète (normalisée)
 */
function url($path = '') {
    $baseUrl = getRootPath();
    $cleanPath = ltrim($path, '/');
    $finalUrl = $baseUrl . $cleanPath;
    
    // Normaliser les slashes multiples (sauf après http:// ou https://)
    $finalUrl = preg_replace('#(?<!:)/+#', '/', $finalUrl);
    
    return $finalUrl;
}

/**
 * Retourne l'URL de base de l'API
 * @return string L'URL de base de l'API
 */
if (!function_exists('getApiBaseUrl')) {
    function getApiBaseUrl() {
        return defined('API_BASE_URL') ? API_BASE_URL : 'http://localhost:3000/api';
    }
}

/**
 * Retourne le titre de la page actuelle
 * @param string $pageTitle Le titre de la page
 * @return string Le titre complet avec le nom du site
 */
function pageTitle($pageTitle = '') {
    $siteName = 'GDR-Innovation';
    return $pageTitle ? "$pageTitle - $siteName" : $siteName;
}


