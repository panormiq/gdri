<?php
/**
 * Script de test pour vérifier les URLs générées
 */
require_once 'config/config.php';
require_once 'includes/functions.php';

echo "<h1>Test des URLs</h1>";
echo "<pre>";

echo "SERVER INFO:\n";
echo "HTTP_HOST: " . ($_SERVER['HTTP_HOST'] ?? 'NON DÉFINI') . "\n";
echo "SCRIPT_NAME: " . ($_SERVER['SCRIPT_NAME'] ?? 'NON DÉFINI') . "\n";
echo "REQUEST_URI: " . ($_SERVER['REQUEST_URI'] ?? 'NON DÉFINI') . "\n";
echo "DOCUMENT_ROOT: " . ($_SERVER['DOCUMENT_ROOT'] ?? 'NON DÉFINI') . "\n\n";

echo "BASE_URL: " . BASE_URL . "\n";
echo "API_BASE_URL: " . API_BASE_URL . "\n\n";

echo "URLs générées:\n";
echo "CSS: " . url('assets/css/main.css') . "\n";
echo "JS: " . url('assets/js/main.js') . "\n";
echo "Index: " . url('index.php') . "\n";
echo "Dashboard: " . url('pages/dashboard.php') . "\n";

echo "</pre>";
?>

