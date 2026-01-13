<?php
/**
 * Script de test pour vérifier le mapping utilisateurs/entités
 * Fichier : pages/test-users-entities.php
 * 
 * À supprimer après débogage
 */

require_once '../config/config.php';
require_once '../config/database.php';
require_once '../auth/session.php';

// Seul ADMIN_GDRI peut accéder
if (!hasRole(ROLE_ADMIN_GDRI)) {
    die('Accès refusé');
}

$db = getDatabase();
$entitiesCollection = $db->entities;
$usersCollection = $db->users;

// Récupérer toutes les entités
$entities = $entitiesCollection->find([])->toArray();
echo "<h1>Test Mapping Utilisateurs / Entités</h1>";

echo "<h2>1. Liste des entités</h2>";
echo "<table border='1' cellpadding='5'>";
echo "<tr><th>ID</th><th>Nom</th><th>SIRET</th></tr>";
foreach ($entities as $entity) {
    $entityId = (string) $entity['_id'];
    echo "<tr>";
    echo "<td>$entityId</td>";
    echo "<td>" . htmlspecialchars($entity['name'] ?? 'N/A') . "</td>";
    echo "<td>" . htmlspecialchars($entity['siret'] ?? 'N/A') . "</td>";
    echo "</tr>";
}
echo "</table>";

// Récupérer tous les utilisateurs
$allUsers = $usersCollection->find([])->toArray();

echo "<h2>2. Liste des utilisateurs et leurs entreprises</h2>";
echo "<table border='1' cellpadding='5'>";
echo "<tr><th>Email</th><th>Entreprises (format brut)</th><th>Entreprises (format lisible)</th></tr>";
foreach ($allUsers as $user) {
    echo "<tr>";
    echo "<td>" . htmlspecialchars($user['email'] ?? 'N/A') . "</td>";
    
    // Afficher le format brut
    $entreprises = $user['entreprises'] ?? [];
    echo "<td><pre>" . print_r($entreprises, true) . "</pre></td>";
    
    // Afficher le format lisible
    $entreprisesList = [];
    if (is_array($entreprises) && !empty($entreprises)) {
        foreach ($entreprises as $entreprise) {
            if (isset($entreprise['entrepriseId'])) {
                $entrepriseId = $entreprise['entrepriseId'];
                if ($entrepriseId instanceof MongoDB\BSON\ObjectId) {
                    $entrepriseId = (string) $entrepriseId;
                } elseif (is_object($entrepriseId) && method_exists($entrepriseId, '__toString')) {
                    $entrepriseId = $entrepriseId->__toString();
                } else {
                    $entrepriseId = (string) $entrepriseId;
                }
                
                // Trouver le nom de l'entité
                $entityName = 'N/A';
                foreach ($entities as $entity) {
                    $entityIdStr = (string) $entity['_id'];
                    if ($entityIdStr === $entrepriseId) {
                        $entityName = $entity['name'] ?? 'N/A';
                        break;
                    }
                }
                
                $role = $entreprise['role'] ?? 'user';
                $entreprisesList[] = "$entityName (ID: $entrepriseId, Role: $role)";
            }
        }
    }
    echo "<td>" . (empty($entreprisesList) ? '<em>Aucune entreprise</em>' : implode('<br>', $entreprisesList)) . "</td>";
    echo "</tr>";
}
echo "</table>";

// Test du mapping
echo "<h2>3. Mapping Utilisateurs par Entité</h2>";
$usersByEntity = [];
foreach ($allUsers as $user) {
    $entreprises = $user['entreprises'] ?? [];
    if (!empty($entreprises) && is_array($entreprises)) {
        foreach ($entreprises as $entreprise) {
            if (isset($entreprise['entrepriseId'])) {
                $entrepriseIdObj = $entreprise['entrepriseId'];
                if ($entrepriseIdObj instanceof MongoDB\BSON\ObjectId) {
                    $entrepriseId = (string) $entrepriseIdObj;
                } elseif (is_object($entrepriseIdObj) && method_exists($entrepriseIdObj, '__toString')) {
                    $entrepriseId = $entrepriseIdObj->__toString();
                } else {
                    $entrepriseId = (string) $entrepriseIdObj;
                }
                
                if (!isset($usersByEntity[$entrepriseId])) {
                    $usersByEntity[$entrepriseId] = [];
                }
                $usersByEntity[$entrepriseId][] = [
                    'email' => $user['email'] ?? 'N/A',
                    'role' => $entreprise['role'] ?? 'user'
                ];
            }
        }
    }
}

echo "<table border='1' cellpadding='5'>";
echo "<tr><th>Entité</th><th>ID Entité</th><th>Utilisateurs</th></tr>";
foreach ($entities as $entity) {
    $entityIdStr = (string) $entity['_id'];
    $entityUsers = $usersByEntity[$entityIdStr] ?? [];
    
    echo "<tr>";
    echo "<td>" . htmlspecialchars($entity['name'] ?? 'N/A') . "</td>";
    echo "<td>$entityIdStr</td>";
    echo "<td>";
    if (empty($entityUsers)) {
        echo "<em>Aucun utilisateur</em>";
    } else {
        echo "<ul>";
        foreach ($entityUsers as $u) {
            echo "<li>" . htmlspecialchars($u['email']) . " (role: " . htmlspecialchars($u['role']) . ")</li>";
        }
        echo "</ul>";
    }
    echo "</td>";
    echo "</tr>";
}
echo "</table>";

echo "<hr>";
echo "<p><a href='entities.php'>Retour à la page des entités</a></p>";
?>
