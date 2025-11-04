<?php
/**
 * Script d'initialisation - Création de l'entité GDRI
 * Fichier : install/create-gdri-entity.php
 * 
 * Crée l'entité GDRI et associe l'utilisateur ADMIN_GDRI à cette entité
 */

require_once '../frontend/config/config.php';
require_once '../frontend/config/database.php';

echo "🔧 Création de l'entité GDRI...\n\n";

try {
    $db = getDatabase();
    $entitiesCollection = $db->entities;
    $usersCollection = $db->users;
    
    // Vérifier si l'entité GDRI existe déjà
    $gdriEntity = $entitiesCollection->findOne(['name' => 'GDR-Innovation']);
    
    if ($gdriEntity) {
        echo "✅ L'entité GDR-Innovation existe déjà (ID: " . (string)$gdriEntity['_id'] . ")\n";
        $entityId = $gdriEntity['_id'];
    } else {
        // Créer l'entité GDRI
        $entityData = [
            'name' => 'GDR-Innovation',
            'siret' => '800944 407',
            'address' => '921 impasse de la grange de rideaux',
            'status' => 'active',
            'services_authorized' => [], // Tous les services autorisés par défaut
            'created_at' => new MongoDB\BSON\UTCDateTime(),
            'updated_at' => new MongoDB\BSON\UTCDateTime()
        ];
        
        $result = $entitiesCollection->insertOne($entityData);
        $entityId = $result->getInsertedId();
        
        echo "✅ Entité GDR-Innovation créée (ID: " . (string)$entityId . ")\n";
    }
    
    // Associer tous les utilisateurs ADMIN_GDRI à cette entité
    $adminUsers = $usersCollection->find([
        'role' => 'ADMIN_GDRI'
    ])->toArray();
    
    if (empty($adminUsers)) {
        echo "⚠️  Aucun utilisateur ADMIN_GDRI trouvé\n";
    } else {
        $updated = 0;
        foreach ($adminUsers as $user) {
            // Ne mettre à jour que si entity_id est null ou différent
            if (!isset($user['entity_id']) || (string)$user['entity_id'] !== (string)$entityId) {
                $usersCollection->updateOne(
                    ['_id' => $user['_id']],
                    ['$set' => ['entity_id' => $entityId]]
                );
                echo "✅ Utilisateur " . $user['email'] . " associé à l'entité GDRI\n";
                $updated++;
            } else {
                echo "ℹ️  Utilisateur " . $user['email'] . " déjà associé à l'entité GDRI\n";
            }
        }
        
        if ($updated > 0) {
            echo "\n✅ " . $updated . " utilisateur(s) ADMIN_GDRI mis à jour\n";
        }
    }
    
    echo "\n✅ Initialisation terminée !\n";
    echo "📋 ID de l'entité GDRI: " . (string)$entityId . "\n";
    echo "\n💡 Les utilisateurs ADMIN_GDRI peuvent maintenant utiliser les modules avec leur entité GDRI.\n";
    
} catch (Exception $e) {
    echo "❌ Erreur : " . $e->getMessage() . "\n";
    exit(1);
}

?>

