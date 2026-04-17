<?php
/**
 * Traitement de la connexion utilisateur
 * Fichier : auth/login-process.php
 * 
 * Reçoit les données du formulaire de login et vérifie les credentials
 */

require_once '../config/config.php';
require_once '../includes/functions.php';
require_once '../includes/admin-tracking.php';
require_once '../includes/user-tracking.php';
require_once '../includes/jwt-helper.php';
require_once 'session.php';

// Définir le type de contenu JSON
header('Content-Type: application/json');

// Fonction de réponse JSON
function jsonResponse($success, $message, $redirect = null, $data = []) {
    echo json_encode(array_merge([
        'success' => $success,
        'message' => $message,
        'redirect' => $redirect
    ], $data));
    exit;
}

// Vérifier que c'est une requête POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(false, 'Méthode non autorisée');
}

// Récupérer les données JSON
$input = json_decode(file_get_contents('php://input'), true);

// Validation des données
if (empty($input['email']) || empty($input['password'])) {
    jsonResponse(false, 'Veuillez remplir tous les champs');
}

$email = filter_var($input['email'], FILTER_SANITIZE_EMAIL);
$password = $input['password'];

// Validation de l'email
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    jsonResponse(false, 'Adresse email invalide');
}

try {
    $apiBase = rtrim(getApiBaseUrl(), '/');
    if (!$apiBase) {
        jsonResponse(false, 'API indisponible');
    }
    $ch = curl_init($apiBase . '/auth/login-gdri');
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode([
        'email' => $email,
        'password' => $password
    ]));
    curl_setopt($ch, CURLOPT_TIMEOUT, 20);
    $raw = curl_exec($ch);
    $err = curl_error($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    if ($err || $code < 200 || $code >= 300) {
        jsonResponse(false, 'Email ou mot de passe incorrect');
    }
    $decoded = json_decode((string) $raw, true);
    if (empty($decoded['success']) || empty($decoded['data'])) {
        jsonResponse(false, $decoded['message'] ?? 'Email ou mot de passe incorrect');
    }
    $apiUser = $decoded['data'];
    
    // Connexion réussie - Créer la session
    $_SESSION['user_id'] = (string) ($apiUser['user_id'] ?? '');
    $_SESSION['user_email'] = (string) ($apiUser['email'] ?? '');
    $_SESSION['user_role'] = (string) ($apiUser['role'] ?? 'USER_ENTITY');
    $currentEntrepriseId = isset($apiUser['currentEntrepriseId']) ? (string) $apiUser['currentEntrepriseId'] : null;
    
    $_SESSION['entrepriseId'] = $currentEntrepriseId; // Gardé pour compatibilité
    $_SESSION['currentEntrepriseId'] = $currentEntrepriseId;
    
    // Log pour debug
    error_log('PHP Login - User currentEntrepriseId: ' . ($_SESSION['currentEntrepriseId'] ?? 'null'));
    
    // Enregistrer la connexion admin (GDRIadmin uniquement)
    logAdminActivity('login', ['source' => 'login-process']);
    // Enregistrer la connexion utilisateur (GDRI)
    logUserActivity('login', ['source' => 'login-process']);

    // Déterminer la redirection selon le rôle
    $redirect = 'pages/dashboard.php'; // Chemin relatif sans slash initial
    
    jsonResponse(true, 'Connexion réussie', $redirect);
    
} catch (Exception $e) {
    error_log('Erreur de connexion : ' . $e->getMessage());
    jsonResponse(false, 'Erreur du serveur. Veuillez réessayer.');
}


