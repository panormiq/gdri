<?php
/**
 * Configuration générale du site - GDRI
 * Fichier : config/config.php
 */

// Timezone
date_default_timezone_set('Europe/Paris');

// Environnement (development ou production)
define('ENVIRONMENT', 'development');

// Affichage des erreurs (à désactiver en production)
if (ENVIRONMENT === 'development') {
    error_reporting(E_ALL);
    ini_set('display_errors', 1);
} else {
    error_reporting(0);
    ini_set('display_errors', 0);
}

// Configuration du site
define('SITE_NAME', 'GDR-Innovation');
define('SITE_SLOGAN', 'Simplifiez-vous la vie');
define('SITE_EMAIL', 'contact@gdr-innovation.fr');
define('SITE_PHONE', '06 84 28 63 47');
define('SITE_ADDRESS', '921 impasse de la grange de rideaux, 72150 Le Grand-Lucé');
define('SITE_SIRET', '800944 407');

/**
 * Détecte automatiquement l'environnement et génère BASE_URL
 * Fonctionne en localhost et en production sans modification
 */
function getBaseUrl() {
    // Détecter si on est en localhost ou en production
    $isLocalhost = (
        isset($_SERVER['HTTP_HOST']) && 
        ($_SERVER['HTTP_HOST'] === 'localhost' || 
         $_SERVER['HTTP_HOST'] === '127.0.0.1' ||
         strpos($_SERVER['HTTP_HOST'], 'localhost') !== false ||
         strpos($_SERVER['HTTP_HOST'], '127.0.0.1') !== false)
    );
    
    // Toujours utiliser SCRIPT_NAME pour extraire le chemin
    $scriptName = $_SERVER['SCRIPT_NAME'] ?? '/index.php';
    
    // Extraire le chemin jusqu'à "frontend"
    $pathParts = array_filter(explode('/', $scriptName));
    $pathParts = array_values($pathParts); // Réindexer
    
    $frontendPos = array_search('frontend', $pathParts);
    
    if ($frontendPos !== false) {
        // Reconstruire le chemin jusqu'à frontend inclus
        // Exemple: /gdri/frontend/ ou /frontend/
        $baseParts = array_slice($pathParts, 0, $frontendPos + 1);
        $basePath = '/' . implode('/', $baseParts) . '/';
    } else {
        // Si "frontend" n'est pas trouvé dans le chemin
        if ($isLocalhost) {
            // En localhost, chercher "gdri"
            $gdriPos = array_search('gdri', $pathParts);
            if ($gdriPos !== false) {
                $basePath = '/gdri/frontend/';
            } else {
                $basePath = '/frontend/';
            }
        } else {
            // En production, même si frontend n'est pas dans SCRIPT_NAME,
            // les fichiers sont toujours dans /frontend/
            // Exemple: https://www.gdri.fr/ -> BASE_URL = /frontend/
            $basePath = '/frontend/';
        }
    }
    
    // Normaliser les slashes multiples
    $basePath = preg_replace('#(?<!:)/+#', '/', $basePath);
    
    return $basePath;
}

/**
 * Génère l'URL de base de l'API backend
 * Détecte automatiquement si on est en localhost ou en production
 */
if (!function_exists('getApiBaseUrl')) {
    function getApiBaseUrl() {
        $isLocalhost = (
            isset($_SERVER['HTTP_HOST']) && 
            ($_SERVER['HTTP_HOST'] === 'localhost' || 
             $_SERVER['HTTP_HOST'] === '127.0.0.1' ||
             strpos($_SERVER['HTTP_HOST'], 'localhost') !== false ||
             strpos($_SERVER['HTTP_HOST'], '127.0.0.1') !== false)
        );
        
        if ($isLocalhost) {
            // En localhost, utiliser le backend Node.js directement
            return 'http://localhost:3000/api';
        } else {
            // En production, utiliser le reverse proxy Apache
            $protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
            $host = $_SERVER['HTTP_HOST'] ?? 'www.gdr-innovation.fr';
            return $protocol . '://' . $host . '/api';
        }
    }
}

// Définir BASE_URL avec détection automatique
if (!defined('BASE_URL')) {
    define('BASE_URL', getBaseUrl());
}

// Définir API_BASE_URL avec détection automatique
if (!defined('API_BASE_URL')) {
    define('API_BASE_URL', getApiBaseUrl());
}

// Rôles utilisateurs
define('ROLE_ADMIN_GDRI', 'ADMIN_GDRI');
define('ROLE_ADMIN_ENTITY', 'ADMIN_ENTITY');
define('ROLE_USER_ENTITY', 'USER_ENTITY');

// Statuts
define('STATUS_ACTIVE', 'active');
define('STATUS_INACTIVE', 'inactive');





