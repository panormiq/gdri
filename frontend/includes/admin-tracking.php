<?php
/**
 * Suivi d'activité pour l'admin GDRI
 * Fichier : includes/admin-tracking.php
 */

if (!function_exists('logAdminActivity')) {
    function callActivityApi($endpoint, $payload)
    {
        $token = function_exists('getJWTToken') ? getJWTToken() : null;
        $apiBase = function_exists('getApiBaseUrl') ? rtrim(getApiBaseUrl(), '/') : '';
        if (!$token || !$apiBase) {
            return false;
        }
        $ch = curl_init($apiBase . $endpoint);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Authorization: Bearer ' . $token,
            'Content-Type: application/json'
        ]);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
        curl_setopt($ch, CURLOPT_TIMEOUT, 10);
        $raw = curl_exec($ch);
        $err = curl_error($ch);
        $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        if ($err || $code < 200 || $code >= 300) {
            return false;
        }
        $decoded = json_decode((string) $raw, true);
        return !empty($decoded['success']);
    }

    /**
     * Enregistre un événement d'activité admin en base.
     * @param string $eventType Type d'événement (login, page_view, tab_view, etc.)
     * @param array $eventData Données additionnelles de l'événement
     * @return bool True si l'enregistrement a réussi, false sinon
     */
    function logAdminActivity($eventType, $eventData = []) {
        try {
            if (!isLoggedIn()) {
                return false;
            }
            if (!hasRole(ROLE_ADMIN_GDRI) && !hasRole(ROLE_ADMIN_ENTITY)) {
                return false;
            }

            return callActivityApi('/activity-logs/admin', [
                'eventType' => $eventType,
                'eventData' => is_array($eventData) ? $eventData : []
            ]);
        } catch (Exception $e) {
            error_log('Erreur log admin activity : ' . $e->getMessage());
            return false;
        }
    }
}

