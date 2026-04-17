<?php
/**
 * Endpoint de suivi d'activité utilisateur GDRI
 * Fichier : auth/user-activity.php
 */

require_once '../config/config.php';
require_once '../config/database.php';
require_once '../includes/functions.php';
require_once 'session.php';
require_once '../includes/user-tracking.php';

header('Content-Type: application/json');

function jsonResponse($success, $message, $data = []) {
    echo json_encode(array_merge([
        'success' => $success,
        'message' => $message
    ], $data));
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(false, 'Méthode non autorisée');
}

if (!isLoggedIn()) {
    jsonResponse(false, 'Non authentifié');
}

$input = json_decode(file_get_contents('php://input'), true);
if (!$input || empty($input['eventType'])) {
    jsonResponse(false, 'Données invalides');
}

$eventType = trim($input['eventType']);
$allowedTypes = ['page_view', 'login'];
if (!in_array($eventType, $allowedTypes, true)) {
    jsonResponse(false, 'Type d\'événement non autorisé');
}

$eventData = [
    'page' => $input['page'] ?? null,
    'url' => $input['url'] ?? null,
    'referrer' => $input['referrer'] ?? null
];

$logged = logUserActivity($eventType, $eventData);
if (!$logged) {
    jsonResponse(false, 'Impossible d\'enregistrer l\'événement');
}

jsonResponse(true, 'Événement enregistré');

