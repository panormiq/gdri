<?php
/**
 * Configuration de la connexion MongoDB
 * Fichier : config/database.php
 * 
 * Fonction : getDatabase() - Retourne l'instance de la base de données MongoDB
 */

require_once __DIR__ . '/../vendor/autoload.php';

/**
 * Retourne la connexion à la base de données MongoDB
 * @return MongoDB\Database L'instance de la base de données
 */
function getDatabase() {
    static $db = null;
    
    if ($db === null) {
        try {
            $isTest = (defined('ENVIRONMENT') && ENVIRONMENT === 'test')
                || (function_exists('isTestHost') && isTestHost());

            // Configuration MongoDB (surchargeable via env / environnement test)
            $mongoHost = getenv('MONGODB_HOST') ?: 'localhost';
            $mongoPort = getenv('MONGODB_PORT') ?: '27017';
            $mongoUser = getenv('MONGODB_USER') ?: 'gdri_admin';
            $mongoPassword = getenv('MONGODB_PASSWORD') ?: 'gdri2024';

            // Sur test.gdri.fr : toujours la base TEST (jamais GDR-INNOVATION prod)
            if ($isTest) {
                $mongoDatabase = getenv('MONGODB_DB') ?: 'GDR-INNOVATION-TEST';
                if ($mongoDatabase === 'GDR-INNOVATION') {
                    $mongoDatabase = 'GDR-INNOVATION-TEST';
                }
            } else {
                $mongoDatabase = getenv('MONGODB_DB') ?: 'GDR-INNOVATION';
            }

            $authSource = getenv('MONGODB_AUTH_SOURCE') ?: 'GDR-INNOVATION';
            
            // URI de connexion MongoDB avec authentification
            $uri = getenv('MONGODB_URI') ?: "mongodb://{$mongoUser}:{$mongoPassword}@{$mongoHost}:{$mongoPort}/{$mongoDatabase}?authSource={$authSource}";
            // Si URI forcée pointe encore vers la prod alors qu'on est en test, forcer le nom de DB
            if ($isTest && strpos($uri, 'GDR-INNOVATION-TEST') === false) {
                $uri = "mongodb://{$mongoUser}:{$mongoPassword}@{$mongoHost}:{$mongoPort}/{$mongoDatabase}?authSource={$authSource}";
            }
            
            // Créer le client MongoDB
            $client = new MongoDB\Client($uri);
            
            // Sélectionner la base de données
            $db = $client->selectDatabase($mongoDatabase);
            
        } catch (Exception $e) {
            error_log('Erreur de connexion MongoDB : ' . $e->getMessage());
            die('Erreur de connexion à la base de données');
        }
    }
    
    return $db;
}

/**
 * Récupère les credentials d'une entreprise depuis la collection entreprise_credentials
 * @param string $entrepriseId ID de l'entreprise
 * @return array|null Tableau avec 'username' et 'password' ou null si erreur
 */
function getEntrepriseCredentials($entrepriseId) {
    try {
        $db = getDatabase();
        $credentialsCollection = $db->entreprise_credentials;
        
        error_log("🔑 Recherche credentials pour entreprise: {$entrepriseId}");
        $credentials = $credentialsCollection->findOne(['entrepriseId' => $entrepriseId]);
        
        if (!$credentials) {
            error_log("⚠️ Credentials non trouvés pour l'entreprise {$entrepriseId}");
            return null;
        }
        
        error_log("✅ Credentials trouvés pour entreprise {$entrepriseId}, username: " . ($credentials['username'] ?? 'N/A'));
        
        // Déchiffrer le mot de passe (AES-256-CBC)
        $encryptionKey = getenv('CREDENTIALS_ENCRYPTION_KEY') ?: 'CHANGER_EN_PRODUCTION_32_CHARS';
        $encryptionKey = substr($encryptionKey, 0, 32); // Prendre les 32 premiers caractères
        
        if (!isset($credentials['iv']) || !isset($credentials['encryptedPassword'])) {
            error_log("❌ Credentials incomplets pour l'entreprise {$entrepriseId}");
            return null;
        }
        
        $iv = hex2bin($credentials['iv']);
        $encryptedPassword = $credentials['encryptedPassword'];
        
        // Déchiffrer avec openssl
        $decryptedPassword = openssl_decrypt($encryptedPassword, 'aes-256-cbc', $encryptionKey, 0, $iv);
        
        if ($decryptedPassword === false) {
            $errorMsg = openssl_error_string();
            error_log("❌ Erreur lors du déchiffrement du mot de passe pour l'entreprise {$entrepriseId}: " . $errorMsg);
            return null;
        }
        
        error_log("✅ Mot de passe déchiffré avec succès pour entreprise {$entrepriseId}");
        
        return [
            'username' => $credentials['username'],
            'password' => $decryptedPassword
        ];
    } catch (Exception $e) {
        error_log("❌ Erreur lors de la récupération des credentials: " . $e->getMessage());
        error_log("❌ Stack trace: " . $e->getTraceAsString());
        return null;
    }
}

/**
 * Retourne la connexion à la base de données d'une entreprise spécifique
 * Utilise les credentials stockés dans la collection entreprise_credentials
 * @param string $entrepriseId ID de l'entreprise
 * @return MongoDB\Database|null L'instance de la base de données de l'entreprise ou null si erreur
 */
function getEntrepriseDatabase($entrepriseId) {
    static $entrepriseDbs = [];
    
    // Vérifier le cache
    if (isset($entrepriseDbs[$entrepriseId])) {
        return $entrepriseDbs[$entrepriseId];
    }
    
    try {
        // Récupérer les credentials de l'entreprise
        $credentials = getEntrepriseCredentials($entrepriseId);
        
        if (!$credentials) {
            error_log("❌ Impossible de récupérer les credentials pour l'entreprise {$entrepriseId}");
            return null;
        }
        
        // Configuration MongoDB
        $mongoHost = 'localhost';
        $mongoPort = '27017';
        $mongoDatabase = "GDR-ENTREPRISE-{$entrepriseId}";
        $mongoUser = $credentials['username'];
        $mongoPassword = $credentials['password'];
        
        // URI de connexion MongoDB avec authentification
        // Utiliser authSource={$mongoDatabase} car l'utilisateur entreprise_xxx est dans cette base
        $uri = "mongodb://{$mongoUser}:{$mongoPassword}@{$mongoHost}:{$mongoPort}/{$mongoDatabase}?authSource={$mongoDatabase}";
        
        error_log("🔌 Tentative de connexion à la base d'entreprise: {$mongoDatabase} avec utilisateur {$mongoUser}");
        
        // Créer le client MongoDB
        $client = new MongoDB\Client($uri);
        
        // Sélectionner la base de données
        $db = $client->selectDatabase($mongoDatabase);
        
        // Tester l'accès (vérifier que la base existe)
        try {
            $collections = $db->listCollections();
            $collectionArray = iterator_to_array($collections);
            error_log("✅ Base d'entreprise accessible: {$mongoDatabase} (" . count($collectionArray) . " collection(s))");
        } catch (Exception $listError) {
            // Si la base n'existe pas encore, on peut quand même continuer
            error_log("⚠️ Impossible de lister les collections (base peut-être vide): " . $listError->getMessage());
        }
        
        // Mettre en cache
        $entrepriseDbs[$entrepriseId] = $db;
        
        return $db;
        
    } catch (Exception $e) {
        error_log("❌ Impossible d'accéder à la base d'entreprise GDR-ENTREPRISE-{$entrepriseId}: " . $e->getMessage());
        return null;
    }
}

/**
 * Test de connexion MongoDB
 * @return bool True si la connexion réussit
 */
function testDatabaseConnection() {
    try {
        $db = getDatabase();
        $db->command(['ping' => 1]);
        return true;
    } catch (Exception $e) {
        error_log('Test de connexion échoué : ' . $e->getMessage());
        return false;
    }
}



