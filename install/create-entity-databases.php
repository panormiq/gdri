<?php
/**
 * Script d'initialisation - Création des bases de données des entités
 * Fichier : install/create-entity-databases.php
 * 
 * Crée les bases MongoDB pour toutes les entités existantes
 */

require_once '../frontend/config/config.php';
require_once '../frontend/config/database.php';

echo "🔧 Création des bases de données des entités...\n\n";

try {
    // Récupérer le client MongoDB
    require_once __DIR__ . '/../vendor/autoload.php';
    $mongoClient = new MongoDB\Client("mongodb://gdri_admin:gdri2024@localhost:27017/GDR-INNOVATION?authSource=GDR-INNOVATION");
    $db = $mongoClient->selectDatabase('GDR-INNOVATION');
    $entitiesCollection = $db->selectCollection('entities');
    
    // Récupérer toutes les entités
    $entities = $entitiesCollection->find([])->toArray();
    
    if (empty($entities)) {
        echo "⚠️  Aucune entité trouvée\n";
        exit(0);
    }
    
    echo "📋 " . count($entities) . " entité(s) trouvée(s)\n\n";
    
    foreach ($entities as $entity) {
        $entityId = (string) $entity['_id'];
        $dbName = "GDR-ENTITY-{$entityId}";
        
        echo "🔨 Création de la base : {$dbName} pour l'entité {$entity['name']}...\n";
        
        try {
            // Créer une collection dans cette base pour l'initialiser
            $entityDb = $mongoClient->selectDatabase($dbName);
            $entityDb->createCollection('_init');
            echo "✅ Base créée : {$dbName}\n";
        } catch (Exception $e) {
            if (strpos($e->getMessage(), 'already exists') !== false) {
                echo "ℹ️  Base déjà existante : {$dbName}\n";
            } else {
                echo "⚠️  Erreur création base {$dbName}: " . $e->getMessage() . "\n";
            }
        }
    }
    
    echo "\n✅ Initialisation terminée !\n";
    
} catch (Exception $e) {
    echo "❌ Erreur : " . $e->getMessage() . "\n";
    exit(1);
}

?>

