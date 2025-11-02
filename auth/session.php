<?php
/**
 * Gestion des sessions utilisateur
 * Fichier : auth/session.php
 * 
 * Fonction : startSecureSession() - Démarre une session sécurisée
 */

/**
 * Démarre une session sécurisée avec des paramètres de sécurité renforcés
 */
function startSecureSession() {
    if (session_status() === PHP_SESSION_NONE) {
        // Configuration sécurisée de la session
        ini_set('session.cookie_httponly', 1);
        ini_set('session.use_only_cookies', 1);
        ini_set('session.cookie_secure', 0); // Mettre à 1 en production avec HTTPS
        ini_set('session.cookie_samesite', 'Strict');
        
        // Durée de vie de la session : 2 heures
        ini_set('session.gc_maxlifetime', 7200);
        
        session_start();
        
        // Régénérer l'ID de session régulièrement pour éviter le vol de session
        if (!isset($_SESSION['created'])) {
            $_SESSION['created'] = time();
        } else if (time() - $_SESSION['created'] > 1800) {
            // Régénérer toutes les 30 minutes
            session_regenerate_id(true);
            $_SESSION['created'] = time();
        }
    }
}

// Démarrer automatiquement la session lors de l'inclusion
startSecureSession();





