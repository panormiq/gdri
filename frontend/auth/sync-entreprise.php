<?php
/**
 * Synchronisation de l'entreprise active avec la session PHP
 * Fichier : auth/sync-entreprise.php
 * 
 * Met à jour la session PHP avec le currentEntrepriseId depuis MongoDB
 * Appelé après un changement d'entreprise via l'API
 */

require_once '../config/config.php';
require_once '../config/database.php';
require_once '../includes/functions.php';
require_once 'session.php';

// Vérifier que l'utilisateur est connecté
if (!isLoggedIn()) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Non authentifié']);
    exit;
}

try {
    $db = getDatabase();
    $usersCollection = $db->users;
    
    $userId = $_SESSION['user_id'];
    $user = $usersCollection->findOne(['_id' => new MongoDB\BSON\ObjectId($userId)]);
    
    if (!$user) {
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'Utilisateur non trouvé']);
        exit;
    }
    
    // Mettre à jour la session avec le currentEntrepriseId depuis MongoDB
    $currentEntrepriseId = isset($user['currentEntrepriseId']) 
        ? (string) $user['currentEntrepriseId'] 
        : null;
    
    $_SESSION['currentEntrepriseId'] = $currentEntrepriseId;
    $_SESSION['entrepriseId'] = $currentEntrepriseId; // Gardé pour compatibilité
    
    echo json_encode([
        'success' => true,
        'message' => 'Session synchronisée',
        'currentEntrepriseId' => $currentEntrepriseId
    ]);
    
} catch (Exception $e) {
    error_log('Erreur sync-entreprise: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Erreur serveur']);
}
