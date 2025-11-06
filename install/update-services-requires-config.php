<?php
/**
 * Script de mise à jour des services - Ajout du champ requires_config
 * Fichier : install/update-services-requires-config.php
 * 
 * Ajoute le champ requires_config aux services qui en ont besoin
 */

require_once '../frontend/config/config.php';
require_once '../frontend/config/database.php';

echo "🔧 Mise à jour des services - Ajout du champ requires_config...\n\n";

try {
    $db = getDatabase();
    $servicesCollection = $db->services;
    
    // Services nécessitant une configuration
    $servicesRequiringConfig = [
        'Agent Mail' => true,
        'Agent Facebook' => true
    ];
    
    // Parcourir tous les services
    $services = $servicesCollection->find([])->toArray();
    
    $updated = 0;
    foreach ($services as $service) {
        $serviceName = $service['name'];
        $shouldRequireConfig = isset($servicesRequiringConfig[$serviceName]) 
            ? $servicesRequiringConfig[$serviceName] 
            : false;
        
        // Vérifier si le champ existe déjà
        if (!isset($service['requires_config'])) {
            $servicesCollection->updateOne(
                ['_id' => $service['_id']],
                ['$set' => ['requires_config' => $shouldRequireConfig]]
            );
            echo "✅ Service mis à jour : {$serviceName} (requires_config: " . ($shouldRequireConfig ? 'true' : 'false') . ")\n";
            $updated++;
        } else {
            echo "ℹ️  Service déjà configuré : {$serviceName}\n";
        }
    }
    
    echo "\n✅ Mise à jour terminée : {$updated} service(s) mis à jour\n";
    
} catch (Exception $e) {
    echo "❌ Erreur : " . $e->getMessage() . "\n";
    exit(1);
}

