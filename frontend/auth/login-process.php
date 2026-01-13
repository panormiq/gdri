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
    
    // ✅ Format multi-entreprises (doc-template) : utiliser currentEntrepriseId
    $currentEntrepriseId = null;
    
    // Utiliser currentEntrepriseId si disponible
    if (isset($user['currentEntrepriseId']) && $user['currentEntrepriseId'] !== null) {
        $currentEntrepriseId = (string) $user['currentEntrepriseId'];
    }
    // Si pas de currentEntrepriseId mais des entreprises, prendre la première
    elseif (isset($user['entreprises']) && is_array($user['entreprises']) && count($user['entreprises']) > 0) {
        $firstEntreprise = $user['entreprises'][0];
        if (isset($firstEntreprise['entrepriseId'])) {
            $currentEntrepriseId = (string) $firstEntreprise['entrepriseId'];
            // Mettre à jour currentEntrepriseId dans MongoDB
            $usersCollection->updateOne(
                ['_id' => $user['_id']],
                ['$set' => ['currentEntrepriseId' => new MongoDB\BSON\ObjectId($currentEntrepriseId)]]
            );
        }
    }
    // Migration depuis format GDRI (entity_id) vers format multi-entreprises
    elseif (isset($user['entity_id']) && $user['entity_id'] !== null) {
        $entityId = (string) $user['entity_id'];
        // Créer le tableau entreprises avec l'entity_id existant
        $usersCollection->updateOne(
            ['_id' => $user['_id']],
            [
                '$set' => [
                    'currentEntrepriseId' => new MongoDB\BSON\ObjectId($entityId),
                    'entreprises' => [[
                        'entrepriseId' => new MongoDB\BSON\ObjectId($entityId),
                        'role' => $user['role'] === 'ADMIN_ENTITY' ? 'admin' : 'user',
                        'joinedAt' => new MongoDB\BSON\UTCDateTime()
                    ]]
                ]
            ]
        );
        $currentEntrepriseId = $entityId;
    }
    
    $_SESSION['entrepriseId'] = $currentEntrepriseId; // Gardé pour compatibilité
    $_SESSION['currentEntrepriseId'] = $currentEntrepriseId;
    
    // Log pour debug
    error_log('PHP Login - User currentEntrepriseId: ' . ($_SESSION['currentEntrepriseId'] ?? 'null'));
    
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


