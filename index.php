<?php
/**
 * Point d'entrée racine - GDRI
 * Redirige vers le frontend
 */

// Changement de répertoire vers frontend
chdir(__DIR__ . '/frontend');

// Inclusion de l'index.php du frontend
require_once 'index.php';

