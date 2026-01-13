<?php
/**
 * Version optimisée de entities.php
 * Utilise la collection users dans la base d'entreprise pour de meilleures performances
 */

require_once '../config/config.php';
require_once '../config/database.php';
require_once '../auth/session.php';
require_once '../includes/functions.php';
require_once '../includes/jwt-helper.php';

// Seul ADMIN_GDRI peut accéder
if (!hasRole(ROLE_ADMIN_GDRI)) {
    redirect(url('pages/dashboard.php'));
}

$page_title = 'Gestion des Entités';

require_once '../includes/header.php';

// Récupérer toutes les entités
$db = getDatabase();
$entitiesCollection = $db->entities;
$entities = $entitiesCollection->find([])->toArray();

// Récupérer tous les services/modules disponibles
$servicesCollection = $db->services;
$services = $servicesCollection->find([])->toArray();

// Récupérer tous les utilisateurs de la base principale (pour affichage général)
$usersCollection = $db->users;
$allUsers = $usersCollection->find([])->toArray();

// Mapper les utilisateurs par entité
// OPTIMISATION: Récupérer depuis la collection users de chaque base d'entreprise
$usersByEntity = [];
error_log('🔍 Début du mapping optimisé des utilisateurs. Total entités: ' . count($entities));

foreach ($entities as $entity) {
    $entityId = (string) $entity['_id'];
    $entityName = $entity['name'] ?? 'N/A';
    
    error_log("  🏢 Traitement entité: $entityName (ID: $entityId)");
    
    try {
        // Essayer de récupérer depuis la base d'entreprise
        $entrepriseDbName = "GDR-ENTREPRISE-$entityId";
        $entrepriseDb = getDatabase($entrepriseDbName);
        
        if ($entrepriseDb) {
            $entrepriseUsersCollection = $entrepriseDb->users;
            $entrepriseUsers = $entrepriseUsersCollection->find([])->toArray();
            
            error_log("    ✅ " . count($entrepriseUsers) . " utilisateur(s) trouvé(s) dans la base d'entreprise");
            
            // Récupérer les détails complets depuis la base principale
            foreach ($entrepriseUsers as $enterpriseUserRef) {
                $userId = $enterpriseUserRef['userId'];
                if ($userId instanceof MongoDB\BSON\ObjectId) {
                    $userIdStr = (string) $userId;
                } else {
                    $userIdStr = (string) $userId;
                }
                
                // Récupérer l'utilisateur complet depuis la base principale
                $fullUser = $usersCollection->findOne(['_id' => new MongoDB\BSON\ObjectId($userIdStr)]);
                
                if ($fullUser) {
                    // Trouver le rôle spécifique dans cette entreprise
                    $entrepriseRole = $enterpriseUserRef['role'] ?? 'user';
                    $userEntreprises = $fullUser['entreprises'] ?? [];
                    foreach ($userEntreprises as $userEnt) {
                        $userEntId = (string) ($userEnt['entrepriseId'] ?? '');
                        if (strtolower(trim($userEntId)) === strtolower(trim($entityId))) {
                            $entrepriseRole = $userEnt['role'] ?? $entrepriseRole;
                            break;
                        }
                    }
                    
                    if (!isset($usersByEntity[$entityId])) {
                        $usersByEntity[$entityId] = [];
                    }
                    
                    $userForEntity = $fullUser;
                    $userForEntity['role_in_entity'] = $entrepriseRole;
                    $usersByEntity[$entityId][] = $userForEntity;
                    
                    error_log("      ✅ Utilisateur ajouté: " . ($fullUser['email'] ?? 'N/A') . " (role: $entrepriseRole)");
                }
            }
        } else {
            error_log("    ⚠️ Impossible d'accéder à la base d'entreprise pour $entityName");
            
            // Fallback : utiliser l'ancienne méthode (filtrage depuis la base principale)
            error_log("    🔄 Fallback : recherche dans la base principale...");
            foreach ($allUsers as $user) {
                $entreprises = $user['entreprises'] ?? [];
                if (!empty($entreprises) && is_array($entreprises)) {
                    foreach ($entreprises as $entreprise) {
                        if (isset($entreprise['entrepriseId'])) {
                            $entrepriseIdObj = $entreprise['entrepriseId'];
                            $entrepriseIdStr = is_string($entrepriseIdObj) 
                                ? trim(strtolower($entrepriseIdObj))
                                : trim(strtolower((string) $entrepriseIdObj));
                            $entityIdNormalized = trim(strtolower($entityId));
                            
                            if ($entrepriseIdStr === $entityIdNormalized) {
                                if (!isset($usersByEntity[$entityId])) {
                                    $usersByEntity[$entityId] = [];
                                }
                                $userForEntity = $user;
                                $userForEntity['role_in_entity'] = $entreprise['role'] ?? 'user';
                                $usersByEntity[$entityId][] = $userForEntity;
                                break;
                            }
                        }
                    }
                }
            }
            error_log("    ✅ " . (isset($usersByEntity[$entityId]) ? count($usersByEntity[$entityId]) : 0) . " utilisateur(s) trouvé(s) via fallback");
        }
    } catch (Exception $e) {
        error_log("    ❌ Erreur lors de l'accès à la base d'entreprise pour $entityName: " . $e->getMessage());
        
        // Fallback : utiliser l'ancienne méthode
        foreach ($allUsers as $user) {
            $entreprises = $user['entreprises'] ?? [];
            if (!empty($entreprises) && is_array($entreprises)) {
                foreach ($entreprises as $entreprise) {
                    if (isset($entreprise['entrepriseId'])) {
                        $entrepriseIdObj = $entreprise['entrepriseId'];
                        $entrepriseIdStr = is_string($entrepriseIdObj) 
                            ? trim(strtolower($entrepriseIdObj))
                            : trim(strtolower((string) $entrepriseIdObj));
                        $entityIdNormalized = trim(strtolower($entityId));
                        
                        if ($entrepriseIdStr === $entityIdNormalized) {
                            if (!isset($usersByEntity[$entityId])) {
                                $usersByEntity[$entityId] = [];
                            }
                            $userForEntity = $user;
                            $userForEntity['role_in_entity'] = $entreprise['role'] ?? 'user';
                            $usersByEntity[$entityId][] = $userForEntity;
                            break;
                        }
                    }
                }
            }
        }
    }
}

error_log('📊 Résultat final du mapping:');
foreach ($usersByEntity as $entityId => $users) {
    error_log("  Entité $entityId: " . count($users) . " utilisateur(s)");
}
?>
