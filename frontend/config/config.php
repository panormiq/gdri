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
define('SITE_ADDRESS', '921 impasse de la grange de rideaux');
define('SITE_SIRET', '800944 407');

// URLs
define('BASE_URL', '/gdri-dev/frontend/');

// Rôles utilisateurs
define('ROLE_ADMIN_GDRI', 'ADMIN_GDRI');
define('ROLE_ADMIN_ENTITY', 'ADMIN_ENTITY');
define('ROLE_USER_ENTITY', 'USER_ENTITY');

// Statuts
define('STATUS_ACTIVE', 'active');
define('STATUS_INACTIVE', 'inactive');





