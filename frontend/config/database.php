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
            // Configuration MongoDB
            $mongoHost = 'localhost';
            $mongoPort = '27017';
            $mongoDatabase = 'GDR-INNOVATION';
            $mongoUser = 'gdri_admin';
            $mongoPassword = 'gdri2024';
            
            // URI de connexion MongoDB avec authentification
            $uri = "mongodb://{$mongoUser}:{$mongoPassword}@{$mongoHost}:{$mongoPort}/{$mongoDatabase}?authSource={$mongoDatabase}";
            
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



