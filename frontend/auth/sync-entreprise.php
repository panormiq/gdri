<?php
/**
 * Synchronisation de l'entreprise active avec la session PHP
 * Fichier : auth/sync-entreprise.php
 * 
 * Met à jour la session PHP avec le currentEntrepriseId depuis MongoDB
 * Appelé après un changement d'entreprise via l'API
 */

require_once '../config/config.php';
require_once '../includes/functions.php';
require_once '../includes/jwt-helper.php';
require_once 'session.php';

// Vérifier que l'utilisateur est connecté
if (!isLoggedIn()) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Non authentifié']);
    exit;
}

try {
    $token = getJWTToken();
    $apiBase = rtrim(getApiBaseUrl(), '/');
    if (!$token || !$apiBase) {
        throw new Exception('Session JWT/API indisponible');
    }
    $ch = curl_init($apiBase . '/users/me/entreprises');
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Authorization: Bearer ' . $token,
        'Content-Type: application/json'
    ]);
    curl_setopt($ch, CURLOPT_TIMEOUT, 15);
    $raw = curl_exec($ch);
    $err = curl_error($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    if ($err || $code < 200 || $code >= 300) {
        throw new Exception($err ?: 'Erreur API users/me/entreprises');
    }
    $decoded = json_decode((string)$raw, true);
    $currentEntrepriseId = $decoded['currentEntrepriseId'] ?? null;
    
    $_SESSION['currentEntrepriseId'] = $currentEntrepriseId;
    $_SESSION['entrepriseId'] = $currentEntrepriseId; // Gardé pour compatibilité

    $freshJwt = getJWTToken();
    
    echo json_encode([
        'success' => true,
        'message' => 'Session synchronisée',
        'currentEntrepriseId' => $currentEntrepriseId,
        'jwt' => $freshJwt
    ]);
    
} catch (Exception $e) {
    error_log('Erreur sync-entreprise: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Erreur serveur']);
}
