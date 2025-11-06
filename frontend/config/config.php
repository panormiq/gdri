<?php
/**
 * Configuration générale du site - GDRI
 * Fichier : config/config.php
 */

// Timezone
date_default_timezone_set('Europe/Paris');

// Détecter automatiquement l'environnement
// 1. D'abord vérifier HTTP_HOST (si www.gdri.fr ou gdr-innovation.fr = production)
// 2. Sinon vérifier la branche Git (master = production, develop = development)
function detectEnvironment() {
    // D'abord, détecter par le hostname (plus fiable pour le serveur en ligne)
    $host = $_SERVER['HTTP_HOST'] ?? '';
    
    // Si on est sur un domaine de production
    if (strpos($host, 'www.gdri.fr') !== false || 
        strpos($host, 'gdr-innovation.fr') !== false ||
        strpos($host, 'gdri.fr') !== false) {
        return 'production';
    }
    
    // Si on est en localhost, c'est le développement
    if ($host === 'localhost' || 
        $host === '127.0.0.1' ||
        strpos($host, 'localhost') !== false ||
        strpos($host, '127.0.0.1') !== false) {
        return 'development';
    }
    
    // Sinon, vérifier la branche Git (fallback)
    try {
        $gitBranch = @shell_exec('git rev-parse --abbrev-ref HEAD 2>nul');
        $gitBranch = trim($gitBranch);
        
        // Si on est sur master, c'est la production
        if ($gitBranch === 'master') {
            return 'production';
        }
        
        // Sinon, c'est le développement
        return 'development';
    } catch (Exception $e) {
        // En cas d'erreur, par défaut en développement
        return 'development';
    }
}

// Définir l'environnement
define('ENVIRONMENT', detectEnvironment());

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
    // Utiliser ENVIRONMENT pour déterminer le mode
    // Si ENVIRONMENT = 'production', on force le mode production
    // Sinon, on détecte automatiquement selon HTTP_HOST
    
    $forceProduction = (ENVIRONMENT === 'production');
    
    // Détecter si on est en localhost ou en production
    $isLocalhost = (
        !$forceProduction && // Si on force la prod, on ignore la détection
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
            // En production, détecter selon HTTP_HOST
            $host = $_SERVER['HTTP_HOST'] ?? '';
            if (strpos($host, 'gdri.fr') !== false || strpos($host, 'gdr-innovation.fr') !== false) {
                // En production, les fichiers peuvent être à la racine ou dans /frontend/
                // On essaie de détecter depuis le chemin du script
                if (strpos($scriptName, '/frontend/') !== false) {
                    $basePath = '/frontend/';
                } else {
                    // Si le script est à la racine, les assets sont peut-être aussi à la racine
                    $basePath = '/';
                }
            } else {
                // Fallback: utiliser /frontend/
                $basePath = '/frontend/';
            }
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
        // Utiliser ENVIRONMENT pour déterminer le mode
        $forceProduction = (ENVIRONMENT === 'production');
        
        // Si on est en production (branche master), utiliser l'API production
        if ($forceProduction) {
            $protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
            $host = $_SERVER['HTTP_HOST'] ?? 'www.gdr-innovation.fr';
            return $protocol . '://' . $host . '/api';
        }
        
        // Sinon, détecter automatiquement
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
            // En production (détectée automatiquement), utiliser le reverse proxy Apache
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





