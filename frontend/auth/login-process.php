<?php
/**
 * Traitement de la connexion utilisateur
 * Fichier : auth/login-process.php
 * 
 * Reçoit les données du formulaire de login et vérifie les credentials
 */

require_once '../config/config.php';
require_once '../config/database.php';
require_once '../includes/functions.php';
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
    // Connexion à MongoDB
    $db = getDatabase();
    $usersCollection = $db->users;
    
    // Rechercher l'utilisateur par email
    $user = $usersCollection->findOne(['email' => $email]);
    
    if (!$user) {
        jsonResponse(false, 'Email ou mot de passe incorrect');
    }
    
    // Vérifier le statut du compte
    if ($user['status'] !== 'active') {
        jsonResponse(false, 'Votre compte est inactif. Contactez l\'administrateur.');
    }
    
    // Vérifier le mot de passe
    if (!password_verify($password, $user['password_hash'])) {
        jsonResponse(false, 'Email ou mot de passe incorrect');
    }
    
    // Connexion réussie - Créer la session
    $_SESSION['user_id'] = (string) $user['_id'];
    $_SESSION['user_email'] = $user['email'];
    $_SESSION['user_role'] = $user['role'];
    $_SESSION['entity_id'] = isset($user['entity_id']) ? (string) $user['entity_id'] : null;
    
    // Mettre à jour la date de dernière connexion
    $usersCollection->updateOne(
        ['_id' => $user['_id']],
        ['$set' => ['last_login' => new MongoDB\BSON\UTCDateTime()]]
    );
    
    // Déterminer la redirection selon le rôle
    $redirect = 'pages/dashboard.php'; // Chemin relatif sans slash initial
    
    jsonResponse(true, 'Connexion réussie', $redirect);
    
} catch (Exception $e) {
    error_log('Erreur de connexion : ' . $e->getMessage());
    jsonResponse(false, 'Erreur du serveur. Veuillez réessayer.');
}


