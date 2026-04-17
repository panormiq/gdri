<?php
/**
 * Configuration générale du site - GDRI
 * Fichier : config/config.php
 */

// Timezone
date_default_timezone_set('Europe/Paris');

/**
 * Charge les variables d'environnement backend/.env dans le process PHP.
 * Necessaire pour les pages PHP qui doivent lire CREDENTIALS_ENCRYPTION_KEY.
 */
function loadBackendEnvForPhp() {
    static $loaded = false;
    if ($loaded) {
        return;
    }
    $loaded = true;

    $envPath = realpath(__DIR__ . '/../../backend/.env');
    if (!$envPath || !file_exists($envPath)) {
        return;
    }

    $lines = @file($envPath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    if (!is_array($lines)) {
        return;
    }

    foreach ($lines as $line) {
        $line = trim($line);
        if ($line === '' || strpos($line, '#') === 0) {
            continue;
        }

        $eqPos = strpos($line, '=');
        if ($eqPos === false) {
            continue;
        }

        $name = trim(substr($line, 0, $eqPos));
        $value = trim(substr($line, $eqPos + 1));
        if ($name === '') {
            continue;
        }

        // Supprimer les guillemets éventuels autour de la valeur.
        if ((substr($value, 0, 1) === '"' && substr($value, -1) === '"') ||
            (substr($value, 0, 1) === "'" && substr($value, -1) === "'")) {
            $value = substr($value, 1, -1);
        }

        // Ne pas écraser une variable déjà fournie par l'environnement système.
        $current = getenv($name);
        if ($current !== false && $current !== '') {
            continue;
        }

        putenv($name . '=' . $value);
        $_ENV[$name] = $value;
        $_SERVER[$name] = $value;
    }
}

loadBackendEnvForPhp();

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

// Surcharge locale (optionnel) : créer config.local.php et y définir BACKEND_API_URL si besoin
// Ex. define('BACKEND_API_URL', 'http://localhost:3000/api'); quand le front est servi par un vhost sans proxy
$configLocal = __DIR__ . '/config.local.php';
if (file_exists($configLocal)) {
    require_once $configLocal;
}

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
    $forceProduction = (ENVIRONMENT === 'production');
    $host = $_SERVER['HTTP_HOST'] ?? '';
    $scriptName = $_SERVER['SCRIPT_NAME'] ?? '/index.php';

    // Déterminer si le script courant est déjà servi depuis /frontend/
    $servesFromFrontend = (strpos($scriptName, '/frontend/') !== false);

    // Détecter les contextes localhost
    $isLocalhost = (
        isset($_SERVER['HTTP_HOST']) &&
        (
            $_SERVER['HTTP_HOST'] === 'localhost' ||
            $_SERVER['HTTP_HOST'] === '127.0.0.1' ||
            strpos($_SERVER['HTTP_HOST'], 'localhost') !== false ||
            strpos($_SERVER['HTTP_HOST'], '127.0.0.1') !== false
        )
    );

    // 1. Cas localhost (avec /gdri/ éventuel)
    if (!$forceProduction && $isLocalhost) {
        $pathParts = array_values(array_filter(explode('/', $scriptName)));
        $frontendPos = array_search('frontend', $pathParts);

        if ($frontendPos !== false) {
            $baseParts = array_slice($pathParts, 0, $frontendPos + 1);
            $basePath = '/' . implode('/', $baseParts) . '/';
        } elseif (array_search('gdri', $pathParts) !== false) {
            $basePath = '/gdri/frontend/';
        } else {
            $basePath = '/frontend/';
        }
    }
    // 2. Cas production : on force /frontend/ pour servir les assets
    elseif (
        $forceProduction ||
        strpos($host, 'gdri.fr') !== false ||
        strpos($host, 'gdr-innovation.fr') !== false
    ) {
        $basePath = $servesFromFrontend ? '/frontend/' : '/frontend/';
    }
    // 3. Fallback : utiliser /frontend/
    else {
        $basePath = '/frontend/';
    }

    return preg_replace('#(?<!:)/+#', '/', $basePath);
}

/**
 * Génère l'URL de base de l'API backend
 * Détecte automatiquement si on est en localhost ou en production.
 * Pour forcer l'API (ex. vhost sans proxy) : définir BACKEND_API_URL dans config.local.php.
 */
if (!function_exists('getApiBaseUrl')) {
    function getApiBaseUrl() {
        // Override explicite (ex. config.local.php avec define('BACKEND_API_URL', 'http://localhost:3000/api');)
        if (defined('BACKEND_API_URL') && BACKEND_API_URL !== '') {
            return rtrim(BACKEND_API_URL, '/');
        }
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
            // En dev avec vhost (ex. gdri.local) : sans proxy, l'API doit être sur Node
            // Par défaut on pointe vers le même host (Apache) ; si 404, définir BACKEND_API_URL
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





